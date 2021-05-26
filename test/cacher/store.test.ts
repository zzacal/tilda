import Store from "../../src/cacher/store";

describe("cache store", () => {
  const store = new Store();
  it("can add", () => {
    const val = "some value";
    const path = "/";
    const params = "some params";
    const body = "some body";
    store.add(val, path, params, body);
    const stored = store.get(path, params, body);

    expect(stored.val).toEqual(val);
  });
});
