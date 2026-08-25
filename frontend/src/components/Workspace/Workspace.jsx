import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import CodeEditor from "./CodeEditor/CodeEditor";

import "./Workspace.css";

import { useCollaborativeRoom } from "../../lib/useCollaborativeRoom";

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
        activeTool === value ? "active" : ""
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

function Whiteboard({
  yShapes,
  collaborationStatus,
  awareness,
  updateAwareness,
}) {
  /* =======================================================
     REFS
     ======================================================= */

  const canvasRef = useRef(null);

  const containerRef = useRef(null);

  const drawingRef = useRef(false);

  const currentShapeRef = useRef(null);

  const shapesRef = useRef([]);

  const movingRef = useRef(false);

  const moveOriginRef = useRef(null);

  const lastAwarenessSentRef = useRef(0);

  /* =======================================================
     STATE
     ======================================================= */

  const [tool, setTool] = useState("pen");

  const [zoom, setZoom] = useState(1);

  const [hasDrawing, setHasDrawing] = useState(false);

  const [redoStack, setRedoStack] = useState([]);

  const [selectedShapeId, setSelectedShapeId] =
    useState(null);

  /*
   * Store the canvas size in state so remote cursor
   * rendering never reads containerRef.current during
   * React render.
   */
  const [canvasSize, setCanvasSize] = useState({
    width: 0,
    height: 0,
  });

  /* =======================================================
     CREATE SHAPE ID
     ======================================================= */

  const createShapeId = () => {
    return `shape-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  };

  /* =======================================================
     SHAPE BOUNDS
     ======================================================= */

  const getShapeBounds = (shape) => {
    if (!shape) {
      return null;
    }

    if (shape.type === "pen") {
      if (!shape.points?.length) {
        return null;
      }

      const xs = shape.points.map(
        (point) => point.x
      );

      const ys = shape.points.map(
        (point) => point.y
      );

      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }

    if (
      shape.type === "rectangle" ||
      shape.type === "circle"
    ) {
      return {
        minX: Math.min(
          shape.startX,
          shape.endX
        ),
        minY: Math.min(
          shape.startY,
          shape.endY
        ),
        maxX: Math.max(
          shape.startX,
          shape.endX
        ),
        maxY: Math.max(
          shape.startY,
          shape.endY
        ),
      };
    }

    return null;
  };

  /* =======================================================
     HIT TEST
     ======================================================= */

  const hitTestShape = (
    shape,
    point,
    padding = 10
  ) => {
    const bounds = getShapeBounds(shape);

    if (!bounds) {
      return false;
    }

    return (
      point.x >= bounds.minX - padding &&
      point.x <= bounds.maxX + padding &&
      point.y >= bounds.minY - padding &&
      point.y <= bounds.maxY + padding
    );
  };

  /* =======================================================
     DRAW SHAPE
     ======================================================= */

  const drawShape = useCallback(
    (ctx, shape) => {
      if (!shape) {
        return;
      }

      ctx.save();

      ctx.strokeStyle = "#E6E7EB";

      ctx.fillStyle = "transparent";

      ctx.lineWidth = 2.5;

      ctx.lineCap = "round";

      ctx.lineJoin = "round";

      /* =================================================
         SELECTION
         ================================================= */

      if (
        shape.id &&
        shape.id === selectedShapeId
      ) {
        const bounds =
          getShapeBounds(shape);

        if (bounds) {
          ctx.save();

          ctx.setLineDash([6, 4]);

          ctx.strokeStyle = "#7c3aed";

          ctx.lineWidth = 1.5;

          ctx.strokeRect(
            bounds.minX - 6,
            bounds.minY - 6,
            Math.max(
              1,
              bounds.maxX -
                bounds.minX +
                12
            ),
            Math.max(
              1,
              bounds.maxY -
                bounds.minY +
                12
            )
          );

          ctx.restore();
        }
      }

      /* =================================================
         PEN
         ================================================= */

      if (shape.type === "pen") {
        if (
          !shape.points ||
          shape.points.length === 0
        ) {
          ctx.restore();
          return;
        }

        ctx.beginPath();

        ctx.moveTo(
          shape.points[0].x,
          shape.points[0].y
        );

        for (
          let index = 1;
          index < shape.points.length;
          index += 1
        ) {
          ctx.lineTo(
            shape.points[index].x,
            shape.points[index].y
          );
        }

        ctx.stroke();

        ctx.restore();

        return;
      }

      /* =================================================
         RECTANGLE
         ================================================= */

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
          shape.endX -
            shape.startX
        );

        const height = Math.abs(
          shape.endY -
            shape.startY
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

      /* =================================================
         CIRCLE
         ================================================= */

      if (shape.type === "circle") {
        const radiusX =
          Math.abs(
            shape.endX -
              shape.startX
          ) / 2;

        const radiusY =
          Math.abs(
            shape.endY -
              shape.startY
          ) / 2;

        const centerX =
          (shape.startX +
            shape.endX) /
          2;

        const centerY =
          (shape.startY +
            shape.endY) /
          2;

        const radius = Math.max(
          radiusX,
          radiusY
        );

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
    },
    [selectedShapeId]
  );

  /* =======================================================
     RESIZE CANVAS
     ======================================================= */

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;

    const container =
      containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const rect =
      container.getBoundingClientRect();

    const dpr =
      window.devicePixelRatio || 1;

    const width = Math.max(
      1,
      Math.floor(rect.width)
    );

    const height = Math.max(
      1,
      Math.floor(rect.height)
    );

    const targetWidth =
      Math.floor(width * dpr);

    const targetHeight =
      Math.floor(height * dpr);

    if (
      canvas.width !==
        targetWidth ||
      canvas.height !==
        targetHeight
    ) {
      canvas.width =
        targetWidth;

      canvas.height =
        targetHeight;
    }

    canvas.style.width =
      `${width}px`;

    canvas.style.height =
      `${height}px`;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }, []);

  /* =======================================================
     REDRAW
     ======================================================= */

  const redraw = useCallback(() => {
    const canvas =
      canvasRef.current;

    const container =
      containerRef.current;

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

    /* =================================================
       APPLY ZOOM
       ================================================= */

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

    /* =================================================
       DRAW COMMITTED SHAPES
       ================================================= */

    shapesRef.current.forEach(
      (shape) => {
        drawShape(
          ctx,
          shape
        );
      }
    );

    /* =================================================
       DRAW CURRENT SHAPE
       ================================================= */

    if (
      currentShapeRef.current
    ) {
      drawShape(
        ctx,
        currentShapeRef.current
      );
    }

    ctx.restore();
  }, [zoom, drawShape]);

  /* =======================================================
     YJS → CANVAS
     ======================================================= */

  useEffect(() => {
    if (!yShapes) {
      return undefined;
    }

    const syncFromYjs = () => {
      const sharedShapes =
        yShapes.toArray();

      shapesRef.current =
        sharedShapes;

      setHasDrawing(
        sharedShapes.length > 0
      );

      if (
        selectedShapeId &&
        !sharedShapes.some(
          (shape) =>
            shape?.id ===
            selectedShapeId
        )
      ) {
        setSelectedShapeId(null);
      }

      requestAnimationFrame(
        () => {
          redraw();
        }
      );
    };

    syncFromYjs();

    yShapes.observe(
      syncFromYjs
    );

    return () => {
      yShapes.unobserve(
        syncFromYjs
      );
    };
  }, [
    yShapes,
    redraw,
    selectedShapeId,
  ]);

  /* =======================================================
     COMMIT SHAPES TO YJS
     ======================================================= */

  const commitShapes =
    useCallback(
      (nextShapes) => {
        if (!yShapes) {
          return;
        }

        const normalizedShapes =
          nextShapes.map(
            (shape) => ({
              ...shape,
              id:
                shape.id ||
                createShapeId(),
            })
          );

        yShapes.doc.transact(
          () => {
            if (
              yShapes.length > 0
            ) {
              yShapes.delete(
                0,
                yShapes.length
              );
            }

            if (
              normalizedShapes.length >
              0
            ) {
              yShapes.insert(
                0,
                normalizedShapes
              );
            }
          },
          "local"
        );

        shapesRef.current =
          normalizedShapes;
      },
      [yShapes]
    );

  /* =======================================================
     RESIZE OBSERVER
     ======================================================= */

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return undefined;
    }

    const handleResize = () => {
      resizeCanvas();
      redraw();

      /*
       * Reading the DOM ref here is safe because this
       * runs inside an effect/ResizeObserver, not during
       * React render.
       */
      const rect =
        container.getBoundingClientRect();

      setCanvasSize({
        width: rect.width,
        height: rect.height,
      });
    };

    handleResize();

    const observer =
      new ResizeObserver(
        handleResize
      );

    observer.observe(
      container
    );

    return () => {
      observer.disconnect();
    };
  }, [
    resizeCanvas,
    redraw,
  ]);

  /* =======================================================
     POINTER POSITION
     ======================================================= */

  const getPointerPosition = (
    event
  ) => {
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
      event.clientX -
      rect.left;

    const rawY =
      event.clientY -
      rect.top;

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

  /* =======================================================
     AWARENESS
     ======================================================= */

  const remoteCursors =
    Object.entries(
      awareness || {}
    ).filter(
      ([socketId, value]) =>
        socketId &&
        value &&
        value.visible !==
          false &&
        Number.isFinite(
          value.x
        ) &&
        Number.isFinite(
          value.y
        )
    );

  const broadcastCursor = (
    point
  ) => {
    if (!updateAwareness) {
      return;
    }

    const now =
      performance.now();

    /*
     * Limit awareness traffic
     * to approximately 30 updates
     * per second.
     */

    if (
      now -
        lastAwarenessSentRef.current <
      33
    ) {
      return;
    }

    lastAwarenessSentRef.current =
      now;

    updateAwareness({
      type: "cursor",
      x: point.x,
      y: point.y,
      visible: true,
    });
  };

  const hideRemoteCursor = () => {
    updateAwareness?.({
      type: "cursor",
      visible: false,
    });
  };

  /* =======================================================
     ERASE
     ======================================================= */

  const eraseAtPosition = (
    event
  ) => {
    const point =
      getPointerPosition(event);

    const eraserSize = 30;

    const filtered =
      shapesRef.current.filter(
        (shape) => {
          if (
            shape.type ===
            "pen"
          ) {
            return !shape.points.some(
              (p) =>
                Math.abs(
                  p.x - point.x
                ) <
                  eraserSize &&
                Math.abs(
                  p.y - point.y
                ) <
                  eraserSize
            );
          }

          if (
            shape.type ===
              "rectangle" ||
            shape.type ===
              "circle"
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
                minX -
                  eraserSize &&
              point.x <=
                maxX +
                  eraserSize &&
              point.y >=
                minY -
                  eraserSize &&
              point.y <=
                maxY +
                  eraserSize
            );
          }

          return true;
        }
      );

    shapesRef.current =
      filtered;

    commitShapes(
      filtered
    );

    setHasDrawing(
      filtered.length > 0
    );

    setRedoStack([]);

    setSelectedShapeId(null);

    redraw();
  };

  /* =======================================================
     POINTER DOWN
     ======================================================= */

  const handlePointerDown = (
    event
  ) => {
    event.preventDefault();

    if (
      tool === "eraser"
    ) {
      eraseAtPosition(
        event
      );

      return;
    }

    const point =
      getPointerPosition(
        event
      );

    if (
      tool === "select"
    ) {
      const hit =
        [...shapesRef.current]
          .reverse()
          .find(
            (shape) =>
              hitTestShape(
                shape,
                point,
                12
              )
          );

      if (!hit) {
        setSelectedShapeId(
          null
        );

        currentShapeRef.current =
          null;

        redraw();

        return;
      }

      setSelectedShapeId(
        hit.id
      );

      movingRef.current =
        true;

      drawingRef.current =
        true;

      currentShapeRef.current =
        {
          ...hit,
          points:
            hit.points
              ? hit.points.map(
                  (p) => ({
                    ...p,
                  })
                )
              : undefined,
        };

      moveOriginRef.current =
        {
          x: point.x,
          y: point.y,
        };

      if (
        canvasRef.current
      ) {
        try {
          canvasRef.current.setPointerCapture(
            event.pointerId
          );
        } catch {
          // Ignore pointer capture errors.
        }
      }

      redraw();

      return;
    }

    drawingRef.current =
      true;

    if (
      canvasRef.current
    ) {
      try {
        canvasRef.current.setPointerCapture(
          event.pointerId
        );
      } catch {
        // Ignore pointer capture errors.
      }
    }

    if (
      tool === "pen"
    ) {
      currentShapeRef.current =
        {
          id: createShapeId(),
          type: "pen",
          points: [point],
        };
    }

    if (
      tool === "rectangle" ||
      tool === "circle"
    ) {
      currentShapeRef.current =
        {
          id: createShapeId(),
          type: tool,
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        };
    }

    redraw();
  };

  /* =======================================================
     POINTER MOVE
     ======================================================= */

  const handlePointerMove = (
    event
  ) => {
    const point =
      getPointerPosition(
        event
      );

    /*
     * Send cursor position to
     * other users even when we
     * are not drawing.
     */

    broadcastCursor(point);

    if (
      !drawingRef.current
    ) {
      return;
    }

    const current =
      currentShapeRef.current;

    if (!current) {
      return;
    }

    /* =================================================
       MOVE EXISTING SHAPE
       ================================================= */

    if (
      movingRef.current
    ) {
      const origin =
        moveOriginRef.current;

      if (!origin) {
        return;
      }

      const source =
        shapesRef.current.find(
          (shape) =>
            shape.id ===
            current.id
        );

      if (!source) {
        return;
      }

      const dx =
        point.x -
        origin.x;

      const dy =
        point.y -
        origin.y;

      const moved = {
        ...source,
      };

      if (
        moved.type ===
        "pen"
      ) {
        moved.points =
          source.points.map(
            (p) => ({
              x:
                p.x + dx,
              y:
                p.y + dy,
            })
          );
      } else {
        moved.startX =
          source.startX +
          dx;

        moved.startY =
          source.startY +
          dy;

        moved.endX =
          source.endX +
          dx;

        moved.endY =
          source.endY +
          dy;
      }

      currentShapeRef.current =
        moved;

      redraw();

      return;
    }

    /* =================================================
       DRAW PEN
       ================================================= */

    if (
      current.type ===
      "pen"
    ) {
      current.points.push(
        point
      );
    }

    /* =================================================
       DRAW SHAPE
       ================================================= */

    if (
      current.type ===
        "rectangle" ||
      current.type ===
        "circle"
    ) {
      current.endX =
        point.x;

      current.endY =
        point.y;
    }

    redraw();
  };

  /* =======================================================
     POINTER UP
     ======================================================= */

  const handlePointerUp = (
    event
  ) => {
    event.preventDefault();

    hideRemoteCursor();

    if (
      !drawingRef.current
    ) {
      return;
    }

    drawingRef.current =
      false;

    if (
      canvasRef.current &&
      canvasRef.current.hasPointerCapture(
        event.pointerId
      )
    ) {
      try {
        canvasRef.current.releasePointerCapture(
          event.pointerId
        );
      } catch {
        // Ignore pointer release errors.
      }
    }

    /* =================================================
       FINISH MOVING SHAPE
       ================================================= */

    if (
      movingRef.current
    ) {
      const movedShape =
        currentShapeRef.current;

      const index =
        shapesRef.current.findIndex(
          (shape) =>
            shape.id ===
            movedShape?.id
        );

      if (
        index !== -1 &&
        movedShape
      ) {
        const nextShapes =
          [
            ...shapesRef.current,
          ];

        nextShapes[index] =
          movedShape;

        shapesRef.current =
          nextShapes;

        commitShapes(
          nextShapes
        );

        setRedoStack([]);
      }

      movingRef.current =
        false;

      moveOriginRef.current =
        null;

      currentShapeRef.current =
        null;

      redraw();

      return;
    }

    /* =================================================
       FINISH DRAWING
       ================================================= */

    const completedShape =
      currentShapeRef.current;

    const isValidShape =
      completedShape &&
      (
        completedShape.type ===
        "pen"
          ? completedShape
              .points &&
            completedShape
              .points
              .length > 1
          : true
      );

    if (
      isValidShape
    ) {
      const nextShapes =
        [
          ...shapesRef.current,
          completedShape,
        ];

      shapesRef.current =
        nextShapes;

      commitShapes(
        nextShapes
      );

      setHasDrawing(
        true
      );

      setRedoStack([]);
    }

    currentShapeRef.current =
      null;

    redraw();
  };

  /* =======================================================
     POINTER LEAVE
     ======================================================= */

  const handlePointerLeave =
    () => {
      hideRemoteCursor();
    };

  /* =======================================================
     UNDO
     ======================================================= */

  const undo = () => {
    if (
      shapesRef.current
        .length === 0
    ) {
      return;
    }

    const copy =
      [
        ...shapesRef.current,
      ];

    const removed =
      copy.pop();

    shapesRef.current =
      copy;

    commitShapes(copy);

    setRedoStack(
      (previous) => [
        ...previous,
        removed,
      ]
    );

    setHasDrawing(
      copy.length > 0
    );

    redraw();
  };

  /* =======================================================
     REDO
     ======================================================= */

  const redo = () => {
    if (
      redoStack.length ===
      0
    ) {
      return;
    }

    const copy =
      [...redoStack];

    const restored =
      copy.pop();

    const nextShapes =
      [
        ...shapesRef.current,
        restored,
      ];

    shapesRef.current =
      nextShapes;

    commitShapes(
      nextShapes
    );

    setRedoStack(copy);

    setHasDrawing(
      true
    );

    redraw();
  };

  /* =======================================================
     CLEAR
     ======================================================= */

  const clearCanvas = () => {
    if (
      shapesRef.current
        .length === 0
    ) {
      return;
    }

    setRedoStack(
      (previous) => [
        ...previous,
        ...shapesRef.current,
      ]
    );

    shapesRef.current =
      [];

    currentShapeRef.current =
      null;

    setSelectedShapeId(
      null
    );

    commitShapes([]);

    setHasDrawing(
      false
    );

    redraw();
  };

  /* =======================================================
     ZOOM
     ======================================================= */

  const zoomIn = () => {
    setZoom(
      (previous) =>
        Math.min(
          previous + 0.1,
          2
        )
    );
  };

  const zoomOut = () => {
    setZoom(
      (previous) =>
        Math.max(
          previous - 0.1,
          0.5
        )
    );
  };

  const resetZoom = () => {
    setZoom(1);
  };

  /* =======================================================
     WHITEBOARD UI
     ======================================================= */

  return (
    <div className="whiteboard">
      {/* =================================================
          HEADER
          ================================================= */}

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

        <div className="canvas-sync-status">
          <span
            className={`status-dot ${
              collaborationStatus ===
                "synced" ||
              collaborationStatus ===
                "connected"
                ? "online"
                : ""
            }`}
          />

          {collaborationStatus ===
          "synced"
            ? "Synced"
            : collaborationStatus ===
              "connected"
            ? "Connected"
            : collaborationStatus ===
              "connecting"
            ? "Connecting"
            : collaborationStatus ===
              "error"
            ? "Connection error"
            : "Offline"}
        </div>

        <button
          type="button"
          className="panel-menu"
          title="Whiteboard menu"
        >
          ...
        </button>
      </div>

      {/* =================================================
          TOOLBAR
          ================================================= */}

      <div className="whiteboard-toolbar">
        <ToolButton
          value="select"
          title="Select and move"
          activeTool={tool}
          onSelect={setTool}
        >
          ↖
        </ToolButton>

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
          disabled={
            !hasDrawing
          }
        >
          ↶
        </button>

        <button
          type="button"
          className="tool-button"
          onClick={redo}
          title="Redo"
          disabled={
            redoStack.length ===
            0
          }
        >
          ↷
        </button>

        <button
          type="button"
          className="tool-button"
          onClick={
            clearCanvas
          }
          title="Clear"
          disabled={
            !hasDrawing
          }
        >
          ♲
        </button>
      </div>

      {/* =================================================
          CANVAS
          ================================================= */}

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
            handlePointerLeave
          }
          onContextMenu={(
            event
          ) =>
            event.preventDefault()
          }
        />

        {/* =================================================
            START DRAWING
            ================================================= */}

        {!hasDrawing && (
          <div className="canvas-message">
            <div className="canvas-icon">
              ✦
            </div>

            <h3>
              Start collaborating
            </h3>

            <p>
              Draw, move, erase,
              and share ideas
              with your team.
            </p>

            <button
              type="button"
              className="start-drawing-button"
              onClick={() => {
                setHasDrawing(true);
                setTool("pen");

                requestAnimationFrame(
                  () => {
                    canvasRef.current?.focus();
                  }
                );
              }}
            >
              Start drawing
            </button>
          </div>
        )}

        {/* =================================================
            REMOTE CURSORS
            ================================================= */}

        {remoteCursors.map(
          ([
            socketId,
            cursor,
          ]) => {
            /*
             * IMPORTANT:
             * Do not access containerRef.current during
             * render. canvasSize is updated by the resize
             * observer inside an effect.
             *
             * The canvas zoom is centered around the
             * middle of the whiteboard, so apply the same
             * transform to the remote cursor.
             */

            const x =
              canvasSize.width / 2 +
              (cursor.x -
                canvasSize.width / 2) *
                zoom;

            const y =
              canvasSize.height / 2 +
              (cursor.y -
                canvasSize.height / 2) *
                zoom;

            return (
              <div
                key={
                  socketId
                }
                style={{
                  position:
                    "absolute",
                  left: `${x}px`,
                  top: `${y}px`,
                  transform:
                    "translate(-2px, -2px)",
                  pointerEvents:
                    "none",
                  zIndex: 20,
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "18px",
                    lineHeight: 1,
                    color:
                      "#7c3aed",
                    textShadow:
                      "0 1px 3px rgba(0,0,0,.5)",
                  }}
                >
                  ➤
                </span>

                <span
                  style={{
                    padding:
                      "3px 6px",
                    borderRadius:
                      "5px",
                    background:
                      "#7c3aed",
                    color:
                      "#fff",
                    fontSize:
                      "10px",
                    fontWeight:
                      600,
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {socketId.slice(
                    0,
                    8
                  )}
                </span>
              </div>
            );
          }
        )}

        {/* =================================================
            ZOOM
            ================================================= */}

        <div className="zoom-controls">
          <button
            type="button"
            onClick={
              zoomOut
            }
            title="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            className="zoom-value"
            onClick={
              resetZoom
            }
            title="Reset zoom"
          >
            {Math.round(
              zoom * 100
            )}
            %
          </button>

          <button
            type="button"
            onClick={
              zoomIn
            }
            title="Zoom in"
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
  /* =======================================================
     GET ROOM ID
     ======================================================= */

  const roomId =
    decodeURIComponent(
      window.location.pathname.split(
        "/room/"
      )[1] ||
        "default-room"
    );

  /* =======================================================
     COLLABORATIVE ROOM
     ======================================================= */

  const {
    shapes,
    status,
    socket,
    peers,
    awareness,
    updateAwareness,
  } = useCollaborativeRoom(
    roomId
  );

  /* =======================================================
     WORKSPACE
     ======================================================= */

  return (
    <section className="workspace">
      {/* =================================================
          HEADER
          ================================================= */}

      <div className="workspace-header">
        <div>
          <h1>
            Collaborative Workspace
          </h1>

          <p>
            Work together in
            real time
          </p>
        </div>

        <div className="workspace-status">
          <span
            className={`status-dot ${
              status ===
                "connected" ||
              status ===
                "synced"
                ? "online"
                : ""
            }`}
          />

          {status ===
          "synced"
            ? "Synced"
            : status ===
              "connected"
            ? "Online"
            : status ===
              "connecting"
            ? "Connecting"
            : "Offline"}
        </div>
      </div>

      {/* =================================================
          CONTENT
          ================================================= */}

      <div className="workspace-content">
        {/* =================================================
            WHITEBOARD
            ================================================= */}

        <div className="panel whiteboard-panel">
          <Whiteboard
            yShapes={shapes}
            collaborationStatus={
              status
            }
            awareness={
              awareness
            }
            updateAwareness={
              updateAwareness
            }
          />
        </div>

        {/* =================================================
            CODE EDITOR
            ================================================= */}

        <div className="panel code-panel">
          <CodeEditor
            socket={socket}
            roomId={roomId}
            peers={peers}
          />
        </div>
      </div>
    </section>
  );
}

export default Workspace;