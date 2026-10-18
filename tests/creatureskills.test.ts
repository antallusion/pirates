// Owner, 2026-10-18 («некоторым из них надо давать разные скиллы… способности условно можно юзать только раз. где-то для
// 30% существ… часть должны быть рдд… кто-то там сплешем может бить»): the creatures' abilities (shared/src/data/
// creatureskills.ts, server/src/game/tacskills.ts) and the ranged kinds.
// - the share: about 30% of the 271 kinds hold one, 25–40 kinds of them, none of the men's fourteen; 20–25% fire from afar;
// - every kind resolves as it says and only once a battle; a free one leaves her turn; the one that goes off as she falls;
// - a shot draws no answer and a shooter's blow in melee is halved; a splash takes the stacks beside the mark only;
// - the sea's mind gives them; a recorded battle with them plays again the same; the words are whole in RU and EN.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { UNITS, UNIT_IDS, armyPower } from '../shared/src/data/army.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import { RANGED_KINDS, SKILLS, SKILL_IDS, UNIT_SKILL, skillVars } from '../shared/src/data/creatureskills.ts';
import type { SkillId } from '../shared/src/data/creatureskills.ts';
import { TAC_H, TAC_W, hexDist, hexIndex, hexNeighbors } from '../shared/src/data/tactical.ts';
import { act, aiAct, aiChoice, blowParts, lossesOf, modsOf, newBattle, quickFinish, recFromJson, recToJson, replayBattle, stackById, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import { skillTargets } from '../server/src/game/tacskills.ts';
import { EN, RU } from '../client/src/lang/ui/skills.ts';

const side = (army: { u: UnitId; n: number }[], o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: true, ...o,
});
const holderOf = (id: SkillId): UnitId => (Object.keys(UNIT_SKILL) as UnitId[]).find((u) => UNIT_SKILL[u] === id)!;
const hpOf = (s: TacStack) => (s.count > 0 ? (s.count - 1) * s.hpMax + s.hpTop : 0);

/** A clean deck: the holder `u` (side 0) on the waist, a hurt companion beside her, the foes in a knot two hexes off
 *  (the mark, one beside it) and one far on the other rail; the holder to act. */
function arena(u: UnitId, foe: UnitId = 'marine', o: { gap?: number; hurt?: boolean } = {}): { bt: TacBattle; me: TacStack; mate: TacStack; mark: TacStack; near: TacStack; far: TacStack } {
  const n = Math.max(3, Math.round(400 / UNITS[u].hp));
  const fn = Math.max(4, Math.round(300 / UNITS[foe].hp));
  const bt = newBattle(side([{ u, n }, { u: 'marine', n: 30 }]), side(([{ u: foe, n: fn }, { u: foe, n: fn }, { u: 'sailor', n: 40 }] as { u: UnitId; n: number }[]).map((x, i) => ({ ...x, n: x.n + i }))), 7, 0, new Rng(7), { len: 'board' });
  for (let i = 0; i < bt.cells.length; i++) if (bt.cells[i] !== '#') bt.cells[i] = '.';
  const me = bt.stacks.find((s) => s.side === 0 && s.unit === u)!;
  const mate = bt.stacks.find((s) => s.side === 0 && s !== me)!;
  const [mark, near, far] = bt.stacks.filter((s) => s.side === 1);
  const gap = o.gap ?? 2;
  me.hex = hexIndex(3, 4);
  mate.hex = hexIndex(2, 4);
  mark.hex = hexIndex(3 + gap, 4);
  near.hex = hexIndex(4 + gap, 4);
  far.hex = hexIndex(TAC_W - 1, 0);
  if (o.hurt !== false) {
    mate.count = Math.ceil(mate.count / 2);
    me.count = Math.max(1, Math.ceil(me.count * 0.6));
  }
  bt.active = me.id;
  bt.queue = bt.queue.filter((id) => id !== me.id);
  return { bt, me, mate, mark, near, far };
}

test('the share: about 30% of the creatures hold an ability, 25–40 kinds of them, every kind held; 20–25% fire from afar', () => {
  const all = Object.keys(UNITS) as UnitId[];
  assert.equal(all.length, 271);
  const held = all.filter((u) => UNIT_SKILL[u]);
  assert.ok(held.length / all.length >= 0.27 && held.length / all.length <= 0.35, `${held.length} of ${all.length}`);
  assert.ok(SKILL_IDS.length >= 25 && SKILL_IDS.length <= 40, `${SKILL_IDS.length} kinds`);
  for (const id of SKILL_IDS) assert.ok(held.some((u) => UNIT_SKILL[u] === id), `${id} is held by a kind`);
  // none of the men's fourteen (the ladder's crew and the sea's pirates the balance is weighed on)
  for (const u of UNIT_IDS) assert.equal(UNIT_SKILL[u], undefined, u);
  const ranged = all.filter((u) => UNITS[u].specials.includes('shooter'));
  assert.ok(ranged.length / all.length >= 0.2 && ranged.length / all.length <= 0.25, `${ranged.length} ranged`);
  for (const u of Object.keys(RANGED_KINDS) as UnitId[]) assert.ok(UNITS[u].specials.includes('shooter') && UNITS[u].shots > 0, u);
  // the abilities overlap partly with the ranged
  const both = held.filter((u) => ranged.includes(u)).length;
  assert.ok(both > 5 && both < held.length / 2, `${both} both`);
  // spread over the peoples, the land's, the shop's and the great ones
  const by = (f: (u: UnitId) => boolean) => held.filter(f).length;
  for (const r of ['crown', 'choir', 'harpoon', 'brokers', 'league', 'free', 'dutchman']) assert.ok(by((u) => UNITS[u].roster === r) >= 4, r);
  assert.ok(by((u) => !!UNITS[u].premium) >= 15 && by((u) => !!UNITS[u].beast && !UNITS[u].premium) >= 15);
  // and over the tiers
  for (let t = 1; t <= 8; t++) assert.ok(by((u) => UNITS[u].tier === t) >= 2, `tier ${t}`);
});

test('priced: a kind with an ability is worth more in the sea\'s reckoning and in silver', () => {
  const u = holderOf('fireball');
  const plain = { ...UNITS[u] };
  assert.ok(armyPower([{ u, n: 1 }]) > 0);
  assert.ok(UNITS.crown_rocketeer.cost > UNITS.crown_mortar.cost, 'the rocketeer dearer than its plain kind');
  void plain;
});

test('every ability resolves as it says, only once a battle', () => {
  for (const id of SKILL_IDS) {
    if (id === 'death_blast') continue;
    const u = holderOf(id);
    const d = SKILLS[id];
    const { bt, me, mate, mark, near, far } = arena(u, 'marine', { gap: d.range === 1 ? 1 : 2 });
    if (id === 'cleanse') mate.poison = { dmg: 3, left: 2, by: 1 };
    const aims = skillTargets(bt, me);
    assert.ok(aims, `${id}: may be given`);
    const before = new Map(bt.stacks.map((s) => [s.id, { hp: hpOf(s), hex: s.hex }]));
    const target = d.aim === 'enemy' ? mark.id : d.aim === 'own' ? (aims!.includes(mate.id) ? mate.id : aims![0]) : undefined;
    const hex = d.aim === 'hex' ? (id === 'summon' ? aims![0] : hexIndex(5, 6)) : undefined;
    const a = { a: 'skill' as const, ...(target !== undefined ? { target } : {}), ...(hex !== undefined ? { hex } : {}) };
    const n0 = bt.stacks.length;
    assert.equal(act(bt, 0, a, 0, new Rng(3)), null, `${id}: given`);
    assert.ok(me.skillUsed, `${id}: spent`);
    const ev = bt.log.find((e) => e.k === 'skill' && e.s === me.id);
    assert.ok(ev && ev.id === id, `${id}: told`);
    const lost = (s: TacStack) => before.get(s.id)!.hp - hpOf(s);
    const mm = modsOf(bt, 1, mark.id);
    switch (id) {
      case 'mend': case 'raise': case 'cleanse':
        assert.ok(hpOf(stackById(bt, target!)!) > before.get(target!)!.hp, `${id}: mended`);
        break;
      case 'mass_mend':
        assert.ok(hpOf(mate) > before.get(mate.id)!.hp && hpOf(me) > before.get(me.id)!.hp, id);
        break;
      case 'ward': assert.ok(modsOf(bt, 0, target!).taken < 0, id); break;
      case 'bulwark': assert.ok(modsOf(bt, 0, me.id).taken < 0, id); break;
      case 'haste': assert.ok(modsOf(bt, 0, target!).speed > 0, id); break;
      case 'rally': assert.ok(modsOf(bt, 0, mate.id).init > 0 && modsOf(bt, 0).morale > 0, id); break;
      case 'toast': assert.ok(modsOf(bt, 0).luck > 0, id); break;
      case 'frenzy':
        assert.ok(modsOf(bt, 0, me.id).melee > 0, id);
        assert.equal(bt.active, me.id, 'frenzy: her turn goes on');
        break;
      case 'fear': case 'stun':
        assert.equal(mark.skip, 1, `${id}: a turn lost`);
        if (id === 'stun') assert.ok(lost(mark) > 0);
        break;
      case 'freeze': assert.ok(mm.still && mm.speed < 0, id); break;
      case 'siren': assert.ok(mm.mad, id); break;
      case 'curse': assert.ok(mm.melee < 0 && mm.shot < 0, id); break;
      case 'mark': assert.ok(mm.taken > 0, id); break;
      case 'ink': assert.ok(mm.shot < 0 && modsOf(bt, 1, near.id).shot < 0 && modsOf(bt, 1, far.id).shot === 0, `${id}: the mark and beside it`); break;
      case 'slow': assert.ok(mm.speed < 0 && modsOf(bt, 1, near.id).speed < 0 && lost(mark) > 0, id); break;
      case 'entangle': assert.ok(mm.speed <= -10 && lost(mark) > 0, id); break;
      case 'taunt': break;
      case 'toll': assert.ok(lost(mark) > 0 && mm.melee < 0, id); break;
      case 'rot': case 'miasma':
        assert.ok(mark.poison && mark.poison.left === (d.n ?? 2), `${id}: poisoned`);
        if (id === 'miasma') assert.ok(near.poison, 'miasma: beside it too');
        break;
      case 'chain':
        assert.ok(lost(mark) > 0 && lost(near) > 0 && lost(far) === 0, 'chain: leaps to the one beside, not across the deck');
        assert.ok(lost(near) < lost(mark), 'chain: lighter each leap');
        break;
      case 'fireball': case 'firepot':
        assert.ok(lost(mark) > 0 && lost(near) > 0 && lost(far) === 0, `${id}: the splash takes the hexes beside the mark only`);
        assert.ok(lost(mate) === 0 && lost(me) === 0, `${id}: not her own`);
        if (id === 'firepot') assert.equal(bt.cells[before.get(mark.id)!.hex], 'F', 'firepot: the deck burns');
        break;
      case 'cone': assert.ok(lost(mark) > 0 && lost(far) === 0, id); break;
      case 'pierce': assert.ok(lost(mark) > 0 && lost(near) > 0 && lost(far) === 0, 'pierce: the line through both'); break;
      case 'volley': assert.ok([mark, near, far].filter((x) => lost(x) > 0).length >= 2 && me.shots === me.shotsMax - 1, id); break;
      case 'aimed': assert.ok(lost(mark) > 0 && me.shots === me.shotsMax - 1, id); break;
      case 'drain': case 'devour':
        assert.ok(lost(mark) > 0 && hpOf(me) > before.get(me.id)!.hp, `${id}: drinks`);
        assert.ok(!bt.log.some((e) => e.k === 'ret' && e.s === mark.id), `${id}: unanswered`);
        break;
      case 'grapple':
        assert.ok(hexNeighbors(me.hex).includes(mark.hex), 'grapple: hauled to her side');
        assert.equal(bt.active, me.id, 'grapple: her turn goes on, to strike');
        break;
      case 'tidal': assert.ok(hexDist(me.hex, mark.hex) > hexDist(me.hex, before.get(mark.id)!.hex) && lost(mark) > 0, 'tidal: thrown back'); break;
      case 'blink':
        assert.equal(me.hex, hex);
        break;
      case 'summon': {
        assert.equal(bt.stacks.length, n0 + 1);
        const s2 = bt.stacks[bt.stacks.length - 1];
        assert.ok(s2.summoned && s2.side === 0 && s2.hex === hex && s2.count > 0, 'summon: a stack beside her');
        break;
      }
    }
    // only once: her turn again, the ability is spent
    if (!bt.over && me.count > 0) {
      bt.active = me.id;
      me.stepped = 0;
      assert.match(String(act(bt, 0, { a: 'skill', ...(target !== undefined ? { target } : {}), ...(hex !== undefined ? { hex } : {}) }, 0, new Rng(4))), /spent/, `${id}: once`);
      assert.equal(viewOf(bt, 0, 0, false).skillAim, undefined, `${id}: no aim once spent`);
    }
  }
});

test('the great ones and the dead shrug off what they are proof against', () => {
  const { bt, me, mark } = arena(holderOf('fear'), 'drowned');
  assert.ok(!(skillTargets(bt, me) ?? []).includes(mark.id), 'the dead are no mark for fear');
  const s2 = arena(holderOf('stun'), 'titan_turtle');
  assert.equal(act(s2.bt, 0, { a: 'skill', target: s2.mark.id }, 0, new Rng(1)), null);
  assert.ok(!s2.mark.skip, 'a titan is not stunned');
  assert.ok(s2.bt.log.some((e) => e.k === 'skill' && e.res?.includes(s2.mark.id)), 'told as shrugged off');
});

test('the powder keg goes off by itself as its stack falls: every foe beside it takes the blast', () => {
  const { bt, me, mark, far } = arena(holderOf('death_blast'), 'marine', { gap: 1 });
  assert.equal(skillTargets(bt, me), null, 'no button');
  const was = hpOf(mark), farWas = hpOf(far);
  // her turn passes; a blow fells her
  bt.active = mark.id;
  me.count = 1;
  me.hpTop = 1;
  assert.equal(act(bt, 1, { a: 'attack', target: me.id, from: mark.hex }, 0, new Rng(2)), null);
  assert.equal(me.count, 0);
  assert.ok(me.skillUsed && bt.log.some((e) => e.k === 'skill' && e.id === 'death_blast'), 'it went off');
  assert.ok(hpOf(mark) < was, 'the one beside it took the blast');
  assert.equal(hpOf(far), farWas, 'the far one did not');
});

test('a summoned stack is nobody\'s men: its fallen are no ship\'s losses', () => {
  const { bt, me } = arena(holderOf('summon'));
  const aim = skillTargets(bt, me)!;
  act(bt, 0, { a: 'skill', hex: aim[0] }, 0, new Rng(1));
  const s2 = bt.stacks.find((s) => s.summoned)!;
  s2.count = 0;
  assert.ok(!lossesOf(bt, 0).some((x) => x.u === s2.unit && s2.unit !== me.unit), 'not among her losses');
});

test('ranged: a shot draws no answer, a shooter strikes half as hard in melee, its charges run out', () => {
  for (const u of Object.keys(RANGED_KINDS) as UnitId[]) {
    const { bt, me, mark } = arena(u, 'marine', { gap: 3, hurt: false });
    const shots = me.shots;
    assert.ok(shots > 0, u);
    assert.equal(act(bt, 0, { a: 'shoot', target: mark.id }, 0, new Rng(5)), null, `${u} shoots`);
    assert.equal(me.shots, shots - 1, `${u}: a charge spent`);
    assert.ok(!bt.log.some((e) => e.k === 'ret'), `${u}: no answer to a shot`);
    assert.ok(mark.ret, `${u}: the mark keeps its answer`);
    // beside a foe: no shot, and her blow halved
    const near = arena(u, 'marine', { gap: 1, hurt: false });
    assert.equal(viewOf(near.bt, 0, 0, false).shoot.length, 0, `${u}: no room to shoot at arm's length`);
    const melee = blowParts(near.bt, near.me, near.mark, 'melee', near.me.hex).mul;
    near.me.sp = near.me.sp.filter((x) => x !== 'shooter');
    const bare = blowParts(near.bt, near.me, near.mark, 'melee', near.me.hex).mul;
    assert.ok(Math.abs(melee / bare - 0.5) < 1e-9, `${u}: half in melee`);
  }
});

test('a bomb splashes: the phoenix\'s fire bolt takes the stacks beside the mark too', () => {
  const { bt, mark, near, far } = arena('ember_phoenix', 'marine', { gap: 3, hurt: false });
  const n0 = hpOf(near), f0 = hpOf(far);
  act(bt, 0, { a: 'shoot', target: mark.id }, 0, new Rng(5));
  assert.ok(hpOf(near) < n0 && hpOf(far) === f0);
});

test('the sea\'s mind gives the abilities, sensibly', () => {
  const used = new Set<SkillId>();
  for (const [u, id] of Object.entries(UNIT_SKILL) as [UnitId, SkillId][]) {
    for (let seed = 1; seed <= 3 && !used.has(id); seed++) {
      const n = Math.max(3, Math.round(500 / UNITS[u].hp));
      const bt = newBattle(side([{ u, n }, { u: 'marine', n: 25 }, { u: 'musketeer', n: 20 }], { human: false }), side([{ u: 'marine', n: 30 }, { u: 'musketeer', n: 25 }, { u: 'boarder', n: 12 }, { u: 'gunner', n: 10 }], { human: false }), seed, 0, new Rng(seed), { len: 'board', level: 20 });
      quickFinish(bt, 0, new Rng(seed + 50));
      if (bt.stacks.some((s) => s.unit === u && s.skillUsed)) used.add(id);
    }
  }
  const missed = SKILL_IDS.filter((id) => !used.has(id) && SKILLS[id].aim !== 'death');
  // (a cleanse needs a stack of hers under a foe's hold: none of these foes lays one)
  assert.ok(missed.every((id) => id === 'cleanse'), `never given: ${missed.join(', ')}`);
  // a heal waits for the wounded: at full strength the healer strikes instead
  const { bt, me, mate } = arena(holderOf('mass_mend'), 'marine', { hurt: false });
  void mate;
  bt.heroes[0].input.human = false;
  const c = aiChoice(bt, new Rng(1));
  assert.notEqual(c.a, 'skill', 'no heal at full strength');
  me.count = Math.max(1, Math.ceil(me.count / 3));
  for (const s of bt.stacks) if (s.side === 0) s.count = Math.max(1, Math.ceil(s.count / 3));
  assert.equal(aiChoice(bt, new Rng(1)).a, 'skill', 'a heal when her side is cut');
});

test('a battle with abilities, recorded, plays again the same (save and load of the battle)', () => {
  for (const seed of [3, 11, 19]) {
    const a = side([{ u: 'storm_witch', n: 20 }, { u: 'crown_surgeon', n: 30 }, { u: 'lantern_maw', n: 6 }, { u: 'crab_queen', n: 8 }], { human: false });
    const b = side([{ u: 'crown_rocketeer', n: 16 }, { u: 'ghost_bosun', n: 40 }, { u: 'petardier', n: 14 }, { u: 'marine', n: 30 }], { human: false });
    const rng = new Rng(seed ^ 0x7ac7);
    const bt = newBattle(a, b, seed, 0, rng, { len: 'board', record: true });
    for (let i = 0; i < 4000 && !bt.over; i++) aiAct(bt, 0, rng);
    assert.ok(bt.over, 'over');
    assert.ok(bt.stacks.some((s) => s.skillUsed), 'abilities were given');
    const rec = recFromJson(recToJson(bt.rec!))!;
    const again = replayBattle(rec);
    const pick = (x: TacBattle) => x.stacks.map((s) => [s.id, s.unit, s.count, s.hex, !!s.skillUsed, s.skip ?? 0, !!s.summoned]);
    assert.deepEqual(pick(again), pick(bt), `seed ${seed}: the same battle`);
    assert.deepEqual(again.over, bt.over);
    // and a battle saved mid-way as words and taken up again goes on
    const half = replayBattle({ ...rec, steps: rec.steps.slice(0, Math.floor(rec.steps.length / 2)) });
    const copy = JSON.parse(JSON.stringify(half)) as TacBattle;
    assert.deepEqual(copy.stacks.map((s) => [s.skill ?? null, !!s.skillUsed]), half.stacks.map((s) => [s.skill ?? null, !!s.skillUsed]));
  }
});

test('the view: her stack\'s ability on its card, its aim for her turn only', () => {
  const { bt, me, mark } = arena(holderOf('freeze'));
  const v = viewOf(bt, 0, 0, false);
  const sv = v.stacks.find((s) => s.id === me.id)!;
  assert.deepEqual(sv.skill, { id: 'freeze', ready: true });
  assert.ok(v.skillAim?.includes(mark.id));
  assert.equal(viewOf(bt, 1, 0, false).skillAim, undefined, 'not on the other screen');
  act(bt, 0, { a: 'skill', target: mark.id }, 0, new Rng(1));
  const v2 = viewOf(bt, 1, 0, false);
  assert.ok(v2.stacks.find((s) => s.id === mark.id)!.held?.includes('freeze'), 'the hold shown on her');
});

test('the words: every ability named and told in RU and EN, its numbers filled', () => {
  for (const id of SKILL_IDS) {
    for (const [lang, D] of [['en', EN], ['ru', RU]] as const) {
      const n = (D as Record<string, string>)[`n.${id}`], d = (D as Record<string, string>)[`d.${id}`];
      assert.ok(n && d, `${lang} ${id}`);
      const vars = skillVars(id);
      for (const m of d.matchAll(/\{(\w+)\}/g)) assert.ok(m[1] in vars, `${lang} ${id}: {${m[1]}}`);
      if (lang === 'ru') assert.ok(!/[A-Za-z]/.test((n + d).replace(/\{\w+\}/g, '')), `ru ${id} in Russian`);
    }
  }
  void TAC_H;
});
