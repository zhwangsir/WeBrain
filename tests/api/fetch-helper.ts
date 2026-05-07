// fetch-based HTTP helper for Vitest fork pool compatibility
// Replaces axios to avoid DataCloneError during serialization

export async function getJson(url: string, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const resp = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  return { status: resp.status, data: await resp.json() };
}

export async function postJson(url: string, body: unknown, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timer);
  return { status: resp.status, data: await resp.json() };
}

export async function deleteJson(url: string, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const resp = await fetch(url, { method: "DELETE", signal: controller.signal });
  clearTimeout(timer);
  return { status: resp.status, data: await resp.json() };
}
