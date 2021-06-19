import Store from "../../src/cacher/store";
import { MockResponseType } from "../../src/types/mockResponse";
import { MockSetup } from "../../src/types/mockSetup";

describe("cache store", () => {
  const store = new Store();
  const path = "/";
  const params = "some params";
  const body = "some body";
  jest.spyOn(global.console, 'warn').mockImplementation(()=>{});
  it("warns when no setup is found", () => {
    const noResponse = store.get(path, params, body);
    expect(console.warn).toBeCalled();
  })

  it("can set up a response based on a request", () => {
    const setupA: MockSetup = {
      request: {
        path,
        params,
        body,
      },
      response: {
        type: MockResponseType.string,
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
        type: MockResponseType.string,
        status: 200,
        body: "some other body",
      },
    };

    store.add(setupB);
    const responseB = store.get(path, params, body);
    expect(responseB).toEqual(setupB.response);
  })
});
