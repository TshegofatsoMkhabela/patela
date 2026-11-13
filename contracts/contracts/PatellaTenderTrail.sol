// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PatellaRegistry.sol";

contract PatellaTenderTrail {
    PatellaRegistry public registry;

    enum TenderStatus { Draft, Open, Closed, Evaluating, Awarded, Converted, Cancelled }

    struct Tender {
        address buyer;
        TenderStatus status;
        uint256 deadline;
        bytes32 rfqHash;
        bytes32 rubricHash;
        address winningSupplier;
        bytes32 awardReasonHash;
        uint256 linkedOrderId;
    }

    struct Bid {
        address supplier;
        bytes32 encryptedBidHash;
        uint256 submittedAt;
        bool exists;
    }

    uint256 public tenderCounter;
    mapping(uint256 => Tender) public tenders;
    mapping(uint256 => mapping(address => Bid)) public tenderBids;
    mapping(uint256 => mapping(address => mapping(address => bytes32))) public evaluatorScores;

    event TenderPublished(uint256 indexed tenderId, address indexed buyer, bytes32 rfqHash, bytes32 rubricHash, uint256 deadline);
    event BidAnchored(uint256 indexed tenderId, address indexed supplier, bytes32 encryptedBidHash);
    event ScoreLogged(uint256 indexed tenderId, address indexed supplier, address indexed evaluator, bytes32 scoreHash);
    event TenderAwarded(uint256 indexed tenderId, address indexed winner, bytes32 reasonHash);
    event TenderConverted(uint256 indexed tenderId, uint256 indexed orderId);

    constructor(address _registry) {
        registry = PatellaRegistry(_registry);
    }

    function publishTender(bytes32 rfqHash, bytes32 rubricHash, uint256 deadline) external returns (uint256) {
        require(registry.isVerified(msg.sender), "Buyer not verified");
        require(deadline > block.timestamp, "Invalid deadline");

        uint256 tenderId = ++tenderCounter;
        tenders[tenderId] = Tender({
            buyer: msg.sender,
            status: TenderStatus.Open,
            deadline: deadline,
            rfqHash: rfqHash,
            rubricHash: rubricHash,
            winningSupplier: address(0),
            awardReasonHash: bytes32(0),
            linkedOrderId: 0
        });

        emit TenderPublished(tenderId, msg.sender, rfqHash, rubricHash, deadline);
        return tenderId;
    }

    function submitBid(uint256 tenderId, bytes32 encryptedBidHash) external {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Open, "Tender not open");
        require(block.timestamp < t.deadline, "Deadline passed");
        require(registry.isVerified(msg.sender), "Supplier not verified");

        tenderBids[tenderId][msg.sender] = Bid({
            supplier: msg.sender,
            encryptedBidHash: encryptedBidHash,
            submittedAt: block.timestamp,
            exists: true
        });

        emit BidAnchored(tenderId, msg.sender, encryptedBidHash);
    }

    function closeAndEvaluate(uint256 tenderId) external {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Open, "Invalid state");
        require(block.timestamp >= t.deadline, "Deadline not reached");
        t.status = TenderStatus.Evaluating;
    }

    function logEvaluationScore(uint256 tenderId, address supplier, bytes32 scoreHash) external {
        require(registry.hasRole(registry.EVALUATOR_ROLE(), msg.sender), "Not an evaluator");
        require(tenders[tenderId].status == TenderStatus.Evaluating, "Not in evaluating state");
        require(tenderBids[tenderId][supplier].exists, "Supplier did not bid");

        evaluatorScores[tenderId][supplier][msg.sender] = scoreHash;
        emit ScoreLogged(tenderId, supplier, msg.sender, scoreHash);
    }

    function awardTender(uint256 tenderId, address winner, bytes32 reasonHash) external {
        Tender storage t = tenders[tenderId];
        require(msg.sender == t.buyer, "Only buyer can award");
        require(t.status == TenderStatus.Evaluating, "Must be evaluating");
        require(tenderBids[tenderId][winner].exists, "Winner must have bid");

        t.winningSupplier = winner;
        t.awardReasonHash = reasonHash;
        t.status = TenderStatus.Awarded;

        emit TenderAwarded(tenderId, winner, reasonHash);
    }

    function markConverted(uint256 tenderId, uint256 orderId) external {
        Tender storage t = tenders[tenderId];
        require(msg.sender == t.buyer, "Only buyer");
        require(t.status == TenderStatus.Awarded, "Must be awarded first");
        t.status = TenderStatus.Converted;
        t.linkedOrderId = orderId;
        emit TenderConverted(tenderId, orderId);
    }
}

