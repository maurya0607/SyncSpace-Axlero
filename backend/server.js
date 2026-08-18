const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Presence System (Khushi)
const {
  addUser,
  removeUser,
  getUsers,
} = require("./services/presence");

// Yjs / CRDT (Akshaya)
const {
  getDocumentState,
  applyDocumentUpdate,
} = require("./yjs/yjsManager");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/* =========================================================
   COLLABORATIVE CODE STATE
   ========================================================= */

const roomCodeState = new Map();

app.get("/", (req, res) => {
  res.send("SyncSpace Backend is running");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ===========================
  // Join Room
  // ===========================
  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    addUser(roomId, socket.id);

    console.log(`${socket.id} joined room: ${roomId}`);

    io.to(roomId).emit("users-in-room", getUsers(roomId));

    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
    });
  });

  // ===========================
  // Leave Room
  // ===========================
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);

    removeUser(roomId, socket.id);

    console.log(`${socket.id} left room: ${roomId}`);

    io.to(roomId).emit("users-in-room", getUsers(roomId));

    socket.to(roomId).emit("user-left", {
      socketId: socket.id,
    });

    // Remove awareness
    socket.to(roomId).emit("awareness-remove", {
      socketId: socket.id,
    });
  });

  // ===========================
  // Room Chat / Events
  // ===========================
  socket.on("room-message", ({ roomId, message }) => {
    socket.to(roomId).emit("room-message", {
      socketId: socket.id,
      message,
    });
  });

  // ===========================
  // Yjs / CRDT Synchronization
  // ===========================
  socket.on("yjs-sync-request", (roomId) => {
    const state = getDocumentState(roomId);

    socket.emit("yjs-sync", {
      roomId,
      update: state,
    });

    console.log(`Yjs state sent to ${socket.id} for room: ${roomId}`);
  });

  socket.on("yjs-update", ({ roomId, update }) => {
    try {
      const appliedUpdate = applyDocumentUpdate(roomId, update);

      socket.to(roomId).emit("yjs-update", {
        socketId: socket.id,
        roomId,
        update: appliedUpdate,
      });

      console.log(`Yjs update synchronized in room: ${roomId}`);
    } catch (error) {
      console.error("Yjs update error:", error);
    }
  });

  // ===========================
  // Awareness / Cursor Sync
  // ===========================
  socket.on("awareness-update", ({ roomId, awareness }) => {
    socket.to(roomId).emit("awareness-update", {
      socketId: socket.id,
      awareness,
    });

    console.log(`Awareness update from ${socket.id} in room: ${roomId}`);
  });

  socket.on("awareness-remove", ({ roomId }) => {
    socket.to(roomId).emit("awareness-remove", {
      socketId: socket.id,
    });

    console.log(`Awareness removed for ${socket.id} from room: ${roomId}`);
  });

    // ===========================
  // Collaborative Code Sync
  // ===========================

  socket.on("code-sync-request", (roomId) => {
    const currentState =
      roomCodeState.get(roomId);

    if (currentState) {
      socket.emit("code-sync", {
        roomId,
        files: currentState.files,
      });

      console.log(
        `Code state sent to ${socket.id} for room: ${roomId}`
      );
    } else {
      socket.emit("code-sync-empty", {
        roomId,
      });

      console.log(
        `No code state exists yet for room: ${roomId}`
      );
    }
  });

  socket.on(
    "code-update",
    ({ roomId, files } = {}) => {
      if (!roomId || !Array.isArray(files)) {
        return;
      }

      roomCodeState.set(roomId, {
        files,
      });

      socket.to(roomId).emit(
        "code-update",
        {
          socketId: socket.id,
          roomId,
          files,
        }
      );
    }
  );

  // ===========================
  // Disconnect
  // ===========================
  socket.on("disconnect", () => {
    const joinedRooms = [...socket.rooms].filter(
      (room) => room !== socket.id
    );

    joinedRooms.forEach((roomId) => {
      removeUser(roomId, socket.id);

      io.to(roomId).emit("users-in-room", getUsers(roomId));

      socket.to(roomId).emit("user-left", {
        socketId: socket.id,
      });

      socket.to(roomId).emit("awareness-remove", {
        socketId: socket.id,
      });
    });

    console.log("User disconnected:", socket.id);
  });
});

// ===========================
// SERVER START
// ===========================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(
    `SyncSpace server running on http://localhost:${PORT}`
  );
});