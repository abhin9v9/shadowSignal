# Shadow Signal

A real-time multiplayer social deduction game built with Next.js and Socket.io.

## 🎮 Game Modes

### Infiltrator Mode
- **Citizens** receive the same secret word
- **Infiltrator** receives no word
- Citizens win by eliminating the Infiltrator
- Infiltrator wins by surviving until 2 players remain

### Spy Mode  
- **Agents** receive the same word (e.g., "Beach")
- **Spy** receives a similar but different word (e.g., "Island")
- Agents win by eliminating the Spy
- Spy wins by surviving until 2 players remain

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run both server and client
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## 📁 Project Structure

```
shadow-signal/
├── server/                 # Socket.io backend
│   ├── index.ts           # Express + Socket.io setup
│   ├── managers/          # Room and Game logic
│   ├── services/          # Word selection
│   └── data/words.json    # Curated word dataset
└── src/                   # Next.js frontend
    ├── app/page.tsx       # Main game UI
    ├── hooks/useSocket.ts # Socket connection hook
    └── lib/socket.ts      # Socket client
```

## 🎯 Game Flow

1. Create/Join room via 6-character code
2. Host selects game mode and starts
3. Each player sees their role and word privately
4. Speaking phase: 30 seconds per player
5. Voting phase: Eliminate a suspect
6. Win check: Game ends or continues

## 🛠 Deployment

**Frontend (Vercel):**
```bash
npm run build
# Deploy to Vercel
```

**Backend (Railway/Render):**
Set environment variables:
- `PORT`: Server port
- `CLIENT_URL`: Frontend URL for CORS

**Frontend env:**
- `NEXT_PUBLIC_SOCKET_URL`: Backend WebSocket URL

## 📝 Tech Stack

- Next.js 14 + TypeScript
- Socket.io (real-time)
- Express.js (backend)
- In-memory state (no database)
