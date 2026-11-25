// keepsy.gaelcloud.org en el NAS (detrás de cloudflared → 127.0.0.1:8095).
// - /api y /media → backend FastAPI (keepsy-api.service, 127.0.0.1:8096). Mismo origen: sin CORS.
// - Todo lo demás → build estático del frontend (dist/), con fallback SPA a index.html.
// Lo sube deploy-nas.sh; no editar a mano en el NAS.
import { createServer, request as httpRequest } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.env.KEEPSY_ROOT || fileURLToPath(new URL("./dist", import.meta.url)));
const port = Number(process.env.PORT || 8095);
const apiHost = process.env.KEEPSY_API_HOST || "127.0.0.1";
const apiPort = Number(process.env.KEEPSY_API_PORT || 8096);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
};

const sendFile = (res, file, info) => {
  res.writeHead(200, {
    "content-type": types[extname(file)] || "application/octet-stream",
    "content-length": info.size,
    "cache-control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
};

const esBackend = (pathname) =>
  pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/media/");

/** Reenvía la request tal cual (método, headers, body en streaming: sirve para subidas multipart). */
function proxy(req, res) {
  const headers = {
    ...req.headers,
    "x-forwarded-proto": "https",
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-for": req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "",
  };
  const upstream = httpRequest(
    { host: apiHost, port: apiPort, method: req.method, path: req.url, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (e) => {
    console.error(`proxy ${req.method} ${req.url}: ${e.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "BadGateway", message: "El servidor no está disponible" }));
    } else res.destroy();
  });
  req.pipe(upstream);
}

createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return send(res, 400, "Bad Request");
  }

  if (esBackend(pathname)) return proxy(req, res);

  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed");

  const file = normalize(join(root, pathname));
  if (file !== root && !file.startsWith(root + sep)) return send(res, 403, "Forbidden");

  try {
    const info = await stat(file);
    if (info.isFile()) return sendFile(res, file, info);
  } catch {
    // no existe: cae al fallback SPA
  }

  // Rutas de React Router (/u/ana.rios, /mensajes...) → index.html
  const index = join(root, "index.html");
  sendFile(res, index, await stat(index));
}).listen(port, "127.0.0.1", () => {
  console.log(`keepsy en http://127.0.0.1:${port} desde ${root}; /api y /media → ${apiHost}:${apiPort}`);
});
