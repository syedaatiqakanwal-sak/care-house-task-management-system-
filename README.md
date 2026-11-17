# Lets Care All

Full-stack role-based office task management system with dynamic RBAC, task workflows, call/email ingestion, messaging, notifications, and analytics.

## Tech Stack
- Backend: Node.js, Express, Sequelize, MySQL, Socket.io
- Frontend: React (Vite), React Router, TailwindCSS, Axios

## Project Structure
- `backend/` API, DB models, routes, migrations, seeders, tests
- `frontend/` React app (existing login page preserved)

## Environment Setup

### Backend
Copy `backend/.env.example` to `backend/.env`.

### Frontend
Copy `frontend/.env.example` to `frontend/.env`.

## Install and Run

```bash
# backend
cd letscare-all/backend
npm install
npm run migrate
npm run seed
npm run dev

# frontend
cd letscare-all/frontend
npm install
npm run dev
```

## Default Login
- Email: `admin@letscareall.com`
- Password: `Admin@123`

## API Base URL
- `http://localhost:5000/api/v1`

## Tests

```bash
cd letscare-all/backend
npm test
```

## Postman Collection
- `letscare-all.postman_collection.json`

## Screenshots
- Add screenshots here after running the app.
