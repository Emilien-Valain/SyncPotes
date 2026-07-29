import { Effect } from "effect";
import { GoogleCalendar } from "@/lib/server/google";
import { getPoll } from "@/lib/server/polls";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

// Verify the Poll is live, then send the friend to Google's consent screen with
// the Poll slug carried in `state` (the redirect URI is fixed — see callback).
// Like the callback, this is a top-level navigation: failures go back to the
// Poll page, not to a JSON body.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = Effect.gen(function* () {
    yield* getPoll(slug);
    const google = yield* GoogleCalendar;
    return yield* google.authUrl(slug);
  });

  const result = await runData(program);
  if (result.ok) return NextResponse.redirect(result.value);

  // Not an open redirect: the target is this request's own origin plus a fixed
  // /p/<slug> path, and the slug is encoded. No attacker-chosen host or path can
  // reach the Location header.
  const origin = new URL(req.url).origin;
  // nosemgrep: javascript.hapi.web.tainted-redirect-hapi.tainted-redirect-hapi
  return NextResponse.redirect(`${origin}/p/${encodeURIComponent(slug)}?join=failed`);
}
