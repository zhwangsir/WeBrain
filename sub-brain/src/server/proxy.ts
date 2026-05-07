import type { FastifyInstance } from "fastify";

export function registerBrainProxy(
  app: FastifyInstance,
  mainBrainUrl: string,
  useUds: boolean,
  mainBrainUds: string
): void {
  app.all("/brain/*", async (request, reply) => {
    const axios = (await import("axios")).default;
    const path = (request.raw.url || "").replace(/^\/brain/, "");
    const url = `${mainBrainUrl}${path}`;
    const traceId = (request as any).traceId || "";
    const axiosConfig: any = {
      method: request.method as any,
      url,
      data: request.body,
      headers: { "Content-Type": "application/json", "x-trace-id": traceId },
      timeout: 120000,
      responseType: request.headers.accept?.includes("text/event-stream") ? "stream" : "json",
    };
    if (useUds) {
      axiosConfig.socketPath = mainBrainUds;
    }
    try {
      const response = await axios(axiosConfig);
      const contentType = response.headers?.["content-type"];
      if (contentType) reply.header("Content-Type", contentType);
      reply.code(response.status).send(response.data);
    } catch (err: any) {
      const status = err.response?.status || 500;
      const data = err.response?.data || { error: err.message };
      reply.code(status).send(data);
    }
  });
}
