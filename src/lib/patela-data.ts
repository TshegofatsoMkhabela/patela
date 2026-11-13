export const steps = [
  {
    t: "Agree order & custody route",
    p: "Buyer and supplier agree commercial terms, split consignments, and configure a multi-hop custody route with any number of stops.",
  },
  {
    t: "Fund rand escrow",
    p: "Buyer approves the exact Mento ZARm amount and EscrowVault locks it in smart-contract escrow on Celo.",
  },
  {
    t: "Confirm two-party handoffs",
    p: "Carriers, drivers and warehouse teams confirm handoffs via short-lived mobile links with zero app or crypto wallet required.",
  },
  {
    t: "Rule-triggered payout release",
    p: "Declarative payment rules evaluate verified events to release payment tranches. Isolated dispute holding protects unaffected funds.",
  },
];

export const features = [
  {
    d: "M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4z",
    t: "EscrowVault smart contracts",
    p: "Funds are locked in a smart-contract vault on Celo. Release logic is governed by rules, not arbitrary custodian discretion.",
  },
  {
    d: "M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z",
    t: "Route-agnostic multi-hop",
    p: "From direct supplier-to-buyer deliveries to 20-stop road, rail, and bonded warehouse corridors with branching parcels.",
  },
  {
    d: "M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    t: "Rand in, rand out",
    p: "Users see and transact in South African Rand using Mento ZARm on Celo.",
  },
  {
    d: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
    t: "Guest-first mobile handoffs",
    p: "Drivers and warehouse staff sign two-party custody handoffs from a one-time link with no app installation and no wallet.",
  },
  {
    d: "M4 6h16M4 12h16M4 18h10",
    t: "Conservation of money",
    p: "Every tranche sums exactly to the escrowed total. Enforced in the API, the internal double-entry ledger, and the smart contract.",
  },
  {
    d: "M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
    t: "Isolated dispute protection",
    p: "A damaged or short parcel holds only its affected tranche. Unaffected parcels and tranches continue moving and paying without delay.",
  },
];

export const faqs = [
  {
    q: "What problem does Patella solve?",
    a: "Patella is a business-to-business order, custody and payment coordination platform. It makes complex supply-chain transactions understandable and accountable: agree the order, define who handles the goods and when money may move, record verified handoffs, and resolve exceptions with an auditable trail.",
  },
  {
    q: "Does Patella own vehicles or guarantee delivery?",
    a: "No. Patella records and pays, but does not own trucks or operate warehouses. A cryptographic scan proves that two designated parties confirmed a physical handoff; it is not an independent quality inspection of goods and does not prevent hijacking.",
  },
  {
    q: "Do drivers and warehouse workers need crypto wallets or an app?",
    a: "No. Partners participate as guests through short-lived, single-use one-time links from any smartphone browser. Two distinct signatures are recorded without exposing order values or full route data.",
  },
  {
    q: "How does payment work with South African Rand?",
    a: "Orders are denominated in rand and funded with Mento ZARm. The buyer approves the exact amount before the EscrowVault locks it on Celo.",
  },
  {
    q: "What happens if a parcel is damaged or short?",
    a: "Patella enforces isolated parcel holding. Only the affected tranche is held in dispute, while unaffected consignments progress under the signed plan and release on schedule.",
  },
  {
    q: "Who authorises payment releases from the EscrowVault?",
    a: "The smart contract never trusts a plain API call. Releases occur only when the rule engine verifies matching custody events and the Release Authority signs the instruction with KMS/HSM audit logging.",
  },
];
