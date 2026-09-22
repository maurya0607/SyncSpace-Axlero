# Deployment Guide

## Live Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://sync-space-axlero.vercel.app/ |
| Backend | Render | https://syncspace-axlero.onrender.com |

---

## Frontend Deployment — Vercel

### Steps

1. Connect the GitHub repository (`maurya0607/SyncSpace-Axlero`) to [Vercel](https://vercel.com).
2. In the Vercel project settings, set:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add the following environment variable in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://syncspace-axlero.onrender.com` |

4. Click Deploy.

### Notes
- Every push to `main` branch triggers an automatic redeploy on Vercel.
- The `frontend/.env.example` file documents all required environment variables.

---

## Backend Deployment — Render

### Steps

1. Connect the GitHub repository (`maurya0607/SyncSpace-Axlero`) to [Render](https://render.com).
2. Create a new **Web Service** with the following settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
3. Add the following environment variables in the Render dashboard:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `PORT` | Server port | `3001` |
| `MONGO_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/syncspace` |
| `JWT_SECRET` | Secret key for JWT signing | A long random string |
| `FRONTEND_URL` | Allowed frontend origin for CORS | `https://sync-space-axlero.vercel.app` |

4. Click Deploy.

### Notes
- Render auto-deploys on every push to the connected branch.
- The backend uses `process.env.PORT` so the port is automatically set by Render.
- The `backend/.env.example` file documents all required environment variables.

---

## Database — MongoDB Atlas

1. Create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a database user with read/write permissions.
3. Whitelist Render's IP or set access to `0.0.0.0/0` for all IPs.
4. Copy the connection string and set it as `MONGO_URI` in Render.

### Collections Created Automatically
- `users` — on first user registration
- `rooms` — on first room creation
- `codedocuments` — on first code save
- `whiteboards` — on first whiteboard save

---

## Local Development Setup

### Prerequisites
- Node.js >= 18.x
- MongoDB (local instance or Atlas)
- Git

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
node server.js
# or for auto-reload:
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:3001
npm run dev
```

App available at: http://localhost:5173

---

## Environment Variables Reference

### Backend (.env)

```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/syncspace
JWT_SECRET=your_jwt_secret_key_here
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
```

---

*Deployment completed — September 2026*
*Maintained by: Vishal (Team Lead)*
