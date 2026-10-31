// The ship's ring and its hail (owner, 2026-11-01, a merchant «Старая десятина» whose ring was ⓘ and «Нанять» only:
// «мне нужно нападение, то есть атаковать или поговорить, применяется ко всем кораблям… нанять и все это бред ваще»).
//  - every ship: «Атаковать» (lawful — the guns; under colours that forbid it — dimmed, a tap says why, nothing sent);
//  - every ship with men who talk: «Поговорить» → the hail (the hire inside, the pirate's talks, a captain's whisper);
//  - the deep's: «Атаковать» alone; «На абордаж» only within 100 m and only lawful; no top-level «Нанять» anywhere.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang } from '../client/src/i18n.ts';
import { attackNoFlag, attackNoText, canTalk, hailOptions, shipRing } from '../client/src/ui/hail.ts';
import type { HailFacts, RingFacts } from '../client/src/ui/hail.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { PEACE_SAY } from '../shared/src/data/colours.ts';
import { serverText } from '../client/src/lang/server.ts';

setLang('ru');
/** The dictionaries set non-breaking spaces after short words: compare as plain text. */
const sp = (t: string) => t.replace(/[   ]/g, ' ');
const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8').replace(/\r/g, '');
const ring = (f: Partial<RingFacts>) => shipRing({ kind: 'peaceful', isPlayer: false, attackOk: false, boardNow: false, struck: false, running: null, ...f });
const ids = (f: Partial<RingFacts>) => ring(f).map((c) => `${c.id}${c.off ? '(off)' : ''}`);
const hail = (f: Partial<HailFacts>) => hailOptions({ kind: 'peaceful', isPlayer: false, name: 'Старая десятина', npcRole: 'merchant', hostile: false, hirable: true, ...f });

test('a merchant under the city flag: «Атаковать» (dimmed, refused with why) and «Поговорить» — no «Нанять» at the top', () => {
  const r = ring({ attackOk: false, boardNow: true });
  assert.deepEqual(r.map((c) => c.id), ['fight', 'talk']);
  assert.equal(r[0].label, 'Атаковать');
  assert.equal(r[0].off, true, 'seen, dimmed');
  assert.equal(r[1].label, 'Поговорить');
  assert.ok(!r.some((c) => (c.id as string) === 'hire' || /Нанять/.test(c.label)), 'no top-level «Нанять»');
  assert.ok(!r.some((c) => c.id === 'board'), 'no «На абордаж» when the attack is not lawful, even alongside');
  // the refusal: the owner's words, and the flag card is the way out
  assert.equal(sp(attackNoText('peace')), 'Нападение на мирное судно — только под пиратским флагом. Флаг меняется в порту.');
  assert.equal(attackNoFlag('peace'), true);
  assert.match(serverText(PEACE_SAY), /пиратск/);
  // talk: the hire lives here
  const h = hail({});
  assert.deepEqual(h.map((o) => o.id), ['hire', 'pass']);
  assert.equal(sp(h[0].label), 'Нанять в охрану');
  assert.equal(sp(h.at(-1)!.label), 'Пропустить');
});

test('the same merchant under the pirate flag: «Атаковать» lit (the guns), «На абордаж» only within 100 m', () => {
  assert.deepEqual(ids({ attackOk: true }), ['fight', 'talk']);
  assert.deepEqual(ids({ attackOk: true, boardNow: true }), ['fight', 'board', 'talk']);
  assert.equal(ring({ attackOk: true, running: 'guns' })[0].on, true);
  assert.equal(ring({ attackOk: true })[0].off, undefined);
});

test('the deep: «Атаковать» alone; nobody to talk to', () => {
  assert.deepEqual(ids({ kind: 'deep', attackOk: true, boardNow: true }), ['fight']);
  assert.equal(canTalk({ kind: 'deep', isPlayer: false }), false);
  assert.deepEqual(hailOptions({ kind: 'deep', isPlayer: false, name: 'x', hostile: true, hirable: false }), []);
});

test('a pirate: «Атаковать» + «Поговорить» with the talks inside (lit while he fires on her)', () => {
  assert.deepEqual(ids({ kind: 'pirate', attackOk: true }), ['fight', 'talk']);
  const firing = hail({ kind: 'pirate', npcRole: 'pirate', hostile: true, hirable: false });
  assert.deepEqual(firing.map((o) => o.id), ['parley', 'pass']);
  assert.equal(firing[0].off, undefined);
  assert.match(firing[0].label, /Переговоры/);
  const quiet = hail({ kind: 'pirate', npcRole: 'pirate', hostile: false, hirable: true });
  assert.deepEqual(quiet.map((o) => o.id), ['parley', 'hire', 'pass']);
  assert.ok(quiet[0].off, 'the talks shown, dimmed: he holds his fire');
});

test('a patrol and a fisher talk too; a captain: whisper, card, invite; a captain’s escort: ⓘ only', () => {
  assert.deepEqual(hail({ npcRole: 'patrol', hirable: true }).map((o) => o.id), ['hire', 'pass']);
  assert.deepEqual(hail({ npcRole: 'patrol', hostile: true, hirable: false }).map((o) => o.id), ['parley', 'pass']);
  assert.deepEqual(hail({ npcRole: 'fisher' }).map((o) => o.id), ['hire', 'pass']);
  assert.deepEqual(ids({ kind: 'captain', isPlayer: true }), ['fight(off)', 'talk']);
  assert.equal(attackNoFlag('colours'), true);
  assert.deepEqual(hailOptions({ kind: 'captain', isPlayer: true, name: 'Анна', hostile: false, hirable: false, canInvite: true }).map((o) => o.id), ['whisper', 'inspect', 'invite', 'pass']);
  assert.deepEqual(ring({ kind: 'captain', isPlayer: false }), []);
});

test('the bottom bar mirrors the ring: «Атаковать», «Поговорить», «Плыть к нему» — no «Нанять», no «Осмотреть» on its own', () => {
  const acts = buildActs({ sel: { kind: 'ship', name: 'Старая десятина', far: 400, go: true, attackNo: true, talk: true }, repair: { repairing: false, combat: false, hurt: true } });
  const labels = acts.map((a) => sp(a.label));
  assert.deepEqual(labels.slice(0, 3), ['Атаковать', 'Поговорить', 'Плыть к нему']);
  assert.ok(labels.includes('Ремонт'));
  assert.ok(!labels.some((l) => /Нанять/.test(l)));
  // a foe already attacked: the fight's buttons first, then «Поговорить», then the rest
  const foe = buildActs({ attack: { name: 'Старая десятина', pursuing: false, mode: 'board' }, sel: { kind: 'ship', name: 'Старая десятина', far: 400, talk: true }, repair: { repairing: false, combat: false, hurt: true } });
  assert.deepEqual(foe.map((a) => a.id).slice(0, 2), ['attack', 'sel_talk']);
});

test('main.ts: the refused attack sends nothing and takes no mark; the grapples and «подойдите ближе» only when lawful', () => {
  const pick = main.slice(main.indexOf('function pickTargetChoice('), main.indexOf('/** What lies under a point'));
  const refuse = pick.indexOf("&& !attackable(n)) return refuseAttack(n);");
  assert.ok(refuse > 0 && refuse < pick.indexOf('pinTarget(n)'), 'refused before the mark is taken or anything sent');
  assert.match(pick, /else if \(id === 'fight'\) net\.send\(\{ t: 'attack', target: n, mode: guardOfEntity\(state, n\) && !unboardableMark\(n\) \? 'board' : 'guns' \}\)/, '«Атаковать» = the guns, never the grapples by itself');
  assert.ok(!/id === 'hire'/.test(pick), 'no «Нанять» in the ring');
  const gather = main.slice(main.indexOf('function gatherActs('), main.indexOf('function selWhere('));
  assert.match(gather, /if \(!attackable\(s\.id\)\) continue;\n {4}const bw = boardWhy\(s\.id\);/);
  assert.match(gather, /if \(s\.id === state\.pursuit\?\.target && bw\.why\) boardNear/, '«подойдите ближе» only for the ship she is attacking');
  assert.ok(!/sel_hire|sel_look/.test(main));
  // refuseAttack: why, «Как сменить флаг» → the flag card
  assert.match(main, /askHtml\(`<p id="confirm-text">\$\{esc\(attackNoText\(why\)\)\}<\/p>`, b\.how, b\.ok\)\.then\(\(go\) => go && openFlagCard\(\)\)/);
});
