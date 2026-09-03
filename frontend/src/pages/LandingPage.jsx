import { useState } from "react";
import "./LandingPage.css";

function Logo() {
  return (
    <div className="ss-logo">
      <span className="ss-logo-mark"><i></i><i></i></span>
      <span>SyncSpace</span>
    </div>
  );
}

function LandingPage({ onLaunch }) {
  const [roomId, setRoomId] = useState("");
  const createRoom = () => {
    const id = Math.random().toString(36).slice(2, 8);
    onLaunch(id);
  };

  const joinRoom = (event) => {
    event.preventDefault();
    const id = roomId.trim().replace(/\s+/g, "-");
    if (id) onLaunch(id);
  };

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#about">About</a>
        </nav>
        <button className="nav-launch" onClick={createRoom}>Launch room <span>↗</span></button>
      </header>

      <main>
        <section className="hero" id="about">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />

          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse"></span> REAL-TIME COLLABORATION WORKSPACE</div>
            <h1>Think together.<br /><em>Build together.</em></h1>
            <p>
              A focused workspace where teams can sketch ideas, write code,
              and collaborate in real time — all in one room.
            </p>

            <div className="hero-actions">
              <button className="primary-cta" onClick={createRoom}>
                Create a room <span>→</span>
              </button>
              <form className="join-form" onSubmit={joinRoom}>
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room code"
                  aria-label="Room code"
                />
                <button type="submit">Join</button>
              </form>
            </div>

            <div className="hero-note">
              <span className="mini-avatar">C</span>
              <span>Open a room in seconds. No setup required.</span>
            </div>
          </div>

          <div className="hero-product" aria-label="SyncSpace workspace preview">
            <div className="preview-window">
              <div className="preview-topbar">
                <div className="preview-dots"><i></i><i></i><i></i></div>
                <span>SyncSpace / room-7f3a2c</span>
                <div className="preview-live"><b></b> Live</div>
              </div>
              <div className="preview-body">
                <div className="preview-whiteboard">
                  <div className="preview-label"><span>✦</span> WHITEBOARD</div>
                  <div className="preview-canvas">
                    <span className="sketch sketch-a"></span>
                    <span className="sketch sketch-b"></span>
                    <span className="sketch sketch-c"></span>
                    <span className="sketch-line"></span>
                  </div>
                </div>
                <div className="preview-code">
                  <div className="preview-code-head"><span>CODE</span><small>javascript</small></div>
                  <pre><code>{`01  const room = createRoom();
02
03  room.on("connect", () => {
04    collaborate();
05  });
06
07  export default room;`}</code></pre>
                  <div className="preview-output"><span>OUTPUT</span><b>Ready to run</b></div>
                </div>
              </div>
            </div>
            <div className="floating-chip chip-live">● 3 collaborators</div>
            <div className="floating-chip chip-sync">↗ Changes synced</div>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-heading">
            <span>01 / BUILT FOR COLLABORATION</span>
            <h2>Everything your team needs<br />to move from idea to <em>execution.</em></h2>
          </div>
          <div className="feature-grid">
            <article><div className="feature-icon">✦</div><span className="feature-no">01</span><h3>Shared whiteboard</h3><p>Sketch flows, diagrams, architecture and ideas on a canvas designed for fast thinking.</p></article>
            <article><div className="feature-icon">{`</>`}</div><span className="feature-no">02</span><h3>Collaborative code</h3><p>Write and review code together with tabs, syntax highlighting and an integrated output panel.</p></article>
            <article><div className="feature-icon">◉</div><span className="feature-no">03</span><h3>One shared room</h3><p>Keep your team's visual thinking and implementation side by side instead of switching tools.</p></article>
          </div>
        </section>

        <section className="workflow-section" id="workflow">
          <div><span className="section-kicker">02 / SIMPLE WORKFLOW</span><h2>Open. Share. <em>Build.</em></h2></div>
          <div className="steps">
            <div><span>01</span><h3>Create a room</h3><p>Start a private workspace with a generated room code.</p></div>
            <div><span>02</span><h3>Invite your team</h3><p>Share the room code with teammates and work side by side.</p></div>
            <div><span>03</span><h3>Build together</h3><p>Sketch on the board and turn the idea into working code.</p></div>
          </div>
        </section>
      </main>

      <footer className="landing-footer"><Logo /><span>SyncSpace · Collaborative workspace</span><span>Built for Axlero</span></footer>
    </div>
  );
}

export default LandingPage;
