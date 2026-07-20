import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./sites-worker.js";

function environment(overrides = {}) {
  return {
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/index.html") {
          return new Response("<!doctype html><title>Calorie Flow</title>", {
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response("Not found", { status: 404 });
      },
    },
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Sites Worker", () => {
  it("serves the PWA shell at the root", async () => {
    const response = await worker.fetch(new Request("https://example.com/"), environment());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Calorie Flow");
  });

  it("exposes a runtime health check", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/health"), environment());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", runtime: "static-pwa" });
  });

  it("reports missing AI configuration without crashing", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/analyze-label", { method: "POST", body: JSON.stringify({ image: "data:image/png;base64,AA==" }) }),
      environment(),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toHaveProperty("error");
  });

  it("requires a verified user before paid AI endpoints", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", { method: "POST", body: JSON.stringify({ message: "How am I doing today?" }) }),
      environment({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key", OPENAI_API_KEY: "secret" }),
    );
    expect(response.status).toBe(401);
  });

  it("blocks unrelated app-building requests inside the Coach", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ message: "Build me a JavaScript app" }),
      }),
      environment({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key", OPENAI_API_KEY: "secret" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ restricted: true });
  });

  it("lets the Coach call the private profile tool before answering", async () => {
    let openAICalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const value = String(url);
      if (value.includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      if (value.includes("/rest/v1/user_profiles")) return Response.json([{ data: { calorieTarget: 2500, proteinTarget: 160 } }]);
      if (value.includes("api.openai.com/v1/responses")) {
        openAICalls += 1;
        if (openAICalls === 1) return Response.json({ output: [{ type: "function_call", name: "get_profile", call_id: "call_1", arguments: "{}" }] });
        return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "Your target is 2,500 kcal." }] }] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ message: "What is my calorie target?" }),
      }),
      environment({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key", OPENAI_API_KEY: "secret" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ reply: "Your target is 2,500 kcal." });
    expect(openAICalls).toBe(2);
  });
});
