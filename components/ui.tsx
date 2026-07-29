"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

// Shared visual language for the real pages — the same tokens/idioms the demo
// (SyncPotesApp) uses, factored out so create + poll pages stay consistent.

export const card = (radius = 20, pad = "16px"): CSSProperties => ({
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: radius,
  padding: pad,
  boxShadow: "var(--shadow)",
});

export const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "17px",
  borderRadius: 16,
  background: "var(--accent)",
  color: "var(--accentInk)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "17px",
  textAlign: "center",
};

export const ghostBtn: CSSProperties = {
  width: "100%",
  padding: "15px",
  borderRadius: 16,
  border: "1px solid var(--line)",
  textAlign: "center",
  fontWeight: 600,
  fontSize: "14.5px",
};

export const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: "var(--ink2)",
};

/** Applies the design's default heat ramp and a light/dark toggle to <html>. */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = theme;
    r.dataset.heat = "braise";
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: "60px" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "9px 14px", maxWidth: "1080px", margin: "0 auto" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0, color: "var(--ink)" }}>
            <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 14px var(--glow)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "15px", letterSpacing: "-0.02em" }}>SyncPotes</span>
          </Link>
          <div style={{ flex: 1 }} />
          <button
            onClick={toggle}
            aria-label="Basculer le thème"
            style={{ width: "32px", height: "32px", borderRadius: 999, border: "1px solid var(--line)", display: "grid", placeItems: "center", fontSize: "13px", fontFamily: "var(--font-mono)" }}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>
      <div data-r="page">{children}</div>
    </div>
  );
}

/** ISO yyyy-mm-dd → { dow, num } in French, for row labels. */
export function dayLabel(iso: string): { dow: string; num: string } {
  const d = new Date(`${iso}T12:00:00`);
  const dow = d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  return { dow, num: String(d.getDate()) };
}
