import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage";
import RoomPage from "./pages/RoomPage";
import AuthPage from "./pages/AuthPage";

const TOKEN_KEY = "syncspace_token";
const USER_KEY = "syncspace_user";
const USERNAME_KEY = "syncspace_username";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function readSession() {
  const token =
    localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  const savedUser =
    localStorage.getItem(USER_KEY) ||
    sessionStorage.getItem(USER_KEY) ||
    localStorage.getItem(USERNAME_KEY) ||
    sessionStorage.getItem(USERNAME_KEY);

  if (!token || !savedUser) return null;

  return {
    token,
    username:
      savedUser.startsWith("{")
        ? JSON.parse(savedUser).username
        : savedUser,
  };
}

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
      notice: "",
    };
  }

  if (path === "/signin" || path === "/login") {
    return { page: "auth", roomId: null, mode: "split", authMode: "signin", notice: "" };
  }

  if (path === "/signup" || path === "/register") {
    return { page: "auth", roomId: null, mode: "split", authMode: "signup", notice: "" };
  }

  return { page: "home", roomId: null, mode: "split", authMode: null, notice: "" };
}

function App() {
  const [route, setRoute] = useState(getRouteState);
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    const onPop = () => setRoute(getRouteState());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Keep page scrolling behavior isolated by route.
  useEffect(() => {
    document.body.classList.toggle("landing-route", route.page === "home");
    document.body.classList.toggle("room-route", route.page === "room");
    document.body.classList.toggle("auth-route", route.page === "auth");

    return () => {
      document.body.classList.remove("landing-route", "room-route", "auth-route");
    };
  }, [route.page]);

  const navigate = (path, notice = "") => {
    window.history.pushState({}, "", path);
    setRoute({ ...getRouteState(), notice });
    window.scrollTo(0, 0);
  };

  const handleAuthenticated = ({ username, token, remember }) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;

    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USERNAME_KEY, username);
    storage.setItem(USER_KEY, JSON.stringify({ username }));
    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(USERNAME_KEY);
    otherStorage.removeItem(USER_KEY);
    setSession({ username, token });
    navigate("/");
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(USER_KEY);
    setSession(null);
    navigate("/");
  };

  const createRoom = async () => {
    if (!session?.token) {
      navigate("/signin", "Please log in to create a room.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logout();
          navigate("/signin", "Your session has expired. Please sign in again.");
          return;
        }
        throw new Error(data.message || "Unable to create room.");
      }

      openRoom(data.room.roomId);
    } catch (error) {
      navigate("/", error.message || "Unable to create room.");
    }
  };

  const joinRoom = (id) => {
    if (!session?.token) {
      navigate("/signin", "Please log in to join a room.");
      return;
    }
    openRoom(id);
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
    if (!session?.token) {
      return (
        <AuthPage
          mode="signin"
          notice="Please log in to access this room."
          onAuthenticated={handleAuthenticated}
          onModeChange={(mode) => navigate(mode === "signin" ? "/signin" : "/signup")}
          onHome={goHome}
        />
      );
    }
    return (
      <RoomPage
        roomId={route.roomId}
        workspaceMode={route.mode}
        onModeChange={changeMode}
        onHome={goHome}
        username={session.username}
        onLogout={logout}
      />
    );
  }

  if (route.page === "auth") {
    return (
      <AuthPage
        mode={route.authMode}
        notice={route.notice}
        onAuthenticated={handleAuthenticated}
        onModeChange={(mode) => navigate(mode === "signin" ? "/signin" : "/signup")}
        onHome={goHome}
      />
    );
  }

  return (
    <LandingPage
      user={session}
      notice={route.notice}
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      onSignIn={() => navigate("/signin")}
      onSignUp={() => navigate("/signup")}
      onLogout={logout}
    />
  );
}

export default App;
