// Owner, 2026-10-18 (shared/src/data/creatureskills.ts): the creatures' own abilities in the boarding battle — given
// once a battle by the stack whose turn it is (a captain's tap, the sea's mind, her auto-battle), and the one that goes
// off by itself as its stack falls. What each does, who it may be pointed at, and what the sea's mind makes of it.
// The battle (tacbattle.ts) hands its own hand in (TK): harm laid as its blows lay it, events told as its are.

import { SKILLS, SK, summonOf } from '../../../shared/src/data/creatureskills.ts';
import type { SkillDef, SkillId } from '../../../shared/src/data/creatureskills.ts';
import { UNITS, armyWeight } from '../../../shared/src/data/army.ts';
import type { BtMods } from '../../../shared/src/data/paths.ts';
import { TAC_H, TAC_W, hexDir, hexDist, hexIndex, hexNeighbors, hexX, hexY, kindOfUnit, unitResist } from '../../../shared/src/data/tactical.ts';
import type { TacAction } from '../../../shared/src/protocol.ts';
import type { Rng } from '../../../shared/src/rng.ts';
import { TK, blow, canShoot, isShooter, meleeTargets, onDeck, reachOf, stackBonus } from './tacbattle.ts';
import type { TacBattle, TacStack } from './tacbattle.ts';

const has = (s: TacStack, x: string): boolean => s.sp.includes(x as never);
/** The great ones (a legend, a titan, a great one ashore): no ability turns, binds nor moves them. */
export const isGreat = (s: TacStack): boolean => unitResist(s.unit) > 0;
const undead = (s: TacStack): boolean => has(s, 'undead');
/** Who shrugs off what a kind of ability would lay on her. */
export function immune(bt: TacBattle, id: SkillId, t: TacStack): boolean {
  const d = SKILLS[id];
  if (id === 'fear') return undead(t) || has(t, 'steady') || TK.smods(bt, t).steady || isGreat(t);
  if (id === 'siren') return undead(t) || isGreat(t);
  if (id === 'rot' || id === 'miasma') return undead(t);
  return !!d.control && isGreat(t);
}

/** Her own blow's worth (the heals are reckoned from it): her men's dice by her side's lift. */
function powOf(bt: TacBattle, s: TacStack): number {
  return ((s.count * (s.dmin + s.dmax)) / 2) * (1 + 0.05 * s.atk) * stackBonus(bt, s).melee;
}

/** The harm of her ability on `t`, `k` of her blow: a shooter's as her shot (its range, the cover), the rest as a blow
 *  straight on (no flank); `aim` a shot laid true (no range nor cover). */
function skBlow(bt: TacBattle, s: TacStack, t: TacStack, k: number, rng: Rng | null, aim = false): number {
  const shot = isShooter(s);
  const d = blow(bt, s, t, shot ? 'shot' : 'melee', rng, shot && !aim ? s.hex : t.hex).dmg;
  return Math.max(1, Math.round(d * k));
}

const foesOf = (bt: TacBattle, s: TacStack) => TK.alive(bt).filter((o) => o.side !== s.side);
const ownOf = (bt: TacBattle, s: TacStack) => TK.alive(bt).filter((o) => o.side === s.side);
const near = (bt: TacBattle, s: TacStack, hex: number, r = 1) => foesOf(bt, s).filter((o) => o.hex !== hex && hexDist(o.hex, hex) <= r);
const free = (bt: TacBattle, i: number) => i >= 0 && TK.passable(bt, i, null) && bt.cells[i] !== 'F';
/** Whether a foe's or her own hold of the abilities (and what else ails her) lies on her now. */
const ails = (bt: TacBattle, t: TacStack) => {
  const m = TK.smods(bt, t);
  return !!t.poison || !!t.skip || m.still || m.mad || m.melee < 0 || m.shot < 0 || m.speed < 0 || m.taken > 0 || m.blind;
};

/** May her ability be given now: hers, not given yet, not one that goes off by itself, not after a march; a shot's only
 *  with a charge and no foe at arm's length. */
export function skillReady(bt: TacBattle, s: TacStack): boolean {
  if (!s.skill || s.skillUsed || s.count <= 0) return false;
  const d = SKILLS[s.skill];
  if (d.aim === 'death' || s.stepped) return false;
  if (d.shot && !canShoot(bt, s)) return false;
  return true;
}

/** What it may be pointed at now: stack ids (a foe, one of her own), hexes (a leap, a summons), [] when it needs no aim;
 *  null when it cannot be given. */
export function skillTargets(bt: TacBattle, s: TacStack): number[] | null {
  if (!skillReady(bt, s)) return null;
  const id = s.skill!, d = SKILLS[id];
  const inRange = (h: number) => d.range === undefined || hexDist(s.hex, h) <= d.range;
  if (d.aim === 'enemy') {
    const out = foesOf(bt, s).filter((t) => inRange(t.hex) && !(d.control && id !== 'stun' && id !== 'tidal' && immune(bt, id, t))).map((t) => t.id);
    return out.length ? out : null;
  }
  if (d.aim === 'own') {
    const out = ownOf(bt, s).filter((t) => !(id === 'mend' && undead(t)) && !(id === 'cleanse' && !ails(bt, t)) && !((id === 'mend' || id === 'raise') && TK.hpOf(t) >= t.start * t.hpMax)).map((t) => t.id);
    return out.length ? out : null;
  }
  if (d.aim === 'hex') {
    const out: number[] = [];
    if (id === 'summon') {
      for (const j of hexNeighbors(s.hex)) if (free(bt, j)) out.push(j);
    } else for (let i = 0; i < bt.cells.length; i++) if (i !== s.hex && inRange(i) && free(bt, i)) out.push(i);
    return out.length ? out : null;
  }
  if (id === 'taunt' || id === 'toll') return near(bt, s, s.hex, d.range ?? 2).length ? [] : null;
  if (id === 'mass_mend') return ownOf(bt, s).some((t) => !undead(t) && TK.hpOf(t) < t.start * t.hpMax) ? [] : null;
  return [];
}

/** Why it may not be given so (null: it may). */
export function skillError(bt: TacBattle, s: TacStack, a: Extract<TacAction, { a: 'skill' }>): string | null {
  if (!s.skill || SKILLS[s.skill].aim === 'death') return 'She has no ability to give';
  if (s.skillUsed) return 'Her ability is spent';
  if (s.stepped) return 'She has marched: strike or defend';
  const ok = skillTargets(bt, s);
  if (!ok) return SKILLS[s.skill].shot ? 'No shot for it now' : 'Nothing to point it at';
  const d = SKILLS[s.skill];
  if (d.aim === 'enemy' || d.aim === 'own') return a.target !== undefined && ok.includes(a.target) ? null : 'Pick a stack it may fall on';
  if (d.aim === 'hex') return a.hex !== undefined && ok.includes(a.hex) ? null : 'Pick a free hex';
  return null;
}

/** A hold of the abilities on stack `on` (`foe`: laid by the other side), for `rounds` more rounds than this one. */
function hold(bt: TacBattle, s: TacStack, id: SkillId, on: number | undefined, mods: BtMods, foe: boolean, extra: { src?: number } = {}): void {
  const h = bt.heroes[s.side];
  TK.keepFx(h, (f) => !(f.id === `sk_${id}` && f.on === on));
  h.fx.push({ id: `sk_${id}`, until: bt.round + (SKILLS[id].rounds ?? 1), ...(on !== undefined ? { on } : {}), mods, ...(foe ? { foe: true } : {}), ...extra });
}

/** Lay `dmg` of her ability on `t` and tell it. */
function hit(bt: TacBattle, s: TacStack, t: TacStack, dmg: number): number {
  if (t.count <= 0) return 0;
  const had = TK.hpOf(t);
  const kills = TK.hurt(bt, t, dmg, s.side, s.own ?? 0);
  TK.wake(bt, t);
  TK.push(bt, { k: 'hit', side: s.side, s: s.id, t: t.id, dmg, kills, hex: t.hex, id: 'sk' });
  return had - TK.hpOf(t);
}
/** Strength back into `t`, told. */
function mendOne(bt: TacBattle, s: TacStack, t: TacStack, amount: number): number {
  const n = TK.restore(bt, t, amount);
  if (n > 0) TK.push(bt, { k: 'regen', side: t.side, s: t.id, dmg: n, hex: t.hex, id: 'sk' });
  return n;
}
/** A stack set down on `to` by an ability (pulled, pushed, leapt), told as a glide. */
function shift(bt: TacBattle, t: TacStack, to: number): void {
  const n = hexDist(t.hex, to);
  t.hex = to;
  TK.push(bt, { k: 'move', side: t.side, s: t.id, hex: to, n: Math.max(1, n), id: 'sk' });
}

/** The hex beside `at` the way `dir` lies (−1: off the field). */
function stepOf(at: number, dir: number): number {
  for (const j of hexNeighbors(at)) if (hexDir(at, j) === dir) return j;
  return -1;
}
/** The hexes from `a` on through `b` to the field's edge (a harpoon's line), `a` not among them. */
function ray(a: number, b: number): number[] {
  const cube = (i: number): [number, number] => {
    const y = hexY(i);
    return [hexX(i) - (y - (y & 1)) / 2, y];
  };
  const [aq, ar] = cube(a), [bq, br] = cube(b);
  const n = Math.max(1, hexDist(a, b));
  const out: number[] = [];
  for (let k = 1; k <= 3 * Math.max(TAC_W, TAC_H); k++) {
    const t = k / n;
    const q = aq + (bq - aq) * t + 1e-6, r = ar + (br - ar) * t + 2e-6, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    const x = rq + (rr - (rr & 1)) / 2;
    if (x < 0 || rr < 0 || x >= TAC_W || rr >= TAC_H) break;
    const i = hexIndex(x, rr);
    if (i !== a && out[out.length - 1] !== i) out.push(i);
  }
  return out;
}
/** A hex's place on the board (for a cone's angle). */
const px = (i: number) => ({ x: hexX(i) + (hexY(i) & 1) * 0.5, y: hexY(i) * 0.866 });
/** The foes a cone from `s` toward `t` takes in: within its range, within 35° of the way to her. */
function coneOf(bt: TacBattle, s: TacStack, t: TacStack): TacStack[] {
  const a = px(s.hex), b = px(t.hex);
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const out = [t];
  for (const o of foesOf(bt, s)) {
    if (o === t || hexDist(s.hex, o.hex) > (SKILLS.cone.range ?? 3)) continue;
    const c = px(o.hex);
    let d = Math.abs(Math.atan2(c.y - a.y, c.x - a.x) - dir);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d <= (35 * Math.PI) / 180) out.push(o);
  }
  return out;
}
/** A chain's leaps: from `t` on to the nearest foe not yet struck within two hexes (the most dangerous of equals). */
function chainOf(bt: TacBattle, s: TacStack, t: TacStack, hops: number): TacStack[] {
  const out = [t];
  let last = t;
  for (let k = 0; k < hops; k++) {
    const next = foesOf(bt, s).filter((o) => !out.includes(o) && hexDist(last.hex, o.hex) <= 2)
      .sort((p, q) => hexDist(last.hex, p.hex) - hexDist(last.hex, q.hex) || TK.threat(bt, q) - TK.threat(bt, p) || p.id - q.id)[0];
    if (!next) break;
    out.push(next);
    last = next;
  }
  return out;
}
/** A volley's marks: the foes worth her shot most, `n` of them. */
function volleyOf(bt: TacBattle, s: TacStack, n: number): TacStack[] {
  return foesOf(bt, s).map((t) => ({ t, v: TK.valueOf(bt, t, skBlow(bt, s, t, SKILLS.volley.blowK!, null)) })).sort((p, q) => q.v - p.v || p.t.id - q.t.id).slice(0, n).map((x) => x.t);
}

/** The heads a summons calls up: `healK` of the summoner's living might as the sea reckons an army (armyPower: hit points
 *  by blows, HoMM3's square law: armyWeight), in heads of her kin. */
export function summonCount(s: TacStack): number {
  const u = summonOf(s.unit);
  return Math.max(1, Math.round((SKILLS.summon.healK! * armyWeight([{ u: s.unit, n: s.count }])) / Math.max(0.01, armyWeight([{ u, n: 1 }]))));
}

/** Give stack `s`'s ability (the action checked first: skillError). Returns whether her turn goes on (a free one). */
export function castSkill(bt: TacBattle, s: TacStack, a: Extract<TacAction, { a: 'skill' }>, rng: Rng): boolean {
  const id = s.skill!, d = SKILLS[id];
  s.skillUsed = true;
  const r = bt.round;
  const t = a.target !== undefined ? bt.stacks.find((x) => x.id === a.target && x.count > 0) : undefined;
  const on: number[] = [];
  const res: number[] = [];
  const tell = (extra: { t?: number; hex?: number; n?: number } = {}) =>
    TK.push(bt, { k: 'skill', side: s.side, s: s.id, id, ...(t ? { t: t.id, hex: t.hex } : {}), ...extra, ...(on.length ? { on: [...on] } : {}), ...(res.length ? { res: [...res] } : {}) });
  const split = (xs: TacStack[]) => {
    for (const x of xs) (immune(bt, id, x) ? res : on).push(x.id);
  };
  if (t && t.side !== s.side) TK.turnTo(s, t.hex);
  let goOn = false;
  switch (id) {
    case 'mend':
    case 'raise':
    case 'cleanse': {
      on.push(t!.id);
      tell();
      if (id === 'cleanse') {
        // What the other side laid on her (a curse, a mark, a freeze, a bind…) is washed off.
        TK.keepFx(bt.heroes[1 - t!.side], (f) => !(f.on === t!.id && f.foe));
        delete t!.poison;
        t!.skip = 0;
      }
      mendOne(bt, s, t!, Math.min(d.cap! * t!.start * t!.hpMax, d.healK! * powOf(bt, s)));
      break;
    }
    case 'mass_mend': {
      const xs = ownOf(bt, s).filter((x) => !undead(x));
      on.push(...xs.map((x) => x.id));
      tell();
      const P = d.healK! * powOf(bt, s);
      for (const x of xs) mendOne(bt, s, x, Math.min(d.cap! * x.start * x.hpMax, P));
      break;
    }
    case 'ward':
      on.push(t!.id);
      tell();
      hold(bt, s, id, t!.id, { taken: SK.ward }, false);
      break;
    case 'bulwark':
      on.push(s.id);
      tell({ hex: s.hex });
      hold(bt, s, id, s.id, { taken: SK.bulwark, steady: true }, false);
      break;
    case 'haste':
      on.push(t!.id);
      tell();
      hold(bt, s, id, t!.id, { ...SK.haste }, false);
      goOn = t === s;
      break;
    case 'rally':
    case 'toast': {
      on.push(...ownOf(bt, s).map((x) => x.id));
      tell({ hex: s.hex });
      hold(bt, s, id, undefined, id === 'rally' ? { ...SK.rally } : { ...SK.toast }, false);
      break;
    }
    case 'frenzy':
      on.push(s.id);
      tell({ hex: s.hex });
      hold(bt, s, id, s.id, { ...SK.frenzy }, false);
      goOn = true;
      break;
    case 'fear':
    case 'stun': {
      split([t!]);
      tell();
      if (id === 'stun') hit(bt, s, t!, skBlow(bt, s, t!, d.blowK!, rng));
      if (!immune(bt, id, t!) && t!.count > 0) t!.skip = Math.min(1, (t!.skip ?? 0) + 1);
      break;
    }
    case 'freeze':
    case 'siren':
    case 'curse':
    case 'mark': {
      split([t!]);
      tell();
      if (!res.length) hold(bt, s, id, t!.id, id === 'freeze' ? { still: true, ...SK.freeze } : id === 'siren' ? { mad: true } : id === 'curse' ? { melee: SK.curse, shot: SK.curse } : { taken: SK.mark }, true);
      break;
    }
    case 'slow':
    case 'ink':
    case 'entangle': {
      const xs = id === 'entangle' ? [t!] : [t!, ...near(bt, s, t!.hex)];
      split(xs);
      tell();
      for (const x of xs) {
        if (d.blowK) hit(bt, s, x, skBlow(bt, s, x, x === t ? d.blowK : d.ringK ?? d.blowK, rng));
        if (x.count > 0 && !immune(bt, id, x)) hold(bt, s, id, x.id, id === 'slow' ? { ...SK.slow } : id === 'ink' ? { ...SK.ink } : { speed: -20 }, true);
      }
      break;
    }
    case 'taunt': {
      const xs = near(bt, s, s.hex, d.range ?? 3);
      on.push(...xs.map((x) => x.id));
      tell({ hex: s.hex });
      for (const x of xs) hold(bt, s, id, x.id, {}, true, { src: s.id });
      TK.keepFx(bt.heroes[s.side], (f) => !(f.id === 'sk_taunt_self' && f.on === s.id));
      bt.heroes[s.side].fx.push({ id: 'sk_taunt_self', until: r + 1, on: s.id, mods: { taken: SK.taunt.taken } });
      break;
    }
    case 'toll': {
      const xs = near(bt, s, s.hex, d.range ?? 2);
      on.push(...xs.map((x) => x.id));
      tell({ hex: s.hex });
      for (const x of xs) {
        hit(bt, s, x, skBlow(bt, s, x, d.blowK!, rng));
        if (x.count > 0) hold(bt, s, id, x.id, { melee: SK.toll }, true);
      }
      break;
    }
    case 'rot':
    case 'miasma': {
      const xs = id === 'rot' ? [t!] : [t!, ...near(bt, s, t!.hex)];
      split(xs);
      tell();
      for (const x of xs) if (!immune(bt, id, x)) x.poison = { dmg: skBlow(bt, s, x, d.blowK!, rng), left: d.n ?? 2, by: s.side, ...(s.own ? { who: s.own } : {}) };
      break;
    }
    case 'chain': {
      const xs = chainOf(bt, s, t!, d.n ?? 3);
      on.push(...xs.map((x) => x.id));
      tell();
      let k = d.blowK!;
      for (const x of xs) {
        hit(bt, s, x, skBlow(bt, s, x, k, rng));
        k *= d.ringK ?? 0.7;
      }
      break;
    }
    case 'fireball':
    case 'firepot': {
      const xs = [t!, ...near(bt, s, t!.hex)];
      on.push(...xs.map((x) => x.id));
      const hex = t!.hex;
      tell();
      for (const x of xs) hit(bt, s, x, skBlow(bt, s, x, x === t ? d.blowK! : d.ringK!, rng));
      // The fire pot sets the deck alight where it broke (a boarding's deck only): whoever stands in it burns.
      if (id === 'firepot' && onDeck(bt) && (bt.cells[hex] === '.' || bt.cells[hex] === '=')) bt.cells[hex] = 'F';
      break;
    }
    case 'cone': {
      const xs = coneOf(bt, s, t!);
      on.push(...xs.map((x) => x.id));
      tell();
      for (const x of xs) hit(bt, s, x, skBlow(bt, s, x, d.blowK!, rng));
      break;
    }
    case 'pierce': {
      const line = ray(s.hex, t!.hex);
      const xs = line.map((h) => foesOf(bt, s).find((o) => o.hex === h)).filter((o): o is TacStack => !!o);
      on.push(...xs.map((x) => x.id));
      tell({ n: line[line.length - 1] });
      xs.forEach((x, i) => hit(bt, s, x, skBlow(bt, s, x, i ? d.ringK! : d.blowK!, rng)));
      break;
    }
    case 'volley': {
      const xs = volleyOf(bt, s, d.n ?? 3);
      on.push(...xs.map((x) => x.id));
      s.shots--;
      tell({ hex: s.hex });
      for (const x of xs) hit(bt, s, x, skBlow(bt, s, x, d.blowK!, rng));
      break;
    }
    case 'aimed':
      on.push(t!.id);
      s.shots--;
      tell();
      hit(bt, s, t!, skBlow(bt, s, t!, d.blowK!, rng, true));
      break;
    case 'drain':
    case 'devour': {
      on.push(t!.id);
      tell();
      const dealt = hit(bt, s, t!, skBlow(bt, s, t!, d.blowK!, rng));
      if (!undead(t!)) mendOne(bt, s, s, dealt * d.healK!);
      break;
    }
    case 'grapple': {
      split([t!]);
      tell();
      hit(bt, s, t!, skBlow(bt, s, t!, d.blowK!, rng));
      if (t!.count > 0 && !res.length && !hexNeighbors(s.hex).includes(t!.hex)) {
        // Hauled in along the line to her: to the free hex nearest her on it.
        let to = -1;
        for (const h of ray(t!.hex, s.hex)) {
          if (h === s.hex) break;
          if (free(bt, h)) to = h;
        }
        if (to < 0) for (const h of hexNeighbors(s.hex)) if (free(bt, h) && (to < 0 || hexDist(h, t!.hex) < hexDist(to, t!.hex))) to = h;
        if (to >= 0 && hexDist(to, s.hex) < hexDist(t!.hex, s.hex)) shift(bt, t!, to);
      }
      s.stepped = Math.max(1, s.speed + 9);
      goOn = meleeTargets(bt, s).length > 0;
      break;
    }
    case 'tidal': {
      const xs = [t!, ...near(bt, s, t!.hex)];
      split(xs);
      tell();
      for (const x of xs) hit(bt, s, x, skBlow(bt, s, x, x === t ? d.blowK! : d.ringK!, rng));
      // The wave throws them a hex back from her (the farthest first, so the nearer have room).
      for (const x of [...xs].sort((p, q) => hexDist(s.hex, q.hex) - hexDist(s.hex, p.hex))) {
        if (x.count <= 0 || immune(bt, id, x)) continue;
        const to = stepOf(x.hex, hexDir(s.hex, x.hex));
        if (to >= 0 && free(bt, to)) shift(bt, x, to);
      }
      break;
    }
    case 'blink': {
      on.push(s.id);
      tell({ hex: a.hex });
      shift(bt, s, a.hex!);
      s.stepped = Math.max(1, s.speed + 9);
      goOn = meleeTargets(bt, s).length > 0;
      break;
    }
    case 'summon': {
      const u = summonOf(s.unit), def = UNITS[u];
      const n = summonCount(s);
      const id2 = Math.max(...bt.stacks.map((x) => x.id)) + 1;
      const st: TacStack = {
        id: id2, side: s.side, kind: kindOfUnit(u), unit: u, sp: [...def.specials], src: u, count: n, start: n, hpTop: def.hp, hpMax: def.hp, hex: a.hex!,
        atk: def.atk, def: def.def, dmin: def.dmin, dmax: def.dmax, speed: def.speed, init: def.init, shots: def.shots, shotsMax: def.shots, dmgMul: 1,
        ret: true, defending: false, waited: false, surged: false, again: 0, face: s.face, summoned: true, ...(s.own ? { own: s.own } : {}),
      };
      bt.stacks.push(st);
      if (bt.tally) bt.tally[id2] = { dealt: 0, taken: 0, kills: 0 };
      on.push(id2);
      tell({ hex: a.hex, n });
      break;
    }
    default:
      tell();
  }
  TK.checkOver(bt);
  return goOn && !bt.over && s.count > 0;
}

/** The ability that goes off by itself (owner: «explode on death»): a powder cask, a boiler, a petard — as its stack
 *  falls, every foe beside it takes `blowK` of half the stack's blow as it came aboard. */
export function deathBlast(bt: TacBattle, t: TacStack): void {
  if (t.skill !== 'death_blast' || t.skillUsed) return;
  t.skillUsed = true;
  const xs = TK.alive(bt).filter((o) => o.side !== t.side && hexNeighbors(t.hex).includes(o.hex));
  TK.push(bt, { k: 'skill', side: t.side, s: t.id, id: 'death_blast', hex: t.hex, ...(xs.length ? { on: xs.map((x) => x.id) } : {}) });
  if (!xs.length) return;
  const was = t.count;
  t.count = Math.max(1, Math.ceil(t.start / 2));
  const dmgs = xs.map((o) => Math.max(1, Math.round(blow(bt, t, o, 'melee', null, o.hex).dmg * SKILLS.death_blast.blowK!)));
  t.count = was;
  xs.forEach((o, i) => {
    if (o.count <= 0) return;
    const kills = TK.hurt(bt, o, dmgs[i], t.side, t.own ?? 0);
    TK.wake(bt, o);
    TK.push(bt, { k: 'hit', side: t.side, s: t.id, t: o.id, dmg: dmgs[i], kills, hex: o.hex, id: 'sk' });
  });
}

// ------------------------------------------------------------------ the sea's mind

/** What the sea's mind gives up for the ability: her best blow or shot now, worth to her (0: none in reach). */
function bestBlow(bt: TacBattle, s: TacStack): number {
  if (canShoot(bt, s)) return Math.max(0, ...foesOf(bt, s).map((t) => TK.valueOf(bt, t, blow(bt, s, t, 'shot', null).dmg)));
  const reach = reachOf(bt, s);
  return Math.max(0, ...meleeTargets(bt, s, reach).map((t) => TK.valueOf(bt, t, blow(bt, s, t, 'melee', null, t.hex).dmg * (has(s, 'double_strike') ? 2 : 1))));
}

/** The ability's worth to the sea's mind on target `x` (a stack id or a hex; none), as her blows are weighed (valueOf: a
 *  share of a foe's threat), and whether it is worth giving at all. */
function worthOf(bt: TacBattle, s: TacStack, x: number | undefined): number {
  const id = s.skill!, d = SKILLS[id];
  const t = x !== undefined && d.aim !== 'hex' ? bt.stacks.find((o) => o.id === x) : undefined;
  const dmgV = (o: TacStack, k: number, aim = false) => TK.valueOf(bt, o, skBlow(bt, s, o, k, null, aim));
  const healV = (o: TacStack, amount: number) => (Math.min(amount, o.start * o.hpMax - TK.hpOf(o)) / Math.max(1, o.start * o.hpMax)) * TK.threat(bt, o) * 2;
  const thr = (o: TacStack) => TK.threat(bt, o);
  const P = powOf(bt, s);
  switch (id) {
    case 'mend':
    case 'raise':
      return t ? healV(t, Math.min(d.cap! * t.start * t.hpMax, d.healK! * P)) : 0;
    case 'cleanse':
      return t && ails(bt, t) ? thr(t) * 0.6 + healV(t, Math.min(d.cap! * t.start * t.hpMax, d.healK! * P)) : 0;
    case 'mass_mend':
      return ownOf(bt, s).filter((o) => !undead(o)).reduce((n, o) => n + healV(o, Math.min(d.cap! * o.start * o.hpMax, d.healK! * P)), 0);
    case 'ward':
      return t && (near(bt, t, t.hex).length || foesOf(bt, t).some((o) => isShooter(o) && o.shots > 0)) ? thr(t) * 0.45 : 0;
    case 'bulwark':
      return near(bt, s, s.hex).length ? thr(s) * 0.5 : 0;
    case 'haste':
      // her own steel that cannot reach a foe yet, early in the fight
      if (!t || isShooter(t) || near(bt, t, t.hex).length) return 0;
      return t === s ? (!meleeTargets(bt, s).length ? thr(s) * 0.5 : 0) : bt.round <= 2 ? thr(t) * 0.5 : thr(t) * 0.2;
    case 'rally':
    case 'toast':
      return ownOf(bt, s).reduce((n, o) => n + thr(o), 0) * (bt.round <= 2 ? 0.14 : 0.05);
    case 'frenzy':
      return meleeTargets(bt, s).length ? thr(s) * 0.5 : 0;
    case 'fear':
    case 'siren':
    case 'freeze':
      return t && !immune(bt, id, t) && !t.skip ? thr(t) * (id === 'siren' ? 1.2 : 0.9) : 0;
    case 'stun':
      return t ? dmgV(t, d.blowK!) + (immune(bt, id, t) || t.skip ? 0 : thr(t) * 0.9) : 0;
    case 'curse':
      return t ? thr(t) * 0.55 : 0;
    case 'mark':
      return t ? thr(t) * 0.25 + (TK.hpOf(t) / Math.max(1, ...foesOf(bt, s).map(TK.hpOf))) * thr(t) * 0.35 : 0;
    case 'ink':
    case 'slow':
    case 'entangle': {
      if (!t) return 0;
      const xs = id === 'entangle' ? [t] : [t, ...near(bt, s, t.hex)];
      return xs.reduce((n, o) => n + (immune(bt, id, o) ? 0 : thr(o) * (id === 'ink' ? (isShooter(o) && o.shots > 0 ? 0.6 : 0.2) : isShooter(o) ? 0.05 : 0.45)) + (d.blowK ? dmgV(o, o === t ? d.blowK : d.ringK ?? d.blowK) : 0), 0);
    }
    case 'taunt':
      // the foes about her held on her, off her shooters and her weaker stacks
      return near(bt, s, s.hex, d.range ?? 3).reduce((n, o) => n + thr(o) * (ownOf(bt, s).some((x) => isShooter(x) && x.shots > 0) ? 0.4 : 0.25), 0);
    case 'toll':
      return near(bt, s, s.hex, d.range ?? 2).reduce((n, o) => n + dmgV(o, d.blowK!) + thr(o) * 0.1, 0);
    case 'rot':
    case 'miasma': {
      if (!t) return 0;
      const xs = id === 'rot' ? [t] : [t, ...near(bt, s, t.hex)];
      return xs.reduce((n, o) => n + (immune(bt, id, o) || o.poison ? 0 : TK.valueOf(bt, o, skBlow(bt, s, o, d.blowK!, null) * (d.n ?? 2)) * 0.85), 0);
    }
    case 'chain': {
      if (!t) return 0;
      let k = d.blowK!;
      return chainOf(bt, s, t, d.n ?? 3).reduce((n, o) => {
        const v = dmgV(o, k);
        k *= d.ringK ?? 0.7;
        return n + v;
      }, 0);
    }
    case 'fireball':
    case 'firepot':
    case 'tidal':
      return t ? [t, ...near(bt, s, t.hex)].reduce((n, o) => n + dmgV(o, o === t ? d.blowK! : d.ringK!), 0) : 0;
    case 'cone':
      return t ? coneOf(bt, s, t).reduce((n, o) => n + dmgV(o, d.blowK!), 0) : 0;
    case 'pierce': {
      if (!t) return 0;
      const xs = ray(s.hex, t.hex).map((h) => foesOf(bt, s).find((o) => o.hex === h)).filter((o): o is TacStack => !!o);
      return xs.reduce((n, o, i) => n + dmgV(o, i ? d.ringK! : d.blowK!), 0);
    }
    case 'volley':
      return volleyOf(bt, s, d.n ?? 3).reduce((n, o) => n + dmgV(o, d.blowK!), 0);
    case 'aimed':
      return t ? dmgV(t, d.blowK!, true) : 0;
    case 'drain':
    case 'devour':
      return t ? dmgV(t, d.blowK!) * (undead(t) ? 1 : 1.25) : 0;
    case 'grapple':
      return t && !hexNeighbors(s.hex).includes(t.hex) && !isShooter(s) ? dmgV(t, d.blowK!) + thr(t) * (isShooter(t) ? 0.6 : 0.25) : 0;
    case 'blink': {
      if (meleeTargets(bt, s).length || isShooter(s) || x === undefined) return 0;
      const by = foesOf(bt, s).filter((o) => hexNeighbors(x).includes(o.hex));
      return by.length ? Math.max(...by.map(thr)) * 0.5 : 0;
    }
    case 'summon': {
      // the stack it calls up, weighed as the battle weighs a stack's threat, for the rounds it will fight
      const m = UNITS[summonOf(s.unit)];
      const n = summonCount(s);
      return ((n * (m.dmin + m.dmax)) / 2) * (m.atk / 5) * (m.specials.includes('shooter') ? 1.4 : 1) * (bt.round <= 3 ? 1.6 : 1);
    }
    default:
      return 0;
  }
}

/** The abilities whose worth is a hold or a turn (not harm at once): given against a lesser share of her blow, as an
 *  order is — what they do lasts. */
const HOLDS: ReadonlySet<SkillId> = new Set(['mend', 'mass_mend', 'raise', 'haste', 'rally', 'toast', 'ward', 'bulwark', 'taunt', 'entangle', 'slow', 'curse', 'mark', 'ink', 'fear', 'freeze', 'siren', 'toll', 'stun', 'cleanse']);

/** Owner, 2026-10-18: the sea's mind (and a captain's auto-battle) gives a stack's ability when it is worth her blow —
 *  the heal when her stacks are cut, the fear on the most dangerous foe, the fireball where they stand close, the leap
 *  when no foe is in reach — and a free one (a fury, a leap, a hook) whenever it helps her blow. */
export function aiSkillChoice(bt: TacBattle, s: TacStack): TacAction | null {
  const aims = skillTargets(bt, s);
  if (!aims) return null;
  const d = SKILLS[s.skill!];
  let best: number | undefined, bv = 0;
  for (const x of aims.length ? aims : [undefined]) {
    const v = worthOf(bt, s, x);
    if (v > bv + 1e-9) {
      bv = v;
      best = x;
    }
  }
  if (!(bv > 0)) return null;
  const blowV = bestBlow(bt, s);
  // A free one costs her nothing of her turn; the rest are given when worth most of her best blow (a heal, a hold or a
  // spell weighed as her blows are), or whenever she has no blow to give.
  if (!d.free && blowV > 0 && bv < blowV * (HOLDS.has(s.skill!) ? 0.6 : 0.9)) return null;
  // No blow in reach: steel that could march on the foe instead gives it only when it is worth a good share of her own
  // threat (the march it costs her).
  if (!d.free && blowV <= 0 && !isShooter(s) && reachOf(bt, s).size > 0 && bv < TK.threat(bt, s) * 0.3) return null;
  const act: TacAction = { a: 'skill' };
  if (d.aim === 'hex') act.hex = best;
  else if (best !== undefined) act.target = best;
  return act;
}

/** For the docs' table and the tests: an ability's numbers as words read them. */
export function skillNumbers(d: SkillDef): Record<string, number> {
  const pc = (x: number) => Math.round(x * 100);
  return {
    ...(d.blowK ? { k: pc(d.blowK) } : {}), ...(d.ringK ? { ring: pc(d.ringK) } : {}), ...(d.healK ? { heal: pc(d.healK) } : {}), ...(d.cap ? { cap: pc(d.cap) } : {}),
    ...(d.range ? { range: d.range } : {}), ...(d.n ? { n: d.n } : {}), ...(d.rounds !== undefined ? { rounds: d.rounds + 1 } : {}),
  };
}

