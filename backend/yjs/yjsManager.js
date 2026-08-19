const Y = require("yjs");

// Store one Yjs document for each collaborative room
const documents = new Map();

function getDocument(roomId) {
    if (!documents.has(roomId)) {
        const doc = new Y.Doc();
        documents.set(roomId, doc);

        console.log(`Yjs document created for room: ${roomId}`);
    }

    return documents.get(roomId);
}

// Get the complete current state of a room
function getDocumentState(roomId) {
    const doc = getDocument(roomId);
    return Y.encodeStateAsUpdate(doc);
}

// Apply a change received from a client
function applyDocumentUpdate(roomId, update) {
    const doc = getDocument(roomId);

    const uint8Update =
        update instanceof Uint8Array
            ? update
            : new Uint8Array(update);

    Y.applyUpdate(doc, uint8Update);

    return uint8Update;
}

module.exports = {
    getDocument,
    getDocumentState,
    applyDocumentUpdate
};