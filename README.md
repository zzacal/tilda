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

## How matching works

When a request comes in, Tilda finds every record whose `path` matches exactly and whose stored `params` and `body` are subsets of the incoming request (subset matching uses `lodash.isMatch`, so a stored `{}` matches anything).

When more than one record matches, the **most specific record wins**. Specificity is the number of constrained fields in the stored `params` plus the stored `body` — top-level keys for objects, `1` for a non-empty string, `0` for `{}` or `undefined`. A method-specific record also outranks a method-agnostic one for the same path/params/body. Ties are broken by registration order: the first record added wins.

This means you can layer a wildcard default (`params: {}`) with specific overrides (`params: { secret: "true" }`) for the same path, and the override fires when its constraints are met regardless of seed file order. Seed files in `SEEDS_DIR` are loaded in alphabetical order so the result is deterministic across machines.

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

While the server is running, you can refine a mock by `POST`ing to `/mock` again with the same `request` shape and a tweaked `response` — Tilda overwrites the existing record in place. "Same shape" means the same `path`, the same `method`, and deep-equal `params` and `body` (with omitted, `undefined`, or `null` treated as `{}`).

If you change the shape — for example, add a `params` constraint — the new record **coexists** with the old one, and the most specific match wins per request (see above). So you can layer a wildcard default and a specific override without restarting the server.

```sh
curl -s -X POST http://localhost:5111/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/api"},"response":{"status":200,"body":"v1"}}'

curl -s -X POST http://localhost:5111/mock -H 'content-type: application/json' \
  -d '{"request":{"path":"/api"},"response":{"status":200,"body":"v2"}}'

curl http://localhost:5111/api   # → v2  (same shape: v2 replaced v1)
```
