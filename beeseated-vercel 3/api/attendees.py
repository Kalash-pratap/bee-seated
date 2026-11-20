import json
import sqlite3
import pathlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DB_FILE = pathlib.Path(__file__).parent.parent / "beeseated.db"

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
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
        c = conn.cursor()
        c.execute("""
            SELECT b.booking_ref, b.user_id, u.display_name, b.seats_json, b.total_amount, b.checked_in, b.created_at
            FROM bookings b LEFT JOIN users u ON b.user_id = u.user_id
            WHERE b.event_id = ? ORDER BY b.created_at DESC
        """, (event_id,))
        attendees = []
        for r in c.fetchall():
            attendees.append({
                "booking_ref": r[0], "user_id": r[1], "name": r[2] or r[1],
                "seats": json.loads(r[3]), "amount": r[4], "checked_in": bool(r[5]), "time": r[6]
            })
        conn.close()
        self.wfile.write(json.dumps({"success": True, "attendees": attendees}).encode())
