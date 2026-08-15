import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import RoomPage from "./pages/RoomPage";

function getRoomFromPath() {
  const match = window.location.pathname.match(/^\/room\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function App() {
  const [roomId, setRoomId] = useState(getRoomFromPath);

  useEffect(() => {
    const onPop = () => setRoomId(getRoomFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openRoom = (id) => {
    const cleanId = String(id).trim();
    window.history.pushState({}, "", `/room/${encodeURIComponent(cleanId)}`);
    setRoomId(cleanId);
  };

  const goHome = () => {
    window.history.pushState({}, "", "/");
    setRoomId(null);
  };

  return roomId ? <RoomPage roomId={roomId} onHome={goHome} /> : <LandingPage onLaunch={openRoom} />;
}

export default App;
