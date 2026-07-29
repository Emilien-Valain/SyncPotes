import Link from "next/link";
import PollView from "@/components/PollView";
import { getHeatmap, listParticipants } from "@/lib/server/polls";
import { readMe } from "@/lib/server/identity";
import { runData } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

function Msg({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", display: "grid", placeItems: "center", padding: "24px" }}>
      <div style={{ maxWidth: "34ch", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px,7vw,40px)", letterSpacing: "-0.03em", margin: "0 0 10px" }}>{title}</h1>
        <p style={{ color: "var(--ink2)", fontSize: "15px", textWrap: "pretty" }}>{body}</p>
        <Link href="/" style={{ display: "inline-block", marginTop: "16px", padding: "13px 18px", borderRadius: 14, background: "var(--accent)", color: "var(--accentInk)", fontFamily: "var(--font-display)", fontWeight: 700 }}>Créer un sondage</Link>
      </div>
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const heat = await runData(getHeatmap(slug));
  if (!heat.ok) {
    if (heat.status === 404) return <Msg title="Sondage introuvable" body="Ce lien ne mène à rien — il a peut-être expiré, ou il est incomplet." />;
    if (heat.status === 410) return <Msg title="Ce sondage a expiré" body="Supprimé 7 jours après sa dernière date. Les dispos et le lien n'existent plus." />;
    return <Msg title="Souci côté serveur" body="On n'a pas pu charger ce sondage. Réessaie dans un instant." />;
  }

  const people = await runData(listParticipants(slug, await readMe(slug)));
  return (
    <PollView
      initial={heat.value}
      initialParticipants={people.ok ? people.value : []}
      slug={slug}
      created={sp.created === "1"}
      justJoined={sp.joined === "1"}
      joinFailed={sp.join === "failed"}
    />
  );
}
