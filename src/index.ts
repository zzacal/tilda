import { fromDir, fromFile } from "./seeding/seed-files";
import TildaServer, { CorsConfig } from "./server";
import { MockRecord } from "./types/mockRecord";

const port = parseInt(process.env.PORT ?? "5111");
const mockPath = process.env.MOCK_PATH ?? "/mock";

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

new TildaServer(mockPath, port, seed, corsConfig).listen(port);

function isTruthy(value: string | undefined): boolean {
  if (value == null) return false;
  return value.toLowerCase() === "true" || value === "1";
}
