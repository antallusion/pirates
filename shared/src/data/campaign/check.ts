// The campaign's chapters checked as written (tests/campaign.test.ts, tools/campaign-check.ts): the plan's size, sea and
// port; every quest's words in both tongues with the same places; no Latin letters in the Russian; nothing of the
// grave's (owner: no blood, skulls or bones); steps that read and are few; islands visited and ships boarded in every
// chapter, as the owner asked («посещение острова и несколько абордажей»).

import { KEY_PORTS, REGIONS } from '../../world/regions.ts';
import { NEW_PORTS } from '../../world/newports.ts';
import { PLAN } from './plan.ts';
import { PLACEHOLDERS } from './types.ts';
import type { ChapterSrc, QuestSrc, StepSrc, T } from './types.ts';
import { parseStep, stepsOf } from './steps.ts';
import type { StepSpec } from './steps.ts';

export const GIVER_FACES = ['giver_apothecary_f', 'giver_apothecary_m', 'giver_bosun_m', 'giver_cartographer_f', 'giver_cartographer_m', 'giver_cultist_f', 'giver_cultist_m',
  'giver_envoy_f', 'giver_envoy_m', 'giver_fence_f', 'giver_fence_m', 'giver_fishwife_f', 'giver_garrison_captain_m', 'giver_harbour_master_f', 'giver_harbour_master_m',
  'giver_hermit_f', 'giver_hermit_m', 'giver_lighthouse_keeper_f', 'giver_lighthouse_keeper_m', 'giver_merchant_f', 'giver_merchant_m', 'giver_old_salt_m',
  'giver_pearl_diver_f', 'giver_pearl_diver_m', 'giver_priest_f', 'giver_priest_m', 'giver_shipwright_f', 'giver_shipwright_m', 'giver_smuggler_f', 'giver_smuggler_m',
  'giver_tavern_keeper_m', 'giver_whaler_m', 'giver_widow_f'];

/** The ports every world has, by their ids (the key ports and the twenty towns of step 8). */
export const FIXED_PORTS = new Set([...KEY_PORTS.map((p) => p.id), ...NEW_PORTS.map((p) => p.id)]);

const GRAVE_EN = /\b(blood\w*|bloody|skulls?|bones?|bony|skeletons?|corpses?|gore)\b/i;
// (a word's start: the line's start or a non-letter before it — not a lookbehind, which Safari before 16.4 cannot parse)
const GRAVE_RU = /(?:^|[^а-яё])(кров(ь|и|ью|ав|ян|оточ)|череп(?!ах)|скелет|кост(ь|и|ей|ям|ями|ях|ян|ляв)|труп|мертвец)/i;

/** The placeholders of a text, sorted (a repeated one counted once). */
export const holesOf = (s: string): string[] => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

function checkPair(where: string, p: T | undefined, out: string[], opts: { holes?: boolean; stepHoles?: boolean; max?: number } = {}): void {
  if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || typeof p[1] !== 'string' || !p[0].trim() || !p[1].trim()) {
    out.push(`${where}: wants [English, Russian]`);
    return;
  }
  const [en, ru] = p;
  const he = holesOf(en), hr = holesOf(ru);
  if (he.join() !== hr.join()) out.push(`${where}: places differ — EN {${he}} RU {${hr}}`);
  if (opts.holes === false && he.length) out.push(`${where}: no placeholders here`);
  const allowed: readonly string[] = opts.stepHoles ? PLACEHOLDERS : PLACEHOLDERS.filter((x) => x !== 'n' && x !== 'good' && x !== 'site');
  for (const h of he) if (!allowed.includes(h)) out.push(`${where}: unknown placeholder {${h}}`);
  const bare = ru.replace(/\{\w+\}/g, '');
  if (/[A-Za-z]/.test(bare)) out.push(`${where}: Latin in the Russian — «${ru}»`);
  if (/[А-Яа-яЁё]/.test(en.replace(/\{\w+\}/g, ''))) out.push(`${where}: Cyrillic in the English — «${en}»`);
  if (GRAVE_EN.test(en)) out.push(`${where}: the grave's words in the English — «${en}»`);
  if (GRAVE_RU.test(ru)) out.push(`${where}: the grave's words in the Russian — «${ru}»`);
  if (opts.max && (en.length > opts.max || ru.length > opts.max * 1.25)) out.push(`${where}: too long (${en.length}/${ru.length})`);
}

function checkSteps(where: string, steps: StepSrc[] | undefined, out: string[]): StepSpec[] {
  if (!Array.isArray(steps) || !steps.length) {
    out.push(`${where}: no steps`);
    return [];
  }
  const specs: StepSpec[] = [];
  let count = 0;
  steps.forEach((s, i) => {
    const code = typeof s === 'string' ? s : s[0];
    const spec = parseStep(code);
    if (typeof spec === 'string') {
      out.push(`${where}.s${i}: ${spec}`);
      return;
    }
    specs.push(spec);
    count += stepsOf(spec);
    if (spec.kind === 'at' && !FIXED_PORTS.has(spec.port!)) out.push(`${where}.s${i}: no port «${spec.port}»`);
    if (typeof s !== 'string') {
      if (spec.kind === 'carry') out.push(`${where}.s${i}: a carry keeps its own words`);
      checkPair(`${where}.s${i}`, [s[1], s[2]], out, { stepHoles: true, max: 160 });
    }
  });
  if (count < 1 || count > 4) out.push(`${where}: ${count} steps (1–4)`);
  return specs;
}

function checkQuest(where: string, q: QuestSrc, out: string[]): StepSpec[] {
  checkPair(`${where}.t`, q.t, out, { holes: false, max: 48 });
  checkPair(`${where}.b`, q.b, out, { max: 420 });
  checkPair(`${where}.d`, q.d, out, { max: 220 });
  const specs = checkSteps(where, q.s, out);
  if (q.alt) {
    if (!/^[a-z][a-z0-9_]*$/.test(q.alt.key ?? '')) out.push(`${where}.alt: a key of lower-case letters`);
    checkPair(`${where}.alt.label0`, q.alt.label?.[0], out, { holes: false, max: 40 });
    checkPair(`${where}.alt.label1`, q.alt.label?.[1], out, { holes: false, max: 40 });
    checkPair(`${where}.alt.t`, q.alt.t, out, { holes: false, max: 48 });
    checkPair(`${where}.alt.b`, q.alt.b, out, { max: 420 });
    checkPair(`${where}.alt.d`, q.alt.d, out, { max: 220 });
    checkSteps(`${where}.alt`, q.alt.s, out);
  }
  return specs;
}

/** What is wrong with a chapter as written (empty: nothing). */
export function checkChapter(ch: ChapterSrc): string[] {
  const out: string[] = [];
  const plan = PLAN.find((p) => p.n === ch.n);
  const w = `ch${String(ch.n).padStart(2, '0')}`;
  if (!plan) return [`${w}: not in the plan`];
  if (ch.region !== plan.region) out.push(`${w}: sea ${ch.region}, the plan's ${plan.region}`);
  if (!FIXED_PORTS.has(ch.hub)) out.push(`${w}: no port «${ch.hub}»`);
  if (ch.hub !== plan.hub) out.push(`${w}: port ${ch.hub}, the plan's ${plan.hub}`);
  for (const r of ch.more ?? []) if (!REGIONS[r]) out.push(`${w}: unknown sea ${r}`);
  if (!GIVER_FACES.includes(ch.portrait)) out.push(`${w}: no face «${ch.portrait}»`);
  checkPair(`${w}.title`, ch.title, out, { holes: false, max: 48 });
  checkPair(`${w}.blurb`, ch.blurb, out, { holes: false, max: 320 });
  checkPair(`${w}.giver`, ch.giver, out, { holes: false, max: 60 });
  if (ch.reward?.title) checkPair(`${w}.reward.title`, ch.reward.title, out, { holes: false, max: 40 });
  if (!Array.isArray(ch.quests) || ch.quests.length !== plan.size) out.push(`${w}: ${ch.quests?.length ?? 0} quests, the plan's ${plan.size}`);
  let isles = 0, boards = 0;
  const titles = new Set<string>();
  (ch.quests ?? []).forEach((q, i) => {
    const specs = checkQuest(`${w}.q${i + 1}`, q, out);
    if (specs.some((s) => s.kind === 'isle' || s.kind === 'isle2')) isles++;
    if (specs.some((s) => s.kind === 'board')) boards++;
    if (q.t && titles.has(q.t[1])) out.push(`${w}.q${i + 1}: the title «${q.t[1]}» twice in the chapter`);
    if (q.t) titles.add(q.t[1]);
  });
  if (isles < 2) out.push(`${w}: ${isles} quests sail to an island (2 at least)`);
  if (boards < 3) out.push(`${w}: ${boards} quests board ships (3 at least)`);
  const last = ch.quests?.at(-1);
  if (last) {
    const n = last.s.reduce((a, s) => {
      const p = parseStep(typeof s === 'string' ? s : s[0]);
      return a + (typeof p === 'string' ? 1 : stepsOf(p));
    }, 0);
    if (n < 3) out.push(`${w}: the finale has ${n} steps (3 at least)`);
  }
  return out;
}
