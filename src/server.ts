import express from "express";
import Store from "./cacher/store";
import { fetch, mock } from "./handlers";

export default class Server {
  express: express.Express = express();
  port: number;
  store: Store = new Store();

  constructor(port: number) {
    this.port = port;
  }

  start() {
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(express.json());

    this.express.use(fetch(this.store));

    this.express.post("/mock", mock(this.store));
    this.listen();
  }

  private listen() {
    this.express.listen(this.port, async () => {
      console.log(`listening on port ${this.port}`);
    });
  }
}
