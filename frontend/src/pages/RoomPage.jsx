import { useState } from "react";
import Workspace from "../components/Workspace/Workspace";
import "./RoomPage.css";

function Logo() {
  return (
    <div className="room-logo">
      <span className="room-mark"><i></i><i></i></span>
      <span>SyncSpace</span>
    </div>
  );
}

function RoomPage({ roomId, workspaceMode, onModeChange, onHome, username, onLogout }) {
  const [copied, setCopied] = useState(false);

  const copyInvite = async () => {
    const link = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-header-left">
          <button className="back-button" onClick={onHome} title="Back to home">←</button>
          <Logo />
          <span className="room-separator">/</span>
          <div className="room-name">
            <span className="room-label">ROOM</span>
            <strong>{roomId}</strong>
          </div>
          <div className="room-mode-switch" aria-label="Workspace mode">
            {[["board", "Board"], ["code", "Code Editor"], ["split", "Split"]].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={workspaceMode === value ? "active" : ""}
                onClick={() => onModeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="room-header-right">
          <div className="room-user">{username}</div>
          <button className="room-logout" type="button" onClick={onLogout}>Logout</button>
          <div className="live-status"><span></span> Live</div>
          <div className="room-avatars"><i>C</i><i>R</i><i>A</i></div>
          <button className="invite-button" onClick={copyInvite}>{copied ? "Copied!" : "Invite"} <span>↗</span></button>
        </div>
      </header>

      <div className="room-subbar">
        <div className="room-context"><span className="context-dot"></span> Collaborative workspace</div>
        <div className="room-actions"><span>Autosaved</span><span className="shortcut">⌘ K</span></div>
      </div>

      <main className="room-main">
        <Workspace roomId={roomId} workspaceMode={workspaceMode} />
      </main>
    </div>
  );
}

export default RoomPage;
