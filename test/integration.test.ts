import request from "supertest";
import Server from "../src/server";

describe("server", () => {
  const server = new Server("/mock");
  const app = server.express;

  const userName = "Mitch Hedberg";
  const path = "/user";
  const params = {"id": "123"};
  const body = {};
  const val = { userName };
  beforeAll((done) => {
    request(app)
      .post("/mock")
      .send({
        path,
        params,
        body,
        val
      })
      .expect(200)
      .then((response) => {
        expect(response.body?.val?.userName).toBe(userName);
        done();
      });
  });

  it("server#fetch returns val with the right path, params, and body", (done) => {
    request(app)
    .get(`${path}?id=123`)
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200)
    .then((response) => {
      expect(response.body?.userName).toBe(userName);
      done();
    });
  });
  
  it("server#fetch returns empty response when val is not found", (done) => {
    request(app)
    .get(`${path}?id=NO_ID_HERE`)
    .set('Accept', 'application/json')
    .expect(200)
    .then((response) => {
      expect(response.body).toEqual({});
      done();
    });
  });
});
