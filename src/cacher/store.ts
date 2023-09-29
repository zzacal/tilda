import * as _ from 'lodash'
import { MockResponse } from '../types/mockResponse'
import { MockSetup } from '../types/mockSetup'
import { MockRecord } from '../types/mockRecord'

/* eslint-disable  @typescript-eslint/no-explicit-any */
export default class Store {
  private cache: MockRecord[] = [];
  constructor(seed?: MockRecord[]) {
    this.cache = seed ?? [];
    console.log(
      `\n\ninitial cache\n${JSON.stringify(this.cache.map((m) => m.path))}\n\n`
    );
  }

  private getRecord(path: string, params: any, body: any) {
    return this.cache.filter(
      (r) =>
        r.path === path &&
        _.isMatch(params, r.params) &&
        _.isMatch(body, r.body)
    )[0];
  }

  add(setup: MockSetup): MockRecord {
    const { request, response } = setup;
    const record = {
      path: request.path,
      params: request.params ?? {},
      body: request.body ?? {},
      response: response,
    };

    const result = this.getRecord(
      setup.request.path,
      setup.request.params,
      setup.request.body
    );

    if (result) {
      result.response = setup.response;
    } else {
      this.cache.push(record);
    }
    return record;
  }

  get(
    path: string,
    params: any = {},
    body: any = {}
  ): MockResponse | undefined {
    const result = this.getRecord(path, params, body);

    return result?.response;
  }

  // update(response: any, path: string, params?: any, body?: any): void {}

  // delete(path: string, params?: any, body?: any) {}
}
