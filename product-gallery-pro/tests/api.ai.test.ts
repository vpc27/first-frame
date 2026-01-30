import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../app/routes/api.ai.$.tsx";

vi.mock("~/lib/ollama.server", () => ({
  checkOllamaHealth: vi.fn(),
  generateAltText: vi.fn(),
  scoreImageQuality: vi.fn(),
}));

async function getLoader(path: string) {
  const request = new Request(`http://test/api/ai/${path}`);
  return loader({ request, params: {}, context: {} } as any);
}

async function getAction(path: string, body: object) {
  const request = new Request(`http://test/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return action({ request, params: {}, context: {} } as any);
}

describe("api.ai.$.tsx loader", () => {
  beforeEach(async () => {
    const ollama = await import("~/lib/ollama.server");
    vi.mocked(ollama.checkOllamaHealth).mockResolvedValue(true);
  });

  it("GET /api/ai/health returns available when Ollama is healthy", async () => {
    const res = await getLoader("health");
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, data: { available: true } });
  });

  it("GET /api/ai/health returns available: false when Ollama is down", async () => {
    const ollama = await import("~/lib/ollama.server");
    vi.mocked(ollama.checkOllamaHealth).mockResolvedValue(false);
    const res = await getLoader("health");
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, data: { available: false } });
  });

  it("GET /api/ai/unknown returns 404", async () => {
    const res = await getLoader("unknown");
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not found");
  });
});

describe("api.ai.$.tsx action", () => {
  beforeEach(async () => {
    const ollama = await import("~/lib/ollama.server");
    vi.mocked(ollama.generateAltText).mockResolvedValue({
      success: true,
      data: { altText: "Test alt", confidence: 0.9, keywords: [] },
    });
    vi.mocked(ollama.scoreImageQuality).mockResolvedValue({
      success: true,
      data: {
        overallScore: 85,
        factors: {},
        topIssue: null,
        recommendation: "Looks good",
        isAcceptable: true,
      },
    });
  });

  it("POST /api/ai/alt-text returns 400 when imageUrl or productTitle missing", async () => {
    const res1 = await getAction("alt-text", { productTitle: "A" });
    expect(res1.status).toBe(400);
    const d1 = await res1.json();
    expect(d1.success).toBe(false);
    expect(d1.error).toContain("imageUrl");

    const res2 = await getAction("alt-text", { imageUrl: "http://x/y.png" });
    expect(res2.status).toBe(400);
    const d2 = await res2.json();
    expect(d2.error).toContain("productTitle");
  });

  it("POST /api/ai/alt-text returns result from generateAltText", async () => {
    const res = await getAction("alt-text", {
      imageUrl: "https://cdn.example/img.png",
      productTitle: "Blue Widget",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data?.altText).toBe("Test alt");
  });

  it("POST /api/ai/quality-score returns 400 when imageUrl missing", async () => {
    const res = await getAction("quality-score", {});
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("imageUrl");
  });

  it("POST /api/ai/quality-score returns result from scoreImageQuality", async () => {
    const res = await getAction("quality-score", {
      imageUrl: "https://cdn.example/img.png",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data?.overallScore).toBe(85);
  });

  it("POST /api/ai/unknown returns 404", async () => {
    const res = await getAction("unknown", {});
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Unknown AI endpoint");
  });
});
