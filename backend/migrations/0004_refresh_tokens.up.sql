-- 0004: refresh_tokens (rotating refresh-token session families)
-- Stores SHA-256 hashes only — never raw tokens.

CREATE TABLE refresh_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  family_id  CHAR(36)        NOT NULL,
  token_hash CHAR(64)        NOT NULL,
  parent_id  BIGINT UNSIGNED NULL,
  expires_at DATETIME(3)     NOT NULL,
  revoked_at DATETIME(3)     NULL,
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash   (token_hash),
  UNIQUE KEY uq_refresh_tokens_parent (parent_id),
  KEY idx_refresh_tokens_user_family  (user_id, family_id),
  KEY idx_refresh_tokens_expires      (expires_at),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_tokens_parent
    FOREIGN KEY (parent_id) REFERENCES refresh_tokens (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
