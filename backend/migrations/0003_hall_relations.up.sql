-- 0003: hall_amenities + hall_images

CREATE TABLE hall_amenities (
  hall_id    BIGINT UNSIGNED NOT NULL,
  amenity_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (hall_id, amenity_id),
  CONSTRAINT fk_hall_amenities_hall
    FOREIGN KEY (hall_id) REFERENCES halls (id) ON DELETE CASCADE,
  CONSTRAINT fk_hall_amenities_amenity
    FOREIGN KEY (amenity_id) REFERENCES amenities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hall_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hall_id    BIGINT UNSIGNED NOT NULL,
  image_url  VARCHAR(512)    NOT NULL,
  sort_order INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_hall_images_hall_sort (hall_id, sort_order),
  CONSTRAINT fk_hall_images_hall
    FOREIGN KEY (hall_id) REFERENCES halls (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
