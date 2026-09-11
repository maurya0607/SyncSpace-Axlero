import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import RoomPage from "./pages/RoomPage";
import AuthPage from "./pages/AuthPage";

function getRouteState() {
  const path = window.location.pathname;

  const roomMatch = path.match(/^\/room\/([^/]+)/);
  if (roomMatch) {
    const params = new URLSearchParams(window.location.search);
    const mode = ["board", "code", "split"].includes(params.get("mode"))
      ? params.get("mode")
      : "split";

    return {
      page: "room",
      roomId: decodeURIComponent(roomMatch[1]),
      mode,
      authMode: null,
    };
  }

  if (path === "/signin" || path === "/login") {
    return { page: "auth", roomId: null, mode: "split", authMode: "signin" };
  }

  if (path === "/signup" || path === "/register") {
    return { page: "auth", roomId: null, mode: "split", authMode: "signup" };
  }

  return { page: "home", roomId: null, mode: "split", authMode: null };
}

function App() {
  const [route, setRoute] = useState(getRouteState);

  useEffect(() => {
    const onPop = () => setRoute(getRouteState());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setRoute(getRouteState());
    window.scrollTo(0, 0);
  };

  const openRoom = (id, mode = "split") => {
    const cleanId = String(id).trim();
    const cleanMode = ["board", "code", "split"].includes(mode) ? mode : "split";
    navigate(`/room/${encodeURIComponent(cleanId)}?mode=${cleanMode}`);
  };

  const changeMode = (mode) => {
    if (!route.roomId) return;
    navigate(`/room/${encodeURIComponent(route.roomId)}?mode=${mode}`);
  };

  const goHome = () => navigate("/");

  if (route.page === "room") {
    return (
      <RoomPage
        roomId={route.roomId}
        workspaceMode={route.mode}
        onModeChange={changeMode}
        onHome={goHome}
      />
    );
  }

  if (route.page === "auth") {
    return (
      <AuthPage
        mode={route.authMode}
        onModeChange={(mode) => navigate(mode === "signin" ? "/signin" : "/signup")}
        onHome={goHome}
      />
    );
  }

  return (
    <LandingPage
      onLaunch={openRoom}
      onSignIn={() => navigate("/signin")}
      onSignUp={() => navigate("/signup")}
    />
  );
}

export default App;
