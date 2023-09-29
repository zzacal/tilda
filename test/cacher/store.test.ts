import Store from "../../src/cacher/store";
import { MockRecord } from "../../src/types/mockRecord";
import { ContentType } from "../../src/types/mockResponse";
import { MockSetup } from "../../src/types/mockSetup";

jest.spyOn(global.console, 'log').mockImplementation(() => { return });
describe("cache store", () => {
  const store = new Store();
  const rootPath = "/";
  const someParams = "some params";
  const someBody = "some body";

  it("can be seeded", () => {
    const seed: MockRecord[] = [{ "path": "/", "params": "params", "body": "body", "response": { "contentType": ContentType.textPlain, "status": 200, "body": "some other body" } }]
    const seededStore = new Store(seed);
    const result = seededStore.get("/", "params", "body");
    expect(result?.body).toBe("some other body")
  })

  it("returns undefined when no setup is found", () => {
    const noResponse = store.get(rootPath, someParams, someBody);
    expect(noResponse).toBeUndefined();
  })

  it("can store text response", () => {
    const setupA: MockSetup = {
      request: {
        path: rootPath,
        params: someParams,
        body: someBody,
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: "initial body",
      },
    };

    store.add(setupA);
    const responseA = store.get(rootPath, someParams, someBody);
    expect(responseA).toEqual(setupA.response);
  });

  it("can overwrite the response on a request", () => {
    const setupB: MockSetup = {
      request: {
        path: rootPath,
        params: someParams,
        body: someBody,
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: "some other body",
      },
    };

    store.add(setupB);
    const responseB = store.get(rootPath, someParams, someBody);
    expect(responseB).toEqual(setupB.response);
  });

  it("finds a request with undefined params and body", () => {
    const path = "/undefined_bodies";
    const setupB: MockSetup = {
      request: {
        path,
        params: undefined,
        body: undefined,
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: "some other body",
      },
    };

    store.add(setupB);
    const responseB = store.get(path);
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
  
  it('can store an html response', () => {
    const htmlPath = "html";
    const setup = {
      request: {
        path: htmlPath,
        params: {},
        body: {},
      },
      response: {
        contentType: ContentType.textHtml,
        status: 200,
        body: 
         `<!DOCTYPE html>
          <html lang="en">
              <body>
                  <h1>Hello world!</h1>
                  <p>This is a test html page</p>
              </body>
          </html>`
      },
    };
    
    store.add(setup);
    const result = store.get(htmlPath, {}, {});

    expect(result?.contentType).toBe(ContentType.textHtml);
    expect(result?.body).toBeDefined();
  });


  it("can get a response objects using partial match", () => {
    const jsonPath = "/json";
    const setup = {
      request: {
        path: jsonPath,
        params: {},
        body: { knownField: "known at setup" },
      },
      response: {
        contentType: ContentType.textPlain,
        status: 200,
        body: { congratulations: "You found a partial match" },
      },
    };

    store.add(setup);
    const result = store.get(jsonPath, {}, { knownField: "known at setup", someDynamicField: "not known at setup" });
    expect(result).toEqual(setup.response);
  });
});
