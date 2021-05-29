import { NextFunction, Request, Response } from "express";
import Store from "../cacher/store";

export const fetch =
  (store: Store) => (req: Request, res: Response, _next: NextFunction) => {
    const path = req.path;
    if(path != "/mock") {
      const params = req.query;
      const body = req.body;
      const record = store.get(path, params, body);

      res.send(record?.val);
    }
    _next();
  };
