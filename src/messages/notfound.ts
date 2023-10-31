import { MockBody, MockParams } from "../types/mockRecord";

/* eslint-disable  @typescript-eslint/no-explicit-any */
export const notFoundTemplate = (
  path: string,
  params: MockParams,
  body: MockBody
): string => {
  return `Warning: No setup found. Mock it.
        curl --location --request POST 'localhost:5111/mock' \\
        --header 'Content-Type: application/json' \\
        --data-raw '{
            "request": {
                "path": "${path}",
                "params": ${JSON.stringify(params)},
                "body": ${JSON.stringify(body)}
            },
            "response": {
                "contentType": "application/json",
                "status": "200",
                "body": {}
            }
        }'`;
};
