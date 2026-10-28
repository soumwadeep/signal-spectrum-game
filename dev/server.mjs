import http from "node:http";
import { application } from "../functions/game.mjs";
import { createMemoryRepo } from "./memory-repo.mjs";

const repo = createMemoryRepo();
const game = application({ repo });
const port = Number(process.env.PORT ?? 8000);

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host ?? `127.0.0.1:${port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
    const response = await game(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("local function error", error?.code ?? error?.message ?? "unknown");
    res.statusCode = 503;
    res.setHeader("cache-control", "no-store");
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "service_unavailable" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SIGNAL development function on http://127.0.0.1:${port}`);
});
