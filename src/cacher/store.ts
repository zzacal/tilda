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
   * When multiple records match, the most specific one wins. Specificity is
   * the number of constrained fields in the stored `params` + `body`, plus
   * +1 when the record pins an HTTP `method`. Ties are broken by registration
   * order (first-added wins).
   *
   * This is an internal method used to find cache records. It is not part of the public API.
  */
  private getRecord(
    path: string,
    params: MockParams,
    body: MockBody,
    method?: string
  ): MockRecord | undefined {
    const candidates = this.cache
      .map((record, index) => ({ record, index }))
      .filter(
        ({ record }) =>
          record.request.path === path &&
          this.matchMethod(record.request.method, method) &&
          this.match(params, record.request.params) &&
          this.match(body, record.request.body)
      );

    candidates.sort((a, b) => {
      const scoreDiff = this.specificity(b.record) - this.specificity(a.record);
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    });

    return candidates[0]?.record;
  }

  private specificity(record: MockRecord): number {
    return (
      this.fieldCount(record.request.params) +
      this.fieldCount(record.request.body) +
      (record.request.method ? 1 : 0)
    );
  }

  private fieldCount(value: MockParams | MockBody): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === "string") return value.length > 0 ? 1 : 0;
    if (typeof value === "object") return Object.keys(value).length;
    return 0;
  }

  /**
   * A record matches the incoming method when it pins no method (matches any)
   * or its method equals the incoming method, case-insensitively.
   */
  private matchMethod(
    recordMethod: string | undefined,
    requestMethod: string | undefined
  ): boolean {
    if (recordMethod === undefined) return true;
    if (requestMethod === undefined) return false;
    return recordMethod.toUpperCase() === requestMethod.toUpperCase();
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
   * Two records share an identity when their methods are both omitted or both
   * pin the same method (case-insensitively). Used to decide whether `add`
   * overwrites an existing record or pushes a new one — a method-specific
   * record never overwrites a method-agnostic one for the same path/params/body.
   */
  private sameMethod(a: string | undefined, b: string | undefined): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return a.toUpperCase() === b.toUpperCase();
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
        method: request.method,
      }
    };

    const existing = this.cache.find(
      (r) =>
        r.request.path === record.request.path &&
        this.sameMethod(r.request.method, record.request.method) &&
        this.match(record.request.params, r.request.params) &&
        this.match(record.request.body, r.request.body)
    );

    if (existing) {
      existing.response = setup.response;
    } else {
      this.cache.push(record);
    }
    return record;
  }

  /**
   * Retrieves a mock response for a request with the given path,
   * parameters, body, and method. Searches the cache for a matching
   * request and returns the associated response if found.
   *
   * @param path - The request path to match
   * @param params - The request parameters to match
   * @param body - The request body to match
   * @param method - The HTTP method to match (case-insensitive). Omit to match records with no pinned method only.
   * @returns The mock response for the matching request, or undefined if no match
  */
  get(
    path: string,
    params: object = {},
    body: string | object = {},
    method?: string
  ): MockResponse | undefined {
    const result = this.getRecord(path, params, body, method);

    return result?.response;
  }
}
