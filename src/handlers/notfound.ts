import { Request, Response } from 'express'
import { notFoundTemplate } from '../messages/notfound'

/**
 * Terminal middleware that emits the diagnostic 404 when no record matched.
 *
 * Pulled out of `fetch.ts` so the recorder middleware (story 05) can slot in
 * between cache-miss and 404: in record/passthrough mode, `fetch` is mounted
 * with `onMiss: 'next'` and this handler sits at the end of the chain after
 * the recorder. In replay mode `fetch` calls back into this same handler
 * directly on miss, so the response body stays identical to the legacy path.
 */
export const notFound = (port: number, mockPath: string) =>
  (req: Request, res: Response): void => {
    const message = notFoundTemplate(req.path, req.query, req.body, req.method, port, mockPath)
    console.warn(message)
    res.status(404).send(message)
  }
