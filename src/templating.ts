import { MockBody } from "./types/mockRecord";

/**
 * Per-request fields that can be referenced from a `{{ request.X.Y }}`
 * template variable. The namespace deliberately follows Express conventions
 * (`req.params` = path parameters, `req.query` = query string) — note that
 * this differs from `MockRequest.params` in the seed/setup type model, where
 * `params` means the *query string*. README documents the gotcha.
 */
export type TemplateRequest = {
  /** Path parameters captured by `:name` segments in the matched record. */
  params: Record<string, string>;
  /** Parsed query string (typically `req.query`). */
  query: unknown;
  /** Request headers (typically `req.headers`). */
  headers: unknown;
  /** Parsed request body (typically `req.body`). */
  body: unknown;
};

export type TemplateContext = {
  request: TemplateRequest;
};

/**
 * Matches `{{ <dotted.path> }}` with optional whitespace inside the braces.
 * Accepts `[A-Za-z0-9_.-]` between the braces — the `-` is required so that
 * hyphenated keys like `user-agent`, `content-type`, and `x-api-key` can be
 * referenced (most interesting HTTP headers have hyphens). Path segments are
 * still split on `.` only, so `request.headers.user-agent` resolves to
 * `context.request.headers["user-agent"]`.
 *
 * No expressions and no helpers — this keeps the surface area small enough
 * that we don't need a templating library.
 */
const TEMPLATE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * Walks a `MockBody` and substitutes any `{{ request.X.Y }}` references found
 * in string leaves with values pulled from the context. Returns a new body
 * with the same shape:
 *  - strings → templated string (always a string, even when the resolved value
 *    is a number/boolean — a JSON body is text, so coercion is unavoidable)
 *  - objects → walked recursively (keys are NOT templated, only values)
 *  - arrays  → walked element-wise
 *  - numbers/booleans/null → passed through unchanged
 *
 * Missing variables `console.warn` and substitute the empty string, satisfying
 * AC3 (no literal `{{...}}` leaks to the caller). Substitution is **single-pass**:
 * if a substituted value happens to contain `{{...}}`, it is left as-is.
 *
 * @param requestDescriptor optional `"GET /users/42"`-style string included in
 *   the missing-variable warning so a developer can find the offending request.
 */
export default function substitute(
  body: MockBody,
  context: TemplateContext,
  requestDescriptor?: string
): MockBody {
  return walk(body, context, requestDescriptor) as MockBody;
}

function walk(
  value: unknown,
  context: TemplateContext,
  requestDescriptor: string | undefined
): unknown {
  if (typeof value === "string") {
    return substituteString(value, context, requestDescriptor);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, context, requestDescriptor));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = walk(child, context, requestDescriptor);
    }
    return out;
  }
  // numbers, booleans, null, undefined → pass through unchanged
  return value;
}

function substituteString(
  input: string,
  context: TemplateContext,
  requestDescriptor: string | undefined
): string {
  return input.replace(TEMPLATE_PATTERN, (_match, path: string) => {
    const resolved = resolvePath(context, path);
    if (resolved === undefined || resolved === null) {
      const where = requestDescriptor ? ` (request: ${requestDescriptor})` : "";
      console.warn(
        `tilda: template variable "${path}" did not resolve; substituting empty string${where}`
      );
      return "";
    }
    return String(resolved);
  });
}

/**
 * Walks a dotted path (`"request.params.id"`) against the context object.
 * Returns `undefined` for any unresolved segment so the caller can warn and
 * substitute an empty string. Treats `null` as a present-but-empty value
 * (caller still substitutes empty string for `null`, matching the missing-var
 * branch).
 */
function resolvePath(context: TemplateContext, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
