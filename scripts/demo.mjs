#!/usr/bin/env node
// One-command local demo: Postgres (Docker, or in-process PGlite when Docker isn't running),
// a Hardhat node with MockZARP + registry + escrow, the backend in DEMO_MODE and the web app.
// Usage: npm run demo   (stop with npm run demo:stop)
// Optional keys go in .env.demo (copy .env.demo.example); nothing else needs an account.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = path.join(ROOT, ".demo");
const LOG_DIR = path.join(STATE_DIR, "logs");
const PIDS_FILE = path.join(STATE_DIR, "pids.json");
const CONTRACTS = path.join(ROOT, "contracts");
const BACKEND = path.join(ROOT, "backend");
const PG_CONTAINER = "patela-demo-postgres";

/** KEY=value lines; # comments; surrounding quotes stripped. Real env vars win. */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/**
 * Decides what runs from the optional keys. Local chain unless NEXT_PUBLIC_CHAIN_ID is a testnet
 * with its RPC and contract addresses given; Docker Postgres unless DATABASE_URL is set or Docker
 * isn't running (then PGlite).
 */
export function planDemo(env, { dockerRunning }) {
  const webPort = Number(env.DEMO_WEB_PORT || 3001);
  const apiPort = Number(env.DEMO_API_PORT || 4000);
  const chainId = Number(env.NEXT_PUBLIC_CHAIN_ID || 31337);
  const local = chainId === 31337;
  if (!local) {
    const missing = ["NEXT_PUBLIC_RPC_URL", "NEXT_PUBLIC_ESCROW_ADDRESS", "NEXT_PUBLIC_ZARP_ADDRESS"]
      .filter((k) => !env[k]);
    if (missing.length) throw new Error(`Chain ${chainId} needs ${missing.join(", ")} in .env.demo`);
  }
  const database = env.DATABASE_URL ? "external" : dockerRunning ? "docker" : "pglite";
  return { webPort, apiPort, chainId, local, database };
}

function log(msg) {
  process.stdout.write(`[demo] ${msg}\n`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

async function waitFor(label, check, timeoutMs = 180_000) {
  const start = Date.now();
  for (;;) {
    try {
      if (await check()) return;
    } catch {
      /* not ready yet */
    }
    if (Date.now() - start > timeoutMs) throw new Error(`${label} did not become ready in ${timeoutMs / 1000}s`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const rpc = (url, method) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
  }).then((r) => r.json());

function run(cmd, args, opts) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} ${args.join(" ")} failed (${result.status})`);
}

/** Starts a long-running service detached, logging to .demo/logs/<name>.log. */
function startService(name, args, cwd, env, pids) {
  const logFile = path.join(LOG_DIR, `${name}.log`);
  const fd = openSync(logFile, "w");
  const child = spawn(process.execPath, args, {
    cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", fd, fd], windowsHide: true,
  });
  child.unref();
  pids[name] = child.pid;
  writeFileSync(PIDS_FILE, JSON.stringify(pids, null, 2));
  log(`${name} started (pid ${child.pid}, log ${path.relative(ROOT, logFile)})`);
  return child;
}

function requireInstalled(dir, bin) {
  const p = path.join(dir, "node_modules", ...bin.split("/"));
  if (!existsSync(p)) {
    throw new Error(`${path.relative(ROOT, dir) || "."}: dependencies missing. Run "npm run demo:install" first.`);
  }
  return p;
}

async function main() {
  const fileEnv = existsSync(path.join(ROOT, ".env.demo"))
    ? parseEnvFile(readFileSync(path.join(ROOT, ".env.demo"), "utf8")) : {};
  const env = { ...fileEnv, ...process.env };
  if (existsSync(PIDS_FILE)) throw new Error('A demo is already running (or was not stopped). Run "npm run demo:stop".');

  const hardhatCli = requireInstalled(CONTRACTS, "hardhat/dist/src/cli.js");
  const nextCli = requireInstalled(ROOT, "next/dist/bin/next");
  requireInstalled(BACKEND, "tsx/package.json");

  const dockerRunning = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
  const plan = planDemo(env, { dockerRunning });
  const webOrigin = `http://localhost:${plan.webPort}`;
  const apiOrigin = `http://localhost:${plan.apiPort}`;

  const ports = [plan.webPort, plan.apiPort, ...(plan.local ? [8545] : [])];
  for (const port of ports) {
    if (!(await portFree(port))) {
      throw new Error(`Port ${port} is already in use. Stop whatever is on it` +
        (port === plan.webPort ? " or set DEMO_WEB_PORT" : port === plan.apiPort ? " or set DEMO_API_PORT" : "") + ".");
    }
  }

  mkdirSync(LOG_DIR, { recursive: true });
  const pids = {};
  writeFileSync(PIDS_FILE, JSON.stringify(pids));

  // 1. Database
  let databaseUrl = env.DATABASE_URL;
  if (plan.database === "docker") {
    log("Postgres: starting a fresh Docker container (postgres:16-alpine on port 54329)");
    spawnSync("docker", ["rm", "-f", PG_CONTAINER], { stdio: "ignore" });
    run("docker", ["run", "-d", "--name", PG_CONTAINER, "-e", "POSTGRES_PASSWORD=patela", "-p", "54329:5432",
      "postgres:16-alpine"]);
    pids.dockerContainer = PG_CONTAINER;
    writeFileSync(PIDS_FILE, JSON.stringify(pids, null, 2));
    await waitFor("Postgres", () =>
      spawnSync("docker", ["exec", PG_CONTAINER, "pg_isready", "-U", "postgres"], { stdio: "ignore" }).status === 0);
    databaseUrl = "postgres://postgres:patela@localhost:54329/postgres";
  } else if (plan.database === "pglite") {
    const dir = path.join(STATE_DIR, "pgdata");
    if (env.DEMO_KEEP_DATA !== "true") rmSync(dir, { recursive: true, force: true });
    log("Postgres: Docker isn't running, using in-process PGlite (.demo/pgdata)");
    databaseUrl = `pglite:${dir}`;
  } else {
    log("Postgres: using DATABASE_URL from the environment");
  }

  // 2. Chain
  let chain;
  if (plan.local) {
    startService("hardhat", [hardhatCli, "node"], CONTRACTS, {}, pids);
    await waitFor("Hardhat node", async () => (await rpc("http://127.0.0.1:8545", "eth_chainId")).result === "0x7a69", 90_000);
    log("Deploying MockZARP, registry and escrow to the local chain");
    run(process.execPath, [hardhatCli, "run", "scripts/deploy.ts", "--network", "localhost"], { cwd: CONTRACTS });
    const deployment = JSON.parse(readFileSync(path.join(CONTRACTS, "deployments", "localhost.json"), "utf8"));
    chain = {
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
      escrow: deployment.contracts.PatellaEscrowAndLogistics.address,
      token: deployment.contracts.MockZARP.address,
    };
  } else {
    chain = { chainId: plan.chainId, rpcUrl: env.NEXT_PUBLIC_RPC_URL,
      escrow: env.NEXT_PUBLIC_ESCROW_ADDRESS, token: env.NEXT_PUBLIC_ZARP_ADDRESS };
    log(`Chain: ${plan.chainId} via ${chain.rpcUrl} (no local node)`);
  }

  // 3. Backend
  const backendEnv = {
    PORT: String(plan.apiPort),
    DATABASE_URL: databaseUrl,
    DEMO_MODE: "true",
    CHAIN_ID: String(chain.chainId),
    BASE_RPC_URL: env.BASE_RPC_URL || chain.rpcUrl,
    ESCROW_ADDRESS: chain.escrow,
    TOKEN_ADDRESS: chain.token,
    TOKEN_DECIMALS: "18",
    CHAIN_CONFIRMATIONS: env.CHAIN_CONFIRMATIONS || (plan.local ? "1" : "2"),
    PUBLIC_ORIGIN: webOrigin,
    API_ORIGIN: apiOrigin,
    ALLOWED_ORIGINS: `http://127.0.0.1:${plan.webPort}`,
  };
  for (const key of ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_MAPS_SERVER_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS", "SMTP_SECRET_ARN", "AWS_REGION", "AWS_PROFILE"]) {
    if (env[key]) backendEnv[key] = env[key];
  }
  if (plan.database !== "pglite") {
    log("Running database migrations");
    run(process.execPath, ["--import", "tsx", "src/migrate.ts"], { cwd: BACKEND, env: { ...process.env, ...backendEnv } });
  }
  startService("backend", ["--import", "tsx", "src/server.ts"], BACKEND, backendEnv, pids);
  await waitFor("Backend", async () => (await fetch(`${apiOrigin}/health`)).ok, 120_000);

  // 4. Web app (NEXT_PUBLIC_* are inlined when the dev server starts, so they are set here)
  const webEnv = {
    NEXT_PUBLIC_CHAIN_ID: String(chain.chainId),
    NEXT_PUBLIC_RPC_URL: chain.rpcUrl,
    NEXT_PUBLIC_ESCROW_ADDRESS: chain.escrow,
    NEXT_PUBLIC_ZARP_ADDRESS: chain.token,
    NEXT_PUBLIC_ZARP_TOKEN_ADDRESS: chain.token,
    NEXT_PUBLIC_API_ORIGIN: apiOrigin,
    NEXT_PUBLIC_API_BASE_URL: apiOrigin,
    NEXT_PUBLIC_SITE_URL: webOrigin,
  };
  for (const key of ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID",
    "NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_WEB3AUTH_CLIENT_ID"]) {
    if (env[key]) webEnv[key] = env[key];
  }
  if (!webEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_ID) {
    webEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID = env.GOOGLE_OAUTH_CLIENT_ID;
  }
  startService("web", [nextCli, "dev", "-p", String(plan.webPort)], ROOT, webEnv, pids);
  await waitFor("Web app", async () => (await fetch(`${webOrigin}/`)).status < 500, 300_000);
  writeFileSync(path.join(STATE_DIR, "stack.json"), JSON.stringify({ plan, chain, webOrigin, apiOrigin }, null, 2));

  log("");
  log(`Ready. Web ${webOrigin}  ·  API ${apiOrigin}  ·  chain ${chain.chainId}`);
  log(`  Buyer dashboard   ${webOrigin}/buyer`);
  log(`  New order         ${webOrigin}/orders/new   (sign in as buyer@demo.patela.local)`);
  log(`  Demo inbox        ${webOrigin}/demo-inbox   (codes and accept links)`);
  log(`  Maps: ${webEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "Google 3D map on" : "no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, map fallback"}`);
  log(`  Voice: ${backendEnv.GOOGLE_APPLICATION_CREDENTIALS ? "Google Speech on" : "no Google credentials, browser speech fallback"}`);
  log('Stop everything with "npm run demo:stop". Logs are in .demo/logs.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[demo] ${error instanceof Error ? error.message : String(error)}\n`);
    process.stderr.write('[demo] Partially started services can be stopped with "npm run demo:stop".\n');
    process.exitCode = 1;
  });
}
