import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProject } from "../src/stores/api";
import { setToken } from "../src/stores/auth";

const originalFetch = globalThis.fetch;
const originalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);

function stubLocalStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
}

describe("project API", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
    vi.restoreAllMocks();
  });

  it("authenticates project deletion", async () => {
    stubLocalStorage();
    setToken("test-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(deleteProject("project-1")).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/projects/project-1");
    expect(options.method).toBe("DELETE");
    expect(new Headers(options.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
  });

  it("reports a rejected project deletion", async () => {
    stubLocalStorage();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(deleteProject("project-1")).resolves.toBe(false);
  });
});
