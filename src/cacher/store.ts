import * as _ from 'lodash'
import { MockResponse } from '../types/mockResponse'
import { MockSetup } from '../types/mockSetup'
import { Record } from '../types/record'

export default class Store {
  private cache: Record[] = [];
  constructor () {
    this.cache = []
  }

  add (setup: MockSetup): Record {
    const { request, response } = setup
    const record = { path: request.path, params: request.params, body: request.body, response: response }
    this.cache.push(record)
    return record
  }

  get (path: string, params?: any, body?: any): MockResponse {
    return this.cache
      .filter((r) => r.path === path)
      .filter((r) => _.isEqual(r.params, params))
      .filter((r) => _.isEqual(r.body, body))[0]?.response
  }

  // update(response: any, path: string, params?: any, body?: any): void {}

  // delete(path: string, params?: any, body?: any) {}
}
