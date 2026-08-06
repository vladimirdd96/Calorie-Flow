import { describe, expect, it, vi } from "vitest";
import { isImportableUrl, safeFetchPage } from "./fetch";

const htmlResponse = (html: string) => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
const redirectTo = (location: string) => new Response(null, { status: 301, headers: { location } });

describe("isImportableUrl", () => {
  it("accepts a normal public https page", () => {
    expect(isImportableUrl("https://cooking.example.com/recipes/stew")).toBe(true);
  });

  it("rejects non-https schemes", () => {
    for (const url of ["http://cooking.example.com", "file:///etc/passwd", "ftp://example.com", "javascript:alert(1)"]) {
      expect(isImportableUrl(url), url).toBe(false);
    }
  });

  it("rejects loopback, link-local, and internal hosts", () => {
    for (const url of [
      "https://localhost/recipe",
      "https://127.0.0.1/recipe",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.5/recipe",
      "https://[::1]/recipe",
      "https://printer.local/recipe",
      "https://vault.internal/recipe",
    ]) {
      expect(isImportableUrl(url), url).toBe(false);
    }
  });

  it("rejects a hostname with no dot and an over-long url", () => {
    expect(isImportableUrl("https://intranet/recipe")).toBe(false);
    expect(isImportableUrl(`https://example.com/${"a".repeat(2_100)}`)).toBe(false);
  });
});

describe("safeFetchPage", () => {
  it("returns the markup of a public page", async () => {
    const fetchMock = vi.fn(async () => htmlResponse("<html>stew</html>"));
    await expect(safeFetchPage("https://cooking.example.com/stew", fetchMock)).resolves.toEqual({
      ok: true, html: "<html>stew</html>", finalUrl: "https://cooking.example.com/stew",
    });
  });

  it("follows a public redirect and reports the final url", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith("/old") ? redirectTo("https://cooking.example.com/new") : htmlResponse("<html>new</html>")));
    await expect(safeFetchPage("https://cooking.example.com/old", fetchMock as unknown as typeof fetch)).resolves.toMatchObject({ ok: true, finalUrl: "https://cooking.example.com/new" });
  });

  it("blocks a redirect that lands on a private host", async () => {
    const fetchMock = vi.fn(async () => redirectTo("https://169.254.169.254/latest/meta-data"));
    await expect(safeFetchPage("https://cooking.example.com/stew", fetchMock as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "blocked" });
  });

  it("stops after too many redirect hops", async () => {
    const fetchMock = vi.fn(async () => redirectTo("https://cooking.example.com/loop"));
    await expect(safeFetchPage("https://cooking.example.com/loop", fetchMock as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "unreachable" });
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("reports a bot block distinctly from an outage", async () => {
    const blocked = vi.fn(async () => new Response("", { status: 403 }));
    await expect(safeFetchPage("https://social.example.com/p/1", blocked as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "blocked" });
    const down = vi.fn(async () => new Response("", { status: 500 }));
    await expect(safeFetchPage("https://cooking.example.com/stew", down as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "unreachable" });
  });

  it("refuses a non-html document", async () => {
    const fetchMock = vi.fn(async () => new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } }));
    await expect(safeFetchPage("https://cooking.example.com/stew.pdf", fetchMock as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "not-html" });
  });

  it("never fetches an invalid url", async () => {
    const fetchMock = vi.fn();
    await expect(safeFetchPage("https://127.0.0.1/stew", fetchMock as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "invalid-url" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps how much of a page it reads", async () => {
    const huge = `<html>${"x".repeat(2_000_000)}</html>`;
    const fetchMock = vi.fn(async () => htmlResponse(huge));
    const result = await safeFetchPage("https://cooking.example.com/huge", fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(result.ok && result.html.length).toBeLessThan(huge.length);
  });

  it("surfaces a network failure as unreachable", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("dns"); });
    await expect(safeFetchPage("https://cooking.example.com/stew", fetchMock as unknown as typeof fetch)).resolves.toEqual({ ok: false, reason: "unreachable" });
  });
});
