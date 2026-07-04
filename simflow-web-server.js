const fs = require("fs");
const http = require("http");
const path = require("path");

const port = Number(process.argv[2] || 8765);
const root = path.resolve(process.argv[3] || __dirname);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((request, response) => {
  try {
    const requestURL = new URL(request.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(requestURL.pathname);
    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500);
        response.end(error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      response.end(data);
    });
  } catch {
    response.writeHead(500);
    response.end("Server error");
  }
});

server.listen(port, "127.0.0.1");
