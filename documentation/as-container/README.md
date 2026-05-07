# Starting Tilda as a container

## Requirements

1. docker compose (e.g. Docker Desktop or Rancher Desktop)

## Configure requests and responses

You need to set up files that configure how tilda will respond to requests. To make it easy to manage your configurations, you can use multiple files and each file stores an array of configurations.

Let's walk through one example of a seed file.

Check out this sample config in [documentation/sample-seeds/user.json](../sample-seeds/user.json).

Notice that the configuration is an array of objects that define a `request` and a `response`.

## Set up the compose file

Check out the sample compose file: [documentation/as-container/docker-compose.yml](./docker-compose.yml).

It serves Tilda on port `8110` using the configuration in [documentation/sample-seeds/user.json](../sample-seeds/user.json).

## Start the container

Make sure the Docker daemon is running by starting Docker Desktop or Rancher Desktop.

Navigate to the folder containing `docker-compose.yml` and start the container. Run from the root of the repo:

```sh
cd documentation/as-container && docker compose up -d
```

## Testing

Your sample seed registers `GET /user/007?secret=true`. Try it:

```sh
curl -X GET "http://localhost:8110/user/007?secret=true"
```

## Configuration

Every option is an environment variable. The bundled `docker-compose.yml` lists each one (most are commented-out so the example stays minimal — uncomment the ones you need).

### Server

| Var | Default | Description |
|---|---|---|
| `PORT` | `5111` | TCP port the server binds to. The sample compose file overrides to `8110`. |
| `MOCK_PATH` | `/__tilda/mock` | Control endpoint for runtime mock registration (`POST` here to register a mock). The default sits under the `/__tilda/` namespace so you can mock an upstream that itself exposes `/mock`. |

### Seed sources

Both sources are loaded at boot and concatenated into the cache; specificity decides ties at read time.

| Var | Default | Description |
|---|---|---|
| `SEED` | `/data/seed.json` | Single JSON file. Missing or unreadable → warning, server still starts. |
| `SEEDS_DIR` | `/data/seeds/` | Directory; every `.json` file inside is loaded. Missing dir is silently skipped. The sample compose mounts the project's `sample-seeds/` here. |
| `CAPTURES_DIR` | `/data/captures/` | Directory used by record mode (below). Loaded as seeds at boot just like `SEEDS_DIR`, so captures replay automatically next run. Mount a host directory if you want captures to persist across container restarts. |

### CORS (browser callers)

| Var | Default | Description |
|---|---|---|
| `CORS_ORIGIN` | `*` | Forwarded to the `cors` middleware's `origin` option. Tighten when needed. |
| `CORS_DISABLE` | unset | Truthy values (`1`, `true`) skip mounting the CORS middleware entirely. |

### Record / replay (story 05)

`replay` is the default — Tilda only consults its cache. Set `TILDA_MODE` to `record` or `passthrough` to forward unmatched requests to a real upstream.

| Var | Default | Description |
|---|---|---|
| `TILDA_MODE` | `replay` | `record` (forward + persist), `replay` (cache-only), or `passthrough` (forward without persisting). |
| `UPSTREAM` | (none) | **Required** when `TILDA_MODE` is `record` or `passthrough`. Full base URL, e.g. `https://api.example.com`. The container exits 1 if missing. |
| `CAPTURE_REDACT` | (empty) | Comma-separated extra headers to strip from persisted captures. Defaults already include `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`. |
| `CAPTURE_ERRORS` | unset | Truthy includes 4xx/5xx responses in captures. By default only 2xx/3xx persist so a transient upstream blip doesn't poison a known-good capture. |

A fuller record/replay walkthrough lives in the top-level [README](../../README.md#recording-from-a-real-upstream).

## Conclusion

You can now mock different requests using Tilda in a container.
