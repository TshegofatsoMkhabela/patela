// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test Rand for the Celo Sepolia demo. Anyone can mint (a faucet); it is never real money.
contract CZAR is ERC20 {
    uint256 public constant MAX_MINT = 1_000_000 ether;

    error MintTooLarge();

    constructor() ERC20("Patella Test ZAR", "CZAR") {}

    function mint(address to, uint256 amount) external {
        if (amount > MAX_MINT) revert MintTooLarge();
        _mint(to, amount);
    }
}
