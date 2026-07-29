"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PollDTO } from "@/lib/api-types";
import { Shell, card, eyebrow, primaryBtn } from "./ui";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Cell = { iso: string; num: string; past: boolean } | null;

// Build one month as a Monday-first grid; leading blanks keep weekdays aligned.
function monthGrid(year: number, month: number, todayIso: string): Cell[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // JS weeks start Sunday, ours start Monday
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Cell[] = Array<Cell>(lead).fill(null);
  for (let day = 1; day <= count; day++) {
    const iso = isoOf(new Date(year, month, day));
    cells.push({ iso, num: String(day), past: iso < todayIso });
  }
  return cells;
}

const TZ = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Europe/Paris";

export default function CreatePoll() {
  const router = useRouter();
  const todayIso = useMemo(() => isoOf(new Date()), []);
  const [view, setView] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const cells = useMemo(() => monthGrid(view.y, view.m, todayIso), [view, todayIso]);
  const monthLabel = useMemo(
    () => new Date(view.y, view.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    [view],
  );
  const atCurrentMonth = useMemo(() => {
    const n = new Date();
    return view.y === n.getFullYear() && view.m === n.getMonth();
  }, [view]);
  const [name, setName] = useState("Apéro de rentrée");
  const [picked, setPicked] = useState<Record<string, true>>({});
  const [startHour, setStartHour] = useState(18);
  const [endHour, setEndHour] = useState(23);
  const [threshold, setThreshold] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates = Object.keys(picked).sort();

  async function submit() {
    setError(null);
    if (dates.length === 0) return setError("Choisis au moins une date.");
    setBusy(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone: TZ, threshold, dayStartHour: startHour, dayEndHour: endHour, dates }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      const poll = (await res.json()) as PollDTO;
      router.push(`/p/${poll.slug}?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la création.");
      setBusy(false);
    }
  }

  const stepper = (value: number, dec: () => void, inc: () => void, suffix = "h") => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button onClick={dec} style={{ width: "34px", height: "34px", borderRadius: 10, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>–</button>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", minWidth: "44px", textAlign: "center" }}>{value}{suffix}</span>
      <button onClick={inc} style={{ width: "34px", height: "34px", borderRadius: 10, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>+</button>
    </div>
  );

  return (
    <Shell>
      <div style={{ paddingTop: "34px", animation: "rise .5s ease both", maxWidth: "520px", margin: "0 auto" }}>
        <div style={{ ...eyebrow, fontSize: "11.5px" }}>Nouveau sondage</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(38px,10vw,64px)", lineHeight: ".94", letterSpacing: "-0.035em", margin: "10px 0 6px" }}>
          Trouvons<br />un créneau.
        </h1>
        <p style={{ margin: "0 0 26px", color: "var(--ink2)", fontSize: "15px", maxWidth: "34ch", textWrap: "pretty" }}>
          Choisis les dates et la plage horaire. Tes potes disent quand ils sont libres. On te montre les bons chevauchements.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={card(20, "16px 16px 18px")}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)", marginBottom: "8px" }}>Nom du sondage</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", border: 0, borderBottom: "2px solid var(--line)", background: "none", padding: "4px 0 8px", fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", outline: "none" }} />
          </div>

          <div style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)" }}>Dates candidates</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent)" }}>{dates.length} choisies</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
              <button onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 }))}
                disabled={atCurrentMonth} aria-label="Mois précédent"
                style={{ width: "32px", height: "32px", borderRadius: 10, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", opacity: atCurrentMonth ? 0.3 : 1 }}>‹</button>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px", letterSpacing: "-0.02em", textTransform: "capitalize" }}>{monthLabel}</span>
              <button onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 }))}
                aria-label="Mois suivant"
                style={{ width: "32px", height: "32px", borderRadius: 10, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "6px", marginBottom: "6px" }}>
              {WEEKDAYS.map((w, i) => (
                <div key={i} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink2)" }}>{w}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "6px" }}>
              {cells.map((c, i) => c === null ? <div key={`b${i}`} /> : (
                <button key={c.iso} data-on={picked[c.iso] ? "1" : "0"} disabled={c.past}
                  onClick={() => setPicked((p) => { const n = { ...p }; if (n[c.iso]) delete n[c.iso]; else n[c.iso] = true; return n; })}
                  style={{ aspectRatio: "1", borderRadius: 12, border: "1px solid var(--line)", display: "grid", placeItems: "center", transition: "all .18s ease", opacity: c.past ? 0.28 : 1, cursor: c.past ? "default" : "pointer" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}>{c.num}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={card()}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)", marginBottom: "10px" }}>Plage horaire quotidienne</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              {stepper(startHour, () => setStartHour((h) => Math.max(0, h - 1)), () => setStartHour((h) => Math.min(endHour - 1, h + 1)))}
              <span style={{ color: "var(--ink2)" }}>→</span>
              {stepper(endHour, () => setEndHour((h) => Math.max(startHour + 1, h - 1)), () => setEndHour((h) => Math.min(24, h + 1)))}
            </div>
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--ink2)" }}>Fuseau</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", padding: "4px 9px", borderRadius: 999, background: "var(--surface2)" }}>{TZ}</span>
            </div>
          </div>

          <div style={{ ...card(20, "18px 16px"), position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent)" }}>Le seuil</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", margin: "12px 0 4px" }}>
              <button onClick={() => setThreshold((k) => Math.max(1, k - 1))} style={{ width: "44px", height: "44px", borderRadius: 14, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: "22px", fontFamily: "var(--font-mono)" }}>–</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "46px", lineHeight: 1, letterSpacing: "-0.04em" }}>≥ {threshold}</div>
                <div style={{ fontSize: "12px", color: "var(--ink2)", marginTop: "2px" }}>potes libres</div>
              </div>
              <button onClick={() => setThreshold((k) => Math.min(20, k + 1))} style={{ width: "44px", height: "44px", borderRadius: 14, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: "22px", fontFamily: "var(--font-mono)" }}>+</button>
            </div>
          </div>

          {error && <div style={{ color: "var(--accent)", fontSize: "13.5px", fontWeight: 600 }}>{error}</div>}
          <button onClick={submit} disabled={busy} style={{ ...primaryBtn, padding: "18px", borderRadius: 18, fontSize: "18px", boxShadow: "0 12px 30px -12px var(--glow)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Création…" : "Créer le sondage"}
          </button>
          <div style={{ textAlign: "center", fontSize: "12px", color: "var(--ink2)" }}>Auto-supprimé 7 jours après la dernière date · aucun compte requis</div>
        </div>
      </div>
    </Shell>
  );
}
