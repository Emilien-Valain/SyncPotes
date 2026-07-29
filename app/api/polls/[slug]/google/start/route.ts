import { Effect } from "effect";
import { GoogleCalendar } from "@/lib/server/google";
import { markOauthState } from "@/lib/server/identity";
import { encodeState, newNonce } from "@/lib/server/oauth-state";
import { getPoll } from "@/lib/server/polls";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

// Verify the Poll is live, then send the friend to Google's consent screen with
// `<nonce>:<slug>` in `state`. The nonce also goes into an HttpOnly cookie, so
// the callback can prove the flow started in this browser (see oauth-state.ts).
// Like the callback, this is a top-level navigation: failures go back to the
// Poll page, not to a JSON body.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const nonce = newNonce();
  const program = Effect.gen(function* () {
    yield* getPoll(slug);
    const google = yield* GoogleCalendar;
    return yield* google.authUrl(encodeState(nonce, slug));
  });

  const result = await runData(program);
  if (result.ok) return markOauthState(NextResponse.redirect(result.value), slug, nonce);

  // Not an open redirect: the target is this request's own origin plus a fixed
  // /p/<slug> path, and the slug is encoded. No attacker-chosen host or path can
  // reach the Location header.
  const origin = new URL(req.url).origin;
  // nosemgrep: javascript.hapi.web.tainted-redirect-hapi.tainted-redirect-hapi
  return NextResponse.redirect(`${origin}/p/${encodeURIComponent(slug)}?join=failed`);
}
