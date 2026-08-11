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
| API-001 | GET | / | Returns **"SyncSpace Backend is running"** | ✅ Passed |

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