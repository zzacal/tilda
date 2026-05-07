import { NextFunction, Request, Response } from 'express'
import Store from '../cacher/store'
import delay from '../delay'
import substitute from '../templating'
import { MockBody } from '../types/mockRecord'
import { notFound } from './notfound'

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

/**
 * Cache-lookup middleware.
 *
 * - Cache hit: respond with the matched mock (templating, headers, delay).
 * - Cache miss + `onMiss === 'respond'` (default, replay mode): emit the
 *   diagnostic 404 via `notFound`. Behavior identical to the pre-refactor
 *   handler.
 * - Cache miss + `onMiss === 'next'` (record/passthrough mode): call
 *   `next()` so the recorder middleware downstream can forward upstream.
 *   The terminal `notFound` middleware sits at the end of that chain in
 *   case nothing else handles the request.
 */
export const fetch =
  (
    store: Store,
    mockPath: string,
    port: number,
    onMiss: 'respond' | 'next' = 'respond'
  ) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (req.path === mockPath) {
        return next()
      }

      const match = store.lookup(req.path, req.query, req.body, req.method);
      if (!match) {
        if (onMiss === 'next') return next();
        return notFound(port, mockPath)(req, res);
      }

      const { response: mockResponse, pathParams } = match;
      for (const key in mockResponse.headers) {
        res.setHeader(key, mockResponse.headers[key]);
      }
      if (mockResponse.delay != null) {
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
    }
