import { MockResponse } from './mockResponse'

/* eslint-disable  @typescript-eslint/no-explicit-any */
export type MockRecord = {
    path: string;
    params: any;
    body: any;
    response: MockResponse;
};
