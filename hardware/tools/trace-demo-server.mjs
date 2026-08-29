import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2]);
const port = Number(process.argv[3] || 8789);
const runtimeConfig = process.argv[4] ? resolve(process.argv[4]) : null;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (pathname === "/trace-device-config.js" && runtimeConfig) {
    try {
      const content = await readFile(runtimeConfig);
      response.writeHead(200, {
        "Content-Type": types[".js"],
        "Cache-Control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Runtime device configuration not found");
    }
    return;
  }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`TRACE demo: http://127.0.0.1:${port}\n`);
});
