import { createPoll, type CreatePollInput } from "@/lib/server/polls";
import { markOrganizer } from "@/lib/server/identity";
import { runData } from "@/lib/server/runtime";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<CreatePollInput>;
  const result = await runData(
    createPoll({
      name: String(body.name ?? ""),
      timezone: String(body.timezone ?? "Europe/Paris"),
      threshold: Number(body.threshold ?? 3),
      dayStartHour: Number(body.dayStartHour ?? 18),
      dayEndHour: Number(body.dayEndHour ?? 23),
      dates: Array.isArray(body.dates) ? body.dates.map(String) : [],
    }),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // The creator is the Organizer — remembered here so the badge survives
  // whichever way they later contribute their own availability.
  return markOrganizer(NextResponse.json(result.value), result.value.slug);
}
