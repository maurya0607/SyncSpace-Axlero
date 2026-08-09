import './Workspace.css'

function Workspace() {
  return (
    <section className="workspace">

      <div className="workspace-header">
        <h1>Collaborative Workspace</h1>
        <span>Online</span>
      </div>

      <div className="workspace-content">

        <div className="panel whiteboard">
          <h2>Whiteboard</h2>

          <div className="whiteboard-area">
            <p>Whiteboard Area</p>
          </div>
        </div>

        <div className="panel code-editor">
          <h2>Code Editor</h2>

          <div className="code-area">
            <p>Code Editor Area</p>
          </div>
        </div>

      </div>

    </section>
  )
}

export default Workspace