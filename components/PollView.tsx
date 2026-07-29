"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { HeatmapDTO, MeDTO, ParticipantDTO, SlotNameDTO } from "@/lib/api-types";
import { Shell, card, dayLabel, ghostBtn, primaryBtn } from "./ui";

interface Props {
  initial: HeatmapDTO;
  initialParticipants: ParticipantDTO[];
  slug: string;
  created: boolean;
  justJoined: boolean;
  joinFailed: boolean;
}

interface SheetData {
  day: string;
  time: string;
  score: string;
  lvl: number;
  names: SlotNameDTO[];
}

export default function PollView({ initial, initialParticipants, slug, created, justJoined, joinFailed }: Props) {
  const [heatmap, setHeatmap] = useState(initial);
  const [participants, setParticipants] = useState(initialParticipants);
  const [threshold, setThreshold] = useState(initial.poll.threshold);
  const [view, setView] = useState<"heat" | "people">("heat");
  const [overlay, setOverlay] = useState<"none" | "share" | "manual">(created ? "share" : "none");
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [toast, setToast] = useState<string | null>(justJoined ? "Tes dispos sont dans la carte." : joinFailed ? "Google n'a pas répondu — réessaie ou passe à la main." : null);
  const [manualName, setManualName] = useState("");
  const [paint, setPaint] = useState<Record<string, true>>({});
  const [copied, setCopied] = useState(false);
  // The manual overlay does double duty: first join, and editing an existing
  // row. Only the wording and the toast differ — joinManual already updates in
  // place for a browser that owns a row.
  const [editing, setEditing] = useState(false);
  const [loadingMe, setLoadingMe] = useState(false);

  const poll = heatmap.poll;
  const hours = heatmap.hours;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/p/${slug}`;

  // Whether we've joined isn't a client-side guess: the server flags the row
  // this browser owns (HttpOnly cookie), so it stays right after "remove me"
  // and across devices.
  const me = participants.find((p) => p.isMe);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const refetch = useCallback(
    async (K: number) => {
      const [h, p] = await Promise.all([
        fetch(`/api/polls/${slug}?threshold=${K}`).then((r) => (r.ok ? (r.json() as Promise<HeatmapDTO>) : null)),
        fetch(`/api/polls/${slug}/participants`).then((r) => (r.ok ? (r.json() as Promise<ParticipantDTO[]>) : null)),
      ]);
      if (h) setHeatmap(h);
      if (p) setParticipants(p);
    },
    [slug],
  );

  // Live: poll every 5s so the map warms up as friends join ("en direct").
  const thRef = useRef(threshold);
  thRef.current = threshold;
  useEffect(() => {
    const id = setInterval(() => refetch(thRef.current), 5000);
    return () => clearInterval(id);
  }, [refetch]);

  const setT = (v: number) => {
    const K = Math.max(1, v);
    setThreshold(K);
    void refetch(K);
  };

  const countLine = `${heatmap.participantsCount} potes · créneaux où ≥${threshold} libres`;

  const openCell = (di: number, hi: number, count: number, lvl: number, names: SlotNameDTO[]) => {
    if (count === 0) return;
    const { dow, num } = dayLabel(poll.dates[di]);
    setSheet({
      day: `${dow} ${num}`,
      time: `${hours[hi]}:00 – ${hours[hi] + 1}:00`,
      score: `${count}/${heatmap.participantsCount}`,
      lvl,
      names,
    });
  };

  function openJoin() {
    setEditing(false);
    setPaint({});
    setOverlay("manual");
  }

  // Pre-fill from the server rather than from the heatmap: cells below the
  // threshold are withheld from the grid, so reconstructing "my" slots
  // client-side would silently drop the ones I could least afford to lose.
  async function openEdit() {
    setLoadingMe(true);
    try {
      const res = await fetch(`/api/polls/${slug}/me`);
      if (!res.ok) return setToast("Impossible de charger tes dispos, réessaie.");
      const mine = (await res.json()) as MeDTO;
      setManualName(mine.name);
      setPaint(Object.fromEntries(mine.free.map((k) => [k, true])) as Record<string, true>);
      setEditing(true);
      setOverlay("manual");
    } catch {
      setToast("Impossible de charger tes dispos, réessaie.");
    } finally {
      setLoadingMe(false);
    }
  }

  async function submitManual() {
    const name = manualName.trim();
    if (!name) return setToast("Mets ton prénom d'abord.");
    const free = Object.keys(paint);
    const res = await fetch(`/api/polls/${slug}/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, free }),
    });
    if (!res.ok) return setToast("Envoi impossible, réessaie.");
    setOverlay("none");
    setToast(editing ? "Tes dispos sont à jour." : "Tes dispos sont dans la carte.");
    setEditing(false);
    void refetch(threshold);
  }

  async function removeMe() {
    const res = await fetch(`/api/polls/${slug}/me`, { method: "DELETE" });
    if (!res.ok) return setToast("Impossible de te retirer, réessaie.");
    setPaint({});
    setManualName("");
    setToast("Tu n'es plus dans ce sondage.");
    void refetch(threshold);
  }

  function copyLink() {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const best = useMemo(
    () =>
      heatmap.best.map((b, i) => ({
        ...b,
        hero: i === 0,
        rank: i === 0 ? "Le meilleur créneau" : "Aussi bien",
        day: (() => { const { dow, num } = dayLabel(poll.dates[b.di]); return `${dow} ${num}`; })(),
        time: `${hours[b.hi]}:00`,
      })),
    [heatmap.best, poll.dates, hours],
  );

  return (
    <Shell>
      <div style={{ paddingTop: "26px", animation: "rise .45s ease both" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--ok)", animation: "pulse 1.8s ease-in-out infinite" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink2)" }}>En direct</span>
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,8vw,44px)", lineHeight: ".96", letterSpacing: "-0.035em", margin: "6px 0 4px" }}>{poll.name}</h2>
            <button onClick={() => setView(view === "heat" ? "people" : "heat")} style={{ fontSize: "13.5px", color: "var(--ink2)" }}>
              {countLine} · <span style={{ color: "var(--accent)", fontWeight: 600 }}>{view === "heat" ? "voir qui" : "voir la carte"}</span>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setOverlay("share")} style={{ ...ghostBtn, width: "auto", padding: "8px 14px", fontSize: "13px" }}>Partager</button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 8px", boxShadow: "var(--shadow)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink2)", paddingLeft: "6px" }}>Seuil</span>
              <button onClick={() => setT(threshold - 1)} style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>–</button>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "19px", minWidth: "26px", textAlign: "center" }}>≥{threshold}</span>
              <button onClick={() => setT(threshold + 1)} style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>+</button>
            </div>
          </div>
        </div>

        {!me ? (
          <div style={{ ...card(20, "16px"), marginTop: "18px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "180px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "18px" }}>Ajoute tes dispos</div>
              <div style={{ fontSize: "13px", color: "var(--ink2)" }}>On lit occupé/libre, jamais le pourquoi.</div>
            </div>
            <a href={`/api/polls/${slug}/google/start`} style={{ ...primaryBtn, width: "auto", padding: "13px 16px", fontSize: "15px", textDecoration: "none" }}>Connecter Google</a>
            <button onClick={openJoin} style={{ ...ghostBtn, width: "auto", padding: "13px 16px", fontSize: "14px" }}>À la main</button>
          </div>
        ) : (
          // Joined: the same slot keeps carrying the affordance, otherwise the
          // only route back to the update path is remove-me-and-rejoin.
          <div style={{ ...card(20, "16px"), marginTop: "18px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "180px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "18px" }}>Tes dispos sont dans la carte</div>
              <div style={{ fontSize: "13px", color: "var(--ink2)" }}>
                {me.freeCount} créneau{me.freeCount > 1 ? "x" : ""} · {me.mode === "google" ? "agenda synchronisé" : `peint${me.freeCount > 1 ? "s" : ""} à la main`}
              </div>
            </div>
            {me.mode === "google" && (
              <a href={`/api/polls/${slug}/google/start`} style={{ ...primaryBtn, width: "auto", padding: "13px 16px", fontSize: "15px", textDecoration: "none" }}>Resynchroniser</a>
            )}
            <button onClick={openEdit} disabled={loadingMe}
              style={{ ...(me.mode === "google" ? ghostBtn : primaryBtn), width: "auto", padding: "13px 16px", fontSize: me.mode === "google" ? "14px" : "15px", opacity: loadingMe ? 0.6 : 1 }}>
              {loadingMe ? "Chargement…" : me.mode === "google" ? "Ajuster à la main" : "Modifier mes dispos"}
            </button>
          </div>
        )}

        {view === "heat" && (
          <>
            {best.length > 0 && (
              // The best-slot ring is a box-shadow drawn 4px outside the card,
              // and `overflow-x: auto` computes overflow-y to auto as well, so a
              // flush card gets its ring shaved on the top, left and bottom.
              // Pad the scroll box by more than the ring and pull the padding
              // back out with negative margins so the cards stay aligned.
              <div style={{ marginTop: "12px", marginLeft: "-8px", marginRight: "-8px", padding: "8px 8px 12px", display: "flex", gap: "12px", overflowX: "auto", scrollbarWidth: "none" }}>
                {best.map((b) => (
                  <button key={`${b.di}-${b.hi}`} onClick={() => openCell(b.di, b.hi, b.count, Math.min(5, b.count), b.names)} data-lvl={String(Math.min(5, b.count))} data-best={b.hero ? "1" : "0"}
                    style={{ flexShrink: 0, width: "238px", borderRadius: 20, padding: "16px", textAlign: "left", animation: "pop .5s ease both" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.75 }}>{b.rank}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "15px", marginTop: "8px", opacity: 0.85 }}>{b.day}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "38px", lineHeight: 1, letterSpacing: "-0.03em" }}>{b.time}</div>
                    <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {b.names.map((n) => (
                        <span key={n.id} style={{ fontSize: "11.5px", fontWeight: 600, padding: "3px 7px", borderRadius: 999, background: "oklch(1 0 0 / 0.28)" }}>{n.name}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: "10px", fontFamily: "var(--font-mono)", fontSize: "11.5px", opacity: 0.8 }}>{b.count} libres sur {heatmap.participantsCount}</div>
                  </button>
                ))}
              </div>
            )}

            {best.length === 0 && (
              <div style={{ marginTop: "20px", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: 22, padding: "22px 18px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", letterSpacing: "-0.02em" }}>Aucun créneau à ≥{threshold}.</div>
                <p style={{ margin: "8px auto 16px", fontSize: "14px", color: "var(--ink2)", maxWidth: "32ch", textWrap: "pretty" }}>Vos agendas ne se croisent pas assez haut. Descends d&apos;un cran, ou partage encore le lien.</p>
                <button onClick={() => setT(threshold - 1)} style={{ padding: "14px 20px", borderRadius: 14, background: "var(--accent)", color: "var(--accentInk)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px" }}>Passer à ≥{Math.max(1, threshold - 1)}</button>
              </div>
            )}

            <div style={{ marginTop: "26px", ...card(22, "14px 12px 16px") }}>
              <div style={{ display: "grid", gridTemplateColumns: "52px repeat(" + hours.length + ",minmax(0,1fr))", gap: "6px", marginBottom: "8px" }}>
                <div />
                {hours.map((h) => (
                  <div key={h} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink2)" }}>{h}h</div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {heatmap.rows.map((row, di) => {
                  const { dow, num } = dayLabel(row.date);
                  return (
                    <div key={row.date} data-r="heatrow" style={{ display: "grid", gridTemplateColumns: "52px repeat(" + hours.length + ",minmax(0,1fr))", gap: "6px", "--cellh": "56px" } as CSSProperties}>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink2)", textTransform: "uppercase" }}>{dow}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "17px", lineHeight: 1 }}>{num}</span>
                      </div>
                      {row.cells.map((c) => (
                        <button key={`${c.di}-${c.hi}`} onClick={() => openCell(c.di, c.hi, c.count, c.lvl, c.names)} data-lvl={String(c.lvl)} data-best={c.best ? "1" : "0"}
                          style={{ height: "var(--cellh)", borderRadius: 13, padding: "6px", overflow: "hidden", transition: "background .3s ease,color .3s ease", display: "flex", flexDirection: "column", justifyContent: "space-between", animation: "pop .4s ease both" }}>
                          <div data-r="narrow" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "17px", lineHeight: 1 }}>{c.count || ""}</div>
                          <div data-r="cellnames" style={{ flexWrap: "wrap", gap: "3px" }}>
                            {c.names.map((n) => (
                              <span key={n.id} style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: 999, background: "oklch(1 0 0 / 0.26)", whiteSpace: "nowrap" }}>{n.name}</span>
                            ))}
                          </div>
                          <div data-r="narrow" style={{ display: "flex", gap: "2px" }}>
                            {c.names.map((n) => (
                              <span key={n.id} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", opacity: 0.75 }} />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink2)" }}>Chaleur</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <span key={l} data-lvl={String(l)} style={{ width: "22px", height: "14px", borderRadius: 4, display: "block" }} />
                  ))}
                </div>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--ink2)" }}>{heatmap.hidden} créneaux sous le seuil</span>
              </div>
            </div>
            <p style={{ margin: "14px 2px 0", fontSize: "12.5px", color: "var(--ink2)", textWrap: "pretty" }}>On te montre les bons chevauchements, pas tout ton mois. Le reste se décide dans la boucle du groupe.</p>
          </>
        )}

        {view === "people" && (
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {participants.length === 0 && (
              <div style={{ ...card(18, "18px"), textAlign: "center", color: "var(--ink2)" }}>Personne n&apos;a encore rejoint. Partage le lien !</div>
            )}
            {participants.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", ...card(16, "12px 14px") }}>
                <div data-lvl={p.mode === "google" ? "3" : "1"} style={{ width: "38px", height: "38px", borderRadius: 12, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>{p.name.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "17px" }}>{p.name}{p.isMe ? " (toi)" : ""}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", letterSpacing: ".08em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 999, background: "var(--surface2)", color: "var(--ink2)" }}>{p.mode === "google" ? "Google" : "à la main"}</span>
                    {p.organizer && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", letterSpacing: ".08em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 999, background: "var(--accent)", color: "var(--accentInk)" }}>Orga</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--ink2)" }}>{p.mode === "google" ? "Agenda synchronisé" : "Dispos peintes à la main"}</div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink2)" }}>{p.freeCount} créneaux</span>
                {p.isMe && (
                  <button onClick={removeMe} aria-label="Me retirer du sondage"
                    style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--accent)", padding: "6px 10px", borderRadius: 999, border: "1px solid var(--line)", flexShrink: 0 }}>
                    Me retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {overlay === "share" && (
        <Overlay onClose={() => setOverlay("none")}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink2)" }}>Sondage en ligne</div>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "32px", lineHeight: ".96", letterSpacing: "-0.03em", margin: "8px 0 14px" }}>Balance le lien.</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--surface2)", borderRadius: 16, padding: "13px 14px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{link}</span>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ok)", flexShrink: 0 }} />
          </div>
          <button onClick={copyLink} style={{ ...primaryBtn, marginTop: "12px" }}>{copied ? "Copié !" : "Copier le lien"}</button>
          <p style={{ margin: "16px 0 0", fontSize: "13px", color: "var(--ink2)", textWrap: "pretty" }}>Le lien est indevinable et disparaît 7 jours après la dernière date.</p>
        </Overlay>
      )}

      {overlay === "manual" && (
        <Overlay onClose={() => setOverlay("none")}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "28px", lineHeight: ".96", letterSpacing: "-0.03em", margin: "0 0 14px" }}>
            {editing ? "Ajuste tes dispos." : "Donne tes dispos."}
          </h3>
          {editing && me?.mode === "google" && (
            <p style={{ margin: "-6px 0 14px", fontSize: "13px", color: "var(--ink2)", textWrap: "pretty" }}>
              Tes créneaux Google sont déjà peints. En envoyant, tu passes à la main : ils ne se resynchroniseront plus tout seuls.
            </p>
          )}
          <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Ton prénom"
            style={{ width: "100%", border: 0, borderBottom: "2px solid var(--line)", background: "none", padding: "3px 0 9px", fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, outline: "none", marginBottom: "14px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "44px repeat(" + hours.length + ",minmax(0,1fr))", gap: "5px", marginBottom: "5px" }}>
            <div />
            {hours.map((h) => (
              <div key={h} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink2)" }}>{h}h</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", maxHeight: "46vh", overflowY: "auto" }}>
            {poll.dates.map((date, di) => {
              const { dow, num } = dayLabel(date);
              return (
                <div key={date} style={{ display: "grid", gridTemplateColumns: "44px repeat(" + hours.length + ",minmax(0,1fr))", gap: "5px" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--ink2)", textTransform: "uppercase" }}>{dow}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "15px", lineHeight: 1 }}>{num}</span>
                  </div>
                  {hours.map((_, hi) => {
                    const k = `${di}-${hi}`;
                    const on = !!paint[k];
                    return (
                      <button key={k} data-lvl={on ? "4" : "0"} onClick={() => setPaint((p) => { const n = { ...p }; if (n[k]) delete n[k]; else n[k] = true; return n; })}
                        style={{ height: "40px", borderRadius: 10, transition: "all .16s ease" }} />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <button onClick={submitManual} style={{ ...primaryBtn, marginTop: "14px" }}>
            {editing ? "Mettre à jour mes dispos" : "Envoyer mes dispos"}
          </button>
        </Overlay>
      )}

      {sheet && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
          <div onClick={() => setSheet(null)} style={{ position: "absolute", inset: 0, background: "oklch(0.2 0.02 60 / 0.45)", backdropFilter: "blur(3px)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 18px 26px", animation: "sheet .3s cubic-bezier(.2,.8,.2,1) both", maxWidth: "520px", margin: "0 auto", borderTop: "1px solid var(--line)" }}>
            <div style={{ width: "42px", height: "4px", borderRadius: 99, background: "var(--line)", margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--ink2)", textTransform: "uppercase", letterSpacing: ".1em" }}>{sheet.day}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "32px", lineHeight: 1, letterSpacing: "-0.03em", marginTop: "4px" }}>{sheet.time}</div>
              </div>
              <div data-lvl={String(sheet.lvl)} style={{ padding: "8px 12px", borderRadius: 12, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px" }}>{sheet.score}</div>
            </div>
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "7px" }}>
              {sheet.names.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 11px", borderRadius: 13, background: "var(--surface2)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px", flex: 1 }}>{n.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink2)" }}>{n.mode === "google" ? "Google" : "à la main"}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "14px", fontSize: "12.5px", color: "var(--ink2)", textWrap: "pretty" }}>On sait qui est libre. On ne montrera jamais pourquoi les autres ne le sont pas.</div>
            <button onClick={() => setSheet(null)} style={{ width: "100%", marginTop: "14px", padding: "15px", borderRadius: 15, border: "1px solid var(--line)", textAlign: "center", fontWeight: 600 }}>Fermer</button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", left: "16px", right: "16px", bottom: "20px", zIndex: 70, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--ink)", color: "var(--bg)", padding: "12px 16px", borderRadius: 999, animation: "toast .4s cubic-bezier(.2,.8,.2,1) both", boxShadow: "0 18px 40px -18px oklch(0 0 0 / .6)" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--h4)" }} />
            <span style={{ fontSize: "13.5px", fontWeight: 600 }}>{toast}</span>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "oklch(0.2 0.02 60 / 0.45)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 18px 26px", animation: "sheet .3s cubic-bezier(.2,.8,.2,1) both", maxWidth: "520px", margin: "0 auto", borderTop: "1px solid var(--line)" }}>
        <div style={{ width: "42px", height: "4px", borderRadius: 99, background: "var(--line)", margin: "0 auto 16px" }} />
        {children}
      </div>
    </div>
  );
}
