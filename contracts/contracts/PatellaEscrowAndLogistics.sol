// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "./PatellaRegistry.sol";

/// Escrow for one delivery: the buyer locks Mento ZARm, and each handoff signed by
/// both the giver and the receiver releases that stage's payments.
/// Stage 1 (pickup): supplier -> driver. Stage 2 (delivery): driver -> buyer.
/// Who must sign each stage is derived from the order, never from the caller.
contract PatellaEscrowAndLogistics is ReentrancyGuard, Pausable, Ownable, EIP712 {
    using SafeERC20 for IERC20;

    uint8 public constant PICKUP = 1;
    uint8 public constant DELIVERY = 2;

    bytes32 private constant HANDOFF_TYPEHASH = keccak256(
        "Handoff(uint256 orderId,uint8 stage,address giver,address receiver,bytes32 nonce,uint256 expiresAt,bytes32 evidenceHash)"
    );

    enum OrderStatus { Created, Funded, InTransit, Disputed, Completed, Cancelled }

    struct Order {
        address buyer;
        address supplier;
        address driver;
        uint256 total;
        uint256 driverAtPickup;
        uint256 supplierAtPickup;
        uint256 supplierAtDelivery;
        uint256 released;
        uint64 refundDeadline;
        uint8 stagesDone;
        bool accepted;
        bytes32 agreementHash;
        OrderStatus status;
    }

    IERC20 public immutable paymentToken;
    PatellaRegistry public immutable registry;
    uint256 public maxOrderAmount;

    uint256 public orderCounter;
    mapping(uint256 => Order) public orders;
    /// One-time QR codes: a nonce can release a handoff once, ever.
    mapping(bytes32 => bool) public usedNonces;

    event OrderCreated(
        uint256 indexed orderId, address indexed buyer, address indexed supplier, uint256 total, bytes32 agreementHash
    );
    event EscrowFunded(uint256 indexed orderId, uint256 amount);
    event OrderAccepted(uint256 indexed orderId, address indexed supplier, bytes32 agreementHash);
    event DriverAssigned(uint256 indexed orderId, address indexed driver);
    event HandoffVerified(
        uint256 indexed orderId, uint8 stage, address indexed giver, address indexed receiver, bytes32 evidenceHash
    );
    event PaymentReleased(uint256 indexed orderId, uint8 stage, address indexed recipient, uint256 amount);
    event OrderDisputed(uint256 indexed orderId, address indexed raisedBy);
    event DisputeResolved(uint256 indexed orderId, bool releasedToSupplier);
    event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event MaxOrderAmountChanged(uint256 amount);

    error SplitMismatch();
    error NotBuyer();
    error NotSupplier();
    error NotAccepted();
    error AgreementMismatch();
    error InvalidAddress();
    error InvalidAmount();
    error OrderTooLarge();
    error DriverAlreadyAssigned();
    error InvalidState();
    error InvalidSignature();
    error HandoffExpired();
    error NonceUsed();
    error StageOutOfOrder();
    error OrderInDispute();
    error OrderNotFunded();
    error DriverNotAssigned();
    error RefundTooEarly();

    constructor(address _paymentToken, address _registry, uint256 _maxOrderAmount)
        Ownable(msg.sender)
        EIP712("Patela Escrow", "1")
    {
        if (_paymentToken == address(0) || _registry == address(0)) revert InvalidAddress();
        if (_maxOrderAmount == 0) revert InvalidAmount();
        paymentToken = IERC20(_paymentToken);
        registry = PatellaRegistry(_registry);
        maxOrderAmount = _maxOrderAmount;
    }

    function setPaused(bool value) external onlyOwner {
        if (value) _pause();
        else _unpause();
    }

    function setMaxOrderAmount(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        maxOrderAmount = amount;
        emit MaxOrderAmountChanged(amount);
    }

    function createOrder(
        address supplier,
        uint256 total,
        uint256 driverAtPickup,
        uint256 supplierAtPickup,
        uint256 supplierAtDelivery,
        uint64 refundDeadline,
        bytes32 agreementHash
    ) external whenNotPaused returns (uint256 orderId) {
        if (supplier == address(0)) revert InvalidAddress();
        if (total == 0 || agreementHash == bytes32(0)) revert InvalidAmount();
        if (total > maxOrderAmount) revert OrderTooLarge();
        if (refundDeadline <= block.timestamp) revert InvalidAmount();
        if (driverAtPickup + supplierAtPickup + supplierAtDelivery != total) revert SplitMismatch();

        orderId = ++orderCounter;
        Order storage o = orders[orderId];
        o.buyer = msg.sender;
        o.supplier = supplier;
        o.total = total;
        o.driverAtPickup = driverAtPickup;
        o.supplierAtPickup = supplierAtPickup;
        o.supplierAtDelivery = supplierAtDelivery;
        o.refundDeadline = refundDeadline;
        o.agreementHash = agreementHash;
        o.status = OrderStatus.Created;

        emit OrderCreated(orderId, msg.sender, supplier, total, agreementHash);
    }

    function fundEscrow(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage o = orders[orderId];
        if (msg.sender != o.buyer) revert NotBuyer();
        if (o.status != OrderStatus.Created) revert InvalidState();

        o.status = OrderStatus.Funded;
        paymentToken.safeTransferFrom(msg.sender, address(this), o.total);
        emit EscrowFunded(orderId, o.total);
    }

    function acceptOrder(uint256 orderId, bytes32 agreementHash) external whenNotPaused {
        Order storage o = orders[orderId];
        if (msg.sender != o.supplier) revert NotSupplier();
        if (o.status != OrderStatus.Funded || o.accepted) revert InvalidState();
        if (agreementHash != o.agreementHash) revert AgreementMismatch();

        o.accepted = true;
        emit OrderAccepted(orderId, msg.sender, agreementHash);
    }

    function assignDriver(uint256 orderId, address driver) external whenNotPaused {
        Order storage o = orders[orderId];
        if (msg.sender != o.supplier) revert NotSupplier();
        if (o.status != OrderStatus.Funded) revert OrderNotFunded();
        if (!o.accepted) revert NotAccepted();
        if (driver == address(0)) revert InvalidAddress();
        if (o.driver != address(0)) revert DriverAlreadyAssigned();

        o.driver = driver;
        emit DriverAssigned(orderId, driver);
    }

    function driverOf(uint256 orderId) external view returns (address) {
        return orders[orderId].driver;
    }

    function releaseHandoff(
        uint256 orderId,
        uint8 stage,
        bytes32 nonce,
        uint256 expiresAt,
        bytes32 evidenceHash,
        bytes calldata giverSig,
        bytes calldata receiverSig
    ) external nonReentrant whenNotPaused {
        Order storage o = orders[orderId];
        if (o.status == OrderStatus.Disputed) revert OrderInDispute();
        if (o.status != OrderStatus.Funded && o.status != OrderStatus.InTransit) revert InvalidState();
        if (block.timestamp > expiresAt) revert HandoffExpired();
        if (nonce == bytes32(0) || evidenceHash == bytes32(0)) revert InvalidAmount();
        if (usedNonces[nonce]) revert NonceUsed();
        if (stage != o.stagesDone + 1) revert StageOutOfOrder();
        if (o.driver == address(0)) revert DriverNotAssigned();

        (address giver, address receiver) = _partiesFor(o, stage);
        bytes32 digest = _handoffDigest(orderId, stage, giver, receiver, nonce, expiresAt, evidenceHash);
        if (
            !SignatureChecker.isValidSignatureNow(giver, digest, giverSig)
                || !SignatureChecker.isValidSignatureNow(receiver, digest, receiverSig)
        ) revert InvalidSignature();

        usedNonces[nonce] = true;
        o.stagesDone = stage;
        emit HandoffVerified(orderId, stage, giver, receiver, evidenceHash);

        if (stage == PICKUP) {
            o.status = OrderStatus.InTransit;
            _pay(o, orderId, stage, o.driver, o.driverAtPickup);
            _pay(o, orderId, stage, o.supplier, o.supplierAtPickup);
        } else {
            o.status = OrderStatus.Completed;
            _pay(o, orderId, stage, o.supplier, o.supplierAtDelivery);
        }
    }

    function _handoffDigest(
        uint256 orderId,
        uint8 stage,
        address giver,
        address receiver,
        bytes32 nonce,
        uint256 expiresAt,
        bytes32 evidenceHash
    ) private view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(HANDOFF_TYPEHASH, orderId, stage, giver, receiver, nonce, expiresAt, evidenceHash))
        );
    }

    /// If the goods never arrive: after the deadline, the buyer (and only the
    /// buyer) takes back everything that hasn't been paid out.
    function refund(uint256 orderId) external nonReentrant {
        Order storage o = orders[orderId];
        if (msg.sender != o.buyer) revert NotBuyer();
        if (block.timestamp < o.refundDeadline) revert RefundTooEarly();
        if (o.status != OrderStatus.Funded && o.status != OrderStatus.InTransit) revert InvalidState();

        uint256 remaining = o.total - o.released;
        o.released = o.total;
        o.status = OrderStatus.Cancelled;
        paymentToken.safeTransfer(o.buyer, remaining);
        emit OrderRefunded(orderId, o.buyer, remaining);
    }

    function raiseDispute(uint256 orderId) external {
        Order storage o = orders[orderId];
        if (msg.sender != o.buyer && msg.sender != o.supplier) revert InvalidState();
        if (o.status != OrderStatus.Funded && o.status != OrderStatus.InTransit) revert InvalidState();

        o.status = OrderStatus.Disputed;
        emit OrderDisputed(orderId, msg.sender);
    }

    function resolveDispute(uint256 orderId, bool releaseToSupplier) external nonReentrant {
        require(registry.hasRole(registry.DISPUTE_RESOLVER_ROLE(), msg.sender), "Not a dispute resolver");
        Order storage o = orders[orderId];
        if (o.status != OrderStatus.Disputed) revert InvalidState();

        uint256 remaining = o.total - o.released;
        o.released = o.total;
        if (releaseToSupplier) {
            o.status = OrderStatus.Completed;
            paymentToken.safeTransfer(o.supplier, remaining);
        } else {
            o.status = OrderStatus.Cancelled;
            paymentToken.safeTransfer(o.buyer, remaining);
        }
        emit DisputeResolved(orderId, releaseToSupplier);
    }

    function _partiesFor(Order storage o, uint8 stage) private view returns (address giver, address receiver) {
        if (stage == PICKUP) return (o.supplier, o.driver);
        if (stage == DELIVERY) return (o.driver, o.buyer);
        revert InvalidState();
    }

    function _pay(Order storage o, uint256 orderId, uint8 stage, address to, uint256 amount) private {
        if (amount == 0) return;
        o.released += amount;
        paymentToken.safeTransfer(to, amount);
        emit PaymentReleased(orderId, stage, to, amount);
    }
}
