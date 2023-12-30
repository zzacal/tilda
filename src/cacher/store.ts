import * as _ from 'lodash'
import { MockBody, MockParams, MockRecord, MockResponse } from '../types/mockRecord'

export default class Store {
  private cache: MockRecord[] = [];
  constructor(seed?: MockRecord[]) {
    this.cache = seed ?? [];
    console.log(
      `\n\ninitial cache\n${JSON.stringify(this.cache.map((m) => m.request.path))}\n\n`
    );
  }

  /**
   * Searches the mock cache for a record matching the given request details.
   * 
   * This is an internal method used to find cache records. It is not part of the public API.
  */
  private getRecord(path: string, params: MockParams, body: MockBody): MockRecord {
    return this.cache.filter(
      (r) =>
        r.request.path === path &&
        this.match(params, r.request.params) &&
        this.match(body, r.request.body)
    )[0];
  }

  /**
   * Compares two request parameters or bodies for equality.
   * 
   * This is an internal utility method used by other methods 
   * to determine if two requests match.
   *
   * @param a - The first parameter or body to compare
   * @param b - The second parameter or body to compare  
   * @returns True if a and b are equal, false otherwise
   */
  private match(a: MockParams | MockBody, b: MockParams | MockBody): boolean {
    if (typeof a === "string" && typeof b === "string") {
      return a === b;
    } else if (typeof a === "object" && typeof b === "object") {
      return _.isMatch(a, b);
    } else {
      return false;
    }
  }

  /**
   * Adds a mock record to the cache.
   * 
   * Accepts a MockRecord setup object containing the request 
   * and response. Creates a new MockRecord from the setup, 
   * checks if a matching record already exists, updates it if so,
   * and adds the new record to the cache if no match.
   * 
   * Returns the added MockRecord.
  */
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

  /**
   * Retrieves a mock response for a request with the given path, 
   * parameters, and body. Searches the cache for a matching 
   * request and returns the associated response if found.
   * 
   * @param path - The request path to match
   * @param params - The request parameters to match
   * @param body - The request body to match
   * @returns The mock response for the matching request, or undefined if no match
  */
  get(
    path: string,
    params: object = {},
    body: string | object = {}
  ): MockResponse | undefined {
    const result = this.getRecord(path, params, body);

    return result?.response;
  }
}
