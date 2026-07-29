# Use Effect-TS at the IO boundary only

We adopt [Effect-TS](https://effect.website) for the IO layer of SyncPotes — the
Google Calendar client, Postgres access, and the scheduled cleanup job — and
keep the React/UI layer plain TypeScript. The driver is the Google `freeBusy`
integration, whose many typed failure modes (revoked consent, expired token,
429 rate-limiting, partial results), retry needs, and parallel per-friend
fetches are exactly what Effect's typed error channel, `Schedule`-based retries,
and structured concurrency handle well. A secondary, explicit goal is to learn
Effect on a problem that rewards it.

## Considered Options

- **Plain TypeScript everywhere.** Simplest; this app could ship in a weekend
  without Effect. Rejected because a learning goal was explicit, and the Google
  boundary genuinely benefits.
- **Effect all-in (including UI data flow).** Rejected for v1: too much surface
  to learn at once, and Effect's payoff is thin in the UI layer.
- **Effect at the edges (chosen).** Learn the core (`Effect`, `Layer`,
  `Schedule`, typed errors) where it pays off; leave the UI conventional.

## Consequences

- The IO layer is harder to reverse than the rest — Effect permeates whatever it
  touches. Undoing this means rewriting the Google/DB layer.
- Contributors need to know (or learn) Effect to touch the IO layer. The
  `niklaserik/effect-mcp` MCP server is wired up to keep docs close at hand.
- The boundary between "Effect land" (IO) and "plain land" (UI) must be kept
  explicit; blurring it is how Effect quietly spreads into the whole codebase.
