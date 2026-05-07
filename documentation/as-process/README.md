# Starting Tilda as a process

## Requirements

1. nodejs 24.x (see `.tool-versions`)

## Configure requests and responses

You need to set up files that configure how tilda will respond to requests. To make it easy to manage your configurations, you can use multiple files and each file stores an array of configurations.

Let's walk through one example of a seed file.

Check out this sample config in [documentation/sample-seeds/user.json](../sample-seeds/user.json).

Notice that the configuration is an array of objects that define a `request` and a `response`.

## Install dependencies, build, and run

At the root of the repo run:

```sh
npm i &&
npm run build &&
SEEDS_DIR=./documentation/sample-seeds node .
```

Tilda will listen at http://localhost:5111

## Configuration

Every option is an environment variable. The defaults below are what `node .` uses when an option is unset.

### Server

| Var | Default | Description |
|---|---|---|
| `PORT` | `5111` | TCP port the server binds to. |
| `MOCK_PATH` | `/__tilda/mock` | Control endpoint for runtime mock registration (`POST` here to register a mock). The default sits under the `/__tilda/` namespace so you can mock an upstream that itself exposes `/mock`. |

### Seed sources

Both sources are loaded at boot and concatenated into the cache; later sources don't shadow earlier ones — specificity decides ties at read time.

| Var | Default | Description |
|---|---|---|
| `SEED` | `/data/seed.json` | Single JSON file. Missing or unreadable → warning, server still starts. |
| `SEEDS_DIR` | `/data/seeds/` | Directory; every `.json` file inside is loaded. Missing dir is silently skipped. |
| `CAPTURES_DIR` | `/data/captures/` | Directory used by record mode (below). Loaded as seeds at boot just like `SEEDS_DIR`, so captures replay automatically next run. |

### CORS (browser callers)

| Var | Default | Description |
|---|---|---|
| `CORS_ORIGIN` | `*` | Forwarded to the `cors` middleware's `origin` option. |
| `CORS_DISABLE` | unset | Truthy values (`1`, `true`) skip mounting the CORS middleware entirely. |

### Record / replay (story 05)

`replay` is the default — Tilda only consults its cache. Set `TILDA_MODE` to `record` or `passthrough` to forward unmatched requests to a real upstream.

| Var | Default | Description |
|---|---|---|
| `TILDA_MODE` | `replay` | `record` (forward + persist), `replay` (cache-only), or `passthrough` (forward without persisting). |
| `UPSTREAM` | (none) | **Required** when `TILDA_MODE` is `record` or `passthrough`. Full base URL, e.g. `https://api.example.com`. The server fails fast if missing. |
| `CAPTURE_REDACT` | (empty) | Comma-separated extra headers to strip from persisted captures. Defaults already include `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`. |
| `CAPTURE_ERRORS` | unset | Truthy includes 4xx/5xx responses in captures. By default only 2xx/3xx persist so a transient upstream blip doesn't poison a known-good capture. |

A fuller record/replay walkthrough lives in the top-level [README](../../README.md#recording-from-a-real-upstream).

## Testing

Your sample seed registers `GET /user/007?secret=true`. Try it:

```sh
curl -X GET "http://localhost:5111/user/007?secret=true"
```

## Congratulations

You can now mock different requests using Tilda.
