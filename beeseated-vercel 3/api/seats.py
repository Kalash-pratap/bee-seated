import json
import sqlite3
import time
import pathlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DB_FILE = pathlib.Path(__file__).parent.parent / "beeseated.db"

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

def cleanup_expired_holds(db, event_id):
    now = time.time()
    db.execute("UPDATE seats SET status = 'available', held_by = NULL, held_until = 0 WHERE event_id = ? AND status = 'held' AND held_until < ?", (event_id, now))
    db.commit()

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        event_id = params.get('event_id', [None])[0]
        
        if not event_id:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "event_id required"}).encode())
            return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        conn = get_db()
        cleanup_expired_holds(conn, event_id)
        c = conn.cursor()
        c.execute("SELECT seat_id, row_id, col_num, is_accessible, status, held_by, held_until, booked_by FROM seats WHERE event_id = ?", (event_id,))
        rows = c.fetchall()
        seats = []
        for r in rows:
            seats.append({
                "seat_id": r[0], "row": r[1], "col": r[2], "accessible": bool(r[3]),
                "status": r[4], "held_by": r[5], "held_until": r[6]
            })
        conn.close()
        self.wfile.write(json.dumps({"success": True, "event_id": event_id, "seats": seats}).encode())

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else '{}'
        try:
            data = json.loads(post_body)
        except Exception:
            data = {}

        action = data.get('action')
        
        if action == 'hold':
            event_id = data.get('event_id')
            seat_id = data.get('seat_id')
            user_id = data.get('user_id', 'GUEST')
            
            if not event_id or not seat_id:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "event_id and seat_id required"}).encode())
                return

            conn = get_db()
            now = time.time()
            cleanup_expired_holds(conn, event_id)
            c = conn.cursor()
            c.execute("SELECT status, held_by, held_until FROM seats WHERE event_id = ? AND seat_id = ?", (event_id, seat_id))
            row = c.fetchone()
            if not row:
                conn.close()
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Seat not found"}).encode())
                return

            status, held_by, held_until = row
            if status == 'booked':
                conn.close()
                self.send_response(409)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": f"Seat {seat_id} is already booked."}).encode())
                return

            if status == 'held' and held_by != user_id and held_until > now:
                conn.close()
                self.send_response(409)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": f"Seat {seat_id} is held by another user lease."}).encode())
                return

            lease_until = now + 300.0
            c.execute("UPDATE seats SET status = 'held', held_by = ?, held_until = ? WHERE event_id = ? AND seat_id = ?",
                      (user_id, lease_until, event_id, seat_id))
            conn.commit()
            conn.close()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True, "seat_id": seat_id, "lease_until": lease_until, "expires_in": 300
            }).encode())

        elif action == 'release':
            event_id = data.get('event_id')
            seat_id = data.get('seat_id')
            user_id = data.get('user_id')
            
            if not event_id or not seat_id or not user_id:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "event_id, seat_id, and user_id required"}).encode())
                return

            conn = get_db()
            c = conn.cursor()
            c.execute("UPDATE seats SET status = 'available', held_by = NULL, held_until = 0 WHERE event_id = ? AND seat_id = ? AND held_by = ?", (event_id, seat_id, user_id))
            conn.commit()
            conn.close()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())

        else:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Invalid action"}).encode())
