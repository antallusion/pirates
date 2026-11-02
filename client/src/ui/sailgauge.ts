// The gold arc round the helm (#tc-sailring): the sail she ACTUALLY carries, never just the captain's last order (forum
// 48, topic 8: «под автобоем скорость 4,6 уз, а жёлтой дуги нет»; «паруса сбиты, ход 2,4 уз, а дуга полная»).
//  - lit:     the canvas drawing now = her sail setting as the server sails her (StateYou.sail: whoever set it — the
//             captain, the helmsman to a mark, a chase or the auto-battle, a passage, an anchor or a hold) × what is
//             left of her sails (the bar of sails: torn canvas draws nothing; a jury sail is part of the bar). The arc
//             eases between snapshots by CSS.
//  - ordered: the setting asked for (the captain's step, or the helmsman's); the arc's faint part past `lit` shows what
//             the torn canvas cannot give.
//  - torn:    her sails under a fifth: the arc's ordered part turns red-brown (the speed under it is the bare-poles way,
//             shared/src/data/adrift.ts SAIL_TORN_MUL).
// In port (and gone from the sea) the arc is empty, as the speed under it is blank.

import { JURY_BELOW } from '../../../shared/src/data/adrift.ts';

export interface GaugeIn {
  docked: boolean;
  /** The server's word on her (StateYou): her sail setting now and the one asked for (0..1), her sails' bar. */
  you: { sail: number; sailT: number; sails: number; sailsMax: number } | null;
  /** The helmsman has the wheel (a course to a mark, a chase or the auto-battle, a passage): the server's sail. */
  helmsman: boolean;
  /** The captain's own step 0..4 (when she has the wheel: the order shows at once, before the server's word). */
  step: number;
}

export interface Gauge {
  /** The arc lit: 0..1 of the gauge. */
  lit: number;
  /** The setting asked for: 0..1. */
  ordered: number;
  /** Her sails' bar 0..1. */
  health: number;
  torn: boolean;
}

const c01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

export function sailGauge(g: GaugeIn): Gauge {
  const y = g.you;
  if (g.docked || !y) return { lit: 0, ordered: 0, health: 1, torn: false };
  const health = c01(y.sails / Math.max(1, y.sailsMax));
  const set = c01(y.sail);
  const ordered = g.helmsman ? c01(y.sailT) : c01(g.step / 4);
  return { lit: set * health, ordered: Math.max(ordered, set), health, torn: health < JURY_BELOW };
}

/** The gauge's arc in degrees (it runs 270° from bottom left round to bottom right). A sail set at all is never drawn
 *  as nothing: a shred of canvas still shows a sliver, as the speed under it still shows her way. */
export function gaugeDeg(x: number): number {
  if (x <= 0) return 0;
  return Math.round(Math.max(4, x * 270) * 10) / 10;
}

/** Who sets her sails now: the helmsman (a course to a mark, a chase or the auto-battle while the captain's hand is off
 *  the helm, a passage) — then the server's asked-for setting is the order shown; else the captain's own step. */
export function helmsmanSails(s: { autosail: unknown; pursuit: unknown; roamRun: number | null; helm: boolean; voyage: unknown }): boolean {
  return !!s.autosail || !!s.voyage || ((!!s.pursuit || s.roamRun !== null) && !s.helm);
}
