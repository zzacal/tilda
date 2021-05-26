import express from "express";

export default class Server {
  express: express.Express;
  port: number;
  constructor(port: number) {
    this.express = express();
    this.port = port;
  }

  start() {
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(express.json());

    this.express.use((req, res, next) => {
      const path = req.path;
      const params = req.params;
      const body = req.body;
      // retrieve the results for the following combo
      res.send(`${path}, ${JSON.stringify(params)}, ${JSON.stringify(body)}`)
    });

    this.express.post("/");
    this.listen();
  }

  private listen() {
    this.express.listen(this.port, async () => {
      console.log(`listening on port ${this.port}`);
    });
  }
}
