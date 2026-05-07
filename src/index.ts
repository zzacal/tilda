import fs from "fs";
import { fromDir, fromFile } from "./seeding/seed-files";
import TildaServer, { CorsConfig, RecorderInit } from "./server";
import { buildRedactList } from "./recorder";
import { MockRecord } from "./types/mockRecord";

const port = parseInt(process.env.PORT ?? "5111");
const mockPath = process.env.MOCK_PATH ?? "/__tilda/mock";

const seedPath = process.env.SEED ?? "/data/seed.json";
const seedsDir = process.env.SEEDS_DIR ?? "/data/seeds/";
const capturesDir = process.env.CAPTURES_DIR ?? "/data/captures/";

const corsConfig: CorsConfig = {
  origin: process.env.CORS_ORIGIN ?? "*",
  disabled: isTruthy(process.env.CORS_DISABLE),
};

const tildaModeRaw = (process.env.TILDA_MODE ?? "replay").toLowerCase();
if (!isValidMode(tildaModeRaw)) {
  console.error(
    `tilda: TILDA_MODE='${process.env.TILDA_MODE}' is not valid (expected: replay, record, or passthrough). Exiting.`
  );
  process.exit(1);
}
const tildaMode: "replay" | "record" | "passthrough" = tildaModeRaw;

const recorderInit = buildRecorderInit(tildaMode, capturesDir);

const seed = loadSeeds(seedPath, seedsDir, capturesDir);

const server = new TildaServer(mockPath, port, seed, corsConfig, recorderInit).listen(port);

// fed/bed locked the boot wording in task #1. Register the listener after
// listen() so it fires after the "listening on port N" line that
// `TildaServer.listen` prints from its own callback — listeners fire in
// registration order and Express's runs first.
server.httpServer?.once("listening", () => {
  if (recorderInit) {
    if (recorderInit.mode === "record") {
      console.log(
        `tilda: record mode — forwarding cache misses to ${recorderInit.upstream}, writing captures to ${capturesDir}`
      );
    } else {
      console.log(
        `tilda: passthrough mode — forwarding cache misses to ${recorderInit.upstream} (no captures)`
      );
    }
    return;
  }
  // Replay mode banner (story 05 #8 issue 3, flagged by usr): record and
  // passthrough both confirm the mode at boot; replay was silent so users
  // had to infer mode from the absence of a banner. Parity > silence.
  const count = seed.length;
  const records = count === 1 ? "1 record" : `${count} records`;
  console.log(`tilda: replay mode — ${records} loaded`);
});

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

function isValidMode(value: string): value is "replay" | "record" | "passthrough" {
  return value === "replay" || value === "record" || value === "passthrough";
}

/**
 * Builds the recorder config for record/passthrough modes. Validates UPSTREAM
 * is set (fail fast), creates CAPTURES_DIR in record mode if missing (so a
 * user who explicitly opted into recording doesn't get bitten by a stat
 * race), and returns undefined for replay mode.
 *
 * Wording locked jointly with fed in task #1; do not paraphrase.
 */
function buildRecorderInit(
  mode: "replay" | "record" | "passthrough",
  capturesDir: string
): RecorderInit | undefined {
  if (mode === "replay") return undefined;

  const upstream = process.env.UPSTREAM?.trim();
  if (!upstream) {
    console.error(
      `tilda: TILDA_MODE=${mode} requires UPSTREAM to be set (e.g. UPSTREAM=https://api.example.com). Exiting.`
    );
    process.exit(1);
  }

  if (mode === "record") {
    try {
      const existed = fs.existsSync(capturesDir);
      fs.mkdirSync(capturesDir, { recursive: true });
      if (!existed) {
        console.log(`tilda: created captures directory ${capturesDir}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `tilda: could not create captures directory ${capturesDir}: ${msg}. Exiting.`
      );
      process.exit(1);
    }
  }

  return {
    mode,
    upstream: upstream.replace(/\/+$/, ""),
    capturesDir,
    redactList: buildRedactList(process.env.CAPTURE_REDACT),
    captureErrors: isTruthy(process.env.CAPTURE_ERRORS),
  };
}

/**
 * Load every seed source independently. A parse error in one file or a
 * missing dir doesn't poison the others — the server still starts with
 * whatever loaded successfully (CLAUDE.md "Failures during seeding only
 * `console.warn`"). `fromDir` already swallows ENOENT silently because a
 * defaulted seed/captures dir not existing is normal startup state, not
 * an error worth warning about.
 */
function loadSeeds(seedPath: string, seedsDir: string, capturesDir: string): MockRecord[] {
  const sources: Array<[string, () => MockRecord[]]> = [
    [seedPath, () => fromFile(seedPath)],
    [seedsDir, () => fromDir(seedsDir)],
    // "capture" label so usr-noticed log noise (`seedFile <captured.json>`)
    // distinguishes captures from hand-authored seeds. Story 05 #8 issue 4.
    [capturesDir, () => fromDir(capturesDir, "capture")],
  ];
  const seed: MockRecord[] = [];
  for (const [label, load] of sources) {
    try {
      seed.push(...load());
    } catch (err) {
      if (err instanceof Error) {
        console.warn(`tilda: unable to load seeds from ${label}: ${err.message}`);
      }
    }
  }
  return seed;
}
