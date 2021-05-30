import express from "express";
import Store from "./cacher/store";
import { fetch, mock } from "./handlers";

export default class Server {
  express: express.Express = express();
  store: Store = new Store();

  constructor(mockPath: string) {
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(express.json());

    this.express.use(fetch(this.store, mockPath));

    this.express.post(mockPath, mock(this.store));
  }

  listen(port: number) {
    this.express.listen(port, async () => {
      console.log(`listening on port ${port}`);
    });
    return this;
  }
}
