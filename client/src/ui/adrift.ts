// Torn sails with no sailcloth (owner, 2026-10-20: «без парусины корабль ваще не плывет … может какое-то
// самоуничтожение»). The server sends `adrift` (server/src/game/adrift.ts): the jury rig's progress, stranded, the
// scuttle's wait. Here: the action bar's words for it (bottom band, never the middle — «Корабль без парусов», the
// «Аварийный парус NN %» button and «Затопить · и в порт»), and the question before scuttling with what it costs (the
// sinking's own reckoning, shared/src/data/adrift.ts scuttleQuote) — asked from the bar and from the ship window.

import type { AdriftView, JuryHold } from '../../../shared/src/data/adrift.ts';
import { JURY_TO, scuttleQuote } from '../../../shared/src/data/adrift.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { cargoValue, tx } from '../../../shared/src/sim/shipstats.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/adrift.ts';
import type { ClientState } from '../state.ts';
import { askHtml } from './confirm.ts';
import { esc } from './dom.ts';
import { placeName } from './maps.ts';

export const LA = dict(EN, RU);

/** The bar's facts (ActFacts.adrift) from her adrift view: null when there is nothing of it. */
export interface AdriftFacts {
  /** The rig's progress 0..100 (null: not rigging). */
  pct: number | null;
  /** Her sails now, % of the bar (the rig brings them to `to`). */
  now: number;
  /** Where the rig stops, % of the bar (25). */
  to: number;
  left: number;
  paused: boolean;
  /** Why it waits (with `paused`): under fire, a fire aboard, canvas torn as fast as it is rigged. */
  hold: JuryHold | null;
  stranded: boolean;
  /** Minutes until she may scuttle again (0: now). */
  cdMin: number;
}

/** Seconds since the view came in, taken off the rig's time and the wait (the server says only on a change). A rig
 *  that waits keeps its time (forum 48: a rig that stood still had its clock run down to «0 с»). */
export function adriftFacts(v: AdriftView | null, ageSec = 0): AdriftFacts | null {
  if (!v) return null;
  const left = Math.max(0, v.left - (v.paused ? 0 : Math.floor(ageSec)));
  const pct = v.jury === null ? null : Math.round(Math.min(1, v.jury) * 100);
  // (an older server: her sails from the rig's progress)
  const share = v.sails ?? (v.jury === null ? 0 : Math.min(1, v.jury) * JURY_TO);
  return {
    pct,
    now: Math.min(100, Math.floor(share * 100 + 1e-6)),
    to: Math.round(JURY_TO * 100),
    left,
    paused: v.paused,
    hold: v.paused ? v.hold ?? 'shot' : null,
    stranded: v.stranded,
    cdMin: Math.ceil(Math.max(0, v.cd - ageSec) / 60),
  };
}

/** What the rig does now, in a few words: «12 из 25 % парусов · ещё 31 с», «ждёт: под огнём», «почти готов». */
function rigState(f: AdriftFacts): string {
  if (f.paused) return LA(f.hold === 'fire' ? 'info.fire' : f.hold === 'torn' ? 'info.torn' : 'info.paused');
  return f.left > 0 ? LA('info.rig', { now: f.now, to: f.to, s: f.left }) : LA('info.rigSoon', { now: f.now, to: f.to });
}

/** The muted line over the bar: «Корабль без парусов · аварийный парус: 10 из 25 % парусов · ещё 31 с». */
export function adriftInfo(f: AdriftFacts): string {
  const parts = [LA('title')];
  if (f.pct !== null) parts.push(rigState(f));
  else if (f.stranded) parts.push(LA('info.far'));
  return parts.join(' · ');
}

/** The jury sail's button: its name, and under it its time or why it waits. */
export function juryButton(f: AdriftFacts): { label: string; sub: string; title: string } {
  const sub = f.paused ? LA('a.jurySubWait') : f.left > 0 ? LA('a.jurySub', { s: f.left }) : LA('a.jurySubSoon');
  return { label: LA('a.jury'), sub, title: juryTapText(f) };
}

/** What the jury sail's button says when pressed: the crew rigs it by themselves — what it is, how far, what it waits on. */
export function juryTapText(f: AdriftFacts): string {
  const why = f.paused ? ` ${LA(f.hold === 'fire' ? 'a.juryFire' : f.hold === 'torn' ? 'a.juryTorn' : 'a.juryPaused')}` : '';
  const how = f.paused ? '' : f.left > 0 ? ` ${LA('a.juryLeft', { s: f.left })}` : ` ${LA('a.jurySoon')}`;
  return `${LA('a.juryWhat', { now: f.now, to: f.to })}${how}${why} ${LA('a.juryRest', { to: f.to })}`;
}

/** The question's body: what it costs, what is kept, where she wakes. */
export function scuttleHtml(state: ClientState): string {
  const self = state.self, st = state.ownStats, you = state.you;
  if (!self || !st) return '';
  const q = scuttleQuote({
    gold: self.gold,
    classPrice: SHIP_CLASSES[self.loadout.classId]?.price ?? 0,
    crew: you?.crew ?? self.crew,
    cargoValue: cargoValue(self.cargo),
    lifeboats: tx(st, 'lifeboats'),
  });
  const portId = state.adrift?.port ?? null;
  const port = portId ? state.ports.find((p) => p.id === portId) : null;
  const items = [
    LA('q.fee', { n: q.fee }),
    LA('q.purse', { n: q.purse }),
    q.cargo > 0 ? LA('q.hold', { n: q.cargo }) : LA('q.holdEmpty'),
    LA('q.crew', { n: q.crew }),
    LA('q.rest'),
  ];
  return `<h3 id="confirm-text" class="sc-q">${esc(LA('q.title'))}</h3>
    <p class="sc-lead">${esc(LA('q.lead'))}</p>
    <ul class="sc-cost">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="sc-kept">${esc(LA('q.kept'))}</p>
    ${port ? `<p class="sc-port">${esc(LA('q.port', { port: placeName(port.name) }))}</p>` : ''}
    <p class="muted sc-rule">${esc(LA('q.rule'))}</p>`;
}

/** Why the client will not even ask (the server checks it all again), or null. */
export function scuttleBlock(state: ClientState): string | null {
  const self = state.self, you = state.you;
  if (!self || !you) return LA('no.port');
  if (self.dockedAt) return LA('no.port');
  if (you.combat || you.underFire) return LA('no.fight');
  const cd = adriftFacts(state.adrift, (performance.now() - state.adriftAt) / 1000)?.cdMin ?? 0;
  if (cd > 0) return LA('no.cd', { m: cd });
  return null;
}

/** «Затопить и вернуться в порт»: the question with its cost, then the order. */
export async function askScuttle(state: ClientState, send: (m: ClientMsg) => void, toast: (msg: string) => void): Promise<void> {
  const why = scuttleBlock(state);
  if (why) return toast(why);
  const ok = await askHtml(scuttleHtml(state), LA('q.yes'), LA('q.no'), 'sc-confirm');
  if (ok) send({ t: 'scuttle_home' });
}
