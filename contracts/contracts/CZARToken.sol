// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CZARToken
 * @notice South African Rand pegged stablecoin for the Patella procurement and escrow network on Celo L2.
 */
contract CZARToken is ERC20, Ownable {
    uint8 private constant DECIMALS = 18;

    constructor(uint256 initialSupply) ERC20("Crypto ZAR", "CZAR") Ownable(msg.sender) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /**
     * @notice Mint tokens to an address (restricted to owner or automated faucet)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

