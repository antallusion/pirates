// The captain as a HoMM3 hero (docs/17 H2): primaries grown at every level (and a captain from before them grown from
// her level), a choice of two skills at every level-up and what each of the twelve does, the order book with its will,
// schools, guilds, shrines and springs, sea orders, the artifacts and their sets, the tester's console — and the
// balance: captains of a level stay even in a boarding whatever their paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import {
  COMMON_SCHOOLS, LEARNABLE, ORDERS, ORDER_IDS, PRIM_BASE, SCHOOLS, SKILLS, SKILL_IDS, TACTICS_DEPLOY, guildOf, heroBattle, heroSeed, npcHeroBattle, orderCost, orderLevelCap, orderMul, primsAtLevel,
  shrineOrder, skillOffer, skillSeaMods, startingOrders, zeroPrims,
} from '../shared/src/data/hero.ts';
import type { HeroBattle, Prims, SkillSlot } from '../shared/src/data/hero.ts';
import { ARTIFACTS, ARTIFACT_IDS, ART_SETS, artTotals, artWares, fullSets, makeArtifact } from '../shared/src/data/artifacts.ts';
import { ITEM_BASES, gearSource, itemName, itemValue } from '../shared/src/data/items.ts';
import { TAC_SPELLS, hexX } from '../shared/src/data/tactical.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { blow, buildStacks, castSpell, makeField, moralePoints, newBattle, quickFinish, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { afterBattle, artifactFind, buyArtifact, castSea, heroAdmin, heroInput, heroOf, heroPrims, heroSecond, heroView, learnAtGuild, learnOrder, onShrine, onSpring, pendingChoices, pickSkill } from '../server/src/game/hero.ts';
import { equip } from '../server/src/game/gear.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { compareRows } from '../client/src/ui/gearcmp.ts';
import type { Game } from '../server/src/game/Game.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string, cap: CaptainId = 'corsair') {
  const c = join(game, name, cap);
  const s = game.sessionByName(name)!;
  return { c, s, p: s.profile!, ship: s.ship! };
}

const side = (army: ArmyStack[], hero?: HeroBattle, o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...(hero ? { hero } : {}), ...o,
});
const hb = (prim: Partial<Prims> = {}, skills: SkillSlot[] = [], book = startingOrders('corsair'), mana = 999): HeroBattle =>
  heroBattle({ ...zeroPrims(), will: 50, ...prim }, skills, null, book, mana);
const ARMY: ArmyStack[] = [{ u: 'marine', n: 30 }, { u: 'sailor', n: 40 }, { u: 'musketeer', n: 12 }];

// ------------------------------------------------------------------ 6. primaries

test('primaries: a path starts with six points and grows one a level on her own seed; the path leans the draw', () => {
  for (const c of Object.keys(PRIM_BASE) as CaptainId[]) {
    const p = PRIM_BASE[c];
    assert.equal(p.atk + p.def + p.pow + p.will, 6, c);
    const at40 = primsAtLevel(c, 12345, 40);
    assert.equal(at40.atk + at40.def + at40.pow + at40.will, 6 + 39, `${c}: one a level`);
    assert.deepEqual(primsAtLevel(c, 12345, 40), at40, 'the same captain grows the same way');
  }
  // Over many captains: the Reaver's Attack, the Drowned's Power.
  let ra = 0, rp = 0, da = 0, dp = 0;
  for (let k = 0; k < 60; k++) {
    const r = primsAtLevel('reaver', k * 97 + 1, 40), d = primsAtLevel('drowned', k * 97 + 1, 40);
    ra += r.atk; rp += r.pow; da += d.atk; dp += d.pow;
  }
  assert.ok(ra > da * 1.5 && dp > rp * 1.5, `reaver atk ${ra} vs drowned ${da}; drowned pow ${dp} vs reaver ${rp}`);
});

test('a captain from before the heroes is grown from her level, deterministically; the next level adds exactly one', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Old Salt');
  delete p.hero;
  p.level = 25;
  sanitizeProfile(p);
  const h = heroOf(p);
  assert.deepEqual(h.prim, primsAtLevel('corsair', heroSeed(p.createdAt, 'corsair'), 25));
  assert.equal(h.primLv, 25);
  assert.equal(pendingChoices(p), 24, 'every level\'s choice of skill is still hers');
  assert.equal(h.mana, heroView(p).willMax, 'a full store to start');
  const sum = (x: Prims) => x.atk + x.def + x.pow + x.will;
  const before = sum(h.prim);
  const { xpForLevel } = { xpForLevel: (l: number) => Math.round(120 * Math.pow(l, 1.55)) };
  game.grantXp(s, xpForLevel(25) - p.xp + 1, null);
  assert.equal(p.level, 26);
  assert.equal(sum(heroOf(p).prim), before + 1);
  assert.equal(pendingChoices(p), 25);
});

test('Attack and Defense go on every stack; each point of difference is 5% of the blow, as in HoMM3', () => {
  const cells = makeField(3);
  const plain = buildStacks(side(ARMY), 0, cells, 1);
  const hero = buildStacks(side(ARMY, hb({ atk: 6, def: 4 })), 0, makeField(3), 1);
  for (let i = 0; i < plain.length; i++) {
    assert.equal(hero[i].atk, Math.round((plain[i].atk + 6) * 10) / 10);
    assert.equal(hero[i].def, Math.round((plain[i].def + 4) * 10) / 10);
  }
  const dmg = (atk: number, def: number) => {
    const bt = newBattle(side(ARMY, hb({ atk })), side(ARMY, hb({ def })), 5, 0, new Rng(5));
    const a = bt.stacks.find((x) => x.side === 0 && x.unit === 'marine')!, d = bt.stacks.find((x) => x.side === 1 && x.unit === 'marine')!;
    return blow(bt, a, d, 'melee', null).dmg;
  };
  const even = dmg(0, 0), up = dmg(4, 0), down = dmg(0, 4);
  assert.ok(Math.abs(up / even - 1.2) < 0.03, `4 points of Attack: ×${(up / even).toFixed(3)}`);
  assert.ok(Math.abs(even / down - 1.2) < 0.03, `4 points of Defense: ×${(even / down).toFixed(3)}`);
});

test('Power of Orders scales the orders; Will is their store, spent as they are given and never overdrawn', () => {
  const grenade = (pow: number) => {
    const bt = newBattle(side(ARMY, hb({ pow })), side(ARMY), 9, 0, new Rng(9));
    const t = bt.stacks.find((x) => x.side === 1 && x.unit === 'sailor')!;
    const hp0 = bt.stacks.filter((x) => x.side === 1).reduce((n, x) => n + x.count, 0);
    bt.active = bt.stacks.find((x) => x.side === 0)!.id;
    assert.equal(castSpell(bt, 0, 'grenades', t.id, new Rng(1)), null);
    return hp0 - bt.stacks.filter((x) => x.side === 1).reduce((n, x) => n + x.count, 0);
  };
  assert.ok(grenade(10) > grenade(0) * 1.4, `power 10 ${grenade(10)} men vs power 0 ${grenade(0)}`);
  assert.ok(Math.abs(orderMul(10, 0, 0) - 1.7) < 1e-9);
  assert.equal(orderMul(100, 0, 0), 3, 'capped at three times');
  // Will: each order costs; too little and it is refused.
  const bt = newBattle(side(ARMY, hb({ will: 1 }, [], ['grenades', 'war_cry'], 6)), side(ARMY), 2, 0, new Rng(2));
  assert.equal(bt.heroes[0].mana, 6);
  const t = bt.stacks.find((x) => x.side === 1)!;
  assert.equal(castSpell(bt, 0, 'grenades', t.id, new Rng(3)), null);
  assert.equal(bt.heroes[0].mana, 6 - ORDERS.grenades.cost);
  bt.round++;
  assert.equal(castSpell(bt, 0, 'war_cry', undefined, new Rng(3)), 'Not enough will');
});

// ------------------------------------------------------------------ 7. secondary skills

test('the level-up offers two skills: one of hers raised and one new while a slot is free; eight slots, three ranks', () => {
  const skills: SkillSlot[] = [{ id: 'navigation', r: 1 }];
  const o = skillOffer(skills, ['navigation'], {}, 7, 5);
  assert.equal(o.length, 2);
  assert.equal(o[0].id, 'navigation');
  assert.equal(o[0].r, 2);
  assert.equal(o[1].r, 1);
  assert.notEqual(o[1].id, 'navigation');
  const full: SkillSlot[] = SKILL_IDS.slice(0, 8).map((id) => ({ id, r: 3 }));
  assert.deepEqual(skillOffer(full, [], {}, 7, 9), [], 'eight at expert: nothing to offer');
  // Her talent trees weigh on it: a gunnery build is offered Artillery far more often.
  let art = 0, plain = 0;
  for (let lv = 2; lv < 200; lv++) {
    if (skillOffer([], [], { gunnery: 30 }, 11, lv).some((x) => x.id === 'artillery')) art++;
    if (skillOffer([], [], {}, 11, lv).some((x) => x.id === 'artillery')) plain++;
  }
  assert.ok(art > plain * 1.3, `artillery offered ${art} vs ${plain}`);
});

test('choosing a skill: the pick is kept, the choices count down, the ship feels it at once', () => {
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Chooser');
  p.level = 4;
  const h = heroOf(p);
  h.picked = 1;
  assert.equal(pendingChoices(p), 3);
  assert.equal(pickSkill(game, s, 5), 'No such choice');
  const offer = heroView(p).offer;
  assert.equal(offer.length, 2);
  assert.equal(pickSkill(game, s, 1), null);
  assert.equal(pendingChoices(p), 2);
  assert.equal(heroOf(p).skills[0].id, offer[1].id);
  // Logistics at expert: the ship is faster (her speed shares the talents' cap).
  const v0 = ship.stats.maxSpeed;
  heroAdmin(game, s, 'skill', ['logistics', '3']);
  assert.ok(ship.stats.maxSpeed > v0 * 1.04, `${v0} → ${ship.stats.maxSpeed} (within the talents' speed cap)`);
});

test('every skill does something: the sea lines in the talents\' vocabulary, the battle lines in the boarding', () => {
  const lo = { classId: 'brig' as const, name: 'x', guns: { port: 'long_9' as const, starboard: 'long_9' as const }, modules: {} };
  const base = computeShipStats(lo, 'corsair', {});
  const withSkill = (id: SkillSlot['id']) => computeShipStats(lo, 'corsair', {}, [], [], { mods: skillSeaMods([{ id, r: 3 }]) });
  assert.ok(withSkill('navigation').turnRate > base.turnRate && withSkill('navigation').noGoDeg < base.noGoDeg, 'navigation');
  assert.ok(withSkill('artillery').gunDamageMul > base.gunDamageMul && withSkill('artillery').reloadMul < base.reloadMul, 'artillery');
  assert.ok(withSkill('boarding').boardingPower > base.boardingPower, 'boarding');
  assert.ok(withSkill('armor').incomingDamageMul < base.incomingDamageMul, 'armor');
  assert.ok(withSkill('leadership').moraleRegen > base.moraleRegen, 'leadership');
  assert.ok((withSkill('luck').x.treasureHunter ?? 0) > 0, 'luck');
  assert.ok(withSkill('logistics').maxSpeed > base.maxSpeed, 'logistics');
  assert.ok(withSkill('scouting').detection > base.detection, 'scouting');
  assert.ok(withSkill('trading').buyMul < base.buyMul && withSkill('trading').sellMul > base.sellMul, 'trading');
  // In the boarding.
  const pair = (skills: SkillSlot[], foe: SkillSlot[] = []): TacBattle => newBattle(side(ARMY, hb({}, skills)), side(ARMY, hb({}, foe)), 4, 0, new Rng(4));
  const hit = (bt: TacBattle, u: string, how: 'melee' | 'shot') => blow(bt, bt.stacks.find((x) => x.side === 0 && x.unit === u)!, bt.stacks.find((x) => x.side === 1 && x.unit === 'marine')!, how, null).dmg;
  const b0 = pair([]);
  assert.ok(hit(pair([{ id: 'boarding', r: 3 }]), 'marine', 'melee') > hit(b0, 'marine', 'melee') * 1.25, 'boarding: melee +30%');
  assert.ok(hit(pair([{ id: 'artillery', r: 3 }]), 'musketeer', 'shot') > hit(b0, 'musketeer', 'shot') * 1.25, 'artillery: shots +30%');
  assert.ok(hit(pair([], [{ id: 'armor', r: 3 }]), 'marine', 'melee') < hit(b0, 'marine', 'melee') * 0.9, 'armor: taken −15%');
  assert.equal(moralePoints(pair([{ id: 'leadership', r: 2 }]), 0) - moralePoints(b0, 0), 2, 'leadership: morale +2');
  assert.ok(pair([{ id: 'luck', r: 2 }]).heroes[0].luck > b0.heroes[0].luck, 'luck');
  // Tactics: her line nearer the planks, the lower hand's none.
  const col = (bt: TacBattle) => Math.max(...bt.stacks.filter((x) => x.side === 0 && x.unit === 'marine').map((x) => hexX(x.hex)));
  assert.equal(col(pair([{ id: 'tactics', r: 2 }])) - col(b0), TACTICS_DEPLOY[2], 'tactics: two hexes nearer');
  assert.equal(col(pair([{ id: 'tactics', r: 1 }], [{ id: 'tactics', r: 2 }])), col(b0), 'the higher tactics has the field');
  // Deep Mysticism: stronger orders, higher levels.
  assert.ok(orderMul(0, 0, 3) > orderMul(0, 0, 0));
  assert.equal(orderLevelCap(1, 0), 2);
  assert.equal(orderLevelCap(1, 3), 5);
  // School skills: stronger and cheaper.
  assert.ok(orderMul(0, 3, 0) === 1.5 && orderCost('maelstrom', 3) < orderCost('maelstrom', 0));
});

test('First Aid: after the battle a share of her fallen stand again; the will she spent stays spent', () => {
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Surgeon');
  heroAdmin(game, s, 'skill', ['first_aid', '3']);
  assert.equal(heroInput(game, ship).raise, 0.3);
  const men = ship.crew;
  ship.loseFrom(ship.army[0].u, 10);
  afterBattle(game, ship, 3, [{ u: ship.army[0]?.u ?? 'deckhand', n: 10 }], 0.3);
  assert.equal(ship.crew, men - 10 + 3);
  assert.equal(heroOf(p).mana, 3);
});

// ------------------------------------------------------------------ 8. the order book

test('the book: 4 schools, levels 1–5, 20 orders to learn (the H1 book among them) and the six paths\' own', () => {
  assert.equal(LEARNABLE.length, 20);
  assert.equal(ORDER_IDS.filter((id) => ORDERS[id].sig).length, 6);
  assert.equal(ORDER_IDS.length - LEARNABLE.length, 6 + 36, 'and the six path books of docs/18');
  for (const sc of COMMON_SCHOOLS) assert.ok(LEARNABLE.filter((id) => ORDERS[id].school === sc).length >= 4, sc);
  assert.equal(SCHOOLS.length, 6);
  assert.deepEqual([...new Set(LEARNABLE.map((id) => ORDERS[id].level))].sort(), [1, 2, 3, 4, 5]);
  for (const id of ['grenades', 'mark_target', 'double_shot', 'war_cry', 'brine_mend'] as const) assert.equal(ORDERS[id].level <= 2, true, `${id} among the first`);
  assert.ok(LEARNABLE.filter((id) => ORDERS[id].use === 'sea').length >= 5, 'sea orders');
  for (const id of ORDER_IDS) if (ORDERS[id].use === 'battle') assert.ok(TAC_SPELLS[id as keyof typeof TAC_SPELLS], `${id} fought in the battle`);
});

test('the new battle orders each do what they say', () => {
  const run = (id: keyof typeof TAC_SPELLS, target = false) => {
    const bt = newBattle(side(ARMY, hb({}, [], [id])), side(ARMY), 6, 0, new Rng(6));
    const foe = () => bt.stacks.filter((x) => x.side === 1).reduce((n, x) => n + x.count, 0);
    const own = () => bt.stacks.filter((x) => x.side === 0).reduce((n, x) => n + x.count, 0);
    const f0 = foe();
    for (const x of bt.stacks) if (x.side === 0) x.count = Math.max(1, Math.round(x.count / 2));
    const o0 = own();
    const t = bt.stacks.find((x) => x.side === 1 && x.count > 0)!;
    assert.equal(castSpell(bt, 0, id, target ? t.id : undefined, new Rng(7)), null, id);
    return { bt, foeLost: f0 - foe(), ownGain: own() - o0 };
  };
  assert.ok(run('musket_storm').bt.stacks.filter((x) => x.side === 1).every((x) => x.count < x.start), 'musket storm hits every stack');
  assert.ok(run('powder_keg', true).foeLost > 0, 'powder keg');
  assert.ok(run('maelstrom').foeLost > 0, 'maelstrom');
  assert.ok(run('tide_returns').ownGain > 0, 'the tide returns');
  const sw = run('shield_wall').bt;
  const a = sw.stacks.find((x) => x.side === 1 && x.unit === 'marine')!, d = sw.stacks.find((x) => x.side === 0 && x.unit === 'marine')!;
  const shielded = blow(sw, a, d, 'melee', null).dmg;
  sw.heroes[0].fx = [];
  assert.ok(shielded < blow(sw, a, d, 'melee', null).dmg, 'shield wall');
  const fu = run('fury').bt;
  const x = fu.stacks.find((s) => s.side === 0 && s.unit === 'marine')!, y = fu.stacks.find((s) => s.side === 1 && s.unit === 'marine')!;
  const furious = blow(fu, x, y, 'melee', null).dmg;
  fu.heroes[0].fx = [];
  assert.ok(furious > blow(fu, x, y, 'melee', null).dmg, 'fury');
  const dr = run('dread').bt;
  const m0 = moralePoints(dr, 1);
  dr.heroes[0].fx = [];
  assert.ok(m0 < moralePoints(dr, 1), 'dread');
  const hw = run('head_wind').bt;
  const slow = viewOf(hw, 1, 0, false).stacks.filter((x) => x.side === 1).map((x) => x.speed + x.init);
  hw.heroes[0].fx = [];
  const fast = viewOf(hw, 1, 0, false).stacks.filter((x) => x.side === 1).map((x) => x.speed + x.init);
  assert.ok(slow.every((v, i) => v < fast[i]), 'head wind');
  const fw = run('following_wind').bt;
  const quick = viewOf(fw, 0, 0, false).stacks.filter((x) => x.side === 0).map((x) => x.init);
  fw.heroes[0].fx = [];
  assert.ok(viewOf(fw, 0, 0, false).stacks.filter((x) => x.side === 0).every((x, i) => x.init < quick[i]), 'following wind');
});

test('guilds teach their set list for silver; shrines each one order and the will whole; the level cap holds', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Scholar');
  const port = game.world.ports.find((x) => guildOf(x.id, x.size))!;
  const list = guildOf(port.id, port.size)!;
  assert.ok(list.length >= 4 && new Set(list.map((id) => ORDERS[id].school)).size === 4, 'every school at a guild');
  const id = list.find((x) => ORDERS[x].level <= 2 && !heroOf(p).orders.includes(x))!;
  p.gold = 1e6;
  assert.equal(learnAtGuild(game, s, port, id), null);
  assert.ok(heroOf(p).orders.includes(id));
  assert.equal(learnAtGuild(game, s, port, id), 'You know that order already');
  assert.equal(learnAtGuild(game, s, port, 'point_blank'), 'This guild does not teach that order');
  assert.match(learnOrder(game, s, 'powder_keg')!, /beyond you/, 'level 5 at level 1');
  heroAdmin(game, s, 'skill', ['mysticism', '3']);
  assert.equal(learnOrder(game, s, 'powder_keg'), null, 'Deep Mysticism opens it');
  // A shrine.
  const h = heroOf(p);
  h.mana = 0;
  const isle = 4;
  onShrine(game, s, isle);
  assert.ok(h.orders.includes(shrineOrder(isle)));
  assert.equal(h.mana, heroView(p).willMax);
  h.mana = 0;
  onSpring(game, s);
  assert.equal(h.mana, heroView(p).willMax);
});

test('will fills a quarter a day at sea and in port by half (all of it at a guild)', () => {
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Tide');
  const h = heroOf(p);
  const max = heroView(p).willMax;
  ship.docked = null;
  heroSecond(game, s);
  h.mana = 0;
  game.now += DAY_LENGTH_SEC;
  heroSecond(game, s);
  assert.ok(Math.abs(h.mana - max * 0.25) < 0.01, `${h.mana} of ${max}`);
  const port = game.world.ports.find((x) => !guildOf(x.id, x.size))!;
  ship.docked = port.id;
  heroSecond(game, s);
  assert.ok(Math.abs(h.mana - max * 0.75) < 0.01);
});

test('sea orders: cast from the HUD for will, with a wait; the fair wind, the mended hull, the becalmed foe', () => {
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Windward');
  ship.docked = null;
  const h = heroOf(p);
  assert.equal(castSea(game, s, 'fair_wind'), 'You do not know that order');
  heroAdmin(game, s, 'order', ['all']);
  heroAdmin(game, s, 'prim', ['will', '20']);
  heroAdmin(game, s, 'will', ['full']);
  const v0 = ship.stats.maxSpeed, m0 = h.mana;
  assert.equal(castSea(game, s, 'fair_wind'), null);
  assert.ok(ship.stats.maxSpeed > v0 * 1.12);
  assert.equal(h.mana, m0 - heroView(p).costs.fair_wind!);
  assert.equal(castSea(game, s, 'fair_wind'), 'That order is not ready yet');
  assert.equal(castSea(game, s, 'grenades'), 'That order is for the boarding battle');
  ship.hull = ship.stats.hullMax * 0.5;
  assert.equal(castSea(game, s, 'mend_hull'), null);
  assert.ok(ship.hull > ship.stats.hullMax * 0.59);
  assert.equal(castSea(game, s, 'becalm'), 'No ship near to becalm');
  const foe = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + 200, ship.state.y, 0);
  const fv = foe.stats.maxSpeed;
  assert.equal(castSea(game, s, 'becalm'), null);
  assert.ok(foe.stats.maxSpeed < fv * 0.7, 'becalmed');
  ship.docked = game.world.ports[0].id;
  heroAdmin(game, s, 'will', ['full']);
  assert.equal(castSea(game, s, 'deep_sight'), 'Not in port');
});

// ------------------------------------------------------------------ 9. artifacts

test('artifacts: in the captain\'s slots, they give primaries; a whole set its bonus; their own names and the item art', () => {
  assert.ok(ARTIFACT_IDS.length >= 20);
  assert.equal(Object.keys(ART_SETS).length, 3);
  for (const id of ARTIFACT_IDS) {
    const a = ARTIFACTS[id];
    assert.ok(ITEM_BASES[a.base] && ITEM_BASES[a.base].slot === a.slot, `${id} on a ${a.slot} base`);
    assert.match(a.icon, /^item_/);
  }
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Collector');
  p.level = 40;
  const it = artifactFind(game, s, 'boss', 'red_hook_axe')!;
  assert.equal(itemName(it), 'Axe of the Red Hook');
  assert.equal(itemName(it, true), 'Топор Красного Крюка');
  const atk0 = heroPrims(p).atk;
  assert.equal(equip(game, s, it.uid), null);
  assert.equal(heroPrims(p).atk, atk0 + 3);
  assert.equal(heroInput(game, ship).atk, atk0 + 3, 'into the battle');
  for (const id of ['hook_brace', 'bloodied_baldric']) equip(game, s, artifactFind(game, s, 'boss', id)!.uid);
  assert.deepEqual(fullSets(Object.values(p.captainGear) as never), ['red_hook_arms']);
  assert.equal(heroPrims(p).atk, atk0 + 3 + 1 + 1 + 4, 'the pieces and the set');
  assert.ok(heroInput(game, ship).melee >= 0.2, 'the set\'s melee');
  // The stormcaller's sea bonus reaches the ship's stats.
  const storm = ['squall_glass', 'deck_grip_boots', 'ring_of_the_gale'].map((id) => makeArtifact(id));
  assert.ok((gearSource(storm).mods.maxSpeed ?? 0) > (gearSource(storm.slice(0, 2)).mods.maxSpeed ?? 0), 'the set\'s speed');
  assert.equal(artTotals(storm).seaCost, 0.5);
  assert.ok(itemValue(it) === ARTIFACTS.red_hook_axe.price);
  // The comparison shows the primaries.
  const rows = compareRows(makeArtifact('quartermaster_rapier'), it);
  assert.ok(rows.some((r) => r.kind === 'prim' && r.key === 'atk'), 'primaries in the comparison');
});

test('artifact merchants: three pieces a day, each once; the hero\'s own dice leave the sea\'s alone', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Buyer');
  const port = game.world.ports.find((x) => x.size >= 3)!;
  p.gold = 1e6;
  const n0 = p.stash.length;
  const before = game.rng.float.bind(game.rng);
  const probe = new Rng(0);
  void probe;
  const r0 = JSON.stringify(game.rng);
  assert.equal(buyArtifact(game, s, port, 0), null);
  assert.equal(p.stash.length, n0 + 1);
  assert.ok(p.stash[p.stash.length - 1].art);
  assert.equal(buyArtifact(game, s, port, 0), 'That is sold');
  artifactFind(game, s, 'chest');
  assert.equal(JSON.stringify(game.rng), r0, 'the sea\'s stream untouched');
  void before;
  assert.equal(artWares(port.id, 5).length, 3);
});

// ------------------------------------------------------------------ the console

test('the tester\'s console: /prim /skill /order /art /will, and the Russian help says the same commands', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Tester');
  const prev = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    assert.match(runAdmin(game, s, '/prim atk 9')!, /Attack 9/);
    assert.match(runAdmin(game, s, '/skill armor 2')!, /Armor 2/);
    assert.match(runAdmin(game, s, '/order all')!, /Orders: 21/);
    runAdmin(game, s, '/art set storm');
    assert.equal(p.stash.filter((x) => x.art).length, 3);
    assert.match(runAdmin(game, s, '/will 3')!, /Will 3\//);
    const help = runAdmin(game, s, '/help')!;
    for (const c of ['/prim', '/skill', '/order', '/art', '/will']) assert.ok(help.includes(c), c);
    const ru = SERVER_RU_ADMIN[help];
    assert.ok(ru, 'the Russian help');
    const cmds = (x: string) => x.match(/\/[a-z]+/g)!.join(' ');
    assert.equal(cmds(ru), cmds(help), 'command for command');
  } finally {
    if (prev === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = prev;
  }
});

// ------------------------------------------------------------------ balance

test('balance: captains of a level stay even in a boarding whatever their paths (each path 30–70% against all, the H1 spread was 37–69%)', () => {
  const caps: CaptainId[] = ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'];
  const n = 12;
  for (const level of [10, 30]) {
    const sl = Math.ceil(level / 6);
    const army = armyForLevel(sl, 100, 7);
    const mk = (c: CaptainId, seed: number): TacSideInput => {
      const prim = primsAtLevel(c, seed, level);
      return side(army, heroBattle(prim, [], null, startingOrders(c), prim.will * 10), { captain: c });
    };
    const avg: string[] = [];
    for (const a of caps) {
      let w = 0, g = 0;
      for (const b of caps) {
        for (let k = 0; k < n; k++) {
          const rng = new Rng(1000 + k * 17);
          const flip = k % 2 === 1;
          const A = mk(a, 11 + k * 7), B = mk(b, 5 + k * 13);
          const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
          quickFinish(bt, 0, rng);
          if ((bt.over!.winner === 0) !== flip) w++;
          g++;
        }
      }
      avg.push(`${a} ${Math.round((w / g) * 100)}%`);
      assert.ok(w / g >= 0.3 && w / g <= 0.7, `level ${level}: ${avg.join(', ')}`);
    }
  }
  // The sea's captains grow with their waters.
  assert.ok(npcHeroBattle(8, null).atk > npcHeroBattle(2, null).atk && npcHeroBattle(8, null).book.length > npcHeroBattle(1, null).book.length);
});

test('every skill and order has both languages', () => {
  for (const id of SKILL_IDS) for (const t of [SKILLS[id].name, ...SKILLS[id].text]) assert.ok(t[0] && /[а-я]/i.test(t[1]) && !/[a-z]/i.test(t[1].replace(/\/[a-z]+/g, '')), `${id}: ${t[1]}`);
  for (const id of ORDER_IDS) for (const t of [ORDERS[id].name, ORDERS[id].text]) assert.ok(/[а-я]/i.test(t[1]) && !/[a-z]/i.test(t[1]), `${id}: ${t[1]}`);
  for (const id of ARTIFACT_IDS) for (const t of [ARTIFACTS[id].name, ARTIFACTS[id].text]) assert.ok(!/[a-z]/i.test(t[1]), `${id}: ${t[1]}`);
});
