import { useState } from "react";
import "./AuthPage.css";

const USERS_KEY = "syncspace_demo_users";
const SESSION_KEY = "syncspace_username";

function getUsers() {
  try {
    const saved = localStorage.getItem(USERS_KEY);
    const users = saved ? JSON.parse(saved) : [];
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function Logo() {
  return (
    <div className="auth-logo" aria-label="SyncSpace">
      <span className="auth-logo-mark"><i></i><i></i></span>
      <span>SyncSpace</span>
    </div>
  );
}

function EyeIcon({ visible }) {
  return visible ? "◉" : "◌";
}

function AuthPage({ mode = "signin", onModeChange, onHome }) {
  const isSignUp = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);


  const completeSignIn = (cleanUsername) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(SESSION_KEY, cleanUsername);
    setStatus({ type: "success", message: `Welcome back, ${cleanUsername}. Opening your workspace…` });
    window.setTimeout(onHome, 550);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setStatus({ type: "", message: "" });

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setStatus({ type: "error", message: "Please enter a username." });
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(cleanUsername)) {
      setStatus({ type: "error", message: "Use 3–24 letters, numbers, dots, dashes, or underscores." });
      return;
    }

    if (password.length < 6) {
      setStatus({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 550));

    const users = getUsers();
    const existing = users.find((user) => user.username.toLowerCase() === cleanUsername.toLowerCase());

    if (isSignUp) {
      if (existing) {
        setStatus({ type: "error", message: "That username already exists. Try another one or sign in." });
        setLoading(false);
        return;
      }

      const newUser = { username: cleanUsername, password, createdAt: new Date().toISOString() };
      saveUsers([...users, newUser]);
      localStorage.setItem(SESSION_KEY, cleanUsername);
      setStatus({ type: "success", message: "Account created successfully. Your workspace is ready." });
      setLoading(false);
      window.setTimeout(onHome, 650);
      return;
    }

    if (!existing) {
      setStatus({ type: "error", message: "No local account found. Create an account first." });
      setLoading(false);
      return;
    }

    if (existing.password !== password) {
      setStatus({ type: "error", message: "Incorrect password. Please try again." });
      setLoading(false);
      return;
    }

    completeSignIn(existing.username);
    setLoading(false);
  };

  const useDemoAccount = () => {
    const demo = getUsers().find((user) => user.username === "demo");
    if (!demo) {
      saveUsers([...getUsers(), { username: "demo", password: "demo123", createdAt: new Date().toISOString() }]);
    }
    setUsername("demo");
    setPassword("demo123");
    setStatus({ type: "info", message: "Demo account loaded. Click Sign in to continue." });
  };

  return (
    <div className={`auth-page ${isSignUp ? "auth-page-signup" : "auth-page-signin"}`}>
      <div className="auth-grid" aria-hidden="true"></div>
      <div className="auth-glow auth-glow-one" aria-hidden="true"></div>
      <div className="auth-glow auth-glow-two" aria-hidden="true"></div>
      <div className="auth-orb auth-orb-one" aria-hidden="true"></div>
      <div className="auth-orb auth-orb-two" aria-hidden="true"></div>
      <div className="auth-orb auth-orb-three" aria-hidden="true"></div>

      <header className="auth-topbar">
        <button className="auth-back" type="button" onClick={onHome}>
          <span>←</span> Back to home
        </button>
        <Logo />
        <div className="auth-topbar-spacer" />
      </header>

      <main className="auth-main">
        <section className="auth-showcase">
          <div className="auth-kicker"><span></span> REAL-TIME COLLABORATION</div>
          <h1>Build together.<br /><em>From anywhere.</em></h1>
          <p>Sign in to your SyncSpace workspace and keep ideas, diagrams, and code connected in one shared room.</p>

          <div className="auth-preview">
            <div className="auth-preview-top">
              <span className="auth-preview-dots"><i></i><i></i><i></i></span>
              <span>syncspace / workspace</span>
              <b><i></i> Live</b>
            </div>
            <div className="auth-preview-body">
              <div className="auth-mini-board">
                <span className="mini-label">WHITEBOARD</span>
                <div className="mini-shape mini-shape-one"></div>
                <div className="mini-shape mini-shape-two"></div>
                <div className="mini-arrow"></div>
                <span className="mini-cursor mini-cursor-a"></span>
                <span className="mini-cursor mini-cursor-b"></span>
              </div>
              <div className="auth-mini-code">
                <span className="mini-label">CODE EDITOR</span>
                <div className="mini-code-line w1"></div><div className="mini-code-line w2"></div>
                <div className="mini-code-line w3"></div><div className="mini-code-line w4"></div>
                <span className="mini-code-caret"></span>
              </div>
            </div>
          </div>

          <div className="auth-trust">
            <span>✦</span>
            <div><strong>One room. One shared context.</strong><small>Collaborate without switching between tools.</small></div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-card-label">{isSignUp ? "CREATE ACCOUNT" : "WELCOME BACK"}</span>
            <h2>{isSignUp ? "Create your account" : "Sign in to SyncSpace"}</h2>
            <p>{isSignUp ? "Create a local workspace identity and start collaborating." : "Continue to your collaborative workspace."}</p>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            <label className="auth-field">
              <span>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} type="text" name="username" placeholder="Choose a username" autoComplete="username" required autoFocus />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} name="password" placeholder={isSignUp ? "Create a password" : "Enter your password"} autoComplete={isSignUp ? "new-password" : "current-password"} minLength="6" required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility"><EyeIcon visible={showPassword} /></button>
              </div>
            </label>

            {isSignUp && (
              <label className="auth-field">
                <span>Confirm password</span>
                <div className="auth-password">
                  <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type={showConfirm ? "text" : "password"} name="confirmPassword" placeholder="Repeat your password" autoComplete="new-password" minLength="6" required />
                  <button type="button" onClick={() => setShowConfirm((value) => !value)} aria-label="Toggle confirm password visibility"><EyeIcon visible={showConfirm} /></button>
                </div>
              </label>
            )}

            {!isSignUp && (
              <div className="auth-form-row">
                <label className="auth-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Remember me</span></label>
                <button type="button" className="auth-link-button" onClick={() => setStatus({ type: "info", message: "For this frontend demo, create a new account or use the demo account below." })}>Forgot password?</button>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              <span>{loading ? (isSignUp ? "Creating account…" : "Signing in…") : (isSignUp ? "Create account" : "Sign in")}</span>
              <span>{loading ? "•••" : "→"}</span>
            </button>

            {!isSignUp && (
              <button className="auth-demo-button" type="button" onClick={useDemoAccount} disabled={loading}>
                Use demo account <span>demo / demo123</span>
              </button>
            )}

            {status.message && (
              <div className={`auth-status auth-status-${status.type}`} role={status.type === "error" ? "alert" : "status"}>
                <span>{status.type === "error" ? "!" : status.type === "success" ? "✓" : "i"}</span>
                <div><strong>{status.type === "error" ? "Check your details" : status.type === "success" ? "Success" : "Frontend demo"}</strong><small>{status.message}</small></div>
              </div>
            )}
          </form>

          <div className="auth-divider"><span>FRONTEND DEMO</span></div>
          <p className="auth-switch">{isSignUp ? "Already have an account?" : "Don't have an account?"}<button type="button" onClick={() => onModeChange(isSignUp ? "signin" : "signup")}>{isSignUp ? "Sign in" : "Create one"}</button></p>
          <p className="auth-legal">Accounts are stored locally in this frontend demo. Backend authentication can be connected later.</p>
          <div className="auth-count"><span className="auth-count-dot"></span>{getUsers().length} local account{getUsers().length === 1 ? "" : "s"} available</div>
        </section>
      </main>

      <footer className="auth-footer"><span>SyncSpace · Collaborative workspace</span><span>Built for Axlero</span></footer>
    </div>
  );
}

export default AuthPage;
