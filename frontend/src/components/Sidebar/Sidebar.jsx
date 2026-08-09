import './Sidebar.css'

function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>SyncSpace</h2>

      <nav>
        <button>Workspace</button>
        <button>Members</button>
        <button>Settings</button>
      </nav>
    </aside>
  )
}

export default Sidebar