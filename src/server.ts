import cors, { CorsOptions } from 'cors'
import express from 'express'
import Store from './cacher/store'
import { fetch, mock } from './handlers'
import { MockRecord } from './types/mockRecord';

export interface CorsConfig {
  /** Forwarded as the cors middleware's `origin` option. */
  origin: string;
  /** When true, the cors middleware is not mounted at all. */
  disabled: boolean;
}

export default class TildaServer {
  express: express.Express = express();
  store: Store;

  constructor (mockPath: string, port: number, seed?: MockRecord[], corsConfig?: CorsConfig) {
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

    this.express.use(fetch(this.store, mockPath, port))

    this.express.post(mockPath, mock(this.store))
  }

  listen (port: number): this {
    this.express.listen(port, () => {
      console.log(`listening on port ${port}`)
    })
    return this
  }
}
