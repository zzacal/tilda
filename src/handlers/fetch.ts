import { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'
import { notFoundTemplate } from '../messages/notfound'

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
          const message = notFoundTemplate(path, params, body);
          console.log(message);
          res.status(404).send(message);
        }
      }
      return _next()
    }
