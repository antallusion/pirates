// Tattoos and the side quests' rewards (docs/12 P9). A deed done at sea, or the last quest of a chain, earns a
// tattoo; Old Needle inks it in any haven of the Brethren; a captain wears two at first, one more at levels 15, 30
// and 45 (and one for Old Needle's own mark), and changes them in any tavern. Hidden quests begin with a deed. A
// chain's quests end with a choice of three pieces of gear.

import { unlockDeed } from './looks.ts';
import { HIDDEN_QUESTS, HIDDEN_SPECS, SIDE_QUESTS, TATTOOS, TATTOO_BY_ID, tattooSlots } from '../../../shared/src/data/sidequests.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import type { Item, Slot } from '../../../shared/src/data/items.ts';
import { CAPTAIN_SLOTS, SHIP_SLOTS } from '../../../shared/src/data/items.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import type { QuestDef } from '../../../shared/src/data/quests.ts';
import type { Flag, StatMods } from '../../../shared/src/data/stats.ts';
import type { TattooView } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import { ownIsland } from './estate.ts';
import { takeItem } from './gear.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

// The side and hidden quests are known to the quest system by their ids.
for (const q of [...SIDE_QUESTS, ...HIDDEN_QUESTS]) QUESTS_BY_ID[q.id] = q;

export interface TattooProfile {
  owned: string[];
  pending: string[];
  active: (string | null)[];
  counts: Record<string, number>;
}

export function sanitizeTattoos(p: Profile): TattooProfile {
  const t = (p.tattoos ??= { owned: [], pending: [], active: [], counts: {} });
  t.counts ??= {};
  return t;
}

/** A tattoo earned: it waits for Old Needle in a haven of the Brethren. */
export function earnTattoo(game: Game, s: PlayerSession, id: string): void {
  const p = s.profile;
  const def = TATTOO_BY_ID[id];
  if (!p || !def) return;
  const t = sanitizeTattoos(p);
  if (t.owned.includes(id) || t.pending.includes(id)) return;
  t.pending.push(id);
  game.sendTo(s, { t: 'toast', msg: `Old Needle will ink ${def.name[0]} for you in any haven of the Brethren.`, kind: 'gold' });
  sendTattoos(game, s);
}

/** A deed counted toward a tattoo (or a hidden quest). */
export function tattooCount(game: Game, s: PlayerSession, key: string, n = 1): void {
  const p = s.profile;
  if (!p) return;
  const t = sanitizeTattoos(p);
  t.counts[key] = (t.counts[key] ?? 0) + n;
  checkTriggers(game, s);
}

/** The active tattoos' strength on the ship (an effect of its own, kept in place). */
export function applyTattoos(ship: ShipEntity, p: Profile, now: number): void {
  const t = sanitizeTattoos(p);
  const mods: StatMods = {};
  const flags: Flag[] = [];
  for (const id of t.active) {
    const def = id ? TATTOO_BY_ID[id] : undefined;
    if (!def) continue;
    for (const [k, v] of Object.entries(def.mods ?? {})) (mods as Record<string, number>)[k] = ((mods as Record<string, number>)[k] ?? 0) + (v ?? 0);
    flags.push(...(def.flags ?? []));
  }
  ship.effects = ship.effects.filter((e) => e.id !== 'tattoos');
  if (Object.keys(mods).length || flags.length) ship.effects.push({ id: 'tattoos', until: 1e12, mods, flags });
  ship.recompute(now);
}

export function setTattoo(game: Game, s: PlayerSession, slot: number, id: string | null): string | null {
  const p = s.profile!;
  const t = sanitizeTattoos(p);
  if (!s.ship?.docked) return 'Tattoos are changed in a tavern.';
  const slots = tattooSlots(p.level, t.owned);
  if (slot < 0 || slot >= slots) return 'That place is not yours yet.';
  if (id !== null && !t.owned.includes(id)) return 'No tattoo of that kind is yours.';
  while (t.active.length < slots) t.active.push(null);
  if (id !== null) for (let i = 0; i < t.active.length; i++) if (t.active[i] === id) t.active[i] = null;
  t.active[slot] = id;
  applyTattoos(s.ship!, p, game.now);
  if (id) game.sendTo(s, { t: 'toast', msg: `${TATTOO_BY_ID[id].name[0]} is set in its place.`, kind: 'good' });
  sendTattoos(game, s);
  return null;
}

/** The deeds that earn tattoos, and the ones that start hidden quests. */
function checkTriggers(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const t = sanitizeTattoos(p);
  const ship = s.ship;
  const beasts = Object.values(p.beasts ?? {}).reduce((a, n) => a + (n ?? 0), 0);
  for (const def of TATTOOS) {
    if (t.owned.includes(def.id) || t.pending.includes(def.id)) continue;
    const tr = def.trigger;
    let ok = false;
    switch (tr.kind) {
      case 'miles': ok = (p.stats.distance ?? 0) / 1000 >= tr.km; break;
      case 'storm': ok = (t.counts.storm ?? 0) > 0; break;
      case 'crossing': ok = (t.counts.north ?? 0) > 0 && (t.counts.south ?? 0) > 0; break;
      case 'abyss': ok = ship?.region === 'the_abyss' || (t.counts.abyss ?? 0) > 0; break;
      case 'fought': ok = (t.counts.fought ?? 0) >= tr.n; break;
      case 'beasts': ok = beasts >= tr.n; break;
      case 'flensed': ok = (t.counts.flensed ?? 0) >= tr.n; break;
      case 'hits': ok = (t.counts.hits ?? 0) >= tr.n; break;
      case 'charted': ok = s.discovered.size >= tr.n; break;
      case 'wonders': ok = (p.wonders?.length ?? 0) >= tr.n; break;
      case 'sirens': ok = (t.counts.sirens ?? 0) >= tr.n; break;
      case 'dives': ok = Object.keys(p.explore?.dived ?? {}).length >= tr.n || (t.counts.dives ?? 0) >= tr.n; break;
      case 'rescued': ok = (p.rescued ?? 0) >= tr.n; break;
      case 'star': ok = (t.counts.star ?? 0) > 0; break;
      case 'boss': ok = (t.counts.boss ?? 0) > 0; break;
      case 'level': ok = p.level >= tr.n; break;
      case 'island': ok = !!ownIsland(game, s.accountId); break;
      case 'chain': break;
    }
    if (ok) earnTattoo(game, s, def.id);
  }
  // Hidden quests: a deed opens them.
  for (const h of HIDDEN_SPECS) {
    if (p.quests.done.includes(h.id) || p.quests.active.some((a) => a.id === h.id)) continue;
    const n = h.trigger.kind === 'rescued' ? p.rescued ?? 0 : h.trigger.kind === 'herring' ? p.fishing?.caught.herring?.n ?? 0 : t.counts[h.trigger.kind] ?? 0;
    if (n < h.trigger.n) continue;
    p.quests.active.push({ id: h.id, step: 0, progress: 0, startedAt: game.now });
    game.sendTo(s, { t: 'toast', msg: `A new quest begins: ${h.name[0]}.`, kind: 'gold' });
  }
}

/** Every five seconds: Old Needle's work in the havens, the tattoos kept on the ship, the long deeds counted. */
export function stepTattoos(game: Game): void {
  for (const s of game.sessions) {
    const p = s.profile, ship = s.ship;
    if (!p || !ship) continue;
    const t = sanitizeTattoos(p);
    // The sea's two ends and the deep.
    if (!ship.docked) {
      if (ship.state.y < 12000) t.counts.north = 1;
      if (ship.state.y > 84000) t.counts.south = 1;
      if (ship.region === 'the_abyss') t.counts.abyss = 1;
      if (game.worldEvents.active(game).some((e) => e.kind === 'storm_century' && e.region === ship.region)) t.counts.storm = 1;
    }
    // Old Needle in a haven of the Brethren.
    const port = ship.docked ? game.portById(ship.docked) : undefined;
    if (port?.faction === 'confederacy' && t.pending.length) {
      for (const id of t.pending) {
        t.owned.push(id);
        game.sendTo(s, { t: 'toast', msg: `Old Needle inks ${TATTOO_BY_ID[id].name[0]}.`, kind: 'gold' });
        // Into a free place at once.
        const slots = tattooSlots(p.level, t.owned);
        while (t.active.length < slots) t.active.push(null);
        const free = t.active.findIndex((x) => x === null);
        if (free >= 0 && free < slots) t.active[free] = id;
      }
      t.pending = [];
      applyTattoos(ship, p, game.now);
      sendTattoos(game, s);
    }
    // The tattoos' strength is kept on whatever ship she sails.
    if (t.active.some(Boolean) && !ship.hasEffect('tattoos')) applyTattoos(ship, p, game.now);
    checkTriggers(game, s);
    // The window kept up to date (a new place at a level, a tattoo earned), and a reward waiting since the last visit.
    if (sent.get(s) !== JSON.stringify(tattooView(p))) sendTattoos(game, s);
    if (p.choice && !choiceSent.has(s)) {
      choiceSent.add(s);
      game.sendTo(s, { t: 'choice', view: p.choice });
    }
  }
}

const sent = new WeakMap<PlayerSession, string>();
const choiceSent = new WeakSet<PlayerSession>();

export function tattooView(p: Profile): TattooView {
  const t = sanitizeTattoos(p);
  return { owned: [...t.owned], pending: [...t.pending], active: [...t.active], slots: tattooSlots(p.level, t.owned) };
}

export function sendTattoos(game: Game, s: PlayerSession): void {
  if (!s.profile) return;
  const view = tattooView(s.profile);
  sent.set(s, JSON.stringify(view));
  game.sendTo(s, { t: 'tattoos', view });
}

// ------------------------------------------------------------------------------------------------ a choice of three

/** A chain's reward: three pieces of gear, fine or better, for the captain to choose one of. */
export function offerChoice(game: Game, s: PlayerSession, q: QuestDef): void {
  const p = s.profile!;
  // A reward left unchosen is not lost: its first piece goes to the locker.
  if (p.choice?.items[0]) takeItem(game, s, p.choice.items[0]);
  const lvl = Math.max(1, Math.min(10, s.ship?.shipLevel ?? 1));
  const pool: Slot[] = [...SHIP_SLOTS.filter((x) => x !== 'tackle'), ...CAPTAIN_SLOTS];
  const items: Item[] = [];
  const used = new Set<Slot>();
  for (let i = 0; i < 3; i++) {
    const free = pool.filter((x) => !used.has(x));
    const slot = free[game.rng.int(0, free.length - 1)];
    used.add(slot);
    items.push(makeItem(game.rng, p.itemSeq++, { ilvl: lvl, rarity: game.rng.chance(0.25) ? 3 : 2, slot }));
  }
  p.choice = { quest: q.name, items };
  unlockDeed(game, s, 'quest'); // a chain's quest opens a little of the ship's look too (docs/12 P10 #12)
  choiceSent.add(s);
  game.sendTo(s, { t: 'choice', view: { quest: q.name, items } });
}

export function takeChoice(game: Game, s: PlayerSession, index: number): string | null {
  const p = s.profile!;
  const c = p.choice;
  if (!c || !c.items[index]) return 'Nothing to choose from.';
  p.choice = null;
  takeItem(game, s, c.items[index]);
  game.sendTo(s, { t: 'choice', view: null });
  return null;
}
