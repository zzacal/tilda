import { vi, test, describe, expect } from "vitest";
import { MockRecord, ContentType } from "../types/mockRecord";
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
