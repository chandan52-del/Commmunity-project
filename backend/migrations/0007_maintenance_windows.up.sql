-- 0007: maintenance_windows
-- scheduled/in_progress windows block availability; overlap vs approved
-- bookings is enforced by service-layer transactions with hall-row locks.

CREATE TABLE maintenance_windows (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hall_id    BIGINT UNSIGNED NOT NULL,
  title      VARCHAR(160)    NOT NULL,
  reason     TEXT            NULL,
  start_at   DATETIME(3)     NOT NULL,
  end_at     DATETIME(3)     NOT NULL,
  status     ENUM('scheduled','in_progress','completed','cancelled') NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_maintenance_hall_overlap (hall_id, status, start_at, end_at),
  CONSTRAINT chk_maintenance_time_range CHECK (end_at > start_at),
  CONSTRAINT fk_maintenance_hall
    FOREIGN KEY (hall_id) REFERENCES halls (id) ON DELETE CASCADE,
  CONSTRAINT fk_maintenance_creator
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
