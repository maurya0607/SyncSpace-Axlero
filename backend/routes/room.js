const express = require("express");
const mongoose = require("mongoose");

const Room = require("../models/Room");
const User = require("../models/User");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// Invite a user to a room
router.post("/:roomId/invite", authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        message: "Username is required",
      });
    }

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    const alreadyInvited = room.invitedUsers.some(
      (id) => id.toString() === user._id.toString()
    );

    if (alreadyInvited) {
      return res.status(409).json({
        message: "User is already invited",
      });
    }

    room.invitedUsers.push(user._id);
    await room.save();

    res.json({
      message: "User invited successfully",
    });
  } catch (error) {
    console.error("Invitation error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;