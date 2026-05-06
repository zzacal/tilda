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
