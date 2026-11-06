-- 0006: booking_events (status-change audit trail)

CREATE TABLE booking_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id  BIGINT UNSIGNED NOT NULL,
  actor_id    BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32)     NULL,
  to_status   VARCHAR(32)     NOT NULL,
  note        TEXT            NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_booking_events_booking (booking_id),
  CONSTRAINT fk_booking_events_booking
    FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_events_actor
    FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
