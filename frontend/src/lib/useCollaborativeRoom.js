import { useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

/* =========================================================
   COLLABORATIVE ROOM
   ========================================================= */

export function useCollaborativeRoom(roomId) {
  /* =========================================================
     YJS DOCUMENT
     ========================================================= */

  const [doc] = useState(() => new Y.Doc());

  /* =========================================================
     REACT STATE
     ========================================================= */

  const [socket, setSocket] = useState(null);

  const [status, setStatus] = useState("connecting");

  const [peers, setPeers] = useState([]);

  const [awareness, setAwareness] = useState({});

  /* =========================================================
     SHARED WHITEBOARD SHAPES
     ========================================================= */

  const shapes = useMemo(() => {
    return doc.getArray("shapes");
  }, [doc]);

  /* =========================================================
     CONNECT TO ROOM
     ========================================================= */

  useEffect(() => {
    if (!roomId) {
      console.warn("[SyncSpace] roomId is missing.");
      return undefined;
    }

    let disposed = false;

    /* =======================================================
       CREATE SOCKET
       ======================================================= */

    const connection = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    /* =======================================================
       CONVERT SERVER DATA TO UINT8ARRAY
       ======================================================= */

    const toUint8Array = (value) => {
      if (!value) {
        return null;
      }

      if (value instanceof Uint8Array) {
        return value;
      }

      if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
      }

      if (Array.isArray(value)) {
        return new Uint8Array(value);
      }

      if (
        value &&
        value.type === "Buffer" &&
        Array.isArray(value.data)
      ) {
        return new Uint8Array(value.data);
      }

      if (
        typeof value === "object" &&
        value.buffer instanceof ArrayBuffer
      ) {
        return new Uint8Array(
          value.buffer,
          value.byteOffset || 0,
          value.byteLength
        );
      }

      return null;
    };

    /* =======================================================
       CONNECT
       ======================================================= */

    const handleConnect = () => {
      if (disposed) {
        return;
      }

      console.log(
        "[SyncSpace] Connected:",
        connection.id
      );

      setSocket(connection);
      setStatus("connected");

      /* JOIN ROOM */

      connection.emit(
        "join-room",
        roomId
      );

      /* REQUEST CURRENT YJS STATE */

      connection.emit(
        "yjs-sync-request",
        roomId
      );
    };

    /* =======================================================
       DISCONNECT
       ======================================================= */

    const handleDisconnect = (reason) => {
      if (disposed) {
        return;
      }

      console.log(
        "[SyncSpace] Disconnected:",
        reason
      );

      setStatus("disconnected");
      setPeers([]);
      setAwareness({});
      setSocket(null);
    };

    /* =======================================================
       CONNECTION ERROR
       ======================================================= */

    const handleConnectError = (error) => {
      if (disposed) {
        return;
      }

      console.error(
        "[SyncSpace] Socket connection error:",
        error
      );

      setStatus("error");
    };

    /* =======================================================
       USERS IN ROOM
       ======================================================= */

    const handleUsers = (users) => {
      if (disposed) {
        return;
      }

      setPeers(
        Array.isArray(users)
          ? users
          : []
      );
    };

    /* =======================================================
       USER JOINED
       ======================================================= */

    const handleUserJoined = ({
      socketId,
    } = {}) => {
      if (
        !socketId ||
        socketId === connection.id
      ) {
        return;
      }

      console.log(
        "[SyncSpace] User joined:",
        socketId
      );
    };

    /* =======================================================
       USER LEFT
       ======================================================= */

    const handleUserLeft = ({
      socketId,
    } = {}) => {
      if (!socketId) {
        return;
      }

      setAwareness((current) => {
        const next = {
          ...current,
        };

        delete next[socketId];

        return next;
      });
    };

    /* =======================================================
       INITIAL YJS SYNC
       ======================================================= */

    const handleYjsSync = (payload) => {
      if (
        disposed ||
        !payload
      ) {
        return;
      }

      const {
        roomId: incomingRoomId,
        update,
      } = payload;

      if (
        incomingRoomId !== roomId
      ) {
        return;
      }

      if (!update) {
        setStatus("synced");
        return;
      }

      try {
        const uint8Update =
          toUint8Array(update);

        if (!uint8Update) {
          console.warn(
            "[SyncSpace] Invalid initial Yjs update."
          );

          return;
        }

        Y.applyUpdate(
          doc,
          uint8Update,
          "remote"
        );

        setStatus("synced");

        console.log(
          "[SyncSpace] Initial Yjs state synchronized."
        );
      } catch (error) {
        console.error(
          "[SyncSpace] Failed to apply initial Yjs state:",
          error
        );

        setStatus("error");
      }
    };

    /* =======================================================
       REMOTE YJS UPDATE
       ======================================================= */

    const handleYjsUpdate = (payload) => {
      if (
        disposed ||
        !payload
      ) {
        return;
      }

      const {
        roomId: incomingRoomId,
        update,
      } = payload;

      if (
        incomingRoomId !== roomId ||
        !update
      ) {
        return;
      }

      try {
        const uint8Update =
          toUint8Array(update);

        if (!uint8Update) {
          console.warn(
            "[SyncSpace] Invalid remote Yjs update."
          );

          return;
        }

        /*
         * "remote" prevents this update from
         * being broadcast again.
         */

        Y.applyUpdate(
          doc,
          uint8Update,
          "remote"
        );

        setStatus("synced");
      } catch (error) {
        console.error(
          "[SyncSpace] Failed to apply remote Yjs update:",
          error
        );
      }
    };

    /* =======================================================
       LOCAL YJS UPDATE
       ======================================================= */

    const handleLocalYjsUpdate = (
      update,
      origin
    ) => {
      /*
       * Only locally-created changes
       * should be sent to the server.
       */

      if (origin !== "local") {
        return;
      }

      if (!connection.connected) {
        console.warn(
          "[SyncSpace] Socket disconnected. Yjs update not sent."
        );

        return;
      }

      try {
        connection.emit(
          "yjs-update",
          {
            roomId,
            update: Array.from(update),
          }
        );
      } catch (error) {
        console.error(
          "[SyncSpace] Failed to send Yjs update:",
          error
        );
      }
    };

    /* =======================================================
       AWARENESS UPDATE
       ======================================================= */

    const handleAwarenessUpdate = ({
      socketId,
      awareness: incomingAwareness,
    } = {}) => {
      if (
        !socketId ||
        socketId === connection.id
      ) {
        return;
      }

      if (!incomingAwareness) {
        return;
      }

      setAwareness((current) => ({
        ...current,

        [socketId]: incomingAwareness,
      }));
    };

    /* =======================================================
       AWARENESS REMOVE
       ======================================================= */

    const handleAwarenessRemove = ({
      socketId,
    } = {}) => {
      if (!socketId) {
        return;
      }

      setAwareness((current) => {
        const next = {
          ...current,
        };

        delete next[socketId];

        return next;
      });
    };

    /* =======================================================
       SOCKET LISTENERS
       ======================================================= */

    connection.on(
      "connect",
      handleConnect
    );

    connection.on(
      "disconnect",
      handleDisconnect
    );

    connection.on(
      "connect_error",
      handleConnectError
    );

    connection.on(
      "users-in-room",
      handleUsers
    );

    connection.on(
      "user-joined",
      handleUserJoined
    );

    connection.on(
      "user-left",
      handleUserLeft
    );

    connection.on(
      "yjs-sync",
      handleYjsSync
    );

    connection.on(
      "yjs-update",
      handleYjsUpdate
    );

    connection.on(
      "awareness-update",
      handleAwarenessUpdate
    );

    connection.on(
      "awareness-remove",
      handleAwarenessRemove
    );

    /* =======================================================
       YJS LISTENER
       ======================================================= */

    doc.on(
      "update",
      handleLocalYjsUpdate
    );

    /* =======================================================
       CLEANUP
       ======================================================= */

    return () => {
      disposed = true;

      console.log(
        "[SyncSpace] Cleaning room:",
        roomId
      );

      /* REMOVE YJS LISTENER */

      doc.off(
        "update",
        handleLocalYjsUpdate
      );

      /* NOTIFY SERVER */

      if (connection.connected) {
        connection.emit(
          "awareness-remove",
          {
            roomId,
          }
        );

        connection.emit(
          "leave-room",
          roomId
        );
      }

      /* REMOVE SOCKET LISTENERS */

      connection.off(
        "connect",
        handleConnect
      );

      connection.off(
        "disconnect",
        handleDisconnect
      );

      connection.off(
        "connect_error",
        handleConnectError
      );

      connection.off(
        "users-in-room",
        handleUsers
      );

      connection.off(
        "user-joined",
        handleUserJoined
      );

      connection.off(
        "user-left",
        handleUserLeft
      );

      connection.off(
        "yjs-sync",
        handleYjsSync
      );

      connection.off(
        "yjs-update",
        handleYjsUpdate
      );

      connection.off(
        "awareness-update",
        handleAwarenessUpdate
      );

      connection.off(
        "awareness-remove",
        handleAwarenessRemove
      );

      /* DISCONNECT */

      connection.disconnect();
    };
  }, [doc, roomId]);

  /* =========================================================
     SEND AWARENESS
     ========================================================= */

  const updateAwareness = (data) => {
    if (!socket || !socket.connected) {
      return;
    }

    socket.emit(
      "awareness-update",
      {
        roomId,
        awareness: data,
      }
    );
  };

  /* =========================================================
     RETURN
     ========================================================= */

  return {
    doc,
    socket,
    status,
    peers,
    awareness,
    shapes,
    updateAwareness,
  };
}