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
