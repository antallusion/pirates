// docs/18 V item 43 on the server: the land's resources (shell, bone, venom) put to work — the store's cap (the rest
// rots on the beach), the town's buildings that ask for them (town.ts reads townLand through townHooks), the island's
// workshop that makes four artifacts of them, the ship's fittings the captain buys a rank at a time, and the island's
// market that buys them at its poor rates. The creature dwellings' settling is beastlairs.ts's (it keeps the
// dwellings). docs/19 E13: the workshop's anvil — an artifact forged and reforged (shared/src/data/forge.ts), its new
// roll beside the old until she chooses; the anvil's dice are its own Rng.

import { ARTIFACTS } from '../../../shared/src/data/artifacts.ts';
import { FORGE_MARKET, forgeCost, forgeRoll, forgeable } from '../../../shared/src/data/forge.ts';
import type { ForgeWhat } from '../../../shared/src/data/forge.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { applyWorn } from './gear.ts';
import { LAND_RES, LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { CRAFTS, FITTINGS, FITTING_IDS, FITTING_MAX, LAND_RES_CAP, fittingCost, landSell, townLand } from '../../../shared/src/data/landecon.ts';
import type { FittingId, LandCost } from '../../../shared/src/data/landecon.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { LandTownView } from '../../../shared/src/h3proto.ts';
import { lacking, lyingOff, mine as ownBase, takeGoods } from './base.ts';
import type { Yard } from './base.ts';
import { lairsOf } from './beastlairs.ts';
import type { Game } from './Game.ts';
import { applyHero, artifactFind } from './hero.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession, Profile } from './player.ts';
import { townHooks, townLevel } from './town.ts';

/** What a cost of the land's resources reads as (the server's English). */
export function landWords(c: LandCost): string {
  return (Object.entries(c) as [LandRes, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${LAND_RES_DEF[r].name[0]}`).join(', ');
}

/** Her store of the land's resources. */
export const landStore = (p: Profile): Record<LandRes, number> => lairsOf(p).res;

/** The land's resources into her store, up to its cap: what went in, and what rotted on the beach. */
export function addLand(game: Game, s: PlayerSession, r: LandRes, n: number): { given: number; rot: number } {
  const st = landStore(s.profile!);
  const want = Math.max(0, Math.floor(n));
  const given = Math.max(0, Math.min(want, LAND_RES_CAP - st[r]));
  st[r] += given;
  const rot = want - given;
  if (rot > 0 && s.ship) game.toastShip(s.ship, `Your store holds no more than ${LAND_RES_CAP} ${LAND_RES_DEF[r].name[0]}: ${rot} rot on the beach.`, 'bad');
  return { given, rot };
}

/** Why her store does not hold a cost (null: it does). */
export function landLack(p: Profile, c: LandCost): string | null {
  const st = landStore(p);
  for (const [r, n] of Object.entries(c) as [LandRes, number][]) if ((st[r] ?? 0) < n) return `Needs ${n - (st[r] ?? 0)} more ${LAND_RES_DEF[r].name[0]} (from the lairs of the islands).`;
  return null;
}

export function takeLand(p: Profile, c: LandCost): void {
  const st = landStore(p);
  for (const [r, n] of Object.entries(c) as [LandRes, number][]) st[r] = Math.max(0, st[r] - n);
}

// ------------------------------------------------------------------------------------------------ the fittings

/** Her fittings (a rank each), kept with her gear. */
export function fitOf(p: Profile): Partial<Record<FittingId, number>> {
  const lp = lairsOf(p);
  lp.fit ??= {};
  for (const id of Object.keys(lp.fit) as FittingId[]) if (!FITTING_IDS.includes(id)) delete lp.fit[id];
  return lp.fit;
}

function fitWhy(game: Game, s: PlayerSession, h: Holding, id: FittingId): string | null {
  const r = fitOf(s.profile!)[id] ?? 0;
  if (r >= FITTING_MAX) return 'It is at its greatest';
  if (!lyingOff(game, s, h)) return 'Lie off your island: its carpenters fit her out.';
  const c = fittingCost(id, r + 1);
  if (s.profile!.gold < c.silver) return `Needs ${c.silver} silver`;
  return landLack(s.profile!, c.land);
}

/** A fitting's next rank, made by her island's carpenters. */
export function buyFitting(game: Game, s: PlayerSession, id: string): string | null {
  if (!(FITTING_IDS as string[]).includes(id)) return 'No such fitting';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const f = id as FittingId;
  const why = fitWhy(game, s, m.h, f);
  if (why) return why;
  const p = s.profile!;
  const fit = fitOf(p);
  const rank = (fit[f] ?? 0) + 1;
  const c = fittingCost(f, rank);
  p.gold -= c.silver;
  takeLand(p, c.land);
  fit[f] = rank;
  game.db.ledger(s.accountId, 'fitting', -c.silver, `${f}:${rank}`);
  applyHero(game, s);
  game.sendTo(s, { t: 'toast', msg: `${FITTINGS[f].name[0]}: rank ${rank} fitted.`, kind: 'good' });
  return null;
}

// ------------------------------------------------------------------------------------------------ the workshop

function craftWhy(game: Game, s: PlayerSession, h: Holding, y: Yard, i: number): string | null {
  const c = CRAFTS[i];
  if (!c) return 'No such work';
  if (townLevel(y, 'market') < c.market) return c.market <= 1 ? 'Build a market in your town first: its workshop makes it.' : `Raise the market to level ${c.market} first.`;
  if (!lyingOff(game, s, h)) return 'Lie off your island: its workshop makes it.';
  if (s.profile!.gold < c.silver) return `Needs ${c.silver} silver`;
  return landLack(s.profile!, c.land) ?? lacking(h, y, s, true, c.goods);
}

/** An artifact made in her island's workshop of the land's resources. */
export function craftArtifact(game: Game, s: PlayerSession, i: number): string | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const why = craftWhy(game, s, m.h, m.y, i);
  if (why) return why;
  const c = CRAFTS[i];
  const p = s.profile!;
  const it = artifactFind(game, s, 'chest', c.art);
  if (!it) return 'No room in your locker for it.';
  p.gold -= c.silver;
  takeLand(p, c.land);
  takeGoods(m.h, m.y, s, true, c.goods);
  game.db.ledger(s.accountId, 'craft', -c.silver, c.art);
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `The workshop makes the ${ARTIFACTS[c.art].name[0]} for you.`, kind: 'gold' });
  return null;
}

// ------------------------------------------------------------------------------------------------ the anvil (docs/19 E13)

const anvils = new WeakMap<Game, Rng>();
function anvil(game: Game): Rng {
  let r = anvils.get(game);
  if (!r) anvils.set(game, (r = new Rng(0xf07e2a11)));
  return r;
}

/** One of her artifacts by its uid: worn, or in her locker. */
function artOf(p: Profile, uid: number): { it: Item; worn: boolean } | null {
  for (const it of Object.values(p.captainGear ?? {})) if (it?.uid === uid && it.art) return { it, worn: true };
  const it = p.stash.find((x) => x.uid === uid && x.art);
  return it ? { it, worn: false } : null;
}

function forgeWhy(game: Game, s: PlayerSession, h: Holding, y: Yard, it: Item, what: ForgeWhat): string | null {
  if (!it.art || !ARTIFACTS[it.art]) return 'Only an artifact goes to the anvil.';
  if (!forgeable(it, what)) return 'It has no primaries to spread.';
  if (townLevel(y, 'market') < FORGE_MARKET) return 'Build a market in your town first: its workshop keeps the anvil.';
  if (!lyingOff(game, s, h)) return 'Lie off your island: its workshop forges it.';
  if (it.forgeWas) return 'Choose first: the new roll or the old one.';
  if (s.ship?.underFire(game.now)) return 'Not in the middle of a fight';
  const c = forgeCost(it);
  if (s.profile!.gold < c.silver) return `Needs ${c.silver} silver`;
  return landLack(s.profile!, c.land) ?? lacking(h, y, s, true, { pearls: c.pearls });
}

/** An artifact at the anvil: its primaries spread anew (`prim`) or its forged line rolled anew (`line`). The new roll
 *  stands beside the old one until she chooses (forgeKeep); the price is paid either way. */
export function forgeArtifact(game: Game, s: PlayerSession, uid: number, what: string): string | null {
  if (what !== 'prim' && what !== 'line') return 'Bad order';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const p = s.profile!;
  const a = artOf(p, uid);
  if (!a) return 'No such piece';
  const why = forgeWhy(game, s, m.h, m.y, a.it, what);
  if (why) return why;
  const c = forgeCost(a.it);
  p.gold -= c.silver;
  takeLand(p, c.land);
  takeGoods(m.h, m.y, s, true, { pearls: c.pearls });
  a.it.forgeWas = a.it.forge ? structuredClone(a.it.forge) : { n: 0 };
  a.it.forge = forgeRoll(anvil(game), a.it, what);
  game.db.ledger(s.accountId, 'forge', -c.silver, `${a.it.art}:${what}:${a.it.forge.n}`);
  game.holdings.touch();
  if (a.worn) {
    applyWorn(game, s);
    applyHero(game, s);
  }
  game.sendTo(s, { t: 'toast', msg: `The anvil rings over the ${ARTIFACTS[a.it.art!].name[0]}: keep the new work or the old.`, kind: 'gold' });
  return null;
}

/** Her choice after the anvil: the new roll, or the old one back (the time at the anvil counts either way). */
export function forgeKeep(game: Game, s: PlayerSession, uid: number, keep: string): string | null {
  const p = s.profile!;
  const a = artOf(p, uid);
  if (!a) return 'No such piece';
  const was = a.it.forgeWas;
  if (!was) return 'Nothing waits at the anvil.';
  const n = a.it.forge?.n ?? was.n;
  if (keep === 'old') {
    if (was.p || was.k) a.it.forge = { ...structuredClone(was), n };
    else a.it.forge = { n };
  }
  delete a.it.forgeWas;
  if (a.worn) {
    applyWorn(game, s);
    applyHero(game, s);
  }
  game.sendTo(s, { t: 'toast', msg: keep === 'old' ? `The ${ARTIFACTS[a.it.art!].name[0]} keeps its old work.` : `The ${ARTIFACTS[a.it.art!].name[0]} takes its new work.`, kind: 'good' });
  return null;
}

/** Her artifacts at the anvil, for the town's screen: worn first, then the locker's. */
function forgeView(game: Game, s: PlayerSession, h: Holding, y: Yard): NonNullable<LandTownView['forge']> {
  const p = s.profile!;
  const list: { it: Item; worn: boolean }[] = [
    ...Object.values(p.captainGear ?? {}).filter((x): x is Item => !!x?.art && !!ARTIFACTS[x.art]).map((it) => ({ it, worn: true })),
    ...p.stash.filter((x) => !!x.art && !!ARTIFACTS[x.art]).map((it) => ({ it, worn: false })),
  ];
  return list.map(({ it, worn }) => ({
    uid: it.uid, art: it.art!, worn, forge: it.forge ? structuredClone(it.forge) : undefined, was: it.forgeWas ? structuredClone(it.forgeWas) : undefined,
    cost: forgeCost(it), why: { prim: forgeWhy(game, s, h, y, it, 'prim'), line: forgeWhy(game, s, h, y, it, 'line') },
  }));
}

// ------------------------------------------------------------------------------------------------ the market

/** The island's market buys `n` of a land resource at its poor rate. */
export function sellLand(game: Game, s: PlayerSession, r: string, n: number): string | null {
  if (!(LAND_RES as string[]).includes(r)) return 'Bad order';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const level = townLevel(m.y, 'market');
  if (level <= 0) return 'The island has no market.';
  const res = r as LandRes;
  const st = landStore(s.profile!);
  const k = Math.min(Math.floor(Number(n)), st[res]);
  if (!Number.isFinite(k) || k <= 0) return `No ${LAND_RES_DEF[res].name[0]} in your store.`;
  const silver = Math.floor(k * landSell(LAND_RES_DEF[res].value, level));
  if (silver <= 0) return 'The market will not trade so little.';
  st[res] -= k;
  s.profile!.gold += silver;
  game.db.ledger(s.accountId, 'isle_market', silver, `${res}:${k}`);
  game.sendTo(s, { t: 'toast', msg: `The market pays ${silver} silver for ${k} ${LAND_RES_DEF[res].name[0]}.`, kind: 'good' });
  return null;
}

// ------------------------------------------------------------------------------------------------ what the town shows

export function landTownView(game: Game, s: PlayerSession, h: Holding, y: Yard): LandTownView {
  const p = s.profile!;
  const market = townLevel(y, 'market');
  const fit = fitOf(p);
  return {
    res: { ...landStore(p) }, cap: LAND_RES_CAP,
    sell: market > 0 ? Object.fromEntries(LAND_RES.map((r) => [r, landSell(LAND_RES_DEF[r].value, market)])) as Record<LandRes, number> : null,
    crafts: CRAFTS.map((c, i) => ({ art: c.art, land: c.land, goods: c.goods as Partial<Record<GoodId, number>>, silver: c.silver, why: craftWhy(game, s, h, y, i) })),
    fits: FITTING_IDS.map((id) => {
      const rank = fit[id] ?? 0;
      return { id, rank, max: FITTING_MAX, next: rank < FITTING_MAX ? fittingCost(id, rank + 1) : null, why: fitWhy(game, s, h, id) };
    }),
    forge: forgeView(game, s, h, y), // docs/19 E13
  };
}

/** The town's buildings that ask for the land's resources (hooked into town.ts as the game starts). */
export function installLandHooks(): void {
  townHooks.land = (id: TownId, level: number) => townLand(id, level);
  townHooks.landLack = (s: PlayerSession, c: LandCost) => landLack(s.profile!, c);
  townHooks.landTake = (s: PlayerSession, c: LandCost) => takeLand(s.profile!, c);
  townHooks.landView = landTownView;
}

/** `/landecon [fit id rank|cap]`: the tester's console. */
export function adminLandEcon(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  if (args[0] === 'fit') {
    const id = args[1] as FittingId;
    if (!FITTING_IDS.includes(id)) return `Fittings: ${FITTING_IDS.join(', ')}.`;
    fitOf(p)[id] = Math.max(0, Math.min(FITTING_MAX, Math.round(Number(args[2] ?? FITTING_MAX))));
    applyHero(game, s);
    return `${FITTINGS[id].name[0]}: rank ${fitOf(p)[id]}.`;
  }
  if (args[0] === 'cap') {
    for (const r of LAND_RES) landStore(p)[r] = LAND_RES_CAP;
    return `The store full: ${LAND_RES_CAP} of shell, bone and venom.`;
  }
  const st = landStore(p);
  const f = fitOf(p);
  return `Store: ${st.shell} shell, ${st.bone} bone, ${st.venom} venom (cap ${LAND_RES_CAP}). Fittings: ${FITTING_IDS.map((id) => `${id} ${f[id] ?? 0}`).join(', ')}.`;
}

