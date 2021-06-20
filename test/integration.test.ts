import request from "supertest";
import Server from "../src/server";
import { MockResponseType } from "../src/types/mockResponse";
import { MockSetup } from "../src/types/mockSetup";

jest.spyOn(global.console, 'log').mockImplementation(() => { return });

describe("server", () => {
  const server = new Server("/mock");
  const app = server.express;
  const expressServer = server.listen(3000);
  const path = "/user";
  const params = { id: "123" };
  const body = {};
  const setup: MockSetup = {
    request: {
      path,
      params,
      body,
    },
    response: {
      type: MockResponseType.obj,
      status: 200,
      body: { username: "Mitch Hedberg" },
    },
  };
  beforeAll((done) => {
    expect(expressServer).not.toBe(null);

    request(app)
      .post("/mock")
      .send(setup)
      .expect(200)
      .then((response) => {
        expect(response.body.response).toEqual(setup.response);
        done();
      });
  });

  it("server#fetch returns val with the right path, params, and body", (done) => {
    request(app)
      .get(`${path}?id=123`)
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(setup.response.body);
        done();
      });
  });

  it("server#fetch returns empty response when val is not found", (done) => {
    jest.spyOn(global.console, "warn").mockImplementation(() => {});
    request(app)
      .get(`${path}?id=NO_ID_HERE`)
      .set("Accept", "application/json")
      .expect(404)
      .then((response) => {
        expect(response.body).toEqual({});
        expect(console.warn).toBeCalled();
        done();
      });
  });
});
