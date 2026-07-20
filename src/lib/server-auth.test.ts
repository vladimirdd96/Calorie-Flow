import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticatePaidFeature } from "./server-auth";

afterEach(() => vi.unstubAllGlobals());

describe("authenticatePaidFeature", () => {
  const config = { supabaseUrl: "https://project.supabase.co", publishableKey: "public-key" };

  it("fails closed when account verification is not configured", async () => {
    const result = await authenticatePaidFeature(new Request("https://example.com/api/coach"), {});
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it("requires a bearer session before using paid features", async () => {
    const result = await authenticatePaidFeature(new Request("https://example.com/api/coach"), config);
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("returns only the verified user id and token", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: "user-123", email: "private@example.com" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await authenticatePaidFeature(new Request("https://example.com/api/coach", {
      headers: { Authorization: "Bearer session-token" },
    }), config);
    expect(result).toEqual({ ok: true, token: "session-token", userId: "user-123" });
    expect(fetchMock).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/user", expect.objectContaining({ cache: "no-store" }));
  });

  it("rejects malformed identity responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ email: "missing-id@example.com" })));
    const result = await authenticatePaidFeature(new Request("https://example.com/api/coach", {
      headers: { Authorization: "Bearer session-token" },
    }), config);
    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});
