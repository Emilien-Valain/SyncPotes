import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// Who the caller is for a given Poll, without accounts.
//
// SyncPotes has no login: anyone with the link can read the grid, and every
// participant id is already visible in it. Identity therefore cannot be
// client-asserted — otherwise "remove me" would remove anyone. Instead the
// server sets two HttpOnly cookies scoped to one Poll:
//
//   sp_org_<slug>  "1"   — this browser created the Poll (→ Organizer)
//   sp_me_<slug>   uuid  — the participant row this browser owns, so a re-join
//                          updates that row instead of adding a twin, and only
//                          its owner can remove it.
//
// SameSite=Lax survives the top-level GET redirect back from Google's consent
// screen, which is the one cross-site navigation in the product.

const ORG = (slug: string) => `sp_org_${slug}`;
const ME = (slug: string) => `sp_me_${slug}`;

// Long enough to outlive any Poll (they self-delete 7 days after their last
// date), short enough not to linger forever in a shared browser.
const MAX_AGE = 60 * 60 * 24 * 90;

export interface JoinContext {
  /** Participant row this browser already owns in this Poll, if any. */
  participantId?: string;
  /** This browser created the Poll. */
  organizer?: boolean;
}

/** Read the caller's identity for `slug`. Safe in Route Handlers and RSCs. */
export async function readIdentity(slug: string): Promise<JoinContext> {
  const jar = await cookies();
  return {
    participantId: jar.get(ME(slug))?.value,
    organizer: jar.get(ORG(slug))?.value === "1",
  };
}

/** The participant id this browser owns in `slug`, or undefined. */
export async function readMe(slug: string): Promise<string | undefined> {
  return (await cookies()).get(ME(slug))?.value;
}

const base = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

export function markOrganizer(res: NextResponse, slug: string): NextResponse {
  // False positive: SameSite is "lax" via `base` above; the rule is Koa-shaped
  // and cannot see through the spread.
  // nosemgrep: javascript.koa.web.cookies-samesite-missing-koa.cookies-samesite-missing-koa
  res.cookies.set(ORG(slug), "1", { ...base, maxAge: MAX_AGE });
  return res;
}

export function markParticipant(res: NextResponse, slug: string, id: string): NextResponse {
  res.cookies.set(ME(slug), id, { ...base, maxAge: MAX_AGE });
  return res;
}

export function clearParticipant(res: NextResponse, slug: string): NextResponse {
  // False positive: see markOrganizer.
  // nosemgrep: javascript.koa.web.cookies-samesite-missing-koa.cookies-samesite-missing-koa
  res.cookies.set(ME(slug), "", { ...base, maxAge: 0 });
  return res;
}
