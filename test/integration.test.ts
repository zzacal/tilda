import request from "supertest";
import Server from "../src/server";
import { ContentType } from "../src/types/mockResponse";
import { MockSetup } from "../src/types/mockSetup";

jest.spyOn(global.console, 'log').mockImplementation(() => { return });

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
    jest.spyOn(global.console, "warn").mockImplementation(() => {});
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

  it("server#fetch returns xml when response is xml", (done) => {
    jest.spyOn(global.console, "warn").mockImplementation(() => {});
    request(app)
      .get(xmlPath)
      .expect(200)
      .then((response) => {
        console.log(`${JSON.stringify(response)}`);
        expect(response.text).toEqual(xmlSetup.response.body);
        expect(console.warn).toBeCalled();
        done();
      });
  })

});
