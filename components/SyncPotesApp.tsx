"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  DAYS,
  HOURS,
  PEOPLE,
  SCREENS,
  deriveHeatmap,
  freeAt,
} from "@/lib/syncpotes-model";

type JoinState = "idle" | "connecting" | "connected" | "failed";
const HEAT_RAMP = "braise"; // second ramp "menthe" ships in globals.css

export default function SyncPotesApp() {
  const [screen, setScreen] = useState("create");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [threshold, setThreshold] = useState<number | null>(null);
  const [nadia, setNadia] = useState(false);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pollName, setPollName] = useState("Apéro de rentrée");
  const [manualName, setManualName] = useState("");
  const [newK, setNewK] = useState(4);
  const [picked, setPicked] = useState<Record<number, 1>>({ 19: 1, 20: 1, 21: 1, 22: 1, 23: 1 });
  const [paint, setPaint] = useState<Record<string, 1>>({
    "0-1": 1, "0-2": 1, "2-2": 1, "2-3": 1, "2-4": 1, "3-3": 1, "4-1": 1, "4-2": 1,
  });

  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; t2?: ReturnType<typeof setTimeout> }>({});
  const K = threshold ?? 3;

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = theme;
    r.dataset.heat = HEAT_RAMP;
  }, [theme]);

  useEffect(() => () => {
    clearTimeout(timers.current.t);
    clearTimeout(timers.current.t2);
  }, []);

  function go(next: string) {
    return () => {
      clearTimeout(timers.current.t);
      setScreen(next);
      setSheetKey(null);
      setToast(null);
      setJoinState("idle");
      if (next === "heat" && !nadia) {
        timers.current.t = setTimeout(() => {
          setNadia(true);
          setToast("Nadia vient de rejoindre · +6 créneaux");
          timers.current.t2 = setTimeout(() => setToast(null), 4200);
        }, 3200);
      }
    };
  }

  const setT = (v: number) => () => setThreshold(Math.max(1, Math.min(6, v)));

  function connect() {
    setJoinState("connecting");
    clearTimeout(timers.current.t);
    timers.current.t = setTimeout(() => setJoinState("connected"), 2100);
  }

  function copyLink() {
    navigator.clipboard?.writeText("https://syncpotes.fr/p/k7f2-mure-vive").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const vals = useMemo(() => deriveHeatmap(K, nadia), [K, nadia]);
  const parts = vals.parts;
  const countLine = `${parts.length} potes · on affiche les créneaux où ≥${K} sont libres`;

  const sheet = useMemo(() => {
    if (!sheetKey) return null;
    const c = vals.flat.find((x) => x.key === sheetKey);
    if (!c) return null;
    return {
      day: `${DAYS[c.di].dow} ${DAYS[c.di].num} août`,
      time: `${HOURS[c.hi]}:00 – ${HOURS[c.hi] + 1}:00`,
      lvl: c.lvl,
      score: `${c.count}/${parts.length}`,
      names: c.ids.map((i) => ({
        key: i,
        label: PEOPLE[i].name,
        tag: PEOPLE[i].mode === "google" ? "Google" : "à la main",
      })),
    };
  }, [sheetKey, vals, parts.length]);

  // ---------- shared style fragments ----------
  const card = (radius = 20, pad = "16px"): CSSProperties => ({
    background: "var(--surface)", border: "1px solid var(--line)",
    borderRadius: radius, padding: pad, boxShadow: "var(--shadow)",
  });
  const primaryBtn: CSSProperties = {
    width: "100%", padding: "17px", borderRadius: 16, background: "var(--accent)",
    color: "var(--accentInk)", fontFamily: "var(--font-display)", fontWeight: 700,
    fontSize: "17px", textAlign: "center",
  };
  const ghostBtn: CSSProperties = {
    width: "100%", padding: "15px", borderRadius: 16, border: "1px solid var(--line)",
    textAlign: "center", fontWeight: 600, fontSize: "14.5px",
  };
  const eyebrow: CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: ".14em",
    textTransform: "uppercase", color: "var(--ink2)",
  };

  // ---------- screens ----------
  const renderCreate = () => (
    <div style={{ paddingTop: "34px", animation: "rise .5s ease both" }}>
      <div style={{ ...eyebrow, fontSize: "11.5px" }}>Nouveau sondage</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(38px,10vw,64px)", lineHeight: ".94", letterSpacing: "-0.035em", margin: "10px 0 6px" }}>
        Trouvons<br />un créneau.
      </h1>
      <p style={{ margin: "0 0 26px", color: "var(--ink2)", fontSize: "15px", maxWidth: "34ch", textWrap: "pretty" }}>
        Tu choisis les dates et la plage horaire. Tes potes disent quand ils sont libres. On te montre les bons chevauchements.
      </p>

      <div data-r="two">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={card(20, "16px 16px 18px")}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)", marginBottom: "8px" }}>Nom du sondage</div>
            <input value={pollName} onChange={(e) => setPollName(e.target.value)}
              style={{ width: "100%", border: 0, borderBottom: "2px solid var(--line)", background: "none", padding: "4px 0 8px", fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700, letterSpacing: "-0.02em", outline: "none" }} />
          </div>

          <div style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)" }}>Dates candidates</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent)" }}>{Object.keys(picked).length} choisies</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "6px" }}>
              {Array.from({ length: 21 }, (_, i) => 10 + i).map((num) => (
                <button key={num} data-on={picked[num] ? "1" : "0"}
                  onClick={() => setPicked((p) => { const n = { ...p }; if (n[num]) delete n[num]; else n[num] = 1; return n; })}
                  style={{ aspectRatio: "1", borderRadius: 12, border: "1px solid var(--line)", display: "grid", placeItems: "center", transition: "all .18s ease" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}>{num}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={card()}>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)", marginBottom: "10px" }}>Plage horaire quotidienne</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "30px", letterSpacing: "-0.02em" }}>
              <span>18:00</span><span style={{ fontSize: "16px", color: "var(--ink2)" }}>→</span><span>23:00</span>
            </div>
            <div style={{ display: "flex", gap: "3px", marginTop: "12px" }}>
              {Array.from({ length: 12 }, (_, i) => 12 + i).map((h) => (
                <div key={h} data-on={h >= 18 && h <= 22 ? "1" : "0"}
                  style={{ flex: 1, height: "26px", borderRadius: 6, background: "var(--surface2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink2)" }}>{h}</div>
              ))}
            </div>
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--ink2)" }}>Fuseau</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", padding: "4px 9px", borderRadius: 999, background: "var(--surface2)" }}>Europe/Paris</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
          <div style={{ ...card(20, "18px 16px"), position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent)" }}>Le seuil</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", margin: "12px 0 4px" }}>
              <button onClick={() => setNewK((k) => Math.max(1, k - 1))} style={{ width: "44px", height: "44px", borderRadius: 14, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: "22px", fontFamily: "var(--font-mono)" }}>–</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "46px", lineHeight: 1, letterSpacing: "-0.04em" }}>≥ {newK}</div>
                <div style={{ fontSize: "12px", color: "var(--ink2)", marginTop: "2px" }}>potes libres</div>
              </div>
              <button onClick={() => setNewK((k) => Math.min(6, k + 1))} style={{ width: "44px", height: "44px", borderRadius: 14, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: "22px", fontFamily: "var(--font-mono)" }}>+</button>
            </div>
            <div style={{ display: "flex", gap: "5px", justifyContent: "center", margin: "14px 0 12px" }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} data-lvl={i < newK ? String(Math.min(5, i + 1)) : "0"} style={{ width: "26px", height: "26px", borderRadius: 9, transition: "all .2s ease" }} />
              ))}
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink2)", textWrap: "pretty" }}>On masque tout le reste. Un créneau où 2 potes sont libres n&apos;est pas une soirée — c&apos;est un café.</p>
          </div>

          <button onClick={go("share")} className="lift" style={{ ...primaryBtn, padding: "18px", borderRadius: 18, fontSize: "18px", boxShadow: "0 12px 30px -12px var(--glow)" }}>Créer le sondage</button>
          <div style={{ textAlign: "center", fontSize: "12px", color: "var(--ink2)" }}>Auto-supprimé 7 jours après la dernière date · aucun compte requis</div>
        </div>
      </div>
    </div>
  );

  const renderShare = () => (
    <div style={{ paddingTop: "40px", animation: "rise .5s ease both", maxWidth: "520px", margin: "0 auto" }}>
      <div style={{ ...card(26, "26px 20px 22px"), position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-70px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "var(--h4)", filter: "blur(46px)", opacity: 0.5 }} />
        <div style={{ position: "relative" }}>
          <div style={eyebrow}>Sondage en ligne</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,8vw,46px)", lineHeight: ".96", letterSpacing: "-0.035em", margin: "8px 0 4px" }}>Balance le lien.</h2>
          <p style={{ margin: "0 0 20px", color: "var(--ink2)", fontSize: "14.5px" }}>Apéro de rentrée · 5 dates · 18:00–23:00</p>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--surface2)", borderRadius: 16, padding: "13px 14px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "13.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>syncpotes.fr/p/k7f2-mure-vive</span>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ok)", flexShrink: 0 }} />
          </div>

          <button onClick={copyLink} className="lift" style={{ ...primaryBtn, marginTop: "12px" }}>{copied ? "Copié !" : "Copier le lien"}</button>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={go("join")} style={{ flex: 1, padding: "14px", borderRadius: 16, border: "1px solid var(--line)", textAlign: "center", fontWeight: 600, fontSize: "14px" }}>Voir ce que voient tes potes</button>
          </div>
          <p style={{ margin: "18px 0 0", fontSize: "13px", color: "var(--ink2)", textWrap: "pretty" }}>Le lien est indevinable. Personne ne peut tomber dessus par hasard, et il disparaît une semaine après la dernière date.</p>
        </div>
      </div>
    </div>
  );

  const privacyLines = [
    { key: 1, mark: "✓", text: "On lit une seule chose : occupé ou libre, heure par heure." },
    { key: 2, mark: "✕", text: "Jamais les titres, les invités, les lieux, les notes." },
    { key: 3, mark: "✕", text: "Aucune raison n'est stockée. Tes potes voient que tu es libre, pas pourquoi tu ne l'es pas." },
  ];

  const renderJoin = () => (
    <div style={{ paddingTop: "36px", animation: "rise .5s ease both", maxWidth: "520px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ display: "flex" }}>
          {PEOPLE.slice(0, 4).map((p) => (
            <div key={p.name} style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--surface2)", border: "2px solid var(--bg)", marginLeft: "-8px", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700 }}>{p.initials}</div>
          ))}
        </div>
        <span style={{ fontSize: "13.5px", color: "var(--ink2)" }}>Marc et 3 potes t&apos;attendent</span>
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,8.5vw,48px)", lineHeight: ".95", letterSpacing: "-0.035em", margin: "14px 0 6px" }}>Apéro de rentrée</h2>
      <p style={{ margin: "0 0 22px", color: "var(--ink2)", fontSize: "14.5px", fontFamily: "var(--font-mono)" }}>19 → 23 août · 18:00–23:00 · Europe/Paris</p>

      <div style={card(22, "18px")}>
        {joinState === "idle" && (
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "21px", letterSpacing: "-0.02em" }}>Connecte ton Google Calendar</div>
            <p style={{ margin: "6px 0 14px", fontSize: "14px", color: "var(--ink2)" }}>Trois secondes, et tes dispos sont à jour toute la semaine.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px", background: "var(--surface2)", borderRadius: 16, padding: "14px" }}>
              {privacyLines.map((p) => (
                <div key={p.key} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--accent)", marginTop: "1px" }}>{p.mark}</span>
                  <span style={{ fontSize: "13.5px", lineHeight: 1.4, textWrap: "pretty" }}>{p.text}</span>
                </div>
              ))}
            </div>
            <button onClick={connect} style={{ ...primaryBtn, marginTop: "14px" }}>Connecter Google Calendar</button>
            <button onClick={go("manual")} style={{ ...ghostBtn, marginTop: "9px" }}>Je préfère peindre mes dispos à la main</button>
            <div style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", color: "var(--ink2)" }}>Les deux méthodes comptent pareil dans le seuil.</div>
          </div>
        )}
        {joinState === "connecting" && (
          <div style={{ padding: "12px 0", textAlign: "center" }}>
            <div style={{ width: "44px", height: "44px", margin: "0 auto 16px", borderRadius: "50%", border: "3px solid var(--line)", borderTopColor: "var(--accent)", animation: "spin .9s linear infinite" }} />
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "19px" }}>Lecture des créneaux…</div>
            <p style={{ margin: "6px 0 0", fontSize: "13.5px", color: "var(--ink2)" }}>On regarde <em>occupé</em> ou <em>libre</em>. Rien d&apos;autre ne traverse.</p>
            <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginTop: "16px" }}>
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} data-lvl={String(1 + (i % 5))} style={{ width: "12px", height: "34px", borderRadius: 5, animation: "pulse 1.2s ease-in-out infinite" }} />
              ))}
            </div>
          </div>
        )}
        {joinState === "connected" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--ok)", display: "grid", placeItems: "center", color: "var(--bg)", fontSize: "16px", fontWeight: 700, animation: "pop .4s ease both" }}>✓</div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "19px" }}>Connecté, Yanis</div>
                <div style={{ fontSize: "13px", color: "var(--ink2)" }}>12 créneaux libres envoyés · 0 titre d&apos;événement lu</div>
              </div>
            </div>
            <div style={{ marginTop: "14px", padding: "13px", borderRadius: 14, background: "var(--surface2)", fontSize: "13.5px", color: "var(--ink2)", textWrap: "pretty" }}>Tes dispos se mettent à jour toutes seules. Tu peux retirer l&apos;accès quand tu veux — tes créneaux disparaissent du sondage aussitôt.</div>
            <button onClick={go("heat")} style={{ ...primaryBtn, marginTop: "14px" }}>Voir les dispos du groupe</button>
          </div>
        )}
        {joinState === "failed" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", border: "2px solid var(--accent)", display: "grid", placeItems: "center", color: "var(--accent)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>!</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "19px" }}>Google n&apos;a pas répondu</div>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "13.5px", color: "var(--ink2)", textWrap: "pretty" }}>Rien n&apos;a été envoyé, rien n&apos;a été lu. Tu peux réessayer, ou passer à la main — ça prend 20 secondes.</p>
            <button onClick={connect} style={{ ...ghostBtn, marginTop: "14px", padding: "16px" }}>Réessayer</button>
            <button onClick={go("manual")} style={{ ...primaryBtn, marginTop: "9px", padding: "16px", fontSize: "16px" }}>Peindre mes dispos à la main</button>
          </div>
        )}
      </div>
    </div>
  );

  const hourHeads = HOURS.map((h) => ({ key: h, label: `${h}h` }));

  const renderManual = () => (
    <div style={{ paddingTop: "34px", animation: "rise .5s ease both", maxWidth: "560px", margin: "0 auto" }}>
      <div style={eyebrow}>Sans Google</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,8vw,44px)", lineHeight: ".96", letterSpacing: "-0.035em", margin: "8px 0 16px" }}>Peins tes soirées libres.</h2>
      <div style={{ ...card(18, "14px 16px"), marginBottom: "14px" }}>
        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink2)", marginBottom: "6px" }}>Ton prénom</div>
        <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Chloé"
          style={{ width: "100%", border: 0, borderBottom: "2px solid var(--line)", background: "none", padding: "3px 0 7px", fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700, outline: "none" }} />
      </div>

      <div style={card(20, "14px 12px 16px")}>
        <div style={{ display: "grid", gridTemplateColumns: "52px repeat(5,minmax(0,1fr))", gap: "6px", marginBottom: "6px" }}>
          <div />
          {hourHeads.map((h) => (
            <div key={h.key} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink2)" }}>{h.label}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {DAYS.map((d, di) => (
            <div key={d.num} style={{ display: "grid", gridTemplateColumns: "52px repeat(5,minmax(0,1fr))", gap: "6px", alignItems: "stretch" }}>
              <button onClick={() => setPaint((prev) => {
                const p = { ...prev };
                const full = HOURS.every((_, hi) => p[`${di}-${hi}`]);
                HOURS.forEach((_, hi) => { if (full) delete p[`${di}-${hi}`]; else p[`${di}-${hi}`] = 1; });
                return p;
              })} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink2)", textTransform: "uppercase" }}>{d.dow}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "17px", lineHeight: 1 }}>{d.num}</span>
              </button>
              {HOURS.map((_, hi) => {
                const k = `${di}-${hi}`;
                const on = !!paint[k];
                return (
                  <button key={k} data-lvl={on ? "4" : "0"}
                    onClick={() => setPaint((prev) => { const p = { ...prev }; if (p[k]) delete p[k]; else p[k] = 1; return p; })}
                    style={{ height: "46px", borderRadius: 12, transition: "all .16s ease", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700 }}>{on ? "libre" : ""}</button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "14px", paddingLeft: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink2)" }}><span data-lvl="4" style={{ width: "16px", height: "16px", borderRadius: 5, display: "block" }} />libre</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink2)" }}><span data-lvl="0" style={{ width: "16px", height: "16px", borderRadius: 5, display: "block" }} />occupé</div>
          <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent)" }}>{Object.keys(paint).length} libres</div>
        </div>
      </div>
      <button onClick={go("heat")} style={{ ...primaryBtn, marginTop: "14px", padding: "18px", borderRadius: 18 }}>Envoyer mes dispos</button>
      <div style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", color: "var(--ink2)" }}>Touche un jour pour libérer toute la soirée.</div>
    </div>
  );

  const renderHeat = () => (
    <div style={{ paddingTop: "26px", animation: "rise .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--ok)", animation: "pulse 1.8s ease-in-out infinite" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink2)" }}>En direct</span>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,8vw,44px)", lineHeight: ".96", letterSpacing: "-0.035em", margin: "6px 0 4px" }}>Apéro de rentrée</h2>
          <button onClick={go("people")} style={{ fontSize: "13.5px", color: "var(--ink2)" }}>{countLine} · <span style={{ color: "var(--accent)", fontWeight: 600 }}>voir qui</span></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 8px", boxShadow: "var(--shadow)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink2)", paddingLeft: "6px" }}>Seuil</span>
          <button onClick={setT(K - 1)} style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>–</button>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "19px", minWidth: "26px", textAlign: "center" }}>≥{K}</span>
          <button onClick={setT(K + 1)} style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)" }}>+</button>
        </div>
      </div>

      {vals.best.length > 0 && (
        <div style={{ marginTop: "20px", display: "flex", gap: "12px", overflowX: "auto", scrollbarWidth: "none", paddingBottom: "4px" }}>
          {vals.best.map((b) => (
            <button key={b.key} onClick={() => setSheetKey(b.key)} data-lvl={String(b.lvl)} data-best={b.hero}
              style={{ flexShrink: 0, width: "238px", borderRadius: 20, padding: "16px", textAlign: "left", animation: "pop .5s ease both" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.75 }}>{b.rank}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "15px", marginTop: "8px", opacity: 0.85 }}>{b.day}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "38px", lineHeight: 1, letterSpacing: "-0.03em" }}>{b.time}</div>
              <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {b.names.map((n) => (
                  <span key={n.key} style={{ fontSize: "11.5px", fontWeight: 600, padding: "3px 7px", borderRadius: 999, background: "oklch(1 0 0 / 0.28)" }}>{n.label}</span>
                ))}
              </div>
              <div style={{ marginTop: "10px", fontFamily: "var(--font-mono)", fontSize: "11.5px", opacity: 0.8 }}>{b.score}</div>
            </button>
          ))}
        </div>
      )}

      {vals.best.length === 0 && (
        <div style={{ marginTop: "20px", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: 22, padding: "22px 18px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", letterSpacing: "-0.02em" }}>Aucun créneau à ≥{K}.</div>
          <p style={{ margin: "8px auto 16px", fontSize: "14px", color: "var(--ink2)", maxWidth: "32ch", textWrap: "pretty" }}>Vos agendas ne se croisent pas assez haut. Descends d&apos;un cran : {vals.revealAt(Math.max(1, K - 1))} créneaux apparaissent tout de suite.</p>
          <button onClick={setT(K - 1)} style={{ padding: "14px 20px", borderRadius: 14, background: "var(--accent)", color: "var(--accentInk)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px" }}>Passer à ≥{Math.max(1, K - 1)}</button>
        </div>
      )}

      <div style={{ marginTop: "26px", ...card(22, "14px 12px 16px") }}>
        <div style={{ display: "grid", gridTemplateColumns: "52px repeat(5,minmax(0,1fr))", gap: "6px", marginBottom: "8px" }}>
          <div />
          {hourHeads.map((h) => (
            <div key={h.key} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink2)" }}>{h.label}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {vals.heatRows.map((row) => (
            <div key={row.key} data-r="heatrow" style={{ display: "grid", gridTemplateColumns: "52px repeat(5,minmax(0,1fr))", gap: "6px", "--cellh": "56px" } as CSSProperties}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink2)", textTransform: "uppercase" }}>{row.dow}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "17px", lineHeight: 1 }}>{row.num}</span>
              </div>
              {row.cells.map((c) => (
                <button key={c.key} onClick={c.count === "" ? undefined : () => setSheetKey(c.key)} data-lvl={String(c.lvl)} data-best={c.best}
                  style={{ height: "var(--cellh)", borderRadius: 13, padding: "6px", overflow: "hidden", transition: "background .3s ease,color .3s ease", display: "flex", flexDirection: "column", justifyContent: "space-between", animation: "pop .4s ease both" }}>
                  <div data-r="narrow" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "17px", lineHeight: 1 }}>{c.count}</div>
                  <div data-r="cellnames" style={{ flexWrap: "wrap", gap: "3px" }}>
                    {c.names.map((n) => (
                      <span key={n.key} style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: 999, background: "oklch(1 0 0 / 0.26)", whiteSpace: "nowrap" }}>{n.label}</span>
                    ))}
                  </div>
                  <div data-r="narrow" style={{ display: "flex", gap: "2px" }}>
                    {c.dots.map((d) => (
                      <span key={d.key} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", opacity: 0.75 }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--ink2)" }}>Chaleur</span>
          <div style={{ display: "flex", gap: "3px" }}>
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} data-lvl={String(l)} style={{ width: "22px", height: "14px", borderRadius: 4, display: "block" }} />
            ))}
          </div>
          <span style={{ fontSize: "12px", color: "var(--ink2)" }}>de {K} à {parts.length} libres</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--ink2)" }}>{vals.hidden} créneaux sous le seuil</span>
        </div>
      </div>
      <p style={{ margin: "14px 2px 0", fontSize: "12.5px", color: "var(--ink2)", textWrap: "pretty" }}>Les cases en pointillés existent, mais n&apos;atteignent pas le seuil. On te montre les bons chevauchements, pas tout ton mois. Le reste se décide dans la boucle du groupe.</p>
    </div>
  );

  const renderPeople = () => {
    const people = parts.map((p, i) => {
      let n = 0;
      DAYS.forEach((_, di) => HOURS.forEach((_, hi) => { if (freeAt(di, hi, nadia).indexOf(i) > -1) n++; }));
      return {
        key: p.name, name: p.name, initials: p.initials,
        lvl: p.mode === "google" ? "3" : "1",
        tag: p.mode === "google" ? "Google" : "à la main",
        sub: p.organizer ? "Organisateur · a créé le sondage" : p.mode === "google" ? "Agenda synchronisé en direct" : "Dispos peintes à la main",
        slots: `${n} créneaux`,
      };
    });
    return (
      <div style={{ paddingTop: "32px", animation: "rise .45s ease both", maxWidth: "560px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,8vw,44px)", lineHeight: ".96", letterSpacing: "-0.035em", margin: "0 0 6px" }}>{parts.length} potes ont rejoint</h2>
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ink2)" }}>{countLine}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {people.map((p) => (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: "12px", ...card(16, "12px 14px"), animation: "rise .4s ease both" }}>
              <div data-lvl={p.lvl} style={{ width: "38px", height: "38px", borderRadius: 12, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px", flexShrink: 0 }}>{p.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "17px" }}>{p.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", letterSpacing: ".08em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 999, background: "var(--surface2)", color: "var(--ink2)" }}>{p.tag}</span>
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--ink2)" }}>{p.sub}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ink2)" }}>{p.slots}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "14px", padding: "16px", borderRadius: 18, border: "1px dashed var(--line)", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, fontSize: "13.5px", color: "var(--ink2)", textWrap: "pretty" }}>Il manque du monde ? Le lien marche toujours — la carte se réchauffe à chaque arrivée.</div>
          <button onClick={go("share")} style={{ padding: "11px 14px", borderRadius: 13, background: "var(--accent)", color: "var(--accentInk)", fontWeight: 700, fontSize: "13.5px", flexShrink: 0 }}>Repartager</button>
        </div>
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ paddingTop: "38px", animation: "rise .45s ease both", maxWidth: "520px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "6px", maxWidth: "280px", margin: "0 auto 22px" }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} data-lvl="0" style={{ height: "34px", borderRadius: 10, animation: "pulse 3s ease-in-out infinite" }} />
        ))}
      </div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px,7.5vw,40px)", lineHeight: ".98", letterSpacing: "-0.03em", margin: "0 0 8px" }}>Personne n&apos;a encore rejoint.</h2>
      <p style={{ margin: "0 auto 20px", fontSize: "14.5px", color: "var(--ink2)", maxWidth: "34ch", textWrap: "pretty" }}>La carte reste froide jusqu&apos;au premier pote. Dès qu&apos;un agenda arrive, les cases s&apos;allument — pas besoin de rafraîchir.</p>
      <button onClick={go("share")} style={{ padding: "16px 22px", borderRadius: 16, background: "var(--accent)", color: "var(--accentInk)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px" }}>Renvoyer le lien</button>
      <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--ink2)", fontFamily: "var(--font-mono)" }}>0 pote · seuil ≥{K}</div>
    </div>
  );

  const edgeCards = [
    { key: 1, kind: "Connexion", title: "Google a refusé la connexion", body: "Rien n'a été lu, rien n'a été envoyé. Réessaie, ou passe à la main : dans le sondage, les deux comptent pareil.", cta: "Réessayer", cta2: "Passer à la main", primary: go("join"), secondaryGo: go("manual") },
    { key: 2, kind: "Accès retiré", title: "Léa a révoqué l'accès à son agenda", body: "Ses créneaux ont disparu du sondage à la seconde même. La carte s'est recalculée, personne n'a été prévenu de la raison.", cta: "Voir la carte", cta2: "Voir les participants", primary: go("heat"), secondaryGo: go("people") },
    { key: 3, kind: "Expiré", title: "Ce sondage a expiré", body: "Supprimé le 30 août, 7 jours après la dernière date. Les dispos, les prénoms et le lien n'existent plus nulle part.", cta: "Créer un nouveau sondage", cta2: "Comprendre pourquoi", primary: go("create"), secondaryGo: go("create") },
  ];

  const renderEdge = () => (
    <div style={{ paddingTop: "34px", animation: "rise .45s ease both", maxWidth: "560px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(28px,7.5vw,40px)", lineHeight: ".98", letterSpacing: "-0.03em", margin: "0 0 4px" }}>Quand ça coince.</h2>
      {edgeCards.map((e) => (
        <div key={e.key} style={card(20, "18px")}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent)" }}>{e.kind}</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "21px", letterSpacing: "-0.02em", margin: "8px 0 6px" }}>{e.title}</div>
          <p style={{ margin: "0 0 14px", fontSize: "14px", color: "var(--ink2)", textWrap: "pretty" }}>{e.body}</p>
          <div style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
            <button onClick={e.primary} style={{ padding: "13px 16px", borderRadius: 14, background: "var(--accent)", color: "var(--accentInk)", fontWeight: 700, fontSize: "14px" }}>{e.cta}</button>
            <button onClick={e.secondaryGo} style={{ padding: "13px 16px", borderRadius: 14, border: "1px solid var(--line)", fontWeight: 600, fontSize: "14px" }}>{e.cta2}</button>
          </div>
        </div>
      ))}
    </div>
  );

  const screens: Record<string, () => ReactElement> = {
    create: renderCreate, share: renderShare, join: renderJoin, manual: renderManual,
    heat: renderHeat, people: renderPeople, empty: renderEmpty, edge: renderEdge,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: "60px" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "9px 14px", maxWidth: "1080px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
            <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 14px var(--glow)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "15px", letterSpacing: "-0.02em" }}>SyncPotes</span>
          </div>
          <div style={{ display: "flex", gap: "5px", overflowX: "auto", flex: 1, scrollbarWidth: "none", paddingBottom: "2px" }}>
            {SCREENS.map(([id, lb]) => (
              <button key={id} onClick={go(id)} data-on={screen === id ? "1" : "0"}
                style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: "12.5px", fontWeight: 500, border: "1px solid var(--line)", whiteSpace: "nowrap", transition: "all .2s ease" }}>{lb}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              style={{ width: "32px", height: "32px", borderRadius: 999, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: "13px", fontFamily: "var(--font-mono)" }}>{theme === "dark" ? "☀" : "☾"}</button>
          </div>
        </div>
      </div>

      <div data-r="page">{screens[screen]()}</div>

      {sheet && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
          <div onClick={() => setSheetKey(null)} style={{ position: "absolute", inset: 0, background: "oklch(0.2 0.02 60 / 0.45)", backdropFilter: "blur(3px)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "18px 18px 26px", animation: "sheet .3s cubic-bezier(.2,.8,.2,1) both", maxWidth: "520px", margin: "0 auto", borderTop: "1px solid var(--line)" }}>
            <div style={{ width: "42px", height: "4px", borderRadius: 99, background: "var(--line)", margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--ink2)", textTransform: "uppercase", letterSpacing: ".1em" }}>{sheet.day}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "36px", lineHeight: 1, letterSpacing: "-0.03em", marginTop: "4px" }}>{sheet.time}</div>
              </div>
              <div data-lvl={String(sheet.lvl)} style={{ padding: "8px 12px", borderRadius: 12, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px" }}>{sheet.score}</div>
            </div>
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "7px" }}>
              {sheet.names.map((n) => (
                <div key={n.key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 11px", borderRadius: 13, background: "var(--surface2)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "16px", flex: 1 }}>{n.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink2)" }}>{n.tag}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "14px", fontSize: "12.5px", color: "var(--ink2)", textWrap: "pretty" }}>On sait qui est libre. On ne sait pas — et on ne montrera jamais — pourquoi les autres ne le sont pas.</div>
            <button onClick={() => setSheetKey(null)} style={{ width: "100%", marginTop: "14px", padding: "15px", borderRadius: 15, border: "1px solid var(--line)", textAlign: "center", fontWeight: 600 }}>Fermer</button>
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
    </div>
  );
}
