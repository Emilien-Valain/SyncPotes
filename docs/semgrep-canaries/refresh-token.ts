// CANARY — every line below must trip `no-refresh-token-persistence-v1`.
declare const db: { query: (sql: string, params?: unknown[]) => Promise<unknown> };

// the consent-URL switch that mints a refresh token
export const offlineParams = new URLSearchParams({ access_type: "offline" });
export const offlineAssign = "access_type=offline";

// a refresh token reaching persistence
export const persist = (token: string) =>
  db.query("INSERT INTO participants (refresh_token) VALUES ($1)", [token]);
