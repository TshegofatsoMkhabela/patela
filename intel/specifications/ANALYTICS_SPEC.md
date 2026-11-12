# Financial Analytics & Reporting Specification

> **Classification:** Feature Technical Specification  
> **Status:** `Prototype Only` (`html/analytics.html` and `html/assets/js/analytics.js` interactive SVG charts with mock data)  
> **Target Milestone:** [MILESTONE_07_ANALYTICS_AND_ADMIN.md](../milestones/MILESTONE_07_ANALYTICS_AND_ADMIN.md)  
> **Last Updated:** 2026-11-09  

---

## 1. Current Repository State

- **`src/` (Next.js App):** Displays 3 basic stat counters on `/marketplace` (`Total Locked`, `Released`, `Active Jobs`) computed from `patela-store.ts`.
- **`html/` (Dashboard Prototype):** `html/analytics.html` (`html/assets/js/analytics.js`) renders role-specific interactive SVG charts:
  - **Client View:** Monthly Capital Deployment & Escrow Release Trend, Escrow Allocation Donut (`Locked`, `Released`, `In Review`, `Disputed`), Spend by Category horizontal bars, and AI Verification Score vs. Turnaround scatter/bar metrics.
  - **Worker View:** Monthly Earnings & Pending Payout Velocity, Income by Token (`USDC`, `USDT`, `ETH`), Deliverable First-Pass Approval Rate, and Milestone Velocity metrics.

---

## 2. Target Analytics Architecture

All charts and KPI cards in the production Next.js dashboard must be powered by real SQL aggregations over `projects`, `milestones`, `escrow_deposits`, `blockchain_transactions`, and `ai_review_reports` (converted to USD-equivalent display values using token decimals while preserving exact token breakdowns).

### 2.1 Client Analytics Metrics (`GET /api/v1/analytics/client`)
1. **KPI Summary Cards:**
   - `totalEscrowLockedUsdEq`: Sum of confirmed deposits on active (`FUNDED`, `IN_PROGRESS`, `SUBMITTED_FOR_REVIEW`, `DISPUTED`) milestones.
   - `totalReleasedTimeframeUsdEq`: Sum of released milestone payouts within selected timeframe (`30d`, `90d`, `6m`, `1y`, `all`).
   - `awaitingApprovalUsdEq`: Value of milestones currently in `SUBMITTED_FOR_REVIEW`.
   - `avgAiConfidenceScore`: Mean `overallScore` across all submissions on the client's projects.
2. **Time-Series & Breakdown Series:**
   - `monthlySpendSeries[]`: `{ month, depositedAmount, releasedAmount, disputedAmount }`.
   - `categoryBreakdown[]`: `{ category, projectCount, totalCommittedAmount }`.
   - `tokenBreakdown[]`: `{ tokenSymbol: 'USDC' | 'USDT' | 'ETH', lockedBaseUnits, releasedBaseUnits }`.

### 2.2 Freelancer / Worker Analytics Metrics (`GET /api/v1/analytics/freelancer`)
1. **KPI Summary Cards:**
   - `totalEarnedNetUsdEq`: Net payouts released to the freelancer's wallet after platform fee.
   - `securedInEscrowUsdEq`: Active funded milestones assigned to the freelancer.
   - `pendingClientApprovalUsdEq`: Funded milestones in `SUBMITTED_FOR_REVIEW`.
   - `firstPassApprovalRate`: Percentage of milestones approved on `versionNumber === 1`.
   - `avgAiVerificationScore`: Mean AI verification score across the freelancer's submissions.
2. **Time-Series & Breakdown Series:**
   - `monthlyEarningsSeries[]`: `{ month, earnedAmount, pendingAmount }`.
   - `tokenEarningsBreakdown[]`: `{ tokenSymbol, netEarnedBaseUnits, activeLockedBaseUnits }`.

### 2.3 Platform Admin Analytics (`GET /api/v1/admin/analytics`)
- Total Value Locked (`TVL`) in `PatelaEscrow.sol` across Base Sepolia.
- Cumulative gross marketplace volume (`GMV`) and protocol fee revenue (`platformFeeBaseUnits`).
- Dispute rate (`disputedMilestones / totalFundedMilestones`) and median arbitration resolution time.

---

## 3. Acceptance Criteria

- [ ] Switching the timeframe selector (`30D`, `90D`, `6M`, `1Y`, `ALL`) dynamically re-queries the backend aggregation endpoint and updates all charts.
- [ ] Analytics numbers reconcile 100% with the user's transaction ledger (`blockchain_transactions`) and active milestone states.

