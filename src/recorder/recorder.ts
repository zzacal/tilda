import type { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'
import type { MockBody, MockRecord } from '../types/mockRecord'
import { forward, type ForwardResponse } from './forward'
import { persist } from './persist'
import { redactHeaders, stripCorsHeaders, stripTransportHeaders } from './redact'

export type RecorderMode = 'record' | 'passthrough'

export interface RecorderConfig {
  mode: RecorderMode
  /** Full base URL incl. scheme. Trailing slash is stripped by `forward`. */
  upstream: string
  /** Directory where capture files land in record mode. Created if missing. */
  capturesDir: string
  /**
   * Lower-cased header names to strip from both the request-side and
   * response-side of a captured record. Built by `redact.buildRedactList`.
   */
  redactList: Set<string>
  /**
   * When false (default), 4xx/5xx upstream responses are returned to the
   * caller but never persisted — protects a known-good capture from being
   * silently overwritten by a transient upstream blip. Set true to record
   * error responses deterministically.
   */
  captureErrors: boolean
  /**
   * Tilda's own control endpoint. Forwarded to upstream would be a
   * footgun (it's a Tilda thing, not a user's API), so the recorder
   * skips it just like `fetch.ts` does.
   */
  mockPath: string
  /**
   * Live store. Captured records are added so the *next* hit serves from
   * cache instead of forwarding again — without restarting Tilda.
   */
  store: Store
}

/**
 * Recorder middleware. Slots into the chain after `fetch(onMiss: 'next')`
 * in record/passthrough mode. Behavior:
 *
 * - `mockPath` requests pass through untouched (the mock-control route
 *   handles them).
 * - Otherwise: forward upstream, strip CORS response headers (Tilda's CORS
 *   middleware is the source of truth on serve), respond to the caller.
 * - In record mode, additionally: if status passes the `captureErrors`
 *   gate, redact sensitive headers, persist a `MockRecord` to disk, and
 *   register it with `Store` so subsequent identical requests hit the cache.
 * - On forward error: log and return 502 with a JSON body explaining the
 *   upstream was unreachable.
 *
 * The exact log/error wording was locked jointly with fed in task #1; do
 * not paraphrase without re-pairing.
 */
export const recorder = (config: RecorderConfig) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path === config.mockPath) return next()

    const method = req.method.toUpperCase()
    const incomingPath = req.path

    console.log(`tilda: forwarding ${method} ${incomingPath} → ${config.upstream}`)

    const result = await forward(req, config.upstream)

    if (!result.ok) {
      console.warn(
        `tilda: upstream error — ${method} ${incomingPath} → ${config.upstream}: ${result.reason} (returning 502)`
      )
      res
        .status(502)
        .setHeader('Content-Type', 'application/json')
        .send({
          error: 'Tilda could not reach the upstream',
          upstream: config.upstream,
          request: `${method} ${incomingPath}`,
          reason: result.reason,
        })
      return
    }

    const upstreamRes = result.response
    // Three layers strip from the wire response:
    //   1. CORS — Tilda's middleware is source of truth.
    //   2. Transport — Node fetch decoded the body; wire-form headers
    //      (content-encoding, content-length, transfer-encoding, date,
    //      connection, keep-alive) now lie about it.
    //   3. CAPTURE_REDACT secrets — same set the persist path uses, so a
    //      record-mode caller can never observe a header that's missing
    //      at replay time. Story 05 #8 issue 2 (fed's call after usr's
    //      eval): symmetry beats transparent-proxy semantics here because
    //      a record session that "works" but breaks on replay is the
    //      worst-case footgun.
    const responseHeaders = redactHeaders(
      stripTransportHeaders(stripCorsHeaders(upstreamRes.headers)),
      config.redactList
    )

    for (const [key, value] of Object.entries(responseHeaders)) {
      res.setHeader(key, value)
    }
    res.status(upstreamRes.status).send(upstreamRes.body)

    if (config.mode === 'passthrough') {
      console.log(
        `tilda: forwarded ${method} ${incomingPath} → ${upstreamRes.status} (passthrough)`
      )
      return
    }

    // Record mode from here.
    if (!shouldCapture(upstreamRes.status, config.captureErrors)) {
      console.log(
        `tilda: forwarded ${method} ${incomingPath} → ${upstreamRes.status} (not captured; set CAPTURE_ERRORS=true to keep)`
      )
      return
    }

    const record = buildRecord(req, upstreamRes, config.redactList)
    try {
      const filePath = persist(record, config.capturesDir)
      config.store.add(record)
      console.log(
        `tilda: captured ${method} ${incomingPath} → ${upstreamRes.status} (${filePath})`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `tilda: failed to persist capture for ${method} ${incomingPath}: ${msg}`
      )
    }
  }

function shouldCapture(status: number, captureErrors: boolean): boolean {
  if (status >= 200 && status < 400) return true
  if (captureErrors && status >= 400 && status < 600) return true
  return false
}

function buildRecord(
  req: Request,
  upstreamRes: ForwardResponse,
  redactList: Set<string>
): MockRecord {
  const requestHeaders = redactHeaders(
    flattenHeaders(req.headers),
    redactList
  )
  const responseHeaders = ensureContentType(
    redactHeaders(
      stripTransportHeaders(stripCorsHeaders(upstreamRes.headers)),
      redactList
    )
  )

  return {
    request: {
      path: req.path,
      method: req.method.toUpperCase(),
      params: req.query,
      body: req.body ?? {},
      headers: requestHeaders,
    },
    response: {
      status: upstreamRes.status,
      headers: responseHeaders,
      body: tryParseJsonBody(upstreamRes.body, upstreamRes.headers),
    },
  }
}

function flattenHeaders(
  headers: Request['headers']
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

/**
 * MockHeaders requires a `Content-Type` field. If upstream omitted one, fall
 * back to `application/octet-stream` — the safe "we don't know" default.
 * Also normalize the casing of the `content-type` key to `Content-Type` to
 * match the convention in hand-authored seeds.
 */
function ensureContentType(headers: Record<string, string>): Record<string, string> & { 'Content-Type': string } {
  const out: Record<string, string> = {}
  let contentType: string | undefined
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type') {
      contentType = value
    } else {
      out[key] = value
    }
  }
  out['Content-Type'] = contentType ?? 'application/octet-stream'
  return out as Record<string, string> & { 'Content-Type': string }
}

/**
 * Stored captures are read back as seeds on the next boot. JSON bodies as
 * structured objects round-trip nicely and match the hand-authored seed
 * convention; non-JSON bodies stay as the raw string.
 */
function tryParseJsonBody(body: string, headers: Record<string, string>): MockBody {
  const ct = (headers['content-type'] ?? headers['Content-Type'] ?? '').toLowerCase()
  if (!ct.includes('json')) return body
  try {
    return JSON.parse(body) as MockBody
  } catch {
    return body
  }
}
