import { MockBody, MockParams } from "../types/mockRecord";

export const notFoundTemplate = (
  path: string,
  params: MockParams,
  body: MockBody,
  method: string
): string => {
  const upperMethod = method.toUpperCase();
  return `Warning: No setup found for ${upperMethod} ${path}. Mock it.
        curl --location --request POST 'localhost:5111/mock' \\
        --header 'Content-Type: application/json' \\
        --data-raw '{
            "request": {
                "method": "${upperMethod}",
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
