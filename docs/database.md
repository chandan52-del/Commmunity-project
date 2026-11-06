# Database plan (MySQL 8)

Devin implements this schema with **migrations**, **foreign keys**, **indexes**, and **constraints**. Do not apply schema from ad-hoc scripts in production. This file is documentation only, not executable SQL owned by the frontend.

## Conventions

- Engine: InnoDB, charset `utf8mb4`
- Primary keys: `BIGINT UNSIGNED AUTO_INCREMENT`
- Timestamps: `created_at` (`DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`), `updated_at` (`DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`)
- All date-time columns use `DATETIME(3)` (millisecond precision) and store **UTC** values; the application is responsible for converting to/from local time. MySQL `DATETIME` has no timezone — UTC is a storage convention enforced by the API layer.
- Money: `DECIMAL(10,2)`

## Tables

### users

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| full_name | VARCHAR(120) NOT NULL | |
| email | VARCHAR(255) NOT NULL UNIQUE | |
| phone | VARCHAR(32) NULL | |
| password_hash | VARCHAR(255) NOT NULL | |
| role | ENUM('customer','admin') NOT NULL | default `customer` |
| status | ENUM('active','inactive') NOT NULL | default `active` |
| created_at | DATETIME(3) | default `CURRENT_TIMESTAMP(3)` |
| updated_at | DATETIME(3) | default `CURRENT_TIMESTAMP(3)` ON UPDATE `CURRENT_TIMESTAMP(3)` |

### halls

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| name | VARCHAR(160) NOT NULL | |
| slug | VARCHAR(180) NOT NULL UNIQUE | |
| description | TEXT | |
| location | VARCHAR(255) | |
| capacity | INT UNSIGNED NOT NULL | check `capacity > 0` |
| base_price | DECIMAL(10,2) NOT NULL | check `>= 0` |
| status | ENUM('active','inactive','maintenance') NOT NULL | `active` = open for booking requests; `inactive` = unavailable; `maintenance` = whole hall blocked until an admin changes status. Date/time-specific blocks live in `maintenance_windows` — the two mechanisms are independent |
| cover_image_url | VARCHAR(512) NULL | URL only in V1 |
| created_at / updated_at | DATETIME(3) | defaults per conventions |

### amenities

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| name | VARCHAR(80) NOT NULL UNIQUE | |

### hall_amenities

| Column | Type | Notes |
| --- | --- | --- |
| hall_id | FK → halls.id | ON DELETE CASCADE |
| amenity_id | FK → amenities.id | ON DELETE CASCADE |
| PRIMARY KEY (hall_id, amenity_id) | | |

### hall_images

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| hall_id | FK → halls.id | ON DELETE CASCADE |
| image_url | VARCHAR(512) NOT NULL | |
| sort_order | INT NOT NULL DEFAULT 0 | |

Index: `(hall_id, sort_order)`

### bookings

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| booking_ref | VARCHAR(32) NOT NULL UNIQUE | Format `CH-YYYY-NNNNN`: `YYYY` = booking creation year (UTC); `NNNNN` = auto-increment `id` zero-padded to ≥5 digits. Generated **after** INSERT obtains the id, inside the creation transaction |
| user_id | FK → users.id | ON DELETE RESTRICT |
| hall_id | FK → halls.id | ON DELETE RESTRICT |
| event_name | VARCHAR(160) NOT NULL | |
| event_type | VARCHAR(64) NOT NULL | |
| start_at | DATETIME(3) NOT NULL | UTC |
| end_at | DATETIME(3) NOT NULL | UTC; CHECK (end_at > start_at) |
| guest_count | INT UNSIGNED | Must be `<= halls.capacity` — enforced at creation and rechecked at approval |
| quoted_amount | DECIMAL(10,2) | |
| status | ENUM('pending','approved','rejected','cancelled','completed') NOT NULL | default `pending` |
| customer_notes | TEXT | |
| admin_notes | TEXT | |
| reviewed_by | FK → users.id NULL | ON DELETE RESTRICT — referenced users cannot be hard-deleted while review records exist |
| reviewed_at | DATETIME(3) NULL | UTC |
| created_at / updated_at | DATETIME(3) | defaults per conventions |

Indexes:

- `(hall_id, status, start_at, end_at)` — overlap checks on approved bookings
- `(user_id, created_at)` — customer booking history
- `(status)` — admin queue filters
- `(status, start_at)` — reports and dashboard ranges

Overlap is **not** enforced only by a unique index; Devin must enforce it in a transaction with row locks (`SELECT ... FOR UPDATE` on the `halls` row) on approve and on maintenance create/update, because pending rows may overlap until one is approved.

### booking_events

Audit trail for status changes.

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| booking_id | FK → bookings.id | ON DELETE CASCADE |
| actor_id | FK → users.id | ON DELETE RESTRICT — audit rows pin the acting user; users cannot be hard-deleted while events exist |
| from_status | VARCHAR(32) NULL | |
| to_status | VARCHAR(32) NOT NULL | |
| note | TEXT | |
| created_at | DATETIME(3) | default `CURRENT_TIMESTAMP(3)` |

### maintenance_windows

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| hall_id | FK → halls.id | ON DELETE CASCADE |
| title | VARCHAR(160) NOT NULL | |
| reason | TEXT | |
| start_at | DATETIME(3) NOT NULL | UTC |
| end_at | DATETIME(3) NOT NULL | UTC; CHECK (end_at > start_at) |
| status | ENUM('scheduled','in_progress','completed','cancelled') NOT NULL | |
| created_by | FK → users.id | ON DELETE RESTRICT — audit integrity; users cannot be hard-deleted while windows exist |
| created_at / updated_at | DATETIME(3) | defaults per conventions |

Indexes:

- `(hall_id, status, start_at, end_at)` — overlap checks for `scheduled`/`in_progress` windows

## Availability

A hall is unavailable for a requested `[start_at, end_at)` range when any of these overlap:

- An `approved` booking on that hall
- A `scheduled` or `in_progress` maintenance window on that hall
- The hall's own `status` is `inactive` or `maintenance` (whole-hall block, independent of windows)

`pending` bookings never block availability. `completed`/`cancelled`/`rejected` bookings and `completed`/`cancelled` maintenance do not block.

Booking creation also requires `guest_count <= halls.capacity`; this is rechecked inside the approval transaction (capacity may have changed since the request).

## refresh_tokens

Stores rotating refresh tokens for session management. Raw tokens are **never** stored — only their SHA-256 hash.

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| user_id | FK → users.id | ON DELETE CASCADE |
| family_id | CHAR(36) NOT NULL | UUID grouping all tokens rotated from one login session |
| token_hash | CHAR(64) NOT NULL UNIQUE | SHA-256 hex digest of the token |
| parent_id | BIGINT NULL | self-FK → refresh_tokens.id `ON DELETE RESTRICT`; the token this one replaced |
| expires_at | DATETIME(3) NOT NULL | UTC; sliding ~30-day TTL reset on each rotation |
| revoked_at | DATETIME(3) NULL | set on logout or family revocation |
| created_at | DATETIME(3) | default `CURRENT_TIMESTAMP(3)` |

Constraints and indexes:

- `UNIQUE(token_hash)` — lookup by presented token
- `UNIQUE(parent_id)` — a token can be replaced by at most one successor; MySQL allows multiple NULLs, so unrotated tokens coexist
- `(user_id, family_id)` — family revocation lookups
- `(expires_at)` — expiry sweeps

Retention and cleanup policy:

- Normal expiry cleanup must **not** hard-delete individual token rows. Expired tokens are marked (`revoked_at` set, or a dedicated `expired` state) while their rotation history is retained — reuse detection depends on being able to see that a presented token hash was already rotated or revoked.
- Token-family records are preserved so reuse detection remains possible for the family's full lifetime.
- Any future purge of token records must follow a defined retention policy and operate on **entire token families at once** — never delete a single rotated token while its family members survive, since `UNIQUE(parent_id)` and the rotation chain would be corrupted. Deleting whole families is safe only after the retention window has elapsed.

Rotation protocol (inside a transaction with `SELECT ... FOR UPDATE` on the token row):

1. Client presents refresh token; server hashes it and locks the matching row.
2. If `revoked_at` is set or `parent_id` chain shows it was already rotated → **reuse detected**: revoke every token in that `family_id` and return 401 (possible token theft).
3. Otherwise mark the old row `revoked_at = NOW(3)` and insert the successor row (`parent_id` = old id, same `family_id`, new `token_hash`, fresh `expires_at`). Commit atomically — a token can never be both valid and rotated.
4. Logout sets `revoked_at` on the presented token's whole family and clears the cookie.

Seed one active admin user in a migration/seed (hash only, never plaintext in git).
