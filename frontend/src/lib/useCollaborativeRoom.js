import { useEffect, useMemo, useRef, useState } from "react";
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

  /* =======================================================
     FRONTEND-ONLY FALLBACK SYNC
     -------------------------------------------------------
     BroadcastChannel keeps two SyncSpace tabs/windows on the
     same browser origin synchronized even when the backend is
     unavailable. Socket.IO remains the preferred transport.
     ======================================================= */
  const [clientId] = useState(
    () => `client-${Math.random().toString(36).slice(2, 10)}`,
  );
  const broadcastChannelRef = useRef(null);

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

    const authToken =
      localStorage.getItem("syncspace_token") ||
      sessionStorage.getItem("syncspace_token");

    /*
     * The frontend can still collaborate locally between tabs/windows
     * when the backend is unavailable. If a token exists, Socket.IO
     * is also attempted as the preferred real-time transport.
     */
    const connection = authToken
      ? io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })
      : null;

    /* =======================================================
       BROADCAST CHANNEL FALLBACK
       ======================================================= */
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(`syncspace:${roomId}:yjs`)
        : null;

    broadcastChannelRef.current = channel;

    const broadcast = (message) => {
      try {
        channel?.postMessage({
          ...message,
          senderId: clientId,
        });
      } catch (error) {
        console.warn("[SyncSpace] Broadcast failed:", error);
      }
    };

    const handleBroadcast = (event) => {
      const message = event?.data;
      if (!message || message.senderId === clientId) return;

      if (message.type === "request-state") {
        broadcast({
          type: "state",
          targetId: message.senderId,
          update: Array.from(Y.encodeStateAsUpdate(doc)),
        });
        return;
      }

      if (message.type === "awareness") {
        if (!message.awareness) return;

        setAwareness((current) => ({
          ...current,
          [message.senderId]: message.awareness,
        }));
        return;
      }

      if (
        message.type === "state" ||
        message.type === "update"
      ) {
        if (message.targetId && message.targetId !== clientId) return;

        try {
          const uint8Update = toUint8Array(message.update);
          if (!uint8Update) return;

          Y.applyUpdate(doc, uint8Update, "broadcast");
          setStatus((current) =>
            current === "error" || current === "disconnected"
              ? "synced"
              : current,
          );
        } catch (error) {
          console.error("[SyncSpace] Failed to apply browser sync:", error);
        }
      }
    };

    channel?.addEventListener("message", handleBroadcast);

    /*
     * Ask an already-open tab for the current Yjs document.
     * This is what makes a newly opened window immediately receive
     * the existing whiteboard.
     */
    broadcast({ type: "request-state" });

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

      try {
        broadcast({
          type: "update",
          roomId,
          update: Array.from(update),
        });

        if (connection?.connected) {
          connection.emit(
            "yjs-update",
            {
              roomId,
              update: Array.from(update),
            }
          );
        }
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

    connection?.on(
      "connect",
      handleConnect
    );

    connection?.on(
      "disconnect",
      handleDisconnect
    );

    connection?.on(
      "connect_error",
      handleConnectError
    );

    connection?.on(
      "users-in-room",
      handleUsers
    );

    connection?.on(
      "user-joined",
      handleUserJoined
    );

    connection?.on(
      "user-left",
      handleUserLeft
    );

    connection?.on(
      "yjs-sync",
      handleYjsSync
    );

    connection?.on(
      "yjs-update",
      handleYjsUpdate
    );

    connection?.on(
      "awareness-update",
      handleAwarenessUpdate
    );

    connection?.on(
      "awareness-remove",
      handleAwarenessRemove
    );

    if (!connection) {
      queueMicrotask(() => {
        if (!disposed) {
          setStatus("synced");
        }
      });
    }

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

      if (connection?.connected) {
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

      connection?.off(
        "connect",
        handleConnect
      );

      connection?.off(
        "disconnect",
        handleDisconnect
      );

      connection?.off(
        "connect_error",
        handleConnectError
      );

      connection?.off(
        "users-in-room",
        handleUsers
      );

      connection?.off(
        "user-joined",
        handleUserJoined
      );

      connection?.off(
        "user-left",
        handleUserLeft
      );

      connection?.off(
        "yjs-sync",
        handleYjsSync
      );

      connection?.off(
        "yjs-update",
        handleYjsUpdate
      );

      connection?.off(
        "awareness-update",
        handleAwarenessUpdate
      );

      connection?.off(
        "awareness-remove",
        handleAwarenessRemove
      );

      /* DISCONNECT */

      channel?.removeEventListener("message", handleBroadcast);
      channel?.close();
      broadcastChannelRef.current = null;
      connection?.disconnect();
    };
  }, [clientId, doc, roomId]);

  /* =========================================================
     SEND AWARENESS
     ========================================================= */

  const updateAwareness = (data) => {
    const message = {
      type: "awareness",
      roomId,
      awareness: data,
    };

    try {
      broadcastChannelRef.current?.postMessage(message);
    } catch {
      // Browser-to-browser awareness is best-effort.
    }

    if (socket?.connected) {
      socket.emit(
        "awareness-update",
        {
          roomId,
          awareness: data,
        }
      );
    }
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