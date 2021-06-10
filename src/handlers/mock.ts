import { Request, Response } from 'express'
import Store from '../cacher/store'

export const mock = (store: Store) => (req: Request, res: Response) => {
  const result = store.add(req.body)
  res.send(result)
}
