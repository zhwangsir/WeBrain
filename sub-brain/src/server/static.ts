import type { FastifyInstance } from "fastify";
import staticPlugin from "@fastify/static";
import { join, resolve as pathResolve } from "path";
import { existsSync } from "fs";

export function registerStatic(app: FastifyInstance, dirname: string): string | undefined {
  let frontendDist: string | undefined;
  const frontendPaths = [
    pathResolve(dirname, "../../frontend/dist"),
    pathResolve(dirname, "../frontend/dist"),
    pathResolve(dirname, "./frontend/dist"),
  ];
  frontendDist = frontendPaths.find((p) => existsSync(join(p, "index.html")));

  if (frontendDist) {
    app.register(staticPlugin, {
      root: frontendDist,
      prefix: "/",
      wildcard: false,
    });
    // Serve assets explicitly since wildcard:false doesn't cover subdirs
    app.get("/assets/*", async (request, reply) => {
      const filePath = (request.params as Record<string, string>)["*"];
      await reply.sendFile(join("assets", filePath));
    });
    // Support /api/* prefix for frontend consistency
    app.all("/api/*", async (request, reply) => {
      const path = (request.raw.url || "").replace(/^\/api/, "");
      const response = await app.inject({
        method: request.method as any,
        url: path,
      });
      reply.code((response as any).statusCode).send((response as any).payload);
    });

    // Prevent browser from caching index.html across builds
    app.addHook("onSend", async (request, reply, payload) => {
      if (request.url === "/" || request.url === "/index.html") {
        reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
        reply.header("Pragma", "no-cache");
        reply.header("Expires", "0");
      }
      return payload;
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/brain/") || request.url.startsWith("/assets/")) {
        reply.code(404).send({ error: "Not found" });
      } else {
        await reply.sendFile("index.html");
      }
    });
    app.log.info(`[static] Serving frontend from ${frontendDist}`);
  } else {
    app.log.warn("[static] Frontend dist not found. UI will not be available.");
  }
  return frontendDist;
}
