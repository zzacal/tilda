import cors, { CorsOptions } from 'cors'
import express from 'express'
import type { Server as HttpServer } from 'http'
import Store from './cacher/store'
import { fetch, mock, notFound } from './handlers'
import { recorder, type RecorderConfig } from './recorder'
import { MockRecord } from './types/mockRecord';

export interface CorsConfig {
  /** Forwarded as the cors middleware's `origin` option. */
  origin: string;
  /** When true, the cors middleware is not mounted at all. */
  disabled: boolean;
}

/**
 * Subset of `RecorderConfig` that callers (`src/index.ts`, tests) supply.
 * `store` and `mockPath` are filled in by `TildaServer` from its own state
 * so callers don't have to plumb them.
 */
export type RecorderInit = Omit<RecorderConfig, 'store' | 'mockPath'>;

export default class TildaServer {
  express: express.Express = express();
  store: Store;
  private _httpServer: HttpServer | undefined;
  private closePromise: Promise<void> | undefined;

  constructor (
    mockPath: string,
    port: number,
    seed?: MockRecord[],
    corsConfig?: CorsConfig,
    recorderInit?: RecorderInit
  ) {
    this.store = new Store(seed);

    if (!corsConfig?.disabled) {
      const options: CorsOptions = {
        origin: corsConfig?.origin ?? '*',
        methods: '*',
        allowedHeaders: '*',
      };
      this.express.use(cors(options));
    }

    this.express.use(express.urlencoded({ extended: true }))
    this.express.use(express.json())

    if (recorderInit) {
      // Record/passthrough chain:
      //   fetch(next-on-miss) → recorder → mock-control → notFound
      // The recorder responds in the common case; notFound is a safety
      // net for stray requests (e.g. GET /__tilda/mock — see `recorder.ts`'s
      // `mockPath` short-circuit).
      this.express.use(fetch(this.store, mockPath, port, 'next'))
      this.express.use(recorder({ ...recorderInit, store: this.store, mockPath }))
      this.express.post(mockPath, mock(this.store))
      this.express.use(notFound(port, mockPath))
    } else {
      // Replay chain (default): unchanged from pre-story-05.
      //   fetch(respond-on-miss) → mock-control
      this.express.use(fetch(this.store, mockPath, port))
      this.express.post(mockPath, mock(this.store))
    }
  }

  /**
   * The underlying Node `http.Server`, captured on `listen()`. `undefined`
   * before `listen()` is called. Exposed as an escape hatch for callers that
   * need finer control (e.g. socket tracking, manual `keepAliveTimeout`
   * tweaks). Most callers should use `close()` instead.
   */
  get httpServer(): HttpServer | undefined {
    return this._httpServer;
  }

  listen (port: number): this {
    this._httpServer = this.express.listen(port, () => {
      console.log(`listening on port ${port}`)
    })
    return this
  }

  /**
   * Stops accepting new connections and resolves once all in-flight requests
   * have completed (Node's `http.Server.close` callback fires).
   *
   * Idempotent:
   *  - `close()` before `listen()` resolves immediately.
   *  - Overlapping `close()` calls share the same in-flight promise, so every
   *    awaiter unblocks together when shutdown actually finishes.
   *  - Calls after a completed shutdown resolve immediately.
   *
   * Does **not** force-close idle keep-alive sockets — Node's `http.Server`
   * waits for them to drain on their own. Acceptable for Tilda's typical
   * test/embedded use (supertest doesn't keep-alive across tests). If you
   * need socket-level control, reach for `httpServer`.
   */
  close (): Promise<void> {
    if (this.closePromise) return this.closePromise;
    const server = this._httpServer;
    if (!server) return Promise.resolve();
    this.closePromise = new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return this.closePromise;
  }
}
