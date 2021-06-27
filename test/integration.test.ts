import request from "supertest";
import Server from "../src/server";
import { ContentType } from "../src/types/mockResponse";
import { MockSetup } from "../src/types/mockSetup";

jest.spyOn(global.console, 'log').mockImplementation(() => { return });
jest.spyOn(global.console, "warn").mockImplementation(() => { return });

describe("server", () => {
  const server = new Server("/mock");
  const app = server.express;
  const expressServer = server.listen(3000);
  const jsonPath = "/user";
  const params = { id: "123" };
  const body = {};
  const jsonSetup: MockSetup = {
    request: {
      path: jsonPath,
      params,
      body,
    },
    response: {
      contentType: ContentType.applicationJson,
      status: 200,
      body: { username: "Mitch Hedberg" },
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
      contentType: ContentType.textXml,
      status: 200,
      body: "<note>\n<to s=\"d\">Stokk</to>\n<from>Klimp</from>\n<heading>Reminder</heading>\n<body>You rock, yeah!</body>\n</note>",
    },
  };

  beforeAll((done) => {
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
  });

  it("server#fetch returns xml when response is xml", (done) => {
    request(app)
      .get(xmlPath)
      .expect(200)
      .then((response) => {
        expect(response.text).toEqual(xmlSetup.response.body);
        expect(response.headers["content-type"]).toContain(ContentType.textXml)
        done();
      });
  });

  it("can mock and return an html response", (done) => {
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
  })

  it("server#fetch returns val with the right path, params, and body", (done) => {
    request(app)
      .get(`${jsonPath}?id=123`)
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(jsonSetup.response.body);
        done();
      });
  });

  it("server#fetch returns empty response when val is not found", (done) => {
    jest.spyOn(global.console, "warn").mockImplementation(() => { });
    request(app)
      .get(`${jsonPath}?id=NO_ID_HERE`)
      .set("Accept", "application/json")
      .expect(404)
      .then((response) => {
        expect(response.body).toEqual({});
        expect(console.warn).toBeCalled();
        done();
      });
  });

});
