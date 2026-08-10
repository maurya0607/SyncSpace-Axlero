import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./Workspace.css";

/* =========================================================
   FILE HELPERS
   ========================================================= */

const getLanguage = (fileName) => {
  const extension = fileName
    .split(".")
    .pop()
    .toLowerCase();

  const languages = {
    js: "JavaScript",
    jsx: "JavaScript",
    ts: "TypeScript",
    tsx: "TypeScript",
    html: "HTML",
    htm: "HTML",
    css: "CSS",
    py: "Python",
    java: "Java",
    c: "C",
    h: "C",
    cpp: "C++",
    cc: "C++",
    cxx: "C++",
    json: "JSON",
    sql: "SQL",
    md: "Markdown",
  };

  return languages[extension] || "Plain Text";
};


const getFileIcon = (fileName) => {
  const extension = fileName
    .split(".")
    .pop()
    .toLowerCase();

  switch (extension) {
    case "js":
    case "jsx":
      return "JS";

    case "ts":
    case "tsx":
      return "TS";

    case "py":
      return "PY";

    case "html":
    case "htm":
      return "<>";

    case "css":
      return "#";

    case "java":
      return "JV";

    case "c":
      return "C";

    case "cpp":
    case "cc":
    case "cxx":
      return "C++";

    case "json":
      return "{}";

    case "sql":
      return "DB";

    case "md":
      return "MD";

    default:
      return "TXT";
  }
};


/* =========================================================
   DEFAULT FILE
   ========================================================= */

const defaultFiles = [
  {
    id: 1,
    name: "index.js",
    language: "JavaScript",
    code: `function hello() {
  console.log("Hello SyncSpace!");
}`,
  },
];


/* =========================================================
   DRAW SHAPE
   ========================================================= */

const drawShape = (ctx, shape) => {
  if (!shape) {
    return;
  }

  ctx.save();

  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "transparent";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* ---------------- PEN ---------------- */

  if (shape.type === "pen") {
    if (!shape.points || shape.points.length === 0) {
      ctx.restore();
      return;
    }

    ctx.beginPath();

    ctx.moveTo(
      shape.points[0].x,
      shape.points[0].y
    );

    for (
      let i = 1;
      i < shape.points.length;
      i += 1
    ) {
      ctx.lineTo(
        shape.points[i].x,
        shape.points[i].y
      );
    }

    ctx.stroke();

    ctx.restore();
    return;
  }


  /* ---------------- RECTANGLE ---------------- */

  if (shape.type === "rectangle") {
    const x = Math.min(shape.startX, shape.endX);
    const y = Math.min(shape.startY, shape.endY);

    const width = Math.abs(
      shape.endX - shape.startX
    );

    const height = Math.abs(
      shape.endY - shape.startY
    );

    ctx.strokeRect(
      x,
      y,
      width,
      height
    );

    ctx.restore();
    return;
  }


  /* ---------------- CIRCLE ---------------- */

  if (shape.type === "circle") {
    const radiusX =
      Math.abs(shape.endX - shape.startX) / 2;

    const radiusY =
      Math.abs(shape.endY - shape.startY) / 2;

    const centerX =
      (shape.startX + shape.endX) / 2;

    const centerY =
      (shape.startY + shape.endY) / 2;

    const radius =
      Math.max(radiusX, radiusY);

    ctx.beginPath();

    ctx.arc(
      centerX,
      centerY,
      radius,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();
    return;
  }

  ctx.restore();
};


/* =========================================================
   TOOL BUTTON
   ========================================================= */

function ToolButton({
  value,
  title,
  activeTool,
  onSelect,
  children,
}) {
  return (
    <button
      type="button"
      className={`tool-button ${
        activeTool === value
          ? "active"
          : ""
      }`}
      onClick={() =>
        onSelect(value)
      }
      title={title}
    >
      {children}
    </button>
  );
}


/* =========================================================
   WHITEBOARD
   ========================================================= */

function Whiteboard() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const drawingRef = useRef(false);
  const currentShapeRef = useRef(null);
  const shapesRef = useRef([]);

  const [tool, setTool] = useState("pen");
  const [zoom, setZoom] = useState(1);
  const [hasDrawing, setHasDrawing] = useState(false);

  const [redoStack, setRedoStack] = useState([]);


  /* =====================================================
     REDRAW CANVAS
     ===================================================== */

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const rect =
      container.getBoundingClientRect();

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr =
      window.devicePixelRatio || 1;

    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    ctx.save();

    ctx.translate(
      width / 2,
      height / 2
    );

    ctx.scale(
      zoom,
      zoom
    );

    ctx.translate(
      -width / 2,
      -height / 2
    );

    shapesRef.current.forEach(
      (shape) => {
        drawShape(ctx, shape);
      }
    );

    if (currentShapeRef.current) {
      drawShape(
        ctx,
        currentShapeRef.current
      );
    }

    ctx.restore();
  }, [zoom]);


  /* =====================================================
     RESIZE OBSERVER
     ===================================================== */

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return undefined;
    }

    redraw();

    const observer =
      new ResizeObserver(() => {
        redraw();
      });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [redraw]);


  /* =====================================================
     GET CANVAS POSITION
     ===================================================== */

  const getPointerPosition = (event) => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    const rawX =
      event.clientX - rect.left;

    const rawY =
      event.clientY - rect.top;

    const centerX =
      rect.width / 2;

    const centerY =
      rect.height / 2;

    return {
      x:
        (rawX - centerX) / zoom +
        centerX,

      y:
        (rawY - centerY) / zoom +
        centerY,
    };
  };


  /* =====================================================
     POINTER DOWN
     ===================================================== */

  const handlePointerDown = (event) => {
    if (tool === "eraser") {
      eraseAtPosition(event);
      return;
    }

    const point =
      getPointerPosition(event);

    drawingRef.current = true;

    if (tool === "pen") {
      currentShapeRef.current = {
        type: "pen",
        points: [point],
      };
    }

    if (
      tool === "rectangle" ||
      tool === "circle"
    ) {
      currentShapeRef.current = {
        type: tool,
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
      };
    }

    redraw();
  };


  /* =====================================================
     POINTER MOVE
     ===================================================== */

  const handlePointerMove = (event) => {
    if (!drawingRef.current) {
      return;
    }

    const point =
      getPointerPosition(event);

    const current =
      currentShapeRef.current;

    if (!current) {
      return;
    }

    if (current.type === "pen") {
      current.points.push(point);
    }

    if (
      current.type === "rectangle" ||
      current.type === "circle"
    ) {
      current.endX = point.x;
      current.endY = point.y;
    }

    redraw();
  };


  /* =====================================================
     POINTER UP
     ===================================================== */

  const handlePointerUp = () => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;

    const completedShape =
      currentShapeRef.current;

    if (
      completedShape &&
      (
        completedShape.type === "pen"
          ? completedShape.points.length > 1
          : true
      )
    ) {
      shapesRef.current.push(
        completedShape
      );

      setHasDrawing(true);

      setRedoStack([]);
    }

    currentShapeRef.current = null;

    redraw();
  };


  /* =====================================================
     ERASER
     ===================================================== */

  const eraseAtPosition = (event) => {
    const point =
      getPointerPosition(event);

    const eraserSize = 30;

    const filtered =
      shapesRef.current.filter(
        (shape) => {
          if (shape.type === "pen") {
            return !shape.points.some(
              (p) =>
                Math.abs(p.x - point.x) <
                  eraserSize &&
                Math.abs(p.y - point.y) <
                  eraserSize
            );
          }

          if (
            shape.type === "rectangle" ||
            shape.type === "circle"
          ) {
            const minX =
              Math.min(
                shape.startX,
                shape.endX
              );

            const maxX =
              Math.max(
                shape.startX,
                shape.endX
              );

            const minY =
              Math.min(
                shape.startY,
                shape.endY
              );

            const maxY =
              Math.max(
                shape.startY,
                shape.endY
              );

            return !(
              point.x >= minX - eraserSize &&
              point.x <= maxX + eraserSize &&
              point.y >= minY - eraserSize &&
              point.y <= maxY + eraserSize
            );
          }

          return true;
        }
      );

    shapesRef.current = filtered;

    setHasDrawing(
      filtered.length > 0
    );

    redraw();
  };


  /* =====================================================
     UNDO
     ===================================================== */

  const undo = () => {
    if (shapesRef.current.length === 0) {
      return;
    }

    const copy =
      [...shapesRef.current];

    const removed =
      copy.pop();

    shapesRef.current = copy;

    setRedoStack((prev) => [
      ...prev,
      removed,
    ]);

    setHasDrawing(
      copy.length > 0
    );

    redraw();
  };


  /* =====================================================
     REDO
     ===================================================== */

  const redo = () => {
    if (redoStack.length === 0) {
      return;
    }

    const copy =
      [...redoStack];

    const restored =
      copy.pop();

    shapesRef.current.push(
      restored
    );

    setRedoStack(copy);

    setHasDrawing(true);

    redraw();
  };


  /* =====================================================
     CLEAR
     ===================================================== */

  const clearCanvas = () => {
    if (shapesRef.current.length === 0) {
      return;
    }

    setRedoStack(
      (prev) => [
        ...prev,
        ...shapesRef.current,
      ]
    );

    shapesRef.current = [];

    currentShapeRef.current = null;

    setHasDrawing(false);

    redraw();
  };


  /* =====================================================
     ZOOM
     ===================================================== */

  const zoomIn = () => {
    setZoom(
      (prev) =>
        Math.min(
          prev + 0.1,
          2
        )
    );
  };


  const zoomOut = () => {
    setZoom(
      (prev) =>
        Math.max(
          prev - 0.1,
          0.5
        )
    );
  };


  const resetZoom = () => {
    setZoom(1);
  };


  /* =====================================================
     WHITEBOARD UI
     ===================================================== */

  return (
    <div className="whiteboard">

      {/* HEADER */}

      <div className="panel-header">

        <div className="panel-title">

          <div className="panel-icon">
            ✦
          </div>

          <div>
            <h2>
              Whiteboard
            </h2>

            <span>
              Collaborative canvas
            </span>
          </div>

        </div>

        <button
          type="button"
          className="panel-menu"
          title="Whiteboard menu"
        >
          ...
        </button>

      </div>


      {/* TOOLBAR */}

      <div className="whiteboard-toolbar">

        <ToolButton
          value="pen"
          title="Pen"
          activeTool={tool}
          onSelect={setTool}
        >
          🖊
        </ToolButton>


        <ToolButton
          value="eraser"
          title="Eraser"
          activeTool={tool}
          onSelect={setTool}
        >
          ⌫
        </ToolButton>


        <ToolButton
          value="rectangle"
          title="Rectangle"
          activeTool={tool}
          onSelect={setTool}
        >
          □
        </ToolButton>


        <ToolButton
          value="circle"
          title="Circle"
          activeTool={tool}
          onSelect={setTool}
        >
          ○
        </ToolButton>


        <div className="toolbar-divider" />


        <button
          type="button"
          className="tool-button"
          onClick={undo}
          title="Undo"
        >
          ↶
        </button>


        <button
          type="button"
          className="tool-button"
          onClick={redo}
          title="Redo"
        >
          ↷
        </button>


        <button
          type="button"
          className="tool-button"
          onClick={clearCanvas}
          title="Clear"
        >
          ♲
        </button>

      </div>


      {/* CANVAS */}

      <div
        ref={containerRef}
        className="whiteboard-canvas-container"
      >

        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />


        {/* EMPTY STATE */}

        {!hasDrawing && (
          <div className="canvas-message">

            <div className="canvas-icon">
              ✦
            </div>

            <h3>
              Start collaborating
            </h3>

            <p>
              Draw, sketch, and share ideas
              with your team.
            </p>

            <button
              type="button"
              className="start-drawing-button"
              onClick={() =>
                setTool("pen")
              }
            >
              Start drawing
            </button>

          </div>
        )}


        {/* ZOOM */}

        <div className="zoom-controls">

          <button
            type="button"
            onClick={zoomOut}
          >
            −
          </button>

          <button
            type="button"
            className="zoom-value"
            onClick={resetZoom}
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
          >
            +
          </button>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   CODE EDITOR
   ========================================================= */

function CodeEditor() {
  const [files, setFiles] =
    useState(defaultFiles);

  const [activeFileId, setActiveFileId] =
    useState(1);

  const [showNewFile, setShowNewFile] =
    useState(false);

  const [newFileName, setNewFileName] =
    useState("");

  const [output, setOutput] =
    useState("");

  const [isRunning, setIsRunning] =
    useState(false);

  const [saved, setSaved] =
    useState(true);

  const textareaRef =
    useRef(null);


  /* =====================================================
     ACTIVE FILE
     ===================================================== */

  const activeFile =
    files.find(
      (file) =>
        file.id === activeFileId
    ) || files[0];


  /* =====================================================
     CREATE FILE
     ===================================================== */

  const createNewFile = () => {
    const name =
      newFileName.trim();

    if (!name) {
      return;
    }

    const alreadyExists =
      files.some(
        (file) =>
          file.name.toLowerCase() ===
          name.toLowerCase()
      );

    if (alreadyExists) {
      return;
    }

    const newFile = {
      id: Date.now(),
      name,
      language: getLanguage(name),
      code: "",
    };

    setFiles((prev) => [
      ...prev,
      newFile,
    ]);

    setActiveFileId(
      newFile.id
    );

    setNewFileName("");

    setShowNewFile(false);

    setSaved(true);

    setOutput("");
  };


  /* =====================================================
     CLOSE FILE
     ===================================================== */

  const closeFile = (id) => {
    if (files.length === 1) {
      return;
    }

    const index =
      files.findIndex(
        (file) =>
          file.id === id
      );

    const remainingFiles =
      files.filter(
        (file) =>
          file.id !== id
      );

    setFiles(remainingFiles);

    if (activeFileId === id) {
      const nextFile =
        remainingFiles[
          Math.max(
            0,
            index - 1
          )
        ];

      setActiveFileId(
        nextFile.id
      );
    }

    setOutput("");
  };


  /* =====================================================
     UPDATE CODE
     ===================================================== */

  const updateFileCode = (value) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === activeFileId
          ? {
              ...file,
              code: value,
            }
          : file
      )
    );

    setSaved(false);
  };


  /* =====================================================
     SAVE
     ===================================================== */

  const saveFile = useCallback(() => {
    setSaved(true);
  }, []);


  /* =====================================================
     KEYBOARD SHORTCUTS
     ===================================================== */

  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "s"
        ) {
          event.preventDefault();

          saveFile();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [saveFile]);


  /* =====================================================
     TAB KEY
     ===================================================== */

  const handleEditorKeyDown =
    (event) => {
      if (event.key === "Tab") {
        event.preventDefault();

        const textarea =
          textareaRef.current;

        if (!textarea) {
          return;
        }

        const start =
          textarea.selectionStart;

        const end =
          textarea.selectionEnd;

        const value =
          activeFile.code;

        const newValue =
          value.substring(
            0,
            start
          ) +
          "  " +
          value.substring(end);

        updateFileCode(
          newValue
        );

        requestAnimationFrame(() => {
          textarea.selectionStart =
            start + 2;

          textarea.selectionEnd =
            start + 2;
        });
      }
    };


  /* =====================================================
     RUN JAVASCRIPT
     ===================================================== */

  const runCode = () => {
    if (!activeFile) {
      return;
    }

    setIsRunning(true);

    setOutput("");

    if (
      activeFile.language !==
      "JavaScript"
    ) {
      setOutput(
        `${activeFile.language} execution is not connected yet.\n\nJavaScript execution is currently supported in the browser.`
      );

      setIsRunning(false);

      return;
    }

    try {
      const logs = [];

      const originalLog =
        console.log;

      console.log =
        (...args) => {
          logs.push(
            args
              .map((arg) => {
                if (
                  typeof arg ===
                  "object"
                ) {
                  try {
                    return JSON.stringify(
                      arg,
                      null,
                      2
                    );
                  } catch {
                    return String(arg);
                  }
                }

                return String(arg);
              })
              .join(" ")
          );

          originalLog(...args);
        };

      const result =
        Function(
          activeFile.code
        )();

      console.log =
        originalLog;

      if (logs.length > 0) {
        setOutput(
          logs.join("\n")
        );
      } else if (
        result !== undefined
      ) {
        setOutput(
          String(result)
        );
      } else {
        setOutput(
          "Code executed successfully."
        );
      }
    } catch (error) {
      setOutput(
        `Error: ${error.message}`
      );
    }

    setIsRunning(false);
  };


  /* =====================================================
     LINE NUMBERS
     ===================================================== */

  const codeLines =
    (activeFile?.code || "")
      .split("\n");


  /* =====================================================
     CODE EDITOR UI
     ===================================================== */

  return (
    <div className="code-editor">

      {/* HEADER */}

      <div className="code-editor-header">

        <div className="code-editor-title">

          <div className="editor-icon">
            {"</>"}
          </div>

          <div>
            <h2>
              Code Editor
            </h2>

            <span>
              Collaborative coding
            </span>
          </div>

        </div>


        <div className="editor-actions">

          <button
            type="button"
            className="run-button"
            onClick={runCode}
            disabled={isRunning}
          >
            {isRunning
              ? "Running..."
              : "▶ Run"}
          </button>


          <button
            type="button"
            className="panel-menu"
            title="Code editor menu"
          >
            ...
          </button>

        </div>

      </div>


      {/* FILE TABS */}

      <div className="file-tabs">

        {files.map((file) => (
          <div
            key={file.id}
            className={`file-tab ${
              activeFileId === file.id
                ? "active"
                : ""
            }`}
            onClick={() => {
              setActiveFileId(
                file.id
              );

              setOutput("");
            }}
          >

            <span className="file-language-icon">
              {getFileIcon(
                file.name
              )}
            </span>

            <span className="file-name">
              {file.name}
            </span>

            {files.length > 1 && (
              <button
                type="button"
                className="close-file"
                onClick={(event) => {
                  event.stopPropagation();

                  closeFile(
                    file.id
                  );
                }}
                title="Close file"
              >
                ×
              </button>
            )}

          </div>
        ))}


        <button
          type="button"
          className="new-file-button"
          onClick={() =>
            setShowNewFile(true)
          }
          title="New file"
        >
          +
        </button>

      </div>


      {/* INFO BAR */}

      <div className="editor-info-bar">

        <span>
          {activeFile?.language ||
            "Plain Text"}
        </span>


        <span className="saved-status">

          <span
            className={`saved-dot ${
              saved
                ? ""
                : "unsaved"
            }`}
          />

          {saved
            ? "Saved"
            : "Unsaved changes"}

        </span>

      </div>


      {/* EDITOR */}

      <div className="code-editor-body">

        <div className="line-numbers">

          {codeLines.map(
            (_, index) => (
              <div
                key={index}
                className="line-number"
              >
                {index + 1}
              </div>
            )
          )}

        </div>


        <textarea
          ref={textareaRef}
          className="code-input"
          value={
            activeFile?.code || ""
          }
          onChange={(event) =>
            updateFileCode(
              event.target.value
            )
          }
          onKeyDown={
            handleEditorKeyDown
          }
          spellCheck="false"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Write your code here..."
        />

      </div>


      {/* OUTPUT */}

      {output !== "" && (
        <div className="code-output">

          <div className="output-header">

            <span>
              Output
            </span>

            <button
              type="button"
              onClick={() =>
                setOutput("")
              }
            >
              Clear
            </button>

          </div>

          <pre>
            {output}
          </pre>

        </div>
      )}


      {/* FOOTER */}

      <div className="code-editor-footer">

        <div>
          Ln 1, Col 1
        </div>

        <div className="footer-right">

          <span>
            {activeFile?.language ||
              "Plain Text"}
          </span>

          <span>
            UTF-8
          </span>

          <span>
            Spaces: 2
          </span>

        </div>

      </div>


      {/* NEW FILE MODAL */}

      {showNewFile && (
        <div className="new-file-overlay">

          <div className="new-file-modal">

            <h3>
              Create New File
            </h3>

            <p>
              Enter a file name
              with an extension.
            </p>


            <input
              type="text"
              value={newFileName}
              onChange={(event) =>
                setNewFileName(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
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
                  setShowNewFile(false);

                  setNewFileName("");
                }
              }}
              placeholder="example.js"
              autoFocus
            />


            {newFileName && (
              <div className="file-preview">

                <span>
                  {getFileIcon(
                    newFileName
                  )}
                </span>

                <span>
                  {getLanguage(
                    newFileName
                  )}
                </span>

              </div>
            )}


            <div className="new-file-actions">

              <button
                type="button"
                className="cancel-file-button"
                onClick={() => {
                  setShowNewFile(false);

                  setNewFileName("");
                }}
              >
                Cancel
              </button>


              <button
                type="button"
                className="create-file-button"
                onClick={
                  createNewFile
                }
              >
                Create File
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


/* =========================================================
   MAIN WORKSPACE
   ========================================================= */

function Workspace() {
  return (
    <section className="workspace">

      {/* WORKSPACE HEADER */}

      <div className="workspace-header">

        <div>
          <h1>
            Collaborative Workspace
          </h1>

          <p>
            Work together in real time
          </p>
        </div>


        <div className="workspace-status">
          <span className="status-dot" />
          Online
        </div>

      </div>


      {/* WORKSPACE CONTENT */}

      <div className="workspace-content">

        <div className="panel whiteboard-panel">
          <Whiteboard />
        </div>


        <div className="panel code-panel">
          <CodeEditor />
        </div>

      </div>

    </section>
  );
}


export default Workspace;