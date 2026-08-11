const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const {
    getDocumentState,
    applyDocumentUpdate
} = require("./yjs/yjsManager");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get("/", (req, res) => {
    res.send("SyncSpace Backend is running");
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join a collaborative room
    socket.on("join-room", (roomId) => {
        socket.join(roomId);

        console.log(`${socket.id} joined room: ${roomId}`);

        socket.to(roomId).emit("user-joined", {
            socketId: socket.id
        });
    });

    // Leave a collaborative room
    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);

        console.log(`${socket.id} left room: ${roomId}`);

        socket.to(roomId).emit("user-left", {
            socketId: socket.id
        });
    });

    // Send a message/event to users in the same room
    socket.on("room-message", ({ roomId, message }) => {
        socket.to(roomId).emit("room-message", {
            socketId: socket.id,
            message: message
        });
    });

    // Send the current Yjs document state to a client
socket.on("yjs-sync-request", (roomId) => {
    const state = getDocumentState(roomId);

    socket.emit("yjs-sync", {
        roomId,
        update: state
    });

    console.log(`Yjs state sent to ${socket.id} for room: ${roomId}`);
});

// Receive and broadcast Yjs document updates
socket.on("yjs-update", ({ roomId, update }) => {
    try {
        const appliedUpdate = applyDocumentUpdate(roomId, update);

        socket.to(roomId).emit("yjs-update", {
            socketId: socket.id,
            roomId,
            update: appliedUpdate
        });

        console.log(`Yjs update synchronized in room: ${roomId}`);
    } catch (error) {
        console.error("Yjs update error:", error);
    }
});

    // User disconnected
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});
const PORT = 5000;

server.listen(PORT, () => {
    console.log(`SyncSpace server running on port ${PORT}`);
});