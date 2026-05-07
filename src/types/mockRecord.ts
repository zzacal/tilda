export type MockRecord = {
  response: MockResponse;
  request: MockRequest;
};

export enum ContentType {
  applicationJson = "application/json",
  textXml = "text/xml",
  textHtml = "text/html",
  textPlain = "text/plain",
  applicationXml = "application/xml",
}

type MockHeaders = {
  /**
   * Plain `string` rather than the `ContentType` enum so captured records
   * (story 05) can faithfully store whatever an upstream returns
   * (`application/octet-stream`, vendor MIME types, etc.). The enum is
   * still exported as ergonomic constants for hand-authored seeds.
   */
  "Content-Type": string;
} & Keyable;

type Keyable = {
  [key: string]: string;
}

export type MockParams = object | string | undefined;

export type MockBody = object | string | undefined;

export type MockRequest = {
  path: string;
  params: MockParams;
  body: MockBody;
  /**
   * HTTP method to match (case-insensitive). Omit to match any method.
   */
  method?: string;
  /**
   * Headers seen on the captured request (story 05). Stored for
   * record-keeping only — the matcher never consults headers, so this
   * field is informational. Sensitive headers (`Authorization`, `Cookie`,
   * etc.) are stripped before persistence; see `recorder/redact.ts`.
   */
  headers?: Record<string, string | string[]>;
};

export type MockResponse = {
  status: number;
  body: MockBody;
  headers: MockHeaders;
  delay?: number;
};
