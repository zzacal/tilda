import { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'
import { notFoundTemplate } from '../messages/notfound'
import delay from '../delay'
import substitute from '../templating'
import { MockBody } from '../types/mockRecord'

/**
 * Cheap gate so non-templated responses are returned untouched (story 12 AC4).
 * Walking and rebuilding an object body would change its identity even when
 * no `{{...}}` exists; this short-circuit keeps the pre-templating shape.
 */
const hasTemplate = (body: MockBody): boolean => {
  if (body === undefined || body === null) return false;
  if (typeof body === "string") return body.includes("{{");
  return JSON.stringify(body).includes("{{");
};

export const fetch =
  (store: Store, mockPath: string, port: number) =>
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      if (req.path === mockPath) {
        return _next()
      }

      const match = store.lookup(req.path, req.query, req.body, req.method);
      if (match) {
        const { response: mockResponse, pathParams } = match;
        for (const key in mockResponse.headers) {
          res.setHeader(key, mockResponse.headers[key]);
        }
        if(mockResponse.delay != null) {
          await delay(mockResponse.delay);
        }
        const body = hasTemplate(mockResponse.body)
          ? substitute(
              mockResponse.body,
              {
                request: {
                  params: pathParams,
                  query: req.query,
                  headers: req.headers,
                  body: req.body,
                },
              },
              `${req.method} ${req.originalUrl}`
            )
          : mockResponse.body;
        res.status(mockResponse.status).send(body);
      } else {
        const message = notFoundTemplate(req.path, req.query, req.body, req.method, port, mockPath);
        console.warn(message);
        res.status(404).send(message);
      }
    }
