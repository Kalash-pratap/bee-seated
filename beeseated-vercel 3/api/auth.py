import json
import sqlite3
import time
import pathlib
from http.server import BaseHTTPRequestHandler

DB_FILE = pathlib.Path(__file__).parent.parent / "beeseated.db"

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else '{}'
        try:
            data = json.loads(post_body)
        except Exception:
            data = {}

        user_id = data.get('user_id', '').strip().upper()
        college = data.get('college') or 'IIT Bombay'
        display_name = data.get('display_name')
        role = data.get('role', 'student')
        
        if not user_id:
            user_id = f"BEE-{int(time.time()*1000)%100000}"

        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT user_id, display_name, role, college, credits FROM users WHERE user_id = ?", (user_id,))
        row = c.fetchone()
        if not row:
            name = display_name or f"Student {user_id[-4:]}"
            c.execute("INSERT INTO users VALUES (?, ?, ?, ?, 5000, ?, ?)", 
                      (user_id, name, role, college, user_id.lower(), time.time()))
            conn.commit()
            user = {"user_id": user_id, "display_name": name, "role": role, "college": college, "credits": 5000}
        else:
            user = {"user_id": row[0], "display_name": row[1], "role": row[2], "college": row[3], "credits": row[4]}

        conn.close()

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"success": True, "user": user}).encode())
