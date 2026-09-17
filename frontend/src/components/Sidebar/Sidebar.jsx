import './Sidebar.css'

function Sidebar() {
  return (
    <aside className="sidebar">

      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-icon">S</div>

          <div>
            <h2>SyncSpace</h2>
            <span>Workspace</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">

        <p className="nav-label">WORKSPACE</p>

        <button className="sidebar-item active">
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>

          <span>Workspace</span>
        </button>

        <button className="sidebar-item">
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>

          <span>Members</span>
        </button>

        <button className="sidebar-item">
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V22h-2.55v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.1 15a1.7 1.7 0 0 0-1.56-1.03H6V11.4h.09A1.7 1.7 0 0 0 7.65 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06A1.7 1.7 0 0 0 11 6.65a1.7 1.7 0 0 0 1.03-1.56V5h2.55v.09A1.7 1.7 0 0 0 15.6 6.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06A1.7 1.7 0 0 0 18.94 10a1.7 1.7 0 0 0 1.56 1.03h.09v2.55h-.09A1.7 1.7 0 0 0 19.4 15Z" />
            </svg>
          </span>

          <span>Settings</span>
        </button>

      </nav>

      {/* Bottom Connection Status */}
      <div className="sidebar-bottom">
        <div className="connection-status">
          <span className="status-dot"></span>

          <div className="status-text">
            <span className="status-title">Connected</span>
            <span className="status-subtitle">All systems operational</span>
          </div>
        </div>
      </div>

    </aside>
  )
}

export default Sidebar