import { expect, test, describe, vi, beforeAll } from 'vitest'

import request from "supertest";
import Server from "./server";
import { ContentType, MockRecord } from "./types/mockRecord";

vi.spyOn(global.console, 'log').mockImplementation(() => { return });
vi.spyOn(global.console, "warn").mockImplementation(() => { return });

describe("server", () => {
  const server = new Server("/mock");
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

  test("OPTIONS does not match a GET-only mock and 404s with the method in the message", () => new Promise<void>((done) => {
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
      .then(() => request(app).options(path).expect(404))
      .then((response) => {
        expect(response.text).toContain("OPTIONS");
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
