export enum MockResponseType {
    obj = 'obj',
    string = 'string'
}

export type MockResponse = {
    type: MockResponseType,
    status: number
    body: any
}
