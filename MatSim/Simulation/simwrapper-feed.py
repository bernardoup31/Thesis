import http.server
import socketserver

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

socketserver.TCPServer.allow_reuse_address = True

print("Servidor de TESTE a correr na porta 8000 :)")
socketserver.TCPServer(("", 8000), CORSRequestHandler).serve_forever()