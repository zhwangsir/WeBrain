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
    const isStream = request.headers.accept?.includes("text/event-stream");

    const axiosConfig: any = {
      method: request.method as any,
      url,
      data: request.body,
      headers: { "Content-Type": "application/json", "x-trace-id": traceId },
      timeout: 120000,
      responseType: isStream ? "stream" : "json",
    };
    if (useUds) {
      axiosConfig.socketPath = mainBrainUds;
    }

    try {
      const response = await axios(axiosConfig);
      const contentType = response.headers?.["content-type"];
      if (contentType) reply.header("Content-Type", contentType);

      if (isStream && response.data?.pipe) {
        // SSE stream: pipe axios response stream directly to client
        reply.code(response.status);
        response.data.pipe(reply.raw);
        return;
      }

      reply.code(response.status).send(response.data);
    } catch (err: any) {
      const status = err.response?.status || 500;
      const data = err.response?.data || { error: err.message };
      reply.code(status).send(data);
    }
  });
}
