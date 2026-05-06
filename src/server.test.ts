import { expect, test, describe, vi, beforeAll } from 'vitest'

import request from "supertest";
import Server from "./server";
import { ContentType, MockRecord } from "./types/mockRecord";

vi.spyOn(global.console, 'log').mockImplementation(() => { return });
vi.spyOn(global.console, "warn").mockImplementation(() => { return });

describe("server", () => {
  const server = new Server("/mock", 8882);
  const app = server.express;
  const expressServer = server.listen(8882);
  const jsonPath = "/user";
  const params = { id: "123" };
  const body = {};
  const jsonSetup: MockRecord = {
    request: {
      path: jsonPath,
      params,
      body,
    },
    response: {
      status: 200,
      body: { username: "Mitch Hedberg" },
      headers: {"Content-Type": ContentType.applicationJson, "hkey": "hval"},
    },
  };
  const xmlPath = "/xml";
  const xmlSetup = {
    request: {
      path: xmlPath,
      params: {},
      body: {},
    },
    response: {
      status: 200,
      body: '<note>\n<to s="d">Stokk</to>\n<from>Klimp</from>\n<heading>Reminder</heading>\n<body>You rock, yeah!</body>\n</note>',
      headers: { "Content-Type": ContentType.textXml, "hkey": "hval" },
    },
  };

  beforeAll(() => new Promise((done) => {
    expect(expressServer).not.toBe(null);

    request(app)
      .post("/mock")
      .send(jsonSetup)
      .expect(200)
      .then((response) => {
        expect(response.body.response).toEqual(jsonSetup.response);
        done();
      });

    request(app)
      .post("/mock")
      .send(xmlSetup)
      .expect(200)
      .then((response) => {
        expect(response.body.response).toEqual(xmlSetup.response);
        done();
      });
  }));

  test("fetch returns xml when response is xml", () => new Promise<void>((done) => {
    request(app)
      .get(xmlPath)
      .expect(200)
      .then((response) => {
        expect(response.text).toEqual(xmlSetup.response.body);
        expect(response.headers["content-type"]).toContain(ContentType.textXml);
        expect(response.headers["hkey"]).toContain("hval");
        done();
      });
  }));

  test("can mock and return an html response", () => new Promise<void>((done) => {
    const path = "/html";
    const setup = {
      request: {
        path: path,
        params: {},
        body: {},
      },
      response: {
        contentType: ContentType.textHtml,
        status: 200,
        body: `<!DOCTYPE html>
        <html lang="en">
            <body>
                <h1>Hello world</h1>
                <p>This is a simple html<p>
            </body>
        </html>`
      },
    };

    request(app)
      .post("/mock")
      .send(setup)
      .expect(200)
      .then((response) => {
        expect(response.body.response).toEqual(setup.response);
        done();
      });

    request(app)
      .get(path)
      .expect(200)
      .then((response) => {
        expect(response.text).toEqual(setup.response.body);
        expect(response.headers["content-type"]).toContain(ContentType.textHtml)
        done();
      });
  }));

  test("fetch returns val with the right path, params, and body", () => new Promise<void>((done) => {
    request(app)
      .get(`${jsonPath}?id=123`)
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(jsonSetup.response.body);
        done();
      });
  }));

  test("fetch returns empty response when val is not found", () => new Promise<void>((done) => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.spyOn(global.console, "warn").mockImplementation(() => { });
    request(app)
      .get(`${jsonPath}?id=NO_ID_HERE`)
      .set("Accept", "application/json")
      .expect(404)
      .then((response) => {
        expect(response.body).toEqual({});
        expect(console.warn).toBeCalled();
        done();
      });
  }))

  test("GET and DELETE on the same path respond independently", () => new Promise<void>((done) => {
    const path = "/method-aware";
    const getSetup: MockRecord = {
      request: { path, params: {}, body: {}, method: "GET" },
      response: {
        status: 200,
        body: "got it",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };
    const deleteSetup: MockRecord = {
      request: { path, params: {}, body: {}, method: "DELETE" },
      response: {
        status: 204,
        body: "",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };

    Promise.all([
      request(app).post("/mock").send(getSetup).expect(200),
      request(app).post("/mock").send(deleteSetup).expect(200),
    ]).then(() => Promise.all([
      request(app).get(path).expect(200),
      request(app).delete(path).expect(204),
    ])).then(([getRes, deleteRes]) => {
      expect(getRes.text).toBe("got it");
      expect(deleteRes.text).toBe("");
      done();
    });
  }));

  test("PATCH does not match a GET-only mock and 404s with the method in the message", () => new Promise<void>((done) => {
    // Story 02 invariant: a method-specific record only matches that method.
    // We use PATCH (not OPTIONS) because story 11 mounts the `cors` middleware
    // ahead of the fetch handler, which short-circuits OPTIONS with a 204.
    const path = "/get-only";
    const setup: MockRecord = {
      request: { path, params: {}, body: {}, method: "GET" },
      response: {
        status: 200,
        body: "ok",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };

    request(app)
      .post("/mock")
      .send(setup)
      .expect(200)
      .then(() => request(app).patch(path).expect(404))
      .then((response) => {
        expect(response.text).toContain("PATCH");
        expect(response.text).toContain(path);
        done();
      });
  }));

  test("a method-agnostic mock matches any incoming method", () => new Promise<void>((done) => {
    const path = "/anything";
    const setup: MockRecord = {
      request: { path, params: {}, body: {} },
      response: {
        status: 200,
        body: "wildcard",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };

    request(app)
      .post("/mock")
      .send(setup)
      .expect(200)
      .then(() => Promise.all([
        request(app).get(path).expect(200),
        request(app).put(path).expect(200),
      ]))
      .then(([getRes, putRes]) => {
        expect(getRes.text).toBe("wildcard");
        expect(putRes.text).toBe("wildcard");
        done();
      });
  }));

  test.each([
    { method: "get" as const, path: "/curl-roundtrip-get" },
    { method: "delete" as const, path: "/curl-roundtrip-delete" },
  ])("the curl in the 404 body, parsed and POSTed back, registers a working mock ($method)", ({ method, path }) => new Promise<void>((done) => {
    request(app)[method](path)
      .expect(404)
      .then((notFoundRes) => {
        const match = notFoundRes.text.match(/--data-raw '([\s\S]*?)'/);
        if (!match) throw new Error(`no --data-raw payload in 404 body:\n${notFoundRes.text}`);
        const setup: MockRecord = JSON.parse(match[1]);

        // Sanity-check that the suggested record is actually method-specific
        // and shaped like a MockRecord — the whole point of story 03.
        expect(setup.request.method).toBe(method.toUpperCase());
        expect(setup.response.status).toBe(200);
        expect(setup.response.headers["Content-Type"]).toBe(ContentType.applicationJson);

        return request(app)
          .post("/mock")
          .send(setup)
          .expect(200)
          .then(() => request(app)[method](path).expect(200));
      })
      .then((replayRes) => {
        expect(replayRes.body).toEqual({});
        done();
      });
  }));

  test("re-POST with the same path overwrites the response (story 04)", () => new Promise<void>((done) => {
    const path = "/repost-api";
    // Both POSTs omit `params` and `body` — the runtime shape that JSON-parsed
    // minimal seeds and quick `curl` POSTs actually produce. Before story 04
    // the second add silently duplicated and v1 kept winning.
    const v1 = {
      request: { path },
      response: {
        status: 200,
        body: "v1",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };
    const v2 = {
      request: { path },
      response: {
        status: 200,
        body: "v2",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };

    request(app).post("/mock").send(v1).expect(200)
      .then(() => request(app).post("/mock").send(v2).expect(200))
      .then(() => request(app).get(path).expect(200))
      .then((res) => {
        expect(res.text).toBe("v2");
        done();
      });
  }));

  test("fetch is delayed when delay is set", () => new Promise<void>((done) => {

    request(app)
      .post("/mock")
      .send({
        request: {
          path: "/delayed",
          params: {},
          body: {},
        },
        response: {
          status: 200,
          body: "I'm delayed",
          headers: { "Content-Type": ContentType.textXml, "hkey": "hval" },
          delay: 50,
        },
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toMatchObject({"response": {"delay": 50}});
      });

    request(app)
      .get("/delayed")
      .expect(200)
      .then((response) => {
        expect(response.text).toEqual("I'm delayed");
        expect(response.headers["content-type"]).toContain(ContentType.textXml);
        expect(response.headers["hkey"]).toContain("hval");
        done();
      });
  }));
});

describe("namespaced control endpoint (story 07)", () => {
  test("a user-registered /mock mock is served when the control endpoint lives at /__tilda/mock", async () => {
    // Regression: with the old default `MOCK_PATH=/mock` the catch-all
    // short-circuited any GET /mock to the registration handler, so an
    // upstream API that exposed /mock could not be mocked.
    const app = new Server("/__tilda/mock", 0).express;
    const upstreamMock: MockRecord = {
      request: { path: "/mock", params: {}, body: {}, method: "GET" },
      response: {
        status: 200,
        body: "upstream-mock",
        headers: { "Content-Type": ContentType.textPlain },
      },
    };

    await request(app).post("/__tilda/mock").send(upstreamMock).expect(200);

    const res = await request(app).get("/mock").expect(200);
    expect(res.text).toBe("upstream-mock");
  });
});

describe("CORS (story 11)", () => {
  // Each scenario gets its own server so the cors config is isolated.
  // We rely on supertest's app-binding (no listen()) to avoid port collisions.
  const mockedPath = "/cors-target";
  const mockedRecord: MockRecord = {
    request: { path: mockedPath, params: {}, body: {}, method: "GET" },
    response: {
      status: 200,
      body: "served",
      headers: { "Content-Type": ContentType.textPlain },
    },
  };

  test("OPTIONS preflight is short-circuited with 204 + permissive CORS headers", async () => {
    const app = new Server("/mock", 0).express;
    await request(app).post("/mock").send(mockedRecord).expect(200);

    const res = await request(app)
      .options(mockedPath)
      .set("Origin", "https://app.example")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);

    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toBe("*");
    expect(res.headers["access-control-allow-headers"]).toBe("*");
    // Critically, the GET mock body must not leak through the preflight.
    expect(res.text).not.toContain("served");
  });

  test("GET response includes Access-Control-Allow-Origin: * by default", async () => {
    const app = new Server("/mock", 0).express;
    await request(app).post("/mock").send(mockedRecord).expect(200);

    const res = await request(app)
      .get(mockedPath)
      .set("Origin", "https://app.example")
      .expect(200);

    expect(res.text).toBe("served");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  test("a mock-supplied Access-Control-Allow-Origin overrides the default", async () => {
    const app = new Server("/mock", 0).express;
    const overrideRecord: MockRecord = {
      request: { path: "/cors-override", params: {}, body: {}, method: "GET" },
      response: {
        status: 200,
        body: "strict",
        // Lowercase header key — the override path must work regardless of
        // casing, since Node's res.setHeader is case-insensitive.
        headers: {
          "Content-Type": ContentType.textPlain,
          "access-control-allow-origin": "https://other.example",
        },
      },
    };
    await request(app).post("/mock").send(overrideRecord).expect(200);

    const res = await request(app)
      .get("/cors-override")
      .set("Origin", "https://app.example")
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe("https://other.example");
  });

  test("CORS_DISABLE skips the middleware so preflight gets no CORS headers", async () => {
    const app = new Server("/mock", 0, undefined, { origin: "*", disabled: true }).express;
    await request(app).post("/mock").send(mockedRecord).expect(200);

    const res = await request(app)
      .options(mockedPath)
      .set("Origin", "https://app.example")
      .set("Access-Control-Request-Method", "GET");

    // Without the cors middleware, OPTIONS falls through to the fetch handler,
    // which has no method-agnostic match for a GET-only mock and 404s.
    expect(res.status).toBe(404);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-methods"]).toBeUndefined();
  });

  test("CORS_ORIGIN reflects a specific origin on responses", async () => {
    const allowed = "https://app.example";
    const app = new Server("/mock", 0, undefined, { origin: allowed, disabled: false }).express;
    await request(app).post("/mock").send(mockedRecord).expect(200);

    const res = await request(app)
      .get(mockedPath)
      .set("Origin", allowed)
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe(allowed);
  });
});
