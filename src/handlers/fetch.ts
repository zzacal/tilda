import { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'

export const fetch =
  (store: Store, exclude: string) =>
    (req: Request, res: Response, _next: NextFunction) => {
      const path = req.path
      if (path !== exclude) {
        const params = req.query
        const body = req.body
        const mockResponse = store.get(path, params, body)
        if (mockResponse) {
          res.status(mockResponse.status).send(mockResponse.body)
        } else {
          res.sendStatus(404)
        }
      }
      return _next()
    }
