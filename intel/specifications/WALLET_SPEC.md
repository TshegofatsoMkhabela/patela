# Web3 Wallet Connection & Balance Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Partial / Buggy` (`src/lib/patela-store.ts` uses `11155111`; `html/wallet.html` is simulated)  
> **Target Milestone:** [MILESTONE_04_WALLET_AND_ESCROW.md](../milestones/MILESTONE_04_WALLET_AND_ESCROW.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State & Known Bug (`ISS-002`)

- **`src/lib/patela-store.ts`:** Contains `connectWallet()` which interacts with `window.ethereum` (`eth_requestAccounts`, `eth_chainId`, `wallet_switchEthereumChain`), but hardcodes **Ethereum Sepolia (`0xaa36a7` / `11155111`)** instead of **Base Sepolia (`0x14a34` / `84532`)**, and falls back to a simulated demo address (`0x71C...89A` with `25,000 USDC` fake balance) when no wallet is installed.
- **`html/wallet.html`:** Displays a role-aware wallet & escrow console with simulated `USDC`, `USDT`, and `ETH` balances, allocation donut charts, and transaction tables.

---

## 2. Target Network & Token Configuration

| Parameter | Target Value |
|---|---|
| **Network Name** | Base Sepolia Testnet |
| **Chain ID (Decimal / Hex)** | `84532` / `0x14a34` |
| **Native Currency** | Sepolia Ether (`ETH`, 18 decimals) |
| **Default Public RPC** | `https://sepolia.base.org` |
| **Block Explorer** | `https://sepolia.basescan.org` |
| **Supported Settlement Tokens** | `USDC` (6 decimals), `USDT` (6 decimals), `ETH` (18 decimals) |

---

## 3. Functional Requirements

### 3.1 Wallet Connection & Network Enforcement
- Implemented using `wagmi v2` + `viem v2` in the Next.js application.
- Supports injected EIP-1193 wallets (MetaMask, Coinbase Wallet, Rabby, Brave Wallet) and WalletConnect v2.
- **Wrong-Network Detection:** If `chainId !== 84532`, the UI displays a prominent **Switch to Base Sepolia (84532)** banner and disables all escrow deposit/release buttons until the user switches networks via `switchChain({ chainId: 84532 })` (falling back to `wallet_addEthereumChain` if Base Sepolia is not yet configured in the user's wallet).
- **No Silent Demo Fallback in Production/Testnet Mode:** If a wallet transaction is rejected by the user (`4001 User Rejected Request`) or fails on-chain, the UI surfaces the real error state and never fakes a successful deposit.

### 3.2 Real-Time On-Chain & Escrow Balance Summary
For the authenticated user's primary linked wallet, the Wallet view displays:
1. **Connected Wallet Balances (On-Chain):** Live `ETH`, `USDC`, and `USDT` balances read via `viem` (`getBalance` and ERC-20 `balanceOf`).
2. **Escrow Position Summary (Aggregated from `PatelaEscrow` + DB):**
   - **Client View:** `Total Locked in Escrow`, `Awaiting My Review`, `Total Released to Freelancers`, `In Dispute`.
   - **Worker View:** `Secured in Active Escrows`, `Pending Release (In Review)`, `Total Earned & Released`, `Available in Wallet`.

---

## 4. Acceptance Criteria

- [ ] Connecting a wallet on Ethereum Mainnet or Ethereum Sepolia (`11155111`) prompts an immediate switch to Base Sepolia (`84532`).
- [ ] `USDC` and `USDT` amounts are formatted using `formatUnits(value, 6)` and `ETH` using `formatUnits(value, 18)` with zero floating-point rounding errors.
- [ ] Disconnecting or switching accounts in MetaMask (`accountsChanged` event) immediately updates the UI and warns if the active wallet does not match the user's verified `UserWallet`.

