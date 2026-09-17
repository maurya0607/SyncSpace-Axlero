const express = require("express");

const Room = require("../models/Room");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// Create a room. Only authenticated users can create rooms.
router.post("/", authenticateToken, async (req, res) => {
  try {
    const requestedRoomId = String(req.body?.roomId || "").trim();
    const roomId =
      requestedRoomId ||
      Math.random().toString(36).slice(2, 8);

    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(roomId)) {
      return res.status(400).json({
        message: "Room ID must contain 3–64 letters, numbers, hyphens, or underscores.",
      });
    }

    const existingRoom = await Room.findOne({ roomId });
    if (existingRoom) {
      return res.status(409).json({ message: "That room already exists. Please try another room ID." });
    }

    const room = await Room.create({
      roomId,
      invitedUsers: [req.user.userId],
      activeUsers: 0,
    });

    return res.status(201).json({
      message: "Room created successfully",
      room: { roomId: room.roomId },
    });
  } catch (error) {
    console.error("Room creation error:", error);
    return res.status(500).json({ message: "Unable to create room" });
  }
});

// Invite a user to a room.
router.post("/:roomId/invite", authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const alreadyInvited = room.invitedUsers.some(
      (id) => id.toString() === user._id.toString()
    );

    if (alreadyInvited) {
      return res.status(409).json({ message: "User is already invited" });
    }

    room.invitedUsers.push(user._id);
    await room.save();

    return res.json({ message: "User invited successfully" });
  } catch (error) {
    console.error("Invitation error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
