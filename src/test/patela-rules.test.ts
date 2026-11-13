import { describe, expect, it } from "vitest";
import { demoReview, validateJob, STABLECOINS, type JobDraft } from "@/lib/patela-store";

const good: JobDraft = {
  title: "Logo design",
  scope: "Design a logo for a crypto escrow startup.",
  deliverables: ["SVG logo"],
  milestones: [
    { title: "Concepts", amount: 200 },
    { title: "Final", amount: 300 },
  ],
  budget: 500,
  coins: ["USDC"],
};

const supplyChainOrder: JobDraft = {
  title: "Bulk Bauxite Richards Bay Corridor",
  scope: "Road transport of 12,000 MT bauxite from Johannesburg to Richards Bay Terminal.",
  deliverables: [
    "Weighbridge and dispatch certificates",
    "Driver two-party custody handoff signatures",
    "Richards Bay acceptance certificate",
  ],
  milestones: [
    { title: "Tranche 1: Origin Dispatch", amount: 97000 },
    { title: "Tranche 2: City Deep Cross-Dock", amount: 145500 },
    { title: "Tranche 3: Terminal Inbound Gate", amount: 145500 },
    { title: "Tranche 4: Final Discharge", amount: 97000 },
  ],
  budget: 485000,
  coins: ["ZARm"],
};

describe("job posting and supply chain rules", () => {
  it("accepts a complete job", () => expect(validateJob(good)).toEqual([]));
  it("accepts a ZARm-denominated multi-tranche supply chain order", () =>
    expect(validateJob(supplyChainOrder)).toEqual([]));
  it("includes ZARm in the supported stablecoin list", () => expect(STABLECOINS).toContain("ZARm"));
  it("enforces money conservation: sum of tranches must match total budget", () =>
    expect(validateJob({ ...supplyChainOrder, budget: 500000 }).join()).toMatch(/must match/));
  it("requires milestones to add up to the budget", () =>
    expect(validateJob({ ...good, budget: 600 }).join()).toMatch(/must match/));
  it("requires at least one stablecoin", () =>
    expect(validateJob({ ...good, coins: [] }).length).toBe(1));
  it("requires at least one deliverable", () =>
    expect(validateJob({ ...good, deliverables: [" "] }).length).toBe(1));
});

describe("demo AI review", () => {
  it("rejects a submission with no files or link", () =>
    expect(
      demoReview({ note: "Delivered everything as agreed", link: "", files: [], at: 0 }).ok,
    ).toBe(false));
  it("approves a submission with files and a clear note", () =>
    expect(
      demoReview({
        note: "Delivered everything as agreed",
        link: "",
        files: [{ name: "a.svg", size: 1 }],
        at: 0,
      }).ok,
    ).toBe(true));
});
