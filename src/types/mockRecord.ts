export type MockRecord = MockRequest & {
  response: MockResponse;
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
};

export type MockResponse = {
  status: number;
  body: MockBody;
  headers: MockHeaders;
};
