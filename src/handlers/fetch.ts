import { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'

export const fetch =
  (store: Store, exclude: String) =>
    (req: Request, res: Response, _next: NextFunction) => {
      const path = req.path
      if (path != exclude) {
        const params = req.query
        const body = req.body
        const mockResponse = store.get(path, params, body)

        res.status(mockResponse.status).send(mockResponse.body)
      }
      _next()
    }
