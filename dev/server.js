const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEV_DIR = __dirname;
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const clients = new Set();
const watchTargets = [
  path.join(ROOT_DIR, "styles.css"),
  path.join(ROOT_DIR, "main.js"),
  path.join(ROOT_DIR, "manifest.json"),
  path.join(ROOT_DIR, "src", "pebble-renderer.js"),
  path.join(DEV_DIR, "index.html"),
  path.join(DEV_DIR, "preview.css"),
  path.join(DEV_DIR, "preview-app.js"),
];

function sendReloadEvent(filename) {
  for (const response of clients) {
    response.write(`data: ${JSON.stringify({ type: "reload", filename })}\n\n`);
  }
}

function watchFile(filePath) {
  fs.watchFile(
    filePath,
    { interval: 200 },
    (currentStats, previousStats) => {
      if (currentStats.mtimeMs === previousStats.mtimeMs) {
        return;
      }
      sendReloadEvent(path.relative(ROOT_DIR, filePath));
    },
  );
}

function serveFile(response, filePath) {
  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }

    response.writeHead(200, {
      "Content-Type":
        MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(buffer);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/__events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    response.write("\n");
    clients.add(response);
    request.on("close", () => {
      clients.delete(response);
      response.end();
    });
    return;
  }

  if (requestUrl.pathname === "/") {
    serveFile(response, path.join(DEV_DIR, "index.html"));
    return;
  }

  if (requestUrl.pathname === "/styles.css") {
    serveFile(response, path.join(ROOT_DIR, "styles.css"));
    return;
  }

  if (requestUrl.pathname.startsWith("/src/")) {
    const filePath = path.join(ROOT_DIR, requestUrl.pathname);
    serveFile(response, filePath);
    return;
  }

  if (requestUrl.pathname.startsWith("/dev/")) {
    const filePath = path.join(ROOT_DIR, requestUrl.pathname);
    serveFile(response, filePath);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

for (const filePath of watchTargets) {
  watchFile(filePath);
}

server.listen(PORT, HOST, () => {
  console.log(`Pebble Tracker preview: http://${HOST}:${PORT}`);
});

process.on("SIGINT", () => {
  for (const filePath of watchTargets) {
    fs.unwatchFile(filePath);
  }
  server.close(() => process.exit(0));
});
