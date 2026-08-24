const Room = require("./models/Room");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Presence System
const {
  addUser,
  removeUser,
  getUsers,
} = require("./services/presence");

// Yjs / CRDT
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

/*
 * Stores the latest code state for every room.
 *
 * roomCodeState = {
 *   roomId: {
 *      files: [],
 *      activeFileId: "...",
 *      revision: 1
 *   }
 * }
 */

const roomCodeState = new Map();

/*
 * Keeps track of which sockets have already received
 * the initial code state for a room.
 *
 * This prevents continuous code-sync-request loops.
 */
const initialCodeSynced = new Set();

/* =========================================================
   BASIC ROUTE
   ========================================================= */

app.get("/", (req, res) => {
  res.send("SyncSpace Backend is running");
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

    console.log(`${socket.id} joined room: ${roomId}`);

    /*
     * Tell everyone the current users.
     */
    io.to(roomId).emit(
      "users-in-room",
      getUsers(roomId)
    );

    /*
     * Tell existing users that somebody joined.
     */
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
    });
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

    /*
     * Allow this socket to receive initial state again
     * if it rejoins later.
     */
    initialCodeSynced.delete(
      `${socket.id}:${roomId}`
    );

    console.log(`${socket.id} left room: ${roomId}`);

    io.to(roomId).emit(
      "users-in-room",
      getUsers(roomId)
    );

    socket.to(roomId).emit("user-left", {
      socketId: socket.id,
    });

    socket.to(roomId).emit(
      "awareness-remove",
      {
        socketId: socket.id,
      }
    );
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
    (roomId) => {
      if (!roomId) {
        return;
      }

      const state = getDocumentState(roomId);

      socket.emit("yjs-sync", {
        roomId,
        update: state,
      });

      console.log(
        `Yjs state sent to ${socket.id} for room: ${roomId}`
      );
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
      /*
       * Validate incoming data.
       */

      if (
        !roomId ||
        !Array.isArray(files)
      ) {
        return;
      }

      /*
       * Get previous revision.
       */

      const previousState =
        roomCodeState.get(roomId);

      const previousRevision =
        previousState?.revision || 0;

      /*
       * Increase revision number.
       */

      const revision =
        previousRevision + 1;

      /*
       * Determine active file.
       */

      const nextActiveFileId =
        activeFileId ||
        files[0]?.id ||
        null;

      /*
       * Store latest state on server.
       */

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

      /*
       * Send the update ONLY to the other users.
       *
       * socket.to() does NOT send it back to the sender.
       *
       * This is important because the person typing should
       * never receive their own update as a remote update.
       */

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

      /*
       * Update server-side active file state.
       */

      const currentState =
        roomCodeState.get(roomId);

      if (currentState) {
        roomCodeState.set(
          roomId,
          {
            ...currentState,
            activeFileId: fileId,
          }
        );
      }

      /*
       * Broadcast only to other users.
       */

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
      /*
       * Find all rooms this socket belongs to.
       */

      const joinedRooms =
        [...socket.rooms].filter(
          (room) => room !== socket.id
        );

      /*
       * Remove sync markers belonging to this socket.
       */

      for (const key of initialCodeSynced) {
        if (
          key.startsWith(
            `${socket.id}:`
          )
        ) {
          initialCodeSynced.delete(key);
        }
      }

      /*
       * Remove user from every room.
       */

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
              socketId: socket.id,
            }
          );

          socket.to(roomId).emit(
            "awareness-remove",
            {
              socketId: socket.id,
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
   SERVER START
   ========================================================= */

const PORT =
  process.env.PORT || 3001;

connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`SyncSpace server running on port ${PORT}`);
    });
});
