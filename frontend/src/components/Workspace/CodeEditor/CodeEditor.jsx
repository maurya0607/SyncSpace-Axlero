import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";

import "./CodeEditor.css";

import Prism from "prismjs";

import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";

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
];

/* =========================================================
   LANGUAGE HELPERS
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
   GET LANGUAGE FROM FILE NAME
   ========================================================= */

function getLanguageFromFileName(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  return LANGUAGE_BY_EXTENSION[extension] || "Plain Text";
}

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

/* =======================================================
   LOAD EDITOR DATA FROM LOCAL STORAGE
   ======================================================= */

function loadEditorData() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (!storedData) {
      return null;
    }

    return JSON.parse(storedData);
  } catch (error) {
    console.error("Failed to load Code Editor data:", error);

    return null;
  }
}

/* =========================================================
   CODE EDITOR
   ========================================================= */

function CodeEditor() {
  /* =======================================================
     FILE STATE
     ======================================================= */

  const [files, setFiles] = useState(() => {
    const storedData = loadEditorData();

    return storedData?.files?.length ? storedData.files : DEFAULT_FILES;
  });

  const [activeFileId, setActiveFileId] = useState(() => {
    const storedData = loadEditorData();

    if (
      storedData?.activeFileId &&
      storedData?.files?.some((file) => file.id === storedData.activeFileId)
    ) {
      return storedData.activeFileId;
    }

    return DEFAULT_FILES[0].id;
  });

  /* =======================================================
     OUTPUT STATE
     ======================================================= */

  const [output, setOutput] = useState([
    "JavaScript execution is currently supported in the browser.",
  ]);

  /* =======================================================
     CURSOR STATE
     ======================================================= */

  const [cursorPosition, setCursorPosition] = useState({
    line: 1,
    column: 1,
  });

  /* =======================================================
     NEW FILE MODAL STATE
     ======================================================= */

  const [showNewFileModal, setShowNewFileModal] = useState(false);

  const [newFileName, setNewFileName] = useState("");

  const [showRenameModal, setShowRenameModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [filePendingDelete, setFilePendingDelete] = useState(null);

  const [showFileMenu, setShowFileMenu] = useState(false);

  const [renameFileName, setRenameFileName] = useState("");

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const [filePendingClose, setFilePendingClose] = useState(null);

  /* =======================================================
     REFS
     ======================================================= */

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const socketRef = useRef(null);

  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const applyingRemoteUpdateRef = useRef(false);


  const [remoteCursors, setRemoteCursors] = useState({});

  // Keep the remote cursor overlay synchronized with the textarea viewport.
  const [editorScroll, setEditorScroll] = useState({
    top: 0,
    left: 0,
  });

  const [userId] = useState(
    () => `user-${Math.random().toString(36).substring(2, 9)}`,
  );

  const [userColor] = useState(
    () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`,
  );

  const roomId = decodeURIComponent(
    window.location.pathname.split("/room/")[1] || "default-room",
  );

  /* =======================================================
     ACTIVE FILE
     ======================================================= */

  const activeFile = useMemo(() => {
    return files.find((file) => file.id === activeFileId) || files[0] || null;
  }, [files, activeFileId]);

  const highlightedCode = useMemo(() => {
    if (!activeFile) {
      return "";
    }

    const languageMap = {
      JavaScript: "javascript",
      Python: "python",
      HTML: "markup",
      CSS: "css",
      JSON: "json",
      TypeScript: "typescript",
    };

    const prismLanguage = languageMap[activeFile.language] || "javascript";

    const grammar = Prism.languages[prismLanguage];

    if (!grammar) {
      return activeFile.code;
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

    return Array.from({ length: lineCount }, (_, index) => index + 1);
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
   SAVE EDITOR DATA TO LOCAL STORAGE
   ======================================================= */

  useEffect(() => {
    try {
      const editorData = {
        files,
        activeFileId,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(editorData));
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
     UPDATE CURSOR POSITION
     ======================================================= */

  const updateCursorPosition = useCallback((textarea) => {
    if (!textarea) {
      return;
    }

    const cursor = textarea.selectionStart;

    const textBeforeCursor = textarea.value.slice(0, cursor);
    const lines = textBeforeCursor.split("\n");

    // Keep cursor coordinates 1-based:
    // line 1 / column 1 means "before the first character".
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    setCursorPosition({
      line,
      column,
    });
  }, []);

  /* =======================================================
     SEND CURSOR / AWARENESS UPDATE
     ======================================================= */

  useEffect(() => {
    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit("awareness-update", {
      roomId,
      awareness: {
        userId,
        userColor,
        line: cursorPosition.line,
        column: cursorPosition.column,
        fileId: activeFileId,
      },
    });
  }, [cursorPosition, roomId, userId, userColor, activeFileId]);

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
  }, [activeFile, activeFileId]);

  /* =======================================================
     SWITCH FILE
     ======================================================= */

  const switchFile = useCallback(
    (fileId) => {
      setActiveFileId(fileId);
      setOutput([]);

      requestAnimationFrame(() => {
        textareaRef.current?.focus();

        if (textareaRef.current) {
          updateCursorPosition(textareaRef.current);
        }
      });
    },
    [updateCursorPosition],
  );

  /* =======================================================
   ACTUALLY CLOSE FILE
   ======================================================= */

  const performCloseFile = useCallback(
    (fileId) => {
      if (files.length === 1) {
        return;
      }

      const fileIndex = files.findIndex((file) => file.id === fileId);

      const remainingFiles = files.filter((file) => file.id !== fileId);

      setFiles(remainingFiles);

      /* -----------------------------------------------
       If closing active file,
       select another file
       ----------------------------------------------- */

      if (fileId === activeFileId) {
        const nextIndex = Math.max(0, fileIndex - 1);

        const nextFile = remainingFiles[nextIndex];

        if (nextFile) {
          setActiveFileId(nextFile.id);
        }
      }

      /* Clear pending close state */

      setFilePendingClose(null);
      setShowUnsavedModal(false);
    },
    [files, activeFileId],
  );

  /* =======================================================
   REQUEST CLOSE FILE
   ======================================================= */

  const closeFile = useCallback(
    (event, fileId) => {
      event.stopPropagation();

      /* -----------------------------------------------
       Keep at least one file open
       ----------------------------------------------- */

      if (files.length === 1) {
        return;
      }

      const fileToClose = files.find((file) => file.id === fileId);

      if (!fileToClose) {
        return;
      }

      /* -----------------------------------------------
       Check for unsaved changes
       ----------------------------------------------- */

      const hasUnsavedChanges = fileToClose.code !== fileToClose.savedCode;

      if (hasUnsavedChanges) {
        setFilePendingClose(fileId);
        setShowUnsavedModal(true);
        return;
      }

      /* -----------------------------------------------
       No unsaved changes → close immediately
       ----------------------------------------------- */

      performCloseFile(fileId);
    },
    [files],
  );

  /* =======================================================
   CANCEL CLOSE
   ======================================================= */

  const cancelCloseFile = useCallback(() => {
    setFilePendingClose(null);
    setShowUnsavedModal(false);
  }, []);

  /* =======================================================
   CLOSE WITHOUT SAVING
   ======================================================= */

  const discardAndCloseFile = useCallback(() => {
    if (!filePendingClose) {
      return;
    }

    performCloseFile(filePendingClose);
  }, [filePendingClose, performCloseFile]);

  /* =======================================================
   SAVE AND CLOSE
   ======================================================= */

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
   DUPLICATE CURRENT FILE
   ======================================================= */

  const duplicateCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    const baseName = activeFile.name.includes(".")
      ? activeFile.name.substring(0, activeFile.name.lastIndexOf("."))
      : activeFile.name;

    const extension = activeFile.name.includes(".")
      ? activeFile.name.substring(activeFile.name.lastIndexOf("."))
      : "";

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
  }, [activeFile, files]);

  /* =======================================================
   REQUEST DELETE FILE
   ======================================================= */

  const requestDeleteCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    /* Keep at least one file */
    if (files.length === 1) {
      return;
    }

    setFilePendingDelete(activeFile.id);
    setShowDeleteModal(true);
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
    if (!filePendingDelete) {
      return;
    }

    if (files.length === 1) {
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
      const nextIndex = Math.max(0, fileIndex - 1);

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
     OPEN NEW FILE MODAL
     ======================================================= */

  const openNewFileModal = useCallback(() => {
    setNewFileName("");
    setShowNewFileModal(true);
  }, []);

  /* =======================================================
   OPEN RENAME MODAL
   ======================================================= */

  const openRenameModal = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setRenameFileName(activeFile.name);
    setShowRenameModal(true);
  }, [activeFile]);

  /* =======================================================
   CLOSE RENAME MODAL
   ======================================================= */

  const closeRenameModal = useCallback(() => {
    setShowRenameModal(false);
    setRenameFileName("");
  }, []);

  /* =======================================================
   RENAME CURRENT FILE
   ======================================================= */

  const renameCurrentFile = useCallback(() => {
    if (!activeFile) {
      return;
    }

    const trimmedName = renameFileName.trim();

    if (!trimmedName) {
      return;
    }

    /* -----------------------------------------------
     Don't rename if the name hasn't changed
     ----------------------------------------------- */

    if (trimmedName === activeFile.name) {
      closeRenameModal();
      return;
    }

    /* -----------------------------------------------
     Prevent duplicate file names
     ----------------------------------------------- */

    const alreadyExists = files.some(
      (file) =>
        file.id !== activeFile.id &&
        file.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (alreadyExists) {
      return;
    }

    /* -----------------------------------------------
     Detect new language
     ----------------------------------------------- */

    const newLanguage = getLanguageFromFileName(trimmedName);

    /* -----------------------------------------------
     Update file
     ----------------------------------------------- */

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === activeFile.id
          ? {
              ...file,
              name: trimmedName,
              language: newLanguage,
            }
          : file,
      ),
    );

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
     CLOSE NEW FILE MODAL
     ======================================================= */

  const closeNewFileModal = useCallback(() => {
    setShowNewFileModal(false);
    setNewFileName("");
  }, []);

  /* =======================================================
     CREATE NEW FILE
     ======================================================= */

  const createNewFile = useCallback(() => {
    const trimmedName = newFileName.trim();

    if (!trimmedName) {
      return;
    }

    /* Prevent duplicate file names */
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

    setNewFileName("");
    setShowNewFileModal(false);

    setOutput([]);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [files, newFileName]);

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
   LINE NUMBER SCROLL SYNCHRONIZATION
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

    // The remote cursor is an overlay, so it must use the same
    // scroll offsets as the textarea.
    setEditorScroll({
      top: textarea.scrollTop,
      left: textarea.scrollLeft,
    });
  }, []);

  /* =======================================================
   KEYBOARD HANDLING
   ======================================================= */

  const handleEditorKeyDown = useCallback(
    (event) => {
      const textarea = event.currentTarget;

      /* ---------------------------------------------------
       SKIP EXISTING CLOSING CHARACTER
       --------------------------------------------------- */

      const closingCharacters = {
        ")": ")",
        "]": "]",
        "}": "}",
        '"': '"',
        "'": "'",
        "`": "`",
      };

      if (
        closingCharacters[event.key] &&
        textarea.selectionStart === textarea.selectionEnd
      ) {
        const cursorPosition = textarea.selectionStart;
        const value = textarea.value;

        const nextCharacter = value[cursorPosition];

        if (nextCharacter === event.key) {
          event.preventDefault();

          const newPosition = cursorPosition + 1;

          textarea.selectionStart = newPosition;
          textarea.selectionEnd = newPosition;

          updateCursorPosition(textarea);

          return;
        }
      }

      /* ---------------------------------------------------
       CTRL + S / CMD + S
       --------------------------------------------------- */

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        saveCurrentFile();

        return;
      }

      /* ---------------------------------------------------
   CTRL + / → TOGGLE COMMENT
   --------------------------------------------------- */

      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const value = textarea.value;

        /* -----------------------------------------------
     Detect language
     ----------------------------------------------- */

        const language = activeFile?.language?.toLowerCase() || "javascript";

        let commentPrefix = "//";
        let commentSuffix = "";

        if (language === "python" || language === "py") {
          commentPrefix = "#";
        }

        if (language === "html" || language === "xml") {
          commentPrefix = "<!--";
          commentSuffix = "-->";
        }

        /* -----------------------------------------------
     Find selected line boundaries
     ----------------------------------------------- */

        const selectionStart = value.lastIndexOf("\n", start - 1) + 1;

        const selectionEndIndex = value.indexOf("\n", end);

        const selectionEnd =
          selectionEndIndex === -1 ? value.length : selectionEndIndex;

        const selectedText = value.slice(selectionStart, selectionEnd);

        const lines = selectedText.split("\n");

        /* -----------------------------------------------
     HTML / XML comments
     ----------------------------------------------- */

        if (commentSuffix) {
          const trimmedLines = lines.map((line) => line.trim());

          const allCommented = trimmedLines.every(
            (line) =>
              line.startsWith(commentPrefix) && line.endsWith(commentSuffix),
          );

          let updatedLines;

          if (allCommented) {
            updatedLines = lines.map((line) => {
              const leadingWhitespace = line.match(/^\s*/)?.[0] || "";

              const trimmed = line.trim();

              const uncommented = trimmed
                .slice(
                  commentPrefix.length,
                  trimmed.length - commentSuffix.length,
                )
                .trim();

              return leadingWhitespace + uncommented;
            });
          } else {
            updatedLines = lines.map((line) => {
              const leadingWhitespace = line.match(/^\s*/)?.[0] || "";

              const content = line.trim();

              if (!content) {
                return line;
              }

              return (
                leadingWhitespace +
                commentPrefix +
                " " +
                content +
                " " +
                commentSuffix
              );
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

          return;
        }

        /* -----------------------------------------------
     JavaScript / CSS / Python comments
     ----------------------------------------------- */

        const commentPattern = new RegExp(
          `^(\\s*)${commentPrefix.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          )}(?:\\s)?`,
        );

        const nonEmptyLines = lines.filter((line) => line.trim() !== "");

        const allCommented =
          nonEmptyLines.length > 0 &&
          nonEmptyLines.every((line) => commentPattern.test(line));

        let updatedLines;

        /* -----------------------------------------------
     Uncomment
     ----------------------------------------------- */

        if (allCommented) {
          updatedLines = lines.map((line) =>
            line.replace(commentPattern, "$1"),
          );
        } else {
          /* -----------------------------------------------
     Comment
     ----------------------------------------------- */
          updatedLines = lines.map((line) => {
            const leadingWhitespace = line.match(/^\s*/)?.[0] || "";

            const content = line.slice(leadingWhitespace.length);

            if (!content.trim()) {
              return line;
            }

            return leadingWhitespace + commentPrefix + " " + content;
          });
        }

        const newSelectedText = updatedLines.join("\n");

        const newValue =
          value.substring(0, selectionStart) +
          newSelectedText +
          value.substring(selectionEnd);

        updateFileCode(newValue);

        /* -----------------------------------------------
     Preserve selection
     ----------------------------------------------- */

        requestAnimationFrame(() => {
          if (!textareaRef.current) {
            return;
          }

          textareaRef.current.selectionStart = selectionStart;

          textareaRef.current.selectionEnd =
            selectionStart + newSelectedText.length;

          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      /* ---------------------------------------------------
       SMART BACKSPACE FOR PAIRS
       --------------------------------------------------- */

      if (
        event.key === "Backspace" &&
        textarea.selectionStart === textarea.selectionEnd
      ) {
        const cursorPosition = textarea.selectionStart;

        if (cursorPosition > 0) {
          const value = textarea.value;

          const previousCharacter = value[cursorPosition - 1];
          const nextCharacter = value[cursorPosition];

          const pairedCharacters = {
            "(": ")",
            "[": "]",
            "{": "}",
            '"': '"',
            "'": "'",
            "`": "`",
          };

          if (pairedCharacters[previousCharacter] === nextCharacter) {
            event.preventDefault();

            const newValue =
              value.substring(0, cursorPosition - 1) +
              value.substring(cursorPosition + 1);

            updateFileCode(newValue);

            requestAnimationFrame(() => {
              if (!textareaRef.current) {
                return;
              }

              const newPosition = cursorPosition - 1;

              textareaRef.current.selectionStart = newPosition;
              textareaRef.current.selectionEnd = newPosition;

              updateCursorPosition(textareaRef.current);
            });

            return;
          }
        }
      }
      /* ---------------------------------------------------
       SMART BRACKETS & QUOTES
       --------------------------------------------------- */

      const pairedCharacters = {
        "(": ")",
        "[": "]",
        "{": "}",
        '"': '"',
        "'": "'",
        "`": "`",
      };

      if (Object.prototype.hasOwnProperty.call(pairedCharacters, event.key)) {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const value = textarea.value;

        const closingCharacter = pairedCharacters[event.key];

        const selectedText = value.substring(start, end);

        /* -----------------------------------------------
         If selected text exists, wrap it
         ----------------------------------------------- */

        if (start !== end) {
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

        /* -----------------------------------------------
         If cursor is already before the closing
         character, don't create another pair
         ----------------------------------------------- */

        if (value[start] === closingCharacter) {
          textarea.selectionStart = start + 1;
          textarea.selectionEnd = start + 1;

          updateCursorPosition(textarea);

          return;
        }

        /* -----------------------------------------------
         Normal pair insertion
         ----------------------------------------------- */

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

          const newPosition = start + 1;

          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;

          updateCursorPosition(textareaRef.current);
        });

        return;
      }

      /* ---------------------------------------------------
   TAB / SHIFT + TAB
   --------------------------------------------------- */

      if (event.key === "Tab") {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const value = textarea.value;

        const indentation = "  ";

        /* =================================================
     SHIFT + TAB
     REMOVE INDENTATION
     ================================================= */

        if (event.shiftKey) {
          /* -----------------------------------------------
       If text is selected, process all selected lines
       ----------------------------------------------- */

          if (start !== end) {
            const selectionStart = value.lastIndexOf("\n", start - 1) + 1;

            const selectionEndIndex = value.indexOf("\n", end);

            const selectionEnd =
              selectionEndIndex === -1 ? value.length : selectionEndIndex;

            const selectedText = value.slice(selectionStart, selectionEnd);

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

              const newSelectionStart = Math.max(selectionStart, start - 2);

              const newSelectionEnd = Math.max(
                newSelectionStart,
                end - removedCharacters,
              );

              textareaRef.current.selectionStart = newSelectionStart;

              textareaRef.current.selectionEnd = newSelectionEnd;

              updateCursorPosition(textareaRef.current);
            });

            return;
          }

          /* -----------------------------------------------
       No selection → remove indentation from
       current line
       ----------------------------------------------- */

          const lineStart = value.lastIndexOf("\n", start - 1) + 1;

          const lineText = value.slice(
            lineStart,
            Math.min(lineStart + 2, value.length),
          );

          let removeCount = 0;

          if (lineText.startsWith("  ")) {
            removeCount = 2;
          } else if (lineText.startsWith(" ")) {
            removeCount = 1;
          }

          if (removeCount > 0) {
            const newValue =
              value.substring(0, lineStart) +
              value.substring(lineStart + removeCount);

            updateFileCode(newValue);

            requestAnimationFrame(() => {
              if (!textareaRef.current) {
                return;
              }

              const newPosition = Math.max(lineStart, start - removeCount);

              textareaRef.current.selectionStart = newPosition;

              textareaRef.current.selectionEnd = newPosition;

              updateCursorPosition(textareaRef.current);
            });
          }

          return;
        }

        /* =================================================
     TAB
     INSERT INDENTATION
     ================================================= */

        /* -----------------------------------------------
     If text is selected, indent all selected lines
     ----------------------------------------------- */

        if (start !== end) {
          const selectionStart = value.lastIndexOf("\n", start - 1) + 1;

          const selectionEndIndex = value.indexOf("\n", end);

          const selectionEnd =
            selectionEndIndex === -1 ? value.length : selectionEndIndex;

          const selectedText = value.slice(selectionStart, selectionEnd);

          const lines = selectedText.split("\n");

          const updatedLines = lines.map((line) => indentation + line);

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

            const addedCharacters = lines.length * indentation.length;

            textareaRef.current.selectionStart = start + indentation.length;

            textareaRef.current.selectionEnd = end + addedCharacters;

            updateCursorPosition(textareaRef.current);
          });

          return;
        }

        /* -----------------------------------------------
     No selection → normal Tab
     ----------------------------------------------- */

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

      /* ---------------------------------------------------
       ENTER → SMART INDENTATION
       --------------------------------------------------- */

      if (event.key === "Enter") {
        event.preventDefault();

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const value = textarea.value;

        /* -----------------------------------------------
         Find current line
         ----------------------------------------------- */

        const lineStart = value.lastIndexOf("\n", start - 1) + 1;

        const lineEnd = value.indexOf("\n", start);

        const currentLine = value.slice(
          lineStart,
          lineEnd === -1 ? value.length : lineEnd,
        );

        /* -----------------------------------------------
         Current indentation
         ----------------------------------------------- */

        const currentIndent = currentLine.match(/^\s*/)?.[0] || "";

        /* -----------------------------------------------
         Text before cursor
         ----------------------------------------------- */

        const textBeforeCursor = value.slice(lineStart, start);

        /* -----------------------------------------------
         Check for opening block
         ----------------------------------------------- */

        const opensBlock = /[({[]\s*$/.test(textBeforeCursor);

        /* -----------------------------------------------
         Check next character
         ----------------------------------------------- */

        const nextCharacter = value[end];

        const closesBlock =
          nextCharacter === "}" ||
          nextCharacter === "]" ||
          nextCharacter === ")";

        /* -----------------------------------------------
         Calculate next indentation
         ----------------------------------------------- */

        let nextIndent = currentIndent;

        if (opensBlock) {
          nextIndent += "  ";
        }

        /* -----------------------------------------------
         Reduce indentation before closing bracket
         ----------------------------------------------- */

        if (
          closesBlock &&
          !opensBlock &&
          textBeforeCursor.trim() === "" &&
          currentIndent.length >= 2
        ) {
          nextIndent = currentIndent.slice(0, -2);
        }

        /* -----------------------------------------------
         Insert new line
         ----------------------------------------------- */

        const insertedText = "\n" + nextIndent;

        const newValue =
          value.substring(0, start) + insertedText + value.substring(end);

        updateFileCode(newValue);

        /* -----------------------------------------------
         Restore cursor
         ----------------------------------------------- */

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
    },
    [saveCurrentFile, updateFileCode, updateCursorPosition],
  );

  /* =======================================================
     RUN JAVASCRIPT
     ======================================================= */

  const runJavaScript = useCallback(() => {
    try {
      const logs = [];

      const originalConsoleLog = console.log;

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

      try {
        const execute = new Function(activeFile.code);

        execute();
      } finally {
        console.log = originalConsoleLog;
      }

      setOutput(logs.length ? logs : ["Code executed successfully."]);
    } catch (error) {
      setOutput([`Error: ${error.message}`]);
    }
  }, [activeFile]);

  /* =======================================================
     RUN CODE
     ======================================================= */

  const runCode = useCallback(() => {
    if (!activeFile) {
      return;
    }

    setOutput([]);

    /* JavaScript */
    if (activeFile.language === "JavaScript") {
      runJavaScript();
      return;
    }

    /* Python */
    if (activeFile.language === "Python") {
      setOutput([
        "Python execution is not connected yet.",
        "",
        "A Python backend/runtime will be added in a later sequence.",
      ]);

      return;
    }

    /* HTML */
    if (activeFile.language === "HTML") {
      setOutput(["HTML preview will be added in a later sequence."]);

      return;
    }

    /* CSS */
    if (activeFile.language === "CSS") {
      setOutput(["CSS preview will be added in a later sequence."]);

      return;
    }

    /* JSON */
    if (activeFile.language === "JSON") {
      try {
        JSON.parse(activeFile.code);

        setOutput(["Valid JSON."]);
      } catch (error) {
        setOutput([`Invalid JSON: ${error.message}`]);
      }

      return;
    }

    /* Other languages */
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
     ESCAPE → CLOSE MODAL
     ======================================================= */

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && showNewFileModal) {
        closeNewFileModal();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showNewFileModal, closeNewFileModal]);

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
                    setShowFileMenu(false);
                    openRenameModal();
                  }}
                >
                  <span>✏</span>
                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowFileMenu(false);
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
                    setShowFileMenu(false);
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

        {/* NEW FILE BUTTON */}

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
          EDITOR INFO BAR
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
        {/* LINE NUMBERS */}

        <div ref={lineNumbersRef} className="line-numbers">
          {lineNumbers.map((number) => (
            <div key={number} className="line-number">
              {number}
            </div>
          ))}
        </div>

        {/* TEXT EDITOR */}

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
            {/* MODAL HEADER */}

            <div className="new-file-modal-header">
              <h3>Create New File</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={closeNewFileModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}

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

                  if (event.key === "Escape") {
                    closeNewFileModal();
                  }
                }}
                placeholder="e.g. app.py"
                autoFocus
              />
            </div>

            {/* MODAL ACTIONS */}

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
    RENAME FILE MODAL
    ================================================= */}

      {showRenameModal && (
        <div className="new-file-modal-overlay" onMouseDown={closeRenameModal}>
          <div
            className="new-file-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* MODAL HEADER */}

            <div className="new-file-modal-header">
              <h3>Rename File</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={closeRenameModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}

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

                  if (event.key === "Escape") {
                    closeRenameModal();
                  }
                }}
                autoFocus
                spellCheck={false}
              />

              <small>
                The language will be detected from the file extension.
              </small>
            </div>

            {/* MODAL ACTIONS */}

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
            {/* MODAL HEADER */}

            <div className="new-file-modal-header">
              <h3>Unsaved Changes</h3>

              <button
                type="button"
                className="new-file-modal-close"
                onClick={cancelCloseFile}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="new-file-modal-body">
              <p>This file has unsaved changes.</p>

              <p>Do you want to save your changes before closing?</p>
            </div>

            {/* MODAL ACTIONS */}

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

              <button
                type="button"
                className="new-file-modal-close"
                onClick={cancelDeleteFile}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="new-file-modal-body">
              <p>
                Are you sure you want to delete
                <strong> {activeFile?.name}</strong>?
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