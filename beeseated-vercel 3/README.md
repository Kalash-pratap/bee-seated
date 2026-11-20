# BEESEATED — Vercel Deployment

This is the Vercel-ready version of BEESEATED, a campus & editorial event discovery and seat-reservation platform.

## Structure

```
beeseated-vercel/
├── api/                    # Python serverless functions (API routes)
│   ├── init_db.py         # Database initialization (runs on build)
│   ├── events.py          # GET /api/events
│   ├── seats.py           # GET/POST /api/seats
│   ├── bookings.py        # GET/POST /api/bookings
│   ├── auth.py            # POST /api/auth/login
│   ├── telemetry.py       # GET /api/dashboard/telemetry
│   └── attendees.py       # GET /api/organizer/attendees
├── public/                 # Static files
│   ├── index.html         # Main application
│   ├── bee-animation.html # Bee animation page
│   ├── styles.css         # Design system
│   └── app.js             # Client-side logic
├── vercel.json            # Vercel configuration
├── requirements.txt       # Python dependencies (just stdlib)
└── .gitignore
```

## Deployment to Vercel

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from the project directory
cd beeseated-vercel
vercel

# For production
vercel --prod
```

### Option 2: GitHub Integration

1. Push this folder to a GitHub repository
2. Import the repository in Vercel Dashboard
3. Vercel will auto-detect the Python configuration
4. Deploy

## Configuration Notes

- **Region**: Set to `bom1` (Mumbai) for lowest latency in India
- **Runtime**: Python 3.11 (specified in vercel.json)
- **Build Command**: Runs `python api/init_db.py` to initialize SQLite database
- **API Routes**: All under `/api/*` with proper CORS headers
- **Static Files**: Served from `/public/` via rewrites in vercel.json

## Database

Uses SQLite with WAL mode for better concurrency. The database file (`beeseated.db`) is created during the build step and persists across invocations within the same deployment.

**Note**: On Vercel's serverless platform, the filesystem is ephemeral. For production use with persistent data, consider:
- Vercel Postgres
- PlanetScale
- Neon
- Supabase

## Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev
```

This will start the development server at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List all events (supports `college` and `city` query params) |
| GET | `/api/seats?event_id=` | Get seat map for an event |
| POST | `/api/seats` | Hold/release seats (`action: "hold"|"release"`) |
| GET | `/api/bookings?user_id=` | Get user bookings and holds |
| POST | `/api/bookings` | Confirm booking or check-in (`action: "confirm"|"checkin"`) |
| POST | `/api/auth/login` | Authenticate/create user |
| GET | `/api/dashboard/telemetry` | System telemetry (shard status, counts) |
| GET | `/api/organizer/attendees?event_id=` | Get attendees for an event |

## Features

- **Zero external dependencies** — Uses only Python standard library
- **Nothing OS design system** — Bee gold (#F5C518), deep black (#111111), dot-matrix grids
- **19 UX motion tokens** — Smooth animations and transitions
- **5-phase bee animation** — Canvas-based intro sequence
- **5-minute seat holds** — With automatic cleanup daemon
- **4-shard audit logging** — Hash-based sharding for scalability
- **Idempotent bookings** — Prevents duplicate transactions
- **QR code generation** — SVG-based digital passes
- **Dark/Light themes** — With system preference detection

## Indian Campus Events Included

- IIT Bombay Mood Indigo 2026
- BITS Pilani Oasis 2026
- IIT Delhi Rendezvous 2026
- St. Xavier's College Malhar 2026
- Delhi University Crossroads/SRCC Fest 2027
- IIT Madras Saarang 2027
- Plus major concerts (Dua Lipa, Diljit Dosanjh, Sunburn Goa, Comedy Showcase)
