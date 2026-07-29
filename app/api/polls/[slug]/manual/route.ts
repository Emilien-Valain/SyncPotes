import { joinManual } from "@/lib/server/polls";
import { markParticipant, readIdentity } from "@/lib/server/identity";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; free?: string[] };
  const free = Array.isArray(body.free) ? body.free.map(String) : [];

  const ctx = await readIdentity(slug);
  const result = await runData(joinManual(slug, String(body.name ?? ""), free, ctx));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return markParticipant(NextResponse.json(result.value), slug, result.value.id);
}
