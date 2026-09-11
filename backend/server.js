
const Room = require("./models/Room");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/room");
const jwt = require("jsonwebtoken");
dotenv.config();


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
  loadDocument,
  saveDocument
} = require("./yjs/yjsManager");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("SyncSpace Backend is running");
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

// Tracks rooms with unsaved Yjs changes
const dirtyYjsRooms = new Set();

/* =========================================================
   BASIC ROUTE
   ========================================================= */

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    socket.user = decoded;

    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

/* =========================================================
   SOCKET.IO
   ========================================================= */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ===========================
  // Join Room
  // ===========================
   socket.on("join-room", async (roomId) => {
  try {
    // User must be authenticated
    if (!socket.user) {
      socket.emit("join-error", {
        message: "Authentication required",
      });
      return;
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      socket.emit("join-error", {
        message: "Room not found",
      });
      return;
    }

    // Check whether the user is invited
    const isInvited = room.invitedUsers.some(
      (userId) => userId.toString() === socket.user.userId
    );

    if (!isInvited) {
      socket.emit("join-error", {
        message: "You are not invited to this room",
      });
      return;
    }

    // User is authorized → join room
    socket.join(roomId);

    addUser(roomId, socket.id);

    await Room.findOneAndUpdate(
      { roomId },
      {
        roomId,
        activeUsers: getUsers(roomId).length,
      },
      { upsert: true, new: true }
    );

    console.log(
      `${socket.user.username} (${socket.id}) joined room: ${roomId}`
    );

    io.to(roomId).emit(
      "users-in-room",
      getUsers(roomId)
    );

    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
    });

  } catch (error) {
    console.error("Join room error:", error);

    socket.emit("join-error", {
      message: "Unable to join room",
    });
  }
});

  // ===========================
  // Leave Room
  // ===========================
  socket.on("leave-room", async (roomId) => {
    socket.leave(roomId);

    removeUser(roomId, socket.id);

    await Room.findOneAndUpdate(
      { roomId },
      {
        activeUsers: getUsers(roomId).length,
      }
    );

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

  socket.on(
    "yjs-sync-request",
    async (roomId) => {
      if (!roomId) {
        return;
      }

      try {
        // Load the saved Yjs state from MongoDB if available
        await loadDocument(roomId);

        // Get the current state of the Yjs document
        const state = getDocumentState(roomId);

        // Send the current Yjs state to the requesting client
        socket.emit("yjs-sync", {
          roomId,
          update: state,
        });

        console.log(
          `Yjs state loaded and sent to ${socket.id} for room: ${roomId}`
        );
      } catch (error) {
        console.error("Yjs sync error:", error);
      }
    }
  );

  socket.on(
    "yjs-update",
    ({ roomId, update } = {}) => {
      if (!roomId || !update) {
        return;
      }

      try {
        const appliedUpdate =
          applyDocumentUpdate(
            roomId,
            update
          );

        // Mark the room as needing persistence
        dirtyYjsRooms.add(roomId);

        socket.to(roomId).emit(
          "yjs-update",
          {
            socketId: socket.id,
            roomId,
            update: appliedUpdate,
          }
        );

        console.log(
          `Yjs update synchronized in room: ${roomId}`
        );
      } catch (error) {
        console.error(
          "Yjs update error:",
          error
        );
      }
    }
  );

  /* =======================================================
     AWARENESS / CURSOR SYNC
     ======================================================= */

  socket.on(
    "awareness-update",
    ({ roomId, awareness } = {}) => {
      if (!roomId) {
        return;
      }

      socket.to(roomId).emit(
        "awareness-update",
        {
          socketId: socket.id,
          awareness,
        }
      );
    }
  );

  socket.on(
    "awareness-remove",
    ({ roomId } = {}) => {
      if (!roomId) {
        return;
      }

      socket.to(roomId).emit(
        "awareness-remove",
        {
          socketId: socket.id,
        }
      );
    }
  );

  /* =======================================================
     CODE SYNC REQUEST
     ======================================================= */

  socket.on(
    "code-sync-request",
    (roomId) => {
      if (!roomId) {
        return;
      }

      /*
       * IMPORTANT:
       *
       * Only send the initial code state once to this
       * socket for this room.
       *
       * This prevents a frontend effect from repeatedly
       * requesting the same code and overwriting local typing.
       */

      const syncKey =
        `${socket.id}:${roomId}`;

      if (initialCodeSynced.has(syncKey)) {
        console.log(
          `Initial code already synced to ${socket.id} for room: ${roomId}`
        );

        return;
      }

      initialCodeSynced.add(syncKey);

      const currentState =
        roomCodeState.get(roomId);

      if (currentState) {
        socket.emit(
          "code-sync",
          {
            roomId,
            files: currentState.files,
            activeFileId:
              currentState.activeFileId,
            revision:
              currentState.revision || 0,
          }
        );

        console.log(
          `Initial code state sent to ${socket.id} for room: ${roomId}`
        );
      } else {
        socket.emit(
          "code-sync-empty",
          {
            roomId,
          }
        );

        console.log(
          `No code state exists yet for room: ${roomId}`
        );
      }
    }
  );

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

/* =========================================================
   YJS PERSISTENCE
   ========================================================= */

// Save changed Yjs documents to MongoDB every 5 seconds.
const YJS_PERSISTENCE_INTERVAL = 5000;

const persistenceTimer = setInterval(
  async () => {
    if (dirtyYjsRooms.size === 0) {
      return;
    }

    const roomsToSave = [...dirtyYjsRooms];

    for (const roomId of roomsToSave) {
      try {
        await saveDocument(roomId);

        // Mark the room as clean only after a successful save.
        dirtyYjsRooms.delete(roomId);

        console.log(
          `Yjs state persisted for room: ${roomId}`
        );
      } catch (error) {
        console.error(
          `Failed to persist Yjs state for room ${roomId}:`,
          error
        );
      }
    }
  },
  YJS_PERSISTENCE_INTERVAL
);

/* =========================================================
   SERVER START
   ========================================================= */

const PORT = process.env.PORT || 3001;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`SyncSpace server running on port ${PORT}`);
  });
});