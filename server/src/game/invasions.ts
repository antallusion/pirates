// docs/19 E16 on the server: the Choir's invasions (shared/src/data/invasions.ts). One invasion at a time for the
// server: the calendar (INV_EVERY after the last one's end, by the wall clock), the news INV_WARN ahead, the waves of
// the Choir's ships off a port of the region (the sea's own NPC ships of the faction: their army is the Choir's roster,
// npcArmy → rosterArmy('choir')), each wave when the last has fallen, the common cause's bar and every hand's part,
// the pay when the last wave falls in time — and when the time runs out first, the black tide on the region for a
// day: the Choir's patrols in its waters (kept at TIDE_PATROLS), its ports' prices (ports.ts priceMods reads tideOn),
// the chart darkened over it (the events' list, events.ts eventViews). The state is kept in kv `choir_invasion` (a
// restart raises the current wave again); the ships, the parts and the patrols are runtime. Its dice are its own Rng.

import { INV_EVERY, INV_GAP, INV_OFFSHORE, INV_REGIONS, INV_TIME, INV_WARN, INV_WAVES, INV_WAVE_SHIPS, TIDE_PATROLS, TIDE_PRICE, TIDE_RESPAWN, TIDE_TIME, CHOIR_CAPTAINS, CHOIR_FLAGSHIP, CHOIR_SHIPS, invPay, invTotal } from '../../../shared/src/data/invasions.ts';
import type { InvasionView } from '../../../shared/src/data/invasions.ts';
import { INVASION_PART } from '../../../shared/src/data/artifacts.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { dist } from '../../../shared/src/math.ts';
import type { WorldEventView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { SECTORS_PER_SIDE, sectorAt, sectorGrid } from '../../../shared/src/world/sectors.ts';
import { depthAt, regionAt } from '../../../shared/src/world/worldgen.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { eventsChanged } from './events.ts';
import type { Game } from './Game.ts';
import { openSea, planWander } from './npc.ts';
import type { PlayerSession } from './player.ts';
import { relicPartDrop } from './relics.ts';
import { chronicle } from './renown.ts';
import type { ShipEntity } from './ship.ts';

/** What a ship of the Choir's invasion carries (ShipEntity.invader): the invasion and its wave, or the tide's region
 *  she patrols. */
export interface InvaderTag {
  inv: number;
  wave: number;
  tide?: RegionId;
  flag?: boolean;
}

interface Cur {
  id: number;
  region: RegionId;
  port: string;
  x: number;
  y: number;
  level: number;
  warnAt: number;
  startAt: number;
  endsAt: number;
  /** The wave afloat (0: not yet risen), and when the next rises (0: not waiting). */
  wave: number;
  waveAt: number;
  total: number;
  beaten: number;
  /** Each hand's part: the ships of the Choir she fired on or sank or took (by account). */
  hands: Record<string, number>;
  names: Record<string, string>;
}

interface Store {
  next: number;
  cur: Cur | null;
  tides: { region: RegionId; endsAt: number }[];
  /** Pay not yet collected by hands ashore when the invasion was beaten. */
  owed: Record<string, { hands: number; level: number; part?: boolean }>;
  seq: number;
  won: number;
  lost: number;
}

const KEY = 'choir_invasion';

export class InvasionHub {
  /** The calendar runs (tests of other systems keep it still: tests/helpers.ts). */
  on = true;
  store: Store | null = null;
  /** The current wave's ships, and who fired on each. */
  live = new Set<number>();
  touched = new Map<number, Set<number>>();
  /** The tide's patrols by region, and when the next puts out. */
  patrols = new Map<RegionId, number[]>();
  patrolAt = new Map<RegionId, number>();
  rng = new Rng(0xc401c5e1);
  lastKey = '';
  secs = 0;
}

function data(game: Game): Store {
  const hub = game.invasions;
  if (!hub.store) {
    const kept = game.db.getKv<Store>(KEY);
    hub.store = kept ?? { next: game.wallNow() + hub.rng.range(INV_EVERY[0], INV_EVERY[1]), cur: null, tides: [], owed: {}, seq: 1, won: 0, lost: 0 };
    hub.store.tides ??= [];
    hub.store.owed ??= {};
  }
  return hub.store;
}
const save = (game: Game) => game.db.setKv(KEY, data(game));

const news = (game: Game, msg: string, kind: 'info' | 'bad' | 'gold' = 'info') => {
  for (const s of game.sessions) game.sendTo(s, { t: 'toast', msg: `WORLD: ${msg}`, kind });
};

/** A region under the black tide now (the ports' prices read it). */
export function tideOn(game: Game, region: RegionId): boolean {
  const wall = game.wallNow();
  return data(game).tides.some((t) => t.region === region && t.endsAt > wall);
}

/** The prices of a port under the black tide (ports.ts priceMods): dearer to buy, poorer to sell. */
export function tidePrice(game: Game, region: RegionId): { buy: number; sell: number } | null {
  return tideOn(game, region) ? TIDE_PRICE : null;
}

// ------------------------------------------------------------------ where the Choir comes

/** The ports of a region in this server's zone. */
function portsOf(game: Game, region: RegionId): Port[] {
  return game.zonePorts().filter((p) => !p.raft && regionAt(game.world, p.x, p.y) === region);
}

/** Open deep water off a port, INV_OFFSHORE out, on the dice. */
function offPort(game: Game, port: Port): { x: number; y: number } | null {
  const rng = game.invasions.rng;
  for (let i = 0; i < 48; i++) {
    const a = rng.range(0, Math.PI * 2), r = INV_OFFSHORE * (0.8 + 0.4 * rng.float());
    const x = port.x + Math.sin(a) * r, y = port.y - Math.cos(a) * r;
    if (openSea(game, x, y) && depthAt(game.world, x, y) >= 12 && game.inZone(x, y)) return { x, y };
  }
  return null;
}

/** The regions it may come to now: this zone's, spared the starting waters and those under the tide. */
function regionsOpen(game: Game): RegionId[] {
  const wall = game.wallNow();
  return INV_REGIONS.filter((r) => (!game.zone || game.zone.regions.has(r)) && !data(game).tides.some((t) => t.region === r && t.endsAt > wall) && portsOf(game, r).length > 0);
}

/** An invasion told of: a region, a port of it, the water off the port; its first wave after the news. */
export function announce(game: Game, region?: RegionId, at?: { x: number; y: number }, warn = INV_WARN): Cur | null {
  const S = data(game);
  const rng = game.invasions.rng;
  const open = regionsOpen(game);
  const reg = region && (INV_REGIONS.includes(region) || at) ? region : open.length ? open[rng.int(0, open.length - 1)] : null;
  if (!reg) return null;
  const ports = portsOf(game, reg);
  const port = at ? game.nearestPort(at.x, at.y) : ports.length ? ports[rng.int(0, ports.length - 1)] : null;
  if (!port) return null;
  const spot = at ?? offPort(game, port);
  if (!spot) return null;
  const wall = game.wallNow();
  const level = Math.max(1, Math.min(10, sectorAt(game.world, spot.x, spot.y).level));
  S.cur = {
    id: S.seq++, region: reg, port: port.id, x: Math.round(spot.x), y: Math.round(spot.y), level, warnAt: wall, startAt: wall + warn, endsAt: wall + warn + INV_TIME,
    wave: 0, waveAt: 0, total: invTotal(), beaten: 0, hands: {}, names: {},
  };
  game.invasions.live.clear();
  game.invasions.touched.clear();
  const mins = Math.max(1, Math.round(warn / 60_000));
  if (warn > 0) news(game, `The Choir gathers off ${port.name} in ${REGIONS[reg].name}: its fleet comes in ${mins} min.`, 'bad');
  game.addRumor(spot.x, spot.y, `The Choir gathers off ${port.name}.`);
  game.log(`[invasion] ${reg} off ${port.id} (⚓${level}), in ${mins} min`);
  save(game);
  eventsChanged(game);
  return S.cur;
}

// ------------------------------------------------------------------ the waves

/** A ship of the Choir put out at a spot (open sea near it): her hull of the level, her army the Choir's. */
function choirShip(game: Game, x: number, y: number, level: number, tag: InvaderTag, names: { ship: string; captain: string }): ShipEntity | null {
  const rng = game.invasions.rng;
  let px = x, py = y, ok = false;
  for (let i = 0; i < 30 && !ok; i++) {
    const a = rng.range(0, Math.PI * 2), r = i === 0 ? 0 : rng.range(250, 900);
    px = x + Math.sin(a) * r;
    py = y - Math.cos(a) * r;
    ok = openSea(game, px, py) && game.inZone(px, py);
  }
  if (!ok) return null;
  const hulls = hullsFor('pirate', level);
  const cls = hulls[rng.int(0, hulls.length - 1)];
  const ship = game.spawnNpcShip('pirate', cls, 'choir', px, py, rng.range(0, Math.PI * 2), names);
  ship.crew = Math.round(ship.stats.crewMax * 0.9);
  game.setNpcLevel(ship, level);
  ship.morale = 90;
  ship.invader = tag;
  game.grid.upsert(ship.id, px, py);
  const brain = game.npcs.get(ship.id);
  if (brain) {
    brain.area = { x, y, r: tag.tide ? 7000 : 2600 };
    brain.destPort = null;
    planWander(game, ship, brain);
  }
  return ship;
}

function spawnWave(game: Game, k: number): void {
  const S = data(game);
  const c = S.cur!;
  const hub = game.invasions;
  const n = INV_WAVE_SHIPS[k - 1] ?? INV_WAVE_SHIPS[INV_WAVE_SHIPS.length - 1];
  c.wave = k;
  c.waveAt = 0;
  for (let i = 0; i < n; i++) {
    const flag = k === INV_WAVES && i === 0;
    const names = flag ? CHOIR_FLAGSHIP : { ship: CHOIR_SHIPS[hub.rng.int(0, CHOIR_SHIPS.length - 1)], captain: CHOIR_CAPTAINS[hub.rng.int(0, CHOIR_CAPTAINS.length - 1)] };
    const ship = choirShip(game, c.x, c.y, flag ? Math.min(10, c.level + 1) : c.level, { inv: c.id, wave: k, flag }, names);
    if (ship) hub.live.add(ship.id);
    else c.beaten++; // no water for her: counted as fallen, the bar still fills
  }
  const port = game.portById(c.port)?.name ?? REGIONS[c.region].name;
  if (k === 1) news(game, `The Choir invades ${REGIONS[c.region].name}! Its first wave off ${port}: ${n} ships. Captains, defend it!`, 'bad');
  else news(game, `The Choir's wave ${k} of ${INV_WAVES} rises off ${port}: ${n} ships${k === INV_WAVES ? ', the Black Choir at their head' : ''}.`, 'bad');
  game.emit({ k: 'fx', fx: 'boss_roar', x: c.x, y: c.y, r: 400 }, c.x, c.y);
  game.log(`[invasion] wave ${k}: ${hub.live.size} ships`);
  save(game);
  eventsChanged(game);
}

/** The account a ship that fired stands for (a captain's own, or her escort's captain's). */
function handOf(game: Game, id: number): PlayerSession | null {
  const o = game.ships.get(id);
  if (!o) return null;
  const own = o.ownerId !== null ? game.ships.get(o.ownerId) ?? null : o;
  const s = own ? game.sessionOf(own) : null;
  return s?.profile ? s : null;
}

function addHand(c: Cur, s: PlayerSession, n: number): void {
  const acc = String(s.accountId);
  c.hands[acc] = (c.hands[acc] ?? 0) + n;
  c.names[acc] = s.name;
}

/** A ship of the Choir sunk or taken by a captain (Game.creditKill): her part, one more for the blow. */
export function invasionKill(game: Game, s: PlayerSession, victim: ShipEntity): void {
  const c = data(game).cur;
  if (!c || !victim.invader || victim.invader.inv !== c.id) return;
  addHand(c, s, 1);
}

/** The current wave's ships: those fired on noted by hand, those gone (sunk, taken, struck and seized) counted. */
function scanWave(game: Game, c: Cur): boolean {
  const hub = game.invasions;
  let changed = false;
  for (const id of [...hub.live]) {
    const ship = game.ships.get(id);
    const set = hub.touched.get(id) ?? new Set<number>();
    hub.touched.set(id, set);
    if (ship && ship.alive && !ship.sinkingUntil && ship.ownerId === null && !ship.prize) {
      for (const [aid, t] of ship.attackers) if (t > game.now - 30) {
        const s = handOf(game, aid);
        if (s) set.add(s.accountId);
      }
      continue;
    }
    hub.live.delete(id);
    hub.touched.delete(id);
    c.beaten++;
    for (const acc of set) {
      const s = game.sessionByAccount(acc);
      if (s) addHand(c, s, 1);
      else c.hands[String(acc)] = (c.hands[String(acc)] ?? 0) + 1;
    }
    changed = true;
  }
  return changed;
}

/** The last wave fell in time: the region holds, every hand is paid, the calendar turns. */
export function invasionWon(game: Game): void {
  const S = data(game);
  const c = S.cur;
  if (!c) return;
  const reg = REGIONS[c.region].name;
  news(game, `${reg} holds: the Choir's fleet is broken. Every hand in its defence is paid.`, 'gold');
  chronicle(game, `The Choir's invasion of ${reg} is beaten off.`);
  const top = Object.entries(c.hands).sort((a, b) => b[1] - a[1]).slice(0, INVASION_PART.top).map(([acc]) => acc);
  for (const [acc, hands] of Object.entries(c.hands)) {
    const part = c.level >= INVASION_PART.level && top.includes(acc) && game.invasions.rng.chance(INVASION_PART.chance);
    S.owed[acc] = { hands: (S.owed[acc]?.hands ?? 0) + hands, level: c.level, part: part || S.owed[acc]?.part };
  }
  S.won++;
  closeCur(game);
  payOwed(game);
}

/** The time ran out: the region under the black tide for a day, the wave's ships gone into the dark water. */
export function invasionLost(game: Game): void {
  const S = data(game);
  const c = S.cur;
  if (!c) return;
  const reg = REGIONS[c.region].name;
  news(game, `The Choir holds ${reg}: the black tide lies on its waters for a day.`, 'bad');
  chronicle(game, `The Choir takes ${reg}; the black tide lies on it.`);
  S.tides = S.tides.filter((t) => t.region !== c.region);
  S.tides.push({ region: c.region, endsAt: game.wallNow() + TIDE_TIME });
  game.invasions.patrolAt.set(c.region, 0);
  S.lost++;
  closeCur(game);
}

function closeCur(game: Game): void {
  const S = data(game);
  const hub = game.invasions;
  for (const id of hub.live) if (game.ships.get(id)?.alive) game.removeShip(id);
  hub.live.clear();
  hub.touched.clear();
  S.cur = null;
  S.next = game.wallNow() + hub.rng.range(INV_EVERY[0], INV_EVERY[1]);
  save(game);
  eventsChanged(game);
}

/** The pay of a beaten invasion, to the hands aboard now (the rest when they come aboard). */
function payOwed(game: Game): void {
  const S = data(game);
  let any = false;
  for (const [acc, o] of Object.entries(S.owed)) {
    const s = game.sessionByAccount(Number(acc));
    if (!s?.profile || !s.ship) continue;
    const r = invPay(s.profile.level, o.level, o.hands);
    s.profile.gold += r.silver;
    game.db.ledger(s.accountId, 'invasion', r.silver, `hands ${o.hands}`);
    if (r.xp > 0) game.grantXp(s, r.xp, null);
    game.sendTo(s, { t: 'toast', msg: `Your part in the defence against the Choir: ${o.hands} ships, ${r.silver} silver.`, kind: 'gold' });
    if (o.part) relicPartDrop(game, s, 'invasion', 1);
    delete S.owed[acc];
    any = true;
  }
  if (any) save(game);
}

// ------------------------------------------------------------------ the black tide

function tideSecond(game: Game): boolean {
  const S = data(game);
  const hub = game.invasions;
  const wall = game.wallNow();
  let changed = false;
  for (const t of [...S.tides]) {
    const ids = (hub.patrols.get(t.region) ?? []).filter((id) => game.ships.get(id)?.alive);
    if (t.endsAt <= wall) {
      for (const id of ids) game.removeShip(id);
      hub.patrols.delete(t.region);
      S.tides = S.tides.filter((x) => x !== t);
      news(game, `The black tide ebbs from ${REGIONS[t.region].name}.`, 'info');
      changed = true;
      continue;
    }
    hub.patrols.set(t.region, ids);
    if (ids.length >= TIDE_PATROLS || wall < (hub.patrolAt.get(t.region) ?? 0)) continue;
    // One more of the tide's patrols, in open water of the region about its middle.
    const [cx, cy] = REGIONS[t.region].center;
    for (let i = 0; i < 12; i++) {
      const x = cx + hub.rng.range(-9000, 9000), y = cy + hub.rng.range(-9000, 9000);
      if (regionAt(game.world, x, y) !== t.region || !openSea(game, x, y) || game.world.ports.some((p) => dist(p.x, p.y, x, y) < 1500)) continue;
      const lv = Math.max(1, Math.min(10, sectorAt(game.world, x, y).level));
      const ship = choirShip(game, x, y, lv, { inv: -1, wave: 0, tide: t.region }, { ship: CHOIR_SHIPS[hub.rng.int(0, CHOIR_SHIPS.length - 1)], captain: CHOIR_CAPTAINS[hub.rng.int(0, CHOIR_CAPTAINS.length - 1)] });
      if (ship) ids.push(ship.id);
      break;
    }
    hub.patrolAt.set(t.region, ids.length >= TIDE_PATROLS ? wall + TIDE_RESPAWN : wall + 2000);
  }
  if (changed) save(game);
  return changed;
}

// ------------------------------------------------------------------ the step (every second)

export function stepInvasions(game: Game): void {
  const hub = game.invasions;
  const S = data(game);
  const wall = game.wallNow();
  hub.secs++;
  let changed = tideSecond(game);
  const c = S.cur;
  if (!c) {
    if (hub.on && wall >= S.next) announce(game);
  } else {
    if (c.wave === 0 && wall >= c.startAt) spawnWave(game, 1);
    else if (c.wave > 0) {
      // A restart: the wave afloat raised again.
      if (!hub.live.size && !c.waveAt && c.beaten < INV_WAVE_SHIPS.slice(0, c.wave).reduce((a, b) => a + b, 0)) {
        c.beaten = INV_WAVE_SHIPS.slice(0, c.wave - 1).reduce((a, b) => a + b, 0);
        spawnWave(game, c.wave);
      }
      if (scanWave(game, c)) changed = true;
      if (!hub.live.size && !c.waveAt) {
        if (c.wave >= INV_WAVES) return void invasionWon(game);
        c.waveAt = wall + INV_GAP;
        news(game, `Wave ${c.wave} of the Choir is broken off ${game.portById(c.port)?.name ?? REGIONS[c.region].name}: the next comes in a minute.`, 'gold');
        changed = true;
      }
      if (c.waveAt && wall >= c.waveAt) spawnWave(game, c.wave + 1);
    }
    if (S.cur && wall >= S.cur.endsAt) return void invasionLost(game);
  }
  if (hub.secs % 5 === 0 && Object.keys(S.owed).length) payOwed(game);
  if (changed) {
    save(game);
    eventsChanged(game);
  } else if (hub.secs % 15 === 0 && S.cur) eventsChanged(game); // the bar and the minutes on the chart
}

// ------------------------------------------------------------------ what the sea sees

/** The invasion for a captain's journal, chart and tavern. */
export function invasionView(game: Game, s: PlayerSession): InvasionView {
  const S = data(game);
  const wall = game.wallNow();
  const c = S.cur;
  const tides = S.tides.filter((t) => t.endsAt > wall).map((t) => ({ region: t.region, endsIn: Math.round((t.endsAt - wall) / 1000) }));
  if (!c) return { tides };
  const warn = c.wave === 0;
  return {
    tides,
    cur: {
      stage: warn ? 'warn' : 'on', region: c.region, x: c.x, y: c.y, level: c.level, wave: c.wave, waves: INV_WAVES, afloat: game.invasions.live.size, beaten: c.beaten, total: c.total,
      mine: c.hands[String(s.accountId)] ?? 0, endsIn: Math.max(0, Math.round(((warn ? c.startAt : c.endsAt) - wall) / 1000)),
      leaders: Object.entries(c.hands).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([acc, n]) => ({ name: c.names[acc] ?? '?', n })),
    },
  };
}

/** The invasion and the black tides on the chart (events.ts eventViews): a mark where the Choir comes; each tide's
 *  region by its squares, to darken. */
export function invasionEvents(game: Game): WorldEventView[] {
  const S = data(game);
  const wall = game.wallNow();
  const out: WorldEventView[] = [];
  const c = S.cur;
  if (c) out.push({ id: -3000, kind: 'invasion', title: 'Invasion of the Choir', region: c.region, x: c.x, y: c.y, endsIn: Math.max(0, Math.round(((c.wave ? c.endsAt : c.startAt) - wall) / 1000)), stage: `${c.wave}/${INV_WAVES}`, by: `${game.invasions.live.size}` });
  for (const t of S.tides) {
    if (t.endsAt <= wall) continue;
    const [x, y] = REGIONS[t.region].center;
    const grid = sectorGrid(game.world);
    out.push({ id: -3001 - REGION_IDS.indexOf(t.region), kind: 'black_tide', title: 'Black tide', region: t.region, x, y, endsIn: Math.round((t.endsAt - wall) / 1000), sectors: grid.map((sec, i) => (sec.region === t.region ? i : -1)).filter((i) => i >= 0 && i < SECTORS_PER_SIDE * SECTORS_PER_SIDE) });
  }
  return out;
}

// ------------------------------------------------------------------ the tester's console

/** `/invasion [region|start|wave|win|fail|clear]`: the calendar at a glance; an invasion told of in a region; one
 *  come at once off her bow; its wave sunk by her guns; the whole beaten or lost at once; everything cleared. */
export function adminInvasion(game: Game, s: PlayerSession, args: string[]): string {
  const S = data(game);
  const ship = s.ship!;
  const a = args[0];
  const wall = game.wallNow();
  if (!a) {
    const c = S.cur;
    const tides = S.tides.filter((t) => t.endsAt > wall).length;
    if (!c) return `No invasion now; the next in ${Math.max(0, Math.round((S.next - wall) / 60_000))} min. Black tides: ${tides}. Beaten ${S.won}, lost ${S.lost}.`;
    return `Invasion of ${REGIONS[c.region].name} (⚓${c.level}): wave ${c.wave} of ${INV_WAVES}, ${game.invasions.live.size} afloat, ${c.beaten} of ${c.total} fallen. Black tides: ${tides}.`;
  }
  if ((REGION_IDS as string[]).includes(a)) {
    if (S.cur) closeCur(game);
    const c = announce(game, a as RegionId);
    return c ? `The Choir gathers off ${game.portById(c.port)?.name ?? '?'} in ${REGIONS[c.region].name}.` : `No water for the Choir in ${REGIONS[a as RegionId].name}.`;
  }
  switch (a) {
    case 'start': {
      if (!S.cur || S.cur.wave > 0) {
        if (S.cur) closeCur(game);
        // Off her bow, 1.5 km ahead, in her own waters.
        const h = ship.state.heading;
        const at = { x: ship.state.x + Math.sin(h) * 1500, y: ship.state.y - Math.cos(h) * 1500 };
        if (!announce(game, ship.region, at, 0)) return 'No water for the Choir here.';
      }
      S.cur!.startAt = wall;
      S.cur!.endsAt = wall + INV_TIME;
      spawnWave(game, 1);
      return `The Choir's first wave: ${game.invasions.live.size} ships.`;
    }
    case 'wave': {
      const c = S.cur;
      if (!c || !c.wave) return 'No wave afloat.';
      for (const id of game.invasions.live) {
        const o = game.ships.get(id);
        if (o) o.attackers.set(ship.id, game.now);
      }
      scanWave(game, c);
      for (const id of [...game.invasions.live]) game.removeShip(id);
      scanWave(game, c);
      return `Wave ${c.wave} sunk.`;
    }
    case 'win':
      if (!S.cur) return 'No invasion now.';
      addHand(S.cur, s, 3);
      invasionWon(game);
      return 'The invasion is beaten off.';
    case 'fail':
      if (!S.cur) {
        if (!announce(game, INV_REGIONS.includes(ship.region) ? ship.region : 'gravewater', undefined, 0)) return 'No water for the Choir here.';
      }
      invasionLost(game);
      return 'The black tide lies on the region.';
    case 'clear':
      if (S.cur) closeCur(game);
      for (const [, ids] of game.invasions.patrols) for (const id of ids) if (game.ships.get(id)) game.removeShip(id);
      game.invasions.patrols.clear();
      S.tides = [];
      S.owed = {};
      S.next = wall + game.invasions.rng.range(INV_EVERY[0], INV_EVERY[1]);
      save(game);
      eventsChanged(game);
      return 'No invasion, no black tide.';
    default:
      return 'Usage: /invasion [region|start|wave|win|fail|clear]';
  }
}

/** Hostility of the Choir's invaders (npc.ts npcHostileTo): every captain at sea who has not struck, the sea's
 *  merchants, fishers, patrols and hunters; the law's patrols and the hunters go for them in turn. */
export function invaderHostile(npc: ShipEntity, other: ShipEntity): boolean | null {
  if (npc.invader) {
    if (other.invader) return false;
    if (other.isPlayer) return !other.surrendered;
    return other.npcRole === 'merchant' || other.npcRole === 'fisher' || other.npcRole === 'patrol' || other.npcRole === 'hunter';
  }
  if (other.invader && (npc.npcRole === 'patrol' || npc.npcRole === 'hunter') && npc.ownerId === null) return true;
  return null;
}
