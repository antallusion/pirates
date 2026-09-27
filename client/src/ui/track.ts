// The quest the captain follows (docs/11 P6): picked in the chart's quest log, else the first that points somewhere.
// Its step shows under the region line and a gold mark on the screen's rim points the way to it.

import type { PrivateState } from '../../../shared/src/protocol.ts';

type Quest = PrivateState['quests'][number];

const KEY = 'gravetide.track';

export function trackedId(): string | null {
  return globalThis.localStorage?.getItem(KEY) ?? null;
}

export function setTracked(id: string | null): void {
  if (id) globalThis.localStorage?.setItem(KEY, id);
  else globalThis.localStorage?.removeItem(KEY);
}

export function trackedQuest(quests: Quest[] | undefined): Quest | null {
  const qs = quests ?? [];
  const id = trackedId();
  return qs.find((q) => q.id === id) ?? qs.find((q) => q.target) ?? qs[0] ?? null;
}

/** Where the pointer should lead, or null when there is nowhere to go (no place, or already there). */
export function questPointer(q: Quest | null, x: number, y: number, region: string): { x: number; y: number; d: number } | null {
  const t = q?.target;
  if (!t) return null;
  if (t.region && t.region === region) return null; // inside the region the step asks for
  const d = Math.hypot(t.x - x, t.y - y);
  if (!t.region && d < (t.r ?? 400)) return null; // arrived
  return { x: t.x, y: t.y, d };
}
