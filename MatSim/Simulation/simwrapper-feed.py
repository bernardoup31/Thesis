import http.server
import socketserver

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

socketserver.TCPServer.allow_reuse_address = True

print("Starting CORS-enabled HTTP server on port 8000...")
socketserver.TCPServer(("", 8000), CORSRequestHandler).serve_forever()