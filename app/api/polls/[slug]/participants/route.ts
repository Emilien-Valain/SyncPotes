import { listParticipants } from "@/lib/server/polls";
import { readMe } from "@/lib/server/identity";
import { runJson } from "@/lib/server/runtime";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return runJson(listParticipants(slug, await readMe(slug)));
}
