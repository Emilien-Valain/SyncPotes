# ADR-0002 — Participant identity is a per-Poll HttpOnly cookie

**Status:** accepted (2026-07-28)

## Context

SyncPotes has no accounts: a Poll is shared by an unguessable link, and everyone
holding it sees the same grid. But three features need to know *which*
participant the caller is:

- **Organizer** — the person who created the Poll gets a badge (CONTEXT.md:
  "no special ongoing powers beyond creation").
- **Remove me** — a participant may withdraw their availability.
- **Re-join** — painting your slots twice, or connecting Google after joining by
  hand, must update your row rather than putting a twin in the grid.

The obvious shortcut is for the client to remember its own participant id
(localStorage) and send it. That does not work here: participant ids are *public*
— they ship inside every heatmap cell's `names[]` so the UI can key on them.
Anyone with the link could therefore remove anyone, or claim to be the Organizer.

A real auth system is disproportionate for a v1 whose whole premise is
"no account required".

## Decision

The server issues two HttpOnly cookies, scoped to one Poll each:

| Cookie          | Value  | Set when                        |
| --------------- | ------ | ------------------------------- |
| `sp_org_<slug>` | `"1"`  | this browser created the Poll   |
| `sp_me_<slug>`  | `uuid` | this browser joined the Poll    |

`SameSite=Lax` so they survive the one cross-site navigation in the product —
the top-level GET redirect back from Google's consent screen. `HttpOnly` so
client code cannot forge them. They are read in `lib/server/identity.ts` and
passed into the domain programs as a plain `JoinContext`, keeping `polls.ts` a
function of its inputs (consistent with ADR-0001: IO stays at the boundary).

`DELETE /api/polls/[slug]/me` takes **no id** — the route deletes whatever
`sp_me_<slug>` points at, so the id never has to be trusted from the request.
`GET /api/polls/[slug]/participants` marks the caller's own row with `isMe`, so
the client never has to guess either.

## Consequences

- Identity is per-browser, not per-person. Clearing cookies, or opening the link
  on a second device, makes you a new participant — you can still re-join, but
  the old row is orphaned until the Poll expires. Acceptable: the alternative is
  accounts.
- The Organizer badge only appears once the creator actually joins; a Poll whose
  creator never contributes availability simply has no Organizer row. This
  matches the domain language — an Organizer with no availability is not yet a
  Participant.
- `/p/[slug]` reads cookies and is therefore `force-dynamic` (it already was).
- Removing yourself is a hard delete, cascading to your `free_slots`. There is no
  undo, and no tombstone — consistent with the Poll's own 7-day hard expiry.
