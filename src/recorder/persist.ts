import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { MockRecord } from '../types/mockRecord'

/**
 * Hybrid filename: a human-readable `<method>_<path>` prefix plus an
 * 8-char hash of the full matching surface (`method + path + query +
 * body`). Re-recording the same shape overwrites the same file —
 * `Store.add`'s identity check (story 04) replaces the in-memory record
 * cleanly and git diffs after a record session stay clean. The prefix
 * makes `ls $CAPTURES_DIR` scannable; the hash keeps query/body variants
 * of the same path on disjoint files (`/users/42` and `/users/42?role=admin`
 * produce different hashes, so the second one doesn't overwrite the first).
 */
export function captureFilename(record: MockRecord): string {
  const { request } = record
  const method = (request.method ?? 'ANY').toUpperCase()
  const key = [
    method,
    request.path,
    JSON.stringify(request.params ?? {}),
    JSON.stringify(request.body ?? {}),
  ].join('|')
  const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 8)
  const prefix = sanitizePrefix(`${method}_${request.path}`)
  return prefix ? `${prefix}_${hash}.json` : `${hash}.json`
}

/**
 * Reduce an arbitrary `<method>_<path>` string to filesystem-safe ASCII:
 * any non-alphanumeric run collapses to a single `_`, leading/trailing
 * `_` are trimmed, the result is lower-cased, and capped at 60 chars so
 * a 4KB GraphQL path can't blow past a 255-char filename limit. An
 * empty result (e.g. path `/`) returns `""` and the caller falls back
 * to the bare hash.
 */
function sanitizePrefix(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 60)
}

/**
 * Persist one capture to disk. Returns the resolved file path so the
 * caller can reference it in a log line if it wants. Creates the
 * directory recursively if it doesn't exist — matches the "user opted
 * into recording, just bookkeep the directory" UX agreed in task #1.
 *
 * The file contains a JSON array `[record]`, not the bare object, so the
 * existing seed loader (`fromFile`) — which assumes JSON arrays — picks
 * it up uniformly with hand-authored seeds.
 */
export function persist(record: MockRecord, capturesDir: string): string {
  fs.mkdirSync(capturesDir, { recursive: true })
  const filePath = path.join(capturesDir, captureFilename(record))
  fs.writeFileSync(filePath, JSON.stringify([record], null, 2) + '\n', 'utf-8')
  return filePath
}
