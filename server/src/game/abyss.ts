// The Abyss (docs/02 §14.A.1): the endgame sea past the Maelstrom Wall. Level 50 and Wren's "Last Leaf" open it
// (or sailing with a captain who has it); inside, depth pressure builds on every ship (whispers, visions, rot),
// reset only at the Islands of Light; dead-wind zones, black storms whose wind leaps, currents that run back toward
// the Eye, stars that lie to the compass; Echoes of ships the Abyss has taken; the Ancient Leviathans and the
// season's raid on the Eye (bosses.ts); abyssal metal, ritual shards and the Raising Ritual of the ghost ship;
// and the chapters of the story of who moved the stars.

import { dist } from '../../../shared/src/math.ts';
import type { AbyssView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { pointsInTree } from '../../../shared/src/data/talents.ts';
import type { WindSample } from '../../../shared/src/sim/wind.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import type { World } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { groupOfAccount } from './party.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export const ABYSS_LEVEL = 50;
const LIGHT_R = 500;
const DEAD_WIND_R = 2500;
const EYE_PULL_R = 14000;
const ECHO_CAP = 6;

export interface AbyssMap {
  eye: { x: number; y: number };
  lights: { x: number; y: number; name: string }[];
  deadWinds: { x: number; y: number; r: number }[];
}

/** The chapters of "who moved the stars" (docs/02 §14.E), revealed by what a captain lives through. */
export const CHAPTERS: { id: string; title: string; text: string }[] = [
  { id: 'wall', title: 'I. Past the Wall', text: 'Wren\'s last leaf is blank but for one line in his hand: "The stars here are not ours. Someone moved them — or moved us."' },
  { id: 'light', title: 'II. The Islands of Light', text: 'The lighthouses of the Abyss were not built by the Crown. Their lenses are ground from abyssal glass, and they point down.' },
  { id: 'storm', title: 'III. The Black Storm', text: 'In the black storm the wind comes from everywhere at once. The Choir says it is the Deep breathing. Morrow said it was the sky turning over.' },
  { id: 'echo', title: 'IV. The Echoes', text: 'The Echoes sail the courses of ships that went down here — some you knew. They do not know they are dead. Some of them are still trying to get home.' },
  { id: 'ancient', title: 'V. The Ancients', text: 'The Ancient Leviathans carry star-charts scratched into their bones: the old sky, before it was moved. Drey knew. That is why his fleet sailed here.' },
  { id: 'eye', title: 'VI. The Eye', text: 'At the bottom of the Eye there is a sky. The stars in it are the right ones.' },
];

/** The Abyss's fixed features: the Eye, three Islands of Light, four dead-wind zones (by the world seed). */
export function abyssMap(world: World): AbyssMap {
  const [cx, cy] = REGIONS.the_abyss.center;
  const rng = new Rng(world.seed ^ 0xab55);
  const lights: AbyssMap['lights'] = [];
  const names = ['The Pale Lamp', 'Saint Wren\'s Light', 'The Lantern of Vael'];
  const shrines = world.islands.filter((i) => i.region === 'the_abyss' && !i.portId).sort((a, b) => (b.features.includes('shrine') ? 1 : 0) - (a.features.includes('shrine') ? 1 : 0) || b.radius - a.radius);
  for (const is of shrines) {
    if (lights.length >= 3) break;
    if (lights.some((l) => dist(l.x, l.y, is.x, is.y) < 6000)) continue;
    const a = rng.range(0, Math.PI * 2);
    lights.push({ x: Math.round(is.x + Math.sin(a) * (is.radius + 250)), y: Math.round(is.y - Math.cos(a) * (is.radius + 250)), name: names[lights.length] });
  }
  const deadWinds: AbyssMap['deadWinds'] = [];
  for (let i = 0; i < 200 && deadWinds.length < 4; i++) {
    const x = cx + rng.range(-9000, 9000), y = cy + rng.range(-7000, 7000);
    if (regionAt(world, x, y) !== 'the_abyss' || isLand(world, x, y)) continue;
    if (deadWinds.some((d) => dist(d.x, d.y, x, y) < 5000)) continue;
    deadWinds.push({ x: Math.round(x), y: Math.round(y), r: DEAD_WIND_R });
  }
  let eye = { x: cx, y: cy };
  for (let i = 0; i < 60 && isLand(world, eye.x, eye.y); i++) eye = { x: cx + rng.range(-3000, 3000), y: cy + rng.range(-3000, 3000) };
  return { eye: { x: Math.round(eye.x), y: Math.round(eye.y) }, lights, deadWinds };
}

/** Whether a captain may sail past the Maelstrom Wall: level 50 and the Last Leaf, or in a group with one who has it. */
export function abyssCleared(game: Game, s: PlayerSession): boolean {
  const p = s.profile;
  if (!p) return false;
  if (p.level >= ABYSS_LEVEL && p.quests.done.includes('q_last_leaf')) return true;
  const g = groupOfAccount(game, s.accountId);
  const me = s.ship;
  if (!g || !me) return false;
  return g.members.some((m) => {
    if (m === s.accountId) return false;
    const o = game.sessionByAccount(m);
    return !!o?.profile && !!o.ship && o.profile.level >= ABYSS_LEVEL && o.profile.quests.done.includes('q_last_leaf') && dist(o.ship.state.x, o.ship.state.y, me.state.x, me.state.y) < 4000;
  });
}

// ================================================================== every second, per captain

export function abyssSecond(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  const p = s.profile;
  if (!ship || !p || ship.docked || !ship.alive) return;
  const now = game.now;
  const inside = ship.region === 'the_abyss';
  if (!inside) {
    // Out in the ordinary sea the pressure eases, slowly.
    if (ship.pressure > 0) ship.pressure = Math.max(0, ship.pressure - 2 / 60);
    return;
  }
  // The Maelstrom Wall throws back those who have no leave to pass.
  if (!abyssCleared(game, s)) {
    const [cx, cy] = REGIONS.the_abyss.center;
    const dx = ship.state.x - cx, dy = ship.state.y - cy, d = Math.hypot(dx, dy) || 1;
    ship.state.x += (dx / d) * 350;
    ship.state.y += (dy / d) * 350;
    ship.state.heading = Math.atan2(dx, -dy);
    ship.state.speed *= 0.3;
    ship.hull -= ship.stats.hullMax * 0.03;
    if (ship.hull <= 0) {
      ship.hull = 0;
      game.beginSinking(ship);
    }
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
    if ((ship.talentReady.wallMsg ?? 0) <= now) {
      ship.talentReady.wallMsg = now + 20;
      game.toastShip(ship, `The Maelstrom Wall throws you back. The Abyss is for captains of level ${ABYSS_LEVEL} who carry Wren's Last Leaf (Wrecktide) — or who sail with one.`, 'bad');
    }
    return;
  }
  chapter(game, s, 'wall');
  const map = game.abyss;
  // The Islands of Light: rest here and the pressure lifts.
  const light = map.lights.find((l) => dist(l.x, l.y, ship.state.x, ship.state.y) < LIGHT_R);
  if (light) {
    if (ship.pressure > 0) {
      ship.pressure = Math.max(0, ship.pressure - 5);
      if (ship.pressure === 0) game.toastShip(ship, `The light of ${light.name} washes the dark out of the crew.`, 'good');
    }
    chapter(game, s, 'light');
    ship.effects = ship.effects.filter((e) => e.id !== 'abyss_rot');
    return;
  }
  const storm = game.weatherOf(ship) === 'black_storm';
  if (storm) chapter(game, s, 'storm');
  const ghost = ship.loadout.classId === 'ghost_ship' ? 0.5 : 1;
  const abyssal = pointsInTree(p.talents, 'abyssal') >= 10 ? 0.8 : 1;
  ship.pressure = Math.min(100, ship.pressure + ((storm ? 2 : 1) * ghost * abyssal) / 60);
  const pr = ship.pressure;
  if (pr >= 30 && (ship.talentReady.whispers ?? 0) <= now) {
    ship.talentReady.whispers = now + 300;
    ship.morale = Math.max(0, ship.morale - 1);
    game.toastShip(ship, 'Whispers in the rigging. The crew hears names it does not know (morale −1).', 'bad');
  }
  if (pr >= 90) {
    const rot = ship.effects.find((e) => e.id === 'abyss_rot');
    if ((ship.talentReady.rot ?? 0) <= now) {
      ship.talentReady.rot = now + 60;
      const n = Math.min(30, ((rot?.mods?.hullMax ?? 0) * -100) + 1);
      ship.effects = ship.effects.filter((e) => e.id !== 'abyss_rot');
      ship.addEffect({ id: 'abyss_rot', until: now + 1e9, mods: { hullMax: -n / 100 } }, now);
      game.toastShip(ship, `The Abyss eats the ship from inside: hull −${n}%. Make for an Island of Light.`, 'bad');
    }
    if ((ship.talentReady.vanish ?? 0) <= now) {
      ship.talentReady.vanish = now + 120;
      const lost = Math.max(1, Math.round(ship.crew * 0.01));
      ship.crew = Math.max(1, ship.crew - lost);
      game.toastShip(ship, `${lost} of the crew are not aboard any more. Nobody saw them go.`, 'bad');
    }
  }
  // Echoes of ships the Abyss has taken.
  if ((ship.talentReady.echo ?? 0) <= now) {
    ship.talentReady.echo = now + 180;
    if (game.rng.chance(0.3)) spawnEcho(game, ship);
  }
}

/** Every tick: the reverse currents run back toward the Eye. */
export function stepAbyssSea(game: Game, dt: number): void {
  const eye = game.abyss.eye;
  game.forShipsNear(eye.x, eye.y, EYE_PULL_R, (o) => {
    if (o.docked || !o.alive || o.cls.monster || o.region !== 'the_abyss') return;
    const dx = eye.x - o.state.x, dy = eye.y - o.state.y, d = Math.hypot(dx, dy) || 1;
    const v = (1 + 2 * (1 - d / EYE_PULL_R)) * dt; // 1–3 m/s (2–6 knots)
    o.state.x += (dx / d) * v;
    o.state.y += (dy / d) * v;
  });
}

/** The Abyss's own winds: nothing at all in the dead-wind zones; a black storm's wind leaps 45–120°. */
export function abyssWind(game: Game, ship: ShipEntity, base: WindSample): WindSample | null {
  if (ship.region !== 'the_abyss') return null;
  if (game.abyss.deadWinds.some((z) => dist(z.x, z.y, ship.state.x, ship.state.y) < z.r)) return { dir: base.dir, strength: 0.02 };
  if (game.weatherOf(ship) === 'black_storm') {
    const k = Math.floor(game.now / 20);
    const u = ((k * 2654435761) >>> 0) / 4294967296;
    const leap = (45 + u * 75) * (Math.PI / 180) * (k % 2 ? 1 : -1);
    return { dir: base.dir + leap * ((k % 3) + 1), strength: Math.max(base.strength, 1.2) };
  }
  return null;
}

/** The stars lie: the compass and the Star Fix drift up to 30° in the Abyss. */
export function compassSkew(game: Game, ship: ShipEntity): number {
  if (ship.region !== 'the_abyss') return 0;
  return Math.sin(game.now / 97 + ship.id) * (30 * Math.PI) / 180;
}

/** Visions: at 60 pressure the lookouts see sails that are not there. */
export function phantoms(game: Game, ship: ShipEntity): [number, number][] {
  if (ship.pressure < 60) return [];
  const k = Math.floor(game.now / 20);
  const out: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const u = (((k + i * 7919 + ship.id) * 2654435761) >>> 0) / 4294967296;
    const w = (((k * 31 + i * 104729 + ship.id) * 2246822519) >>> 0) / 4294967296;
    const a = u * Math.PI * 2, r = 700 + w * 1500;
    out.push([Math.round(ship.state.x + Math.sin(a) * r), Math.round(ship.state.y - Math.cos(a) * r)]);
  }
  return out;
}

// ================================================================== Echoes

interface EchoRec {
  name: string;
  classId: ShipClassId;
}

/** A ship went down in the Abyss: it will sail again, as an Echo. */
export function recordEcho(game: Game, ship: ShipEntity): void {
  if (ship.region !== 'the_abyss' || ship.cls.monster || ship.name.startsWith('Echo of')) return;
  const list = game.db.getKv<EchoRec[]>('abyss_echoes') ?? [];
  list.push({ name: ship.name, classId: ship.loadout.classId });
  game.db.setKv('abyss_echoes', list.slice(-60));
}

export function spawnEcho(game: Game, near: ShipEntity): ShipEntity | null {
  let alive = 0;
  for (const s of game.ships.values()) if (s.alive && s.name.startsWith('Echo of')) alive++;
  if (alive >= ECHO_CAP) return null;
  const list = game.db.getKv<EchoRec[]>('abyss_echoes') ?? [];
  const rec = list.length ? game.rng.pick(list) : { name: game.rng.pick(['the Morning Oath', 'the Iron Psalm', 'the Wren', 'the Last Lantern']), classId: 'brig' as ShipClassId };
  const cls: ShipClassId = SHIP_CLASSES[rec.classId]?.purchasable || rec.classId === 'ghost_ship' ? rec.classId : 'brig';
  const a = game.rng.range(0, Math.PI * 2);
  const x = near.state.x + Math.sin(a) * 1400, y = near.state.y - Math.cos(a) * 1400;
  if (isLand(game.world, x, y)) return null;
  const e = game.spawnNpcShip('ghost', cls, 'choir', x, y, a + Math.PI, { ship: `Echo of ${rec.name.replace(/^the /, 'the ')}`, captain: 'what is left of her captain' });
  e.crew = e.stats.crewMax;
  e.morale = 100;
  e.level = 45;
  e.removeAt = game.now + 900;
  e.purse = 600;
  e.cargo = { abyssal_ore: game.rng.int(1, 3), cursed_relics: game.rng.int(1, 3) };
  const brain = game.npcs.get(e.id);
  if (brain) {
    brain.active = true;
    brain.target = near.id;
  }
  game.grid.upsert(e.id, x, y);
  const s = game.sessionOf(near);
  if (s) {
    game.sendTo(s, { t: 'toast', msg: `A sail out of the dark: the ${e.name}. She went down here once.`, kind: 'bad' });
    chapter(game, s, 'echo');
  }
  return e;
}

/** An Echo sunk: now and then a ritual shard among the wreckage. */
export function onAbyssKill(game: Game, s: PlayerSession, victim: ShipEntity): void {
  if (!victim.name.startsWith('Echo of')) return;
  if (game.rng.chance(0.05)) giveShard(game, s, `In the ${victim.name}'s wreck`);
}

// ================================================================== the ritual, the chapters

export function giveShard(game: Game, s: PlayerSession, source: string): void {
  const p = s.profile!;
  p.ritualShards = (p.ritualShards ?? 0) + 1;
  game.sendTo(s, { t: 'toast', msg: `${source}: a ritual shard (${p.ritualShards}/3). Three, and thirty cursed relics, raise a ghost ship at the Eye.`, kind: 'gold' });
}

/** The Raising Ritual: at the rim of the Eye, three shards and thirty cursed relics bring up a ghost ship. */
export function raisingRitual(game: Game, s: PlayerSession): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const eye = game.abyss.eye;
  if (ship.docked || dist(ship.state.x, ship.state.y, eye.x, eye.y) > 1500) return 'The ritual is spoken at the rim of the Eye of the Abyss';
  if ((p.ritualShards ?? 0) < 3) return `Three ritual shards are needed (you have ${p.ritualShards ?? 0})`;
  if ((ship.cargo.cursed_relics ?? 0) < 30) return 'Thirty cursed relics must go into the Eye';
  if (p.berths.length >= 4) return 'You have no berth free for her';
  p.ritualShards -= 3;
  ship.cargo.cursed_relics = (ship.cargo.cursed_relics ?? 0) - 30;
  if (!ship.cargo.cursed_relics) delete ship.cargo.cursed_relics;
  p.berths.push({ port: 'saint_maw', loadout: { classId: 'ghost_ship', name: `${s.name.split(' ')[0]}'s Return`, guns: { port: 'medium_12', starboard: 'medium_12' }, modules: {} }, hull: 1 });
  ship.sanity = Math.max(0, ship.sanity - 30);
  game.emit({ k: 'fx', fx: 'rise', x: Math.round(eye.x), y: Math.round(eye.y), r: 200 }, eye.x, eye.y);
  game.grantXp(s, 5000, 'The Raising Ritual');
  game.sendTo(s, { t: 'toast', msg: 'The Eye gives something back. A ghost ship rises, dripping, and sails for Saint Maw — she waits in your berth there.', kind: 'gold' });
  game.addRumor(eye.x, eye.y, `${s.name} spoke the Raising Ritual at the Eye. A ghost ship answered.`);
  return null;
}

export function chapter(game: Game, s: PlayerSession, id: string): void {
  const p = s.profile!;
  if (p.chapters.includes(id)) return;
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return;
  p.chapters.push(id);
  game.sendTo(s, { t: 'toast', msg: `${c.title} — ${c.text}`, kind: 'info' });
}

// ================================================================== the view

export function abyssView(game: Game, s: PlayerSession): AbyssView | null {
  const ship = s.ship;
  const p = s.profile!;
  const inside = ship?.region === 'the_abyss';
  if (!ship || (!inside && ship.pressure <= 0 && !p.chapters.length && !(p.ritualShards ?? 0))) return null;
  const map = game.abyss;
  return {
    inside, pressure: Math.round(ship.pressure), skew: Math.round(compassSkew(game, ship) * 100) / 100, phantoms: inside ? phantoms(game, ship) : [],
    lights: map.lights, deadWinds: map.deadWinds, eye: map.eye, shards: p.ritualShards ?? 0,
    chapters: CHAPTERS.filter((c) => p.chapters.includes(c.id)).map((c) => ({ title: c.title, text: c.text })), cleared: abyssCleared(game, s),
  };
}
