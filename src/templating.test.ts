import { describe, expect, test, vi, beforeEach } from "vitest";
import substitute, { TemplateContext } from "./templating";

const baseContext = (overrides: Partial<TemplateContext["request"]> = {}): TemplateContext => ({
  request: {
    params: {},
    query: {},
    headers: {},
    body: {},
    ...overrides,
  },
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("substitute (string bodies)", () => {
  test("substitutes a single named path parameter", () => {
    const ctx = baseContext({ params: { id: "42" } });
    expect(substitute("user-{{request.params.id}}", ctx)).toBe("user-42");
  });

  test("tolerates whitespace inside the braces", () => {
    const ctx = baseContext({ params: { id: "42" } });
    expect(substitute("user-{{ request.params.id }}", ctx)).toBe("user-42");
    expect(substitute("user-{{   request.params.id   }}", ctx)).toBe("user-42");
  });

  test("substitutes from request.query", () => {
    const ctx = baseContext({ query: { q: "hello" } });
    expect(substitute("search:{{request.query.q}}", ctx)).toBe("search:hello");
  });

  test("substitutes from request.headers (single-word key)", () => {
    const ctx = baseContext({ headers: { host: "example.test" } });
    expect(substitute("host:{{request.headers.host}}", ctx)).toBe(
      "host:example.test"
    );
  });

  test("substitutes hyphenated header keys (user-agent, content-type, x-api-key)", () => {
    // Most interesting HTTP headers have hyphens. The variable regex must
    // accept them or we silently leak `{{...}}` to the caller (AC3 violation
    // surfaced in fed's live test).
    const ctx = baseContext({
      headers: {
        "user-agent": "TildaTest/1.0",
        "content-type": "application/json",
        "x-api-key": "secret",
      },
    });

    expect(substitute("ua={{request.headers.user-agent}}", ctx)).toBe(
      "ua=TildaTest/1.0"
    );
    expect(
      substitute("ct={{ request.headers.content-type }}", ctx)
    ).toBe("ct=application/json");
    expect(substitute("k={{request.headers.x-api-key}}", ctx)).toBe(
      "k=secret"
    );
  });

  test("substitutes hyphenated path-param names", () => {
    // `:kebab-case` segments capture the literal key including the hyphen, so
    // the template regex needs to accept it for the lookup to round-trip.
    const ctx = baseContext({ params: { "user-id": "42" } });
    expect(substitute("id={{request.params.user-id}}", ctx)).toBe("id=42");
  });

  test("substitutes a body field by dotted path", () => {
    const ctx = baseContext({ body: { user: { id: "u-1" } } });
    expect(substitute("hello {{request.body.user.id}}", ctx)).toBe("hello u-1");
  });

  test("multiple substitutions in one string", () => {
    const ctx = baseContext({
      params: { id: "42" },
      query: { q: "ping" },
    });
    expect(
      substitute("/{{request.params.id}}?q={{request.query.q}}", ctx)
    ).toBe("/42?q=ping");
  });

  test("coerces non-string scalars to their string representation", () => {
    const ctx = baseContext({ body: { count: 42, ok: true } });
    expect(substitute("count={{request.body.count}}", ctx)).toBe("count=42");
    expect(substitute("ok={{request.body.ok}}", ctx)).toBe("ok=true");
  });

  test("does not recurse into substituted output", () => {
    // The body contains a `{{...}}`-like literal. We must NOT re-template it.
    const ctx = baseContext({
      params: { id: "{{request.params.id}}" },
    });
    expect(substitute("got {{request.params.id}}", ctx)).toBe(
      "got {{request.params.id}}"
    );
  });
});

describe("substitute (objects, arrays, primitives)", () => {
  test("walks object values and substitutes string leaves", () => {
    const ctx = baseContext({ params: { id: "42" } });
    expect(
      substitute(
        { id: "{{request.params.id}}", static: "literal" },
        ctx
      )
    ).toEqual({ id: "42", static: "literal" });
  });

  test("recurses into nested objects", () => {
    const ctx = baseContext({ params: { id: "42" } });
    expect(
      substitute(
        { user: { id: "{{request.params.id}}", role: "admin" } },
        ctx
      )
    ).toEqual({ user: { id: "42", role: "admin" } });
  });

  test("walks arrays element-wise", () => {
    const ctx = baseContext({ params: { id: "42" } });
    expect(
      substitute(
        { ids: ["{{request.params.id}}", "static", { nested: "{{request.params.id}}" }] },
        ctx
      )
    ).toEqual({ ids: ["42", "static", { nested: "42" }] });
  });

  test("does not substitute object keys", () => {
    const ctx = baseContext({ params: { id: "42" } });
    // The key `{{request.params.id}}` must survive verbatim; only the value templates.
    const result = substitute(
      { "{{request.params.id}}": "value-{{request.params.id}}" },
      ctx
    ) as Record<string, string>;
    expect(Object.keys(result)).toEqual(["{{request.params.id}}"]);
    expect(result["{{request.params.id}}"]).toBe("value-42");
  });

  test("passes through numbers, booleans, and null unchanged", () => {
    const ctx = baseContext();
    expect(
      substitute({ n: 42, b: true, nil: null, zero: 0 } as unknown as object, ctx)
    ).toEqual({ n: 42, b: true, nil: null, zero: 0 });
  });

  test("non-templated body is returned with the same shape (AC4)", () => {
    const ctx = baseContext({ params: { id: "42" } });
    const body = { user: { id: "u-1", name: "Mitch" }, tags: ["a", "b"] };
    expect(substitute(body, ctx)).toEqual(body);
  });

  test("undefined body passes through", () => {
    expect(substitute(undefined, baseContext())).toBeUndefined();
  });
});

describe("substitute (missing variables)", () => {
  test("missing variable warns and substitutes empty string", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = baseContext({ params: {} });

    expect(substitute("id={{request.params.id}}", ctx)).toBe("id=");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("request.params.id");
  });

  test("warning includes the request descriptor when provided", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = baseContext({ params: {} });

    substitute("id={{request.params.id}}", ctx, "GET /users/42");
    expect(warn.mock.calls[0]?.[0]).toContain("GET /users/42");
  });

  test("a path that bottoms out before consuming all segments is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = baseContext({ body: { user: "string-not-an-object" } });

    expect(substitute("name={{request.body.user.name}}", ctx)).toBe("name=");
    expect(warn).toHaveBeenCalledOnce();
  });

  test("a present-but-null value is treated as missing (warns + empty)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = baseContext({ body: { id: null } });

    expect(substitute("id={{request.body.id}}", ctx)).toBe("id=");
    expect(warn).toHaveBeenCalledOnce();
  });

  test("an empty-string value is *not* missing (no warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = baseContext({ params: { id: "" } });

    expect(substitute("id=[{{request.params.id}}]", ctx)).toBe("id=[]");
    expect(warn).not.toHaveBeenCalled();
  });
});
