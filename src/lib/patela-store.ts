import { useEffect, useSyncExternalStore } from "react";
import { TARGET_CHAIN_HEX, TARGET_CHAIN_NAME, type Eth } from "@/lib/chain";

export const STABLECOINS = ["ZARm", "USDC", "USDT", "DAI", "PYUSD", "EURC"] as const;
export type Coin = (typeof STABLECOINS)[number];

export type MilestoneStatus = "pending" | "submitted" | "reviewing" | "approved" | "changes";

export interface Submission {
  note: string;
  link: string;
  files: { name: string; size: number }[];
  at: number;
}

export interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: MilestoneStatus;
  submission?: Submission;
  review?: string | undefined;
}

export interface Job {
  id: string;
  title: string;
  scope: string;
  deliverables: string[];
  milestones: Milestone[];
  budget: number;
  coins: Coin[];
  createdAt: number;
  funded: boolean;
  txHash?: string;
}

export interface JobDraft {
  title: string;
  scope: string;
  deliverables: string[];
  milestones: { title: string; amount: number }[];
  budget: number;
  coins: Coin[];
}

/** Rules for posting a job. Returns a list of human-readable problems (empty = valid). */
export function validateJob(d: JobDraft): string[] {
  const errs: string[] = [];
  if (d.title.trim().length < 4) errs.push("Give the job a title (at least 4 characters).");
  if (d.scope.trim().length < 20) errs.push("Describe the scope in at least 20 characters.");
  if (d.deliverables.filter((x) => x.trim()).length < 1) errs.push("Add at least one deliverable.");
  const ms = d.milestones.filter((m) => m.title.trim());
  if (ms.length < 1) errs.push("Add at least one milestone.");
  if (ms.some((m) => !(m.amount > 0))) errs.push("Every milestone needs an amount above 0.");
  if (!(d.budget > 0)) errs.push("Set a budget above 0.");
  const sum = Math.round(ms.reduce((s, m) => s + (m.amount || 0), 0) * 100) / 100;
  if (ms.length && d.budget > 0 && sum !== Math.round(d.budget * 100) / 100)
    errs.push(`Milestones add up to ${sum} but the budget is ${d.budget}. They must match.`);
  if (d.coins.length < 1) errs.push("Pick at least one accepted stablecoin.");
  return errs;
}

/** Demo AI review: work passes when it includes at least one file and a meaningful note. */
export function demoReview(s: Submission): { ok: boolean; text: string } {
  if (s.files.length === 0 && !s.link.trim())
    return {
      ok: false,
      text: "No files or link were attached, so there is nothing to verify against the deliverables.",
    };
  if (s.note.trim().length < 15)
    return {
      ok: false,
      text: "The submission note is too short to map work to the agreed deliverables. Please explain what was delivered.",
    };
  return {
    ok: true,
    text: "All listed deliverables were verified against the brief (Advisory AI Score: 96%). Ready for client approval & escrow release.",
  };
}

interface State {
  jobs: Job[];
  wallet: { address: string; chain: string; demo: boolean } | null;
}

const KEY = "patela-demo-v1";
const DASHBOARD_KEY = "patela_proto_state_v3";

function seed(): State {
  return {
    wallet: null,
    jobs: [
      {
        id: "ORD-2026-8941",
        title: "Bulk Industrial Bauxite Delivery (Johannesburg to Richards Bay Terminal)",
        scope:
          "Multi-hop road and terminal logistics for 12,000 MT metallurgical grade bauxite. Requires two-party custody handoffs at origin mine, City Deep cross-dock, and final Richards Bay terminal discharge.",
        deliverables: [
          "Consignment Bill of Lading & Weighbridge Slips",
          "Driver Two-Party Custody Handover Signatures",
          "Richards Bay Acceptance & Assayer Certificate",
        ],
        milestones: [
          {
            id: "tranche-1",
            title: "Tranche 1: Dispatch Advance & Gate Exit",
            amount: 97000,
            status: "approved",
            review:
              "Origin dispatch verified; driver and mine manager dual signatures recorded on-chain.",
          },
          {
            id: "tranche-2",
            title: "Tranche 2: City Deep Cross-Dock Inspection",
            amount: 145500,
            status: "approved",
            review:
              "Arrival and seal inspection verified at City Deep hub. Net weight 12,000 MT intact.",
          },
          {
            id: "tranche-3",
            title: "Tranche 3: Richards Bay Terminal Inbound Gate",
            amount: 145500,
            status: "pending",
          },
          {
            id: "tranche-4",
            title: "Tranche 4: Final Assayer Certificate & Discharge",
            amount: 97000,
            status: "pending",
          },
        ],
        budget: 485000,
        coins: ["ZARm"],
        createdAt: 1793000000000,
        funded: true,
        txHash: "0x3f9e4b7a1c8d2054",
      },
      {
        id: "landing-page-redesign",
        title: "Landing page redesign for a DeFi wallet",
        scope:
          "Redesign our marketing landing page in Figma and build it in React. Must be responsive and hit 90+ Lighthouse.",
        deliverables: [
          "Figma file with desktop + mobile",
          "React source code repo",
          "Lighthouse report",
        ],
        milestones: [
          {
            id: "m1",
            title: "Figma designs",
            amount: 800,
            status: "approved",
            review: "Desktop and mobile frames delivered as specified.",
          },
          { id: "m2", title: "React build", amount: 1200, status: "pending" },
        ],
        budget: 2000,
        coins: ["USDC", "USDT"],
        createdAt: 1793000000000,
        funded: true,
        txHash: "0x7a3f…c91e",
      },
      {
        id: "smart-contract-audit",
        title: "Audit an ERC-20 vesting contract",
        scope:
          "Security review of a 400-line Solidity vesting contract with a written report and suggested fixes.",
        deliverables: ["Audit report PDF", "Patched contract diff"],
        milestones: [{ id: "m1", title: "Full audit", amount: 3500, status: "pending" }],
        budget: 3500,
        coins: ["USDC", "DAI"],
        createdAt: 1793100000000,
        funded: false,
      },
      {
        id: "explainer-video",
        title: "60-second product explainer video",
        scope:
          "Animated explainer video showing how escrow on our platform works, with voiceover and captions.",
        deliverables: ["MP4 1080p", "Caption file (SRT)"],
        milestones: [
          { id: "m1", title: "Script & storyboard", amount: 300, status: "pending" },
          { id: "m2", title: "Final video", amount: 900, status: "pending" },
        ],
        budget: 1200,
        coins: ["USDC", "PYUSD", "EURC"],
        createdAt: 1793200000000,
        funded: false,
      },
    ],
  };
}

let state: State | null = null;
let hydrated = false;
const listeners = new Set<() => void>();
const serverState = seed();

function get(): State {
  if (!state) state = seed();
  return state;
}

/** Sync newly created/updated jobs into the Dashboard prototype store ('patela_proto_state_v3') */
function syncToDashboardStore(current: State) {
  try {
    const rawDash = localStorage.getItem(DASHBOARD_KEY);
    if (!rawDash) return;
    const dash = JSON.parse(rawDash);
    if (!dash || !Array.isArray(dash.marketplaceJobs)) return;

    current.jobs.forEach((j) => {
      const existsInMp = dash.marketplaceJobs.some(
        (mj: { id: string; title: string }) => mj.id === j.id || mj.title === j.title,
      );
      if (!existsInMp) {
        dash.marketplaceJobs.unshift({
          id: j.id.toUpperCase(),
          title: j.title,
          category: "UI/UX & Frontend",
          budget: j.budget,
          asset: j.coins[0] || "USDC",
          network: "Celo",
          duration: "2 weeks",
          experience: "Senior",
          clientName: "Alex Morgan",
          clientHandle: "@alex_morgan",
          clientVerified: true,
          clientTotalPaid: "$8,320 USDC",
          escrowStatus: j.funded
            ? `Escrow funded ($${j.budget.toLocaleString()} ${j.coins[0] || "USDC"})`
            : `Awaiting escrow ($${j.budget.toLocaleString()} ${j.coins[0] || "USDC"})`,
          proposals: 1,
          postedAt: "Just now",
          deadline: "10 Dec 2026",
          skills: ["React", "TypeScript", "Smart Escrow"],
          description: j.scope,
          deliverables: j.deliverables,
          milestones: j.milestones.map((m, idx) => ({
            name: `M${idx + 1}: ${m.title}`,
            amount: m.amount,
          })),
          applied: false,
        });
      }
    });

    if (current.wallet) {
      dash.walletConnected = true;
    }
    localStorage.setItem(DASHBOARD_KEY, JSON.stringify(dash));
  } catch {
    /* ignore storage errors */
  }
}

/** Pull any jobs published inside the HTML Dashboard wizard into Next.js marketplace */
function mergeFromDashboardStore(current: State): State {
  try {
    const rawDash = localStorage.getItem(DASHBOARD_KEY);
    if (!rawDash) return current;
    const dash = JSON.parse(rawDash);
    if (!dash || !Array.isArray(dash.marketplaceJobs)) return current;

    let changed = false;
    const nextJobs = [...current.jobs];

    dash.marketplaceJobs.forEach(
      (mj: {
        id: string;
        title: string;
        description?: string;
        deliverables?: string[];
        milestones?: { name: string; amount: number }[];
        budget?: number;
        asset?: string;
        escrowStatus?: string;
        postedAt?: string;
      }) => {
        const slugId = mj.id.toLowerCase();
        // Only import user-published or custom dashboard jobs not already in current.jobs
        const alreadyExists = nextJobs.some(
          (j) => j.id.toLowerCase() === slugId || j.title.toLowerCase() === mj.title.toLowerCase(),
        );
        if (!alreadyExists && mj.postedAt === "Just now") {
          changed = true;
          nextJobs.unshift({
            id: slugId,
            title: mj.title,
            scope: mj.description || "Escrow-backed milestone engagement.",
            deliverables: Array.isArray(mj.deliverables)
              ? mj.deliverables
              : ["Verified deliverable"],
            milestones: Array.isArray(mj.milestones)
              ? mj.milestones.map((m, idx) => ({
                  id: `m${idx + 1}`,
                  title: m.name.replace(/^M\d+:\s*/i, ""),
                  amount: Number(m.amount) || 0,
                  status: "pending" as const,
                }))
              : [
                  {
                    id: "m1",
                    title: "Milestone 1",
                    amount: Number(mj.budget) || 500,
                    status: "pending" as const,
                  },
                ],
            budget: Number(mj.budget) || 500,
            coins: [(mj.asset === "USDT" ? "USDT" : "USDC") as Coin],
            createdAt: Date.now(),
            funded: Boolean(mj.escrowStatus && mj.escrowStatus.toLowerCase().includes("funded")),
            txHash: "0x8a41…10b8",
          });
        }
      },
    );

    if (changed) {
      const merged = { ...current, jobs: nextJobs };
      localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {
    /* ignore */
  }
  return current;
}

function set(fn: (s: State) => State) {
  state = fn(get());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    syncToDashboardStore(state);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as State;
    } else {
      state = seed();
    }
    state = mergeFromDashboardStore(state);
    listeners.forEach((l) => l());
  } catch {
    /* ignore */
  }
}

export function usePatela() {
  useEffect(hydrate, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
    () => serverState,
  );
}

const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "job";

export const fakeHash = () =>
  "0x" +
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("") +
  "…" +
  Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

export const actions = {
  createJob(d: JobDraft): string {
    const id = `${slug(d.title)}-${Date.now().toString(36)}`;
    set((s) => ({
      ...s,
      jobs: [
        {
          id,
          title: d.title.trim(),
          scope: d.scope.trim(),
          deliverables: d.deliverables.map((x) => x.trim()).filter(Boolean),
          milestones: d.milestones
            .filter((m) => m.title.trim())
            .map((m, i) => ({
              id: `m${i + 1}`,
              title: m.title.trim(),
              amount: m.amount,
              status: "pending" as const,
            })),
          budget: d.budget,
          coins: d.coins,
          createdAt: Date.now(),
          funded: false,
        },
        ...s.jobs,
      ],
    }));
    return id;
  },
  fund(jobId: string) {
    set((s) => ({
      ...s,
      jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, funded: true, txHash: fakeHash() } : j)),
    }));
  },
  updateMilestone(jobId: string, mId: string, patch: Partial<Milestone>) {
    set((s) => ({
      ...s,
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? { ...j, milestones: j.milestones.map((m) => (m.id === mId ? { ...m, ...patch } : m)) }
          : j,
      ),
    }));
  },
  submit(jobId: string, mId: string, sub: Submission) {
    actions.updateMilestone(jobId, mId, {
      status: "reviewing",
      submission: sub,
      review: undefined,
    });
    setTimeout(() => {
      const r = demoReview(sub);
      // Advisory AI Review: passing sets status to "submitted" (awaiting client approval), not auto-released
      actions.updateMilestone(jobId, mId, {
        status: r.ok ? "submitted" : "changes",
        review: r.text,
      });
    }, 2200);
  },
  approveMilestone(jobId: string, mId: string) {
    actions.updateMilestone(jobId, mId, {
      status: "approved",
    });
  },
  requestChanges(jobId: string, mId: string, reason?: string) {
    actions.updateMilestone(jobId, mId, {
      status: "changes",
      review: reason || "Client requested revisions on this milestone deliverable.",
    });
  },
  setWallet(w: State["wallet"]) {
    set((s) => ({ ...s, wallet: w }));
  },
};

/* ---------- Celo wallet ---------- */

export const browserEthereum = () =>
  typeof window === "undefined" ? undefined : (window as { ethereum?: Eth }).ethereum;

/**
 * The wallet as it is at the moment of each call. Extensions can inject window.ethereum after the
 * page renders, so callers that keep an Eth around should hold this rather than a captured provider.
 */
export const liveEthereum: Eth = {
  request(args) {
    const provider = browserEthereum();
    if (!provider) return Promise.reject(new Error("Install MetaMask to sign this step."));
    return provider.request(args);
  },
};

type Wallet = NonNullable<State["wallet"]>;

export async function connectWallet(): Promise<{
  ok: boolean;
  message: string;
  wallet?: Wallet;
}> {
  const eth = browserEthereum();
  if (!eth) {
    const addr =
      "0x71C4" +
      Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    const wallet = { address: addr, chain: `${TARGET_CHAIN_NAME} (demo)`, demo: true };
    actions.setWallet(wallet);
    return {
      ok: true,
      message: `Connected simulated wallet on ${TARGET_CHAIN_NAME} (Demo).`,
      wallet,
    };
  }
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
      });
    } catch {
      /* user may decline; still connected */
    }
    const chainId = (await eth.request({ method: "eth_chainId" })) as string;
    const onTargetChain = chainId.toLowerCase() === TARGET_CHAIN_HEX;
    const wallet = {
      address: accounts[0] ?? "",
      chain: onTargetChain ? TARGET_CHAIN_NAME : `Chain ${parseInt(chainId, 16)}`,
      demo: false,
    };
    actions.setWallet(wallet);
    return {
      ok: true,
      message: onTargetChain
        ? `Wallet connected to ${TARGET_CHAIN_NAME}.`
        : `Wallet connected on ${wallet.chain}. Switch to ${TARGET_CHAIN_NAME} to use ZARm escrow.`,
      wallet,
    };
  } catch {
    return { ok: false, message: "Wallet connection was cancelled." };
  }
}

export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
