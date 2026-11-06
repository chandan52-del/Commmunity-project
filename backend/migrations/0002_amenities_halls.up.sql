-- 0002: amenities + halls

CREATE TABLE amenities (
  id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80)     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_amenities_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE halls (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(160)    NOT NULL,
  slug            VARCHAR(180)    NOT NULL,
  description     TEXT            NULL,
  location        VARCHAR(255)    NULL,
  capacity        INT UNSIGNED    NOT NULL,
  base_price      DECIMAL(10,2)   NOT NULL,
  status          ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  cover_image_url VARCHAR(512)    NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_halls_slug (slug),
  CONSTRAINT chk_halls_capacity  CHECK (capacity > 0),
  CONSTRAINT chk_halls_base_price CHECK (base_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
