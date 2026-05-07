import fs from "fs";
import { MockRecord } from "../types/mockRecord";
import path from "path";

/**
 * Load every `.json` file in `dirPath` and concatenate the records. A
 * missing directory returns `[]` silently — for default seed/captures
 * paths (e.g. `/data/captures/`) "directory doesn't exist yet" is normal
 * startup state, not a failure worth a warning. Other read errors
 * propagate so `index.ts` can warn-and-continue per source.
 *
 * `label` prefixes the per-file load log so a user can tell which source
 * a file came from (`seedFile foo.json` vs `capture get_posts_1_*.json`).
 * Defaults to the historical `"seedFile"` so existing SEEDS_DIR users see
 * no log change; story 05 passes `"capture"` for CAPTURES_DIR.
 */
export function fromDir(dirPath: string, label: string = "seedFile"): MockRecord[] {
  let entries: string[];
  try {
    entries = getFiles(dirPath);
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  return entries
    .map((filePath) => {
      console.log(label, filePath);
      return fromFile(path.join(dirPath, filePath));
    })
    .flat();
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "ENOENT"
  );
}

export function fromFile(filePath: string): MockRecord[] {
  try {    
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export function getFiles(directoryPath: string, extension = ".json"): string[] {
  const files = fs.readdirSync(directoryPath);
  const jsonFiles = files
    .filter((file) => path.extname(file).toLowerCase() === extension)
    .sort();
  return jsonFiles;
}
