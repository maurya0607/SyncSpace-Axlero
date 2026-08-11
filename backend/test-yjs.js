const io = require("socket.io-client");
const Y = require("yjs");

const SERVER_URL = "http://localhost:5000";
const ROOM_ID = "yjs-test-room";

const client1 = io(SERVER_URL);
const client2 = io(SERVER_URL);

client2.on("yjs-sync", ({ roomId, update }) => {
    const doc = new Y.Doc();

    Y.applyUpdate(doc, new Uint8Array(update));

    const text = doc.getText("content");

    console.log("Client 2 received room:", roomId);
    console.log("Client 2 received content:", text.toString());

    client1.disconnect();
    client2.disconnect();
    process.exit(0);
});

client1.on("connect", () => {
    console.log("Client 1 connected");

    client1.emit("join-room", ROOM_ID);

    const doc = new Y.Doc();
    const text = doc.getText("content");

    text.insert(0, "Hello from Yjs!");

    const update = Y.encodeStateAsUpdate(doc);

    client1.emit("yjs-update", {
        roomId: ROOM_ID,
        update
    });

    console.log("Client 1 sent Yjs update");
});

client2.on("connect", () => {
    console.log("Client 2 connected");

    client2.emit("join-room", ROOM_ID);

    setTimeout(() => {
        client2.emit("yjs-sync-request", ROOM_ID);
    }, 500);
});