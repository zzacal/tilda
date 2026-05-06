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
  "Content-Type": ContentType
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
};

export type MockResponse = {
  status: number;
  body: MockBody;
  headers: MockHeaders;
  delay?: number;
};
