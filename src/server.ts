import express from 'express'
import Store from './cacher/store'
import { fetch, mock } from './handlers'
import { MockRecord } from './types/mockRecord';

export default class Server {
  express: express.Express = express();
  store: Store;

  constructor (mockPath: string, seed?: MockRecord[]) {
    this.store = new Store(seed);
    this.express.use(express.urlencoded({ extended: true }))
    this.express.use(express.json())

    this.express.use(fetch(this.store, mockPath))

    this.express.post(mockPath, mock(this.store))
  }

  listen (port: number): Server {
    this.express.listen(port, async () => {
      console.log(`listening on port ${port}`)
    })
    return this
  }
}
