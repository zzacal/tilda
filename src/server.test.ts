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

  test("server#fetch returns xml when response is xml", () => new Promise<void>((done) => {
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

  test("server#fetch returns val with the right path, params, and body", () => new Promise<void>((done) => {
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

  test("server#fetch returns empty response when val is not found", () => new Promise<void>((done) => {
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

});
