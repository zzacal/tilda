/* eslint-disable  @typescript-eslint/no-explicit-any */
export enum ContentType {
  applicationJson = "application/json",
  textXml = "text/xml",
  textHtml = "text/html",
  textPlain = "text/plain",
  applicationXml = "application/xml",
}

export type MockResponse = {
  contentType: ContentType;
  status: number;
  body: any;
};
