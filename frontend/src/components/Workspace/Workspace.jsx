import { useCallback, useEffect, useRef, useState } from "react";
import CodeEditor from "./CodeEditor/CodeEditor";
import "./Workspace.css";

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

    for (let i = 1; i < shape.points.length; i += 1) {
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
    const x = Math.min(
      shape.startX,
      shape.endX
    );

    const y = Math.min(
      shape.startY,
      shape.endY
    );

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
      Math.abs(
        shape.endX - shape.startX
      ) / 2;

    const radiusY =
      Math.abs(
        shape.endY - shape.startY
      ) / 2;

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
      onClick={() => onSelect(value)}
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

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr =
      window.devicePixelRatio || 1;

    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width =
      `${width}px`;

    canvas.style.height =
      `${height}px`;

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

    /*
      Keep zoom centered around
      the middle of the canvas.
    */

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
     GET POINTER POSITION
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
        (rawX - centerX) /
          zoom +
        centerX,

      y:
        (rawY - centerY) /
          zoom +
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

    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(
        event.pointerId
      );
    }

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

  const handlePointerUp = (event) => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;

    if (
      canvasRef.current &&
      canvasRef.current.hasPointerCapture(
        event.pointerId
      )
    ) {
      canvasRef.current.releasePointerCapture(
        event.pointerId
      );
    }

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
                Math.abs(
                  p.x - point.x
                ) < eraserSize &&
                Math.abs(
                  p.y - point.y
                ) < eraserSize
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
              point.x >=
                minX - eraserSize &&
              point.x <=
                maxX + eraserSize &&
              point.y >=
                minY - eraserSize &&
              point.y <=
                maxY + eraserSize
            );
          }

          return true;
        }
      );

    shapesRef.current =
      filtered;

    setHasDrawing(
      filtered.length > 0
    );

    redraw();
  };


  /* =====================================================
     UNDO
     ===================================================== */

  const undo = () => {
    if (
      shapesRef.current.length === 0
    ) {
      return;
    }

    const copy = [
      ...shapesRef.current,
    ];

    const removed =
      copy.pop();

    shapesRef.current =
      copy;

    setRedoStack(
      (prev) => [
        ...prev,
        removed,
      ]
    );

    setHasDrawing(
      copy.length > 0
    );

    redraw();
  };


  /* =====================================================
     REDO
     ===================================================== */

  const redo = () => {
    if (
      redoStack.length === 0
    ) {
      return;
    }

    const copy = [
      ...redoStack,
    ];

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
     CLEAR CANVAS
     ===================================================== */

  const clearCanvas = () => {
    if (
      shapesRef.current.length === 0
    ) {
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
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            handlePointerUp
          }
          onPointerCancel={
            handlePointerUp
          }
          onPointerLeave={
            handlePointerUp
          }
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
              Draw, sketch, and share
              ideas with your team.
            </p>

            <button
              type="button"
              className="start-drawing-button"
              onClick={() => {
                setHasDrawing(true);
                setTool("pen");
              }}
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
            {Math.round(
              zoom * 100
            )}%
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

        {/* WHITEBOARD */}

        <div className="panel whiteboard-panel">
          <Whiteboard />
        </div>


        {/* CODE EDITOR */}

        <div className="panel code-panel">
          <CodeEditor />
        </div>

      </div>

    </section>
  );
}

export default Workspace;