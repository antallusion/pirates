// A captain's weeks with her own island (docs/15 item 8): a deterministic simulation of the base on its data alone.
// She plays a session at sea every evening and looks in on the island in the morning; the producers work round the
// clock into the yard up to its caps; the builders' crews take the next work whenever she looks in (every quarter of
// an hour while she plays, the base answering from anywhere); half of what she earns at sea goes to the island. What
// the island cannot make (planks, salt, rum, weapons…) she buys in port at a tenth over the base price. The island's
// level asks its power, its treasury's silver and its goods; buildings keep their daily upkeep, the waters their tax.
//
// `npm run balance` prints nothing of this; `node tools/balance-island.ts` prints the whole report.

import { BASE_RES, PRODUCERS, PRODUCER_KINDS, TOKEN_SECS, baseCost, crewsAt, maxLevel, plotsOf, producerFits, producerLimit, producerRate, speedupSilver, yardCap } from '../../shared/src/data/base.ts';
import type { BaseRes, ProducerKind } from '../../shared/src/data/base.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../../shared/src/data/estate.ts';
import { BUILDINGS } from '../../shared/src/data/holdings.ts';
import type { BuildingId, IslandSize } from '../../shared/src/data/holdings.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { ISLE_POWER, OWN_SHIPS_MAX, POWER_CREW, SHIP_POWER, XP_FIGHT, XP_FIGHT_LEVEL, XP_SEA_EVERY, nextOwnLevel, ownBuildCost, ownUpgradeCost, ownXpNext, yardLevelFor } from '../../shared/src/data/baseships.ts';
import type { OwnRole } from '../../shared/src/data/baseships.ts';
import { AWAY_MUL, ISLE_RAID_MIN, LOSS_DAY_CAP, RAID_COOLDOWN_H, RAID_LOSS, WATERS, isleDefence, isleTax, raidOdds, raidPrize, raidStrength } from '../../shared/src/data/baseclaim.ts';
import type { Waters } from '../../shared/src/data/baseclaim.ts';
import type { IslandBiome } from '../../shared/src/world/regions.ts';

// ------------------------------------------------------------------------------------------------ the sea's hour

/** What an hour at sea earns a captain whose ship is of a level (the reference the island is held against): the
 *  floor of a hunter's hour at ⚓1 — six kills on the ports' hunt contracts at 320 silver, no loot, no bounty, no
 *  trade — growing with the ladder's 1.3 a level (docs/12 §3; the GDD's sugar run of ~8 000 an hour lies at ⚓6–7). */
export function seaHour(shipLevel: number): number {
  return Math.round(6 * 320 * 1.3 ** (Math.max(1, Math.min(10, shipLevel)) - 1));
}

/** Kills an hour at sea (the seasoning of her own ships that sail with her). */
export const KILLS_HOUR = 6;

// ------------------------------------------------------------------------------------------------ the plan of play

export interface Plan {
  biome: IslandBiome;
  size: IslandSize;
  waters: Waters;
  /** Hours at sea each evening. */
  hours: number;
  /** The share of her sea income that goes to the island. */
  share: number;
  /** Her ship's level on the first day, and the days to each level more. */
  shipLevel: number;
  shipEvery: number;
  /** Free tokens a day (the daily welcome and the daily orders). */
  tokens: number;
  /** Finish the builders' work with silver whenever the island's purse allows. */
  rush: boolean;
  days: number;
}

export const NORMAL: Plan = { biome: 'temperate', size: 'small', waters: 'safe', hours: 3, share: 0.5, shipLevel: 4, shipEvery: 5, tokens: 5, rush: false, days: 90 };

interface Thing { what: string; level: number }
interface Ship { role: OwnRole; level: number; xp: number; ready: boolean }
interface Job { end: number; ship?: Ship; what?: string; fresh?: boolean; apply: () => void }

export interface SimResult {
  /** The hour (from the start) each island level was reached (index: the level; NaN: not within the days). */
  at: number[];
  /** Silver spent: builds, speed-ups, treasury, goods bought, upkeep, tax. */
  spent: { build: number; speedup: number; treasury: number; goods: number; upkeep: number; tax: number };
  earned: number;
  /** The island's own production, valued at base prices, by the hour a day into each level (or as it is left). */
  yieldAt: number[];
  /** The week's tax at each level. */
  taxAt: number[];
  power: number;
  things: Thing[];
  ships: Ship[];
}

const worthOf = (goods: Partial<Record<GoodId, number>>) => Object.entries(goods).reduce((a, [g, n]) => a + GOODS[g as GoodId].basePrice * (n ?? 0), 0);
const BUY = 1.1;

/** Buildings the captain raises on the plots, in her order of want (the rest are for the play of it, not the base). */
const WANT: BuildingId[] = ['warehouse', 'shipyard', 'fishing_village', 'farm', 'pier', 'tavern', 'battery', 'fort'];

export function simulate(plan: Plan = NORMAL): SimResult {
  const res: Record<BaseRes, number> = { timber: 0, coal: 0, tar: 0, iron: 0, provisions: 0 };
  const things: Thing[] = [];
  const ships: Ship[] = [];
  const jobs: Job[] = [];
  let level = 1;
  let purse = 0; // the island's share of her silver, not yet spent
  let treasury = 0;
  let tokens = 0;
  const spent = { build: 0, speedup: 0, treasury: 0, goods: 0, upkeep: 0, tax: 0 };
  let earned = 0;
  const at: number[] = new Array(ISLE_MAX + 1).fill(NaN);
  const yieldAt: number[] = new Array(ISLE_MAX + 1).fill(0);
  const taxAt: number[] = new Array(ISLE_MAX + 1).fill(0);
  at[1] = 0;

  const has = (id: string) => things.some((t) => t.what === id) || jobs.some((j) => !j.ship && j.what === id);
  const lvlOf = (id: string) => things.find((t) => t.what === id)?.level ?? 0;
  const power = () => things.reduce((a, t) => a + t.level, 0) + SHIP_POWER * ships.filter((s) => s.ready).reduce((a, s) => a + s.level, 0);
  const crews = () => crewsAt(level, power() >= POWER_CREW ? 1 : 0);
  const busy = () => jobs.filter((j) => !j.ship).length;
  const cap = () => yardCap(level, lvlOf('warehouse'));
  const slots = () => ISLE_LEVELS[level].slots + (plan.size === 'large' ? 2 : plan.size === 'medium' ? 1 : 0);
  const slotsUsed = () => things.filter((t) => !t.what.startsWith('p:')).reduce((a, t) => a + BUILDINGS[t.what as BuildingId].slots, 0)
    + pending().filter((w) => !w.startsWith('p:')).reduce((a, w) => a + BUILDINGS[w as BuildingId].slots, 0);
  const pending = () => jobs.filter((j) => !j.ship && j.fresh).map((j) => j.what!);
  const plotsUsed = () => things.length + pending().length;
  const rate = (g: BaseRes) => things.filter((t) => t.what.startsWith('p:') && PRODUCERS[t.what.slice(2) as ProducerKind].good === g)
    .reduce((a, t) => a + producerRate(t.what.slice(2) as ProducerKind, t.level, plan.biome), 0);
  const yieldValue = () => BASE_RES.reduce((a, g) => a + rate(g) * GOODS[g].basePrice, 0);

  /** Pay a cost: the yard's goods from the yard, the rest of the goods bought in port; silver from the purse. */
  // What the yard has not, she brings in the hold (bought in port); the yard's own first.
  const own = (g: GoodId) => ((BASE_RES as string[]).includes(g) ? res[g as BaseRes] : 0);
  const bought = (c: { goods: Partial<Record<GoodId, number>> }) => (Object.entries(c.goods) as [GoodId, number][])
    .reduce((a, [g, n]) => a + Math.ceil(Math.max(0, n - own(g)) * GOODS[g].basePrice * BUY), 0);
  const afford = (c: { silver: number; goods: Partial<Record<GoodId, number>> }) => purse >= c.silver + bought(c);
  const pay = (c: { silver: number; goods: Partial<Record<GoodId, number>> }) => {
    const k = bought(c);
    purse -= c.silver + k;
    spent.build += c.silver;
    spent.goods += k;
    for (const [g, n] of Object.entries(c.goods) as [GoodId, number][]) if ((BASE_RES as string[]).includes(g)) res[g as BaseRes] = Math.max(0, res[g as BaseRes] - n);
  };

  const queue = (t: number, what: string, lv: number, secs: number, fresh: boolean) => {
    const j: Job = { end: t + secs / 3600, what, fresh, apply: () => {
      if (fresh) things.push({ what, level: 1 });
      else {
        const x = things.find((y) => y.what === what && y.level === lv - 1);
        if (x) x.level = lv;
      }
    } };
    jobs.push(j);
  };

  /** The level up, if everything is at hand (the goods from the yard, else bought; the treasury fed from the purse). */
  const tryLevel = (t: number): boolean => {
    if (level >= ISLE_MAX) return false;
    const need = ISLE_LEVELS[level + 1];
    if (power() < ISLE_POWER[level + 1]) return false;
    let bought = 0;
    for (const [g, n] of Object.entries(need.goods) as [GoodId, number][]) {
      const own = (BASE_RES as string[]).includes(g) ? Math.min(n, res[g as BaseRes]) : 0;
      bought += Math.ceil((n - own) * GOODS[g].basePrice * BUY);
    }
    const toTreasury = Math.max(0, need.silver - treasury);
    if (purse < bought + toTreasury) return false;
    for (const [g, n] of Object.entries(need.goods) as [GoodId, number][]) if ((BASE_RES as string[]).includes(g)) res[g as BaseRes] -= Math.min(n, res[g as BaseRes]);
    purse -= bought + toTreasury;
    spent.goods += bought;
    spent.treasury += toTreasury;
    treasury += toTreasury - need.silver;
    if (!yieldAt[level]) yieldAt[level] = yieldValue();
    level++;
    at[level] = t;
    taxAt[level] = isleTax(plan.waters, level);
    return true;
  };

  /** What the builders might take next, with the power it brings. */
  const options = (): { what: string; level: number; fresh: boolean; cost: ReturnType<typeof baseCost> }[] => {
    const out: { what: string; level: number; fresh: boolean; cost: ReturnType<typeof baseCost> }[] = [];
    const freePlot = plotsUsed() < plotsOf(level, plan.size);
    const working = new Set(jobs.filter((j) => !j.ship).map((j) => j.what!));
    for (const k of PRODUCER_KINDS) {
      const what = `p:${k}`;
      if (!producerFits(k, plan.biome)) continue;
      const n = things.filter((x) => x.what === what).length + pending().filter((w) => w === what).length;
      // Two plots kept for the warehouse and the shipyard until they stand.
      const keep = (has('warehouse') ? 0 : 1) + (has('shipyard') ? 0 : 1);
      if (plotsUsed() + keep < plotsOf(level, plan.size) && n < producerLimit(level)) out.push({ what, level: 1, fresh: true, cost: baseCost(what, 1) });
    }
    for (const x of things) {
      if (working.has(x.what)) continue; // one work at a time on a kind (simpler than by the plot, and near enough)
      if (x.level < maxLevel(x.what) && level >= x.level + 1) out.push({ what: x.what, level: x.level + 1, fresh: false, cost: baseCost(x.what, x.level + 1) });
    }
    for (const id of WANT) {
      const d = BUILDINGS[id];
      if (has(id) && id !== 'battery') continue;
      if (id === 'battery' && things.filter((x) => x.what === 'battery').length + pending().filter((w) => w === 'battery').length >= 1) continue;
      if ((id === 'battery' || id === 'fort') && plan.waters === 'safe') continue;
      if (d.biomes && !d.biomes.includes(plan.biome)) continue;
      if (d.needs && !has(d.needs)) continue;
      if (!freePlot || slotsUsed() + d.slots > slots()) continue;
      out.push({ what: id, level: 1, fresh: true, cost: baseCost(id, 1) });
    }
    return out;
  };

  const shipyard = () => lvlOf('shipyard');
  const slipBusy = () => jobs.some((j) => j.ship);

  const look = (t: number, atSea: boolean) => {
    // Work done since the last look.
    for (const j of jobs.filter((x) => x.end <= t + 1e-9)) {
      j.apply();
      jobs.splice(jobs.indexOf(j), 1);
    }
    while (tryLevel(t));
    // Tokens on the longest work, then silver if she rushes.
    const byLeft = () => jobs.filter((j) => j.end > t).sort((a, b) => b.end - a.end);
    for (const j of byLeft()) {
      while (tokens > 0 && j.end > t) {
        tokens--;
        j.end = Math.max(t, j.end - TOKEN_SECS / 3600);
      }
    }
    if (plan.rush) {
      // She rushes whatever the builders have in hand for up to a quarter of the island's purse.
      for (const j of byLeft()) {
        const price = speedupSilver((j.end - t) * 3600);
        if (purse * 0.25 >= price) {
          purse -= price;
          spent.speedup += price;
          j.end = t;
        }
      }
    }
    for (const j of jobs.filter((x) => x.end <= t + 1e-9)) {
      j.apply();
      jobs.splice(jobs.indexOf(j), 1);
    }
    while (tryLevel(t));
    // What the next level lacks: power first; with the power in hand she saves for the treasury and the goods.
    const need = level < ISLE_MAX ? ISLE_LEVELS[level + 1] : null;
    let reserve = need && power() >= ISLE_POWER[level + 1] ? need.silver - treasury + worthOf(need.goods) * BUY : 0;
    // From the fifth level she saves for the shipyard: her own ships are the island's great power later on.
    if (level >= 5 && !has('shipyard')) reserve = Math.max(reserve, baseCost('shipyard', 1).silver);
    // The shipyard's ships: built when the yard stands, raised when seasoned.
    if (shipyard() && !slipBusy()) {
      if (ships.length < OWN_SHIPS_MAX) {
        const role: OwnRole = ships.length === 0 ? 'war' : 'merchant';
        const c = ownBuildCost(role);
        if (afford(c) && purse - c.silver >= reserve * 0.5) {
          pay(c);
          const s: Ship = { role, level: 1, xp: 0, ready: false };
          ships.push(s);
          jobs.push({ end: t + c.secs / 3600, ship: s, apply: () => (s.ready = true) });
        }
      } else {
        for (const s of ships) {
          const next = nextOwnLevel(s.role, s.level);
          if (!s.ready || next === null || s.xp < ownXpNext(s.level) || shipyard() < yardLevelFor(next) || slipBusy()) continue;
          const c = ownUpgradeCost(s.role, next);
          if (!afford(c) || purse - c.silver < reserve * 0.5) continue;
          pay(c);
          s.ready = false;
          jobs.push({ end: t + c.secs / 3600, ship: s, apply: () => {
            s.level = next;
            s.xp = 0;
            s.ready = true;
          } });
        }
      }
    }
    // The builders.
    for (let guard = 0; guard < 6 && busy() < crews(); guard++) {
      const opts = options().filter((o) => afford(o.cost) && (purse - o.cost.silver >= reserve || (o.what === 'shipyard' && reserve <= baseCost('shipyard', 1).silver)));
      if (!opts.length) break;
      // The warehouse when the yard runs full; the shipyard as soon as it is to be had; else the cheapest power.
      const full = BASE_RES.some((g) => res[g] >= cap() * 0.9);
      const score = (o: (typeof opts)[number]) => {
        const price = o.cost.silver + worthOf(o.cost.goods) + bought(o.cost);
        let w = price;
        if (o.fresh && o.what.startsWith('p:') && !things.some((x) => x.what === o.what)) w *= 0.3; // a kind the yard has not yet
        if (o.what === 'warehouse' && full) w *= 0.2;
        if (o.what === 'shipyard') w *= 0.3;
        if (o.what.startsWith('p:') && o.fresh) w *= 0.5; // a new producer yields as well as counts
        return w;
      };
      opts.sort((a, b) => score(a) - score(b));
      const o = opts[0];
      pay(o.cost);
      queue(t, o.what, o.level, o.cost.secs, o.fresh);
    }
    void atSea;
  };

  const STEP = 0.25;
  let lastProd = 0;
  for (let t = 0; t < plan.days * 24; t = Math.round((t + STEP) * 100) / 100) {
    const day = Math.floor(t / 24), hour = t - day * 24;
    // Production into the yard, capped.
    const dt = t - lastProd;
    lastProd = t;
    for (const g of BASE_RES) res[g] = Math.min(cap(), res[g] + rate(g) * dt);
    if (hour === 0) {
      tokens = Math.min(20, tokens + plan.tokens);
      // Upkeep a day, the tax a week, both from the treasury, fed from the purse.
      const up = things.filter((x) => !x.what.startsWith('p:')).reduce((a, x) => a + BUILDINGS[x.what as BuildingId].upkeep + worthOf(BUILDINGS[x.what as BuildingId].upkeepGoods) * BUY, 0);
      const inc = (lvlOf('fishing_village') ? 300 : 0) + (lvlOf('tavern') ? 400 : 0);
      const net = Math.max(0, up - inc);
      purse -= net;
      spent.upkeep += net;
      if (day > 0 && day % 7 === 0) {
        const tax = isleTax(plan.waters, level);
        purse -= tax;
        spent.tax += tax;
      }
    }
    const session = hour >= 19 && hour < 19 + plan.hours;
    if (session) {
      const lvl = Math.min(10, plan.shipLevel + Math.floor(day / plan.shipEvery));
      const inc = seaHour(lvl) * STEP;
      earned += inc;
      purse += inc * plan.share;
      // Her own ships at sea with her: an hour's seasoning at sea and in the fights.
      for (const s of ships) if (s.ready) s.xp += STEP * (3600 / XP_SEA_EVERY + KILLS_HOUR * (XP_FIGHT + XP_FIGHT_LEVEL * lvl));
    }
    if (session || hour === 8) look(t, session);
    if (!yieldAt[level] && t >= at[level] + 24) yieldAt[level] = yieldValue();
  }
  if (!yieldAt[level]) yieldAt[level] = yieldValue();
  return { at, spent, earned, yieldAt, taxAt, power: power(), things, ships };
}

/** Days to a level (NaN: never within the run). */
export function daysTo(r: SimResult, level: number): number {
  return r.at[level] / 24;
}

// ------------------------------------------------------------------------------------------------ yields and income

/** The most a captain's producers can yield by the hour at an island level (every plot a producer at its greatest
 *  level the island allows), valued at base prices — the island's best, against the sea's hour. */
export function bestYield(level: number, biome: IslandBiome, size: IslandSize = 'large'): number {
  const plots = plotsOf(level, size);
  const top = Math.min(5, level);
  const kinds = PRODUCER_KINDS.filter((k) => producerFits(k, biome)).map((k) => ({ k, v: producerRate(k, top, biome) * GOODS[PRODUCERS[k].good].basePrice }))
    .sort((a, b) => b.v - a.v);
  let left = plots, v = 0;
  for (const { v: each } of kinds) {
    const n = Math.min(left, producerLimit(level));
    v += n * each;
    left -= n;
  }
  return v;
}

// ------------------------------------------------------------------------------------------------ raids

/** A seeded draw (mulberry32): the same days every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Guard { battery: number; fort: number; ship: number }
export const NO_GUARD: Guard = { battery: 0, fort: 0, ship: 0 };

/** The island's rating by its guns and her own ship lying at home (their levels; 0: none). */
export function guardRating(g: Guard): number {
  return isleDefence({
    batteries: g.battery ? [{ level: g.battery, condition: 1 }] : [],
    forts: g.fort ? [{ level: g.fort, condition: 1 }] : [],
    ships: g.ship ? [{ level: g.ship, hull: 1 }] : [],
  });
}

/** Days of raids on an island twice as fat as its mark whose owner never comes to fight them (the raid rolled by
 *  the hour as the server rolls it, the cooldown, the day's cap): the share of the yard and store lost each day, and
 *  the silver the island's own guns win in a day. `away`: the owner has been away more than half a day. */
export function raidDays(waters: 'contested' | 'lawless', level: number, guard: Guard, days = 2000, away = false, seed = 7): { mean: number; max: number; wins: number; raids: number; prize: number } {
  const r = rng(seed + level * 97 + guard.battery * 13 + guard.fort * 31 + guard.ship * 7);
  const def = guardRating(guard), str = raidStrength(waters, level), odds = raidOdds(def, str);
  let calm = 0, sum = 0, max = 0, wins = 0, raids = 0, prize = 0;
  for (let d = 0; d < days; d++) {
    let lost = 0; // the day's share, as the server keeps it
    let kept = 1; // what is left of the yard (the shares taken one after another)
    for (let h = 0; h < 24; h++) {
      const t = d * 24 + h;
      if (t < calm || lost >= LOSS_DAY_CAP) continue;
      const chance = (WATERS[waters].raidDay / 24) * 2 * (away ? AWAY_MUL : 1);
      if (r() >= Math.min(0.9, chance)) continue;
      raids++;
      calm = t + ISLE_RAID_MIN / 60 + RAID_COOLDOWN_H;
      if (r() < odds) {
        wins++;
        prize += raidPrize(waters, level).silver;
        continue;
      }
      const share = Math.max(0, Math.min(RAID_LOSS[0] + r() * (RAID_LOSS[1] - RAID_LOSS[0]), LOSS_DAY_CAP - lost));
      lost += share;
      kept *= 1 - share;
    }
    sum += 1 - kept;
    max = Math.max(max, 1 - kept);
  }
  return { mean: sum / days, max, wins, raids, prize: prize / days };
}
