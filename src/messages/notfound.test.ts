import { describe, expect, test } from "vitest";

import { MockRecord } from "../types/mockRecord";
import { notFoundTemplate } from "./notfound";

const extractDataRaw = (message: string): string => {
  // The curl in the message is `--data-raw '<JSON>'`. The JSON body never
  // contains a single quote, so a non-greedy match between the first pair
  // of single quotes after --data-raw is sufficient.
  const match = message.match(/--data-raw '([\s\S]*?)'/);
  if (!match) throw new Error(`no --data-raw payload in message:\n${message}`);
  return match[1];
};

describe("notFoundTemplate", () => {
  test("emits a curl whose --data-raw payload parses as JSON", () => {
    const message = notFoundTemplate(
      "/users",
      { id: "42" },
      {},
      "GET",
      5111,
      "/mock"
    );

    const payload = extractDataRaw(message);
    expect(() => JSON.parse(payload)).not.toThrow();
  });

  test("the parsed payload conforms to the MockRecord shape", () => {
    const message = notFoundTemplate(
      "/widgets",
      {},
      { name: "spline" },
      "post",
      5111,
      "/mock"
    );

    const record: MockRecord = JSON.parse(extractDataRaw(message));

    expect(record.request).toMatchObject({
      method: "POST",
      path: "/widgets",
      params: {},
      body: { name: "spline" },
    });
    expect(record.response.status).toBe(200);
    expect(typeof record.response.status).toBe("number");
    expect(record.response.headers).toEqual({ "Content-Type": "application/json" });
    expect(record.response.body).toEqual({});
    // The legacy (broken) field must not leak back in.
    expect((record.response as Record<string, unknown>).contentType).toBeUndefined();
  });

  test("uses the configured port and mockPath in the curl URL", () => {
    const message = notFoundTemplate("/x", {}, {}, "GET", 9999, "/__register");

    expect(message).toContain("'http://localhost:9999/__register'");
    expect(message).not.toContain("localhost:5111/mock");
  });

  test("emits valid JSON even when params and body are undefined", () => {
    // Real GETs hit this code path: express leaves req.body undefined unless a
    // body parser fires, and JSON.stringify(undefined) is not valid JSON.
    const message = notFoundTemplate("/x", undefined, undefined, "GET", 5111, "/mock");

    const record: MockRecord = JSON.parse(extractDataRaw(message));
    expect(record.request.params).toEqual({});
    expect(record.request.body).toEqual({});
  });

  test("uppercases the method in both the prose and the registered record", () => {
    const message = notFoundTemplate("/x", {}, {}, "delete", 5111, "/mock");

    expect(message).toContain("DELETE /x");
    const record: MockRecord = JSON.parse(extractDataRaw(message));
    expect(record.request.method).toBe("DELETE");
  });
});
