import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "embedder"))
import service  # noqa: E402


class handler(BaseHTTPRequestHandler):
    """POST a JPEG, get its faces back as 512-d embeddings. Called only by /api/uploads."""

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        service.respond(self, *service.handle(body, self.headers.get("x-embed-secret", "")))
