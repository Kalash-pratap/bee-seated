import sqlite3
import os
import pathlib

DB_FILE = pathlib.Path(__file__).parent.parent / "beeseated.db"

INDIAN_AND_CAMPUS_EVENTS = [
    (
        'EVT-MOOD26',
        'IIT Bombay Mood Indigo: Pronite Pro-Show Arena',
        'Campus Fests',
        'DEC 20, 2026 • 18:30 IST',
        'Gymkhana Grounds, IIT Bombay, Powai, Mumbai',
        112,
        499,
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
        'Asias largest college cultural festival. High-octane international headliners, stadium sound, and student-exclusive front row pits.',
        'IIT Bombay',
        'Mumbai'
    ),
    (
        'EVT-OAS26',
        'BITS Pilani Oasis 2026: Rocktaves & EDM Night',
        'Campus Fests',
        'NOV 26, 2026 • 20:00 IST',
        'Rotunda Amphitheatre, BITS Pilani Campus, Rajasthan',
        112,
        399,
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
        'Iconic 96-hour non-stop student cultural celebration featuring premier Indian indie bands and electronic artists.',
        'BITS Pilani',
        'Pilani'
    ),
    (
        'EVT-RDV26',
        'IIT Delhi Rendezvous: Dhoom Pronite Arena',
        'Campus Fests',
        'DEC 04, 2026 • 19:00 IST',
        'OAT Open Air Theatre, IIT Delhi, Hauz Khas, New Delhi',
        112,
        349,
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        'North Indias premier collegiate festival with live Bollywood pro-nites, fusion rock, and fashion spotlights.',
        'IIT Delhi',
        'Delhi NCR'
    ),
    (
        'EVT-MAL26',
        'St. Xaviers College Malhar: World Music Night',
        'Campus Fests',
        'DEC 12, 2026 • 17:30 IST',
        'The Quadrangle & Main Hall, St. Xaviers, Fort, Mumbai',
        112,
        299,
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
        'Mumbais heritage collegiate cultural festival with unplugged acoustic showcases, poetry slams, and theatre.',
        'St. Xaviers College',
        'Mumbai'
    ),
    (
        'EVT-DU26',
        'Delhi University Crossroads: SRCC Annual Fest',
        'Campus Fests',
        'JAN 22, 2027 • 16:30 IST',
        'SRCC Sports Complex, North Campus, Delhi University',
        112,
        249,
        'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
        'The flagship fest of Delhi University bringing student crowds, star performers, and university battle of the bands.',
        'Delhi University (SRCC)',
        'Delhi NCR'
    ),
    (
        'EVT-SRG26',
        'IIT Madras Saarang: Popular Night Acoustic Arena',
        'Campus Fests',
        'JAN 10, 2027 • 18:00 IST',
        'Open Air Theatre (OAT), IIT Madras, Chennai',
        112,
        350,
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
        'South Indias biggest student cultural gathering with global fusion pro-nites and classical symphony ensembles.',
        'IIT Madras',
        'Chennai'
    ),
    (
        'EVT-DLP26',
        'Zomato Feeding India Concert: Dua Lipa',
        'Concerts',
        'NOV 30, 2026 • 17:00 IST',
        'MMRDA Grounds, BKC, Mumbai',
        112,
        3499,
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
        'Global pop sensation Dua Lipa headlines Feeding India Concert with immersive acoustics and laser arrays. Student discount eligible.',
        'All Colleges',
        'Mumbai'
    ),
    (
        'EVT-DLT26',
        'Dil-Luminati India Tour: Diljit Dosanjh',
        'Concerts',
        'DEC 06, 2026 • 18:30 IST',
        'Jawaharlal Nehru Stadium, New Delhi',
        112,
        2999,
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        'The historic stadium tour bringing Punjabi powerhouse beats, high-energy visuals, and massive collegiate student wings.',
        'All Colleges',
        'Delhi NCR'
    ),
    (
        'EVT-SBN26',
        'Sunburn Goa 2026: Sunset Arena Stage',
        'Festivals',
        'DEC 28, 2026 • 16:00 IST',
        'Vagator Beach Arena, North Goa',
        112,
        4500,
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
        'Asias premier electronic dance festival under the open Goan sky featuring top international headliners.',
        'All Colleges',
        'Goa'
    ),
    (
        'EVT-COM26',
        'All India Stand-Up Comedy Showcase',
        'Comedy',
        'DEC 22, 2026 • 20:00 IST',
        'NCPA Tata Theatre, Nariman Point, Mumbai',
        112,
        1499,
        'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
        '90 minutes of unfiltered comedy featuring Indias celebrated stand-up comics and live interactive sets.',
        'All Colleges',
        'Mumbai'
    )
]

def init_db():
    # Remove existing DB if present (for fresh init)
    if DB_FILE.exists():
        DB_FILE.unlink()
    
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA journal_mode = WAL")
    c = conn.cursor()

    # Users
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        display_name TEXT,
        role TEXT DEFAULT 'student',
        college TEXT DEFAULT 'IIT Bombay',
        credits INTEGER DEFAULT 5000,
        avatar_seed TEXT,
        created_at REAL
    );
    """)

    # Events
    c.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT,
        category TEXT,
        date_str TEXT,
        venue TEXT,
        total_seats INTEGER,
        price INTEGER,
        image_url TEXT,
        description TEXT,
        college_affiliation TEXT,
        city TEXT
    );
    """)

    # Seats
    c.execute("""
    CREATE TABLE IF NOT EXISTS seats (
        event_id TEXT,
        seat_id TEXT,
        row_id TEXT,
        col_num INTEGER,
        is_accessible INTEGER DEFAULT 0,
        status TEXT DEFAULT 'available',
        held_by TEXT,
        held_until REAL,
        booked_by TEXT,
        booking_ref TEXT,
        PRIMARY KEY (event_id, seat_id)
    );
    """)

    # Bookings
    c.execute("""
    CREATE TABLE IF NOT EXISTS bookings (
        booking_ref TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE,
        event_id TEXT,
        user_id TEXT,
        seats_json TEXT,
        total_amount INTEGER,
        hmac_signature TEXT,
        created_at REAL,
        checked_in INTEGER DEFAULT 0,
        checked_in_at REAL DEFAULT 0,
        status TEXT DEFAULT 'confirmed'
    );
    """)

    # 4 Shard Tables
    for i in range(4):
        c.execute(f"""
        CREATE TABLE IF NOT EXISTS shard_audit_{i} (
            log_id TEXT PRIMARY KEY,
            tx_hash TEXT,
            event_id TEXT,
            user_id TEXT,
            action TEXT,
            payload TEXT,
            timestamp REAL
        );
        """)

    # Seed events
    c.execute("SELECT COUNT(*) FROM events")
    if c.fetchone()[0] == 0:
        c.executemany("INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?)", INDIAN_AND_CAMPUS_EVENTS)

        # Seed Default Student & Campus Users
        import time
        now = time.time()
        c.execute("INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, 5000, ?, ?)", 
                  ('BEE-8821', 'Aarav Mehta', 'student', 'IIT Bombay', 'aarav', now))
        c.execute("INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, 4500, ?, ?)", 
                  ('STUDENT-DU', 'Ananya Sharma', 'student', 'Delhi University (SRCC)', 'ananya', now))
        c.execute("INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, 99999, ?, ?)", 
                  ('ADMIN-01', 'Lead Auditor', 'admin', 'Central Admin Hub', 'admin', now))
        c.execute("INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, 35000, ?, ?)", 
                  ('ORG-01', 'Mood Indigo Guild', 'organizer', 'IIT Bombay', 'org', now))

        # Generate Seats (A to H, cols 1-14)
        rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        for ev in INDIAN_AND_CAMPUS_EVENTS:
            ev_id = ev[0]
            seat_records = []
            for r in rows:
                for col in range(1, 15):
                    seat_id = f"{r}{col}"
                    is_acc = 1 if seat_id in ['A1', 'A2', 'A13', 'A14'] else 0
                    status = 'available'
                    booked_by = None
                    booking_ref = None
                    if seat_id in ['B3', 'B4', 'D7', 'D8', 'F5', 'F6']:
                        status = 'booked'
                        booked_by = 'CAMPUS-COUNCIL'
                        booking_ref = 'BE-CAMPUS01'
                    seat_records.append((ev_id, seat_id, r, col, is_acc, status, None, 0, booked_by, booking_ref))
            c.executemany("INSERT INTO seats VALUES (?,?,?,?,?,?,?,?,?,?)", seat_records)

    conn.commit()
    conn.close()
    print('Database initialized successfully')

if __name__ == '__main__':
    init_db()
