// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract PatellaRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");
    bytes32 public constant EVALUATOR_ROLE = keccak256("EVALUATOR_ROLE");

    struct Business {
        bool isRegistered;
        bool isVerified;
        string roleType; // "BUYER", "SUPPLIER", "LOGISTICS"
    }

    mapping(address => Business) public businesses;

    event BusinessRegistered(address indexed account, string roleType);
    event BusinessVerified(address indexed account, bool status);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISPUTE_RESOLVER_ROLE, msg.sender);
    }

    function registerBusiness(address account, string calldata roleType) external onlyRole(ADMIN_ROLE) {
        businesses[account] = Business({
            isRegistered: true,
            isVerified: false,
            roleType: roleType
        });
        emit BusinessRegistered(account, roleType);
    }

    function setVerifiedStatus(address account, bool status) external onlyRole(ADMIN_ROLE) {
        require(businesses[account].isRegistered, "Business not registered");
        businesses[account].isVerified = status;
        emit BusinessVerified(account, status);
    }

    function isVerified(address account) external view returns (bool) {
        return businesses[account].isVerified;
    }
}

