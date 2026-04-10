-- Migration 082: Add users.uuid canonical external identifier
-- Part of userId architecture migration Phase 1
-- Architecture note: userid_migration_architecture.docx
-- Adds a uuid column, populates every existing row via default expression,
-- enforces uniqueness, indexes for lookup performance.

ALTER TABLE users
  ADD COLUMN uuid uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE users
  ADD CONSTRAINT users_uuid_unique UNIQUE (uuid);

CREATE INDEX idx_users_uuid ON users(uuid);
