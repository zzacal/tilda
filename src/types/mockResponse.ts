export type MockResponse = {
    type: ResponseType,
    status: number
    body: any
}

export enum MockResponseType {
    obj = 'obj',
    string = 'string'
}
