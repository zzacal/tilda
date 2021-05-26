import { NextFunction, Request, Response } from "express";
import Store from "../cacher/store";

export const fetch =
  (store: Store) => (req: Request, res: Response, _next: NextFunction) => {
    const path = req.path;
    const params = req.query;
    const body = req.body;
    const val = store.get(path, params, body);
    console.log(`${path}, ${JSON.stringify(params)}, ${JSON.stringify(body)}`);

    res.send(val);
  };
