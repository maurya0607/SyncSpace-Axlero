#Project_structure

# day 2 ****************************************
# Current Project Structure

SyncSpace-Axlero/

├── docs/
│   ├── Database.md
│   ├── API_Testing.md
│   ├── Deployment.md
│   └── Project_Structure.md
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── LICENSE
└── README.md

## Current Status

- [Completed] Frontend initial layout completed.
- [Completed] Documentation created.
- [In Progress] Backend development in progress.
- [Pending] Database implementation pending.
- [Pending] API integration pending.


# Project Structure

## Current Project Structure (Day 3)

```text
SyncSpace-Axlero/
│
├── backend/
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Navbar/
│   │   │   ├── Sidebar/
│   │   │   └── Workspace/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── docs/
│   ├── API_Testing.md
│   ├── Database.md
│   ├── Deployment.md
│   └── Project_Structure.md
│
├── LICENSE
└── README.md
```

## Description

### Frontend
- Built with React + Vite.
- Basic project layout has been implemented.
- Navbar, Sidebar, and Workspace components are available.

### Backend
- Express.js server setup completed.
- Socket.io integrated for real-time communication.
- Room join, leave, and messaging events implemented.

### Documentation
- Database planning document.
- API testing plan.
- Deployment planning.
- Project structure documentation.

## Current Status (Day 3)

- Frontend basic layout completed.
- Backend Week 1 setup completed.
- Documentation in progress.
- Database integration is pending.
- Authentication and Yjs integration will be added in the upcoming development phase.

# Current Project Structure (Day 5)

```text
SyncSpace-Axlero/
│
├── backend/
│   ├── node_modules/
│   ├── yjs/
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── test-yjs.js
│
├── docs/
│   ├── API_Testing.md
│   ├── Database.md
│   ├── Deployment.md
│   └── Project_Structure.md
│
├── frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Navbar/
│   │   │   ├── Sidebar/
│   │   │   └── Workspace/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .gitignore
│   ├── eslint.config.js
│   └── index.html
│
├── LICENSE
└── README.md
```

## Current Status (Day 5)

- Frontend basic layout completed.
- Backend server setup completed.
- Socket.io integration completed.
- Yjs folder added for upcoming real-time collaboration.
- Project documentation updated.
- Database integration in progress.
- Authentication pending.
- Deployment pending.


## Current Project Structure

```text
SyncSpace-Axlero/
│
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── CodeDocument.js
│   │   ├── Room.js
│   │   ├── User.js
│   │   └── Whiteboard.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── room.js
│   ├── services/
│   │   └── presence.js
│   ├── yjs/
│   │   └── yjsManager.js
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── test-yjs.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Navbar/
│   │   │   ├── Sidebar/
│   │   │   └── Workspace/
│   │   ├── lib/
│   │   │   └── useCollaborativeRoom.js
│   │   ├── pages/
│   │   │   ├── AuthPage.css
│   │   │   ├── AuthPage.jsx
│   │   │   ├── LandingPage.css
│   │   │   ├── LandingPage.jsx
│   │   │   ├── RoomPage.css
│   │   │   └── RoomPage.jsx
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── docs/
│   ├── API_Testing.md
│   ├── Database.md
│   ├── Deployment.md
│   └── Project_Structure.md
│
├── LICENSE
└── README.md
```

## Description

### Frontend
* Built using React and Vite.
* **Pages**:
  - `LandingPage.jsx`: Hero section, features overview, room creation, and direct join input.
  - `AuthPage.jsx`: Tabbed Sign In and Sign Up interface with state preservation and error handling.
  - `RoomPage.jsx`: Collaborative workspace wrapping Whiteboard, Code Editor, and Chat.
* **Components**: Modular `Navbar`, `Sidebar`, and `Workspace` elements.
* **Custom Hooks**: `useCollaborativeRoom.js` managing Socket.io and Yjs state.
* **Authentication State**: Reactive user session with login/logout management and token storage.

### Backend
* **Server**: Express.js server on port 3001 with CORS and JSON body parser.
* **Database**: MongoDB connected via Mongoose (`backend/config/db.js`).
* **Authentication**: JWT token verification (`backend/middleware/authMiddleware.js`) and bcrypt password hashing.
* **Models**: `User`, `Room`, `CodeDocument`, and `Whiteboard`.
* **Routes**:
  - `/api/auth`: Registration and Login handlers.
  - `/api/rooms`: Protected room creation and user invitation handlers.
* **Real-time Engine**: Socket.io server with room rooms, user presence (`presence.js`), and collaborative Yjs syncing (`yjsManager.js`).

### Documentation
* `Database.md`: MongoDB schema definitions, collections, and indexes.
* `API_Testing.md`: REST API endpoints, Socket.io event specs, and auth flow tests.
* `Deployment.md`: Deployment guide and environment configuration.
* `Project_Structure.md`: Architectural map and file structure tracking.

## Current Status

- [Completed] Full User Authentication & Session Management integrated.
- [Completed] Protected Room Creation & Navigation flow completed.
- [Completed] Backend MongoDB database models and connection operational.
- [Completed] Socket.io real-time communication and presence tracking implemented.
- [Completed] Yjs collaborative engine & awareness integration active.
- [In Progress] Whiteboard canvas persistence in progress.
- [Pending] Production deployment configuration pending.

