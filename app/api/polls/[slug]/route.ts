import { getHeatmap } from "@/lib/server/polls";
import { runJson } from "@/lib/server/runtime";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = new URL(req.url).searchParams.get("threshold");
  const threshold = t !== null && Number.isFinite(Number(t)) ? Number(t) : undefined;
  return runJson(getHeatmap(slug, threshold));
}
