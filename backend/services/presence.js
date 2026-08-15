
const rooms = {};

// Add a user to a room
function addUser(roomId, socketId) {
    if (!rooms[roomId]) {
        rooms[roomId] = [];
    }

    rooms[roomId].push(socketId);

    return rooms[roomId];
}

// Remove a user from a room
function removeUser(roomId, socketId) {
    if (!rooms[roomId]) return [];

    rooms[roomId] = rooms[roomId].filter(
        id => id !== socketId
    );

    if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        return [];
    }

    return rooms[roomId];
}

// Get all users in a room
function getUsers(roomId) {
    return rooms[roomId] || [];
}

module.exports = {
    addUser,
    removeUser,
    getUsers
};