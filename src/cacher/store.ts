import * as _ from 'lodash'
import { MockResponse } from '../types/mockResponse'
import { MockSetup } from '../types/mockSetup'

export default class Store {
  private cache: record[] = [];
  constructor () {}

  add (setup: MockSetup): record {
    const { request, response } = setup
    const record: record = { path: request.path, params: request.params, body: request.body, response: response }
    this.cache.push(record)
    return record
  }

  get (path: string, params?: any, body?: any): MockResponse {
    return this.cache
      .filter((r) => r.path === path)
      .filter((r) => _.isEqual(r.params, params))
      .filter((r) => _.isEqual(r.body, body))[0].response
  }

  // update(response: any, path: string, params?: any, body?: any): void {}

  // delete(path: string, params?: any, body?: any) {}

  clear () {
    this.cache = []
  }
}

type record = {
  path: string;
  params: any;
  body: any;
  response: MockResponse;
};
