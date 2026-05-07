/**
 * Default secrets-bearing header names. Lower-cased so the comparison is
 * case-insensitive without per-call work.
 */
const DEFAULT_REDACTED: readonly string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
]

/**
 * Build the redaction set from the optional `CAPTURE_REDACT` env var.
 * Extends the default list — never replaces it, so a user typo can't
 * accidentally start persisting `Authorization`.
 */
export function buildRedactList(extraCsv: string | undefined): Set<string> {
  const set = new Set<string>(DEFAULT_REDACTED)
  if (!extraCsv) return set
  for (const raw of extraCsv.split(',')) {
    const name = raw.trim().toLowerCase()
    if (name) set.add(name)
  }
  return set
}

/**
 * Drop any header whose name (case-insensitive) appears in `redactList`.
 * Returns a new object — never mutates the input.
 */
export function redactHeaders<V>(
  headers: Record<string, V>,
  redactList: Set<string>
): Record<string, V> {
  const out: Record<string, V> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!redactList.has(key.toLowerCase())) {
      out[key] = value
    }
  }
  return out
}

/**
 * Strip upstream's CORS response headers from a captured response. Tilda's
 * own CORS middleware (story 11) re-adds the configured `Access-Control-*`
 * on serve, so keeping upstream's would either duplicate or contradict
 * Tilda's policy depending on what the user set. Strip and let the
 * middleware be the source of truth.
 */
export function stripCorsHeaders<V>(headers: Record<string, V>): Record<string, V> {
  const out: Record<string, V> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!/^access-control-allow-/i.test(key)) {
      out[key] = value
    }
  }
  return out
}

/**
 * Transport-layer headers that describe the upstream's wire bytes, not
 * the body Tilda actually serves on replay. Node's `fetch` transparently
 * decodes the response, so `forward.ts` already has decoded bytes;
 * persisting (or echoing back) `content-encoding: br` alongside decoded
 * JSON makes the header lie. A browser honoring `Accept-Encoding: br`
 * then tries to brotli-decode plain JSON and aborts with a decode error.
 *
 * `content-length` and `transfer-encoding` have the same problem: we
 * re-serialize the body on serve (`res.send(object)` JSON-stringifies
 * afresh; chunked is wire-form only), so any header pinning to the
 * upstream's wire form is stale.
 *
 * Conceptually identical to `stripCorsHeaders` — Tilda owns the serve
 * side, so these are no longer authoritative.
 */
const TRANSPORT_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  // `date` is the upstream's response timestamp. On replay it stamps every
  // serve with a stale upstream time — clients computing clock skew (auth
  // tokens, OAuth, conditional-request caches) get confused. Drop it; Express
  // sets a fresh `Date` on serve.
  'date',
  // `connection` and `keep-alive` describe wire-state for the upstream
  // socket Tilda already closed. Both are RFC 7230 hop-by-hop headers — they
  // explicitly do not apply downstream of a proxy.
  'connection',
  'keep-alive',
])

export function stripTransportHeaders<V>(headers: Record<string, V>): Record<string, V> {
  const out: Record<string, V> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (!TRANSPORT_HEADERS.has(key.toLowerCase())) {
      out[key] = value
    }
  }
  return out
}
