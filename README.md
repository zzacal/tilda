# Tilda

## Driver

Tilda allows you to mock your http dependencies during development time. 

This is especially helpful when:
1. an external dependency is unstable or unreachable during developing
1. the response you are solving for is difficult to set up

You can approximate your dependency with Tilda.

## Usage

You can use tilda by running it as either a container or a local process.

### Container

Set up a container using docker compose by following [this guide](./documentation/as-container/README.md).

### Running locally

Start a process locally by following [this guide](./documentation/as-process/README.md)

## Calling Tilda from the browser

Tilda answers `OPTIONS` preflight requests and adds `Access-Control-Allow-Origin: *` to every response by default, so a fetch from your frontend dev server (Vite, Next.js, CRA — whatever) just works. Start Tilda with `npm run dev`, then from a browser app running anywhere:

```js
const res = await fetch("http://localhost:5111/user/007");
const user = await res.json();
console.log(user); // → { firstName: "James", license: "toDrive", ... }
```

Tighten the policy when you need to mirror a real upstream — e.g. to confirm your app handles a strict `Access-Control-Allow-Origin`:

```sh
CORS_ORIGIN=https://app.example npm run dev
```

A specific mock can override the default per response: set `Access-Control-Allow-Origin` (or any other CORS header) in its `headers` and that value wins over Tilda's default.

Testing your own CORS plumbing and want Tilda to stay out of the way? Set `CORS_DISABLE=1` and Tilda won't add or answer any CORS headers.

## Recording from a real upstream

Don't have a mock yet — never seen the response, the upstream is intermittently up, or it's just gnarly to hand-author? Point Tilda at the real service once and let it capture. Subsequent runs replay the capture offline, no internet required.

### Record once

Start Tilda in record mode pointed at the upstream:

```sh
TILDA_MODE=record \
  UPSTREAM=https://jsonplaceholder.typicode.com \
  CAPTURES_DIR=./captures \
  npm run dev
```

`CAPTURES_DIR` is resolved relative to Tilda's working directory (the repo root when you use `npm run dev`). Pass an absolute path if you're starting Tilda from elsewhere or running it in a container — the in-container default is `/data/captures/`.

You'll see a one-line confirmation:

```
tilda: record mode — forwarding cache misses to https://jsonplaceholder.typicode.com, writing captures to ./captures
```

Now hit Tilda the same way you'd hit the real upstream. Tilda forwards your request, returns the live response to you, and persists a fully-formed mock record to `./captures/`:

```sh
curl http://localhost:5111/posts/1
```

```
tilda: forwarding GET /posts/1 → https://jsonplaceholder.typicode.com
tilda: captured GET /posts/1 → 200 (captures/get_posts_1_6c60e45d.json)
```

The captured file is a regular `MockRecord` array — same shape as a hand-authored seed:

```sh
cat captures/get_posts_1_6c60e45d.json
```

Filenames are `<method>_<sanitized-path>_<short-hash>.json`. The hash disambiguates query/body variations of the same path (`/users/42` and `/users/42?include=posts` produce different hashes), so re-recording an identical request shape overwrites only the matching file — git diffs after a record session stay clean.

### Hit it again — same request, no upstream traffic

Tilda also adds the captured record to its in-memory cache, so the second hit of the same request shape is served from cache without contacting the upstream:

```sh
curl http://localhost:5111/posts/1   # served from cache, no `forwarding` line in the log
```

Useful when an upstream is rate-limited, slow, or expensive — the first call burns the budget, subsequent calls are free.

### Replay offline

Stop Tilda. Restart in replay mode (the default — drop `TILDA_MODE`) pointing `CAPTURES_DIR` at the same dir, and your captures load alongside any hand-authored seeds:

```sh
CAPTURES_DIR=./captures npm run dev
```

The boot log confirms the mode and the load count (sample seeds bundled with `npm run dev` plus your captured record):

```
tilda: replay mode — 7 records loaded
```

Run the same curl. The response comes from disk — pull your wifi and it still works:

```sh
curl http://localhost:5111/posts/1
```

`SEED`, `SEEDS_DIR`, and `CAPTURES_DIR` are additive: all three sources concat into one record list. When two records both match the same request, [matching specificity](#how-matching-works) decides regardless of which source the record came from.

### Passthrough — forward without writing

Same forward behavior as record mode, but nothing lands on disk. Useful when you want to mock *some* routes by hand and proxy the rest through to the live upstream:

```sh
TILDA_MODE=passthrough UPSTREAM=https://jsonplaceholder.typicode.com npm run dev
```

Anything matched by an existing seed serves from cache; the rest forwards live every time.

### What's stripped from a capture

Tilda redacts four sensitive headers from both the captured request and the captured response before writing — `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`. Extend the list with `CAPTURE_REDACT`:

```sh
CAPTURE_REDACT="X-API-Key,X-Internal-Token" \
  TILDA_MODE=record UPSTREAM=https://api.example.com npm run dev
```

**Redaction applies to the persisted capture file, not to the live response.** In record and passthrough mode Tilda is a transparent proxy on the wire — a `Set-Cookie` from upstream still sets a cookie in your browser, an upstream `Authorization` header still reaches your client. That's deliberate: a frontend that depends on the upstream's session/auth response works through Tilda exactly as it would directly. Redaction only stops those headers from landing on disk, where they'd otherwise leak into a committed capture file.

Matching never consults headers either, so dropping them doesn't break replay. Templating reads the *incoming* request's headers at replay time — `{{ request.headers.authorization }}` in a response template still resolves against the live request, not against the redacted capture.

Tilda also strips six transport headers from the captured response — `Content-Encoding`, `Content-Length`, `Transfer-Encoding`, `Date`, `Connection`, `Keep-Alive`. The first three describe the upstream's wire-form bytes, which no longer match after the body round-trips through JSON parse + re-serialize (leaving `Content-Encoding: br` would make a browser try to brotli-decode plain JSON). `Date` would freeze the upstream's clock into every replay forever. `Connection` and `Keep-Alive` are hop-by-hop per RFC 7230 — meaningless once the response is replayed from disk. Upstream `Access-Control-Allow-*` headers are stripped too: Tilda's [own CORS middleware](#calling-tilda-from-the-browser) is the source of truth on serve, so your `CORS_ORIGIN` policy stays consistent regardless of where the recording came from.

### Errors are opt-in

By default Tilda only captures `2xx`/`3xx` responses. A flaky upstream returning a transient `500` won't silently overwrite a known-good capture. Opt into error capture explicitly:

```sh
CAPTURE_ERRORS=true \
  TILDA_MODE=record UPSTREAM=https://api.example.com npm run dev
```

Without that, a non-`2xx`/`3xx` upstream response is logged and returned to the caller but not persisted:

```
tilda: forwarded GET /posts/x → 404 (not captured; set CAPTURE_ERRORS=true to keep)
```

### When the upstream is unreachable

If the upstream is down (DNS failure, connection refused, etc.), Tilda returns a `502` to your caller and logs the cause without dumping a stack:

```
tilda: upstream error — GET /posts/1 → https://jsonplaceholder.typicode.com: connect ECONNREFUSED (returning 502)
```

The `502` body names the upstream and the failure reason so you can debug straight from your app's network panel:

```json
{
  "error": "Tilda could not reach the upstream",
  "upstream": "https://jsonplaceholder.typicode.com",
  "request": "GET /posts/1",
  "reason": "connect ECONNREFUSED"
}
```

## Stopping Tilda

`Ctrl+C` (or a `SIGTERM` from your container orchestrator) shuts Tilda down gracefully — the process stops accepting new connections, lets any in-flight request finish, then exits:

```
shutting down on port 5111 (SIGINT)
```

If a slow `delay` mock is holding things open and you need out immediately, hit `Ctrl+C` a second time and Tilda hard-exits.

## How matching works

When a request comes in, Tilda finds every record whose `path` matches (literally, or via a `:name` parameter or `*` wildcard — see below) and whose stored `params` and `body` are subsets of the incoming request (subset matching uses `lodash.isMatch`, so a stored `{}` matches anything).

When more than one record matches, the **most specific record wins**. Specificity is the number of constrained fields in the stored `params` plus the stored `body` — top-level keys for objects, `1` for a non-empty string, `0` for `{}` or `undefined`. A method-specific record also outranks a method-agnostic one for the same path/params/body. Ties are broken by registration order: the first record added wins.

This means you can layer a wildcard default (`params: {}`) with specific overrides (`params: { secret: "true" }`) for the same path, and the override fires when its constraints are met regardless of seed file order. Seed files in `SEEDS_DIR` are loaded in alphabetical order so the result is deterministic across machines.

### Path patterns

You can write `path` with parameters or a wildcard so one mock covers a family of URLs. Each token matches a single path segment:

- `:name` captures one segment under that name. `/users/:id` matches `/users/123` and `/users/abc`, but not `/users` and not `/users/123/profile`.
- `*` matches one segment without naming it. `/orders/*/items` matches `/orders/42/items` but not `/orders/items` (no segment) and not `/orders/a/b/items` (two segments).

Literal characters stay literal — `/users.json/:id` treats the dot as a dot, not as "any character".

Patterns lose ties with exact paths: an exact path always beats a parameterized one for the same URL, and a path with more literal segments beats one with fewer. So you can layer a generic catch-all and a specific override and let specificity sort them out:

```sh
# generic fallback for any user
curl -s -X POST http://localhost:5111/__tilda/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/users/:id"},"response":{"status":200,"body":{"name":"unknown"}}}'

# exact override for one user
curl -s -X POST http://localhost:5111/__tilda/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/users/me"},"response":{"status":200,"body":{"name":"you"}}}'

curl http://localhost:5111/users/me   # → {"name":"you"}     (exact wins)
curl http://localhost:5111/users/42   # → {"name":"unknown"} (pattern catches the rest)
```

### Matching by HTTP method

Records may include an optional `method` field to scope a mock to a specific HTTP verb:

```json
{
  "request": {
    "path": "/user/007",
    "method": "DELETE",
    "params": {},
    "body": {}
  },
  "response": {
    "status": 204,
    "body": {},
    "headers": { "Content-Type": "application/json" }
  }
}
```

- `method` is **case-insensitive** — `"DELETE"`, `"delete"`, and `"Delete"` all match the same requests.
- **Omit `method`** to match any verb. Existing seeds without a `method` field keep working unchanged.
- A method-specific record beats a method-agnostic one for the same path/params/body, so you can layer a `GET /users` default and a `DELETE /users` override side by side.

Try it against the sample seed (`npm run dev`):

```sh
curl -i http://localhost:5111/user/007            # 200 — matches the method-agnostic GET record
curl -i -X DELETE http://localhost:5111/user/007  # 204 — matches the DELETE-only record
```

### Iterating on a mock

Tilda's control endpoint lives at `/__tilda/mock` by default — a namespaced path so it never collides with an upstream you might want to mock (yes, including `/mock`). Override with the `MOCK_PATH` env var if you need a different one.

While the server is running, you can refine a mock by `POST`ing to `/__tilda/mock` again with the same `request` shape and a tweaked `response` — Tilda overwrites the existing record in place. "Same shape" means the same `path`, the same `method`, and deep-equal `params` and `body` (with omitted, `undefined`, or `null` treated as `{}`).

If you change the shape — for example, add a `params` constraint — the new record **coexists** with the old one, and the most specific match wins per request (see above). So you can layer a wildcard default and a specific override without restarting the server.

```sh
curl -s -X POST http://localhost:5111/__tilda/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/api"},"response":{"status":200,"body":"v1"}}'

curl -s -X POST http://localhost:5111/__tilda/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/api"},"response":{"status":200,"body":"v2"}}'

curl http://localhost:5111/api   # → v2  (same shape: v2 replaced v1)
```

## Templated responses

A mock for `/users/:id` is more useful when the response can reference the captured `id`. Tilda substitutes `{{ request.X.Y }}` placeholders in the response body with fields from the incoming request:

- `{{ request.params.X }}` — path parameters captured by `:name` segments (e.g. the `id` in `/users/:id`).
- `{{ request.query.X }}` — query-string values.
- `{{ request.headers.X }}` — request headers. Node lowercases header names, so use `content-type`, not `Content-Type`. Hyphens in keys are fine: `{{ request.headers.x-api-key }}` works.
- `{{ request.body.X }}` — fields from the parsed JSON body.

Whitespace inside the braces is optional: `{{request.params.id}}` and `{{ request.params.id }}` are equivalent.

Register a templated mock and call it (`npm run dev`):

```sh
curl -s -X POST http://localhost:5111/__tilda/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/users/:id"},"response":{"status":200,"body":{"id":"{{ request.params.id }}"}}}'

curl http://localhost:5111/users/42   # → {"id":"42"}
```

Tilda walks the whole response body — strings inside nested objects and arrays are templated; object keys, numbers, booleans, and `null` pass through unchanged. Non-string source values are coerced with `String(value)` at substitution time, so `{{ request.body.count }}` where `count` is `42` produces the **string** `"42"` (templating cannot emit a raw number into JSON output today). Substitution runs once per string — a substituted value containing `{{...}}` is left as-is, no recursion.

When a placeholder does not resolve — typo, missing field, whatever — Tilda warns to the dev-server log and substitutes an empty string. The literal `{{...}}` never reaches the caller:

```
tilda: template variable "request.params.nonexistent" did not resolve; substituting empty string (request: GET /users/42)
```

Responses without `{{ ... }}` placeholders behave exactly as before.

### Naming gotcha: `params` means two different things

`params` is overloaded in Tilda — it follows Express convention in templates, but has a different meaning in seed records:

- **In templates** (`{{ request.params.X }}`), `params` follows Express convention: **path parameters** captured by `:name` segments.
- **In `MockRequest.params`** (the seed/registration shape), `params` means the **query string** the matcher constrains on.

So `{{ request.query.X }}` is the template-side spelling for what a record calls `request.params`. The seed-side naming is a holdover from before path patterns existed; we'll reconcile it in a major release.

## Upgrading

The control endpoint moved from `/mock` to `/__tilda/mock` so you can mock an upstream's `/mock` route without colliding with Tilda itself. If your existing scripts POST to `/mock`, either point them at `/__tilda/mock` or run Tilda with `MOCK_PATH=/mock` to keep the old behavior.
