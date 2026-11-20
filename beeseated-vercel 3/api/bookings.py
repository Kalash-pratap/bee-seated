import json
import sqlite3
import time
import hashlib
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
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        user_id = params.get('user_id', [None])[0]
        
        if not user_id:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "user_id required"}).encode())
            return

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT user_id, display_name, role, college, credits FROM users WHERE user_id = ?", (user_id,))
        u = c.fetchone()
        if not u:
            conn.close()
            self.wfile.write(json.dumps({"success": False, "message": "User not found"}).encode())
            return

        c.execute("""
            SELECT b.booking_ref, e.title, b.seats_json, e.date_str, b.status, b.hmac_signature, b.checked_in
            FROM bookings b JOIN events e ON b.event_id = e.id
            WHERE b.user_id = ? ORDER BY b.created_at DESC
        """, (user_id,))
        bookings = []
        for b in c.fetchall():
            bookings.append({
                "booking_ref": b[0], "event_title": b[1], "seats": json.loads(b[2]), "date": b[3],
                "status": b[4], "hmac": b[5], "checked_in": bool(b[6])
            })

        now = time.time()
        c.execute("SELECT seat_id, held_until FROM seats WHERE held_by = ? AND held_until > ?", (user_id, now))
        holds = [{"seat_id": h[0], "remaining": int(h[1] - now)} for h in c.fetchall()]

        conn.close()
        self.wfile.write(json.dumps({
            "success": True,
            "user": {"user_id": u[0], "display_name": u[1], "role": u[2], "college": u[3], "credits": u[4]},
            "bookings": bookings,
            "active_holds": holds
        }).encode())

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else '{}'
        try:
            data = json.loads(post_body)
        except Exception:
            data = {}

        action = data.get('action')
        
        if action == 'confirm':
            event_id = data.get('event_id')
            user_id = data.get('user_id')
            seats = data.get('seats', [])
            idempotency_key = data.get('idempotency_key') or f"IDEMP-{int(time.time()*1000)}"
            
            if not event_id or not user_id or not seats:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "event_id, user_id, and seats required"}).encode())
                return

            conn = get_db()
            c = conn.cursor()

            # Idempotency check
            c.execute("SELECT booking_ref, seats_json, total_amount, hmac_signature FROM bookings WHERE idempotency_key = ?", (idempotency_key,))
            existing = c.fetchone()
            if existing:
                conn.close()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "idempotent": True,
                    "booking_ref": existing[0],
                    "seats": json.loads(existing[1]),
                    "total_amount": existing[2],
                    "hmac": existing[3]
                }).encode())
                return

            c.execute("BEGIN IMMEDIATE")
            now = time.time()
            placeholders = ','.join('?' for _ in seats)
            query = f"SELECT seat_id, status, held_by FROM seats WHERE event_id = ? AND seat_id IN ({placeholders})"
            c.execute(query, [event_id] + seats)
            rows = c.fetchall()

            if len(rows) != len(seats):
                conn.rollback()
                conn.close()
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Invalid seat list"}).encode())
                return

            for r in rows:
                if r[1] == 'booked':
                    conn.rollback()
                    conn.close()
                    self.send_response(409)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "message": f"Seat {r[0]} is already booked"}).encode())
                    return
                if r[1] == 'held' and r[2] != user_id:
                    conn.rollback()
                    conn.close()
                    self.send_response(409)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "message": f"Hold expired for seat {r[0]}"}).encode())
                    return

            c.execute("SELECT price FROM events WHERE id = ?", (event_id,))
            ev_price = c.fetchone()[0]
            total = ev_price * len(seats)

            booking_ref = f"BE-{int(time.time()*1000)%1000000:06d}"
            hmac_sig = hashlib.sha256(f"BEESEATED:{booking_ref}:{user_id}:{now}".encode()).hexdigest()[:16].upper()

            for s in seats:
                c.execute("UPDATE seats SET status = 'booked', booked_by = ?, booking_ref = ?, held_by = NULL, held_until = 0 WHERE event_id = ? AND seat_id = ?",
                          (user_id, booking_ref, event_id, s))

            c.execute("UPDATE users SET credits = MAX(0, credits - ?) WHERE user_id = ?", (total, user_id))

            c.execute("INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'confirmed')",
                      (booking_ref, idempotency_key, event_id, user_id, json.dumps(seats), total, hmac_sig, now))

            conn.commit()
            conn.close()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "booking_ref": booking_ref,
                "seats": seats,
                "total_amount": total,
                "hmac": hmac_sig
            }).encode())

        elif action == 'checkin':
            booking_ref = data.get('booking_ref', '').strip().upper()
            if not booking_ref:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "booking_ref required"}).encode())
                return

            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT booking_ref, user_id, seats_json, checked_in FROM bookings WHERE booking_ref = ?", (booking_ref,))
            row = c.fetchone()
            if not row:
                conn.close()
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": "Booking not found"}).encode())
                return

            if row[3] == 1:
                conn.close()
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "message": f"Pass {booking_ref} already scanned and checked in."}).encode())
                return

            now = time.time()
            c.execute("UPDATE bookings SET checked_in = 1, checked_in_at = ? WHERE booking_ref = ?", (now, booking_ref))
            conn.commit()
            conn.close()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "booking_ref": row[0],
                "user_id": row[1],
                "seats": json.loads(row[2])
            }).encode())

        else:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": "Invalid action"}).encode())
