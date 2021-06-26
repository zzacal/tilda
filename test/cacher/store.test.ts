import Store from "../../src/cacher/store";
import { MockRecord } from "../../src/types/mockRecord";
import { ContentType } from "../../src/types/mockResponse";
import { MockSetup } from "../../src/types/mockSetup";

jest.spyOn(global.console, 'log').mockImplementation(() => { return });
describe("cache store", () => {
  const store = new Store();
  const path = "/";
  const params = "some params";
  const body = "some body";

  it("can be seeded", () => {
    const seed: MockRecord[] = [{ "path": "/", "params": "params", "body": "body", "response": { "contentType": ContentType.textPlain, "status": 200, "body": "some other body" } }]
    const seededStore = new Store(seed);
    const result = seededStore.get("/", "params", "body");
    expect(result?.body).toBe("some other body")
  })

  it("returns undefined when no setup is found", () => {
    const noResponse = store.get(path, params, body);
    expect(noResponse).toBeUndefined();
  })

  it("can store text response", () => {
    const setupA: MockSetup = {
      request: {
        path,
        params,
        body,
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: "initial body",
      },
    };

    store.add(setupA);
    const responseA = store.get(path, params, body);
    expect(responseA).toEqual(setupA.response);
  });

  it("can overwrite the response on a request", () => {
    const setupB: MockSetup = {
      request: {
        path,
        params,
        body,
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: "some other body",
      },
    };

    store.add(setupB);
    const responseB = store.get(path, params, body);
    expect(responseB).toEqual(setupB.response);
  });

  it("can store a response objects", () => {
    const jsonPath = "/json"
    const setup = {
      request: {
        path: jsonPath,
        params: {},
        body: {},
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: { "Style": { "Dark": "Sleek", "Types": ["Glove", "Shrowd"] } },
      },
    };

    store.add(setup);
    const result = store.get(jsonPath, {}, {});
    expect(result?.body?.Style?.Dark).toEqual("Sleek");
    expect(result?.body?.Style?.Types?.length).toBe(2);
  })

  it("can store a xml response", () => {
    const xmlPath = "/xml";
    const setup = {
      request: {
        path: xmlPath,
        params: {},
        body: {},
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: "<note>\n<to s=\"d\">Stokk</to>\n<from>Klimp</from>\n<heading>Reminder</heading>\n<body>You rock, yeah!</body>\n</note>",
      },
    };

    store.add(setup);
    const response = store.get(xmlPath, {}, {});
    expect(response?.body).toBeDefined();
  });
});
