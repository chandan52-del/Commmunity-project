# Database plan (MySQL 8)

Devin implements this schema with **migrations**, **foreign keys**, **indexes**, and **constraints**. Do not apply schema from ad-hoc scripts in production. This file is documentation only, not executable SQL owned by the frontend.

## Conventions

- Engine: InnoDB, charset `utf8mb4`
- Primary keys: `BIGINT UNSIGNED AUTO_INCREMENT`
- Timestamps: `created_at`, `updated_at`
- Money: `DECIMAL(10,2)`
- Datetimes stored in UTC

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
| created_at | DATETIME | |
| updated_at | DATETIME | |

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
| status | ENUM('active','inactive','maintenance') NOT NULL | |
| cover_image_url | VARCHAR(512) NULL | URL only in V1 |
| created_at / updated_at | DATETIME | |

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

### bookings

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| booking_ref | VARCHAR(32) NOT NULL UNIQUE | e.g. CH-2026-00041 |
| user_id | FK → users.id | ON DELETE RESTRICT |
| hall_id | FK → halls.id | ON DELETE RESTRICT |
| event_name | VARCHAR(160) NOT NULL | |
| event_type | VARCHAR(64) NOT NULL | |
| start_at | DATETIME NOT NULL | |
| end_at | DATETIME NOT NULL | CHECK (end_at > start_at) |
| guest_count | INT UNSIGNED | |
| quoted_amount | DECIMAL(10,2) | |
| status | ENUM('pending','approved','rejected','cancelled','completed') NOT NULL | default `pending` |
| customer_notes | TEXT | |
| admin_notes | TEXT | |
| reviewed_by | FK → users.id NULL | |
| reviewed_at | DATETIME NULL | |
| created_at / updated_at | DATETIME | |

Indexes:

- `(hall_id, start_at, end_at)`
- `(user_id, created_at)`
- `(status)`

Overlap is **not** enforced only by a unique index; Devin must enforce it in a transaction with row locks on approve, because pending rows may overlap until one is approved.

### booking_events

Audit trail for status changes.

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| booking_id | FK → bookings.id | ON DELETE CASCADE |
| actor_id | FK → users.id | |
| from_status | VARCHAR(32) NULL | |
| to_status | VARCHAR(32) NOT NULL | |
| note | TEXT | |
| created_at | DATETIME | |

### maintenance_windows

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | |
| hall_id | FK → halls.id | ON DELETE CASCADE |
| title | VARCHAR(160) NOT NULL | |
| reason | TEXT | |
| start_at | DATETIME NOT NULL | |
| end_at | DATETIME NOT NULL | CHECK (end_at > start_at) |
| status | ENUM('scheduled','in_progress','completed','cancelled') NOT NULL | |
| created_by | FK → users.id | |
| created_at / updated_at | DATETIME | |

Index: `(hall_id, start_at, end_at, status)`

## Availability

Busy = approved booking overlap OR maintenance in `scheduled` / `in_progress` that overlaps. Pending bookings are ignored for blocking.

Seed one active admin user in a migration/seed (hash only, never plaintext in git).
