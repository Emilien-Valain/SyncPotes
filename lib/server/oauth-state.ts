import { randomBytes, timingSafeEqual } from "node:crypto";

// The OAuth `state` parameter, as a pure codec so it can be tested.
//
// `state` used to carry only the Poll slug. That is guessable, so anybody could
// forge a callback URL and make a victim's browser complete *their* consent
// flow. The damage is real, not theoretical: the callback writes the resulting
// participant id into `sp_me_<slug>`, and `joinGoogle` deletes whatever row the
// browser owned before (the `owned !== id` branch). A forged callback therefore
// deletes a friend's availability and hands their cookie to a stranger's row.
//
// So `state` is now `<nonce>:<slug>`. The nonce also goes into a short-lived
// HttpOnly cookie (see identity.ts). Google echoes `state` back unchanged, so
// the callback can require that the two agree, which only the browser that
// started the flow can satisfy.

/** 128 bits, URL-safe — `state` travels in a query string. */
export const newNonce = (): string => randomBytes(16).toString("base64url");

export const encodeState = (nonce: string, slug: string): string => `${nonce}:${slug}`;

export interface OauthState {
  nonce: string;
  slug: string;
}

/**
 * Split a `state` value that came back from Google. Returns undefined for
 * anything malformed — the caller treats that exactly like a failed consent.
 */
export function decodeState(state: string): OauthState | undefined {
  // Cheap ceiling before any parsing: a real state is ~22 + 1 + ~20 characters.
  if (!state || state.length > 256) return undefined;
  const cut = state.indexOf(":");
  if (cut <= 0) return undefined;
  const nonce = state.slice(0, cut);
  const slug = state.slice(cut + 1);
  if (!slug) return undefined;
  return { nonce, slug };
}

/** Constant-time nonce comparison. Length is checked first, as the buffers must match. */
export function nonceMatches(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
