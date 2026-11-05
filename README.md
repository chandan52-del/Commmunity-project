# Community Hall Booking and Management System

Full-stack application for listing community halls, requesting datetime-range bookings, and administering halls, approvals, maintenance, and reports.

## Stack

- Frontend: React.js, Vite, JavaScript, Tailwind CSS
- Backend: Node.js, Express.js (Devin)
- Database: MySQL 8 (Devin)

## Repository ownership

| Owner | Path | Branch |
| --- | --- | --- |
| Cursor | `frontend/` | `feat/frontend` |
| Devin | `backend/` | `feat/backend` |
| Shared | `docs/`, this README, root `.gitignore` | merge via PR into `develop`, then `main` |

Cursor must never modify backend or SQL files. Devin must never modify frontend files.

Devin owns and maintains `docs/openapi.yaml`. The frontend must integrate only after that contract is filled in.

## Branch flow

```
main              production-ready
develop           integration
feat/frontend     Cursor
feat/backend      Devin
```

## Frontend (Phase 0)

```bash
cd frontend
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173`. Copy `frontend/.env.example` to `frontend/.env` when the API is available.

Backend, migrations, and a complete OpenAPI spec are not part of this Phase 0 commit. Devin should add `backend/` on `feat/backend` from `develop`.
