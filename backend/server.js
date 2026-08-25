
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

    if (!token) {
      return next(
        new Error("Authentication token required")
      );
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

const PORT = process.env.PORT || 3001;

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`SyncSpace server running on port ${PORT}`);
    });
});
