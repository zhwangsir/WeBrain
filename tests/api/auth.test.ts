import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Fastify for auth hook testing
const mockReply = {
  code: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
};

function createAuthHook(apiKey: string) {
  return async (request: any, reply: any) => {
    const path = request.url;
    if (path === "/health" || path === "/" || path.startsWith("/assets/")) {
      return;
    }
    const authHeader = request.headers.authorization || "";
    const providedKey = authHeader.replace(/^Bearer\s+/i, "");
    if (providedKey !== apiKey) {
      reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing API key" });
      return;
    }
  };
}

describe("API Key Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows public endpoints without auth", async () => {
    const hook = createAuthHook("secret-key");
    const req = { url: "/health", headers: {} };
    await hook(req, mockReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it("allows public root without auth", async () => {
    const hook = createAuthHook("secret-key");
    const req = { url: "/", headers: {} };
    await hook(req, mockReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it("rejects missing API key on protected route", async () => {
    const hook = createAuthHook("secret-key");
    const req = { url: "/api/agents", headers: {} };
    await hook(req, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Unauthorized" })
    );
  });

  it("rejects invalid API key", async () => {
    const hook = createAuthHook("secret-key");
    const req = { url: "/api/agents", headers: { authorization: "Bearer wrong-key" } };
    await hook(req, mockReply);
    expect(mockReply.code).toHaveBeenCalledWith(401);
  });

  it("accepts valid API key", async () => {
    const hook = createAuthHook("secret-key");
    const req = { url: "/api/agents", headers: { authorization: "Bearer secret-key" } };
    await hook(req, mockReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it("accepts Bearer prefix case-insensitively", async () => {
    const hook = createAuthHook("secret-key");
    const req = { url: "/api/agents", headers: { authorization: "bearer secret-key" } };
    await hook(req, mockReply);
    expect(mockReply.code).not.toHaveBeenCalled();
  });
});
