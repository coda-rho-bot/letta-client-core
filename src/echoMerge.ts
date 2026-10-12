/**
 * Transcript merge: external store backbone + local echoes + live stream rows.
 *
 * Pure and unit-tested (no session/network) because this merge is where the
 * message-ordering bug lived: an echo's date anchor came from the external
 * store's newest record, but the PREVIOUS turn's reply often existed only as
 * a live stream row (REST history lags writes by seconds to tens of
 * seconds). Two sends in that window stamped identical stale anchors and the
 * second echo rendered beside the first instead of after the visible reply.
 *
 * Anchoring rules, in priority order per echo:
 *  1. IDENTITY anchor (anchorOtid/anchorUuid): the echo renders after the
 *     LAST entry matching that identity — live row or store record. Captured
 *     at send time from the newest live row, so the echo lands after
 *     everything the user could already see, regardless of when REST
 *     persists it.
 *  2. DATE anchor (afterDate): the echo slots after store records with
 *     date <= afterDate and before anything newer — used when no live rows
 *     existed at send (store was already current).
 *  3. Undated (null afterDate, no identity): pre-hydration sends; after all
 *     store records, before live rows.
 *
 * Live rows always render at the newest edge — the stream has no dates, and
 * it is by definition the current turn's in-flight content. (Rows already
 * covered by the store are expected to be filtered out by the caller —
 * retirement by uuid, mirroring echo retirement by otid.)
 */
import type { TranscriptItem } from "./model";

/** An app-only row (echo, error) plus its placement anchor. */
export interface EchoEntry {
  item: TranscriptItem;
  /** Date anchor: render after store records with date <= this. Null = undated. */
  afterDate: string | null;
  /** Identity anchor: render after the last entry with this otid (if present). */
  anchorOtid?: string;
  /** Identity anchor: render after the last entry with this uuid (if present). */
  anchorUuid?: string;
}

/** Identity attached to each renderable entry for anchor matching. */
export interface EntryIdentity {
  uuid?: string;
  otid?: string;
}

export interface StoreEntry extends EntryIdentity {
  date: string;
  item: TranscriptItem;
}

export interface LiveEntry extends EntryIdentity {
  item: TranscriptItem;
}

function identityMatches(entry: EntryIdentity, echo: EchoEntry): boolean {
  if (echo.anchorOtid !== undefined && entry.otid === echo.anchorOtid) return true;
  if (echo.anchorUuid !== undefined && entry.uuid === echo.anchorUuid) return true;
  return false;
}

/**
 * Assemble the oldest-first transcript. chat.tsx reverses for the inverted
 * FlatList.
 */
export function mergeTranscript(
  storeEntries: readonly StoreEntry[],
  echoes: readonly EchoEntry[],
  live: readonly LiveEntry[],
): TranscriptItem[] {
  const hasIdentityAnchor = (e: EchoEntry) => e.anchorOtid !== undefined || e.anchorUuid !== undefined;

  // Date-anchored echoes interleave into the store backbone by date;
  // identity-anchored echoes insert in a second pass; undated sit between
  // backbone and live rows.
  const dated = echoes
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !hasIdentityAnchor(e) && e.afterDate !== null)
    .sort((a, b) => (a.e.afterDate ?? "").localeCompare(b.e.afterDate ?? "") || a.i - b.i);
  const anchored = echoes.filter(hasIdentityAnchor);
  const undated = echoes.filter((e) => !hasIdentityAnchor(e) && e.afterDate === null);

  // Assembled entries carry identity where known (store records and live
  // rows); echo items don't.
  const assembled: Array<{ item: TranscriptItem; identity?: EntryIdentity }> = [];
  let echoIdx = 0;
  for (const entry of storeEntries) {
    while (echoIdx < dated.length && (dated[echoIdx]!.e.afterDate ?? "") < entry.date) {
      assembled.push({ item: dated[echoIdx]!.e.item });
      echoIdx++;
    }
    assembled.push({ item: entry.item, identity: entry });
  }
  while (echoIdx < dated.length) {
    assembled.push({ item: dated[echoIdx]!.e.item });
    echoIdx++;
  }
  const firstLiveIdx = assembled.length + undated.length;
  for (const e of undated) assembled.push({ item: e.item });
  for (const l of live) assembled.push({ item: l.item, identity: l });

  // Identity-anchored echoes: insert after the LAST entry matching the
  // anchor, searching forward from the previous anchored echo's insertion
  // point so consecutive sends never reorder against each other. An anchor
  // that resolves nowhere (retired and gone) falls back to the cursor — the
  // newest position at that point in the sequence.
  let cursor = firstLiveIdx;
  for (const echo of anchored) {
    let target = -1;
    for (let i = cursor; i < assembled.length; i++) {
      const identity = assembled[i]!.identity;
      if (identity && identityMatches(identity, echo)) target = i;
    }
    const insertAt = target >= 0 ? target + 1 : cursor;
    assembled.splice(insertAt, 0, { item: echo.item });
    cursor = insertAt + 1;
  }

  return assembled.map((a) => a.item);
}
