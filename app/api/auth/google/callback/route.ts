import { joinGoogle } from "@/lib/server/polls";
import { markParticipant, readIdentity } from "@/lib/server/identity";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

// Fixed Google redirect target. `state` carries the Poll slug. Every outcome —
// consent denied, token exchange failed, Poll expired — has to land the friend
// back on the Poll's own page: this is a top-level browser navigation, so a
// JSON error body would be rendered as the whole page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const slug = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");

  // Without a slug there is no Poll to return to; the create screen is the only
  // sensible landing.
  const back = (query: string) =>
    NextResponse.redirect(slug ? `${origin}/p/${encodeURIComponent(slug)}?${query}` : `${origin}/`);

  if (denied || !code || !slug) return back("join=failed");

  const ctx = await readIdentity(slug);
  const result = await runData(joinGoogle(slug, code, ctx));
  if (!result.ok) return back("join=failed");

  return markParticipant(back("joined=1"), slug, result.value.id);
}
