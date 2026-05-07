import type { Request } from 'express'

/**
 * Result of forwarding one request upstream. Discriminated on `ok` so the
 * caller (the recorder middleware) decides between "send the upstream
 * response back" and "respond 502 — Tilda couldn't reach the upstream."
 */
export type ForwardResult =
  | { ok: true; response: ForwardResponse }
  | { ok: false; reason: string };

/**
 * The captured upstream response, body buffered as text. Story 05 explicitly
 * defers streaming to a later story, so we read the whole body before
 * responding — fine for the dev-volume traffic Tilda is built for.
 */
export interface ForwardResponse {
  status: number;
  /** Lowercase header names from undici's normalization. */
  headers: Record<string, string>;
  body: string;
}

const HOP_BY_HOP = new Set([
  // Headers undici already manages or that confuse upstream when proxied.
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'proxy-connection',
])

/**
 * Forward one request to `upstreamBase`. Pure with respect to Tilda's
 * state — no logging, no persistence, no `res.send`. The middleware layer
 * owns those side effects.
 *
 * Body handling: whatever Express's body parsers produced (JSON object,
 * urlencoded object, or string). Multipart and raw streams are not
 * forwarded faithfully in v1 — `req.body` is whatever the parsers
 * populated, and we re-serialize as JSON. Documented limitation.
 */
export async function forward(req: Request, upstreamBase: string): Promise<ForwardResult> {
  const base = upstreamBase.replace(/\/+$/, '')
  // `req.url` carries the raw query string in its original encoding; using
  // it (vs. reconstructing from `req.path` + `req.query`) preserves what
  // upstream actually sees.
  const url = `${base}${req.url}`

  const init: RequestInit = {
    method: req.method,
    headers: pickHeaders(req.headers),
  }

  const method = req.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && req.body != null) {
    init.body = serializeBody(req.body)
  }

  try {
    const upstreamRes = await fetch(url, init)
    const body = await upstreamRes.text()
    const headers: Record<string, string> = {}
    upstreamRes.headers.forEach((value, key) => { headers[key] = value })
    return { ok: true, response: { status: upstreamRes.status, headers, body } }
  } catch (err) {
    return { ok: false, reason: shortReason(err) }
  }
}

function pickHeaders(incoming: Request['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    out[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return out
}

function serializeBody(body: unknown): string | undefined {
  if (typeof body === 'string') return body
  if (typeof body === 'object' && body !== null) {
    if (Object.keys(body as object).length === 0) return undefined
    return JSON.stringify(body)
  }
  return undefined
}

/**
 * Node fetch wraps the underlying SystemError on `err.cause`, surfacing only
 * the generic `"fetch failed"` on the outer Error. Reach through `cause` for
 * the useful code/message; fall back to the outer message if no cause.
 *
 * Strips a trailing IPv4 address (e.g. `127.0.0.1:443`) so the line stays
 * scannable when the upstream URL is already in the surrounding log.
 */
function shortReason(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause
    if (cause?.message) {
      return cause.message.replace(/\s+\d{1,3}(\.\d{1,3}){3}(:\d+)?$/, '')
    }
    if (cause?.code) return cause.code
    if (err instanceof Error && err.message) return err.message
  }
  return 'unknown error'
}
