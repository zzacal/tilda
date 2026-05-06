import { vi, test, describe, expect } from "vitest";
import { MockBody, MockParams, MockRecord, MockRequest, MockResponse, ContentType } from "../types/mockRecord";
import Store from "./store";
import { fromFile } from "../seeding/seed-files";

vi.spyOn(global.console, 'log').mockImplementation(() => { return });
describe("cache store", () => {
  const store = new Store();
  const rootPath = "/";
  const someParams = {theParams: "some params"};
  const someBody = "some body";

  test("can be seeded", () => {
    const seed: MockRecord[] = [{ 
      "request": {"path": "/", "params": {type: "params"}, "body": "body", },
      "response": {
        "headers": {"Content-Type": ContentType.applicationJson, "hkey": "hval"}, "status": 200, "body": "some other body"
      } }]
    const seededStore = new Store(seed);
    const result = seededStore.get("/", {type: "params"}, "body");
    expect(result?.body).toBe("some other body")
  })

  test("returns undefined when no setup is found", () => {
    const noResponse = store.get(rootPath, someParams, someBody);
    expect(noResponse).toBeUndefined();
  })

  test("can store text response", () => {
    const setupA: MockRecord = {
      request: {
        path: rootPath,
        params: someParams,
        body: someBody,
      },
      response: {
        headers: { "Content-Type": ContentType.applicationJson, hkey: "hval" },
        status: 200,
        body: "initial body",
      },
    };

    store.add(setupA);
    const responseA = store.get(rootPath, someParams, someBody);
    expect(responseA).toEqual(setupA.response);
  });

  test("can overwrite the response on a request", () => {
    const setupB: MockRecord = {
      request: {
        path: rootPath,
        params: someParams,
        body: someBody,
      },
      response: {
        headers: { "Content-Type": ContentType.applicationJson, hkey: "hval" },
        status: 200,
        body: "some other body",
      },
    };

    store.add(setupB);
    const responseB = store.get(rootPath, someParams, someBody);
    expect(responseB).toEqual(setupB.response);
  });

  test("finds a request with undefined params and body", () => {
    const path = "/undefined_bodies";
    const setupB: MockRecord = {
      request: {
        path,
        params: undefined,
        body: undefined,
      },
      response: {
        headers: { "Content-Type": ContentType.applicationJson, hkey: "hval" },
        status: 200,
        body: "some other body",
      },
    };

    store.add(setupB);
    const responseB = store.get(path);
    expect(responseB).toEqual(setupB.response);
  });

  test("can store a response objects", () => {
    const jsonPath = "/json"
    const setup: MockRecord = {
      request: {
        path: jsonPath,
        params: {},
        body: {},
      },
      response: {
        headers: { "Content-Type": ContentType.applicationJson, hkey: "hval" },
        status: 200,
        body: { "Style": { "Dark": "Sleek", "Types": ["Glove", "Shrowd"] } },
      },
    };

    store.add(setup);
    const result = store.get(jsonPath, {}, {});
    expect(result?.body).toEqual(setup.response.body);
  })

  test("can store a xml response", () => {
    const xmlPath = "/xml";
    const setup: MockRecord = {
      request: {
        path: xmlPath,
        params: {},
        body: {},
      },
      response: {
        headers: { "Content-Type": ContentType.textXml, hkey: "hval" },
        status: 200,
        body: '<note>\n<to s="d">Stokk</to>\n<from>Klimp</from>\n<heading>Reminder</heading>\n<body>You rock, yeah!</body>\n</note>',
      },
    };
    
    store.add(setup);
    const response = store.get(xmlPath, {}, {});
    expect(response?.body).toBeDefined();
  });
  
  test('can store an html response', () => {
    const htmlPath = "html";
    const setup: MockRecord = {
      request: {
        path: htmlPath,
        params: {},
        body: {},
      },
      response: {
        headers: { "Content-Type": ContentType.textHtml, hkey: "hval" },
        status: 200,
        body: `<!DOCTYPE html>
          <html lang="en">
              <body>
                  <h1>Hello world!</h1>
                  <p>This is a test html page</p>
              </body>
          </html>`,
      },
    };
    
    store.add(setup);
    const result = store.get(htmlPath, {}, {});

    expect(result?.headers?.["Content-Type"]).toBe(ContentType.textHtml);
    expect(result?.body).toBeDefined();
  });


  test("can get a response objects using partial match", () => {
    const jsonPath = "/json";
    const setup: MockRecord = {
      request: {
        path: jsonPath,
        params: {},
        body: { knownField: "known at setup" },
      },
      response: {
        headers: { "Content-Type": ContentType.applicationJson, hkey: "hval" },
        status: 200,
        body: { congratulations: "You found a partial match" },
      },
    };

    store.add(setup);
    const result = store.get(jsonPath, {}, { knownField: "known at setup", someDynamicField: "not known at setup" });
    expect(result).toEqual(setup.response);
  });
});

describe("specificity-based matching", () => {
  const headers = { "Content-Type": ContentType.applicationJson };

  test("more specific params win even when registered after wildcard params", () => {
    const localStore = new Store([
      {
        request: { path: "/user/007", params: {}, body: {} },
        response: { headers, status: 200, body: { license: "toDrive" } },
      },
      {
        request: { path: "/user/007", params: { secret: "true" }, body: {} },
        response: { headers, status: 200, body: { license: "toKill" } },
      },
    ]);

    expect(localStore.get("/user/007", { secret: "true" }, {})?.body).toEqual({
      license: "toKill",
    });
    expect(localStore.get("/user/007", {}, {})?.body).toEqual({
      license: "toDrive",
    });
    expect(localStore.get("/user/007", { other: "val" }, {})?.body).toEqual({
      license: "toDrive",
    });
  });

  test("more specific params win when registered before wildcard params", () => {
    const localStore = new Store([
      {
        request: { path: "/user/007", params: { secret: "true" }, body: {} },
        response: { headers, status: 200, body: { license: "toKill" } },
      },
      {
        request: { path: "/user/007", params: {}, body: {} },
        response: { headers, status: 200, body: { license: "toDrive" } },
      },
    ]);

    expect(localStore.get("/user/007", { secret: "true" }, {})?.body).toEqual({
      license: "toKill",
    });
    expect(localStore.get("/user/007", {}, {})?.body).toEqual({
      license: "toDrive",
    });
  });

  test("body specificity counts toward the score", () => {
    const localStore = new Store([
      {
        request: { path: "/order", params: {}, body: {} },
        response: { headers, status: 200, body: "wildcard" },
      },
      {
        request: { path: "/order", params: {}, body: { type: "premium" } },
        response: { headers, status: 200, body: "premium" },
      },
    ]);

    expect(localStore.get("/order", {}, { type: "premium", id: 1 })?.body).toBe(
      "premium"
    );
    expect(localStore.get("/order", {}, { id: 1 })?.body).toBe("wildcard");
  });

  test("ties are broken by registration order (first wins)", () => {
    const localStore = new Store([
      {
        request: { path: "/x", params: { a: "1" }, body: {} },
        response: { headers, status: 200, body: "first" },
      },
      {
        request: { path: "/x", params: { b: "2" }, body: {} },
        response: { headers, status: 200, body: "second" },
      },
    ]);

    expect(localStore.get("/x", { a: "1", b: "2" }, {})?.body).toBe("first");
  });

  test("the documented sample-seeds/user.json behavior holds", () => {
    const seed = fromFile("./documentation/sample-seeds/user.json");
    expect(seed.length).toBeGreaterThan(0);
    const localStore = new Store(seed);

    expect(
      (localStore.get("/user/007", { secret: "true" }, {})?.body as Record<string, string>)
        .license
    ).toBe("toKill");
    expect(
      (localStore.get("/user/007", {}, {})?.body as Record<string, string>).license
    ).toBe("toDrive");
  });
});

describe("method-aware matching", () => {
  const headers = { "Content-Type": ContentType.applicationJson };

  test("GET and DELETE on the same path coexist and respond independently", () => {
    const localStore = new Store([
      {
        request: { path: "/users", params: {}, body: {}, method: "GET" },
        response: { headers, status: 200, body: "list" },
      },
      {
        request: { path: "/users", params: {}, body: {}, method: "DELETE" },
        response: { headers, status: 204, body: "" },
      },
    ]);

    expect(localStore.get("/users", {}, {}, "GET")?.body).toBe("list");
    expect(localStore.get("/users", {}, {}, "DELETE")?.status).toBe(204);
  });

  test("a record with no method matches any request method", () => {
    const localStore = new Store([
      {
        request: { path: "/anything", params: {}, body: {} },
        response: { headers, status: 200, body: "wildcard" },
      },
    ]);

    expect(localStore.get("/anything", {}, {}, "GET")?.body).toBe("wildcard");
    expect(localStore.get("/anything", {}, {}, "POST")?.body).toBe("wildcard");
    expect(localStore.get("/anything", {}, {}, "PATCH")?.body).toBe("wildcard");
  });

  test("a method-specific record beats a method-agnostic one for the same path", () => {
    const localStore = new Store([
      {
        request: { path: "/users", params: {}, body: {} },
        response: { headers, status: 200, body: "any" },
      },
      {
        request: { path: "/users", params: {}, body: {}, method: "POST" },
        response: { headers, status: 201, body: "posted" },
      },
    ]);

    expect(localStore.get("/users", {}, {}, "POST")?.body).toBe("posted");
    expect(localStore.get("/users", {}, {}, "GET")?.body).toBe("any");
  });

  test("OPTIONS does not match a GET-only mock", () => {
    const localStore = new Store([
      {
        request: { path: "/users", params: {}, body: {}, method: "GET" },
        response: { headers, status: 200, body: "list" },
      },
    ]);

    expect(localStore.get("/users", {}, {}, "OPTIONS")).toBeUndefined();
    expect(localStore.get("/users", {}, {}, "GET")?.body).toBe("list");
  });

  test("method matching is case-insensitive", () => {
    const localStore = new Store([
      {
        request: { path: "/users", params: {}, body: {}, method: "get" },
        response: { headers, status: 200, body: "list" },
      },
    ]);

    expect(localStore.get("/users", {}, {}, "GET")?.body).toBe("list");
    expect(localStore.get("/users", {}, {}, "Get")?.body).toBe("list");
  });

  test("add does not overwrite a method-agnostic record with a method-specific one", () => {
    const localStore = new Store();
    localStore.add({
      request: { path: "/users", params: {}, body: {} },
      response: { headers, status: 200, body: "any" },
    });
    localStore.add({
      request: { path: "/users", params: {}, body: {}, method: "GET" },
      response: { headers, status: 200, body: "list" },
    });

    expect(localStore.get("/users", {}, {}, "GET")?.body).toBe("list");
    expect(localStore.get("/users", {}, {}, "POST")?.body).toBe("any");
  });

  test("add overwrites the response on the same path/method/params/body", () => {
    const localStore = new Store();
    localStore.add({
      request: { path: "/users", params: {}, body: {}, method: "GET" },
      response: { headers, status: 200, body: "first" },
    });
    localStore.add({
      request: { path: "/users", params: {}, body: {}, method: "get" },
      response: { headers, status: 200, body: "second" },
    });

    expect(localStore.get("/users", {}, {}, "GET")?.body).toBe("second");
  });
});

describe("re-POST identity (story 04)", () => {
  const headers = { "Content-Type": ContentType.applicationJson };
  const v1: MockResponse = { headers, status: 200, body: "v1" };
  const v2: MockResponse = { headers, status: 200, body: "v2" };
  const populated = { populated: "yes" };

  // Four shapes a request key can take, mirroring how seeds and HTTP-parsed
  // bodies actually arrive at `Store.add` in the wild.
  type ReqState = "missing" | "empty" | "undef" | "present";

  function buildSetup(
    pState: ReqState,
    bState: ReqState,
    response: MockResponse
  ): MockRecord {
    const req: { path: string; params?: MockParams; body?: MockBody } = {
      path: "/repost",
    };
    if (pState === "empty") req.params = {};
    else if (pState === "undef") req.params = undefined;
    else if (pState === "present") req.params = populated;
    // "missing" → leave the key off entirely

    if (bState === "empty") req.body = {};
    else if (bState === "undef") req.body = undefined;
    else if (bState === "present") req.body = populated;

    // Cast: MockRequest declares params/body as required keys, but JSON-parsed
    // POSTs (and minimal seeds) routinely arrive with the keys missing — that's
    // the runtime shape we need to exercise here.
    return { request: req as MockRequest, response };
  }

  // Specificity ties resolve to first-added, so if a second add does NOT
  // overwrite, GET returns v1. A passing assertion of v2 therefore proves
  // exactly one record exists in the cache.
  const states: ReqState[] = ["missing", "empty", "undef", "present"];
  const sameShapeMatrix = states.flatMap((p) => states.map((b) => ({ p, b })));

  describe.each(sameShapeMatrix)(
    "two re-POSTs with the same shape (params=$p, body=$b)",
    ({ p, b }) => {
      test("the second response wins and exactly one record exists", () => {
        const localStore = new Store();
        localStore.add(buildSetup(p, b, v1));
        localStore.add(buildSetup(p, b, v2));

        const queryParams = p === "present" ? populated : {};
        const queryBody = b === "present" ? populated : {};
        expect(localStore.get("/repost", queryParams, queryBody)).toEqual(v2);
      });
    }
  );

  // The user-facing punchline of fed's normalization point: `params: undefined`
  // from a seed file and `params: {}` from a runtime POST share an identity.
  // Switching between any of {missing, empty, undef} on re-POST overwrites.
  test.each([
    { first: "missing" as const, second: "empty" as const },
    { first: "empty" as const, second: "undef" as const },
    { first: "undef" as const, second: "missing" as const },
  ])(
    "re-POST that swaps params $first → $second still overwrites (both normalize to {})",
    ({ first, second }) => {
      const localStore = new Store();
      localStore.add(buildSetup(first, "missing", v1));
      localStore.add(buildSetup(second, "missing", v2));
      expect(localStore.get("/repost", {}, {})).toEqual(v2);
    }
  );

  // AC4: a request that *differs* in params or body must create a new record,
  // even when one shape is a subset of the other. This is the asymmetry case
  // and the exact bug `_.isMatch` was masking on the write side.
  test("AC4: less-specific then more-specific stays as two records", () => {
    const localStore = new Store();
    localStore.add({
      request: { path: "/api", params: { a: "1" }, body: {} },
      response: v1,
    });
    localStore.add({
      request: { path: "/api", params: { a: "1", b: "2" }, body: {} },
      response: v2,
    });

    // More-specific record wins for an exact match (story 01).
    expect(localStore.get("/api", { a: "1", b: "2" }, {})).toEqual(v2);
    // The less-specific record still serves a request that doesn't pin `b`.
    expect(localStore.get("/api", { a: "1" }, {})).toEqual(v1);
  });

  test("AC4: more-specific then less-specific stays as two records", () => {
    const localStore = new Store();
    localStore.add({
      request: { path: "/api", params: { a: "1", b: "2" }, body: {} },
      response: v1,
    });
    localStore.add({
      request: { path: "/api", params: { a: "1" }, body: {} },
      response: v2,
    });

    expect(localStore.get("/api", { a: "1", b: "2" }, {})).toEqual(v1);
    // GET with just {a:"1"} only matches the {a:"1"} record (subset match
    // requires stored ⊆ incoming, so {a:"1",b:"2"} is filtered out).
    expect(localStore.get("/api", { a: "1" }, {})).toEqual(v2);
  });

  test("AC4: a re-POST with a different body value creates a new record", () => {
    const localStore = new Store();
    localStore.add({
      request: { path: "/api", params: {}, body: { type: "premium" } },
      response: v1,
    });
    localStore.add({
      request: { path: "/api", params: {}, body: { type: "free" } },
      response: v2,
    });

    expect(localStore.get("/api", {}, { type: "premium" })).toEqual(v1);
    expect(localStore.get("/api", {}, { type: "free" })).toEqual(v2);
  });
});

describe("path patterns (story 06)", () => {
  const headers = { "Content-Type": ContentType.applicationJson };
  const r = (status: number, body: MockBody): MockResponse => ({
    headers,
    status,
    body,
  });

  describe("named single-segment parameter `:id`", () => {
    const localStore = new Store([
      {
        request: { path: "/users/:id", params: {}, body: {} },
        response: r(200, "user"),
      },
    ]);

    test("matches a numeric segment", () => {
      expect(localStore.get("/users/123", {}, {})?.body).toBe("user");
    });

    test("matches an alphabetic segment", () => {
      expect(localStore.get("/users/abc", {}, {})?.body).toBe("user");
    });

    test("does not match a missing segment (parent path)", () => {
      expect(localStore.get("/users", {}, {})).toBeUndefined();
    });

    test("does not match an extra segment (deeper path)", () => {
      expect(localStore.get("/users/123/profile", {}, {})).toBeUndefined();
    });
  });

  describe("single-segment wildcard `*`", () => {
    const localStore = new Store([
      {
        request: { path: "/orders/*/items", params: {}, body: {} },
        response: r(200, "items"),
      },
    ]);

    test("matches one segment between literals", () => {
      expect(localStore.get("/orders/anything/items", {}, {})?.body).toBe(
        "items"
      );
    });

    test("does not match when the wildcard segment is missing", () => {
      expect(localStore.get("/orders/items", {}, {})).toBeUndefined();
    });

    test("does not match two segments where one is expected", () => {
      expect(localStore.get("/orders/a/b/items", {}, {})).toBeUndefined();
    });
  });

  describe("specificity vs. parameterized paths", () => {
    test("an exact `/users/123` beats `/users/:id` for `/users/123`", () => {
      const localStore = new Store([
        {
          request: { path: "/users/:id", params: {}, body: {} },
          response: r(200, "any-user"),
        },
        {
          request: { path: "/users/123", params: {}, body: {} },
          response: r(200, "specific-007"),
        },
      ]);

      expect(localStore.get("/users/123", {}, {})?.body).toBe("specific-007");
      expect(localStore.get("/users/456", {}, {})?.body).toBe("any-user");
    });

    test("a more-literal `/users/me` coexists with `/users/:id`", () => {
      const localStore = new Store([
        {
          request: { path: "/users/:id", params: {}, body: {} },
          response: r(200, "any-user"),
        },
        {
          request: { path: "/users/me", params: {}, body: {} },
          response: r(200, "self"),
        },
      ]);

      expect(localStore.get("/users/me", {}, {})?.body).toBe("self");
      expect(localStore.get("/users/42", {}, {})?.body).toBe("any-user");
    });

    test("registration order does not flip the specificity decision", () => {
      // Reverse the order of the previous test to prove it's score, not order.
      const localStore = new Store([
        {
          request: { path: "/users/me", params: {}, body: {} },
          response: r(200, "self"),
        },
        {
          request: { path: "/users/:id", params: {}, body: {} },
          response: r(200, "any-user"),
        },
      ]);

      expect(localStore.get("/users/me", {}, {})?.body).toBe("self");
      expect(localStore.get("/users/42", {}, {})?.body).toBe("any-user");
    });
  });

  describe("backwards compatibility", () => {
    test("plain literal seed paths keep working unchanged (AC4)", () => {
      const localStore = new Store([
        {
          request: { path: "/users/123", params: {}, body: {} },
          response: r(200, "literal"),
        },
      ]);

      expect(localStore.get("/users/123", {}, {})?.body).toBe("literal");
      // Strict equality: a different concrete path does not match.
      expect(localStore.get("/users/124", {}, {})).toBeUndefined();
    });

    test("re-POST identity still keys on the literal path string", () => {
      const localStore = new Store();
      localStore.add({
        request: { path: "/users/:id", params: {}, body: {} },
        response: r(200, "v1"),
      });
      localStore.add({
        request: { path: "/users/:id", params: {}, body: {} },
        response: r(200, "v2"),
      });
      // Second add overwrites — exactly one record exists.
      expect(localStore.get("/users/123", {}, {})?.body).toBe("v2");
    });
  });

  describe("edge cases", () => {
    test("regex special chars in literal segments are matched literally", () => {
      const localStore = new Store([
        {
          request: { path: "/users.json/:id", params: {}, body: {} },
          response: r(200, "json-user"),
        },
      ]);

      expect(localStore.get("/users.json/42", {}, {})?.body).toBe("json-user");
      // The `.` in `.json` must NOT match an arbitrary char — without escaping
      // the regex would happily match `usersXjson`.
      expect(localStore.get("/usersXjson/42", {}, {})).toBeUndefined();
    });

    test("trailing slash on the request path does not match a no-trailing-slash pattern", () => {
      const localStore = new Store([
        {
          request: { path: "/users/:id", params: {}, body: {} },
          response: r(200, "user"),
        },
      ]);

      expect(localStore.get("/users/123/", {}, {})).toBeUndefined();
    });

    test("`:name` mid-segment is treated as a literal, not a parameter", () => {
      const localStore = new Store([
        {
          request: { path: "/foo:bar", params: {}, body: {} },
          response: r(200, "literal-colon"),
        },
      ]);

      expect(localStore.get("/foo:bar", {}, {})?.body).toBe("literal-colon");
      expect(localStore.get("/fooX", {}, {})).toBeUndefined();
    });

    test("`*` mid-segment is treated as a literal, not a wildcard", () => {
      const localStore = new Store([
        {
          request: { path: "/foo*bar", params: {}, body: {} },
          response: r(200, "literal-star"),
        },
      ]);

      expect(localStore.get("/foo*bar", {}, {})?.body).toBe("literal-star");
      expect(localStore.get("/fooXbar", {}, {})).toBeUndefined();
    });

    test("a pattern can combine `:name` and `*` segments", () => {
      const localStore = new Store([
        {
          request: { path: "/users/:id/*/edit", params: {}, body: {} },
          response: r(200, "edit"),
        },
      ]);

      expect(localStore.get("/users/42/profile/edit", {}, {})?.body).toBe(
        "edit"
      );
      expect(localStore.get("/users/42/edit", {}, {})).toBeUndefined();
    });

    test("`:id` requires at least one character (an empty segment does not match)", () => {
      const localStore = new Store([
        {
          request: { path: "/users/:id", params: {}, body: {} },
          response: r(200, "user"),
        },
      ]);

      // `//` produces an empty segment; `[^/]+` rightly rejects it.
      expect(localStore.get("/users/", {}, {})).toBeUndefined();
    });
  });
});
