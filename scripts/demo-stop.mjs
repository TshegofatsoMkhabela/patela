#!/usr/bin/env node
// Stops what "npm run demo" started: the process trees in .demo/pids.json and the demo
// Postgres container (only if the demo created it).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PIDS_FILE = path.join(ROOT, ".demo", "pids.json");

if (!existsSync(PIDS_FILE)) {
  process.stdout.write("[demo] Nothing to stop.\n");
  process.exit(0);
}
const pids = JSON.parse(readFileSync(PIDS_FILE, "utf8"));
for (const name of ["web", "backend", "hardhat"]) {
  const pid = pids[name];
  if (!pid) continue;
  // Kill the whole tree: next and tsx start child processes of their own.
  const result = process.platform === "win32"
    ? spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore" })
    : spawnSync("kill", ["-TERM", `-${pid}`], { stdio: "ignore" });
  process.stdout.write(`[demo] ${name} (pid ${pid}) ${result.status === 0 ? "stopped" : "was not running"}\n`);
}
if (pids.dockerContainer) {
  spawnSync("docker", ["rm", "-f", pids.dockerContainer], { stdio: "ignore" });
  process.stdout.write(`[demo] removed Docker container ${pids.dockerContainer}\n`);
}
rmSync(PIDS_FILE, { force: true });
