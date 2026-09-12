const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const Room = require("./models/Room");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/room");

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
  saveDocument,
} = require("./yjs/yjsManager");

const app = express();

app.use(cors());
app.use(express.json());

// Authentication APIs
app.use("/api/auth", authRoutes);

// Room APIs
app.use("/api/rooms", roomRoutes);

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

const initialCodeSynced = new Set();

/* =========================================================
   YJS PERSISTENCE STATE
   ========================================================= */

const dirtyYjsRooms = new Set();

const YJS_PERSISTENCE_INTERVAL = 5000;

/* =========================================================
   BASIC ROUTE
   ========================================================= */

app.get("/", (req, res) => {
  res.send("SyncSpace Backend is running");
});

/* =========================================================
   SOCKET.IO AUTHENTICATION
   ========================================================= */

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

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

      const isInvited = room.invitedUsers.some(
        (userId) =>
          userId.toString() ===
          socket.user.userId.toString()
      );

      if (!isInvited) {
        socket.emit("join-error", {
          message: "You are not invited to this room",
        });

        return;
      }

      socket.join(roomId);

      addUser(roomId, socket.id);

      await Room.findOneAndUpdate(
        { roomId },
        {
          roomId,
          activeUsers: getUsers(roomId).length,
        },
        {
          upsert: true,
          new: true,
        }
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
      console.error(
        "Join room error:",
        error
      );

      socket.emit("join-error", {
        message: "Unable to join room",
      });
    }
  });

  // ===========================
  // Leave Room
  // ===========================

  socket.on("leave-room", async (roomId) => {
    try {
      socket.leave(roomId);

      removeUser(
        roomId,
        socket.id
      );

      initialCodeSynced.delete(
        `${socket.id}:${roomId}`
      );

      await Room.findOneAndUpdate(
        { roomId },
        {
          activeUsers:
            getUsers(roomId).length,
        }
      );

      console.log(
        `${socket.id} left room: ${roomId}`
      );

      io.to(roomId).emit(
        "users-in-room",
        getUsers(roomId)
      );

      socket.to(roomId).emit(
        "user-left",
        {
          socketId: socket.id,
        }
      );

      socket.to(roomId).emit(
        "awareness-remove",
        {
          socketId: socket.id,
        }
      );
    } catch (error) {
      console.error(
        "Leave room error:",
        error
      );
    }
  });

  /* =======================================================
     ROOM CHAT
     ======================================================= */

  socket.on(
    "room-message",
    ({ roomId, message } = {}) => {
      if (!roomId || !message) {
        return;
      }

      socket.to(roomId).emit(
        "room-message",
        {
          socketId: socket.id,
          message,
        }
      );
    }
  );

  /* =======================================================
     YJS / CRDT SYNCHRONIZATION
     ======================================================= */

  socket.on(
    "yjs-sync-request",
    async (roomId) => {
      if (!roomId) {
        return;
      }

      try {
        await loadDocument(roomId);

        const state =
          getDocumentState(roomId);

        socket.emit(
          "yjs-sync",
          {
            roomId,
            update: state,
          }
        );

        console.log(
          `Yjs state loaded and sent to ${socket.id} for room: ${roomId}`
        );
      } catch (error) {
        console.error(
          "Yjs sync error:",
          error
        );
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

      const syncKey =
        `${socket.id}:${roomId}`;

      if (
        initialCodeSynced.has(
          syncKey
        )
      ) {
        console.log(
          `Initial code already synced to ${socket.id} for room: ${roomId}`
        );

        return;
      }

      initialCodeSynced.add(
        syncKey
      );

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

  /* =======================================================
     COLLABORATIVE CODE UPDATE
     ======================================================= */

  socket.on(
    "code-update",
    ({
      roomId,
      files,
      activeFileId,
    } = {}) => {
      if (
        !roomId ||
        !Array.isArray(files)
      ) {
        return;
      }

      const previousState =
        roomCodeState.get(
          roomId
        );

      const previousRevision =
        previousState?.revision || 0;

      const revision =
        previousRevision + 1;

      const nextActiveFileId =
        activeFileId ||
        files[0]?.id ||
        null;

      roomCodeState.set(
        roomId,
        {
          files,
          activeFileId:
            nextActiveFileId,
          revision,
        }
      );

      console.log(
        `Code update from ${socket.id} in room ${roomId} - revision ${revision}`
      );

      socket.to(roomId).emit(
        "code-update",
        {
          socketId: socket.id,
          roomId,
          files,
          activeFileId:
            nextActiveFileId,
          revision,
        }
      );
    }
  );

  /* =======================================================
     ACTIVE FILE / TAB SYNC
     ======================================================= */

  socket.on(
    "active-file-change",
    ({
      roomId,
      fileId,
    } = {}) => {
      if (
        !roomId ||
        !fileId
      ) {
        return;
      }

      const currentState =
        roomCodeState.get(
          roomId
        );

      if (currentState) {
        roomCodeState.set(
          roomId,
          {
            ...currentState,
            activeFileId:
              fileId,
          }
        );
      }

      socket.to(roomId).emit(
        "active-file-change",
        {
          socketId: socket.id,
          roomId,
          fileId,
        }
      );

      console.log(
        `Active file changed by ${socket.id}: ${fileId} in room: ${roomId}`
      );
    }
  );

  /* =======================================================
     DISCONNECT
     ======================================================= */

  socket.on(
    "disconnect",
    () => {
      const joinedRooms =
        [...socket.rooms].filter(
          (room) =>
            room !== socket.id
        );

      for (
        const key of initialCodeSynced
      ) {
        if (
          key.startsWith(
            `${socket.id}:`
          )
        ) {
          initialCodeSynced.delete(
            key
          );
        }
      }

      joinedRooms.forEach(
        (roomId) => {
          removeUser(
            roomId,
            socket.id
          );

          io.to(roomId).emit(
            "users-in-room",
            getUsers(roomId)
          );

          socket.to(roomId).emit(
            "user-left",
            {
              socketId:
                socket.id,
            }
          );

          socket.to(roomId).emit(
            "awareness-remove",
            {
              socketId:
                socket.id,
            }
          );
        }
      );

      console.log(
        "User disconnected:",
        socket.id
      );
    }
  );
});

/* =========================================================
   YJS PERSISTENCE
   ========================================================= */

// Save changed Yjs documents to MongoDB every 5 seconds.

const persistenceTimer =
  setInterval(
    async () => {
      if (
        dirtyYjsRooms.size === 0
      ) {
        return;
      }

      const roomsToSave =
        [
          ...dirtyYjsRooms,
        ];

      for (
        const roomId of roomsToSave
      ) {
        try {
          await saveDocument(
            roomId
          );

          dirtyYjsRooms.delete(
            roomId
          );

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

const PORT =
  process.env.PORT || 3001;

connectDB()
  .then(() => {
    server.listen(
      PORT,
      () => {
        console.log(
          `SyncSpace server running on port ${PORT}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "Database connection failed:",
      error
    );
  });