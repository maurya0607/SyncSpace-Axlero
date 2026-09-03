import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import RoomPage from "./pages/RoomPage";

function getRoomState() {
  const match = window.location.pathname.match(/^\/room\/([^/]+)/);
  if (!match) return { roomId: null, mode: "split" };

  const params = new URLSearchParams(window.location.search);
  const mode = ["board", "code", "split"].includes(params.get("mode"))
    ? params.get("mode")
    : "split";

  return { roomId: decodeURIComponent(match[1]), mode };
}

function App() {
  const [roomState, setRoomState] = useState(getRoomState);

  useEffect(() => {
    const onPop = () => setRoomState(getRoomState());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openRoom = (id, mode = "split") => {
    const cleanId = String(id).trim();
    const cleanMode = ["board", "code", "split"].includes(mode) ? mode : "split";
    window.history.pushState(
      {},
      "",
      `/room/${encodeURIComponent(cleanId)}?mode=${cleanMode}`
    );
    setRoomState({ roomId: cleanId, mode: cleanMode });
  };

  const changeMode = (mode) => {
    if (!roomState.roomId) return;
    window.history.pushState(
      {},
      "",
      `/room/${encodeURIComponent(roomState.roomId)}?mode=${mode}`
    );
    setRoomState((current) => ({ ...current, mode }));
  };

  const goHome = () => {
    window.history.pushState({}, "", "/");
    setRoomState({ roomId: null, mode: "split" });
  };

  return roomState.roomId ? (
    <RoomPage
      roomId={roomState.roomId}
      workspaceMode={roomState.mode}
      onModeChange={changeMode}
      onHome={goHome}
    />
  ) : <LandingPage onLaunch={openRoom} />;
}

export default App;
