import { MockBody, MockParams } from "../types/mockRecord";

// Express leaves `req.body` undefined for requests without a parseable body
// (e.g. a GET with no Content-Type). `JSON.stringify(undefined)` is `undefined`
// (the JS value, not valid JSON), so the suggested curl would produce
// `"body": undefined` and fail to parse. Default both fields to `{}` — the
// matcher does subset matching, so an empty object matches any incoming value.
const jsonOrEmpty = (value: MockParams | MockBody): string =>
  JSON.stringify(value ?? {});

export const notFoundTemplate = (
  path: string,
  params: MockParams,
  body: MockBody,
  method: string,
  port: number,
  mockPath: string
): string => {
  const upperMethod = method.toUpperCase();
  return `No mock matched ${upperMethod} ${path}. Register one with:

curl --request POST 'http://localhost:${port}${mockPath}' \\
  --header 'Content-Type: application/json' \\
  --data-raw '{
    "request": {
      "method": "${upperMethod}",
      "path": ${JSON.stringify(path)},
      "params": ${jsonOrEmpty(params)},
      "body": ${jsonOrEmpty(body)}
    },
    "response": {
      "status": 200,
      "headers": { "Content-Type": "application/json" },
      "body": {}
    }
  }'

Edit the response body, run the curl, then re-fire your original request.`;
};
