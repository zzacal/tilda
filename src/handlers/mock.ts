import { Request, Response } from "express";
import Store from "../cacher/store";

export const mock = (store: Store) => (req: Request, res: Response) => {
  const path = req.body.path;
  const params = req.body.params;
  const body = req.body.body;
  const val = req.body.val;
  const result = store.add(val, path, params, body);
  res.send(result);
};
