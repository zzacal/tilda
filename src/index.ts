import { fromDir, fromFile } from "./seeding/seed-files";
import TildaServer, { CorsConfig } from "./server";
import { MockRecord } from "./types/mockRecord";

const port = parseInt(process.env.PORT ?? "5111");
const mockPath = process.env.MOCK_PATH ?? "/__tilda/mock";

const seedPath = process.env.SEED ?? "/data/seed.json";
const seedsDir = process.env.SEEDS_DIR ?? "/data/seeds/";

const corsConfig: CorsConfig = {
  origin: process.env.CORS_ORIGIN ?? "*",
  disabled: isTruthy(process.env.CORS_DISABLE),
};

let seed: MockRecord[] = [];
try {
  seed = [...fromFile(seedPath), ...fromDir(seedsDir)];
} catch (err) {
  if (err instanceof Error) {
    console.warn(`Unable to seed: ${err.message}`);
  }
}

const server = new TildaServer(mockPath, port, seed, corsConfig).listen(port);

// Process-wide signal handlers live here, not inside TildaServer, so a test
// harness or embedder importing the class doesn't get them attached for free.
let shuttingDown = false;
const onSignal = (signal: NodeJS.Signals): void => {
  if (shuttingDown) {
    // A second signal during shutdown means the user (or orchestrator) wants
    // out *now* — likely an in-flight `delay` mock is holding things open.
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`shutting down on port ${port} (${signal})`);
  server.close()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`error during shutdown: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    });
};

process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

function isTruthy(value: string | undefined): boolean {
  if (value == null) return false;
  return value.toLowerCase() === "true" || value === "1";
}
