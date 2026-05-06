import express from 'express'
import Store from './cacher/store'
import { fetch, mock } from './handlers'
import { MockRecord } from './types/mockRecord';

export default class TildaServer {
  express: express.Express = express();
  store: Store;

  constructor (mockPath: string, port: number, seed?: MockRecord[]) {
    this.store = new Store(seed);
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
