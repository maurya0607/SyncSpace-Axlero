import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";

import "./CodeEditor.css";

import Prism from "prismjs";

import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-typescript";

/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY = "syncspace-code-editor";

/* =========================================================
   DEFAULT FILES
   ========================================================= */

const DEFAULT_FILES = [
  {
    id: "index-js",
    name: "index.js",
    language: "JavaScript",
    code: `function hello() {
  console.log("Hello SyncSpace!");
}`,
    savedCode: `function hello() {
  console.log("Hello SyncSpace!");
}`,
  },
  {
    id: "test-js",
    name: "test.js",
    language: "JavaScript",
    code: `console.log("Hello from SyncSpace!");`,
    savedCode: `console.log("Hello from SyncSpace!");`,
  },
];

/* =========================================================
   LANGUAGE MAP
   ========================================================= */

const LANGUAGE_BY_EXTENSION = {
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",

  py: "Python",

  html: "HTML",
  htm: "HTML",

  css: "CSS",

  json: "JSON",

  ts: "TypeScript",
  tsx: "TypeScript",

  txt: "Plain Text",
};

/* =========================================================
   PRISM LANGUAGE MAP
   ========================================================= */

const PRISM_LANGUAGE_MAP = {
  JavaScript: "javascript",
  Python: "python",
  HTML: "markup",
  CSS: "css",
  JSON: "json",
  TypeScript: "typescript",
};

/* =========================================================
   TAB LANGUAGE LABEL
   ========================================================= */

function getTabLanguageLabel(language) {
  const labels = {
    JavaScript: "JS",
    Python: "PY",
    HTML: "HTML",
    CSS: "CSS",
    JSON: "JSON",
    TypeScript: "TS",
    "Plain Text": "TXT",
  };

  return labels[language] || "TXT";
}

/* =========================================================
   GET LANGUAGE FROM FILE NAME
   ========================================================= */

function getLanguageFromFileName(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  return LANGUAGE_BY_EXTENSION[extension] || "Plain Text";
}

/* =========================================================
   LOAD LOCAL STORAGE
   ========================================================= */

function loadEditorData() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (!storedData) {
      return null;
    }

    const parsed = JSON.parse(storedData);

    if (!parsed || !Array.isArray(parsed.files)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load Code Editor data:", error);

    return null;
  }
}

/* =========================================================
   CREATE SAFE LOCAL FILE STATE
   ========================================================= */

function normalizeFiles(files) {
  if (!Array.isArray(files) || !files.length) {
    return DEFAULT_FILES;
  }

  return files.map((file, index) => ({
    id: file.id || `${file.name || "file"}-${index}`,
    name: file.name || `file-${index + 1}.js`,
    language: file.language || getLanguageFromFileName(file.name || ""),
    code: typeof file.code === "string" ? file.code : "",
    savedCode:
      typeof file.savedCode === "string"
        ? file.savedCode
        : typeof file.code === "string"
          ? file.code
          : "",
  }));
}

/* =========================================================
   CODE EDITOR
   ========================================================= */

function CodeEditor({ socket, roomId: roomIdProp }) {
  /* =======================================================
     ROOM ID
     ======================================================= */

  const roomId =
    roomIdProp ||
    decodeURIComponent(
      window.location.pathname.split("/room/")[1] || "default-room",
    );

  /* =======================================================
     LOCAL STORAGE INITIAL DATA
     ======================================================= */

  const storedEditorData = useMemo(() => loadEditorData(), []);

  /* =======================================================
     FILE STATE
     ======================================================= */

  const [files, setFiles] = useState(() =>
    normalizeFiles(storedEditorData?.files || DEFAULT_FILES),
  );

  /* =======================================================
     ACTIVE FILE
     ======================================================= */

  const [activeFileId, setActiveFileId] = useState(() => {
    const storedId = storedEditorData?.activeFileId;

    const storedFiles = storedEditorData?.files;

    if (
      storedId &&
      Array.isArray(storedFiles) &&
      storedFiles.some((file) => file.id === storedId)
    ) {
      return storedId;
    }

    return DEFAULT_FILES[0].id;
  });

  /* =======================================================
     OUTPUT
     ======================================================= */

  const [output, setOutput] = useState([
    "JavaScript execution is currently supported in the browser.",
  ]);

  /* =======================================================
     CURSOR
     ======================================================= */

  const [cursorPosition, setCursorPosition] = useState({
    line: 1,
    column: 1,
  });

  /* =======================================================
     MODALS
     ======================================================= */

  const [showNewFileModal, setShowNewFileModal] = useState(false);

  const [newFileName, setNewFileName] = useState("");

  const [showRenameModal, setShowRenameModal] = useState(false);

  const [renameFileName, setRenameFileName] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [filePendingDelete, setFilePendingDelete] = useState(null);

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const [filePendingClose, setFilePendingClose] = useState(null);

  const [showFileMenu, setShowFileMenu] = useState(false);

  /* =======================================================
     REFS
     ======================================================= */

  const textareaRef = useRef(null);

  const lineNumbersRef = useRef(null);

  const previousFilesRef = useRef(null);

  /*
   * IMPORTANT:
   *
   * When a remote code update is received,
   * we change React state.
   *
   * That state change must NOT be sent back
   * to the server as if it were a local change.
   */

  const applyingRemoteCodeRef = useRef(false);

  const hasReceivedInitialSyncRef = useRef(false);

  const codeRevisionRef = useRef(0);

  const localChangePendingRef = useRef(false);

  /* =======================================================
     REMOTE CURSORS
     ======================================================= */

  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const applyingRemoteUpdateRef = useRef(false);


  const [remoteCursors, setRemoteCursors] = useState({});

  const [remoteCursorPositions, setRemoteCursorPositions] = useState({});

  const [editorScroll, setEditorScroll] = useState({
    top: 0,
    left: 0,
  });

  /* =======================================================
     USER ID
     ======================================================= */

  const [userId] = useState(
    () => `user-${Math.random().toString(36).substring(2, 9)}`,
  );

  /* =======================================================
     USER COLOR
     ======================================================= */

  const [userColor] = useState(() => {
    const colors = [
      "#7c3aed",
      "#2563eb",
      "#059669",
      "#dc2626",
      "#ea580c",
      "#0891b2",
    ];

    return colors[Math.floor(Math.random() * colors.length)];
  });

  /* =======================================================
     ACTIVE FILE
     ======================================================= */

  const activeFile = useMemo(() => {
    return files.find((file) => file.id === activeFileId) || files[0] || null;
  }, [files, activeFileId]);

  /* =======================================================
     SYNTAX HIGHLIGHTING
     ======================================================= */

  const highlightedCode = useMemo(() => {
    if (!activeFile) {
      return "";
    }

    const prismLanguage = PRISM_LANGUAGE_MAP[activeFile.language];

    if (!prismLanguage) {
      return escapeHtml(activeFile.code);
    }

    const grammar = Prism.languages[prismLanguage];

    if (!grammar) {
      return escapeHtml(activeFile.code);
    }

    return Prism.highlight(activeFile.code, grammar, prismLanguage);
  }, [activeFile]);

  /* =======================================================
     LINE NUMBERS
     ======================================================= */

  const lineNumbers = useMemo(() => {
    if (!activeFile) {
      return [1];
    }

    const lineCount = Math.max(1, activeFile.code.split("\n").length);

    return Array.from(
      {
        length: lineCount,
      },
      (_, index) => index + 1,
    );
  }, [activeFile]);

  /* =======================================================
     SAVE STATUS
     ======================================================= */

  const isUnsaved = useMemo(() => {
    if (!activeFile) {
      return false;
    }

    return activeFile.code !== activeFile.savedCode;
  }, [activeFile]);

  /* =======================================================
     SAVE TO LOCAL STORAGE
     ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          files,
          activeFileId,
        }),
      );
    } catch (error) {
      console.error("Failed to save Code Editor data:", error);
    }
  }, [files, activeFileId]);
  /* =======================================================
     UPDATE FILE CODE
     ======================================================= */

  const updateFileCode = useCallback(
    (newCode) => {
      // Always update the local React state
      setFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === activeFileId
            ? {
                ...file,
                code: newCode,
              }
            : file,
        ),
      );

      // Do not create a new Yjs update while applying
      // a change received from another user.
      if (!ydocRef.current || applyingRemoteUpdateRef.current) {
        return;
      }

      const yfiles = ydocRef.current.getMap("files");

      let ytext = yfiles.get(activeFileId);

      if (!ytext) {
        ytext = new Y.Text();

        yfiles.set(activeFileId, ytext);
      }

      // Replace the shared text with the latest editor content.
      ydocRef.current.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newCode);
      }, "local");
    },
    [activeFileId],
  );

    /* =======================================================
     COLLABORATIVE CODE SYNC
     ======================================================= */

  useEffect(() => {
    if (!socket || !roomId) {
      return undefined;
    }

    /* -------------------------------------------------------
       INITIAL CODE SYNC
       ------------------------------------------------------- */

    const handleCodeSync = ({
      roomId: incomingRoomId,
      files: incomingFiles,
      activeFileId: incomingActiveFileId,
      revision = 0,
    } = {}) => {
      if (
        incomingRoomId !== roomId ||
        !Array.isArray(incomingFiles) ||
        incomingFiles.length === 0
      ) {
        return;
      }

      /*
       * This update came from the server.
       * Do not send it back as a local edit.
       */
      applyingRemoteCodeRef.current = true;

      codeRevisionRef.current =
        revision;

      previousFilesRef.current =
        incomingFiles;

      setFiles(incomingFiles);

      setActiveFileId(
        (currentId) => {
          if (
            incomingActiveFileId &&
            incomingFiles.some(
              (file) =>
                file.id ===
                incomingActiveFileId
            )
          ) {
            return incomingActiveFileId;
          }

          if (
            incomingFiles.some(
              (file) =>
                file.id === currentId
            )
          ) {
            return currentId;
          }

          return (
            incomingFiles[0]?.id ||
            DEFAULT_FILES[0].id
          );
        }
      );

      hasReceivedInitialSyncRef.current =
        true;

      localChangePendingRef.current =
        false;

      requestAnimationFrame(() => {
        applyingRemoteCodeRef.current =
          false;
      });
    };

    /* -------------------------------------------------------
       NO EXISTING ROOM STATE
       ------------------------------------------------------- */

    const handleCodeSyncEmpty = ({
      roomId: incomingRoomId,
    } = {}) => {
      if (
        incomingRoomId !== roomId
      ) {
        return;
      }

      /*
       * This browser becomes the initial
       * source of the room's code state.
       */
      hasReceivedInitialSyncRef.current =
        true;

      codeRevisionRef.current =
        0;

      previousFilesRef.current =
        files;

      localChangePendingRef.current =
        true;

      socket.emit("code-update", {
        roomId,
        files,
        activeFileId,
        baseRevision: 0,
      });

      console.log(
        "[SyncSpace] Created initial collaborative code state."
      );
    };

    /* -------------------------------------------------------
       REMOTE CODE UPDATE
       ------------------------------------------------------- */

    const handleRemoteCodeUpdate = ({
      socketId,
      roomId: incomingRoomId,
      files: incomingFiles,
      activeFileId: incomingActiveFileId,
      revision = 0,
    } = {}) => {
      if (
        incomingRoomId !== roomId ||
        !Array.isArray(incomingFiles)
      ) {
        return;
      }

      /*
       * Ignore updates that are older than the
       * state we already have.
       */
      if (
        revision <
        codeRevisionRef.current
      ) {
        return;
      }

      /*
       * Mark this as a remote update.
       */
      applyingRemoteCodeRef.current =
        true;

      codeRevisionRef.current =
        revision;

      previousFilesRef.current =
        incomingFiles;

      localChangePendingRef.current =
        false;

      setFiles(incomingFiles);

      setActiveFileId(
        (currentId) => {
          if (
            incomingActiveFileId &&
            incomingFiles.some(
              (file) =>
                file.id ===
                incomingActiveFileId
            )
          ) {
            return incomingActiveFileId;
          }

          if (
            incomingFiles.some(
              (file) =>
                file.id === currentId
            )
          ) {
            return currentId;
          }

          return (
            incomingFiles[0]?.id ||
            DEFAULT_FILES[0].id
          );
        }
      );

      requestAnimationFrame(() => {
        applyingRemoteCodeRef.current =
          false;
      });

      console.log(
        `[SyncSpace] Remote code update received from ${socketId || "server"} ` +
          `(revision ${revision})`
      );
    };

    /* -------------------------------------------------------
       SERVER ACKNOWLEDGEMENT
       ------------------------------------------------------- */

    const handleCodeUpdateAck = ({
      roomId: incomingRoomId,
      revision = 0,
    } = {}) => {
      if (
        incomingRoomId !== roomId
      ) {
        return;
      }

      if (
        revision >=
        codeRevisionRef.current
      ) {
        codeRevisionRef.current =
          revision;
      }

      localChangePendingRef.current =
        false;

      console.log(
        `[SyncSpace] Code update accepted at revision ${revision}.`
      );
    };

    /* -------------------------------------------------------
       CONFLICT / STALE UPDATE
       ------------------------------------------------------- */

    const handleCodeConflict = ({
      roomId: incomingRoomId,
      files: incomingFiles,
      activeFileId: incomingActiveFileId,
      revision = 0,
    } = {}) => {
      if (
        incomingRoomId !== roomId ||
        !Array.isArray(incomingFiles)
      ) {
        return;
      }

      console.warn(
        "[SyncSpace] Code conflict detected. " +
          "Applying the latest server state."
      );

      applyingRemoteCodeRef.current =
        true;

      codeRevisionRef.current =
        revision;

      previousFilesRef.current =
        incomingFiles;

      localChangePendingRef.current =
        false;

      setFiles(incomingFiles);

      setActiveFileId(
        (currentId) => {
          if (
            incomingActiveFileId &&
            incomingFiles.some(
              (file) =>
                file.id ===
                incomingActiveFileId
            )
          ) {
            return incomingActiveFileId;
          }

          if (
            incomingFiles.some(
              (file) =>
                file.id === currentId
            )
          ) {
            return currentId;
          }

          return (
            incomingFiles[0]?.id ||
            DEFAULT_FILES[0].id
          );
        }
      );

      requestAnimationFrame(() => {
        applyingRemoteCodeRef.current =
          false;
      });
    };

    /* -------------------------------------------------------
       REGISTER EVENTS
       ------------------------------------------------------- */

    socket.on(
      "code-sync",
      handleCodeSync
    );

    socket.on(
      "code-sync-empty",
      handleCodeSyncEmpty
    );

    socket.on(
      "code-update",
      handleRemoteCodeUpdate
    );

    socket.on(
      "code-update-ack",
      handleCodeUpdateAck
    );

    socket.on(
      "code-conflict",
      handleCodeConflict
    );

    /* -------------------------------------------------------
       REQUEST CURRENT ROOM STATE
       ------------------------------------------------------- */

    if (socket.connected) {
      socket.emit(
        "code-sync-request",
        roomId
      );
    }

    const handleSocketConnect = () => {
      /*
       * Reset synchronization state after reconnect.
       */
      hasReceivedInitialSyncRef.current =
        false;

      localChangePendingRef.current =
        false;

      socket.emit(
        "code-sync-request",
        roomId
      );
    };

    socket.on(
      "connect",
      handleSocketConnect
    );

    return () => {
      socket.off(
        "code-sync",
        handleCodeSync
      );

      socket.off(
        "code-sync-empty",
        handleCodeSyncEmpty
      );

      socket.off(
        "code-update",
        handleRemoteCodeUpdate
      );

      socket.off(
        "code-update-ack",
        handleCodeUpdateAck
      );

      socket.off(
        "code-conflict",
        handleCodeConflict
      );

      socket.off(
        "connect",
        handleSocketConnect
      );
    };
  }, [
    socket,
    roomId,
    files,
    activeFileId,
  ]);

    /* =======================================================
     SEND LOCAL CODE CHANGES
     ======================================================= */

  useEffect(() => {
    if (
      !socket ||
      !roomId ||
      !socket.connected
    ) {
      return;
    }

    /*
     * Never broadcast a state change that came
     * from another user.
     */
    if (
      applyingRemoteCodeRef.current
    ) {
      previousFilesRef.current =
        files;

      return;
    }

    /*
     * First render / initial state.
     */
    if (
      previousFilesRef.current ===
      null
    ) {
      previousFilesRef.current =
        files;

      return;
    }

    /*
     * Nothing actually changed.
     */
    if (
      JSON.stringify(
        previousFilesRef.current
      ) ===
      JSON.stringify(files)
    ) {
      return;
    }

    /*
     * Mark this as a local change.
     */
    localChangePendingRef.current =
      true;

    socket.emit(
      "code-update",
      {
        roomId,
        files,
        activeFileId,
        baseRevision:
          codeRevisionRef.current,
      }
    );

    /*
     * Remember exactly what we sent.
     */
    previousFilesRef.current =
      files;
  }, [
    socket,
    roomId,
    files,
    activeFileId,
  ]);

  /* =======================================================
     UPDATE FILE CODE
     ======================================================= */

  const updateFileCode = useCallback(
    (newCode) => {
      setFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === activeFileId
            ? {
                ...file,
                code: newCode,
              }
            : file,
        ),
      );
    },
    [activeFileId],
  );

  /* =======================================================
     UPDATE CURSOR POSITION
     ======================================================= */

  const updateCursorPosition = useCallback((textarea) => {
    if (!textarea) {
      return;
    }

    const cursor = textarea.selectionStart;

    const textBeforeCursor = textarea.value.slice(0, cursor);

    const lines = textBeforeCursor.split("\n");

    const line = lines.length;

    const column = lines[lines.length - 1].length + 1;

    setCursorPosition({
      line,
      column,
    });
  }, []);

  /* =======================================================
     SEND AWARENESS
     ======================================================= */

  useEffect(() => {
    if (!socket || !socket.connected || !roomId) {
      return;
    }

    socket.emit("awareness-update", {
      roomId,

      awareness: {
        userId,
        userColor,

        line: cursorPosition.line,

        column: cursorPosition.column,

        fileId: activeFileId,
      },
    });
  }, [
    socket,
    roomId,
    userId,
    userColor,
    cursorPosition.line,
    cursorPosition.column,
    activeFileId,
  ]);

  /* =======================================================
     RECEIVE AWARENESS
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleAwarenessUpdate = ({ socketId, awareness } = {}) => {
      if (!socketId || !awareness) {
        return;
      }

      /*
       * Ignore ourselves.
       */

      if (awareness.userId === userId) {
        return;
      }

      setRemoteCursors((current) => ({
        ...current,
        [socketId]: awareness,
      }));
    };

    const handleAwarenessRemove = ({ socketId } = {}) => {
      if (!socketId) {
        return;
      }

      setRemoteCursors((current) => {
        const updated = {
          ...current,
        };

        delete updated[socketId];

        return updated;
      });
    };

    socket.on("awareness-update", handleAwarenessUpdate);

    socket.on("awareness-remove", handleAwarenessRemove);

    return () => {
      socket.off("awareness-update", handleAwarenessUpdate);

      socket.off("awareness-remove", handleAwarenessRemove);
    };
  }, [socket, userId]);

  /* =======================================================
     SAVE CURRENT FILE
     ======================================================= */

  const saveCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === activeFileId
          ? {
              ...file,
              savedCode: file.code,
            }
          : file,
      ),
    );

    setOutput((current) => (current.length ? current : []));
  }, [activeFile, activeFileId]);

    /* =======================================================
     SWITCH FILE
     ======================================================= */

  const switchFile =
    useCallback(
      (fileId) => {
        if (!fileId) {
          return;
        }

        setActiveFileId(
          fileId
        );

        setOutput([]);

        /*
         * Synchronize the selected tab
         * with other users.
         */
        if (
          socket &&
          socket.connected &&
          roomId
        ) {
          socket.emit(
            "active-file-change",
            {
              roomId,
              fileId,
            }
          );
        }

        requestAnimationFrame(
          () => {
            textareaRef.current?.focus();

            if (
              textareaRef.current
            ) {
              updateCursorPosition(
                textareaRef.current
              );
            }
          }
        );
      },
      [
        socket,
        roomId,
        updateCursorPosition,
      ]
    );

  useEffect(() => {
    if (!socket || !roomId) {
      return;
    }

    const handleActiveFileChange = ({ socketId, fileId } = {}) => {
      // Ignore our own event
      if (socketId === socket.id) {
        return;
      }

      if (!fileId) {
        return;
      }

      // Make sure the file exists locally
      setFiles((currentFiles) => {
        const exists = currentFiles.some((file) => file.id === fileId);

        if (!exists) {
          return currentFiles;
        }

        return currentFiles;
      });

      // Change the active tab
      setActiveFileId(fileId);

      // Clear output because we changed file
      setOutput([]);

      // Focus editor after React updates
      requestAnimationFrame(() => {
        textareaRef.current?.focus();

        if (textareaRef.current) {
          updateCursorPosition(textareaRef.current);
        }
      });
    };

    socket.on("active-file-change", handleActiveFileChange);

    return () => {
      socket.off("active-file-change", handleActiveFileChange);
    };
  }, [socket, roomId, updateCursorPosition]);

  /* =======================================================
   RECEIVE REMOTE ACTIVE FILE
   ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleRemoteActiveFileChange = ({
      socketId,
      roomId: incomingRoomId,
      fileId,
    } = {}) => {
      // Ignore invalid messages
      if (!fileId) {
        return;
      }

      // Make sure the event belongs to this room
      if (incomingRoomId && incomingRoomId !== roomId) {
        return;
      }

      // Ignore our own event
      if (socketId && socketId === socket.id) {
        return;
      }

      // Make sure the file actually exists
      setFiles((currentFiles) => {
        const fileExists = currentFiles.some((file) => file.id === fileId);

        if (!fileExists) {
          return currentFiles;
        }

        return currentFiles;
      });

      // Change the active tab
      setActiveFileId(fileId);

      // Clear output
      setOutput([]);

      // Focus editor after tab changes
      requestAnimationFrame(() => {
        textareaRef.current?.focus();

        if (textareaRef.current) {
          updateCursorPosition(textareaRef.current);
        }
      });
    };

    socket.on("active-file-change", handleRemoteActiveFileChange);

    return () => {
      socket.off("active-file-change", handleRemoteActiveFileChange);
    };
  }, [socket, roomId, updateCursorPosition]);

  /* =======================================================
     CREATE NEW FILE
     ======================================================= */

  const openNewFileModal = useCallback(() => {
    setNewFileName("");

    setShowNewFileModal(true);
  }, []);

  const closeNewFileModal = useCallback(() => {
    setShowNewFileModal(false);

    setNewFileName("");
  }, []);

  const createNewFile = useCallback(() => {
    const trimmedName = newFileName.trim();

    if (!trimmedName) {
      return;
    }

    const alreadyExists = files.some(
      (file) => file.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (alreadyExists) {
      return;
    }

    const language = getLanguageFromFileName(trimmedName);

    const newFile = {
      id: `${trimmedName}-${Date.now()}`,
      name: trimmedName,
      language,
      code: "",
      savedCode: "",
    };

    setFiles((currentFiles) => [...currentFiles, newFile]);

    setActiveFileId(newFile.id);

    setNewFileName("");

    setShowNewFileModal(false);

    setOutput([]);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [files, newFileName]);

  /* =======================================================
     RENAME FILE
     ======================================================= */

  const openRenameModal = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setRenameFileName(activeFile.name);

    setShowRenameModal(true);

    setShowFileMenu(false);
  }, [activeFile]);

  const closeRenameModal = useCallback(() => {
    setShowRenameModal(false);

    setRenameFileName("");
  }, []);

  const renameCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    const trimmedName = renameFileName.trim();

    if (!trimmedName) {
      return;
    }

    if (trimmedName === activeFile.name) {
      closeRenameModal();

      return;
    }

    const duplicate = files.some(
      (file) =>
        file.id !== activeFile.id &&
        file.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicate) {
      return;
    }

    const language = getLanguageFromFileName(trimmedName);

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              name: trimmedName,
              language,
            }
          : file,
      ),
    );

    closeRenameModal();
  }, [activeFile, renameFileName, files, closeRenameModal]);

  /* =======================================================
     DUPLICATE FILE
     ======================================================= */

  const duplicateCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    const dotIndex = activeFile.name.lastIndexOf(".");

    const baseName =
      dotIndex > 0 ? activeFile.name.substring(0, dotIndex) : activeFile.name;

    const extension = dotIndex > 0 ? activeFile.name.substring(dotIndex) : "";

    let duplicateName = `${baseName} copy${extension}`;

    let counter = 2;

    while (
      files.some(
        (file) => file.name.toLowerCase() === duplicateName.toLowerCase(),
      )
    ) {
      duplicateName = `${baseName} copy ${counter}${extension}`;

      counter += 1;
    }

    const duplicatedFile = {
      ...activeFile,
      id: `${duplicateName}-${Date.now()}`,
      name: duplicateName,
      savedCode: activeFile.code,
    };

    setFiles((currentFiles) => [...currentFiles, duplicatedFile]);

    if (ydocRef.current) {
      const yfiles = ydocRef.current.getMap("files");
      const yfileMeta = ydocRef.current.getMap("fileMeta");

      ydocRef.current.transact(() => {
        const ytext = new Y.Text();
        ytext.insert(0, duplicatedFile.code || "");
        yfiles.set(duplicatedFile.id, ytext);
        yfileMeta.set(duplicatedFile.id, {
          name: duplicatedFile.name,
          language: duplicatedFile.language,
        });
      }, "local");
    }

    setActiveFileId(duplicatedFile.id);

    setOutput([]);

    setShowFileMenu(false);
  }, [activeFile, files]);

  /* =======================================================
     DELETE REQUEST
     ======================================================= */

  const requestDeleteCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    if (files.length === 1) {
      return;
    }

    setFilePendingDelete(activeFile.id);

    setShowDeleteModal(true);

    setShowFileMenu(false);
  }, [activeFile, files.length]);

  /* =======================================================
     CANCEL DELETE
     ======================================================= */

  const cancelDeleteFile = useCallback(() => {
    setFilePendingDelete(null);

    setShowDeleteModal(false);
  }, []);

  /* =======================================================
     DELETE FILE
     ======================================================= */

  const deleteFile = useCallback(() => {
    if (!filePendingDelete || files.length === 1) {
      return;
    }

    const fileIndex = files.findIndex((file) => file.id === filePendingDelete);

    const remainingFiles = files.filter(
      (file) => file.id !== filePendingDelete,
    );

    setFiles(remainingFiles);

    if (ydocRef.current) {
      const yfiles = ydocRef.current.getMap("files");
      const yfileMeta = ydocRef.current.getMap("fileMeta");

      ydocRef.current.transact(() => {
        yfiles.delete(filePendingDelete);
        yfileMeta.delete(filePendingDelete);
      }, "local");
    }

    if (filePendingDelete === activeFileId) {
      const nextIndex = Math.min(
        Math.max(fileIndex - 1, 0),
        remainingFiles.length - 1,
      );

      const nextFile = remainingFiles[nextIndex];

      if (nextFile) {
        setActiveFileId(nextFile.id);
      }
    }

    setFilePendingDelete(null);

    setShowDeleteModal(false);

    setOutput([]);
  }, [filePendingDelete, files, activeFileId]);

  /* =======================================================
     PERFORM CLOSE FILE
     ======================================================= */

  const performCloseFile = useCallback(
    (fileId) => {
      if (files.length === 1) {
        return;
      }

      const fileIndex = files.findIndex((file) => file.id === fileId);

      const remainingFiles = files.filter((file) => file.id !== fileId);

      setFiles(remainingFiles);

      if (fileId === activeFileId) {
        const nextIndex = Math.max(0, fileIndex - 1);

        const nextFile = remainingFiles[nextIndex];

        if (nextFile) {
          setActiveFileId(nextFile.id);
        }
      }

      setFilePendingClose(null);

      setShowUnsavedModal(false);
    },
    [files, activeFileId],
  );

  /* =======================================================
     CLOSE FILE
     ======================================================= */

  const closeFile = useCallback(
    (event, fileId) => {
      event.stopPropagation();

      if (files.length === 1) {
        return;
      }

      const fileToClose = files.find((file) => file.id === fileId);

      if (!fileToClose) {
        return;
      }

      const hasUnsavedChanges = fileToClose.code !== fileToClose.savedCode;

      if (hasUnsavedChanges) {
        setFilePendingClose(fileId);

        setShowUnsavedModal(true);

        return;
      }

    if (ydocRef.current) {
      const yfileMeta = ydocRef.current.getMap("fileMeta");

      ydocRef.current.transact(() => {
        yfileMeta.set(activeFile.id, {
          name: trimmedName,
          language: newLanguage,
        });
      }, "local");
    }

    closeRenameModal();
  }, [activeFile, renameFileName, files, closeRenameModal]);

  /* =======================================================
     CANCEL CLOSE
     ======================================================= */

  const cancelCloseFile = useCallback(() => {
    setFilePendingClose(null);

    setShowUnsavedModal(false);
  }, []);

  /* =======================================================
     DISCARD AND CLOSE
     ======================================================= */

  const discardAndCloseFile = useCallback(() => {
    if (!filePendingClose) {
      return;
    }

    /* Add file locally */
    setFiles((currentFiles) => [...currentFiles, newFile]);

    /* Add file to the shared Yjs document */
    if (ydocRef.current) {
      const yfiles = ydocRef.current.getMap("files");
      const yfileMeta = ydocRef.current.getMap("fileMeta");

      ydocRef.current.transact(() => {
        const ytext = new Y.Text();
        ytext.insert(0, "");
        yfiles.set(newFile.id, ytext);

        yfileMeta.set(newFile.id, {
          name: newFile.name,
          language: newFile.language,
        });
      }, "local");

      console.log("New file added to shared Yjs:", newFile.name);
    }

    setActiveFileId(newFile.id);

  const saveAndCloseFile = useCallback(() => {
    if (!filePendingClose) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === filePendingClose
          ? {
              ...file,
              savedCode: file.code,
            }
          : file,
      ),
    );

    performCloseFile(filePendingClose);
  }, [filePendingClose, performCloseFile]);

  /* =======================================================
     CODE CHANGE
     ======================================================= */

  const handleCodeChange = useCallback(
    (event) => {
      updateFileCode(event.target.value);

      updateCursorPosition(event.target);
    },
    [updateFileCode, updateCursorPosition],
  );

  /* =======================================================
     CURSOR CHANGE
     ======================================================= */

  const handleCursorChange = useCallback(
    (event) => {
      updateCursorPosition(event.currentTarget);
    },
    [updateCursorPosition],
  );

  /* =======================================================
     EDITOR SCROLL
     ======================================================= */

  const handleEditorScroll = useCallback((event) => {
    const textarea = event.currentTarget;

    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }

    const highlight = textarea.parentElement?.querySelector(".code-highlight");

    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;

      highlight.scrollLeft = textarea.scrollLeft;
    }

    setEditorScroll({
      top: textarea.scrollTop,
      left: textarea.scrollLeft,
    });
  }, []);

  /* =======================================================
     MEASURE REMOTE CURSORS
     ======================================================= */

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !activeFile) {
      setRemoteCursorPositions({});
      return undefined;
    }

    const styles = window.getComputedStyle(textarea);

    const lineHeight =
      parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) || 14;

    const paddingTop = parseFloat(styles.paddingTop) || 0;

    const paddingLeft = parseFloat(styles.paddingLeft) || 0;

    const canvas = document.createElement("canvas");

    const context = canvas.getContext("2d");

    if (context) {
      context.font = [
        styles.fontStyle,
        styles.fontVariant,
        styles.fontWeight,
        styles.fontSize,
        styles.fontFamily,
      ].join(" ");
    }

    const codeLines = activeFile.code.split("\n");

    const positions = {};

    Object.entries(remoteCursors).forEach(([socketId, awareness]) => {
      if (!awareness || awareness.fileId !== activeFileId) {
        return;
      }

      const line = Math.max(1, Number(awareness.line) || 1);

      const column = Math.max(1, Number(awareness.column) || 1);

      const currentLine = codeLines[line - 1] || "";

      const characterOffset = Math.min(
        Math.max(0, column - 1),
        currentLine.length,
      );

      const textBeforeCursor = currentLine.slice(0, characterOffset);

      let textWidth = 0;

      if (context) {
        textWidth = context.measureText(textBeforeCursor).width;
      }

      positions[socketId] = {
        top: paddingTop + (line - 1) * lineHeight - editorScroll.top,

        left: paddingLeft + textWidth - editorScroll.left,

        userId: awareness.userId || "User",

        userColor: awareness.userColor || "#ff4d4d",
      };
    });

    setRemoteCursorPositions(positions);

    return undefined;
  }, [remoteCursors, activeFile, activeFileId, editorScroll]);

  /* =======================================================
     KEYBOARD HANDLING
     ======================================================= */

  const handleEditorKeyDown = useCallback(
    (event) => {
      const textarea = event.currentTarget;

      if (!activeFile) {
        return;
      }

      /* =================================================
           SAVE
           ================================================= */

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        saveCurrentFile();

        return;
      }

      /* =================================================
           TAB
           ================================================= */

      if (event.key === "Tab") {
        event.preventDefault();

        const start = textarea.selectionStart;

        const end = textarea.selectionEnd;

        const value = textarea.value;

        const indentation = "  ";

        /*
         * SHIFT + TAB
         */

        if (event.shiftKey) {
          const lineStart = value.lastIndexOf("\n", start - 1) + 1;

          const lineEndIndex = value.indexOf("\n", end);

          const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

          const selectedText = value.slice(lineStart, lineEnd);

          const lines = selectedText.split("\n");

          let removedCharacters = 0;

          const updatedLines = lines.map((line) => {
            if (line.startsWith("  ")) {
              removedCharacters += 2;

              return line.slice(2);
            }

            if (line.startsWith(" ")) {
              removedCharacters += 1;

              return line.slice(1);
            }

            return line;
          });

          const newValue =
            value.substring(0, lineStart) +
            updatedLines.join("\n") +
            value.substring(lineEnd);

          updateFileCode(newValue);

          requestAnimationFrame(() => {
            if (!textareaRef.current) {
              return;
            }

            textareaRef.current.selectionStart = Math.max(
              lineStart,
              start - removedCharacters,
            );

            textareaRef.current.selectionEnd = Math.max(
              lineStart,
              end - removedCharacters,
            );

            updateCursorPosition(textareaRef.current);
          });

          return;
        }

        /*
         * Normal TAB
         */

        const newValue =
          value.substring(0, start) + indentation + value.substring(end);

        updateFileCode(newValue);

        requestAnimationFrame(() => {
          if (!textareaRef.current) {
            return;
          }

          const newPosition = start + indentation.length;

          textareaRef.current.selectionStart = newPosition;

          textareaRef.current.selectionEnd = newPosition;

          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      /* =================================================
           ENTER / AUTO INDENT
           ================================================= */

      if (event.key === "Enter") {
        event.preventDefault();

        const start = textarea.selectionStart;

        const end = textarea.selectionEnd;

        const value = textarea.value;

        const lineStart = value.lastIndexOf("\n", start - 1) + 1;

        const currentLine = value.slice(lineStart, start);

        const currentIndent = currentLine.match(/^\s*/)?.[0] || "";

        const textBeforeCursor = value.slice(lineStart, start);

        const opensBlock = /[({[]\s*$/.test(textBeforeCursor);

        const nextCharacter = value[end];

        const closesBlock =
          nextCharacter === "}" ||
          nextCharacter === "]" ||
          nextCharacter === ")";

        let nextIndent = currentIndent;

        if (opensBlock) {
          nextIndent += "  ";
        }

        if (
          closesBlock &&
          !opensBlock &&
          textBeforeCursor.trim() === "" &&
          currentIndent.length >= 2
        ) {
          nextIndent = currentIndent.slice(0, -2);
        }

        const insertedText = "\n" + nextIndent;

        const newValue =
          value.substring(0, start) + insertedText + value.substring(end);

        updateFileCode(newValue);

        requestAnimationFrame(() => {
          if (!textareaRef.current) {
            return;
          }

          const newPosition = start + insertedText.length;

          textareaRef.current.selectionStart = newPosition;

          textareaRef.current.selectionEnd = newPosition;

          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      /* =================================================
           AUTO CLOSE BRACKETS / QUOTES
           ================================================= */

      const closingCharacters = {
        "(": ")",
        "[": "]",
        "{": "}",
        '"': '"',
        "'": "'",
        "`": "`",
      };

      if (closingCharacters[event.key]) {
        const closingCharacter = closingCharacters[event.key];

        const start = textarea.selectionStart;

        const end = textarea.selectionEnd;

        const value = textarea.value;

        /*
         * If the next character is
         * already the closing character,
         * skip it.
         */

        if (start === end && value[start] === closingCharacter) {
          event.preventDefault();

          textarea.selectionStart = start + 1;

          textarea.selectionEnd = start + 1;

          updateCursorPosition(textarea);

          return;
        }

        /*
         * Selection wrapping.
         */

        if (start !== end) {
          event.preventDefault();

          const selectedText = value.slice(start, end);

          const newValue =
            value.substring(0, start) +
            event.key +
            selectedText +
            closingCharacter +
            value.substring(end);

          updateFileCode(newValue);

          requestAnimationFrame(() => {
            if (!textareaRef.current) {
              return;
            }

            textareaRef.current.selectionStart = start + 1;

            textareaRef.current.selectionEnd = end + 1;

            updateCursorPosition(textareaRef.current);
          });

          return;
        }

        /*
         * Insert pair.
         */

        event.preventDefault();

        const newValue =
          value.substring(0, start) +
          event.key +
          closingCharacter +
          value.substring(end);

        updateFileCode(newValue);

        requestAnimationFrame(() => {
          if (!textareaRef.current) {
            return;
          }

          textareaRef.current.selectionStart = start + 1;

          textareaRef.current.selectionEnd = start + 1;

          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      /* =================================================
           CTRL + /
           ================================================= */

      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();

        const start = textarea.selectionStart;

        const end = textarea.selectionEnd;

        const value = textarea.value;

        const language = activeFile.language.toLowerCase();

        let commentPrefix = "//";

        let commentSuffix = "";

        if (language === "python") {
          commentPrefix = "#";
        }

        if (language === "html") {
          commentPrefix = "<!--";

          commentSuffix = "-->";
        }

        const selectionStart = value.lastIndexOf("\n", start - 1) + 1;

        const selectionEndIndex = value.indexOf("\n", end);

        const selectionEnd =
          selectionEndIndex === -1 ? value.length : selectionEndIndex;

        const selectedText = value.slice(selectionStart, selectionEnd);

        const lines = selectedText.split("\n");

        const allCommented = lines
          .filter((line) => line.trim().length)
          .every((line) => line.trim().startsWith(commentPrefix));

        let updatedLines;

        if (allCommented) {
          updatedLines = lines.map((line) => {
            const leading = line.match(/^\s*/)?.[0] || "";

            const trimmed = line.trim();

            if (commentSuffix) {
              const withoutPrefix = trimmed.slice(commentPrefix.length);

              const withoutSuffix = withoutPrefix.endsWith(commentSuffix)
                ? withoutPrefix.slice(0, -commentSuffix.length)
                : withoutPrefix;

              return leading + withoutSuffix.trim();
            }

            return leading + trimmed.slice(commentPrefix.length).trim();
          });
        } else {
          updatedLines = lines.map((line) => {
            const leading = line.match(/^\s*/)?.[0] || "";

            const content = line.trim();

            if (!content) {
              return line;
            }

            if (commentSuffix) {
              return (
                leading + commentPrefix + " " + content + " " + commentSuffix
              );
            }

            return leading + commentPrefix + " " + content;
          });
        }

        const newSelectedText = updatedLines.join("\n");

        const newValue =
          value.substring(0, selectionStart) +
          newSelectedText +
          value.substring(selectionEnd);

        updateFileCode(newValue);

        requestAnimationFrame(() => {
          if (!textareaRef.current) {
            return;
          }

          textareaRef.current.selectionStart = selectionStart;

          textareaRef.current.selectionEnd =
            selectionStart + newSelectedText.length;

          updateCursorPosition(textareaRef.current);
        });
      }
    },
    [activeFile, saveCurrentFile, updateFileCode, updateCursorPosition],
  );

  /* =======================================================
     RUN JAVASCRIPT
     ======================================================= */

  const runJavaScript = useCallback(() => {
    if (!activeFile) {
      return;
    }

    const logs = [];

    const originalConsoleLog = console.log;

    try {
      console.log = (...args) => {
        const formatted = args
          .map((value) => {
            if (typeof value === "object" && value !== null) {
              try {
                return JSON.stringify(value, null, 2);
              } catch {
                return String(value);
              }
            }

            return String(value);
          })
          .join(" ");

        logs.push(formatted);

        originalConsoleLog(...args);
      };

      const execute = new Function(activeFile.code);

      execute();
    } catch (error) {
      setOutput([`Error: ${error.message}`]);

      return;
    } finally {
      console.log = originalConsoleLog;
    }

    setOutput(logs.length ? logs : ["Code executed successfully."]);
  }, [activeFile]);

  /* =======================================================
     RUN CODE
     ======================================================= */

  const runCode = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setOutput([]);

    if (activeFile.language === "JavaScript") {
      runJavaScript();

      return;
    }

    if (activeFile.language === "Python") {
      setOutput([
        "Python execution is not connected yet.",
        "",
        "A Python backend/runtime will be added in a later sequence.",
      ]);

      return;
    }

    if (activeFile.language === "HTML") {
      setOutput(["HTML preview will be added in a later sequence."]);

      return;
    }

    if (activeFile.language === "CSS") {
      setOutput(["CSS preview will be added in a later sequence."]);

      return;
    }

    if (activeFile.language === "JSON") {
      try {
        JSON.parse(activeFile.code);

        setOutput(["Valid JSON."]);
      } catch (error) {
        setOutput([`Invalid JSON: ${error.message}`]);
      }

      return;
    }

    setOutput([`${activeFile.language} execution is not connected yet.`]);
  }, [activeFile, runJavaScript]);

  /* =======================================================
     CLEAR OUTPUT
     ======================================================= */

  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  useEffect(() => {
    const socket = io("http://localhost:5000");

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to SyncSpace:", socket.id);

      socket.emit("join-room", roomId);

      socket.emit("awareness-update", {
        roomId,
        awareness: {
          userId,
          userColor,
          line: cursorPosition.line,
          column: cursorPosition.column,
          fileId: activeFileId,
        },
      });

      // Ask the server for the current Yjs state.
      socket.emit("yjs-sync-request", roomId);
    });

    // ==============================
    // TASK 2: REMOTE CURSOR
    // ==============================

    socket.on("awareness-update", ({ socketId, awareness }) => {
      if (socketId === socket.id) {
        return;
      }

      setRemoteCursors((current) => ({
        ...current,
        [socketId]: awareness,
      }));
    });

    socket.on("awareness-remove", ({ socketId }) => {
      setRemoteCursors((current) => {
        const updated = { ...current };
        delete updated[socketId];
        return updated;
      });
    });

    return () => {
      socket.emit("awareness-remove", { roomId });
      socket.emit("leave-room", roomId);

      socket.off("awareness-update");
      socket.off("awareness-remove");

      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  /* =======================================================
     TASK 3: YJS REAL-TIME SYNCHRONIZATION
     ======================================================= */

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    const ydoc = new Y.Doc();
    const yfiles = ydoc.getMap("files");
    const yfileMeta = ydoc.getMap("fileMeta");

    ydocRef.current = ydoc;

    // Send local Yjs changes to the server.
    const handleYjsUpdate = (update, origin) => {
      if (origin !== "local") {
        return;
      }

      socket.emit("yjs-update", {
        roomId,
        update: Array.from(update),
      });
    };

    // Convert the complete Yjs file state into the React file state.
    // This also creates tabs for files that were created by another user.
    const syncFilesFromYjs = (markAsSaved = false) => {
      setFiles((currentFiles) => {
        const sharedIds = Array.from(yfiles.keys());
        const sharedIdSet = new Set(sharedIds);

        // Keep the existing local tab order for files that still exist,
        // then append files that arrived from another user.
        const orderedIds = [
          ...currentFiles
            .filter((file) => sharedIdSet.has(file.id))
            .map((file) => file.id),
          ...sharedIds.filter(
            (fileId) => !currentFiles.some((file) => file.id === fileId),
          ),
        ];

        return orderedIds.map((fileId) => {
          const ytext = yfiles.get(fileId);
          const currentFile = currentFiles.find((file) => file.id === fileId);
          const rawMetadata = yfileMeta.get(fileId);
          let metadata = rawMetadata || {};

          if (typeof rawMetadata === "string") {
            try {
              metadata = JSON.parse(rawMetadata);
            } catch {
              metadata = {};
            }
          }

          const name = metadata.name || currentFile?.name || fileId;
          const language =
            metadata.language ||
            currentFile?.language ||
            getLanguageFromFileName(name);

          const code = ytext instanceof Y.Text ? ytext.toString() : "";

          return {
            id: fileId,
            name,
            language,
            code,
            savedCode: markAsSaved
              ? code
              : currentFile?.savedCode ?? code,
          };
        });
      });
    };

    // Receive the current document state from the server.
    const handleInitialSync = ({ roomId: syncedRoomId, update }) => {
      if (syncedRoomId !== roomId) {
        return;
      }

      try {
        const bytes = new Uint8Array(update || []);
        Y.applyUpdate(ydoc, bytes, "remote");

        /*
         * If this is a brand-new room, the server has no Yjs files yet.
         * Seed the shared document with the current local files once.
         */
        if (yfiles.size === 0) {
          const currentFiles = files;

          ydoc.transact(() => {
            currentFiles.forEach((file) => {
              const ytext = new Y.Text();
              ytext.insert(0, file.code || "");
              yfiles.set(file.id, ytext);

              yfileMeta.set(file.id, {
                name: file.name,
                language: file.language,
              });
            });
          }, "local");

          console.log("Yjs room was empty; local files seeded.");
        } else {
          /*
           * Older rooms may contain Yjs text without metadata.
           * Add metadata for files that this browser already knows.
           */
          ydoc.transact(() => {
            files.forEach((file) => {
              if (yfiles.has(file.id) && !yfileMeta.has(file.id)) {
                yfileMeta.set(file.id, {
                  name: file.name,
                  language: file.language,
                });
              }
            });
          }, "local");

          syncFilesFromYjs(true);
          console.log("Yjs initial state synchronized.");
        }
      } catch (error) {
        console.error("Yjs initial sync failed:", error);
      }
    };

    // Receive changes made by other users.
    const handleRemoteUpdate = ({
      roomId: updatedRoomId,
      update,
    }) => {
      if (updatedRoomId !== roomId) {
        return;
      }

      try {
        applyingRemoteUpdateRef.current = true;

        Y.applyUpdate(ydoc, new Uint8Array(update || []), "remote");

        // Rebuild the complete file list so newly created files appear
        // as tabs in every connected browser.
        syncFilesFromYjs(false);

        console.log("Yjs remote update received.");
      } catch (error) {
        console.error("Yjs remote update failed:", error);
      } finally {
        applyingRemoteUpdateRef.current = false;
      }
    };

    ydoc.on("update", handleYjsUpdate);

    socket.on("yjs-sync", handleInitialSync);
    socket.on("yjs-update", handleRemoteUpdate);

    /*
     * Socket.IO may already be connected when this effect runs.
     * In that case request the state now. Otherwise the connect
     * handler in the socket effect will request it.
     */
    if (socket.connected) {
      socket.emit("yjs-sync-request", roomId);
    }

    return () => {
      ydoc.off("update", handleYjsUpdate);

      socket.off("yjs-sync", handleInitialSync);
      socket.off("yjs-update", handleRemoteUpdate);

      ydoc.destroy();

      if (ydocRef.current === ydoc) {
        ydocRef.current = null;
      }

      ytextRef.current = null;
    };
  }, [roomId]);

  /* =======================================================
     GLOBAL CTRL + S
     ======================================================= */

  useEffect(() => {
    const handleGlobalSave = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        saveCurrentFile();
      }
    };

    window.addEventListener("keydown", handleGlobalSave);

    return () => {
      window.removeEventListener("keydown", handleGlobalSave);
    };
  }, [saveCurrentFile]);

  /* =======================================================
     ESCAPE
     ======================================================= */

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (showNewFileModal) {
        closeNewFileModal();
      }

      if (showRenameModal) {
        closeRenameModal();
      }

      if (showUnsavedModal) {
        cancelCloseFile();
      }

      if (showDeleteModal) {
        cancelDeleteFile();
      }

      if (showFileMenu) {
        setShowFileMenu(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    showNewFileModal,
    showRenameModal,
    showUnsavedModal,
    showDeleteModal,
    showFileMenu,
    closeNewFileModal,
    closeRenameModal,
    cancelCloseFile,
    cancelDeleteFile,
  ]);

  /* =======================================================
     NO FILE SAFETY
     ======================================================= */

  if (!activeFile) {
    return (
      <div className="code-editor">
        <div className="code-empty">
          <span>No files open</span>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="code-editor">
      {/* =================================================
          HEADER
          ================================================= */}

      <div className="code-editor-header">
        <div className="code-editor-heading">
          <div className="code-editor-icon">{"</>"}</div>

          <div>
            <h2>Code Editor</h2>

            <p>Collaborative coding</p>
          </div>
        </div>

        <div className="code-editor-actions">
          <button type="button" className="run-button" onClick={runCode}>
            ▶ Run
          </button>

          <div className="file-menu-wrapper">
            <button
              type="button"
              className="more-button"
              title="File options"
              onClick={() => setShowFileMenu((current) => !current)}
            >
              ⋯
            </button>

            {showFileMenu && (
              <div className="file-context-menu">
                <button
                  type="button"
                  onClick={() => {
                    openRenameModal();
                  }}
                >
                  <span>✏</span>

                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    duplicateCurrentFile();
                  }}
                >
                  <span>⧉</span>

                  <span>Duplicate</span>
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    requestDeleteCurrentFile();
                  }}
                >
                  <span>🗑</span>

                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================
          FILE TABS
          ================================================= */}

      <div className="editor-tabs">
        {files.map((file) => {
          const isActive = file.id === activeFileId;

          const fileUnsaved = file.code !== file.savedCode;

          return (
            <button
              key={file.id}
              type="button"
              className={`editor-tab ${isActive ? "active" : ""}`}
              onClick={() => switchFile(file.id)}
            >
              <span className="tab-language">
                {getTabLanguageLabel(file.language)}
              </span>

              <span className="tab-name">{file.name}</span>

              {fileUnsaved && (
                <span className="tab-unsaved" title="Unsaved changes">
                  ●
                </span>
              )}

              <span
                className="tab-close"
                onClick={(event) => closeFile(event, file.id)}
                title={
                  files.length === 1
                    ? "At least one file must remain open"
                    : "Close file"
                }
              >
                ×
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="new-tab-button"
          title="Create a new file"
          onClick={openNewFileModal}
        >
          +
        </button>
      </div>

      {/* =================================================
          INFO BAR
          ================================================= */}

      <div className="editor-info-bar">
        <span className="language-label">{activeFile.language}</span>

        <span
          className={isUnsaved ? "save-status unsaved" : "save-status saved"}
        >
          <span className="status-dot">●</span>

          {isUnsaved ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      {/* =================================================
          CODE AREA
          ================================================= */}

      <div className="code-area">
        <div ref={lineNumbersRef} className="line-numbers">
          {lineNumbers.map((number) => (
            <div key={number} className="line-number">
              {number}
            </div>
          ))}
        </div>

        <div className="editor-textarea-wrapper">
          {/* Remote user cursors */}
          {Object.entries(remoteCursors)
            .filter(([, awareness]) => awareness.fileId === activeFileId)
            .map(([socketId, awareness]) => {
              const textarea = textareaRef.current;

              if (!textarea) {
                return null;
              }

              const styles = window.getComputedStyle(textarea);

              const lineHeight =
                parseFloat(styles.lineHeight) ||
                parseFloat(styles.fontSize) ||
                14;

              const paddingTop = parseFloat(styles.paddingTop) || 0;
              const paddingLeft = parseFloat(styles.paddingLeft) || 0;

              // Awareness positions are 1-based:
              // line 1 / column 1 = before the first character.
              const line = Math.max(1, Number(awareness.line) || 1);
              const column = Math.max(1, Number(awareness.column) || 1);

              const codeLines = activeFile.code.split("\n");
              const currentLine = codeLines[line - 1] || "";

              // Convert the 1-based cursor column into a character
              // offset. For example:
              // column 1 -> 0 characters before cursor
              // column 2 -> 1 character before cursor
              const characterOffset = Math.min(
                Math.max(0, column - 1),
                currentLine.length,
              );

              const textBeforeCursor = currentLine.slice(0, characterOffset);

              // Use the exact font settings of the textarea instead of
              // assuming that every character is a fixed number of pixels.
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");

              let textWidth = 0;

              if (context) {
                context.font = [
                  styles.fontStyle,
                  styles.fontVariant,
                  styles.fontWeight,
                  styles.fontSize,
                  styles.fontFamily,
                ].join(" ");

                textWidth = context.measureText(textBeforeCursor).width;
              }

              const top =
                paddingTop + (line - 1) * lineHeight - editorScroll.top;

              const left = paddingLeft + textWidth - editorScroll.left;

              return (
                <div
                  key={socketId}
                  className="remote-cursor-indicator"
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    borderLeft: `2px solid ${awareness.userColor || "#ff4d4d"}`,
                  }}
                >
                  <span
                    className="remote-cursor-label"
                    style={{
                      backgroundColor: awareness.userColor || "#ff4d4d",
                    }}
                  >
                    {awareness.userId || "User"}
                  </span>
                </div>
              );
            })}
          <pre
            className="code-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{
              __html: highlightedCode,
            }}
          />

          {/* =================================================
              TEXTAREA
              ================================================= */}

          <textarea
            ref={textareaRef}
            className="code-input"
            value={activeFile.code}
            onChange={handleCodeChange}
            onKeyDown={handleEditorKeyDown}
            onClick={handleCursorChange}
            onKeyUp={handleCursorChange}
            onSelect={handleCursorChange}
            onScroll={handleEditorScroll}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            wrap="off"
            aria-label="Code editor"
          />
        </div>
      </div>

      {/* =================================================
          OUTPUT
          ================================================= */}

      <div className="editor-output">
        <div className="output-header">
          <span>Output</span>

          <button type="button" onClick={clearOutput}>
            Clear
          </button>
        </div>

        <div className="output-content">
          {output.length === 0 ? (
            <span className="output-empty">No output.</span>
          ) : (
            output.map((line, index) => (
              <div key={`${line}-${index}`} className="output-line">
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* =================================================
          NEW FILE MODAL
          ================================================= */}

      {showNewFileModal && (
        <div className="new-file-modal-overlay" onMouseDown={closeNewFileModal}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Create New File</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={closeNewFileModal}
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <label htmlFor="new-file-name">File name</label>

              <input
                id="new-file-name"
                type="text"
                value={newFileName}
                onChange={(event) => setNewFileName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    createNewFile();
                  }
                }}
                placeholder="example.js"
                autoFocus
              />

              <small>
                The language will be detected from the file extension.
              </small>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={closeNewFileModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="create-file-button"
                onClick={createNewFile}
                disabled={!newFileName.trim()}
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          RENAME MODAL
          ================================================= */}

      {showRenameModal && (
        <div className="new-file-modal-overlay" onMouseDown={closeRenameModal}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Rename File</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={closeRenameModal}
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <label htmlFor="rename-file-name">File name</label>

              <input
                id="rename-file-name"
                type="text"
                value={renameFileName}
                onChange={(event) => setRenameFileName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    renameCurrentFile();
                  }
                }}
                autoFocus
              />

              <small>
                The language will be detected from the file extension.
              </small>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={closeRenameModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="create-file-button"
                onClick={renameCurrentFile}
                disabled={!renameFileName.trim()}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          UNSAVED CHANGES MODAL
          ================================================= */}

      {showUnsavedModal && (
        <div className="new-file-modal-overlay" onMouseDown={cancelCloseFile}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Unsaved Changes</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={cancelCloseFile}
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <p>This file has unsaved changes.</p>

              <p>Do you want to save your changes before closing?</p>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={cancelCloseFile}
              >
                Cancel
              </button>

              <button
                type="button"
                className="cancel-file-button"
                onClick={discardAndCloseFile}
              >
                Don't Save
              </button>

              <button
                type="button"
                className="create-file-button"
                onClick={saveAndCloseFile}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          DELETE MODAL
          ================================================= */}

      {showDeleteModal && (
        <div className="new-file-modal-overlay" onMouseDown={cancelDeleteFile}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Delete File</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={cancelDeleteFile}
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <p>
                Are you sure you want to delete
                <strong>
                  {" "}
                  {files.find((file) => file.id === filePendingDelete)?.name ||
                    activeFile?.name}
                </strong>
                ?
              </p>

              <p>This action cannot be undone.</p>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={cancelDeleteFile}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-file-button"
                onClick={deleteFile}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          FOOTER
          ================================================= */}

      <div className="editor-footer">
        <span>
          Ln {cursorPosition.line}, Col {cursorPosition.column}
        </span>

        <div className="footer-right">
          <span>{activeFile.language}</span>

          <span>UTF-8</span>

          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
}

export default CodeEditor;
