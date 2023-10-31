import * as _ from 'lodash'
import { MockSetup } from '../types/mockSetup'
import { MockBody, MockParams, MockRecord, MockResponse } from '../types/mockRecord'

/* eslint-disable  @typescript-eslint/no-explicit-any */
export default class Store {
  private cache: MockRecord[] = [];
  constructor(seed?: MockRecord[]) {
    this.cache = seed ?? [];
    console.log(
      `\n\ninitial cache\n${JSON.stringify(this.cache.map((m) => m.path))}\n\n`
    );
  }

  private getRecord(path: string, params: MockParams, body: MockBody) {
    return this.cache.filter(
      (r) =>
        r.path === path &&
        this.match(params, r.params) &&
        this.match(body, r.body)
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
    params: object = {},
    body: string | object = {}
  ): MockResponse | undefined {
    const result = this.getRecord(path, params, body);

    return result?.response;
  }
}
