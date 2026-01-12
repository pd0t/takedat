# TakeDat

Simple peer-to-peer file transfer via unique share codes.

## How It Works

1. **Sender** selects a file and gets a 6-character code (e.g., `ABC-D2F`)
2. **Receiver** enters the code to see file details
3. File streams directly through WebSocket relay (no storage on server)

## Local Development

```bash
# Terminal 1: Start backend
cd backend
go run cmd/server/main.go

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Deployment Options

### Option 1: Fly.io (Recommended - Free Tier)

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --name your-app-name
fly deploy
```

Your app will be at `https://your-app-name.fly.dev`

### Option 2: Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. It auto-detects the Dockerfile

### Option 3: Docker Compose (VPS)

```bash
# On your server (DigitalOcean, Linode, etc.)
git clone <your-repo> takedat
cd takedat
docker compose up -d
```

Access via `http://your-server-ip`

### Option 4: Render.com

1. Push to GitHub
2. New Web Service → Connect repo
3. Set:
   - Build Command: (auto-detected from Dockerfile)
   - Environment: `PORT=8080`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `SESSION_TTL` | `10m` | How long codes stay valid |
| `STATIC_DIR` | `` | Path to frontend build (for single-container deploy) |

## Tech Stack

- **Backend**: Go (chi, gorilla/websocket)
- **Frontend**: React, TypeScript, TailwindCSS, Vite
