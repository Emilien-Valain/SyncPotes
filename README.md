# SyncPotes

Find when a group of friends is free. SyncPotes shows **who** is free at each
time, never **why** anyone is busy — event contents are deliberately never read.

See [`CONTEXT.md`](./CONTEXT.md) for the domain language and
[`docs/adr/`](./docs/adr) for architectural decisions. The full product spec and
visual direction live in [`docs/design-brief.md`](./docs/design-brief.md).

## Status

- **Front-end (this milestone): done.** A faithful implementation of the
  `SyncPotes.dc.html` design — all eight screens (create · share · join · manual
  · heat · people · empty · edge), live-join simulation, bottom-sheet, toast,
  threshold controls, light/dark themes. Driven by a demo model in
  `lib/syncpotes-model.ts`.
- **Backend API: done.** Google `freeBusy` + Postgres behind an **Effect-TS IO
  boundary** (see `docs/adr/0001-effect-ts-at-io-boundary.md`). Builds clean;
  every typed-error path (validation → 400, not-found → 404, expired → 410,
  provider → 502, config/db → 500) verified at runtime. Happy path needs a real
  Postgres + Google OAuth creds to exercise.
- **Front-end wired to the API: done.** Real routes replace the single-page demo:
  - `/` — create a Poll (`components/CreatePoll.tsx` → `POST /api/polls`), then
    routes to the new Poll.
  - `/p/[slug]` — the live Poll (`app/p/[slug]/page.tsx` server-fetches heatmap +
    participants via the runtime; `components/PollView.tsx` renders them). Live
    threshold control (refetches), Google + manual join, share, people view, and
    a 5s poll so the map warms up as friends join. Missing/expired Polls render
    graceful states.
  - `/demo` — the original self-contained showcase (all eight screens, no backend).

  Builds clean; pages render and the RSC degrades gracefully to an error state
  when the DB is unreachable.
- **End-to-end verified against a live Postgres (2026-07-28).** Create → join
  (manual) → heatmap → participants → Organizer badge → remove me → cron cleanup
  and cascade, all exercised against a real database, plus the 400/403/404/410
  error paths. **The Google leg is still unexercised** — it needs a real OAuth
  app; only its config-error path (`500 server misconfigured: GOOGLE_CLIENT_ID`)
  has been hit. [`docs/deployment.md`](./docs/deployment.md) creates the OAuth
  app and lists what to check once it exists.

### Identity without accounts

Participant ids are public — they ship inside every heatmap cell — so the caller
is identified by HttpOnly, per-Poll cookies (`sp_org_<slug>`, `sp_me_<slug>`)
rather than by anything in the request body. That is what makes the Organizer
badge, "remove me", and idempotent re-joins safe. See
[`docs/adr/0002-cookie-scoped-participant-identity.md`](./docs/adr/0002-cookie-scoped-participant-identity.md).

A third cookie, `sp_oauth_<slug>`, holds a one-shot nonce for the Google consent
flow. The OAuth `state` parameter carries `<nonce>:<slug>`, and the callback
refuses any `state` whose nonce does not match the cookie. Without that check a
forged callback would attach a stranger's calendar to the victim's browser and
delete the row it owned — see the comment in `lib/server/oauth-state.ts`.

### Backend shape

```
lib/server/
  errors.ts    typed errors (AppError union) → HTTP status in runtime.ts
  db.ts        Db service — pooled Postgres wrapped in Effect (scoped)
  google.ts    GoogleCalendar service — authUrl / exchangeCode / freeBusy over fetch
  time.ts      timezone → UTC slot math; busy intervals → free-slot set
  identity.ts  per-Poll HttpOnly cookies → JoinContext (see ADR-0002)
  oauth-state.ts  pure `state` codec + nonce compare, guarding the OAuth callback
  polls.ts     domain programs (createPoll, getPoll, getHeatmap, joinManual, joinGoogle,
               removeParticipant, cleanup)
  runtime.ts   ManagedRuntime + exhaustive typed-error → Response mapping
```

API routes: `POST /api/polls` · `GET /api/polls/[slug]?threshold=` ·
`GET /api/polls/[slug]/participants` · `POST /api/polls/[slug]/manual` ·
`DELETE /api/polls/[slug]/me` · `GET /api/polls/[slug]/google/start` ·
`GET /api/auth/google/callback` · `GET /api/cron/cleanup` (Vercel Cron,
`vercel.json`).

We persist only derived free/busy at grid resolution — never event content,
never OAuth refresh tokens (v1 uses `access_type=online`). The Semgrep rules in
`.semgrep.yml` guard both.

### Backend setup

```bash
cp .env.example .env.local     # fill in Google creds, DATABASE_URL, CRON_SECRET
npm run db:setup               # apply db/schema.sql to $DATABASE_URL
```

To deploy, follow [`docs/deployment.md`](./docs/deployment.md). It covers Vercel,
Neon Postgres, the Google OAuth client, the cron secret, and the audience choice
that decides who can join with Google.

> Verified: `npm install` + `next build` pass cleanly on Next.js 15.5.22
> (type-checked, lint-clean, all routes prerendered). The critical Next.js CVE in
> the initial 15.1.6 pin was resolved by the bump to 15.5.22.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for the pure slot/heatmap logic
```

> Run only one `next dev` per checkout — two share the same `.next` and will
> fight over it, and `npm run build` overwrites what a running dev server is
> serving (restart it afterwards).

- `/` — create a Poll (needs a DATABASE_URL to actually submit; see setup below).
- `/p/[slug]` — a live Poll: heatmap, threshold, Google/manual join, share.
- `/demo` — the backend-free design showcase. Top nav jumps between the eight
  screens; ☾/☀ toggles theme; opening **Dispos** triggers the live-join demo.

## Stack

Next.js (App Router) · React 19 · TypeScript · Vercel-ready. Tooling: ESLint,
Husky + lint-staged, Semgrep (`.semgrep.yml` includes SyncPotes-specific privacy
rules — no reading of calendar event content, no refresh-token persistence in
v1). Install Semgrep separately: `uv tool install semgrep`, or `pipx install
semgrep` where pipx is available. CI installs it with pip.

Deployment: see [`docs/deployment.md`](./docs/deployment.md).
