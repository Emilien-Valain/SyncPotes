import { Effect } from "effect";
import { ConfigError, GoogleError } from "./errors";

// Google Calendar boundary as an Effect service. Three operations, all over
// plain fetch:
//   authUrl      — build the consent URL (online access → no refresh token, v1)
//   exchangeCode — swap the auth code for an access token + the account's stable
//                  id/name from the id_token
//   freeBusy     — query busy intervals for the primary calendar (only busy/free
//                  crosses the wire — never titles, attendees, or locations)

export interface GoogleIdentity {
  sub: string; // stable Google account id, used only to dedupe re-joins
  name: string;
  accessToken: string;
}

export interface BusyInterval {
  start: string; // RFC3339
  end: string;
}

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const part = idToken.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

interface Credentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Read at call time, not at layer construction: a deployment that never wires
// Google must still be able to create polls and record manual availability.
// Only the operations that actually talk to Google can fail with ConfigError.
const credentials: Effect.Effect<Credentials, ConfigError> = Effect.gen(function* () {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId) return yield* new ConfigError({ key: "GOOGLE_CLIENT_ID" });
  if (!clientSecret) return yield* new ConfigError({ key: "GOOGLE_CLIENT_SECRET" });
  if (!redirectUri) return yield* new ConfigError({ key: "GOOGLE_REDIRECT_URI" });
  return { clientId, clientSecret, redirectUri };
});

export class GoogleCalendar extends Effect.Service<GoogleCalendar>()("app/GoogleCalendar", {
  sync: () => {
    const authUrl = (state: string): Effect.Effect<string, ConfigError> =>
      Effect.gen(function* () {
        const { clientId, redirectUri } = yield* credentials;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          access_type: "online", // no refresh token — v1 is ephemeral
          scope: SCOPES,
          state,
          prompt: "select_account",
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      });

    const postForm = (url: string, body: URLSearchParams) =>
      Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          }),
        catch: (cause) => new GoogleError({ message: "network error", cause }),
      });

    const exchangeCode = (code: string): Effect.Effect<GoogleIdentity, GoogleError | ConfigError> =>
      Effect.gen(function* () {
        const { clientId, clientSecret, redirectUri } = yield* credentials;
        const res = yield* postForm(
          "https://oauth2.googleapis.com/token",
          new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        );
        if (!res.ok) {
          const text = yield* Effect.promise(() => res.text());
          return yield* new GoogleError({ message: `token exchange failed: ${res.status} ${text}` });
        }
        const json = (yield* Effect.tryPromise({
          try: () => res.json() as Promise<{ access_token?: string; id_token?: string }>,
          catch: (cause) => new GoogleError({ message: "bad token response", cause }),
        }));
        if (!json.access_token || !json.id_token) {
          return yield* new GoogleError({ message: "token response missing fields" });
        }
        const claims = decodeJwtPayload(json.id_token);
        const sub = typeof claims.sub === "string" ? claims.sub : "";
        const email = typeof claims.email === "string" ? claims.email : "";
        const name =
          (typeof claims.name === "string" && claims.name) ||
          (email ? email.split("@")[0] : "") ||
          "Pote";
        if (!sub) return yield* new GoogleError({ message: "id_token missing sub" });
        return { sub, name, accessToken: json.access_token };
      });

    const freeBusy = (
      accessToken: string,
      timeMin: string,
      timeMax: string,
      timeZone: string,
    ): Effect.Effect<BusyInterval[], GoogleError> =>
      Effect.gen(function* () {
        const res = yield* Effect.tryPromise({
          try: () =>
            fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ timeMin, timeMax, timeZone, items: [{ id: "primary" }] }),
            }),
          catch: (cause) => new GoogleError({ message: "network error", cause }),
        });
        if (!res.ok) {
          const text = yield* Effect.promise(() => res.text());
          return yield* new GoogleError({ message: `freeBusy failed: ${res.status} ${text}` });
        }
        const json = (yield* Effect.tryPromise({
          try: () =>
            res.json() as Promise<{
              calendars?: { primary?: { busy?: BusyInterval[] } };
            }>,
          catch: (cause) => new GoogleError({ message: "bad freeBusy response", cause }),
        }));
        return json.calendars?.primary?.busy ?? [];
      });

    return { authUrl, exchangeCode, freeBusy } as const;
  },
}) {}
