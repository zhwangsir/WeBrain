import type { FastifyInstance } from "fastify";
import { Registry, Counter, Histogram, collectDefaultMetrics } from "prom-client";

const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export function registerMetrics(app: FastifyInstance): void {
  app.get("/metrics", async (_request, reply) => {
    reply.header("Content-Type", register.contentType);
    reply.send(await register.metrics());
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = request.routerPath || request.url;
    const method = request.method;
    const status = String(reply.statusCode);
    httpRequestsTotal.inc({ method, route, status_code: status });
    httpRequestDuration.observe({ method, route, status_code: status }, reply.elapsedTime / 1000);
  });
}
