# Project Rules

- Patela marketplace data (jobs, milestones, wallet) lives in a client-side demo store (src/lib/patela-store.ts, persisted to localStorage); the wallet fallback and AI review there are simulated and must stay labeled as demo until a real backend exists.
- The buyer escrow flow (src/app/orders/**, src/lib/chain.ts, src/components/BalancePanel.tsx) uses the real Mento ZARm token on Celo (default Celo Sepolia, chain 11142220). Those screens carry a "Real ZARm on Celo · <network>" label instead of a demo label; keep it visible, and never point it at Celo mainnet without the user's explicit approval.
