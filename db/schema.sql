-- SyncPotes schema. Apply with: psql "$DATABASE_URL" -f db/schema.sql
--
-- We store only derived availability at grid resolution (which slots a person
-- is FREE), never raw calendar events and never OAuth tokens. A Poll and all
-- its data auto-expire 7 days after its last date (see cleanup_expired()).

CREATE TABLE IF NOT EXISTS polls (
  slug            text PRIMARY KEY,
  name            text        NOT NULL,
  timezone        text        NOT NULL,
  threshold       int         NOT NULL CHECK (threshold >= 1),
  day_start_hour  int         NOT NULL CHECK (day_start_hour BETWEEN 0 AND 23),
  day_end_hour    int         NOT NULL CHECK (day_end_hour BETWEEN 1 AND 24),
  dates           date[]      NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  CHECK (day_end_hour > day_start_hour)
);

CREATE TABLE IF NOT EXISTS participants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_slug   text        NOT NULL REFERENCES polls(slug) ON DELETE CASCADE,
  name        text        NOT NULL,
  mode        text        NOT NULL CHECK (mode IN ('google', 'manual')),
  organizer   boolean     NOT NULL DEFAULT false,
  -- Google 'sub' (stable account id) is used only to dedupe re-joins; it is
  -- never shown to anyone. Null for manual participants.
  google_sub  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_slug, google_sub)
);

CREATE TABLE IF NOT EXISTS free_slots (
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  slot_date      date NOT NULL,
  slot_hour      int  NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
  PRIMARY KEY (participant_id, slot_date, slot_hour)
);

CREATE INDEX IF NOT EXISTS participants_poll_idx ON participants (poll_slug);
CREATE INDEX IF NOT EXISTS polls_expires_idx ON polls (expires_at);

-- Hard-delete everything belonging to Polls whose retention window has passed.
CREATE OR REPLACE FUNCTION cleanup_expired() RETURNS int AS $$
DECLARE deleted int;
BEGIN
  WITH gone AS (DELETE FROM polls WHERE expires_at < now() RETURNING slug)
  SELECT count(*) INTO deleted FROM gone;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
