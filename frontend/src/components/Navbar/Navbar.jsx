import { useState, useEffect } from 'react';
import './Navbar.css';

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      {/* Left - Brand */}
      <div className="navbar-left">
        <div className="brand">
          <div className="brand-mark">
            <span></span>
            <span></span>
          </div>

          <span className="brand-name">SyncSpace</span>
        </div>
      </div>

      {/* Center - Workspace */}
      <div className="navbar-center">
        <div className="workspace-selector">
          <span className="workspace-icon">W</span>

          <span className="workspace-name">Workspace</span>

          <svg
            className="chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Right - Status + User */}
      <div className="navbar-right">

        <div className="connection-status">
          <span className="status-dot"></span>
          <span>Online</span>
        </div>

        <div className="navbar-divider"></div>

        <button className="user-menu" type="button">
          <div className="avatar">C</div>

          <div className="user-details">
            <span className="user-name">Chandru</span>
            <span className="user-role">Developer</span>
          </div>

          <svg
            className="chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>
    </header>
  )
}

export default Navbar