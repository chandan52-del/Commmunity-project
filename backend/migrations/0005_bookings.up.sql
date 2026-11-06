-- 0005: bookings
-- booking_ref (CH-YYYY-NNNNN) is generated app-side after INSERT, inside the
-- creation transaction. Overlap is enforced by service-layer transactions with
-- row locks — not by a unique index (pending rows may overlap until approved).

CREATE TABLE bookings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_ref     VARCHAR(32)     NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  hall_id         BIGINT UNSIGNED NOT NULL,
  event_name      VARCHAR(160)    NOT NULL,
  event_type      VARCHAR(64)     NOT NULL,
  start_at        DATETIME(3)     NOT NULL,
  end_at          DATETIME(3)     NOT NULL,
  guest_count     INT UNSIGNED    NULL,
  quoted_amount   DECIMAL(10,2)   NULL,
  status          ENUM('pending','approved','rejected','cancelled','completed')
                  NOT NULL DEFAULT 'pending',
  customer_notes  TEXT            NULL,
  admin_notes     TEXT            NULL,
  reviewed_by     BIGINT UNSIGNED NULL,
  reviewed_at     DATETIME(3)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_ref (booking_ref),
  KEY idx_bookings_hall_overlap  (hall_id, status, start_at, end_at),
  KEY idx_bookings_user_history  (user_id, created_at),
  KEY idx_bookings_status        (status),
  KEY idx_bookings_status_start  (status, start_at),
  CONSTRAINT chk_bookings_time_range CHECK (end_at > start_at),
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_hall
    FOREIGN KEY (hall_id) REFERENCES halls (id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
