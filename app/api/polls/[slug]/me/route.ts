import { getMe, removeParticipant } from "@/lib/server/polls";
import { clearParticipant, readMe } from "@/lib/server/identity";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

// The caller's own row, slots included, so the client can pre-fill "modifier mes
// dispos". Same authorization as DELETE: the sp_me_<slug> cookie, never an id
// from the request.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await readMe(slug);
  if (!me) return NextResponse.json({ error: "not a participant" }, { status: 403 });

  const result = await runData(getMe(slug, me));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  // Cookie survived the row it points at.
  if (!result.value) return NextResponse.json({ error: "not a participant" }, { status: 403 });

  return NextResponse.json(result.value);
}

// "Remove me": drops the caller's own participant row and, by cascade, every
// slot they contributed. Authorized by the HttpOnly sp_me_<slug> cookie, never
// by an id from the request — participant ids are public in the grid.
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await readMe(slug);
  if (!me) return NextResponse.json({ error: "not a participant" }, { status: 403 });

  const result = await runData(removeParticipant(slug, me));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return clearParticipant(NextResponse.json(result.value), slug);
}
