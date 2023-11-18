import * as _ from 'lodash'
import { MockBody, MockParams, MockRecord, MockResponse } from '../types/mockRecord'

/* eslint-disable  @typescript-eslint/no-explicit-any */
export default class Store {
  private cache: MockRecord[] = [];
  constructor(seed?: MockRecord[]) {
    this.cache = seed ?? [];
    console.log(
      `\n\ninitial cache\n${JSON.stringify(this.cache.map((m) => m.request.path))}\n\n`
    );
  }

  private getRecord(path: string, params: MockParams, body: MockBody) {
    return this.cache.filter(
      (r) =>
        r.request.path === path &&
        this.match(params, r.request.params) &&
        this.match(body, r.request.body)
    )[0];
  }

  private match(a: MockParams | MockBody, b: MockParams | MockBody): boolean {
    if( typeof a === "string" && typeof b === "string") {
      return a === b;
    } else if (typeof a === "object" && typeof b === "object") {
      return _.isMatch(a, b);
    } else {
      return false;
    }
  }

  add(setup: MockRecord): MockRecord {
    const { request, response } = setup;
    const record: MockRecord = {
      response,
      request: {
        path: request.path,
        params: request.params ?? {},
        body: request.body ?? {},
      }
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
    params: object = {},
    body: string | object = {}
  ): MockResponse | undefined {
    const result = this.getRecord(path, params, body);

    return result?.response;
  }
}
