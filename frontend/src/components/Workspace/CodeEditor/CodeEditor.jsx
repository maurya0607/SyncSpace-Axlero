import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-typescript";

import {
  createReplaySnapshot,
  addReplaySnapshot,
} from "../../../lib/replayHistory";

import "./CodeEditor.css";

/* =========================================================
   STORAGE
   ---------------------------------------------------------
   localStorage key and replay-history limit used by the editor.
   ========================================================= */
const STORAGE_KEY = "syncspace-code-editor";
const MAX_REPLAY_SNAPSHOTS = 100;

/* =========================================================
   DEFAULT FILES
   ---------------------------------------------------------
   Files loaded when there is no saved editor state.
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
   LANGUAGE BY FILE EXTENSION
   ---------------------------------------------------------
   Determines the editor language from a file name.
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
   ---------------------------------------------------------
   Maps the editor language names to Prism grammar names.
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
   LANGUAGE HELPERS
   ========================================================= */

function getLanguageFromFileName(name = "") {
  const ext = name.split(".").pop()?.toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] || "Plain Text";
}

/* =========================================================
   TAB LANGUAGE LABELS
   ========================================================= */

function getTabLanguageLabel(language) {
  return (
    {
      JavaScript: "JS",
      Python: "PY",
      HTML: "HTML",
      CSS: "CSS",
      JSON: "JSON",
      TypeScript: "TS",
      "Plain Text": "TXT",
    }[language] || "TXT"
  );
}

/* =========================================================
   NORMALIZE FILE DATA
   ---------------------------------------------------------
   Protects the editor from malformed or incomplete stored data.
   ========================================================= */

function normalizeFiles(files) {
  if (!Array.isArray(files) || !files.length) {
    return DEFAULT_FILES.map((file) => ({ ...file }));
  }

  return files.map((file, index) => ({
    id: file.id || `${file.name || "file"}-${index}`,
    name: file.name || `file-${index + 1}.js`,
    language:
      file.language || getLanguageFromFileName(file.name || ""),
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
   LOAD LOCAL STORAGE
   ---------------------------------------------------------
   Restores files and the active tab from browser storage.
   ========================================================= */

function loadEditorData() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("[CodeEditor] Failed to load local data:", error);
    return null;
  }
}

/* =========================================================
   HTML ESCAPE
   ---------------------------------------------------------
   Keeps non-Prism/plain-text code safe for dangerouslySetInnerHTML.
   ========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   REPLAY TIME FORMATTER
   ========================================================= */

function formatReplayTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Snapshot";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* =========================================================
   CODE EDITOR COMPONENT
   ========================================================= */

function CodeEditor({ socket, roomId: roomIdProp }) {
  /* =======================================================
     ROOM / COLLABORATION CONTEXT
     ======================================================= */

  const roomId =
    roomIdProp ||
    decodeURIComponent(
      window.location.pathname.split("/room/")[1] || "default-room",
    );

  /* =======================================================
     STORED EDITOR DATA
     ======================================================= */

  const storedData = useMemo(() => loadEditorData(), []);

  /* =======================================================
     FILE STATE
     ======================================================= */

  const [files, setFiles] = useState(() =>
    normalizeFiles(storedData?.files || DEFAULT_FILES),
  );

  /* =======================================================
     ACTIVE FILE
     ======================================================= */

  const [activeFileId, setActiveFileId] = useState(() => {
    const storedId = storedData?.activeFileId;
    if (
      storedId &&
      Array.isArray(storedData?.files) &&
      storedData.files.some((file) => file.id === storedId)
    ) {
      return storedId;
    }
    return DEFAULT_FILES[0].id;
  });

  /* =======================================================
     OUTPUT STATE
     ======================================================= */

  const [output, setOutput] = useState([]);
  const [showOutput, setShowOutput] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  /* =======================================================
     CURSOR POSITION
     ======================================================= */

  const [cursorPosition, setCursorPosition] = useState({
    line: 1,
    column: 1,
  });

  /* =======================================================
     FILE MODALS / MENUS
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
     REPLAY HISTORY STATE
     ======================================================= */

  const [replayHistory, setReplayHistory] = useState([]);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [isReplayPreview, setIsReplayPreview] = useState(false);

  /* =======================================================
     EDITOR REFS / SYNC REFS
     ======================================================= */

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const previousFilesRef = useRef(null);
  const applyingRemoteCodeRef = useRef(false);
  const hasReceivedInitialSyncRef = useRef(false);
  const codeRevisionRef = useRef(0);
  const replayTimerRef = useRef(null);
  const replayApplyingRef = useRef(false);

  /* =======================================================
     REMOTE CURSORS / EDITOR SCROLL
     ======================================================= */

  const [remoteCursors, setRemoteCursors] = useState({});
  const [remoteCursorPositions, setRemoteCursorPositions] = useState({});
  const [editorScroll, setEditorScroll] = useState({ top: 0, left: 0 });

  /* =======================================================
     COLLABORATOR IDENTITY
     ======================================================= */

  const [userId] = useState(
    () => `user-${Math.random().toString(36).slice(2, 9)}`,
  );

  const [userColor] = useState(() => {
    const colors = [
      "#E8892E",
      "#2563eb",
      "#059669",
      "#dc2626",
      "#ea580c",
      "#0891b2",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  /* =======================================================
     DERIVED EDITOR DATA
     ======================================================= */

  const activeFile = useMemo(
    () =>
      files.find((file) => file.id === activeFileId) ||
      files[0] ||
      null,
    [files, activeFileId],
  );

  const lineNumbers = useMemo(() => {
    const count = Math.max(1, activeFile?.code.split("\n").length || 1);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [activeFile]);

  const isUnsaved = useMemo(
    () => Boolean(activeFile && activeFile.code !== activeFile.savedCode),
    [activeFile],
  );

  const highlightedCode = useMemo(() => {
    if (!activeFile) return "";

    const language = PRISM_LANGUAGE_MAP[activeFile.language];
    if (!language) return escapeHtml(activeFile.code);

    const grammar = Prism.languages[language];
    if (!grammar) return escapeHtml(activeFile.code);

    return Prism.highlight(activeFile.code, grammar, language);
  }, [activeFile]);

  /* =======================================================
     SAVE TO LOCAL STORAGE
     ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ files, activeFileId }),
      );
    } catch (error) {
      console.error("[CodeEditor] Failed to save local data:", error);
    }
  }, [files, activeFileId]);

  /* =======================================================
     CURSOR CALCULATION
     ======================================================= */

  const updateCursorPosition = useCallback((textarea) => {
    if (!textarea) return;
    const position = textarea.selectionStart;
    const before = textarea.value.slice(0, position);
    const lines = before.split("\n");

    setCursorPosition({
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    });
  }, []);

  /* =======================================================
     UPDATE ACTIVE FILE CODE
     ======================================================= */

  const updateFileCode = useCallback(
    (code) => {
      setFiles((current) =>
        current.map((file) =>
          file.id === activeFileId ? { ...file, code } : file,
        ),
      );
    },
    [activeFileId],
  );

  /* =======================================================
     SAVE CURRENT FILE
     ======================================================= */

  const saveCurrentFile = useCallback(() => {
    if (!activeFile) return;
    setFiles((current) =>
      current.map((file) =>
        file.id === activeFileId
          ? { ...file, savedCode: file.code }
          : file,
      ),
    );
  }, [activeFile, activeFileId]);

  /*
   * Replay recording is deliberately debounced. This records the
   * complete editor state after a meaningful pause rather than every
   * individual keystroke.
   */
  /* =======================================================
     RECORD REPLAY SNAPSHOTS
     ======================================================= */

  const scheduleReplaySnapshot = useCallback(() => {
    if (!files.length || replayApplyingRef.current) return;

    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
    }

    replayTimerRef.current = setTimeout(() => {
      const snapshot = createReplaySnapshot({
        files,
        activeFileId,
      });

      setReplayHistory((current) => {
        const next = addReplaySnapshot(current, snapshot);
        const trimmed =
          next.length > MAX_REPLAY_SNAPSHOTS
            ? next.slice(-MAX_REPLAY_SNAPSHOTS)
            : next;

        setReplayIndex(trimmed.length - 1);
        return trimmed;
      });
    }, 500);
  }, [files, activeFileId]);

  useEffect(() => {
    scheduleReplaySnapshot();

    return () => {
      if (replayTimerRef.current) {
        clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [scheduleReplaySnapshot]);

  /* =======================================================
     APPLY REPLAY SNAPSHOT
     ======================================================= */

  const applyReplaySnapshot = useCallback(
    (snapshot) => {
      if (!snapshot || !Array.isArray(snapshot.files)) return;

      replayApplyingRef.current = true;
      applyingRemoteCodeRef.current = true;

      const restoredFiles = normalizeFiles(snapshot.files);
      setFiles(restoredFiles);

      const restoredActive =
        snapshot.activeFileId &&
        restoredFiles.some((file) => file.id === snapshot.activeFileId)
          ? snapshot.activeFileId
          : restoredFiles[0]?.id;

      setActiveFileId(restoredActive || "");
      setOutput([
        `Replay snapshot: ${formatReplayTime(snapshot.timestamp)}`,
      ]);

      requestAnimationFrame(() => {
        replayApplyingRef.current = false;
        applyingRemoteCodeRef.current = false;
        textareaRef.current?.focus();
        if (textareaRef.current) {
          updateCursorPosition(textareaRef.current);
        }
      });
    },
    [updateCursorPosition],
  );

  /* =======================================================
     EXIT REPLAY PREVIEW
     ======================================================= */

  const exitReplayPreview = useCallback(() => {
    if (!replayHistory.length) {
      setIsReplayPreview(false);
      return;
    }

    const latest = replayHistory[replayHistory.length - 1];
    setReplayIndex(replayHistory.length - 1);
    applyReplaySnapshot(latest);
    setIsReplayPreview(false);
  }, [replayHistory, applyReplaySnapshot]);

  const selectReplaySnapshot = useCallback(
    (index) => {
      const snapshot = replayHistory[index];
      if (!snapshot) return;

      setReplayIndex(index);
      setIsReplayPreview(index !== replayHistory.length - 1);
      applyReplaySnapshot(snapshot);
    },
    [replayHistory, applyReplaySnapshot],
  );

  const stepReplay = useCallback(
    (direction) => {
      if (!replayHistory.length) return;

      const current =
        replayIndex >= 0 ? replayIndex : replayHistory.length - 1;

      const next = Math.max(
        0,
        Math.min(replayHistory.length - 1, current + direction),
      );

      selectReplaySnapshot(next);
    },
    [replayHistory, replayIndex, selectReplaySnapshot],
  );

  /* =========================================================
     REAL-TIME CODE SYNC
     ========================================================= */

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const handleCodeSync = ({
      roomId: incomingRoomId,
      files: incomingFiles,
      activeFileId: incomingActiveFileId,
      revision = 0,
    } = {}) => {
      if (incomingRoomId && incomingRoomId !== roomId) return;
      if (!Array.isArray(incomingFiles)) return;

      applyingRemoteCodeRef.current = true;
      hasReceivedInitialSyncRef.current = true;
      codeRevisionRef.current = revision;
      previousFilesRef.current = incomingFiles;

      const normalized = normalizeFiles(incomingFiles);
      setFiles(normalized);

      if (
        incomingActiveFileId &&
        normalized.some((file) => file.id === incomingActiveFileId)
      ) {
        setActiveFileId(incomingActiveFileId);
      } else if (normalized[0]) {
        setActiveFileId(normalized[0].id);
      }

      requestAnimationFrame(() => {
        applyingRemoteCodeRef.current = false;
      });
    };

    const handleCodeSyncEmpty = () => {
      hasReceivedInitialSyncRef.current = true;
    };

    const handleRemoteCodeUpdate = ({
      socketId,
      roomId: incomingRoomId,
      files: incomingFiles,
      activeFileId: incomingActiveFileId,
      revision = 0,
    } = {}) => {
      if (incomingRoomId && incomingRoomId !== roomId) return;
      if (socketId && socket.id && socketId === socket.id) return;
      if (!Array.isArray(incomingFiles)) return;

      applyingRemoteCodeRef.current = true;
      codeRevisionRef.current = Math.max(
        codeRevisionRef.current,
        revision,
      );
      previousFilesRef.current = incomingFiles;

      const normalized = normalizeFiles(incomingFiles);
      setFiles(normalized);

      if (
        incomingActiveFileId &&
        normalized.some((file) => file.id === incomingActiveFileId)
      ) {
        setActiveFileId(incomingActiveFileId);
      }

      requestAnimationFrame(() => {
        applyingRemoteCodeRef.current = false;
      });
    };

    const handleCodeUpdateAck = ({
      roomId: incomingRoomId,
      revision = 0,
    } = {}) => {
      if (incomingRoomId && incomingRoomId !== roomId) return;
      codeRevisionRef.current = Math.max(
        codeRevisionRef.current,
        revision,
      );
    };

    const handleCodeConflict = ({
      roomId: incomingRoomId,
      files: incomingFiles,
      activeFileId: incomingActiveFileId,
      revision = 0,
    } = {}) => {
      if (incomingRoomId && incomingRoomId !== roomId) return;
      if (!Array.isArray(incomingFiles)) return;

      applyingRemoteCodeRef.current = true;
      codeRevisionRef.current = revision;
      previousFilesRef.current = incomingFiles;

      const normalized = normalizeFiles(incomingFiles);
      setFiles(normalized);

      if (
        incomingActiveFileId &&
        normalized.some((file) => file.id === incomingActiveFileId)
      ) {
        setActiveFileId(incomingActiveFileId);
      }

      requestAnimationFrame(() => {
        applyingRemoteCodeRef.current = false;
      });
    };

    const requestSync = () => {
      if (socket.connected) {
        socket.emit("code-sync-request", roomId);
      }
    };

    socket.on("code-sync", handleCodeSync);
    socket.on("code-sync-empty", handleCodeSyncEmpty);
    socket.on("code-update", handleRemoteCodeUpdate);
    socket.on("code-update-ack", handleCodeUpdateAck);
    socket.on("code-conflict", handleCodeConflict);
    socket.on("connect", requestSync);

    requestSync();

    return () => {
      socket.off("code-sync", handleCodeSync);
      socket.off("code-sync-empty", handleCodeSyncEmpty);
      socket.off("code-update", handleRemoteCodeUpdate);
      socket.off("code-update-ack", handleCodeUpdateAck);
      socket.off("code-conflict", handleCodeConflict);
      socket.off("connect", requestSync);
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !socket.connected || !roomId) return;

    if (applyingRemoteCodeRef.current) {
      previousFilesRef.current = files;
      return;
    }

    if (previousFilesRef.current === null) {
      previousFilesRef.current = files;
      return;
    }

    if (
      JSON.stringify(previousFilesRef.current) ===
      JSON.stringify(files)
    ) {
      return;
    }

    socket.emit("code-update", {
      roomId,
      files,
      activeFileId,
      baseRevision: codeRevisionRef.current,
    });

    previousFilesRef.current = files;
  }, [socket, roomId, files, activeFileId]);

  /* =======================================================
     SWITCH ACTIVE FILE
     ======================================================= */

  const switchFile = useCallback(
    (fileId) => {
      if (!fileId) return;

      setActiveFileId(fileId);
      setOutput([]);

      if (socket?.connected) {
        socket.emit("active-file-change", {
          roomId,
          fileId,
        });
      }

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        if (textareaRef.current) {
          updateCursorPosition(textareaRef.current);
        }
      });
    },
    [socket, roomId, updateCursorPosition],
  );

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const handleActiveFileChange = ({
      socketId,
      roomId: incomingRoomId,
      fileId,
    } = {}) => {
      if (incomingRoomId && incomingRoomId !== roomId) return;
      if (socketId && socket.id && socketId === socket.id) return;
      if (!fileId) return;

      setFiles((current) =>
        current.some((file) => file.id === fileId)
          ? current
          : current,
      );
      setActiveFileId(fileId);
      setOutput([]);
    };

    socket.on("active-file-change", handleActiveFileChange);

    return () => {
      socket.off("active-file-change", handleActiveFileChange);
    };
  }, [socket, roomId]);

  /* =========================================================
     CURSOR / AWARENESS
     ========================================================= */

  useEffect(() => {
    if (!socket?.connected || !roomId) return;

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

  useEffect(() => {
    if (!socket) return undefined;

    const handleAwarenessUpdate = ({ socketId, awareness } = {}) => {
      if (!socketId || !awareness || awareness.userId === userId) return;
      setRemoteCursors((current) => ({
        ...current,
        [socketId]: awareness,
      }));
    };

    const handleAwarenessRemove = ({ socketId } = {}) => {
      if (!socketId) return;
      setRemoteCursors((current) => {
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    };

    socket.on("awareness-update", handleAwarenessUpdate);
    socket.on("awareness-remove", handleAwarenessRemove);

    return () => {
      socket.off("awareness-update", handleAwarenessUpdate);
      socket.off("awareness-remove", handleAwarenessRemove);
    };
  }, [socket, userId]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !activeFile) {
      setRemoteCursorPositions({});
      return undefined;
    }

    const styles = window.getComputedStyle(textarea);
    const lineHeight =
      parseFloat(styles.lineHeight) ||
      parseFloat(styles.fontSize) ||
      14;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const tabSize = Number(styles.tabSize) || 2;

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

    const spaceWidth = context
      ? context.measureText(" ").width
      : 7.8;
    const tabWidth = Math.max(spaceWidth, spaceWidth * tabSize);

    /*
     * Canvas text metrics do not treat tab characters like a textarea
     * with CSS tab-size. Measure the text one character at a time so
     * tabs advance to the next tab stop exactly like the editor.
     */
    const measureBeforeCaret = (text) => {
      let width = 0;
      let visualColumn = 0;

      for (const character of text) {
        if (character === "\t") {
          const remainder = visualColumn % tabSize;
          const spacesToNextTab = tabSize - remainder;
          width += spacesToNextTab * spaceWidth;
          visualColumn += spacesToNextTab;
        } else {
          width += context
            ? context.measureText(character).width
            : spaceWidth;
          visualColumn += 1;
        }
      }

      return width;
    };

    const measurePositions = () => {
      const codeLines = activeFile.code.split("\n");
      const positions = {};

      Object.entries(remoteCursors).forEach(([socketId, awareness]) => {
        if (!awareness || awareness.fileId !== activeFileId) return;

        const line = Math.max(1, Number(awareness.line) || 1);
        const column = Math.max(1, Number(awareness.column) || 1);
        const currentLine = codeLines[line - 1] || "";
        const offset = Math.min(column - 1, currentLine.length);

        const width = measureBeforeCaret(currentLine.slice(0, offset));

        const top =
          paddingTop +
          (line - 1) * lineHeight -
          editorScroll.top;

        const left =
          paddingLeft +
          width -
          editorScroll.left;

        const viewportWidth = Math.max(
          1,
          textarea.clientWidth,
        );
        const viewportHeight = Math.max(
          1,
          textarea.clientHeight,
        );

        /*
         * Do not clamp a remote caret to the edge. Instead, hide it
         * when it is outside the visible viewport. This prevents a
         * collaborator's stale caret from appearing on unrelated code.
         */
        const visible =
          left >= -2 &&
          left <= viewportWidth - 2 &&
          top >= -lineHeight &&
          top <= viewportHeight;

        if (!visible) return;

        const labelWidth = 120;
        const labelAlignRight =
          left + labelWidth > viewportWidth - 6;

        positions[socketId] = {
          top: Math.max(0, top),
          left: Math.max(0, Math.min(viewportWidth - 2, left)),
          userId:
            awareness.userId ||
            `User ${socketId.slice(0, 6)}`,
          userColor: awareness.userColor || "#FF9F43",
          labelBelow: top < 28,
          labelAlignRight,
        };
      });

      setRemoteCursorPositions(positions);
    };

    measurePositions();

    const resizeObserver = new ResizeObserver(measurePositions);
    resizeObserver.observe(textarea);

    return () => {
      resizeObserver.disconnect();
    };
  }, [remoteCursors, activeFile, activeFileId, editorScroll]);

  /* =========================================================
     FILE OPERATIONS
     ========================================================= */

  /* =======================================================
     CREATE NEW FILE
     ======================================================= */

  const openNewFileModal = useCallback(() => {
    setNewFileName("");
    setShowNewFileModal(true);
  }, []);

  const closeNewFileModal = useCallback(() => {
    setNewFileName("");
    setShowNewFileModal(false);
  }, []);

  const createNewFile = useCallback(() => {
    const name = newFileName.trim();
    if (!name) return;

    if (
      files.some(
        (file) => file.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return;
    }

    const file = {
      id: `${name}-${Date.now()}`,
      name,
      language: getLanguageFromFileName(name),
      code: "",
      savedCode: "",
    };

    setFiles((current) => [...current, file]);
    setActiveFileId(file.id);
    closeNewFileModal();

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [newFileName, files, closeNewFileModal]);

  /* =======================================================
     RENAME FILE
     ======================================================= */

  const openRenameModal = useCallback(() => {
    if (!activeFile) return;
    setRenameFileName(activeFile.name);
    setShowRenameModal(true);
    setShowFileMenu(false);
  }, [activeFile]);

  const closeRenameModal = useCallback(() => {
    setRenameFileName("");
    setShowRenameModal(false);
  }, []);

  const renameCurrentFile = useCallback(() => {
    if (!activeFile) return;

    const name = renameFileName.trim();
    if (!name) return;

    const duplicate = files.some(
      (file) =>
        file.id !== activeFile.id &&
        file.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) return;

    setFiles((current) =>
      current.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              name,
              language: getLanguageFromFileName(name),
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
    if (!activeFile) return;

    const extension = activeFile.name.includes(".")
      ? activeFile.name.slice(activeFile.name.lastIndexOf("."))
      : "";

    const base = extension
      ? activeFile.name.slice(0, -extension.length)
      : activeFile.name;

    let name = `${base} copy${extension}`;
    let counter = 2;

    while (
      files.some((file) => file.name.toLowerCase() === name.toLowerCase())
    ) {
      name = `${base} copy ${counter}${extension}`;
      counter += 1;
    }

    const copy = {
      ...activeFile,
      id: `${name}-${Date.now()}`,
      name,
      savedCode: activeFile.code,
    };

    setFiles((current) => [...current, copy]);
    setActiveFileId(copy.id);
    setShowFileMenu(false);
  }, [activeFile, files]);

  /* =======================================================
     DELETE FILE
     ======================================================= */

  const requestDeleteCurrentFile = useCallback(() => {
    if (!activeFile || files.length === 1) return;
    setFilePendingDelete(activeFile.id);
    setShowDeleteModal(true);
    setShowFileMenu(false);
  }, [activeFile, files.length]);

  const cancelDeleteFile = useCallback(() => {
    setFilePendingDelete(null);
    setShowDeleteModal(false);
  }, []);

  const deleteFile = useCallback(() => {
    if (!filePendingDelete || files.length === 1) return;

    const index = files.findIndex((file) => file.id === filePendingDelete);
    const remaining = files.filter((file) => file.id !== filePendingDelete);

    setFiles(remaining);

    if (filePendingDelete === activeFileId) {
      const next = remaining[Math.max(0, index - 1)];
      if (next) setActiveFileId(next.id);
    }

    cancelDeleteFile();
  }, [filePendingDelete, files, activeFileId, cancelDeleteFile]);

  const performCloseFile = useCallback(
    (fileId) => {
      if (files.length === 1) return;

      const index = files.findIndex((file) => file.id === fileId);
      const remaining = files.filter((file) => file.id !== fileId);

      setFiles(remaining);

      if (fileId === activeFileId) {
        const next = remaining[Math.max(0, index - 1)];
        if (next) setActiveFileId(next.id);
      }

      setFilePendingClose(null);
      setShowUnsavedModal(false);
    },
    [files, activeFileId],
  );

  const closeFile = useCallback(
    (event, fileId) => {
      event.stopPropagation();

      if (files.length === 1) return;

      const file = files.find((item) => item.id === fileId);
      if (!file) return;

      if (file.code !== file.savedCode) {
        setFilePendingClose(fileId);
        setShowUnsavedModal(true);
        return;
      }

      performCloseFile(fileId);
    },
    [files, performCloseFile],
  );

  const cancelCloseFile = useCallback(() => {
    setFilePendingClose(null);
    setShowUnsavedModal(false);
  }, []);

  const discardAndCloseFile = useCallback(() => {
    if (filePendingClose) performCloseFile(filePendingClose);
  }, [filePendingClose, performCloseFile]);

  const saveAndCloseFile = useCallback(() => {
    if (!filePendingClose) return;

    setFiles((current) =>
      current.map((file) =>
        file.id === filePendingClose
          ? { ...file, savedCode: file.code }
          : file,
      ),
    );

    performCloseFile(filePendingClose);
  }, [filePendingClose, performCloseFile]);

  /* =========================================================
     EDITOR INPUT
     ========================================================= */

  /* =======================================================
     EDITOR INPUT / KEYBOARD HANDLING
     ======================================================= */

  const handleCodeChange = useCallback(
    (event) => {
      updateFileCode(event.target.value);
      updateCursorPosition(event.target);
    },
    [updateFileCode, updateCursorPosition],
  );

  const handleEditorScroll = useCallback((event) => {
    const textarea = event.currentTarget;

    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }

    const highlight = textarea.parentElement?.querySelector(
      ".code-highlight",
    );

    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }

    setEditorScroll({
      top: textarea.scrollTop,
      left: textarea.scrollLeft,
    });
  }, []);

  const handleEditorKeyDown = useCallback(
    (event) => {
      const textarea = event.currentTarget;
      if (!activeFile) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        saveCurrentFile();
        return;
      }

      const pairs = {
        "(": ")",
        "[": "]",
        "{": "}",
        '"': '"',
        "'": "'",
        "`": "`",
      };

      if (pairs[event.key]) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const closing = pairs[event.key];

        if (start === end && value[start] === closing) {
          event.preventDefault();
          textarea.selectionStart = start + 1;
          textarea.selectionEnd = start + 1;
          updateCursorPosition(textarea);
          return;
        }

        event.preventDefault();

        const selected = value.slice(start, end);
        const replacement = `${event.key}${selected}${closing}`;
        updateFileCode(
          value.slice(0, start) + replacement + value.slice(end),
        );

        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.selectionStart = start + 1;
          textareaRef.current.selectionEnd =
            start + 1 + selected.length;
          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "/"
      ) {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;

        let prefix = "//";
        let suffix = "";

        if (activeFile.language === "Python") prefix = "#";
        if (activeFile.language === "HTML") {
          prefix = "<!--";
          suffix = "-->";
        }

        const selectionStart = value.lastIndexOf("\n", start - 1) + 1;
        const endIndex = value.indexOf("\n", end);
        const selectionEnd = endIndex === -1 ? value.length : endIndex;
        const selected = value.slice(selectionStart, selectionEnd);
        const lines = selected.split("\n");

        const allCommented = lines
          .filter((line) => line.trim())
          .every((line) => line.trim().startsWith(prefix));

        const updated = lines.map((line) => {
          const leading = line.match(/^\s*/)?.[0] || "";
          const content = line.slice(leading.length);

          if (!content.trim()) return line;

          if (allCommented) {
            let result = content.trim().slice(prefix.length).trim();
            if (suffix && result.endsWith(suffix)) {
              result = result.slice(0, -suffix.length).trim();
            }
            return leading + result;
          }

          return suffix
            ? `${leading}${prefix} ${content.trim()} ${suffix}`
            : `${leading}${prefix} ${content}`;
        });

        const replacement = updated.join("\n");
        updateFileCode(
          value.slice(0, selectionStart) +
            replacement +
            value.slice(selectionEnd),
        );

        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.selectionStart = selectionStart;
          textareaRef.current.selectionEnd =
            selectionStart + replacement.length;
          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const indent = "  ";

        if (event.shiftKey) {
          const lineStart = value.lastIndexOf("\n", start - 1) + 1;
          const endIndex = value.indexOf("\n", end);
          const lineEnd = endIndex === -1 ? value.length : endIndex;
          const block = value.slice(lineStart, lineEnd);
          const lines = block.split("\n");

          let removed = 0;
          const updated = lines.map((line) => {
            if (line.startsWith("  ")) {
              removed += 2;
              return line.slice(2);
            }
            if (line.startsWith(" ")) {
              removed += 1;
              return line.slice(1);
            }
            return line;
          });

          const replacement = updated.join("\n");
          updateFileCode(
            value.slice(0, lineStart) +
              replacement +
              value.slice(lineEnd),
          );

          requestAnimationFrame(() => {
            if (!textareaRef.current) return;
            textareaRef.current.selectionStart = Math.max(
              lineStart,
              start - removed,
            );
            textareaRef.current.selectionEnd = Math.max(
              lineStart,
              end - removed,
            );
            updateCursorPosition(textareaRef.current);
          });

          return;
        }

        const replacement = value.slice(0, start) + indent + value.slice(end);
        updateFileCode(replacement);

        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          textareaRef.current.selectionStart = start + indent.length;
          textareaRef.current.selectionEnd = start + indent.length;
          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const currentIndent = currentLine.match(/^\s*/)?.[0] || "";
        const trimmed = currentLine.trim();

        let nextIndent = currentIndent;

        if (/[{[(]\s*$/.test(currentLine)) {
          nextIndent += "  ";
        }

        if (
          /^[}\])]/.test(value.slice(start).trimStart()) &&
          trimmed &&
          nextIndent.length >= 2
        ) {
          nextIndent = currentIndent;
        }

        const inserted = `\n${nextIndent}`;
        updateFileCode(
          value.slice(0, start) + inserted + value.slice(end),
        );

        requestAnimationFrame(() => {
          if (!textareaRef.current) return;
          const position = start + inserted.length;
          textareaRef.current.selectionStart = position;
          textareaRef.current.selectionEnd = position;
          updateCursorPosition(textareaRef.current);
        });
      }
    },
    [
      activeFile,
      saveCurrentFile,
      updateFileCode,
      updateCursorPosition,
    ],
  );

  /* =========================================================
     RUN / OUTPUT
     ========================================================= */

  /* =======================================================
     RUN JAVASCRIPT
     ======================================================= */

  const runJavaScript = useCallback(() => {
    if (!activeFile) return;

    const logs = [];
    const originalLog = console.log;

    try {
      console.log = (...args) => {
        logs.push(
          args
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
            .join(" "),
        );
      };

      new Function(activeFile.code)();
    } catch (error) {
      setOutput([`Error: ${error.message}`]);
      setShowOutput(true);
      return;
    } finally {
      console.log = originalLog;
    }

    setOutput(logs.length ? logs : ["Code executed successfully."]);
    setShowOutput(true);
  }, [activeFile]);

  /* =======================================================
     RUN ACTIVE FILE
     ======================================================= */

  const runCode = useCallback(() => {
    if (!activeFile) return;

    if (activeFile.language === "JavaScript") {
      runJavaScript();
      return;
    }

    if (activeFile.language === "JSON") {
      try {
        JSON.parse(activeFile.code);
        setOutput(["Valid JSON."]);
        setShowOutput(true);
      } catch (error) {
        setOutput([`Invalid JSON: ${error.message}`]);
        setShowOutput(true);
      }
      return;
    }

    setOutput([
      `${activeFile.language} execution/preview is not connected in the frontend-only build.`,
    ]);
    setShowOutput(true);
  }, [activeFile, runJavaScript]);

  /* =======================================================
     CLEAR OUTPUT
     ======================================================= */

  const clearOutput = useCallback(() => setOutput([]), []);

  /* =========================================================
     GLOBAL ESCAPE
     ========================================================= */

  /* =======================================================
     GLOBAL ESCAPE HANDLING
     ======================================================= */

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;

      setShowFileMenu(false);

      if (showNewFileModal) closeNewFileModal();
      if (showRenameModal) closeRenameModal();
      if (showDeleteModal) cancelDeleteFile();
      if (showUnsavedModal) cancelCloseFile();

      if (isReplayOpen && !isReplayPreview) {
        setIsReplayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showNewFileModal,
    showRenameModal,
    showDeleteModal,
    showUnsavedModal,
    isReplayOpen,
    isReplayPreview,
    closeNewFileModal,
    closeRenameModal,
    cancelDeleteFile,
    cancelCloseFile,
  ]);

  /* =======================================================
     EMPTY EDITOR SAFETY
     ======================================================= */

  if (!activeFile) {
    return (
      <div className="code-editor">
        <div className="code-empty">No files open</div>
      </div>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="code-editor">
      {/* =================================================
          EDITOR HEADER / RUN ACTIONS
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
          <button
            type="button"
            className="replay-button"
            onClick={() => {
              setIsReplayOpen((value) => !value);
              setShowFileMenu(false);
            }}
            title="Open replay history"
          >
            ↺ Replay
          </button>

          <button
            type="button"
            className={`output-button ${showOutput ? "active" : ""}`}
            onClick={() => {
              setShowOutput((value) => !value);
              setOutputExpanded(false);
              setShowFileMenu(false);
            }}
            title={showOutput ? "Hide output" : "Show output"}
          >
            ▣ Output
          </button>

          <button type="button" className="run-button" onClick={runCode}>
            ▶ Run
          </button>

          <div className="file-menu-wrapper">
            <button
              type="button"
              className="more-button"
              title="File options"
              onClick={() => setShowFileMenu((value) => !value)}
            >
              ⋯
            </button>

            {showFileMenu && (
              <div className="file-context-menu">
                <button type="button" onClick={openRenameModal}>
                  ✏ <span>Rename</span>
                </button>
                <button type="button" onClick={duplicateCurrentFile}>
                  ⧉ <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={requestDeleteCurrentFile}
                >
                  🗑 <span>Delete</span>
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
          const active = file.id === activeFileId;
          const unsaved = file.code !== file.savedCode;

          return (
            <button
              key={file.id}
              type="button"
              className={`editor-tab ${active ? "active" : ""}`}
              onClick={() => switchFile(file.id)}
            >
              <span className="tab-language">
                {getTabLanguageLabel(file.language)}
              </span>
              <span className="tab-name">{file.name}</span>
              {unsaved && (
                <span className="tab-unsaved" title="Unsaved changes">
                  ●
                </span>
              )}
              <span
                className="tab-close"
                title="Close file"
                onClick={(event) => closeFile(event, file.id)}
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
          LANGUAGE / SAVE STATUS
          ================================================= */}

      <div className="editor-info-bar">
        <span className="language-label">{activeFile.language}</span>
        <span className={isUnsaved ? "save-status unsaved" : "save-status saved"}>
          <span className="status-dot">●</span>
          {isUnsaved ? "Unsaved changes" : "Saved"}
        </span>
        {isReplayPreview && (
          <span className="replay-preview-status">
            Replay preview
          </span>
        )}
      </div>

      {/* =================================================
          CODE AREA / LINE NUMBERS / SYNTAX HIGHLIGHTING
          ================================================= */}

      <div className="code-area">
        <aside className="code-explorer" aria-label="Project files">
          <div className="code-explorer-header">
            <span>EXPLORER</span>
            <button type="button" title="Create new file" onClick={openNewFileModal}>+</button>
          </div>
          <div className="code-explorer-title">
            <span>⌄</span>
            <strong>WORKSPACE</strong>
            <small>{files.length}</small>
          </div>
          <div className="code-explorer-files">
            {files.map((file) => (
              <button
                key={`explorer-${file.id}`}
                type="button"
                className={`code-explorer-file ${file.id === activeFileId ? "active" : ""}`}
                onClick={() => switchFile(file.id)}
                title={file.name}
              >
                <span className="explorer-file-icon">{getTabLanguageLabel(file.language).slice(0, 2)}</span>
                <span className="explorer-file-name">{file.name}</span>
                {file.code !== file.savedCode && <i>●</i>}
              </button>
            ))}
          </div>
        </aside>

        <div ref={lineNumbersRef} className="line-numbers">
          {lineNumbers.map((number) => (
            <div key={number} className="line-number">
              {number}
            </div>
          ))}
        </div>

        <div className="editor-textarea-wrapper">
          {Object.entries(remoteCursorPositions).map(([socketId, cursor]) => (
            <div
              key={socketId}
              className="remote-cursor-indicator"
              style={{
                top: `${cursor.top}px`,
                left: `${cursor.left}px`,
                borderLeft: `2px solid ${cursor.userColor}`,
              }}
            >
              <span
                className={`remote-cursor-label ${
                  cursor.labelBelow ? "label-below" : ""
                } ${cursor.labelAlignRight ? "label-right" : ""}`}
                style={{ backgroundColor: cursor.userColor }}
              >
                {cursor.userId}
              </span>
            </div>
          ))}

          <pre
            className="code-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />

          <textarea
            ref={textareaRef}
            className="code-input"
            value={activeFile.code}
            onChange={handleCodeChange}
            onKeyDown={handleEditorKeyDown}
            onClick={(event) => updateCursorPosition(event.currentTarget)}
            onKeyUp={(event) => updateCursorPosition(event.currentTarget)}
            onSelect={(event) => updateCursorPosition(event.currentTarget)}
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
          OUTPUT PANEL
          ================================================= */}

      {showOutput && (
        <div className={`editor-output ${outputExpanded ? "output-expanded" : ""}`}>
          <div className="output-header">
            <div className="output-title"><span className="output-dot" /> Output</div>
            <div className="output-actions">
              <button type="button" onClick={clearOutput} title="Clear output">⌫</button>
              <button type="button" onClick={() => setOutputExpanded((value) => !value)} title={outputExpanded ? "Restore output size" : "Open output full size"}>{outputExpanded ? "↙" : "↗"}</button>
              <button type="button" onClick={() => { setShowOutput(false); setOutputExpanded(false); }} title="Close output">×</button>
            </div>
          </div>

          <div className="output-content">
            {output.length ? (
              output.map((line, index) => (
                <div key={`${index}-${line}`} className="output-line">
                  {line}
                </div>
              ))
            ) : (
              <span className="output-empty">No output.</span>
            )}
          </div>
        </div>
      )}

      {isReplayOpen && (
        <div className="replay-panel">
          <div className="replay-panel-header">
            <div>
              <strong>Replay History</strong>
              <span>
                {replayHistory.length} snapshot
                {replayHistory.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="replay-panel-actions">
              <button
                type="button"
                onClick={() => stepReplay(-1)}
                disabled={!replayHistory.length || replayIndex <= 0}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => stepReplay(1)}
                disabled={
                  !replayHistory.length ||
                  replayIndex >= replayHistory.length - 1
                }
              >
                ▶
              </button>
              {isReplayPreview && (
                <button type="button" onClick={exitReplayPreview}>
                  Exit
                </button>
              )}
              <button type="button" onClick={() => setIsReplayOpen(false)}>
                ×
              </button>
            </div>
          </div>

          <div className="replay-timeline">
            {replayHistory.length ? (
              replayHistory.map((snapshot, index) => (
                <button
                  key={`${snapshot.timestamp}-${index}`}
                  type="button"
                  className={`replay-point ${
                    index === replayIndex ? "active" : ""
                  }`}
                  onClick={() => selectReplaySnapshot(index)}
                  title={formatReplayTime(snapshot.timestamp)}
                >
                  <span className="replay-point-dot" />
                  <span>{index + 1}</span>
                </button>
              ))
            ) : (
              <span className="replay-empty">
                Make an edit to create replay snapshots.
              </span>
            )}
          </div>

          {replayHistory.length > 0 && replayIndex >= 0 && (
            <div className="replay-details">
              <span>
                Snapshot {replayIndex + 1} of {replayHistory.length}
              </span>
              <span>
                {formatReplayTime(replayHistory[replayIndex]?.timestamp)}
              </span>
              <span>
                {replayHistory[replayIndex]?.files?.length || 0} files
              </span>
            </div>
          )}
        </div>
      )}

      {/* =================================================
          CREATE FILE MODAL
          ================================================= */}

      {showNewFileModal && (
        <div className="new-file-modal-overlay" onMouseDown={closeNewFileModal}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Create New File</h3>
              <button type="button" className="new-file-modal-close" onClick={closeNewFileModal}>
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
                  if (event.key === "Enter") createNewFile();
                  if (event.key === "Escape") closeNewFileModal();
                }}
                placeholder="example.js"
                autoFocus
                spellCheck={false}
              />
              <small>Language is detected from the extension.</small>
            </div>
            <div className="new-file-modal-actions">
              <button type="button" className="cancel-file-button" onClick={closeNewFileModal}>
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
          RENAME FILE MODAL
          ================================================= */}

      {showRenameModal && (
        <div className="new-file-modal-overlay" onMouseDown={closeRenameModal}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Rename File</h3>
              <button type="button" className="new-file-modal-close" onClick={closeRenameModal}>
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
                  if (event.key === "Enter") renameCurrentFile();
                  if (event.key === "Escape") closeRenameModal();
                }}
                autoFocus
                spellCheck={false}
              />
            </div>
            <div className="new-file-modal-actions">
              <button type="button" className="cancel-file-button" onClick={closeRenameModal}>
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
              <button type="button" className="new-file-modal-close" onClick={cancelCloseFile}>
                ×
              </button>
            </div>
            <div className="new-file-modal-body">
              <p>This file has unsaved changes.</p>
              <p>Save before closing?</p>
            </div>
            <div className="new-file-modal-actions">
              <button type="button" className="cancel-file-button" onClick={cancelCloseFile}>
                Cancel
              </button>
              <button type="button" className="cancel-file-button" onClick={discardAndCloseFile}>
                Don't Save
              </button>
              <button type="button" className="create-file-button" onClick={saveAndCloseFile}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          DELETE FILE MODAL
          ================================================= */}

      {showDeleteModal && (
        <div className="new-file-modal-overlay" onMouseDown={cancelDeleteFile}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-file-modal-header">
              <h3>Delete File</h3>
              <button type="button" className="new-file-modal-close" onClick={cancelDeleteFile}>
                ×
              </button>
            </div>
            <div className="new-file-modal-body">
              <p>
                Delete{" "}
                <strong>
                  {files.find((file) => file.id === filePendingDelete)?.name}
                </strong>
                ?
              </p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="new-file-modal-actions">
              <button type="button" className="cancel-file-button" onClick={cancelDeleteFile}>
                Cancel
              </button>
              <button type="button" className="delete-file-button" onClick={deleteFile}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          EDITOR FOOTER
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
