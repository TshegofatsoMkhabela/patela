// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./PatellaRegistry.sol";

contract PatellaEscrowAndLogistics is ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public czarToken;
    PatellaRegistry public registry;

    enum OrderStatus { Created, Funded, InTransit, Disputed, Completed, Cancelled }

    struct Milestone {
        address recipient;
        uint256 amount;
        uint8 requiredStep;
        bool released;
        bytes32 evidenceHash;
    }

    struct Order {
        address buyer;
        address supplier;
        bytes32 agreementHash;
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 autoApproveWindow;
        uint256 lastEventTimestamp;
        uint8 currentHandoffStep;
        OrderStatus status;
    }

    struct HandoffRecord {
        address giver;
        address receiver;
        bytes32 shipmentHash;
        bytes32 geoPhotoHash;
        uint256 timestamp;
    }

    uint256 public orderCounter;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Milestone[]) public orderMilestones;
    mapping(uint256 => HandoffRecord[]) public orderHandoffs;
    mapping(bytes32 => bool) public usedNonces;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed supplier, bytes32 agreementHash, uint256 totalAmount);
    event EscrowFunded(uint256 indexed orderId, uint256 amount);
    event HandoffVerified(uint256 indexed orderId, uint8 step, address indexed giver, address indexed receiver, bytes32 geoPhotoHash);
    event MilestoneReleased(uint256 indexed orderId, uint256 milestoneIndex, address indexed recipient, uint256 amount);
    event OrderDisputed(uint256 indexed orderId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed orderId, bool releasedToSupplier);

    constructor(address _czarToken, address _registry) {
        czarToken = IERC20(_czarToken);
        registry = PatellaRegistry(_registry);
    }

    function createOrder(
        address supplier,
        bytes32 agreementHash,
        uint256 autoApproveWindow,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint8[] calldata triggerSteps
    ) external returns (uint256) {
        require(recipients.length == amounts.length && amounts.length == triggerSteps.length, "Array mismatch");
        require(recipients.length > 0, "At least one milestone required");

        uint256 total = 0;
        uint256 orderId = ++orderCounter;

        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
            orderMilestones[orderId].push(Milestone({
                recipient: recipients[i],
                amount: amounts[i],
                requiredStep: triggerSteps[i],
                released: false,
                evidenceHash: bytes32(0)
            }));
        }

        orders[orderId] = Order({
            buyer: msg.sender,
            supplier: supplier,
            agreementHash: agreementHash,
            totalAmount: total,
            releasedAmount: 0,
            autoApproveWindow: autoApproveWindow,
            lastEventTimestamp: block.timestamp,
            currentHandoffStep: 0,
            status: OrderStatus.Created
        });

        emit OrderCreated(orderId, msg.sender, supplier, agreementHash, total);
        return orderId;
    }

    function fundEscrow(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        require(msg.sender == o.buyer, "Only buyer can fund");
        require(o.status == OrderStatus.Created, "Order already funded or invalid");

        require(czarToken.transferFrom(msg.sender, address(this), o.totalAmount), "CZAR transfer failed");

        o.status = OrderStatus.Funded;
        o.lastEventTimestamp = block.timestamp;
        emit EscrowFunded(orderId, o.totalAmount);
    }

    function recordTwoPartyHandoff(
        uint256 orderId,
        address giver,
        address receiver,
        bytes32 geoPhotoHash,
        bytes32 qrNonce,
        uint256 qrExpiry,
        bytes calldata giverSig,
        bytes calldata receiverSig
    ) external nonReentrant {
        Order storage o = orders[orderId];
        require(o.status == OrderStatus.Funded || o.status == OrderStatus.InTransit, "Order not active");
        require(block.timestamp <= qrExpiry, "QR code expired");
        require(!usedNonces[qrNonce], "QR code already used");

        bytes32 payloadHash = keccak256(abi.encodePacked(orderId, o.agreementHash, giver, receiver, geoPhotoHash, qrNonce, qrExpiry));
        bytes32 ethSignedHash = payloadHash.toEthSignedMessageHash();

        require(ethSignedHash.recover(giverSig) == giver, "Invalid giver signature");
        require(ethSignedHash.recover(receiverSig) == receiver, "Invalid receiver signature");

        usedNonces[qrNonce] = true;
        o.currentHandoffStep += 1;
        o.status = OrderStatus.InTransit;
        o.lastEventTimestamp = block.timestamp;

        orderHandoffs[orderId].push(HandoffRecord({
            giver: giver,
            receiver: receiver,
            shipmentHash: o.agreementHash,
            geoPhotoHash: geoPhotoHash,
            timestamp: block.timestamp
        }));

        emit HandoffVerified(orderId, o.currentHandoffStep, giver, receiver, geoPhotoHash);
        _releaseMilestonesForStep(orderId, o.currentHandoffStep);
    }

    function approveMilestone(uint256 orderId, uint256 milestoneIndex, bytes32 evidenceHash) external nonReentrant {
        Order storage o = orders[orderId];
        require(msg.sender == o.buyer, "Only buyer can approve");
        require(o.status == OrderStatus.Funded || o.status == OrderStatus.InTransit, "Invalid order state");

        Milestone storage m = orderMilestones[orderId][milestoneIndex];
        require(!m.released, "Already released");

        m.evidenceHash = evidenceHash;
        _executeRelease(orderId, milestoneIndex);
    }

    function claimTimeoutRelease(uint256 orderId, uint256 milestoneIndex) external nonReentrant {
        Order storage o = orders[orderId];
        require(o.status == OrderStatus.Funded || o.status == OrderStatus.InTransit, "Cannot claim if disputed");
        require(block.timestamp >= o.lastEventTimestamp + o.autoApproveWindow, "Timeout window not reached");

        Milestone storage m = orderMilestones[orderId][milestoneIndex];
        require(!m.released, "Already released");

        _executeRelease(orderId, milestoneIndex);
    }

    function raiseDispute(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(msg.sender == o.buyer || msg.sender == o.supplier, "Unauthorized");
        require(o.status == OrderStatus.Funded || o.status == OrderStatus.InTransit, "Cannot dispute");

        o.status = OrderStatus.Disputed;
        emit OrderDisputed(orderId, msg.sender);
    }

    function resolveDispute(uint256 orderId, bool releaseToSupplier) external nonReentrant {
        require(registry.hasRole(registry.DISPUTE_RESOLVER_ROLE(), msg.sender), "Not a dispute resolver");
        Order storage o = orders[orderId];
        require(o.status == OrderStatus.Disputed, "Order not disputed");

        uint256 remainingBalance = o.totalAmount - o.releasedAmount;
        o.releasedAmount = o.totalAmount;

        if (releaseToSupplier) {
            o.status = OrderStatus.Completed;
            require(czarToken.transfer(o.supplier, remainingBalance), "Transfer failed");
        } else {
            o.status = OrderStatus.Cancelled;
            require(czarToken.transfer(o.buyer, remainingBalance), "Refund failed");
        }

        emit DisputeResolved(orderId, releaseToSupplier);
    }

    function _releaseMilestonesForStep(uint256 orderId, uint8 step) internal {
        Milestone[] storage milestones = orderMilestones[orderId];
        for (uint256 i = 0; i < milestones.length; i++) {
            if (!milestones[i].released && milestones[i].requiredStep == step) {
                _executeRelease(orderId, i);
            }
        }
    }

    function _executeRelease(uint256 orderId, uint256 milestoneIndex) internal {
        Order storage o = orders[orderId];
        Milestone storage m = orderMilestones[orderId][milestoneIndex];

        m.released = true;
        o.releasedAmount += m.amount;
        o.lastEventTimestamp = block.timestamp;

        require(czarToken.transfer(m.recipient, m.amount), "CZAR payout failed");
        emit MilestoneReleased(orderId, milestoneIndex, m.recipient, m.amount);

        if (o.releasedAmount == o.totalAmount) {
            o.status = OrderStatus.Completed;
        }
    }
}
