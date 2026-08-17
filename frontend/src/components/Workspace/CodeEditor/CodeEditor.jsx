import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./CodeEditor.css";

import Prism from "prismjs";

import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";

/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY =
  "syncspace-code-editor";

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
];

/* =========================================================
   LANGUAGE BY EXTENSION
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
};

/* =========================================================
   GET LANGUAGE
   ========================================================= */

function getLanguageFromFileName(
  fileName
) {
  const extension =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase();

  return (
    LANGUAGE_BY_EXTENSION[
      extension
    ] || "Plain Text"
  );
}

/* =========================================================
   TAB LANGUAGE
   ========================================================= */

function getTabLanguageLabel(
  language
) {
  const labels = {
    JavaScript: "JS",
    Python: "PY",
    HTML: "HTML",
    CSS: "CSS",
    JSON: "JSON",
    TypeScript: "TS",
    "Plain Text": "TXT",
  };

  return (
    labels[language] ||
    "TXT"
  );
}

/* =========================================================
   LOAD LOCAL STORAGE
   ========================================================= */

function loadEditorData() {
  try {
    const storedData =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!storedData) {
      return null;
    }

    return JSON.parse(
      storedData
    );
  } catch (error) {
    console.error(
      "Failed to load Code Editor data:",
      error
    );

    return null;
  }
}

/* =========================================================
   CODE EDITOR
   ========================================================= */

function CodeEditor({
  socket,
  roomId: roomIdProp,
}) {
  /* =======================================================
     ROOM ID
     ======================================================= */

  const roomId =
    roomIdProp ||
    decodeURIComponent(
      window.location.pathname
        .split("/room/")[1] ||
        "default-room"
    );

  /* =======================================================
     FILE STATE
     ======================================================= */

  const [files, setFiles] =
    useState(() => {
      const storedData =
        loadEditorData();

      return storedData?.files
        ?.length
        ? storedData.files
        : DEFAULT_FILES;
    });

  const [activeFileId, setActiveFileId] =
    useState(() => {
      const storedData =
        loadEditorData();

      if (
        storedData?.activeFileId &&
        storedData?.files?.some(
          (file) =>
            file.id ===
            storedData.activeFileId
        )
      ) {
        return storedData.activeFileId;
      }

      return DEFAULT_FILES[0].id;
    });

  /* =======================================================
     OUTPUT
     ======================================================= */

  const [output, setOutput] =
    useState([
      "JavaScript execution is currently supported in the browser.",
    ]);

  /* =======================================================
     CURSOR
     ======================================================= */

  const [cursorPosition, setCursorPosition] =
    useState({
      line: 1,
      column: 1,
    });

  /* =======================================================
     MODALS
     ======================================================= */

  const [showNewFileModal, setShowNewFileModal] =
    useState(false);

  const [newFileName, setNewFileName] =
    useState("");

  const [showRenameModal, setShowRenameModal] =
    useState(false);

  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [filePendingDelete, setFilePendingDelete] =
    useState(null);

  const [showFileMenu, setShowFileMenu] =
    useState(false);

  const [renameFileName, setRenameFileName] =
    useState("");

  const [showUnsavedModal, setShowUnsavedModal] =
    useState(false);

  const [filePendingClose, setFilePendingClose] =
    useState(null);

  /* =======================================================
     REFS
     ======================================================= */

  const textareaRef =
    useRef(null);

  const lineNumbersRef =
    useRef(null);

  const codeSyncReadyRef =
  useRef(false);

  const applyingRemoteCodeRef =
  useRef(false);

  const [remoteCursors, setRemoteCursors] =
    useState({});

  /*
   * Remote cursor positions are measured in a layout effect.
   * Do not read textareaRef.current while React is rendering.
   * That causes the react-hooks/refs ESLint error.
   */
  const [remoteCursorPositions, setRemoteCursorPositions] =
    useState({});

  const [editorScroll, setEditorScroll] =
    useState({
      top: 0,
      left: 0,
    });

  /* =======================================================
     USER ID / COLOR
     ======================================================= */

  const [userId] =
    useState(
      () =>
        `user-${Math.random()
          .toString(36)
          .substring(2, 9)}`
    );

  const [userColor] =
    useState(
      () =>
        `hsl(${Math.floor(
          Math.random() * 360
        )}, 70%, 55%)`
    );

  /* =======================================================
     ACTIVE FILE
     ======================================================= */

  const activeFile =
    useMemo(() => {
      return (
        files.find(
          (file) =>
            file.id ===
            activeFileId
        ) ||
        files[0] ||
        null
      );
    }, [
      files,
      activeFileId,
    ]);

  /* =======================================================
     SYNTAX HIGHLIGHTING
     ======================================================= */

  const highlightedCode =
    useMemo(() => {
      if (!activeFile) {
        return "";
      }

      const languageMap = {
        JavaScript:
          "javascript",
        Python: "python",
        HTML: "markup",
        CSS: "css",
        JSON: "json",
        TypeScript:
          "javascript",
      };

      const prismLanguage =
        languageMap[
          activeFile.language
        ] || null;

      if (
        !prismLanguage
      ) {
        return activeFile.code;
      }

      const grammar =
        Prism.languages[
          prismLanguage
        ];

      if (!grammar) {
        return activeFile.code;
      }

      return Prism.highlight(
        activeFile.code,
        grammar,
        prismLanguage
      );
    }, [activeFile]);

  /* =======================================================
     LINE NUMBERS
     ======================================================= */

  const lineNumbers =
    useMemo(() => {
      if (!activeFile) {
        return [1];
      }

      const lineCount =
        Math.max(
          1,
          activeFile.code.split(
            "\n"
          ).length
        );

      return Array.from(
        {
          length:
            lineCount,
        },
        (_, index) =>
          index + 1
      );
    }, [activeFile]);

  /* =======================================================
     SAVE STATUS
     ======================================================= */

  const isUnsaved =
    useMemo(() => {
      if (!activeFile) {
        return false;
      }

      return (
        activeFile.code !==
        activeFile.savedCode
      );
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
        })
      );
    } catch (error) {
      console.error(
        "Failed to save Code Editor data:",
        error
      );
    }
  }, [
    files,
    activeFileId,
  ]);

  /* =======================================================
   BROADCAST FILE STATE CHANGES
   ======================================================= */

useEffect(() => {
  if (
    !socket ||
    !socket.connected ||
    !codeSyncReadyRef.current ||
    applyingRemoteCodeRef.current
  ) {
    return;
  }

  socket.emit(
    "code-update",
    {
      roomId,
      files,
    }
  );
}, [
  files,
  socket,
  roomId,
]);

  /* =======================================================
     UPDATE FILE
     ======================================================= */

  const updateFileCode =
  useCallback(
    (newCode) => {
      setFiles(
        (currentFiles) =>
          currentFiles.map(
            (file) =>
              file.id === activeFileId
                ? {
                    ...file,
                    code: newCode,
                  }
                : file
          )
      );
    },
    [activeFileId]
  );

  /* =======================================================
     UPDATE CURSOR
     ======================================================= */

  const updateCursorPosition =
    useCallback(
      (textarea) => {
        if (!textarea) {
          return;
        }

        const cursor =
          textarea.selectionStart;

        const textBeforeCursor =
          textarea.value.slice(
            0,
            cursor
          );

        const lines =
          textBeforeCursor.split(
            "\n"
          );

        const line =
          lines.length;

        const column =
          lines[
            lines.length - 1
          ].length + 1;

        setCursorPosition({
          line,
          column,
        });
      },
      []
    );

  /* =======================================================
     AWARENESS → SEND CURSOR
     ======================================================= */

  useEffect(() => {
    if (
      !socket ||
      !socket.connected
    ) {
      return;
    }

    socket.emit(
      "awareness-update",
      {
        roomId,

        awareness: {
          userId,
          userColor,
          line:
            cursorPosition.line,
          column:
            cursorPosition.column,
          fileId: activeFileId,
        },
      }
    );
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
   REAL-TIME CODE SYNCHRONIZATION
   ======================================================= */

useEffect(() => {
  if (!socket) {
    return undefined;
  }

  codeSyncReadyRef.current = false;

  /* -------------------------------------------------------
     RECEIVE CURRENT ROOM CODE
     ------------------------------------------------------- */

  const handleCodeSync = ({
    roomId: incomingRoomId,
    files: incomingFiles,
  } = {}) => {
    if (
      incomingRoomId !== roomId ||
      !Array.isArray(incomingFiles)
    ) {
      return;
    }

    applyingRemoteCodeRef.current = true;

    setFiles(incomingFiles);

    /*
     * Keep the current user's selected tab if possible.
     */
    setActiveFileId((currentId) => {
      if (
        incomingFiles.some(
          (file) => file.id === currentId
        )
      ) {
        return currentId;
      }

      return incomingFiles[0]?.id ||
        DEFAULT_FILES[0].id;
    });

    codeSyncReadyRef.current = true;

    requestAnimationFrame(() => {
      applyingRemoteCodeRef.current = false;
    });
  };

  /* -------------------------------------------------------
     NO ROOM CODE YET
     ------------------------------------------------------- */

  const handleCodeSyncEmpty = ({
    roomId: incomingRoomId,
  } = {}) => {
    if (
      incomingRoomId !== roomId
    ) {
      return;
    }

    codeSyncReadyRef.current = true;

    socket.emit(
      "code-update",
      {
        roomId,
        files,
      }
    );
  };

  /* -------------------------------------------------------
     RECEIVE LIVE CODE CHANGE
     ------------------------------------------------------- */

  const handleRemoteCodeUpdate = ({
    roomId: incomingRoomId,
    files: incomingFiles,
  } = {}) => {
    if (
      incomingRoomId !== roomId ||
      !Array.isArray(incomingFiles)
    ) {
      return;
    }

    applyingRemoteCodeRef.current = true;

    setFiles(incomingFiles);

    setActiveFileId((currentId) => {
      if (
        incomingFiles.some(
          (file) => file.id === currentId
        )
      ) {
        return currentId;
      }

      return incomingFiles[0]?.id ||
        DEFAULT_FILES[0].id;
    });

    requestAnimationFrame(() => {
      applyingRemoteCodeRef.current = false;
    });
  };

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

  /* -------------------------------------------------------
     REQUEST ROOM CODE
     ------------------------------------------------------- */

  if (socket.connected) {
    socket.emit(
      "code-sync-request",
      roomId
    );
  }

  const handleSocketConnect = () => {
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
      "connect",
      handleSocketConnect
    );
  };
}, [socket, roomId]);

  /* =======================================================
     RECEIVE REMOTE CURSORS
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleAwarenessUpdate =
      ({
        socketId,
        awareness,
      }) => {
        if (!socketId) {
          return;
        }

        if (!awareness) {
          return;
        }

        /*
         * Ignore our own cursor.
         */

        if (
          awareness.userId ===
          userId
        ) {
          return;
        }

        setRemoteCursors(
          (current) => ({
            ...current,
            [socketId]:
              awareness,
          })
        );
      };

    const handleAwarenessRemove =
      ({
        socketId,
      }) => {
        if (!socketId) {
          return;
        }

        setRemoteCursors(
          (current) => {
            const updated = {
              ...current,
            };

            delete updated[
              socketId
            ];

            return updated;
          }
        );
      };

    socket.on(
      "awareness-update",
      handleAwarenessUpdate
    );

    socket.on(
      "awareness-remove",
      handleAwarenessRemove
    );

    return () => {
      socket.off(
        "awareness-update",
        handleAwarenessUpdate
      );

      socket.off(
        "awareness-remove",
        handleAwarenessRemove
      );
    };
  }, [
    socket,
    userId,
  ]);

  /* =======================================================
     SAVE CURRENT FILE
     ======================================================= */

  const saveCurrentFile =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      setFiles(
        (currentFiles) =>
          currentFiles.map(
            (file) =>
              file.id ===
              activeFileId
                ? {
                    ...file,
                    savedCode:
                      file.code,
                  }
                : file
          )
      );
    }, [
      activeFile,
      activeFileId,
    ]);

  /* =======================================================
     SWITCH FILE
     ======================================================= */

  const switchFile =
    useCallback(
      (fileId) => {
        setActiveFileId(
          fileId
        );

        setOutput([]);

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
      [updateCursorPosition]
    );

  /* =======================================================
     PERFORM CLOSE
     ======================================================= */

  const performCloseFile =
    useCallback(
      (fileId) => {
        if (
          files.length === 1
        ) {
          return;
        }

        const fileIndex =
          files.findIndex(
            (file) =>
              file.id === fileId
          );

        const remainingFiles =
          files.filter(
            (file) =>
              file.id !==
              fileId
          );

        setFiles(
          remainingFiles
        );

        if (
          fileId ===
          activeFileId
        ) {
          const nextIndex =
            Math.max(
              0,
              fileIndex - 1
            );

          const nextFile =
            remainingFiles[
              nextIndex
            ];

          if (nextFile) {
            setActiveFileId(
              nextFile.id
            );
          }
        }

        setFilePendingClose(
          null
        );

        setShowUnsavedModal(
          false
        );
      },
      [
        files,
        activeFileId,
      ]
    );

  /* =======================================================
     CLOSE FILE
     ======================================================= */

  const closeFile =
    useCallback(
      (event, fileId) => {
        event.stopPropagation();

        if (
          files.length === 1
        ) {
          return;
        }

        const fileToClose =
          files.find(
            (file) =>
              file.id === fileId
          );

        if (!fileToClose) {
          return;
        }

        const hasUnsavedChanges =
          fileToClose.code !==
          fileToClose.savedCode;

        if (
          hasUnsavedChanges
        ) {
          setFilePendingClose(
            fileId
          );

          setShowUnsavedModal(
            true
          );

          return;
        }

        performCloseFile(
          fileId
        );
      },
      [
        files,
        performCloseFile,
      ]
    );

  /* =======================================================
     CANCEL CLOSE
     ======================================================= */

  const cancelCloseFile =
    useCallback(() => {
      setFilePendingClose(
        null
      );

      setShowUnsavedModal(
        false
      );
    }, []);

  /* =======================================================
     DISCARD AND CLOSE
     ======================================================= */

  const discardAndCloseFile =
    useCallback(() => {
      if (
        !filePendingClose
      ) {
        return;
      }

      performCloseFile(
        filePendingClose
      );
    }, [
      filePendingClose,
      performCloseFile,
    ]);

  /* =======================================================
     SAVE AND CLOSE
     ======================================================= */

  const saveAndCloseFile =
    useCallback(() => {
      if (
        !filePendingClose
      ) {
        return;
      }

      setFiles(
        (currentFiles) =>
          currentFiles.map(
            (file) =>
              file.id ===
              filePendingClose
                ? {
                    ...file,
                    savedCode:
                      file.code,
                  }
                : file
          )
      );

      performCloseFile(
        filePendingClose
      );
    }, [
      filePendingClose,
      performCloseFile,
    ]);

  /* =======================================================
     DUPLICATE FILE
     ======================================================= */

  const duplicateCurrentFile =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      const baseName =
        activeFile.name.includes(
          "."
        )
          ? activeFile.name.substring(
              0,
              activeFile.name.lastIndexOf(
                "."
              )
            )
          : activeFile.name;

      const extension =
        activeFile.name.includes(
          "."
        )
          ? activeFile.name.substring(
              activeFile.name.lastIndexOf(
                "."
              )
            )
          : "";

      let duplicateName =
        `${baseName} copy${extension}`;

      let counter = 2;

      while (
        files.some(
          (file) =>
            file.name.toLowerCase() ===
            duplicateName.toLowerCase()
        )
      ) {
        duplicateName =
          `${baseName} copy ${counter}${extension}`;

        counter += 1;
      }

      const duplicatedFile = {
        ...activeFile,
        id: `${duplicateName}-${Date.now()}`,
        name: duplicateName,
      };

      setFiles(
        (currentFiles) => [
          ...currentFiles,
          duplicatedFile,
        ]
      );

      setActiveFileId(
        duplicatedFile.id
      );

      setOutput([]);
    }, [
      activeFile,
      files,
    ]);

  /* =======================================================
     DELETE REQUEST
     ======================================================= */

  const requestDeleteCurrentFile =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      if (
        files.length === 1
      ) {
        return;
      }

      setFilePendingDelete(
        activeFile.id
      );

      setShowDeleteModal(
        true
      );
    }, [
      activeFile,
      files.length,
    ]);

  /* =======================================================
     CANCEL DELETE
     ======================================================= */

  const cancelDeleteFile =
    useCallback(() => {
      setFilePendingDelete(
        null
      );

      setShowDeleteModal(
        false
      );
    }, []);

  /* =======================================================
     DELETE FILE
     ======================================================= */

  const deleteFile =
    useCallback(() => {
      if (
        !filePendingDelete
      ) {
        return;
      }

      if (
        files.length === 1
      ) {
        return;
      }

      const fileIndex =
        files.findIndex(
          (file) =>
            file.id ===
            filePendingDelete
        );

      const remainingFiles =
        files.filter(
          (file) =>
            file.id !==
            filePendingDelete
        );

      setFiles(
        remainingFiles
      );

      if (
        filePendingDelete ===
        activeFileId
      ) {
        const nextIndex =
          Math.max(
            0,
            fileIndex - 1
          );

        const nextFile =
          remainingFiles[
            nextIndex
          ];

        if (nextFile) {
          setActiveFileId(
            nextFile.id
          );
        }
      }

      setFilePendingDelete(
        null
      );

      setShowDeleteModal(
        false
      );

      setOutput([]);
    }, [
      filePendingDelete,
      files,
      activeFileId,
    ]);

  /* =======================================================
     NEW FILE MODAL
     ======================================================= */

  const openNewFileModal =
    useCallback(() => {
      setNewFileName("");

      setShowNewFileModal(
        true
      );
    }, []);

  const closeNewFileModal =
    useCallback(() => {
      setShowNewFileModal(
        false
      );

      setNewFileName("");
    }, []);

  /* =======================================================
     CREATE FILE
     ======================================================= */

  const createNewFile =
    useCallback(() => {
      const trimmedName =
        newFileName.trim();

      if (!trimmedName) {
        return;
      }

      const alreadyExists =
        files.some(
          (file) =>
            file.name.toLowerCase() ===
            trimmedName.toLowerCase()
        );

      if (alreadyExists) {
        return;
      }

      const language =
        getLanguageFromFileName(
          trimmedName
        );

      const newFile = {
        id: `${trimmedName}-${Date.now()}`,
        name: trimmedName,
        language,
        code: "",
        savedCode: "",
      };

      setFiles(
        (currentFiles) => [
          ...currentFiles,
          newFile,
        ]
      );

      setActiveFileId(
        newFile.id
      );

      setNewFileName("");

      setShowNewFileModal(
        false
      );

      setOutput([]);

      requestAnimationFrame(
        () => {
          textareaRef.current?.focus();
        }
      );
    }, [
      files,
      newFileName,
    ]);

  /* =======================================================
     RENAME
     ======================================================= */

  const openRenameModal =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      setRenameFileName(
        activeFile.name
      );

      setShowRenameModal(
        true
      );
    }, [activeFile]);

  const closeRenameModal =
    useCallback(() => {
      setShowRenameModal(
        false
      );

      setRenameFileName("");
    }, []);

  const renameCurrentFile =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      const trimmedName =
        renameFileName.trim();

      if (!trimmedName) {
        return;
      }

      if (
        trimmedName ===
        activeFile.name
      ) {
        closeRenameModal();

        return;
      }

      const alreadyExists =
        files.some(
          (file) =>
            file.id !==
              activeFile.id &&
            file.name.toLowerCase() ===
              trimmedName.toLowerCase()
        );

      if (alreadyExists) {
        return;
      }

      const newLanguage =
        getLanguageFromFileName(
          trimmedName
        );

      setFiles(
        (currentFiles) =>
          currentFiles.map(
            (file) =>
              file.id ===
              activeFile.id
                ? {
                    ...file,
                    name:
                      trimmedName,
                    language:
                      newLanguage,
                  }
                : file
          )
      );

      closeRenameModal();
    }, [
      activeFile,
      renameFileName,
      files,
      closeRenameModal,
    ]);

  /* =======================================================
     CODE CHANGE
     ======================================================= */

  const handleCodeChange =
    useCallback(
      (event) => {
        updateFileCode(
          event.target.value
        );

        updateCursorPosition(
          event.target
        );
      },
      [
        updateFileCode,
        updateCursorPosition,
      ]
    );

  /* =======================================================
     CURSOR CHANGE
     ======================================================= */

  const handleCursorChange =
    useCallback(
      (event) => {
        updateCursorPosition(
          event.currentTarget
        );
      },
      [updateCursorPosition]
    );

  /* =======================================================
     EDITOR SCROLL
     ======================================================= */

  const handleEditorScroll =
    useCallback(
      (event) => {
        const textarea =
          event.currentTarget;

        if (
          lineNumbersRef.current
        ) {
          lineNumbersRef.current.scrollTop =
            textarea.scrollTop;
        }

        const highlight =
          textarea.parentElement?.querySelector(
            ".code-highlight"
          );

        if (highlight) {
          highlight.scrollTop =
            textarea.scrollTop;

          highlight.scrollLeft =
            textarea.scrollLeft;
        }

        setEditorScroll({
          top:
            textarea.scrollTop,
          left:
            textarea.scrollLeft,
        });
      },
      []
    );

  /* =======================================================
     MEASURE REMOTE CURSOR POSITIONS
     ======================================================= */

  useLayoutEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      setRemoteCursorPositions({});
      return undefined;
    }

    const styles =
      window.getComputedStyle(
        textarea
      );

    const lineHeight =
      parseFloat(
        styles.lineHeight
      ) ||
      parseFloat(
        styles.fontSize
      ) ||
      14;

    const paddingTop =
      parseFloat(
        styles.paddingTop
      ) || 0;

    const paddingLeft =
      parseFloat(
        styles.paddingLeft
      ) || 0;

    const canvas =
      document.createElement(
        "canvas"
      );

    const context =
      canvas.getContext(
        "2d"
      );

    if (context) {
      context.font = [
        styles.fontStyle,
        styles.fontVariant,
        styles.fontWeight,
        styles.fontSize,
        styles.fontFamily,
      ].join(" ");
    }

    const codeLines =
      activeFile.code.split(
        "\n"
      );

    const positions = {};

    Object.entries(
      remoteCursors
    ).forEach(
      ([socketId, awareness]) => {
        if (
          !awareness ||
          awareness.fileId !==
            activeFileId
        ) {
          return;
        }

        const line =
          Math.max(
            1,
            Number(
              awareness.line
            ) || 1
          );

        const column =
          Math.max(
            1,
            Number(
              awareness.column
            ) || 1
          );

        const currentLine =
          codeLines[
            line - 1
          ] || "";

        const characterOffset =
          Math.min(
            Math.max(
              0,
              column - 1
            ),
            currentLine.length
          );

        const textBeforeCursor =
          currentLine.slice(
            0,
            characterOffset
          );

        let textWidth = 0;

        if (context) {
          textWidth =
            context.measureText(
              textBeforeCursor
            ).width;
        }

        positions[socketId] = {
          top:
            paddingTop +
            (line - 1) *
              lineHeight -
            editorScroll.top,
          left:
            paddingLeft +
            textWidth -
            editorScroll.left,
          userId:
            awareness.userId ||
            "User",
          userColor:
            awareness.userColor ||
            "#ff4d4d",
        };
      }
    );

    setRemoteCursorPositions(
      positions
    );

    return undefined;
  }, [
    remoteCursors,
    activeFileId,
    activeFile.code,
    editorScroll.top,
    editorScroll.left,
  ]);

  /* =======================================================
     KEYBOARD HANDLING
     ======================================================= */

  const handleEditorKeyDown =
    useCallback(
      (event) => {
        const textarea =
          event.currentTarget;

        /* =================================================
           SKIP CLOSING CHARACTER
           ================================================= */

        const closingCharacters = {
          ")": ")",
          "]": "]",
          "}": "}",
          '"': '"',
          "'": "'",
          "`": "`",
        };

        if (
          closingCharacters[
            event.key
          ] &&
          textarea.selectionStart ===
            textarea.selectionEnd
        ) {
          const position =
            textarea.selectionStart;

          const nextCharacter =
            textarea.value[
              position
            ];

          if (
            nextCharacter ===
            event.key
          ) {
            event.preventDefault();

            const newPosition =
              position + 1;

            textarea.selectionStart =
              newPosition;

            textarea.selectionEnd =
              newPosition;

            updateCursorPosition(
              textarea
            );

            return;
          }
        }

        /* =================================================
           SAVE
           ================================================= */

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "s"
        ) {
          event.preventDefault();

          saveCurrentFile();

          return;
        }

        /* =================================================
           COMMENT
           ================================================= */

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key === "/"
        ) {
          event.preventDefault();

          const start =
            textarea.selectionStart;

          const end =
            textarea.selectionEnd;

          const value =
            textarea.value;

          const language =
            activeFile?.language?.toLowerCase() ||
            "javascript";

          let commentPrefix =
            "//";

          let commentSuffix =
            "";

          if (
            language ===
              "python" ||
            language === "py"
          ) {
            commentPrefix = "#";
          }

          if (
            language ===
              "html"
          ) {
            commentPrefix =
              "<!--";

            commentSuffix =
              "-->";
          }

          const selectionStart =
            value.lastIndexOf(
              "\n",
              start - 1
            ) + 1;

          const selectionEndIndex =
            value.indexOf(
              "\n",
              end
            );

          const selectionEnd =
            selectionEndIndex ===
            -1
              ? value.length
              : selectionEndIndex;

          const selectedText =
            value.slice(
              selectionStart,
              selectionEnd
            );

          const lines =
            selectedText.split(
              "\n"
            );

          let updatedLines;

          if (
            commentSuffix
          ) {
            const allCommented =
              lines
                .filter(
                  (line) =>
                    line.trim()
                      .length >
                    0
                )
                .every(
                  (line) => {
                    const trimmed =
                      line.trim();

                    return (
                      trimmed.startsWith(
                        commentPrefix
                      ) &&
                      trimmed.endsWith(
                        commentSuffix
                      )
                    );
                  }
                );

            if (
              allCommented
            ) {
              updatedLines =
                lines.map(
                  (line) => {
                    const leading =
                      line.match(
                        /^\s*/
                      )?.[0] ||
                      "";

                    const trimmed =
                      line.trim();

                    const content =
                      trimmed
                        .slice(
                          commentPrefix.length,
                          trimmed.length -
                            commentSuffix.length
                        )
                        .trim();

                    return (
                      leading +
                      content
                    );
                  }
                );
            } else {
              updatedLines =
                lines.map(
                  (line) => {
                    const leading =
                      line.match(
                        /^\s*/
                      )?.[0] ||
                      "";

                    const content =
                      line.trim();

                    if (
                      !content
                    ) {
                      return line;
                    }

                    return (
                      leading +
                      commentPrefix +
                      " " +
                      content +
                      " " +
                      commentSuffix
                    );
                  }
                );
            }
          } else {
            const escapedPrefix =
              commentPrefix.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              );

            const commentPattern =
              new RegExp(
                `^(\\s*)${escapedPrefix}(?:\\s)?`
              );

            const nonEmptyLines =
              lines.filter(
                (line) =>
                  line.trim() !==
                  ""
              );

            const allCommented =
              nonEmptyLines.length >
                0 &&
              nonEmptyLines.every(
                (line) =>
                  commentPattern.test(
                    line
                  )
              );

            if (
              allCommented
            ) {
              updatedLines =
                lines.map(
                  (line) =>
                    line.replace(
                      commentPattern,
                      "$1"
                    )
                );
            } else {
              updatedLines =
                lines.map(
                  (line) => {
                    const leading =
                      line.match(
                        /^\s*/
                      )?.[0] ||
                      "";

                    const content =
                      line.slice(
                        leading.length
                      );

                    if (
                      !content.trim()
                    ) {
                      return line;
                    }

                    return (
                      leading +
                      commentPrefix +
                      " " +
                      content
                    );
                  }
                );
            }
          }

          const newSelectedText =
            updatedLines.join(
              "\n"
            );

          const newValue =
            value.substring(
              0,
              selectionStart
            ) +
            newSelectedText +
            value.substring(
              selectionEnd
            );

          updateFileCode(
            newValue
          );

          requestAnimationFrame(
            () => {
              if (
                !textareaRef.current
              ) {
                return;
              }

              textareaRef.current.selectionStart =
                selectionStart;

              textareaRef.current.selectionEnd =
                selectionStart +
                newSelectedText.length;

              updateCursorPosition(
                textareaRef.current
              );
            }
          );

          return;
        }

        /* =================================================
           SMART BACKSPACE
           ================================================= */

        if (
          event.key ===
            "Backspace" &&
          textarea.selectionStart ===
            textarea.selectionEnd
        ) {
          const position =
            textarea.selectionStart;

          if (
            position > 0
          ) {
            const value =
              textarea.value;

            const previousCharacter =
              value[
                position - 1
              ];

            const nextCharacter =
              value[position];

            const pairs = {
              "(": ")",
              "[": "]",
              "{": "}",
              '"': '"',
              "'": "'",
              "`": "`",
            };

            if (
              pairs[
                previousCharacter
              ] ===
              nextCharacter
            ) {
              event.preventDefault();

              const newValue =
                value.substring(
                  0,
                  position - 1
                ) +
                value.substring(
                  position + 1
                );

              updateFileCode(
                newValue
              );

              requestAnimationFrame(
                () => {
                  if (
                    !textareaRef.current
                  ) {
                    return;
                  }

                  const newPosition =
                    position - 1;

                  textareaRef.current.selectionStart =
                    newPosition;

                  textareaRef.current.selectionEnd =
                    newPosition;

                  updateCursorPosition(
                    textareaRef.current
                  );
                }
              );

              return;
            }
          }
        }

        /* =================================================
           SMART BRACKETS / QUOTES
           ================================================= */

        const pairedCharacters = {
          "(": ")",
          "[": "]",
          "{": "}",
          '"': '"',
          "'": "'",
          "`": "`",
        };

        if (
          Object.prototype.hasOwnProperty.call(
            pairedCharacters,
            event.key
          )
        ) {
          event.preventDefault();

          const start =
            textarea.selectionStart;

          const end =
            textarea.selectionEnd;

          const value =
            textarea.value;

          const closingCharacter =
            pairedCharacters[
              event.key
            ];

          const selectedText =
            value.substring(
              start,
              end
            );

          if (
            start !== end
          ) {
            const newValue =
              value.substring(
                0,
                start
              ) +
              event.key +
              selectedText +
              closingCharacter +
              value.substring(
                end
              );

            updateFileCode(
              newValue
            );

            requestAnimationFrame(
              () => {
                if (
                  !textareaRef.current
                ) {
                  return;
                }

                textareaRef.current.selectionStart =
                  start + 1;

                textareaRef.current.selectionEnd =
                  end + 1;

                updateCursorPosition(
                  textareaRef.current
                );
              }
            );

            return;
          }

          if (
            value[start] ===
            closingCharacter
          ) {
            textarea.selectionStart =
              start + 1;

            textarea.selectionEnd =
              start + 1;

            updateCursorPosition(
              textarea
            );

            return;
          }

          const newValue =
            value.substring(
              0,
              start
            ) +
            event.key +
            closingCharacter +
            value.substring(
              end
            );

          updateFileCode(
            newValue
          );

          requestAnimationFrame(
            () => {
              if (
                !textareaRef.current
              ) {
                return;
              }

              const newPosition =
                start + 1;

              textareaRef.current.selectionStart =
                newPosition;

              textareaRef.current.selectionEnd =
                newPosition;

              updateCursorPosition(
                textareaRef.current
              );
            }
          );

          return;
        }

        /* =================================================
           TAB / SHIFT TAB
           ================================================= */

        if (
          event.key === "Tab"
        ) {
          event.preventDefault();

          const start =
            textarea.selectionStart;

          const end =
            textarea.selectionEnd;

          const value =
            textarea.value;

          const indentation =
            "  ";

          if (
            event.shiftKey
          ) {
            if (
              start !== end
            ) {
              const selectionStart =
                value.lastIndexOf(
                  "\n",
                  start - 1
                ) + 1;

              const selectionEndIndex =
                value.indexOf(
                  "\n",
                  end
                );

              const selectionEnd =
                selectionEndIndex ===
                -1
                  ? value.length
                  : selectionEndIndex;

              const selectedText =
                value.slice(
                  selectionStart,
                  selectionEnd
                );

              const lines =
                selectedText.split(
                  "\n"
                );

              let removedCharacters = 0;

              const updatedLines =
                lines.map(
                  (line) => {
                    if (
                      line.startsWith(
                        "  "
                      )
                    ) {
                      removedCharacters +=
                        2;

                      return line.slice(
                        2
                      );
                    }

                    if (
                      line.startsWith(
                        " "
                      )
                    ) {
                      removedCharacters +=
                        1;

                      return line.slice(
                        1
                      );
                    }

                    return line;
                  }
                );

              const newSelectedText =
                updatedLines.join(
                  "\n"
                );

              const newValue =
                value.substring(
                  0,
                  selectionStart
                ) +
                newSelectedText +
                value.substring(
                  selectionEnd
                );

              updateFileCode(
                newValue
              );

              requestAnimationFrame(
                () => {
                  if (
                    !textareaRef.current
                  ) {
                    return;
                  }

                  textareaRef.current.selectionStart =
                    Math.max(
                      selectionStart,
                      start - 2
                    );

                  textareaRef.current.selectionEnd =
                    Math.max(
                      selectionStart,
                      end -
                        removedCharacters
                    );

                  updateCursorPosition(
                    textareaRef.current
                  );
                }
              );

              return;
            }

            const lineStart =
              value.lastIndexOf(
                "\n",
                start - 1
              ) + 1;

            const lineText =
              value.slice(
                lineStart,
                lineStart + 2
              );

            let removeCount =
              0;

            if (
              lineText.startsWith(
                "  "
              )
            ) {
              removeCount = 2;
            } else if (
              lineText.startsWith(
                " "
              )
            ) {
              removeCount = 1;
            }

            if (
              removeCount > 0
            ) {
              const newValue =
                value.substring(
                  0,
                  lineStart
                ) +
                value.substring(
                  lineStart +
                    removeCount
                );

              updateFileCode(
                newValue
              );

              requestAnimationFrame(
                () => {
                  if (
                    !textareaRef.current
                  ) {
                    return;
                  }

                  const newPosition =
                    Math.max(
                      lineStart,
                      start -
                        removeCount
                    );

                  textareaRef.current.selectionStart =
                    newPosition;

                  textareaRef.current.selectionEnd =
                    newPosition;

                  updateCursorPosition(
                    textareaRef.current
                  );
                }
              );
            }

            return;
          }

          if (
            start !== end
          ) {
            const selectionStart =
              value.lastIndexOf(
                "\n",
                start - 1
              ) + 1;

            const selectionEndIndex =
              value.indexOf(
                "\n",
                end
              );

            const selectionEnd =
              selectionEndIndex ===
              -1
                ? value.length
                : selectionEndIndex;

            const selectedText =
              value.slice(
                selectionStart,
                selectionEnd
              );

            const lines =
              selectedText.split(
                "\n"
              );

            const updatedLines =
              lines.map(
                (line) =>
                  indentation +
                  line
              );

            const newSelectedText =
              updatedLines.join(
                "\n"
              );

            const newValue =
              value.substring(
                0,
                selectionStart
              ) +
              newSelectedText +
              value.substring(
                selectionEnd
              );

            updateFileCode(
              newValue
            );

            requestAnimationFrame(
              () => {
                if (
                  !textareaRef.current
                ) {
                  return;
                }

                const addedCharacters =
                  lines.length *
                  indentation.length;

                textareaRef.current.selectionStart =
                  start +
                  indentation.length;

                textareaRef.current.selectionEnd =
                  end +
                  addedCharacters;

                updateCursorPosition(
                  textareaRef.current
                );
              }
            );

            return;
          }

          const newValue =
            value.substring(
              0,
              start
            ) +
            indentation +
            value.substring(
              end
            );

          updateFileCode(
            newValue
          );

          requestAnimationFrame(
            () => {
              if (
                !textareaRef.current
              ) {
                return;
              }

              const newPosition =
                start +
                indentation.length;

              textareaRef.current.selectionStart =
                newPosition;

              textareaRef.current.selectionEnd =
                newPosition;

              updateCursorPosition(
                textareaRef.current
              );
            }
          );

          return;
        }

        /* =================================================
           ENTER / SMART INDENTATION
           ================================================= */

        if (
          event.key === "Enter"
        ) {
          event.preventDefault();

          const start =
            textarea.selectionStart;

          const end =
            textarea.selectionEnd;

          const value =
            textarea.value;

          const lineStart =
            value.lastIndexOf(
              "\n",
              start - 1
            ) + 1;

          const lineEnd =
            value.indexOf(
              "\n",
              start
            );

          const currentLine =
            value.slice(
              lineStart,
              lineEnd === -1
                ? value.length
                : lineEnd
            );

          const currentIndent =
            currentLine.match(
              /^\s*/
            )?.[0] || "";

          const textBeforeCursor =
            value.slice(
              lineStart,
              start
            );

          const opensBlock =
            /[({[]\s*$/.test(
              textBeforeCursor
            );

          const nextCharacter =
            value[end];

          const closesBlock =
            nextCharacter ===
              "}" ||
            nextCharacter ===
              "]" ||
            nextCharacter ===
              ")";

          let nextIndent =
            currentIndent;

          if (
            opensBlock
          ) {
            nextIndent +=
              "  ";
          }

          if (
            closesBlock &&
            !opensBlock &&
            textBeforeCursor.trim() ===
              "" &&
            currentIndent.length >=
              2
          ) {
            nextIndent =
              currentIndent.slice(
                0,
                -2
              );
          }

          const insertedText =
            "\n" +
            nextIndent;

          const newValue =
            value.substring(
              0,
              start
            ) +
            insertedText +
            value.substring(
              end
            );

          updateFileCode(
            newValue
          );

          requestAnimationFrame(
            () => {
              if (
                !textareaRef.current
              ) {
                return;
              }

              const newPosition =
                start +
                insertedText.length;

              textareaRef.current.selectionStart =
                newPosition;

              textareaRef.current.selectionEnd =
                newPosition;

              updateCursorPosition(
                textareaRef.current
              );
            }
          );

          return;
        }
      },
      [
        saveCurrentFile,
        updateFileCode,
        updateCursorPosition,
        activeFile,
      ]
    );

  /* =======================================================
     RUN JAVASCRIPT
     ======================================================= */

  const runJavaScript =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      const logs = [];

      const originalConsoleLog =
        console.log;

      try {
        console.log = (
          ...args
        ) => {
          const formatted =
            args
              .map(
                (value) => {
                  if (
                    typeof value ===
                      "object" &&
                    value !== null
                  ) {
                    try {
                      return JSON.stringify(
                        value,
                        null,
                        2
                      );
                    } catch {
                      return String(
                        value
                      );
                    }
                  }

                  return String(
                    value
                  );
                }
              )
              .join(" ");

          logs.push(
            formatted
          );

          originalConsoleLog(
            ...args
          );
        };

        const execute =
          new Function(
            activeFile.code
          );

        execute();
      } catch (error) {
        setOutput([
          `Error: ${error.message}`,
        ]);

        return;
      } finally {
        console.log =
          originalConsoleLog;
      }

      setOutput(
        logs.length
          ? logs
          : [
              "Code executed successfully.",
            ]
      );
    }, [activeFile]);

  /* =======================================================
     RUN CODE
     ======================================================= */

  const runCode =
    useCallback(() => {
      if (!activeFile) {
        return;
      }

      setOutput([]);

      if (
        activeFile.language ===
        "JavaScript"
      ) {
        runJavaScript();

        return;
      }

      if (
        activeFile.language ===
        "Python"
      ) {
        setOutput([
          "Python execution is not connected yet.",
          "",
          "A Python backend/runtime will be added in a later sequence.",
        ]);

        return;
      }

      if (
        activeFile.language ===
        "HTML"
      ) {
        setOutput([
          "HTML preview will be added in a later sequence.",
        ]);

        return;
      }

      if (
        activeFile.language ===
        "CSS"
      ) {
        setOutput([
          "CSS preview will be added in a later sequence.",
        ]);

        return;
      }

      if (
        activeFile.language ===
        "JSON"
      ) {
        try {
          JSON.parse(
            activeFile.code
          );

          setOutput([
            "Valid JSON.",
          ]);
        } catch (error) {
          setOutput([
            `Invalid JSON: ${error.message}`,
          ]);
        }

        return;
      }

      setOutput([
        `${activeFile.language} execution is not connected yet.`,
      ]);
    }, [
      activeFile,
      runJavaScript,
    ]);

  /* =======================================================
     CLEAR OUTPUT
     ======================================================= */

  const clearOutput =
    useCallback(() => {
      setOutput([]);
    }, []);

  /* =======================================================
     GLOBAL SAVE
     ======================================================= */

  useEffect(() => {
    const handleGlobalSave =
      (event) => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "s"
        ) {
          event.preventDefault();

          saveCurrentFile();
        }
      };

    window.addEventListener(
      "keydown",
      handleGlobalSave
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleGlobalSave
      );
    };
  }, [saveCurrentFile]);

  /* =======================================================
     ESCAPE MODAL
     ======================================================= */

  useEffect(() => {
    const handleEscape =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          if (
            showNewFileModal
          ) {
            closeNewFileModal();
          }

          if (
            showRenameModal
          ) {
            closeRenameModal();
          }

          if (
            showUnsavedModal
          ) {
            cancelCloseFile();
          }

          if (
            showDeleteModal
          ) {
            cancelDeleteFile();
          }
        }
      };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [
    showNewFileModal,
    showRenameModal,
    showUnsavedModal,
    showDeleteModal,
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
          <span>
            No files open
          </span>
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
          <div className="code-editor-icon">
            {"</>"}
          </div>

          <div>
            <h2>
              Code Editor
            </h2>

            <p>
              Collaborative coding
            </p>
          </div>
        </div>

        <div className="code-editor-actions">
          <button
            type="button"
            className="run-button"
            onClick={runCode}
          >
            ▶ Run
          </button>

          <div className="file-menu-wrapper">
            <button
              type="button"
              className="more-button"
              title="File options"
              onClick={() =>
                setShowFileMenu(
                  (current) =>
                    !current
                )
              }
            >
              ⋯
            </button>

            {showFileMenu && (
              <div className="file-context-menu">
                <button
                  type="button"
                  onClick={() => {
                    setShowFileMenu(
                      false
                    );

                    openRenameModal();
                  }}
                >
                  <span>
                    ✏
                  </span>

                  <span>
                    Rename
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowFileMenu(
                      false
                    );

                    duplicateCurrentFile();
                  }}
                >
                  <span>
                    ⧉
                  </span>

                  <span>
                    Duplicate
                  </span>
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setShowFileMenu(
                      false
                    );

                    requestDeleteCurrentFile();
                  }}
                >
                  <span>
                    🗑
                  </span>

                  <span>
                    Delete
                  </span>
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
        {files.map(
          (file) => {
            const isActive =
              file.id ===
              activeFileId;

            const fileUnsaved =
              file.code !==
              file.savedCode;

            return (
              <button
                key={file.id}
                type="button"
                className={`editor-tab ${
                  isActive
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  switchFile(
                    file.id
                  )
                }
              >
                <span className="tab-language">
                  {getTabLanguageLabel(
                    file.language
                  )}
                </span>

                <span className="tab-name">
                  {file.name}
                </span>

                {fileUnsaved && (
                  <span
                    className="tab-unsaved"
                    title="Unsaved changes"
                  >
                    ●
                  </span>
                )}

                <span
                  className="tab-close"
                  onClick={(
                    event
                  ) =>
                    closeFile(
                      event,
                      file.id
                    )
                  }
                  title={
                    files.length ===
                    1
                      ? "At least one file must remain open"
                      : "Close file"
                  }
                >
                  ×
                </span>
              </button>
            );
          }
        )}

        <button
          type="button"
          className="new-tab-button"
          title="Create a new file"
          onClick={
            openNewFileModal
          }
        >
          +
        </button>
      </div>

      {/* =================================================
          INFO BAR
          ================================================= */}

      <div className="editor-info-bar">
        <span className="language-label">
          {activeFile.language}
        </span>

        <span
          className={
            isUnsaved
              ? "save-status unsaved"
              : "save-status saved"
          }
        >
          <span className="status-dot">
            ●
          </span>

          {isUnsaved
            ? "Unsaved changes"
            : "Saved"}
        </span>
      </div>

      {/* =================================================
          CODE AREA
          ================================================= */}

      <div className="code-area">
        <div
          ref={lineNumbersRef}
          className="line-numbers"
        >
          {lineNumbers.map(
            (number) => (
              <div
                key={number}
                className="line-number"
              >
                {number}
              </div>
            )
          )}
        </div>

        <div className="editor-textarea-wrapper">
          {/* =================================================
              REMOTE CURSORS
              ================================================= */}

          {Object.entries(
            remoteCursorPositions
          ).map(
            ([socketId, cursor]) => (
              <div
                key={socketId}
                className="remote-cursor-indicator"
                style={{
                  top: `${cursor.top}px`,
                  left: `${cursor.left}px`,
                  borderLeft:
                    `2px solid ${
                      cursor.userColor ||
                      "#ff4d4d"
                    }`,
                }}
              >
                <span
                  className="remote-cursor-label"
                  style={{
                    backgroundColor:
                      cursor.userColor ||
                      "#ff4d4d",
                  }}
                >
                  {cursor.userId ||
                    "User"}
                </span>
              </div>
            )
          )}

          {/* =================================================
              SYNTAX HIGHLIGHT
              ================================================= */}

          <pre
            className="code-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{
              __html:
                highlightedCode,
            }}
          />

          {/* =================================================
              TEXTAREA
              ================================================= */}

          <textarea
            ref={textareaRef}
            className="code-input"
            value={
              activeFile.code
            }
            onChange={
              handleCodeChange
            }
            onKeyDown={
              handleEditorKeyDown
            }
            onClick={
              handleCursorChange
            }
            onKeyUp={
              handleCursorChange
            }
            onSelect={
              handleCursorChange
            }
            onScroll={
              handleEditorScroll
            }
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
          <span>
            Output
          </span>

          <button
            type="button"
            onClick={
              clearOutput
            }
          >
            Clear
          </button>
        </div>

        <div className="output-content">
          {output.length ===
          0 ? (
            <span className="output-empty">
              No output.
            </span>
          ) : (
            output.map(
              (line, index) => (
                <div
                  key={`${line}-${index}`}
                  className="output-line"
                >
                  {line}
                </div>
              )
            )
          )}
        </div>
      </div>

      {/* =================================================
          NEW FILE MODAL
          ================================================= */}

      {showNewFileModal && (
        <div
          className="new-file-modal-overlay"
          onMouseDown={
            closeNewFileModal
          }
        >
          <div
            className="new-file-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="new-file-modal-header">
              <h3>
                Create New File
              </h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={
                  closeNewFileModal
                }
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <label htmlFor="new-file-name">
                File name
              </label>

              <input
                id="new-file-name"
                type="text"
                value={
                  newFileName
                }
                onChange={(
                  event
                ) =>
                  setNewFileName(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    createNewFile();
                  }

                  if (
                    event.key ===
                    "Escape"
                  ) {
                    closeNewFileModal();
                  }
                }}
                placeholder="e.g. app.py"
                autoFocus
              />
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={
                  closeNewFileModal
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="create-file-button"
                onClick={
                  createNewFile
                }
                disabled={
                  !newFileName.trim()
                }
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
        <div
          className="new-file-modal-overlay"
          onMouseDown={
            closeRenameModal
          }
        >
          <div
            className="new-file-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="new-file-modal-header">
              <h3>
                Rename File
              </h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={
                  closeRenameModal
                }
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <label htmlFor="rename-file-name">
                File name
              </label>

              <input
                id="rename-file-name"
                type="text"
                value={
                  renameFileName
                }
                onChange={(
                  event
                ) =>
                  setRenameFileName(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    renameCurrentFile();
                  }

                  if (
                    event.key ===
                    "Escape"
                  ) {
                    closeRenameModal();
                  }
                }}
                autoFocus
                spellCheck={false}
              />

              <small>
                The language will be
                detected from the file
                extension.
              </small>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={
                  closeRenameModal
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="create-file-button"
                onClick={
                  renameCurrentFile
                }
                disabled={
                  !renameFileName.trim()
                }
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
        <div
          className="new-file-modal-overlay"
          onMouseDown={
            cancelCloseFile
          }
        >
          <div
            className="new-file-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="new-file-modal-header">
              <h3>
                Unsaved Changes
              </h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={
                  cancelCloseFile
                }
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <p>
                This file has
                unsaved changes.
              </p>

              <p>
                Do you want to save
                your changes before
                closing?
              </p>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={
                  cancelCloseFile
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="cancel-file-button"
                onClick={
                  discardAndCloseFile
                }
              >
                Don't Save
              </button>

              <button
                type="button"
                className="create-file-button"
                onClick={
                  saveAndCloseFile
                }
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
        <div
          className="new-file-modal-overlay"
          onMouseDown={
            cancelDeleteFile
          }
        >
          <div
            className="new-file-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="new-file-modal-header">
              <h3>
                Delete File
              </h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={
                  cancelDeleteFile
                }
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <p>
                Are you sure you
                want to delete
                <strong>
                  {" "}
                  {activeFile?.name}
                </strong>
                ?
              </p>

              <p>
                This action cannot
                be undone.
              </p>
            </div>

            <div className="new-file-modal-actions">
              <button
                type="button"
                className="cancel-file-button"
                onClick={
                  cancelDeleteFile
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-file-button"
                onClick={
                  deleteFile
                }
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
          Ln{" "}
          {cursorPosition.line},
          Col{" "}
          {cursorPosition.column}
        </span>

        <div className="footer-right">
          <span>
            {activeFile.language}
          </span>

          <span>
            UTF-8
          </span>

          <span>
            Spaces: 2
          </span>
        </div>
      </div>
    </div>
  );
}

export default CodeEditor;