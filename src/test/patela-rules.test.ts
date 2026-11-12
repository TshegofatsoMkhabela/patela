import { describe, expect, it } from "vitest";
import { demoReview, validateJob, type JobDraft } from "@/lib/patela-store";

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

describe("job posting rules", () => {
  it("accepts a complete job", () => expect(validateJob(good)).toEqual([]));
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
