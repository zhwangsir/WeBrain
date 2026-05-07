import type { FastifyInstance } from "fastify";

export function registerAuth(app: FastifyInstance): void {
  const API_KEY = process.env.WEBRAIN_API_KEY || "";
  if (!API_KEY) return;

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url;
    // Public endpoints (no auth required)
    if (path === "/health" || path === "/" || path.startsWith("/assets/")) {
      return;
    }
    // Allow browser page navigation (SPA routes)
    if (request.headers.accept?.includes("text/html")) {
      return;
    }
    const authHeader = request.headers.authorization || "";
    const providedKey = authHeader.replace(/^Bearer\s+/i, "");
    if (providedKey !== API_KEY) {
      reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing API key" });
      return;
    }
  });

  app.log.info("[auth] API Key authentication enabled");
}
