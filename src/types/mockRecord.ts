import { MockResponse } from './mockResponse'

export type MockRecord = {
    path: string;
    params: any;
    body: any;
    response: MockResponse;
};
