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

  it("requires a verified user before optional AI endpoints", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", { method: "POST", body: JSON.stringify({ message: "How am I doing today?" }) }),
      environment({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" }),
    );
    expect(response.status).toBe(401);
  });

  it("also protects paid label analysis behind a verified session", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/analyze-label", { method: "POST", body: JSON.stringify({ image: "data:image/png;base64,AA==" }) }),
      environment({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" }),
    );
    expect(response.status).toBe(401);
  });

  it("accepts the native Workers AI response for label analysis", async () => {
    const aiRequests = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/analyze-label", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }),
      environment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-key",
        AI: {
          run: async (_model, input) => {
            aiRequests.push(input);
            return { response: JSON.stringify({
              productName: "Test drink", brand: "Test", barcode: null,
              per100: { calories: 42, protein: 0, carbs: 10, fat: 0, fiber: 0, sugar: 10 },
              servingSizeG: 330, packageSizeG: 330, confidence: "high", needsFollowUp: false, followUpQuestions: [],
            }) };
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ productName: "Test drink", per100: { calories: 42 } });
    expect(aiRequests[0].chat_template_kwargs).toEqual({ thinking: false });
  });

  it("analyzes a meal photo through the deployed Sites API", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/analyze-meal-photo", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }),
      environment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-key",
        AI: { run: async () => ({ response: JSON.stringify({ name: "Eggs and bread", mealType: "breakfast", amount: 1, unit: "serving", grams: 300, nutrition: { calories: 490, protein: 43, carbs: 17, fat: 27, fiber: 7, sugar: 4 }, components: ["3 eggs", "protein bread"], confidence: "high" }) }) },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ name: "Eggs and bread", nutrition: { calories: 490 } });
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
      environment({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ restricted: true });
  });

  it("lets the Coach call the private profile tool before answering", async () => {
    let aiCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const value = String(url);
      if (value.includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      if (value.includes("/rest/v1/user_profiles")) return Response.json([{ data: { calorieTarget: 2500, proteinTarget: 160 } }]);
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ message: "What is my calorie target?" }),
      }),
      environment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-key",
        AI: {
          run: async () => {
            aiCalls += 1;
            if (aiCalls === 1) return { choices: [{ message: { content: null, tool_calls: [{ id: "call_1", function: { name: "get_profile", arguments: "{}" } }] } }] };
            return { choices: [{ message: { content: "Your target is 2,500 kcal." } }] };
          },
        },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ reply: "Your target is 2,500 kcal." });
    expect(aiCalls).toBe(2);
  });

  it("routes Coach photo messages to the multimodal model", async () => {
    let requestedModel = "";
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const value = String(url);
      if (value.includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      if (value.includes("/rest/v1/user_profiles")) return Response.json([{ data: {} }]);
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ message: "What is in this meal?", image: "data:image/jpeg;base64,AA==" }),
      }),
      environment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-key",
        AI: { run: async (model, input) => { requestedModel = model; expect(input.chat_template_kwargs).toEqual({ thinking: false }); return { choices: [{ message: { content: "It looks like breakfast." } }] }; } },
      }),
    );
    expect(response.status).toBe(200);
    expect(requestedModel).toBe("@cf/moonshotai/kimi-k2.6");
  });

  it("returns a validated meal action when the Coach is asked to log a photo", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const value = String(url);
      if (value.includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      if (value.includes("/rest/v1/user_profiles")) return Response.json([{ data: {} }]);
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", {
        method: "POST", headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ message: "Yesterday's breakfast", image: "data:image/jpeg;base64,AA==" }),
      }),
      environment({
        SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key",
        AI: { run: async () => {
          calls += 1;
          if (calls === 1) return { choices: [{ message: { content: null, tool_calls: [{ id: "log_1", function: { name: "prepare_meal_log", arguments: JSON.stringify({ name: "Eggs and bread", mealType: "breakfast", amount: 1, unit: "serving", grams: 300, calories: 490, protein: 43, carbs: 17, fat: 27, fiber: 7, sugar: 4, loggedDate: "2026-07-20", estimated: false }) } }] } }] };
          return { choices: [{ message: { content: "I logged yesterday's breakfast." } }] };
        } },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mealAction: { name: "Eggs and bread", mealType: "breakfast", loggedDate: "2026-07-20" } });
    expect(calls).toBe(2);
  });

  it("redacts calorie values when the profile hides them", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const value = String(url);
      if (value.includes("/auth/v1/user")) return Response.json({ id: "00000000-0000-0000-0000-000000000001" });
      if (value.includes("/rest/v1/user_profiles")) return Response.json([{ data: { hideCalories: true, calorieTarget: 2500 } }]);
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    const response = await worker.fetch(
      new Request("https://example.com/api/coach", {
        method: "POST",
        headers: { Authorization: "Bearer valid-session" },
        body: JSON.stringify({ message: "How am I doing today?" }),
      }),
      environment({
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "public-key",
        AI: { run: async () => ({ choices: [{ message: { content: "You have 650 kcal left." } }] }) },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ reply: "You have energy hidden left." });
  });
});
