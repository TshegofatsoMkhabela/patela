import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The live demo path must never drop the presenter into a static /html mockup: those pages show
// hard-coded data and are not connected to the backend or the chain.
const read = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

const DEMO_PATH_FILES = [
  "app/signin/signin-view.tsx",
  "app/buyer/layout.tsx",
  "components/buyer/BuyerDashboard.tsx",
  "components/HeroBar.tsx",
];

describe("demo-path links", () => {
  it.each(DEMO_PATH_FILES)("%s links only to live pages, never /html mockups", (file) => {
    expect(read(file)).not.toMatch(/["'`]\/html\//);
  });

  it("sends a signed-in user to the live buyer dashboard by default", () => {
    expect(read("app/signin/signin-view.tsx")).toMatch(/nextPath\("\/buyer"\)/);
  });

  it("sends a new client account to the live buyer dashboard", () => {
    expect(read("app/signup/page.tsx")).toContain("BuyerOnboardingView");
    const onboarding = read("app/signup/buyer-onboarding-view.tsx");
    expect(onboarding).not.toMatch(/\/html\/client-dashboard\.html/);
    expect(onboarding).toMatch(/router\.push\("\/buyer"\)/);
  });

  it.each([
    "components/buyer/BuyerDashboard.tsx",
    "components/InfoPage.tsx",
    "components/PatelaSections.tsx",
    "components/SiteFooter.tsx",
  ])("%s sends 'create order' to the live /orders/new flow", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/\/html\/create-order\.html/);
    expect(source).toMatch(/["']\/orders\/new["']/);
  });

  it.each([
    "app/marketplace/marketplace-view.tsx",
    "components/PatelaSections.tsx",
    "components/SiteFooter.tsx",
    "components/SolutionsMenu.tsx",
    "app/post-job/post-job-view.tsx",
  ])("%s sends orders and the client dashboard to /buyer, not the mockups", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/\/html\/(orders|client-dashboard)\.html/);
    expect(source).toMatch(/["']\/buyer["']/);
  });

  it("wires the buyer sidebar to the redesigned pages", () => {
    const source = read("components/demo/DemoShell.tsx");

    expect(source).toContain('{ href: "/buyer", label: "Overview"');
    expect(source).toContain('{ href: "/orders/new", label: "Orders"');
    expect(source).toContain('href: "/html/shipment-overview.html"');
    expect(source).toContain('href: "/html/payments.html"');
    expect(source).toContain('href: "/html/documents-evidence.html"');
    expect(source).toContain('href: "/html/dispute-centre.html"');
  });
});
