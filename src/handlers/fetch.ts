import { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'
import { notFoundTemplate } from '../messages/notfound'
import delay from '../delay'

export const fetch =
  (store: Store, exclude: string) =>
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      if (req.path === exclude) {
        return _next()
      }

      const mockResponse = store.get(req.path, req.query, req.body);
      if (mockResponse) {
        for (const key in mockResponse.headers) {
          res.setHeader(key, mockResponse.headers[key]);
        }
        if(mockResponse.delay != null) {
          await delay(mockResponse.delay);
        }
        res.status(mockResponse.status).send(mockResponse.body);
      } else {
        const message = notFoundTemplate(req.path, req.query, req.body);
        console.warn(message);
        res.status(404).send(message);
      }
    }
