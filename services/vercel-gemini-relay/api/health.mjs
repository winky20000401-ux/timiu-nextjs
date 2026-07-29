export default function handler(_request, response) {
  response
    .status(200)
    .setHeader("cache-control", "no-store")
    .json({ ok: true, service: "timiu-gemini-relay" });
}
