import { describe, expect, test } from "bun:test";

import { mergeTranscript, type EchoEntry, type LiveEntry, type StoreEntry } from "../src/echoMerge.js";
import type { TranscriptItem } from "../src/model.js";

function user(text: string): TranscriptItem {
  return { kind: "user", id: `u-${text}`, text };
}
function assistant(text: string): TranscriptItem {
  return { kind: "assistant", id: `a-${text}`, text };
}
function store(date: string, item: TranscriptItem, ids: { uuid?: string; otid?: string } = {}): StoreEntry {
  return { date, item, ...ids };
}
function live(item: TranscriptItem, ids: { uuid?: string; otid?: string } = {}): LiveEntry {
  return { item, ...ids };
}
function echo(item: TranscriptItem, anchors: { afterDate?: string | null; anchorOtid?: string; anchorUuid?: string }): EchoEntry {
  return { afterDate: anchors.afterDate ?? null, ...anchors, item };
}

function texts(items: TranscriptItem[]): string[] {
  return items.map((i) => ("text" in i ? i.text : i.id));
}

describe("mergeTranscript", () => {
  test("the reported repro: second send anchors to the live reply, not the stale store date", () => {
    // Hydrated store ends at D0. Send 1 -> reply 1 streams (live only, REST
    // lags). Send 2 arrives before reconcile: its date anchor is still D0 —
    // identical to echo 1's. Identity anchoring must put echo 2 after the
    // live reply regardless.
    const storeEntries = [
      store("2026-01-01T10:00:00Z", user("first"), { otid: "otid-first" }),
    ];
    const echoes = [
      echo(user("message one"), { afterDate: "2026-01-01T10:00:00Z" }),
      // Anchored to reply 1 (uuid a1) — NOT afterDate, which is stale (D0).
      echo(user("message two"), { afterDate: "2026-01-01T10:00:00Z", anchorUuid: "a1" }),
    ];
    const liveRows = [live(assistant("reply one"), { uuid: "a1" })];
    const out = mergeTranscript(storeEntries, echoes, liveRows);
    expect(texts(out)).toEqual(["first", "message one", "reply one", "message two"]);
  });

  test("reply1 live row retires (caller-filtered) and store lands it — no reorder", () => {
    // Same repro one reconcile later: reply 1 is in the store under its uuid,
    // its live row was filtered by the caller, echo 2's anchor still resolves
    // against the store record.
    const storeEntries = [
      store("2026-01-01T10:00:00Z", user("first"), { otid: "otid-first" }),
      store("2026-01-01T10:00:05Z", assistant("reply one"), { uuid: "a1" }),
    ];
    const echoes = [
      echo(user("message one"), { afterDate: "2026-01-01T10:00:00Z" }),
      echo(user("message two"), { afterDate: "2026-01-01T10:00:00Z", anchorUuid: "a1" }),
    ];
    const out = mergeTranscript(storeEntries, echoes, []);
    expect(texts(out)).toEqual(["first", "message one", "reply one", "message two"]);
  });

  test("both echoes identity-anchored keep send order even with equal anchors", () => {
    const storeEntries = [store("2026-01-01T10:00:00Z", user("first"), { otid: "otid-first" })];
    const echoes = [
      echo(user("message one"), { anchorOtid: "otid-first" }),
      echo(user("message two"), { anchorOtid: "otid-first" }),
    ];
    const out = mergeTranscript(storeEntries, echoes, []);
    expect(texts(out)).toEqual(["first", "message one", "message two"]);
  });

  test("three consecutive sends with interleaved replies stay in sequence", () => {
    const storeEntries = [
      store("2026-01-01T10:00:00Z", user("seed"), { otid: "seed" }),
    ];
    const echoes = [
      echo(user("m1"), { anchorOtid: "seed" }),
      echo(user("m2"), { anchorUuid: "a1" }),
      echo(user("m3"), { anchorUuid: "a2" }),
    ];
    const liveRows = [
      live(assistant("r1"), { uuid: "a1" }),
      live(assistant("r2"), { uuid: "a2" }),
    ];
    const out = mergeTranscript(storeEntries, echoes, liveRows);
    expect(texts(out)).toEqual(["seed", "m1", "r1", "m2", "r2", "m3"]);
  });

  test("date-anchored echoes interleave into the store backbone (original behavior preserved)", () => {
    const storeEntries = [
      store("2026-01-01T10:00:00Z", user("s1")),
      store("2026-01-01T10:00:10Z", assistant("r1")),
      store("2026-01-01T10:00:20Z", user("s2")),
    ];
    const echoes = [echo(user("e-mid"), { afterDate: "2026-01-01T10:00:10Z" })];
    const out = mergeTranscript(storeEntries, echoes, []);
    expect(texts(out)).toEqual(["s1", "r1", "e-mid", "s2"]);
  });

  test("undated echoes (pre-hydration send) render after store records, before live rows", () => {
    const storeEntries = [store("2026-01-01T10:00:00Z", assistant("history"))];
    const echoes = [echo(user("fast send"), { afterDate: null })];
    const liveRows = [live(assistant("streaming"))];
    const out = mergeTranscript(storeEntries, echoes, liveRows);
    expect(texts(out)).toEqual(["history", "fast send", "streaming"]);
  });

  test("anchor that resolves nowhere falls back to the newest edge, keeping send order", () => {
    // All anchors retired and gone (fresh open after hydrate): echoes land in
    // send order at the end, not before their vanished anchors.
    const storeEntries = [store("2026-01-01T10:00:00Z", user("s1"))];
    const echoes = [
      echo(user("m1"), { anchorUuid: "gone-1" }),
      echo(user("m2"), { anchorUuid: "gone-2" }),
    ];
    const out = mergeTranscript(storeEntries, echoes, []);
    expect(texts(out)).toEqual(["s1", "m1", "m2"]);
  });

  test("live streaming rows always render after all echoes (current turn in flight)", () => {
    const storeEntries = [store("2026-01-01T10:00:00Z", user("s1"), { otid: "seed" })];
    const echoes = [echo(user("m1"), { anchorOtid: "seed" })];
    const liveRows = [live(assistant("r1"), { uuid: "a1" })];
    const out = mergeTranscript(storeEntries, echoes, liveRows);
    expect(texts(out)).toEqual(["s1", "m1", "r1"]);
  });
});
