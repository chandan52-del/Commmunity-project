# Architecture

Community Hall Booking and Management System is a single-organization product: customers discover halls, check availability, and request bookings; administrators manage halls, approve or reject requests, schedule maintenance, and view reports.

## Approved decisions

- React + Vite + Tailwind CSS frontend (Cursor, `frontend/`, `feat/frontend`)
- Node.js + Express.js backend (Devin, `backend/`, `feat/backend`)
- MySQL 8
- GitHub monorepo with separate feature branches
- Single organization, multiple halls
- Roles: `customer`, `admin`
- Datetime-range bookings
- No online payments or email in V1
- Landing page in V1
- Image URLs instead of file uploads in V1
- Pending bookings do not permanently block availability
- Conflicts are rechecked when an administrator approves a booking
- Devin creates and maintains `docs/openapi.yaml` before frontend integration

## V1 scope

Customer registration and login, customer dashboard, hall listing, hall details and availability, online booking requests, admin dashboard, hall management, booking approval and rejection, maintenance scheduling, booking history, reports and analytics.

Out of scope for V1: payments, email/SMS, multi-tenant organizations, calendar sync.

## Collaboration

1. Devin fills `docs/openapi.yaml` before Cursor wires real API calls.
2. Devin owns schema and migrations. Cursor never changes `backend/` or SQL.
3. Devin never changes `frontend/`.
4. Root files change in small PRs, one owner at a time.
5. Integrate often into `develop`.
6. Frontend env: `VITE_API_BASE_URL=http://localhost:5000/api`. Backend `.env` is never committed.

## System shape

```
Browser (React + Vite + Tailwind)
        HTTPS JSON
Express API (Node)
        mysql2
MySQL 8
```

Backend layers: `routes → middleware (auth, validate, role) → controllers → services → db`

Frontend layers: `pages → feature components → ui kit → api client → auth context`

## Security

- Passwords hashed with bcrypt (or equivalent), never stored in plaintext
- Short-lived JWT access tokens (15–60 minutes)
- Refresh tokens stored and rotated securely (httpOnly cookie or equivalent server-side handling; not long-lived tokens in localStorage as the only credential)
- Role-based authorization on `/api/admin/*` and admin UI routes
- Backend validation for all mutating endpoints
- CORS limited to the Vite origin
- Parameterized SQL only

## Booking concurrency

Use MySQL transactions and row locking so two administrators cannot approve overlapping bookings for the same hall.

Recommended approach for Devin:

1. Start a transaction.
2. `SELECT ... FOR UPDATE` the hall row and overlapping **approved** bookings plus blocking maintenance windows.
3. Recheck overlap at approve time (pending rows do not count as blocks).
4. If clear, set status to `approved` and commit.
5. If conflict, roll back and return a 409 with a clear error.

Pending requests must not block the calendar permanently. Availability endpoints should treat only approved bookings and scheduled/in-progress maintenance as busy.

## Availability rule

A hall is unavailable when an **approved** booking or **scheduled** / **in_progress** maintenance overlaps `[start_at, end_at)`. Pending bookings stay visible to administrators and to the requesting customer.

## Testing (Devin)

Include automated tests for:

- Overlapping booking approval (including concurrent approve attempts)
- Maintenance vs booking conflicts
- Authentication (register, login, invalid credentials)
- Authorization (customer cannot call admin routes)
- Invalid inputs (dates, missing fields, end before start)

## Folder ownership

See the repository README. Phase 0 contains `frontend/` scaffold and `docs/` only. Devin adds `backend/` later.
