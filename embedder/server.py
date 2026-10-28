"""Local dev server for the embedder: .venv/bin/python embedder/server.py (port 3211), with
EMBED_URL=http://localhost:3211 in .env.local. Uses AUTH_SECRET from the environment."""

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import service


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        service.respond(self, *service.handle(body, self.headers.get("x-embed-secret", "")))


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", 3211))), Handler).serve_forever()
