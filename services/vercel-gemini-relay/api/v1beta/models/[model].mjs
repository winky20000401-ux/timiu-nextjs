import { isAllowedPath, isAuthorized, readJsonBody, RelayError } from "../../../relay.mjs";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url || "/", "https://relay.local");
    const pathname = url.pathname.replace(/^\/api/, "");
    if (request.method !== "POST" || !isAllowedPath(pathname)) {
      return json(response, 404, { error: "not_found" });
    }
    if (!isAuthorized(request.headers.authorization, process.env.RELAY_SHARED_SECRET || "")) {
      return json(response, 401, { error: "unauthorized" });
    }
    const apiKey = String(request.headers["x-goog-api-key"] || "");
    if (!apiKey || apiKey.length > 256) {
      return json(response, 400, { error: "missing_api_key" });
    }

    const body = await readJsonBody(request);
    const upstream = await fetch(`https://generativelanguage.googleapis.com${pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
      signal: AbortSignal.timeout(150_000),
    });

    response.status(upstream.status);
    response.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    response.setHeader("cache-control", "no-store");
    response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    if (error instanceof RelayError) return json(response, error.status, { error: error.message });
    if (error?.name === "TimeoutError") return json(response, 504, { error: "upstream_timeout" });
    return json(response, 502, { error: "upstream_unavailable" });
  }
}

function json(response, status, value) {
  response.status(status);
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.json(value);
}
