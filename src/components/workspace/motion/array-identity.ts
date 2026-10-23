// Gives every bar of the array visualiser a stable identity, so that when two
// cells exchange values the *bars* exchange places (and can be animated
// crossing) instead of both being redrawn in place.
//
// The interpreter only reports successive array states, so identity is
// inferred from how values move between them:
// - Several cells changed at once (a batched frame at fast/instant speed, or a
//   multiple assignment): match each new value to the nearest changed cell that
//   previously held it, i.e. treat the change as a permutation where possible.
// - One cell changed: remember the write. The classic swap through a temporary
//   (`aux <- v[i]; v[i] <- v[j]; v[j] <- aux`) shows up as two single writes,
//   i: a -> b and later j: b -> a. When the second one arrives the two bars
//   exchange identities, so the swap reads as two bars crossing.
// Anything that is not a permutation (copies, fresh values) keeps its identity
// and simply changes height in place.

import type { VariableSnapshotValue } from "@/src/engine/types";

interface Write {
  slot: number;
  from: string;
  to: string;
}

export interface ArrayTrack {
  /** Value signature of the state these ids describe. */
  signature: string;
  /** Values (as comparable keys) per slot. */
  keys: string[];
  /** Stable id per slot. */
  ids: number[];
  /** Per-slot counter bumped when a value is overwritten in place (drives the write flash); travels with the id. */
  writes: number[];
  /** Recent single-cell writes, waiting for their swap partner. */
  log: Write[];
  nextId: number;
}

const LOG_SIZE = 6;

const keyOf = (value: VariableSnapshotValue) => JSON.stringify(value) ?? "null";

export function signatureOf(values: VariableSnapshotValue[]): string {
  return values.map(keyOf).join("\u0001");
}

export function createTrack(values: VariableSnapshotValue[], firstId = 0): ArrayTrack {
  return {
    signature: signatureOf(values),
    keys: values.map(keyOf),
    ids: values.map((_, i) => firstId + i),
    writes: values.map(() => 0),
    log: [],
    nextId: firstId + values.length,
  };
}

export function advanceTrack(track: ArrayTrack, values: VariableSnapshotValue[]): ArrayTrack {
  const signature = signatureOf(values);
  if (signature === track.signature) return track;
  const keys = values.map(keyOf);
  // A different shape is a different array: start over with fresh identities.
  if (keys.length !== track.keys.length) return createTrack(values, track.nextId);

  const changed: number[] = [];
  keys.forEach((key, i) => {
    if (key !== track.keys[i]) changed.push(i);
  });
  const ids = track.ids.slice();
  const writes = track.writes.slice();
  let log = track.log;

  if (changed.length === 1) {
    const slot = changed[0];
    const from = track.keys[slot];
    const to = keys[slot];
    const partner = log.findIndex((w) => w.slot !== slot && w.from === to && w.to === from && keys[w.slot] === from);
    if (partner >= 0) {
      // Second half of a swap through a temporary: exchange the two bars.
      const other = log[partner].slot;
      [ids[slot], ids[other]] = [ids[other], ids[slot]];
      [writes[slot], writes[other]] = [writes[other], writes[slot]];
      log = log.filter((_, i) => i !== partner);
    } else {
      writes[slot] += 1;
      log = [...log, { slot, from, to }].slice(-LOG_SIZE);
    }
  } else {
    // Permutation matching among the changed cells, nearest source first.
    const used = new Set<number>();
    const unmatched: number[] = [];
    for (const slot of changed) {
      let best = -1;
      for (const source of changed) {
        if (used.has(source) || source === slot || track.keys[source] !== keys[slot]) continue;
        if (best < 0 || Math.abs(source - slot) < Math.abs(best - slot)) best = source;
      }
      if (best >= 0) {
        used.add(best);
        ids[slot] = track.ids[best];
        writes[slot] = track.writes[best];
      } else unmatched.push(slot);
    }
    // Cells whose new value came from nowhere reuse the leftover identities, so ids stay unique.
    const leftovers = changed.filter((source) => !used.has(source));
    unmatched.forEach((slot, i) => {
      ids[slot] = track.ids[leftovers[i]];
      writes[slot] = track.writes[leftovers[i]] + 1;
    });
    log = [];
  }

  return { signature, keys, ids, writes, log, nextId: track.nextId };
}

/** Ascending or descending, ignoring empty cells, with at least two distinct values. */
export function isSorted(values: VariableSnapshotValue[]): boolean {
  const numbers = values.filter((v): v is number => typeof v === "number");
  if (numbers.length < 2 || numbers.length !== values.length) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] < numbers[i - 1]) ascending = false;
    if (numbers[i] > numbers[i - 1]) descending = false;
  }
  return (ascending || descending) && !(ascending && descending);
}
