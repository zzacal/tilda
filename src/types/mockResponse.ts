/* eslint-disable  @typescript-eslint/no-explicit-any */
export enum ContentType {
  applicationJson = "application/json",
  textXml = "text/xml",
  textHtml = "text/html",
  textPlain = "text/plain",
  applicationXml = "application/xml",
}

export type MockResponse = {
  status: number;
  body: any;
  headers: null | {
    [key: string]: string;
    "Content-Type": ContentType
  };
};
