-- Money Book schema. Run with: npm run db:setup  (every statement is idempotent)

CREATE TABLE IF NOT EXISTS users (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(40)  NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (email)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64)  NOT NULL PRIMARY KEY,
  user_id    INT       NOT NULL,
  expires_at BIGINT    NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- One row per person: the money sign they like, and the money they already
-- had on the day they started the book. Amounts are whole minor units
-- (6500 = 65.00), so adding them up never produces rounding errors.
CREATE TABLE IF NOT EXISTS settings (
  user_id            INT        NOT NULL PRIMARY KEY,
  currency           VARCHAR(4) NOT NULL DEFAULT '',
  start_date         DATE       NULL,
  start_amount_minor BIGINT     NULL,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- One row per line in the book. kind: 'out' = spent, 'in' = received.
-- The index serves every read: "this person's entries in this date range".
CREATE TABLE IF NOT EXISTS entries (
  id           BIGINT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT               NOT NULL,
  entry_date   DATE              NOT NULL,
  kind         ENUM('out', 'in') NOT NULL,
  label        VARCHAR(40)       NOT NULL,
  amount_minor BIGINT            NOT NULL,
  created_at   TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entry_user_date (user_id, entry_date),
  CONSTRAINT fk_entry_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_entry_amount CHECK (amount_minor > 0)
)
-- On TiDB, hand out ids in order so entries on one day keep the order they
-- were written in. MySQL reads this as a comment and ignores it.
/*T![auto_id_cache] AUTO_ID_CACHE = 1 */;

-- What happened in each book, oldest first: every change to an entry or the
-- settings, restores, erases and log-ins. `detail` keeps a copy of the entry
-- as it was, so a line still reads right after the entry itself is gone.
-- `at` is milliseconds since 1970, like sessions.expires_at.
CREATE TABLE IF NOT EXISTS history (
  id       BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id  INT         NOT NULL,
  at       BIGINT      NOT NULL,
  action   VARCHAR(20) NOT NULL,
  entry_id BIGINT      NULL,
  detail   JSON        NULL,
  KEY idx_history_user (user_id, id),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
/*T![auto_id_cache] AUTO_ID_CACHE = 1 */;

-- Recent log-in and sign-up attempts, counted by lib/limiter.js. Kept here
-- rather than in memory so every server process and every restart sees the
-- same count. key_hash is a SHA-256 of the key, so no email address is stored.
CREATE TABLE IF NOT EXISTS attempts (
  id       BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  key_hash CHAR(64) NOT NULL,
  at       BIGINT   NOT NULL,
  KEY idx_attempt_key (key_hash, at)
);
