import { describe, expect, it } from "vitest";
import { parseEnvFile, planDemo } from "./demo.mjs";

describe("npm run demo: env file", () => {
  it("Given KEY=value lines with comments, blanks and quotes, Then it reads the values", () => {
    const env = parseEnvFile('# maps\nNEXT_PUBLIC_GOOGLE_MAPS_API_KEY="abc"\n\nEMPTY=\nX = y \r\n');
    expect(env).toEqual({ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "abc", EMPTY: "", X: "y" });
  });
});

describe("npm run demo: plan", () => {
  it("Given no keys, Then it runs the local chain on ports 3001/4000 with Docker Postgres if running", () => {
    expect(planDemo({}, { dockerRunning: true })).toEqual({
      webPort: 3001,
      apiPort: 4000,
      chainId: 31337,
      local: true,
      database: "docker",
    });
  });

  it("Given Docker is not running, Then it falls back to PGlite", () => {
    expect(planDemo({}, { dockerRunning: false }).database).toBe("pglite");
  });

  it("Given DATABASE_URL, Then that database is used", () => {
    expect(planDemo({ DATABASE_URL: "postgres://x" }, { dockerRunning: true }).database).toBe(
      "external",
    );
  });

  it("Given Base Sepolia with RPC and addresses, Then no local chain is started", () => {
    const plan = planDemo(
      {
        NEXT_PUBLIC_CHAIN_ID: "84532",
        NEXT_PUBLIC_RPC_URL: "https://sepolia.base.org",
        NEXT_PUBLIC_ESCROW_ADDRESS: "0x1",
        NEXT_PUBLIC_ZARP_ADDRESS: "0x2",
      },
      { dockerRunning: false },
    );
    expect(plan).toMatchObject({ chainId: 84532, local: false });
  });

  it("Given Base Sepolia without contract addresses, Then it says which keys are missing", () => {
    expect(() => planDemo({ NEXT_PUBLIC_CHAIN_ID: "84532" }, { dockerRunning: false })).toThrow(
      /NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_ESCROW_ADDRESS, NEXT_PUBLIC_ZARP_ADDRESS/,
    );
  });

  it("Given DEMO_WEB_PORT, Then the web app uses that port", () => {
    expect(planDemo({ DEMO_WEB_PORT: "3101" }, { dockerRunning: false }).webPort).toBe(3101);
  });
});
