# API Testing

## Objective

The purpose of API testing is to verify that the backend services are working correctly and are ready for frontend integration.

---

# Testing Environment

- Backend: Node.js + Express.js
- Real-time Communication: Socket.io
- Testing Tool: Postman, Browser, Socket.io Client
- Status: In Progress

---

# Planned APIs

## Authentication

- Register
- Login

## Rooms

- Create Room
- Join Room
- Leave Room

## Whiteboard

- Save Whiteboard
- Load Whiteboard

## Code Editor

- Save Code
- Load Code

---

# API Test Cases

| Test ID | Method | Endpoint | Expected Result | Status |
|---------|--------|----------|-----------------|--------|
| API-001 | GET | / | Returns **"SyncSpace Backend is running"** | Passed |

---

# Socket.io Event Testing

| Event | Purpose | Status |
|-------|---------|--------|
| join-room | User joins a room | Pending |
| leave-room | User leaves a room | Pending |
| room-message | Send messages between room members | Pending |
| disconnect | Handle user disconnect | Pending |

---

# Current Test Results

- Backend server starts successfully.
- Root endpoint (`GET /`) tested successfully.
- Express server is running on Port **5000**.
- Socket.io server initialized successfully.
- Backend is ready for further API and Socket.io testing.

---

# Future Testing Plan

- Authentication API testing
- Room creation and management testing
- Multi-user Socket.io communication testing
- Whiteboard synchronization testing
- Code Editor synchronization testing
- MongoDB database integration testing
- Error handling and validation testing

---

# Progress Log

## Day 2

- Prepared API testing plan.
- Listed all planned backend APIs.
- Selected Postman as the primary API testing tool.

## Day 3

- Identified Socket.io events for testing.
- Prepared testing plan for backend integration.

## Day 4

- Verified backend server setup.
- Successfully tested the root API endpoint (`GET /`).
- Updated API testing documentation.
- Prepared test cases for upcoming backend features.

## Day 5 Progress

- Reviewed backend Socket.io implementation.
- Verified server startup.
- Verified room event implementation.
- Updated API testing documentation.

## *******************************************************************
# API Testing (Latest)

## Testing Environment

- Backend: Node.js + Express.js
- Real-time Communication: Socket.io
- Database: MongoDB + Mongoose
- Authentication: JWT (jsonwebtoken) + bcryptjs
- Testing Tool: Postman, Browser, Socket.io Client
- Server Port: **3001**

---

## Implemented REST APIs

### Authentication (`/api/auth`)

| Test ID | Method | Endpoint | Headers / Body | Purpose | Status |
|---------|--------|----------|----------------|---------|--------|
| API-001 | GET | `/` | None | Server Health check | Passed |
| API-002 | POST | `/api/auth/register` | Body: `{ "username": "string", "password": "string" }` | Register a new user | Implemented |
| API-003 | POST | `/api/auth/login` | Body: `{ "username": "string", "password": "string" }` | Login & return JWT token | Implemented |

#### Example Responses
- **Register Success (`201 Created`)**:
  ```json
  { "message": "User registered successfully" }
  ```
- **Login Success (`200 OK`)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOi...",
    "user": { "id": "...", "username": "john_doe" }
  }
  ```

---

### Rooms (`/api/rooms`)

| Test ID | Method | Endpoint | Headers / Body | Purpose | Status |
|---------|--------|----------|----------------|---------|--------|
| API-004 | POST | `/api/rooms` | `Authorization: Bearer <token>`<br>Body: `{ "roomId": "optional_id" }` | Create a new protected room | Implemented |
| API-005 | POST | `/api/rooms/:roomId/invite` | `Authorization: Bearer <token>`<br>Body: `{ "username": "invitee_user" }` | Invite an existing user to room | Implemented |

#### Example Responses
- **Room Creation Success (`201 Created`)**:
  ```json
  {
    "message": "Room created successfully",
    "room": { "roomId": "sync-892f3a" }
  }
  ```
- **Invite User Success (`200 OK`)**:
  ```json
  { "message": "User invited successfully" }
  ```

---

## Socket.io Event Testing

| Event | Direction | Purpose | Status |
|-------|-----------|---------|--------|
| `join-room` | Client → Server | User joins a room (invite/creator verified) | Implemented |
| `leave-room` | Client → Server | User leaves a room | Implemented |
| `room-message` | Client → Server | Send messages between room members | Implemented |
| `yjs-sync-request` | Client → Server | Request Yjs document state | Implemented |
| `yjs-sync` | Server → Client | Send Yjs document state | Implemented |
| `yjs-update` | Bidirectional | Sync Yjs document updates | Implemented |
| `awareness-update` | Bidirectional | Cursor/presence sync | Implemented |
| `awareness-remove` | Bidirectional | Remove cursor/presence | Implemented |
| `code-sync-request` | Client → Server | Request initial code state | Implemented |
| `code-sync` | Server → Client | Send initial code state | Implemented |
| `code-sync-empty` | Server → Client | No code state exists | Implemented |
| `users-in-room` | Server → Client | Active user list update | Implemented |
| `user-joined` | Server → Client | Notify user joined | Implemented |
| `user-left` | Server → Client | Notify user left | Implemented |
| `join-error` | Server → Client | Error joining room | Implemented |
| `disconnect` | Client → Server | Handle user disconnect | Implemented |

---

## Current Test Results

- Backend server starts successfully on port **3001**.
- Root endpoint (`GET /`) tested successfully.
- Socket.io server initialized with JWT authentication middleware.
- Auth routes (`/api/auth/register`, `/api/auth/login`) verified with MongoDB.
- Protected room routes (`POST /api/rooms`, `POST /api/rooms/:roomId/invite`) verified with JWT Bearer auth.
- Full frontend authentication and room routing flow operational.

---

## Authentication & Navigation Flow

```text
Sign Up → Login → Login successful → Username + Create Room + Logout → Logout → Sign In + Sign Up
```

### Flow Breakdown

1. **Sign Up (`/signup` / `/register`)**:
   - User inputs username and password on `AuthPage.jsx`.
   - Request sent to `POST /api/auth/register`.
   - Password hashed via `bcryptjs` and user record saved in MongoDB.

2. **Login (`/signin` / `/login`)**:
   - User provides credentials.
   - Request sent to `POST /api/auth/login`.
   - Credentials validated against database record.

3. **Login Successful**:
   - JWT token generated with `process.env.JWT_SECRET` and returned to client.
   - User credentials & token stored in browser session (`localStorage`).

4. **Authenticated State**:
   - UI updates to display logged-in **Username**.
   - Authenticated actions unlocked: **Create Room**, Join Room, and access Collaborative Workspace.
   - **Logout** button made accessible in navigation header.

5. **Logout Action**:
   - Clears stored JWT token and active session from storage.
   - Resets application state in `App.jsx`.

6. **Logged Out State**:
   - Navigation bar resets to show guest options: **Sign In** and **Sign Up**.
   - Protected routes and room actions require re-authentication.

