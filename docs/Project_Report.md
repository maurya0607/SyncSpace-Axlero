# SyncSpace — Project Report

**Axlero Internship Program**
**Project Duration:** September 2026
**Submitted by:** SyncSpace Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Team](#team)
4. [Objectives](#objectives)
5. [System Architecture](#system-architecture)
6. [Technology Stack](#technology-stack)
7. [Features Implemented](#features-implemented)
8. [Database Design](#database-design)
9. [API Reference](#api-reference)
10. [Socket.IO Events](#socketio-events)
11. [Frontend Design](#frontend-design)
12. [Deployment](#deployment)
13. [Project Status](#project-status)
14. [Challenges and Solutions](#challenges-and-solutions)
15. [Conclusion](#conclusion)

---

## Executive Summary

SyncSpace is a real-time collaborative platform developed as part of the Axlero Internship Program. The platform enables distributed teams to collaborate simultaneously on code and whiteboard drawings within shared rooms. The project is fully completed and deployed, with a live frontend on Vercel and a live backend on Render.

---

## Project Overview

| Property | Details |
|----------|---------|
| Project Name | SyncSpace |
| Type | Full-stack Web Application |
| Category | Real-time Collaboration Tool |
| Live Frontend | https://sync-space-axlero.vercel.app/ |
| Live Backend | https://syncspace-axlero.onrender.com |
| Repository | https://github.com/maurya0607/SyncSpace-Axlero |
| Project Report Link | [Google Drive PDF Link](https://drive.google.com/) |
| Status | Completed |

SyncSpace combines two major collaboration tools — a shared whiteboard and a multi-file collaborative code editor — into a single platform. Users authenticate with JWT, create or join rooms, and collaborate in real time via Socket.IO and Yjs CRDT technology.

---

## Team

| Name | Role |
|------|------|
| Chandru | Frontend and MERN Development |
| Khushi | Backend Development |
| Akshaya | Backend Development and MERN Stack Support |
| Vishal | Database, Testing, Documentation and Deployment — Team Lead |

---

## Objectives

1. Build a real-time collaborative code editor with multi-file support.
2. Implement a shared whiteboard with canvas-based drawing.
3. Develop secure user authentication using JWT and bcrypt.
4. Enable room-based collaboration with invite management.
5. Persist collaborative state (code and Yjs) to MongoDB.
6. Deploy the platform to production (Vercel + Render).
7. Provide code execution capabilities within the editor.

---

## System Architecture

```
Client (Browser)
      |
      | HTTP REST / WebSocket (Socket.IO)
      |
Backend Server (Node.js + Express + Socket.IO)
      |         |              |
      |    MongoDB Atlas    Yjs CRDT Engine
      |
  REST APIs       Socket.IO Events
  /api/auth       join-room / leave-room
  /api/rooms      yjs-update / awareness-update
  /api/execute    code-update / code-sync
```

### Communication Flow

- **Authentication:** HTTP REST (JWT token issued on login)
- **Real-time Collaboration:** Socket.IO WebSocket with JWT middleware
- **Code Sync:** Yjs CRDT over Socket.IO (yjs-update / yjs-sync events)
- **Presence:** Awareness events broadcast cursor positions and user data
- **Persistence:** Yjs binary state and code content saved to MongoDB every 5 seconds

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI Framework |
| Vite | 8.x | Build Tool and Dev Server |
| Socket.IO Client | 4.8.x | WebSocket communication |
| Yjs | 13.6.x | CRDT-based collaborative state |
| PrismJS | 1.30.x | Syntax highlighting |
| CSS Modules | — | Scoped component styling |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18.x+ | Runtime environment |
| Express.js | 5.x | REST API framework |
| Socket.IO | 4.8.x | WebSocket event handling |
| MongoDB | — | NoSQL database |
| Mongoose | 9.x | MongoDB ODM |
| JWT (jsonwebtoken) | 9.x | Authentication tokens |
| bcryptjs | 3.x | Password hashing |
| Yjs | 13.6.x | Server-side CRDT engine |
| dotenv | 17.x | Environment variable management |

---

## Features Implemented

### 1. User Authentication
- Registration with username and bcrypt-hashed password
- Login with credential validation and JWT token generation
- Token stored in localStorage or sessionStorage (based on "Remember Me")
- Protected routes redirect unauthenticated users to login page

### 2. Room Management
- Create new rooms with auto-generated Room IDs
- Invite other users to rooms by username
- Room membership validated on every Socket.IO join event
- Active user count tracked and updated in MongoDB in real time

### 3. Collaborative Code Editor
- Multi-file support — create, rename, and switch between files
- Real-time code synchronization via Socket.IO code-update events
- Yjs CRDT integration for conflict-free collaborative editing
- Syntax highlighting via PrismJS
- Active file tab sync across all room members

### 4. Shared Whiteboard
- Canvas-based drawing with real-time stroke synchronization
- Drawing data shared via Socket.IO events
- Multiple concurrent users can draw simultaneously

### 5. Code Execution
- Submit code from the editor for execution
- Results returned and displayed within the workspace
- Powered by dedicated /api/execute route

### 6. Real-time Presence and Cursor Awareness
- Live list of active users in each room
- Cursor position broadcasting via awareness-update events
- User departure cleanly removes awareness state

### 7. Persistent State
- Code content and Yjs binary state saved to MongoDB
- Yjs persistence timer runs every 5 seconds for dirty rooms
- State loaded from database when a user joins an existing room

---

## Database Design

### Collections

#### users
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Primary key |
| username | String | Unique username |
| password | String | bcrypt-hashed password |
| createdAt | Date | Auto timestamp |
| updatedAt | Date | Auto timestamp |

#### rooms
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Primary key |
| roomId | String | Unique Room ID |
| activeUsers | Number | Count of connected users |
| invitedUsers | Array of ObjectIds | References to User collection |
| createdAt | Date | Auto timestamp |
| updatedAt | Date | Auto timestamp |

#### codedocuments
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Primary key |
| roomId | String | Room identifier (indexed) |
| fileName | String | Name of the file |
| content | String | Text/code content |
| language | String | Syntax language (default: javascript) |
| updatedBy | String | Last modifier user ID |
| yjsState | Buffer | Binary Yjs document state |
| createdAt | Date | Auto timestamp |
| updatedAt | Date | Auto timestamp |

**Index:** Compound unique index on { roomId, fileName }

#### whiteboards
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Primary key |
| roomId | String | Room identifier |
| drawingData | Object/Array | Serialized whiteboard vectors/paths |
| updatedAt | Date | Last updated timestamp |

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | None | Register a new user |
| POST | /api/auth/login | None | Login and receive JWT token |

**Register Request:**
```json
{ "username": "john_doe", "password": "securepassword" }
```

**Register Response (201):**
```json
{ "message": "User registered successfully" }
```

**Login Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "64a...", "username": "john_doe" }
}
```

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/rooms | Bearer JWT | Create a new room |
| POST | /api/rooms/:roomId/invite | Bearer JWT | Invite a user to the room |

**Create Room Response (201):**
```json
{ "message": "Room created successfully", "room": { "roomId": "sync-892f3a" } }
```

### Code Execution

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/execute | None | Execute submitted code |

---

## Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| join-room | Client to Server | Join a room (invite verified) |
| leave-room | Client to Server | Leave a room |
| room-message | Bidirectional | Chat message in room |
| yjs-sync-request | Client to Server | Request Yjs document state |
| yjs-sync | Server to Client | Send Yjs document state |
| yjs-update | Bidirectional | Sync Yjs document updates |
| awareness-update | Bidirectional | Cursor and presence sync |
| awareness-remove | Bidirectional | Remove cursor/presence |
| code-sync-request | Client to Server | Request initial code state |
| code-sync | Server to Client | Send initial code state |
| code-sync-empty | Server to Client | No code state exists yet |
| code-update | Bidirectional | Collaborative code update |
| active-file-change | Bidirectional | Sync active tab |
| users-in-room | Server to Client | Active user list update |
| user-joined | Server to Client | User joined notification |
| user-left | Server to Client | User left notification |
| join-error | Server to Client | Error joining room |
| disconnect | Client to Server | Handle user disconnect |

---

## Frontend Design

### Pages

| Page | Route | Description |
|------|-------|-------------|
| LandingPage | / | Hero section, feature highlights, room entry |
| AuthPage | /signin, /signup | Tabbed Sign In and Sign Up interface |
| RoomPage | /room/:roomId | Collaborative workspace |

### Components

| Component | Description |
|-----------|-------------|
| Navbar | Top navigation with user status, logout, and navigation |
| Sidebar | Room panel with user list and room info |
| Workspace | Container for code editor and whiteboard |

### Custom Hook: useCollaborativeRoom

Manages all Socket.IO connection and Yjs state logic. Responsibilities:
- Socket connection lifecycle
- Room join and leave events
- Yjs document initialization and sync
- Awareness broadcast and reception
- Code sync and update handling

---

## Deployment

### Frontend — Vercel

| Setting | Value |
|---------|-------|
| Platform | Vercel |
| Root Directory | frontend |
| Build Command | npm run build |
| Output Directory | dist |
| Live URL | https://sync-space-axlero.vercel.app/ |
| Environment Variable | VITE_API_URL=https://syncspace-axlero.onrender.com |

### Backend — Render

| Setting | Value |
|---------|-------|
| Platform | Render |
| Root Directory | backend |
| Build Command | npm install |
| Start Command | node server.js |
| Live URL | https://syncspace-axlero.onrender.com |

### Backend Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (3001) |
| MONGO_URI | MongoDB Atlas connection string |
| JWT_SECRET | Secret key for JWT signing |
| FRONTEND_URL | Allowed frontend origin for CORS |

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

## Challenges and Solutions

### 1. Yjs CRDT State Persistence
**Challenge:** Yjs operates in-memory. Persisting binary Yjs state to MongoDB between server restarts was complex.
**Solution:** Implemented a dirty-room tracking Set and a 5-second interval timer that persists changed Yjs documents to MongoDB using binary Buffer storage.

### 2. Socket.IO Authentication
**Challenge:** Securing WebSocket connections to prevent unauthorized room access.
**Solution:** Implemented a Socket.IO middleware that verifies the JWT token passed in the handshake auth object before any connection events are processed.

### 3. Multi-user Code Sync Without Conflicts
**Challenge:** Multiple users editing code simultaneously caused race conditions with simple event-based syncing.
**Solution:** Adopted Yjs CRDT for conflict-free replicated data types, ensuring edits from multiple users merge correctly without data loss.

### 4. Initial State Delivery
**Challenge:** New users joining a room need the full current state, not just subsequent updates.
**Solution:** Implemented sync-request / sync events for both Yjs (yjs-sync-request / yjs-sync) and code state (code-sync-request / code-sync) to deliver complete state on join.

### 5. Cross-Origin WebSocket and API Calls
**Challenge:** Frontend on Vercel and backend on Render required correct CORS configuration.
**Solution:** Configured CORS middleware in Express and CORS options in Socket.IO Server to allow the Vercel frontend origin.

---

## Conclusion

SyncSpace has been successfully built and deployed as a full-stack real-time collaboration platform during the Axlero Internship Program. All planned features have been implemented and are live in production. The project demonstrates proficiency in full-stack MERN development, real-time WebSocket communication, CRDT-based collaborative algorithms, and cloud deployment.

The internship provided hands-on experience with industry-standard tools and workflows including Git branching strategies, REST API design, JWT authentication, MongoDB schema design, and cloud deployment pipelines.

---

*SyncSpace — Built during the Axlero Internship Program, September 2026*
*Team Lead: Vishal*
