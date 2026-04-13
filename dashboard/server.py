import http.server
import socketserver
import json
import time
import random
import threading

PORT = 8080

class BCIMockAPIHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/stream':
            # SSE (Server-Sent Events) for real-time brain waves
            self.send_response(200)
            self.send_header('Content-type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()
            
            try:
                while True:
                    t = time.time()
                    # Generate some mock "brain waves" (alpha/beta mix)
                    channels = []
                    for i in range(4):
                        val = (random.random() * 0.4) + (0.6 * __import__('math').sin(t * 10.0 + i))
                        channels.append(round(val, 3))
                        
                    data = {
                        "timestamp": t,
                        "channels": channels,
                        "status": "active"
                    }
                    self.wfile.write(f"data: {json.dumps(data)}\n\n".encode())
                    self.wfile.flush()
                    time.sleep(0.1)  # 10Hz update rate to browser
            except (ConnectionResetError, BrokenPipeError):
                pass
        else:
            return super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), BCIMockAPIHandler) as httpd:
        print(f"BCISW Dashboard serving at http://localhost:{PORT}")
        httpd.serve_forever()
