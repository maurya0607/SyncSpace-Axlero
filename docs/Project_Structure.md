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

✔ Frontend initial layout completed.

✔ Documentation created.

⏳ Backend development in progress.

⏳ Database implementation pending.

⏳ API integration pending.


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


## *******************************************************************
# Project Structure

## Current Project Structure

```text
SyncSpace-Axlero/
│
├── backend/
│   ├── services/
│   │   └── presence.js
│   │
│   ├── yjs/
│   │   └── yjsManager.js
│   │
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── test-yjs.js
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── assets/
│   │   │
│   │   ├── components/
│   │   │   ├── Navbar/
│   │   │   ├── Sidebar/
│   │   │   └── Workspace/
│   │   │
│   │   ├── lib/
│   │   │   └── useCollaborativeRoom...
│   │   │
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LandingPage.css
│   │   │   ├── RoomPage.jsx
│   │   │   └── RoomPage.css
│   │   │
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── .gitignore
│   ├── eslint.config.js
│   └── index.html
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
* Landing Page and Room Page have been implemented.
* Navbar, Sidebar, and Workspace components are available.
* Collaborative room functionality is being integrated.
* Frontend is structured into reusable components and pages.

### Backend

* Express.js server setup is completed.
* Socket.io is integrated for real-time communication.
* Room creation and room joining functionality is implemented.
* Room-based communication is supported.
* Presence system is implemented for tracking connected users.
* Yjs integration has been added for real-time collaborative data synchronization.
* Yjs document state can be created and sent to connected clients.
* Awareness updates are being handled for collaborative presence.
* Code state synchronization is being tested.

### Documentation

* Database planning and documentation are maintained in `Database.md`.
* API and backend testing details are maintained in `API_Testing.md`.
* Deployment information is maintained in `Deployment.md`.
* Project structure is documented in this file.

## Current Status

* Frontend basic layout completed.
* Landing Page, Room Page, and Auth Page implemented.
* Complete user authentication and navigation flow integrated:
  `Sign Up → Login → Login successful → Username + Create Room + Logout → Logout → Sign In + Sign Up`
* Backend server setup completed on port 3001.
* Socket.io real-time communication integrated.
* Room join and communication functionality implemented.
* Presence system implemented.
* Yjs integration added.
* Yjs document creation and state synchronization tested successfully.
* Awareness update handling tested successfully.
* Code state synchronization tested successfully.
* Database persistence with MongoDB in progress.
* Multi-client real-time synchronization requires final verification.
* Deployment is pending.

