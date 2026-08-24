/* =========================================================
   STORAGE LIMIT.
   ========================================================= */

const MAX_REPLAY_SNAPSHOTS = 100;

/* =========================================================
   CLONE FILES
   ========================================================= */

function cloneFiles(files) {
  return Array.isArray(files)
    ? files.map((file) => ({
        ...file,

        code: typeof file.code === "string" ? file.code : "",

        savedCode:
          typeof file.savedCode === "string"
            ? file.savedCode
            : typeof file.code === "string"
              ? file.code
              : "",
      }))
    : [];
}


/* =========================================================
   CREATE REPLAY SNAPSHOT
   ========================================================= */

export function createReplaySnapshot({ files, activeFileId }) {
  return {
    id: `snapshot-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,

    timestamp: Date.now(),

    files: cloneFiles(files),

    activeFileId: activeFileId || null,
  };
}


/* =========================================================
   ADD REPLAY SNAPSHOT
   ========================================================= */

export function addReplaySnapshot(history, snapshot) {
  if (!snapshot) {
    return Array.isArray(history) ? history : [];
  }

  const current = Array.isArray(history) ? history : [];

  const last = current[current.length - 1];
  if (
    last &&
    last.activeFileId === snapshot.activeFileId &&
    JSON.stringify(last.files) === JSON.stringify(snapshot.files)
  ) {
    return current;
  }
  const next = [...current, snapshot];

  return next.length > MAX_REPLAY_SNAPSHOTS
    ? next.slice(-MAX_REPLAY_SNAPSHOTS)
    : next;
}


/* =========================================================
   GET REPLAY SNAPSHOT
   ========================================================= */

export function getReplaySnapshot(history, index) {
  // Validate the history and requested index.
  if (
    !Array.isArray(history) ||
    index < 0 ||
    index >= history.length
  ) {
    return null;
  }

  // Return the requested snapshot.
  return history[index];
}


/* =========================================================
   CLEAR REPLAY HISTORY
   ========================================================= */

export function clearReplayHistory() {
  return [];
}