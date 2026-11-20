import json
import sqlite3
import os
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
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        conn = get_db()
        c = conn.cursor()
        c.execute("""
            SELECT id, title, category, date_str, venue, total_seats, price, image_url, description, college_affiliation, city
            FROM events
        """)
        rows = c.fetchall()
        events = []
        for r in rows:
            c.execute("SELECT COUNT(*) FROM seats WHERE event_id = ? AND status = 'available'", (r[0],))
            avail = c.fetchone()[0]
            events.append({
                "id": r[0], "title": r[1], "category": r[2], "date": r[3],
                "venue": r[4], "totalSeats": r[5], "seatsAvailable": avail,
                "pricePerSeat": r[6], "image": r[7], "description": r[8],
                "college": r[9], "city": r[10]
            })
        conn.close()
        self.wfile.write(json.dumps({"success": True, "events": events}).encode())

if __name__ == '__main__':
    # For local testing
    from http.server import HTTPServer
    server = HTTPServer(('', 8000), handler)
    server.serve_forever()
