import { createRuntime } from "./runtime.js";

async function main() {
  const { app, db } = createRuntime();
  const port = Number(process.env.PORT ?? "4000");
  await app.listen({ host: "127.0.0.1", port });
  process.stdout.write(`Patela backend listening on http://127.0.0.1:${port}\n`);
  const stop = async () => {
    await app.close();
    await db.close();
  };
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
