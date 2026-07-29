import { joinGoogle } from "@/lib/server/polls";
import {
  clearOauthState,
  markParticipant,
  readIdentity,
  readOauthNonce,
} from "@/lib/server/identity";
import { decodeState, nonceMatches } from "@/lib/server/oauth-state";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

// Fixed Google redirect target. `state` carries `<nonce>:<slug>`. Every outcome —
// consent denied, forged state, token exchange failed, Poll expired — has to land
// the friend back on the Poll's own page: this is a top-level browser navigation,
// so a JSON error body would be rendered as the whole page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const state = decodeState(url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");

  // Without a slug there is no Poll to return to; the create screen is the only
  // sensible landing.
  const home = () => NextResponse.redirect(`${origin}/`);
  if (!state) return home();

  const { nonce, slug } = state;
  // The nonce is spent whatever happens next, so clear it on every response.
  const back = (query: string) =>
    clearOauthState(
      // Not an open redirect: same origin, fixed /p/ path, encoded slug.
      // nosemgrep: javascript.hapi.web.tainted-redirect-hapi.tainted-redirect-hapi
      NextResponse.redirect(`${origin}/p/${encodeURIComponent(slug)}?${query}`),
      slug,
    );

  if (denied || !code) return back("join=failed");

  // Proof that this browser started the flow. Without it, a forged callback
  // would attach a stranger's calendar to this browser and delete the row it
  // owned — see oauth-state.ts.
  const expected = await readOauthNonce(slug);
  if (!expected || !nonceMatches(nonce, expected)) return back("join=failed");

  const ctx = await readIdentity(slug);
  const result = await runData(joinGoogle(slug, code, ctx));
  if (!result.ok) return back("join=failed");

  return markParticipant(back("joined=1"), slug, result.value.id);
}
