# Database Documentation

## Overview
- **Database**: MongoDB
- **ODM**: Mongoose
- **Connection URI**: Configured via `MONGO_URI` in `.env` (default: `mongodb://127.0.0.1:27017/syncspace`)
- **Connection Handler**: `backend/config/db.js`

---

## Implemented Collections & Schemas

### 1. Users (`backend/models/User.js`)
Stores registered user accounts with hashed credentials.

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `_id` | ObjectId | Auto-generated | Primary key |
| `username` | String | `required`, `unique`, `trim` | Unique username |
| `password` | String | `required` | Hashed password (bcryptjs) |
| `createdAt` | Date | `timestamps: true` | Account creation timestamp |
| `updatedAt` | Date | `timestamps: true` | Last updated timestamp |

---

### 2. Rooms (`backend/models/Room.js`)
Stores collaborative rooms and user permissions/invitations.

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `_id` | ObjectId | Auto-generated | Primary key |
| `roomId` | String | `required`, `unique` | Unique Room ID identifier |
| `activeUsers` | Number | `default: 0` | Count of active connected users |
| `invitedUsers` | Array of ObjectIds | `ref: "User"` | List of invited user references |
| `createdAt` | Date | `timestamps: true` | Room creation timestamp |
| `updatedAt` | Date | `timestamps: true` | Last updated timestamp |

---

### 3. CodeDocuments (`backend/models/CodeDocument.js`)
Stores room file content, language mode, and Yjs binary state.

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `_id` | ObjectId | Auto-generated | Primary key |
| `roomId` | String | `required`, `index: true` | Room identifier |
| `fileName` | String | `required` | Name of the file |
| `content` | String | `default: ""` | Text/code content |
| `language` | String | `default: "javascript"` | Editor syntax language |
| `updatedBy` | String | `default: null` | Last modified user ID |
| `yjsState` | Buffer | `default: null` | Binary Yjs document state |
| `createdAt` | Date | `timestamps: true` | Document creation timestamp |
| `updatedAt` | Date | `timestamps: true` | Last updated timestamp |

**Indexes**:
- Compound Unique Index: `{ roomId: 1, fileName: 1 }`

---

### 4. Whiteboards (`backend/models/Whiteboard.js`)
Planned collection for storing canvas drawings and collaborative strokes.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Primary key |
| `roomId` | String | Room identifier |
| `drawingData` | Object/Array | Serialized whiteboard vectors/paths |
| `updatedAt` | Date | Last updated timestamp |

---

## Current Status
- [Completed] MongoDB connection module established (`backend/config/db.js`).
- [Completed] User authentication schemas with hashed password storage implemented.
- [Completed] Room schema with invited users relation implemented.
- [Completed] CodeDocument schema with Yjs binary buffer support implemented.
- [In Progress] Whiteboard schema persistence integration in progress.