-- CANARY — must trip `no-refresh-token-column`.
CREATE TABLE canary_participants (
  id            uuid PRIMARY KEY,
  refresh_token text NOT NULL
);
