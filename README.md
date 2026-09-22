<div align="center">

# SyncSpace

**Real-time Collaborative Whiteboard and Code Editor**

[![Frontend](https://img.shields.io/badge/Frontend-Live%20on%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://sync-space-axlero.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-Live%20on%20Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://syncspace-axlero.onrender.com)
![Status](https://img.shields.io/badge/Status-Completed-brightgreen?style=for-the-badge)

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat-square&logo=mongodb&logoColor=white)

</div>

---

## About

**SyncSpace** is a real-time collaborative platform built during the **Axlero Internship Program**. It combines a shared whiteboard and a multi-file code editor into a single workspace, enabling distributed teams to brainstorm, design, and build software together — simultaneously, in real time.

Users can **create** or **join** rooms, **authenticate** securely, collaborate on **code documents** synced via Yjs CRDT, and **draw** on a shared whiteboard — all within a sleek, responsive interface.

---

## Live Deployment

| Service | URL |
|---------|-----|
| Frontend | [sync-space-axlero.vercel.app](https://sync-space-axlero.vercel.app/) |
| Backend | [syncspace-axlero.onrender.com](https://syncspace-axlero.onrender.com) |
| Project Report (Google Drive) | [Google Drive PDF / Document Link](https://drive.google.com/) |
| Presentation Slides | [docs/Presentation.html](docs/Presentation.html) |

---

## Features

- **User Authentication** — Secure registration and login with JWT + bcrypt
- **Room Management** — Create rooms instantly or join via Room ID
- **Real-time Presence** — See who is online with live user tracking
- **Collaborative Code Editor** — Multi-user code editing synced via Yjs CRDT with multi-file support
- **Shared Whiteboard** — Canvas-based drawing with real-time synchronization
- **Persistent State** — Code documents and Yjs binary state saved to MongoDB
- **Socket.IO Events** — Instant bidirectional communication across all clients
- **Code Execution** — Execute code directly from the collaborative editor
- **Cursor Awareness** — Real-time cursor and presence sync across all users

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React + Vite | UI Framework and Build Tool |
| Socket.IO Client | Real-time communication |
| Yjs | CRDT-based collaborative state |
| PrismJS | Syntax highlighting |
| CSS Modules | Scoped component styling |

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js + Express.js | REST API server |
| Socket.IO | WebSocket event handling |
| MongoDB + Mongoose | Database and ODM |
| JWT + bcryptjs | Authentication and password hashing |
| Yjs | Server-side CRDT engine |

---

## Project Structure

```text
SyncSpace-Axlero/
|
+-- backend/
|   +-- config/
|   |   +-- db.js                    # MongoDB connection handler
|   +-- middleware/
|   |   +-- authMiddleware.js         # JWT verification middleware
|   +-- models/
|   |   +-- User.js                  # User schema
|   |   +-- Room.js                  # Room schema
|   |   +-- CodeDocument.js          # Code document + Yjs state schema
|   |   +-- Whiteboard.js            # Whiteboard canvas schema
|   +-- routes/
|   |   +-- auth.js                  # /api/auth -- Register and Login
|   |   +-- room.js                  # /api/rooms -- Room creation and invite
|   |   +-- codeExecution.js         # /api/execute -- Code execution
|   +-- services/
|   |   +-- presence.js              # User presence tracking service
|   +-- yjs/
|   |   +-- yjsManager.js            # Yjs CRDT document manager
|   +-- .env.example
|   +-- server.js                    # Express + Socket.IO entry point
|   +-- package.json
|
+-- frontend/
|   +-- public/
|   +-- src/
|       +-- components/
|       |   +-- Navbar/              # Top navigation bar
|       |   +-- Sidebar/             # Room sidebar panel
|       |   +-- Workspace/           # Editor + whiteboard container
|       +-- lib/
|       |   +-- useCollaborativeRoom.js  # Socket.IO and Yjs custom hook
|       +-- pages/
|       |   +-- LandingPage.jsx      # Hero, features, room entry
|       |   +-- AuthPage.jsx         # Sign In / Sign Up tabs
|       |   +-- RoomPage.jsx         # Collaborative workspace
|       +-- App.jsx
|       +-- main.jsx
|
+-- docs/
|   +-- API_Testing.md
|   +-- Database.md
|   +-- Deployment.md
|   +-- Project_Structure.md
|   +-- Project_Report.md
|   +-- Presentation.html
|
+-- LICENSE
+-- README.md
```

---

## Database Schema

> **Database:** MongoDB &nbsp;|&nbsp; **ODM:** Mongoose

| Collection | Key Fields | Description |
|------------|------------|-------------|
| `users` | `username`, `password` (hashed) | User accounts with bcrypt-hashed credentials |
| `rooms` | `roomId`, `activeUsers`, `invitedUsers` | Collaborative rooms with user membership |
| `codedocuments` | `roomId`, `fileName`, `content`, `yjsState` | Code files with persisted Yjs binary state |
| `whiteboards` | `roomId`, `drawingData` | Canvas stroke and vector data per room |

---

## Getting Started

### Prerequisites

- Node.js `>= 18.x`
- MongoDB (local or Atlas)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/maurya0607/SyncSpace-Axlero.git
cd SyncSpace-Axlero
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/syncspace
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173
```

Start the server:

```bash
node server.js
```

Or with auto-reload during development:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:3001
```

Start the dev server:

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

---

## Deployment

### Frontend — Vercel

1. Connect the GitHub repository to [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Build Command** to `npm run build`.
4. Set **Output Directory** to `dist`.
5. Add environment variable: `VITE_API_URL=https://syncspace-axlero.onrender.com`
6. Deploy.

### Backend — Render

1. Connect the GitHub repository to [Render](https://render.com).
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `node server.js`.
5. Add the following environment variables in Render dashboard:

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | A strong secret key |
| `FRONTEND_URL` | `https://sync-space-axlero.vercel.app` |

6. Deploy.

---

## API Endpoints

### Authentication — `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT token |

### Rooms — `/api/rooms`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms` | Create a new room (JWT required) |
| POST | `/api/rooms/:roomId/invite` | Invite a user to a room (JWT required) |

### Code Execution — `/api/execute`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/execute` | Execute submitted code and return output |

---

## Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|--------|
| `join-room` | Client to Server | User joins a room |
| `leave-room` | Client to Server | User leaves a room |
| `room-message` | Bidirectional | Send chat messages in room |
| `yjs-sync-request` | Client to Server | Request Yjs document state |
| `yjs-sync` | Server to Client | Send Yjs document state |
| `yjs-update` | Bidirectional | Sync Yjs document updates |
| `awareness-update` | Bidirectional | Cursor and presence sync |
| `awareness-remove` | Bidirectional | Remove cursor/presence |
| `code-sync-request` | Client to Server | Request initial code state |
| `code-sync` | Server to Client | Send initial code state |
| `code-update` | Bidirectional | Collaborative code update |
| `active-file-change` | Bidirectional | Sync active tab across users |
| `users-in-room` | Server to Client | Active user list update |
| `user-joined` | Server to Client | Notify user joined |
| `user-left` | Server to Client | Notify user left |
| `join-error` | Server to Client | Error joining room |
| `disconnect` | Client to Server | Handle user disconnect |

---

## Project Status

| Feature | Status |
|---------|--------|
| User Authentication (Register / Login) | Completed |
| JWT-protected REST APIs | Completed |
| Room Creation and Invite System | Completed |
| Socket.IO Real-time Communication | Completed |
| Collaborative Code Editor (Yjs CRDT) | Completed |
| Multi-file Code Support | Completed |
| Code Execution Engine | Completed |
| Shared Whiteboard (Canvas) | Completed |
| Real-time Presence and Cursor Sync | Completed |
| MongoDB Persistence (Code + Yjs State) | Completed |
| Frontend Deployment — Vercel | Completed |
| Backend Deployment — Render | Completed |

---

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready stable releases |
| `develop` | Integration branch — all features merge here |
| `feature/*` | Individual feature branches per team member |

**Process:**
1. Work on your own `feature/<name>` branch.
2. Push commits regularly and open a **Pull Request to `develop`**.
3. Team Lead reviews and merges PRs into `develop`.
4. Stable `develop` is merged into `main` for releases.

---

## Team

| Name | Role |
|------|------|
| **Chandru** | Frontend and MERN Development |
| **Khushi** | Backend Development |
| **Akshaya** | Backend Development and MERN Stack Support |
| **Vishal** | Database, Testing, Documentation and Deployment — **Team Lead** |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/Database.md`](./docs/Database.md) | MongoDB schema definitions, collections and indexes |
| [`docs/API_Testing.md`](./docs/API_Testing.md) | REST API endpoints and Socket.IO event specs |
| [`docs/Deployment.md`](./docs/Deployment.md) | Deployment guide and environment configuration |
| [`docs/Project_Structure.md`](./docs/Project_Structure.md) | Architectural map and file structure tracking |
| [`docs/Project_Report.md`](./docs/Project_Report.md) | Final project report for the internship |
| [`docs/Presentation.html`](./docs/Presentation.html) | Final presentation slides |

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">
  <p>Built with dedication by the SyncSpace Team during the <strong>Axlero Internship Program</strong></p>
</div>