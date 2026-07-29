import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeState, encodeState, newNonce, nonceMatches } from "./oauth-state";

// `state` is the only thing that comes back from Google under an attacker's
// possible control, and the nonce inside it is a security control. These tests
// pin the parsing rules so a malformed or forged value can never be mistaken
// for a valid one.

describe("newNonce", () => {
  it("is URL-safe", () => {
    for (let i = 0; i < 50; i++) assert.match(newNonce(), /^[A-Za-z0-9_-]+$/);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, newNonce));
    assert.equal(seen.size, 200);
  });

  it("carries at least 128 bits", () => {
    // 16 random bytes in base64url — 22 characters, unpadded.
    assert.equal(newNonce().length, 22);
  });
});

describe("decodeState", () => {
  it("round-trips an encoded state", () => {
    const nonce = newNonce();
    assert.deepEqual(decodeState(encodeState(nonce, "a1b2c3-menthe-orage")), {
      nonce,
      slug: "a1b2c3-menthe-orage",
    });
  });

  it("rejects an empty state", () => {
    assert.equal(decodeState(""), undefined);
  });

  it("rejects a state with no separator", () => {
    assert.equal(decodeState("a1b2c3-menthe-orage"), undefined);
  });

  it("rejects a missing nonce", () => {
    assert.equal(decodeState(":a1b2c3-menthe-orage"), undefined);
  });

  it("rejects a missing slug", () => {
    assert.equal(decodeState(`${newNonce()}:`), undefined);
  });

  it("rejects an over-long state without parsing it", () => {
    assert.equal(decodeState(`${newNonce()}:${"x".repeat(300)}`), undefined);
  });

  it("keeps a colon inside the slug, splitting only on the first one", () => {
    // Real slugs hold no colon, but the split must stay unambiguous: the nonce
    // is everything before the first one, never a later one.
    const nonce = newNonce();
    assert.deepEqual(decodeState(`${nonce}:weird:slug`), { nonce, slug: "weird:slug" });
  });
});

describe("nonceMatches", () => {
  it("accepts an identical nonce", () => {
    const nonce = newNonce();
    assert.equal(nonceMatches(nonce, nonce), true);
  });

  it("rejects a different nonce of the same length", () => {
    assert.equal(nonceMatches(newNonce(), newNonce()), false);
  });

  it("rejects a prefix", () => {
    const nonce = newNonce();
    assert.equal(nonceMatches(nonce.slice(0, -1), nonce), false);
  });

  it("rejects empty on either side", () => {
    assert.equal(nonceMatches("", ""), false);
    assert.equal(nonceMatches("", newNonce()), false);
    assert.equal(nonceMatches(newNonce(), ""), false);
  });
});
