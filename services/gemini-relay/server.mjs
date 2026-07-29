import http from "node:http";
import { isAllowedPath, isAuthorized, readJsonBody, RelayError } from "./relay.mjs";

const port = Number(process.env.PORT || 8080);
const sharedSecret = process.env.RELAY_SHARED_SECRET || "";

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://relay.internal");
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true });
    }
    if (request.method !== "POST" || !isAllowedPath(url.pathname)) {
      return json(response, 404, { error: "not_found" });
    }
    if (!isAuthorized(request.headers.authorization, sharedSecret)) {
      return json(response, 401, { error: "unauthorized" });
    }
    const apiKey = String(request.headers["x-goog-api-key"] || "");
    if (!apiKey || apiKey.length > 256) {
      return json(response, 400, { error: "missing_api_key" });
    }
    const body = await readJsonBody(request);
    const upstream = await fetch(`https://generativelanguage.googleapis.com${url.pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
      signal: AbortSignal.timeout(150_000),
    });
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    if (error instanceof RelayError) return json(response, error.status, { error: error.message });
    if (error?.name === "TimeoutError") return json(response, 504, { error: "upstream_timeout" });
    return json(response, 502, { error: "upstream_unavailable" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`TIMIU Gemini relay listening on port ${port}`);
});

function json(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}
