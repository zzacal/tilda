import * as _ from 'lodash'
import { MockBody, MockParams, MockRecord, MockResponse } from '../types/mockRecord'

/**
 * Characters with special meaning in a JS regex. Used to escape literal path
 * segments so things like `.`, `+`, or `(` in a stored path are matched
 * verbatim — `/users.json/:id` should not treat `.` as "any character".
 */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/**
 * Decides whether a stored path uses pattern syntax (`:name` or `*`). Plain
 * paths take a strict-equality fast path so existing seeds keep working
 * without any regex compilation overhead.
 */
function isPathPattern(path: string): boolean {
  return path.includes(":") || path.includes("*");
}

/**
 * Compiles a stored path pattern into a regex plus the names of any captured
 * params. Single-segment-only:
 *  - `:name` → `([^/]+)` and pushes `name` onto `paramNames`
 *  - `*`     → `[^/]+` (unnamed wildcard)
 *  - everything else is treated as a literal segment and regex-escaped
 *
 * `:name` and `*` are recognized only when they make up an *entire* segment;
 * inside any other segment they are escaped and matched literally. That keeps
 * the syntax predictable — there's no partial-segment wildcard to reason about.
 */
function compilePathPattern(pattern: string): {
  regex: RegExp;
  paramNames: string[];
} {
  const segments = pattern.split("/");
  const paramNames: string[] = [];
  const regexSegments = segments.map((segment) => {
    if (segment.startsWith(":") && segment.length > 1) {
      paramNames.push(segment.slice(1));
      return "([^/]+)";
    }
    if (segment === "*") {
      return "[^/]+";
    }
    return segment.replace(REGEX_SPECIAL, "\\$&");
  });
  return { regex: new RegExp(`^${regexSegments.join("/")}$`), paramNames };
}

export default class Store {
  private cache: MockRecord[] = [];
  constructor(seed?: MockRecord[]) {
    this.cache = seed ?? [];
    // Include the method so users can tell two same-path records apart
    // (e.g. the sample seed has GET + DELETE for `/user/007` — story 05
    // #8 issue 5, flagged by usr). Method-agnostic records show as `*`.
    const labeled = this.cache.map(
      (m) => `${(m.request.method ?? '*').toUpperCase()} ${m.request.path}`
    );
    console.log(`\n\ninitial cache\n${JSON.stringify(labeled)}\n\n`);
  }

  /**
   * Searches the mock cache for a record matching the given request details.
   *
   * When multiple records match, the most specific one wins. Specificity is
   * the count of literal path segments (non-`:name`, non-`*`) plus the number
   * of constrained fields in the stored `params` + `body`, plus `+1` when the
   * record pins an HTTP `method`. Ties are broken by registration order
   * (first-added wins).
   *
   * Also returns the captured path parameters for the winning record (e.g.
   * `{ id: "42" }` for `/users/:id` against `/users/42`), so callers can
   * thread them downstream — story 12 templating uses this for
   * `{{request.params.X}}` substitution.
   *
   * This is an internal method used to find cache records. It is not part of the public API.
  */
  private getRecord(
    path: string,
    params: MockParams,
    body: MockBody,
    method?: string
  ): { record: MockRecord; pathParams: Record<string, string> } | undefined {
    const candidates = this.cache
      .map((record, index) => ({
        record,
        index,
        pathParams: this.extractPathParams(record.request.path, path),
      }))
      .filter(
        (candidate): candidate is typeof candidate & { pathParams: Record<string, string> } =>
          candidate.pathParams !== undefined &&
          this.matchMethod(candidate.record.request.method, method) &&
          this.match(params, candidate.record.request.params) &&
          this.match(body, candidate.record.request.body)
      );

    candidates.sort((a, b) => {
      const scoreDiff = this.specificity(b.record) - this.specificity(a.record);
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    });

    const winner = candidates[0];
    return winner ? { record: winner.record, pathParams: winner.pathParams } : undefined;
  }

  /**
   * Tests a stored path against an incoming request path and returns the
   * captured named parameters. `{}` for plain literal matches, `{ id: "42" }`
   * for `/users/:id` against `/users/42`, and `undefined` when the path does
   * not match. Plain stored paths take a strict-equality fast path so existing
   * seeds keep their exact behavior.
   */
  private extractPathParams(
    recordPath: string,
    requestPath: string
  ): Record<string, string> | undefined {
    if (!isPathPattern(recordPath)) {
      return recordPath === requestPath ? {} : undefined;
    }
    const { regex, paramNames } = compilePathPattern(recordPath);
    const match = regex.exec(requestPath);
    if (!match) return undefined;
    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });
    return params;
  }

  /**
   * Counts the literal (non-`:name`, non-`*`) segments in a path. Used by
   * `specificity` so an exact path beats a parameterized one — `/users/123`
   * (2 literals) wins over `/users/:id` (1 literal) for `/users/123`, and
   * `/users/me` (2 literals) wins over `/users/:id` for `/users/me`.
   */
  private pathSpecificity(path: string): number {
    return path
      .split("/")
      .filter(
        (segment) =>
          segment.length > 0 &&
          segment !== "*" &&
          !(segment.startsWith(":") && segment.length > 1)
      ).length;
  }

  private specificity(record: MockRecord): number {
    return (
      this.pathSpecificity(record.request.path) +
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
   * Write-side identity check for `params` / `body`: deep-equal with
   * `undefined` and `null` normalized to `{}`. Distinct from `match` (which
   * is subset-based and used by the cache read path) — a re-POST should only
   * overwrite a record with the *same* shape, not a record whose constraints
   * happen to be a subset of the new ones. Without this, a more-specific
   * re-POST would silently clobber a less-specific existing record.
   */
  private sameShape(
    a: MockParams | MockBody,
    b: MockParams | MockBody
  ): boolean {
    return _.isEqual(a ?? {}, b ?? {});
  }

  /**
   * Adds a mock record to the cache.
   *
   * If an existing record shares an identity with `setup` — same `path`,
   * `sameMethod`, deep-equal `params`, and deep-equal `body` (with
   * `undefined`/`null` normalized to `{}`) — its response is overwritten in
   * place. Otherwise a new record is appended; `getRecord`'s specificity
   * scoring decides which record wins per incoming request.
   *
   * Returns the added (or updated) MockRecord.
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
        this.sameShape(r.request.params, record.request.params) &&
        this.sameShape(r.request.body, record.request.body)
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
    return this.lookup(path, params, body, method)?.response;
  }

  /**
   * Like `get`, but also returns the path parameters captured from `:name`
   * segments in the matched record's path (e.g. `{ id: "42" }` for
   * `/users/:id` against `/users/42`). For records with literal paths the
   * `pathParams` map is empty.
   *
   * Used by the fetch handler to build the templating context (story 12) so
   * `{{request.params.X}}` resolves to the captured value.
   *
   * @returns `{ response, pathParams }` for the winning record, or `undefined`
   *          when no record matches.
  */
  lookup(
    path: string,
    params: object = {},
    body: string | object = {},
    method?: string
  ): { response: MockResponse; pathParams: Record<string, string> } | undefined {
    const result = this.getRecord(path, params, body, method);
    if (!result) return undefined;
    return { response: result.record.response, pathParams: result.pathParams };
  }
}
