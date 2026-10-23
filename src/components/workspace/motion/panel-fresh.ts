import { useState } from "react";

/**
 * For append-only lists (console lines, desk-check rows): the index from which
 * items are "new" and should animate in. Items already there when the panel
 * mounts stay still; when the list shrinks (a new run, a scrub back) the
 * boundary follows it down so re-added items animate again.
 */
export function useFreshFrom(count: number): number {
  const [base, setBase] = useState(count);
  if (count < base) {
    setBase(count);
    return count;
  }
  return base;
}
