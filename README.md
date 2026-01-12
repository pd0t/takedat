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

## Tech Stack

- **Backend**: Go (chi, gorilla/websocket)
- **Frontend**: React, TypeScript, TailwindCSS, Vite
