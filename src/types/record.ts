import { MockResponse } from './mockResponse'

export type Record = {
    path: string;
    params: any;
    body: any;
    response: MockResponse;
};
