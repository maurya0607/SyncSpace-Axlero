import Navbar from './components/Navbar/Navbar'
import Sidebar from './components/Sidebar/Sidebar'
import Workspace from './components/Workspace/Workspace'
import './App.css'

function App() {
  return (
    <div className="app">

      <Navbar />

      <main className="main-layout">
        <Sidebar />
        <Workspace />
      </main>

    </div>
  )
}

export default App