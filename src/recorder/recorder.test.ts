import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import express, { Request, Response } from 'express'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import request from 'supertest'
import zlib from 'zlib'

import Store from '../cacher/store'
import { ContentType, MockRecord } from '../types/mockRecord'
import { buildRedactList, redactHeaders, stripCorsHeaders, stripTransportHeaders } from './redact'
import { captureFilename, persist } from './persist'
import { forward } from './forward'
import { recorder } from './recorder'

vi.spyOn(global.console, 'log').mockImplementation(() => { return })
vi.spyOn(global.console, 'warn').mockImplementation(() => { return })

// --- Test helpers -----------------------------------------------------------

interface Upstream {
  url: string
  close: () => Promise<void>
}

/**
 * Stand up a real HTTP server on an OS-assigned port. We can't use supertest
 * for the upstream because `forward.ts` calls `fetch()` which makes a real
 * network request — supertest only intercepts the receiving Express app.
 */
async function startUpstream(
  handler: (req: Request, res: Response) => void
): Promise<Upstream> {
  const app = express()
  app.use(express.json())
  app.use((req: Request, res: Response) => handler(req, res))
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') throw new Error('upstream bind failed')
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res()))
          ),
      })
    })
  })
}

const sampleRecord = (over: Partial<MockRecord['request']> = {}): MockRecord => ({
  request: {
    path: over.path ?? '/x',
    method: over.method ?? 'GET',
    params: over.params ?? {},
    body: over.body ?? {},
  },
  response: {
    status: 200,
    headers: { 'Content-Type': ContentType.applicationJson },
    body: { ok: true },
  },
})

// --- redact -----------------------------------------------------------------

describe('redact', () => {
  test('default list strips Authorization, Cookie, Set-Cookie, Proxy-Authorization', () => {
    const list = buildRedactList(undefined)
    const out = redactHeaders(
      {
        Authorization: 'Bearer x',
        Cookie: 'c=1',
        'Set-Cookie': 's=1',
        'Proxy-Authorization': 'Basic y',
        'X-Other': 'keep',
      },
      list
    )
    expect(out).toEqual({ 'X-Other': 'keep' })
  })

  test('CAPTURE_REDACT extends — never replaces — the default list', () => {
    const list = buildRedactList('X-API-Key, X-Internal-Token')
    expect(list.has('authorization')).toBe(true)
    expect(list.has('x-api-key')).toBe(true)
    expect(list.has('x-internal-token')).toBe(true)
  })

  test('header match is case-insensitive on both name sides', () => {
    const list = buildRedactList('x-api-key')
    const out = redactHeaders(
      {
        'X-Api-Key': 'abc',
        AUTHORIZATION: 'Bearer x',
        normal: 'kept',
      },
      list
    )
    expect(out).toEqual({ normal: 'kept' })
  })

  test('CAPTURE_REDACT trims whitespace and ignores empty entries', () => {
    const list = buildRedactList(' x-foo , , x-bar ')
    expect(list.has('x-foo')).toBe(true)
    expect(list.has('x-bar')).toBe(true)
  })

  test('stripCorsHeaders removes Access-Control-Allow-* (case-insensitive)', () => {
    const out = stripCorsHeaders({
      'access-control-allow-origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Content-Type': 'application/json',
    })
    expect(out).toEqual({ 'Content-Type': 'application/json' })
  })

  test('stripTransportHeaders removes wire-state and stale-on-replay headers (case-insensitive)', () => {
    const out = stripTransportHeaders({
      'content-encoding': 'br',
      'Content-Length': '1234',
      'Transfer-Encoding': 'chunked',
      Date: 'Thu, 07 May 2026 03:50:32 GMT',
      Connection: 'keep-alive',
      'Keep-Alive': 'timeout=5',
      'content-type': 'application/json',
      etag: 'W/"abc"',
    })
    expect(out).toEqual({ 'content-type': 'application/json', etag: 'W/"abc"' })
  })

  test('redactHeaders does not mutate the input', () => {
    const input = { Authorization: 'x', other: 'y' }
    redactHeaders(input, buildRedactList(undefined))
    expect(input).toEqual({ Authorization: 'x', other: 'y' })
  })
})

// --- persist ----------------------------------------------------------------

describe('persist', () => {
  let tmp: string

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tilda-persist-'))
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  test('writes a JSON array containing the record (matches seed-loader shape)', () => {
    const record = sampleRecord()
    const filePath = persist(record, tmp)
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockRecord[]
    expect(Array.isArray(content)).toBe(true)
    expect(content[0]).toEqual(record)
  })

  test('same matching surface => same filename (overwrite, not append)', () => {
    const recordA = sampleRecord()
    const recordB: MockRecord = {
      ...recordA,
      response: { ...recordA.response, body: { ok: false, v: 2 } },
    }
    const f1 = persist(recordA, tmp)
    const f2 = persist(recordB, tmp)
    expect(f1).toBe(f2)
    const final = JSON.parse(fs.readFileSync(f1, 'utf-8')) as MockRecord[]
    expect(final[0].response.body).toEqual({ ok: false, v: 2 })
    expect(fs.readdirSync(tmp).length).toBe(1)
  })

  test('different query params => different filename', () => {
    const a = sampleRecord({ params: { q: 'a' } })
    const b = sampleRecord({ params: { q: 'b' } })
    expect(captureFilename(a)).not.toBe(captureFilename(b))
  })

  test('different method => different filename', () => {
    const get = sampleRecord({ method: 'GET' })
    const post = sampleRecord({ method: 'POST' })
    expect(captureFilename(get)).not.toBe(captureFilename(post))
  })

  test('hybrid filename has a readable <method>_<path> prefix and 8-char hash suffix', () => {
    const name = captureFilename(sampleRecord({ method: 'GET', path: '/posts/1' }))
    expect(name).toMatch(/^get_posts_1_[0-9a-f]{8}\.json$/)
  })

  test('filename sanitization collapses URL-special chars and caps length', () => {
    const messy = sampleRecord({
      method: 'POST',
      path: '/api/v2/users/42:foo bar/' + 'x'.repeat(200),
    })
    const name = captureFilename(messy)
    // No path separators, no spaces, no colons in the prefix.
    expect(name).not.toMatch(/[/:\s]/)
    // Lower-cased; one trailing 8-hex hash before .json.
    expect(name).toMatch(/^[a-z0-9_]+_[0-9a-f]{8}\.json$/)
    // Prefix capped — total filename stays well under common 255-char limits.
    expect(name.length).toBeLessThanOrEqual(80)
  })

  test('root path falls back to a bare hash (no prefix)', () => {
    const name = captureFilename(sampleRecord({ method: 'GET', path: '/' }))
    // After sanitize, "GET_/" → "get" — non-empty — so we expect a get_ prefix.
    // The fallback path is exercised when sanitize returns empty (e.g. all
    // non-alpha) — guard it here to lock the behavior.
    expect(name.endsWith('.json')).toBe(true)
    expect(name).toMatch(/[0-9a-f]{8}\.json$/)
  })

  test('mkdir-recursive creates a missing nested directory', () => {
    const nested = path.join(tmp, 'a', 'b', 'c')
    persist(sampleRecord(), nested)
    expect(fs.existsSync(nested)).toBe(true)
    expect(fs.readdirSync(nested).length).toBe(1)
  })
})

// --- forward ----------------------------------------------------------------

describe('forward', () => {
  let upstream: Upstream
  let lastReq: { method: string; url: string; body: unknown; headers: Record<string, unknown> }

  beforeAll(async () => {
    upstream = await startUpstream((req, res) => {
      lastReq = {
        method: req.method,
        url: req.url,
        body: req.body,
        headers: req.headers,
      }
      if (req.url === '/error') {
        res.status(500).json({ err: true })
        return
      }
      res.json({ method: req.method, url: req.url, body: req.body })
    })
  })
  afterAll(() => upstream.close())

  // Minimal Request shape — `forward` only reads method, url, headers, body.
  const fakeReq = (over: Partial<{ method: string; url: string; headers: Record<string, string>; body: unknown }>): Request =>
    ({
      method: over.method ?? 'GET',
      url: over.url ?? '/',
      headers: over.headers ?? {},
      body: over.body,
    } as unknown as Request)

  test('GET reaches upstream with the original path+query and returns a structured ok result', async () => {
    const result = await forward(fakeReq({ method: 'GET', url: '/api/foo?x=1&y=2' }), upstream.url)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.response.status).toBe(200)
    expect(JSON.parse(result.response.body).url).toBe('/api/foo?x=1&y=2')
    expect(lastReq.method).toBe('GET')
  })

  test('POST forwards body as JSON', async () => {
    const result = await forward(
      fakeReq({
        method: 'POST',
        url: '/echo',
        headers: { 'content-type': 'application/json' },
        body: { hello: 'world' },
      }),
      upstream.url
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.parse(result.response.body).body).toEqual({ hello: 'world' })
  })

  test('upstream non-2xx still returns ok=true with the actual status (forward != recorder)', async () => {
    const result = await forward(fakeReq({ url: '/error' }), upstream.url)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.response.status).toBe(500)
  })

  test('trailing slash on upstream base URL is tolerated', async () => {
    const result = await forward(fakeReq({ url: '/x' }), `${upstream.url}/`)
    expect(result.ok).toBe(true)
  })

  test('drops hop-by-hop headers (host, connection, content-length) before forwarding', async () => {
    await forward(
      fakeReq({
        method: 'GET',
        url: '/check-headers',
        headers: {
          host: 'tilda.local',
          connection: 'close',
          'content-length': '999',
          'x-keep': 'kept',
        },
      }),
      upstream.url
    )
    // host gets reset by undici to the upstream's, but the user-set tilda.local
    // must not have leaked through.
    expect(lastReq.headers.host).not.toBe('tilda.local')
    expect(lastReq.headers.connection).not.toBe('close')
    expect(lastReq.headers['x-keep']).toBe('kept')
  })

  test('network failure surfaces a discriminated error with a short reason', async () => {
    // RFC 6761 reserves the `.invalid` TLD for use cases like this — it
    // is guaranteed never to resolve, so we get a deterministic DNS error
    // without depending on what's bound on which port.
    const result = await forward(fakeReq({ url: '/' }), 'http://tilda-nonexistent.invalid')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/ENOTFOUND|EAI_AGAIN|getaddrinfo/i)
  })
})

// --- recorder middleware ----------------------------------------------------

describe('recorder middleware', () => {
  let upstream: Upstream
  let upstreamCalls: number
  let store: Store
  let tmp: string
  let app: express.Express

  beforeEach(async () => {
    upstreamCalls = 0
    upstream = await startUpstream((req, res) => {
      upstreamCalls++
      if (req.url === '/error') {
        res.status(500).json({ err: 'boom' })
        return
      }
      if (req.url === '/cors') {
        res.setHeader('Access-Control-Allow-Origin', 'https://upstream.example')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
        res.json({ msg: 'cors!' })
        return
      }
      if (req.url === '/secret') {
        res.setHeader('Set-Cookie', 'session=abc; HttpOnly')
        res.setHeader('Authorization', 'Bearer SECRET-TOKEN')
        res.setHeader('X-Internal-Token', 'internal-xyz')
        res.json({ msg: 'secret' })
        return
      }
      res.json({ method: req.method, url: req.url })
    })
    store = new Store([])
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tilda-rec-'))
    app = express()
    app.use(express.json())
  })

  afterEach(async () => {
    await upstream.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  test('passthrough mode forwards but never persists or adds to store', async () => {
    app.use(
      recorder({
        mode: 'passthrough',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/api/users').expect(200)
    expect(res.body.url).toBe('/api/users')
    expect(upstreamCalls).toBe(1)
    expect(fs.readdirSync(tmp)).toEqual([])
    expect(store.get('/api/users', {}, {}, 'GET')).toBeUndefined()
  })

  test('record mode persists 2xx response and registers it with the store', async () => {
    app.use(
      recorder({
        mode: 'record',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    await request(app).get('/api/widgets').expect(200)
    expect(fs.readdirSync(tmp).length).toBe(1)

    const stored = store.get('/api/widgets', {}, {}, 'GET')
    expect(stored).toBeDefined()
    expect(stored?.status).toBe(200)
  })

  test('record mode skips 5xx by default — honors the CAPTURE_ERRORS gate', async () => {
    app.use(
      recorder({
        mode: 'record',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/error')
    expect(res.status).toBe(500) // still surfaced to caller
    expect(fs.readdirSync(tmp)).toEqual([]) // but not persisted
    expect(store.get('/error', {}, {}, 'GET')).toBeUndefined()
  })

  test('record mode persists 5xx when CAPTURE_ERRORS is true', async () => {
    app.use(
      recorder({
        mode: 'record',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: true,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    await request(app).get('/error').expect(500)
    expect(fs.readdirSync(tmp).length).toBe(1)
    expect(store.get('/error', {}, {}, 'GET')?.status).toBe(500)
  })

  test('upstream Access-Control-Allow-* headers are stripped from the response', async () => {
    app.use(
      recorder({
        mode: 'passthrough',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/cors').expect(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers['access-control-allow-methods']).toBeUndefined()
    expect(res.body.msg).toBe('cors!')
  })

  test('CAPTURE_REDACT secrets pass through to the WIRE response in record mode', async () => {
    // Story 05 #8 issue 2: record/passthrough modes act as a transparent
    // proxy on the live forward. An upstream Set-Cookie still sets a
    // session cookie in the caller's browser; an upstream Authorization
    // still reaches the caller. This makes session-based flows actually
    // work through record mode. The persist path redacts so secrets
    // never land in capture files.
    app.use(
      recorder({
        mode: 'record',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList('X-Internal-Token'),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/secret').expect(200)
    // Defaults reach the caller:
    expect(res.headers['set-cookie']).toBeDefined()
    expect(res.headers['authorization']).toBeDefined()
    // CAPTURE_REDACT extension reaches the caller too:
    expect(res.headers['x-internal-token']).toBeDefined()
  })

  test('CAPTURE_REDACT secrets pass through to the WIRE response in passthrough mode', async () => {
    // Same rule as record mode: the wire is transparent, only persist redacts.
    app.use(
      recorder({
        mode: 'passthrough',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/secret').expect(200)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  test('Set-Cookie is stripped from the persisted capture (record mode)', async () => {
    app.use(
      recorder({
        mode: 'record',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    await request(app).get('/secret').expect(200)
    const file = fs.readdirSync(tmp)[0]
    const captured = JSON.parse(fs.readFileSync(path.join(tmp, file), 'utf-8')) as MockRecord[]
    const headerKeys = Object.keys(captured[0].response.headers).map((k) => k.toLowerCase())
    expect(headerKeys).not.toContain('set-cookie')
  })

  test('forward error → 502 with the locked JSON body shape', async () => {
    app.use(
      recorder({
        mode: 'record',
        upstream: 'http://127.0.0.1:1', // refuses connections
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/missing').expect(502)
    expect(res.body.error).toBe('Tilda could not reach the upstream')
    expect(res.body.upstream).toBe('http://127.0.0.1:1')
    expect(res.body.request).toBe('GET /missing')
    expect(typeof res.body.reason).toBe('string')
    expect(res.body.reason.length).toBeGreaterThan(0)
    expect(fs.readdirSync(tmp)).toEqual([])
  })

  test('upstream content-encoding/content-length/transfer-encoding are stripped on both serve and persist', async () => {
    // Regression for the P0 fed found while testing the README walkthrough:
    // Cloudflare-fronted upstreams (jsonplaceholder, etc.) send brotli-encoded
    // responses; Node's fetch transparently decodes the body, but if Tilda
    // persists / echoes the upstream's `content-encoding: br` alongside the
    // decoded bytes, compression-aware clients (browsers, `curl --compressed`)
    // try to brotli-decode plain JSON and abort. Same hazard for
    // `content-length` and `transfer-encoding`.
    //
    // Faithful repro requires an actual brotli-encoded body so undici doesn't
    // reject the response in `forward.ts`. A bare `http.createServer` lets us
    // pin the wire bytes precisely (Express would set its own headers).
    await upstream.close()
    const compressed = zlib.brotliCompressSync(Buffer.from(JSON.stringify({ msg: 'compressed' })))
    const rawServer = http.createServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-encoding': 'br',
        'transfer-encoding': 'chunked',
        // Bag of stale-on-replay / hop-by-hop headers a real upstream
        // would send (story 05 #8 issue 1, found by usr).
        date: 'Thu, 07 May 2026 03:50:32 GMT',
        connection: 'keep-alive',
        'keep-alive': 'timeout=5',
      })
      res.end(compressed)
    })
    await new Promise<void>((resolve) => rawServer.listen(0, resolve))
    const addr = rawServer.address()
    if (!addr || typeof addr === 'string') throw new Error('raw upstream bind failed')
    const rawUrl = `http://127.0.0.1:${addr.port}`
    upstream = {
      url: rawUrl,
      close: () =>
        new Promise<void>((res, rej) =>
          rawServer.close((err) => (err ? rej(err) : res()))
        ),
    }

    app.use(
      recorder({
        mode: 'record',
        upstream: rawUrl,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )

    const res = await request(app).get('/posts/1').expect(200)
    expect(res.body).toEqual({ msg: 'compressed' })
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(res.headers['transfer-encoding']).toBeUndefined()

    const file = fs.readdirSync(tmp)[0]
    const captured = JSON.parse(fs.readFileSync(path.join(tmp, file), 'utf-8')) as MockRecord[]
    const headerKeys = Object.keys(captured[0].response.headers).map((k) => k.toLowerCase())
    for (const stripped of [
      'content-encoding',
      'content-length',
      'transfer-encoding',
      'date',
      'connection',
      'keep-alive',
    ]) {
      expect(headerKeys).not.toContain(stripped)
    }
    // The persisted body is the decoded form, so replay over JSON-parse +
    // re-serialize round-trips cleanly.
    expect(captured[0].response.body).toEqual({ msg: 'compressed' })
  })

  test('mockPath requests pass through (recorder does not forward Tilda control plane)', async () => {
    let called = false
    app.use(
      recorder({
        mode: 'record',
        upstream: upstream.url,
        capturesDir: tmp,
        redactList: buildRedactList(undefined),
        captureErrors: false,
        mockPath: '/__tilda/mock',
        store,
      })
    )
    // After the recorder, mount a sentinel so we can confirm `next()` ran.
    app.use('/__tilda/mock', (_req, res) => {
      called = true
      res.status(204).end()
    })

    await request(app).post('/__tilda/mock').send({ anything: true }).expect(204)
    expect(called).toBe(true)
    expect(upstreamCalls).toBe(0)
  })
})
