const Y = require("yjs");
const CodeDocument = require("../models/CodeDocument");

// Store one Yjs document for each collaborative room
const documents = new Map();

// Track which rooms have been loaded from MongoDB
const loadedRooms = new Set();

function getDocument(roomId) {
  if (!documents.has(roomId)) {
    const doc = new Y.Doc();

    documents.set(roomId, doc);

    console.log(`Yjs document created for room: ${roomId}`);
  }

  return documents.get(roomId);
}

// Load saved Yjs state from MongoDB
async function loadDocument(roomId) {
  const doc = getDocument(roomId);

  // Don't load the same room repeatedly
  if (loadedRooms.has(roomId)) {
    return doc;
  }

  const savedDocument = await CodeDocument.findOne({
    roomId,
    fileName: "main.js",
  });

  if (savedDocument && savedDocument.yjsState) {
    Y.applyUpdate(doc, new Uint8Array(savedDocument.yjsState));

    console.log(`Yjs state loaded from MongoDB for room: ${roomId}`);
  } else {
    console.log(`No saved Yjs state found for room: ${roomId}`);
  }

  loadedRooms.add(roomId);

  return doc;
}

// Get the complete current state of a room
function getDocumentState(roomId) {
  const doc = getDocument(roomId);

  return Y.encodeStateAsUpdate(doc);
}

// Save current Yjs state to MongoDB
async function saveDocument(roomId) {
  const doc = getDocument(roomId);

  const state = Y.encodeStateAsUpdate(doc);

  await CodeDocument.findOneAndUpdate(
    {
      roomId,
      fileName: "main.js",
    },
    {
      roomId,
      fileName: "main.js",
      content: "",
      language: "javascript",
      yjsState: Buffer.from(state),
      updatedBy: "yjs",
    },
    {
      upsert: true,
      new: true,
    }
  );

  console.log(`Yjs state saved to MongoDB for room: ${roomId}`);
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
  loadDocument,
  getDocumentState,
  applyDocumentUpdate,
  saveDocument,
};