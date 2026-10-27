// The advice mailer's rules and words (owner, 2026-10-28: the top captains, ⚓11–14, sail with tier-1 crews and keep
// sinking, not knowing the island is the key — «подсказки рассылать по почте»). Pure: the server (server/src/game/
// advice.ts) gathers a captain, these say which hints are due on which channel and in what words; the dry run
// (tools/advice-dry.ts) uses the very same.
//
// The hints, by priority:
//  - island: ⚓5 and up, and the island never raised (no island, or its hall at 1 with no Marine Barracks);
//  - tier:   a dwelling of tier 2+ stands on her island, her ship berths its men, yet not one of that tier is aboard;
//  - army:   ⚓5 and up, her army weak for her level (armyAdvice, shared/src/data/armyadvice.ts), with its next step;
//  - return: away a day or more with the campaign unfinished — a gentle «вас ждут» (never by letter: she is away).
// The limits: one hint of a kind per three days on each channel; one letter a day; one e-mail or VK/Telegram message a
// day for the account, all of them together; none outside to a captain aboard (she reads the letter), none outside to one
// away two weeks and more. The letter's words are English with exact Russian twins (advicePatterns): the client shows
// them in her language; the e-mail and the notices are written in her language at once.

import { UNITS, armySlots } from './army.ts';
import type { ArmyStack } from './army.ts';
import { armyAdvice } from './armyadvice.ts';
import type { AdviceCaptain, ArmyAdvice } from './armyadvice.ts';
import { TIER_SHIP_LEVEL, TOWN, deepAllowed } from './town.ts';
import type { TownId } from './town.ts';
import { TREE_BASE, TREE_IDS, TREE_TOWN } from './isletree.ts';
import type { TreeId } from './isletree.ts';
import { SHIP_CLASSES } from './ships.ts';
import { computeShipStats } from '../sim/shipstats.ts';
import { shipLevelOf } from './shiplevel.ts';

const DAY = 86_400_000;

export type HintKind = 'island' | 'tier' | 'army' | 'return';
export const HINT_KINDS: HintKind[] = ['island', 'tier', 'army', 'return'];
export type AdviceChannel = 'letter' | 'email' | 'push';
export const ADVICE_CHANNELS: AdviceChannel[] = ['letter', 'email', 'push'];
export type AdviceLang = 'ru' | 'en';

/** A kind again on a channel after this. */
export const ADVICE_KIND_GAP = 3 * DAY;
/** One letter a day; one e-mail or VK/Telegram message a day, all together. */
export const ADVICE_DAY_GAP = DAY;
/** The island's hint from this level. */
export const ADVICE_ISLE_LEVEL = 5;
/** «вас ждут» after a day away; nothing outside after two weeks away. */
export const ADVICE_AWAY = DAY;
export const ADVICE_FAR = 14 * DAY;

/** The plural names of each tier's men (index: the tier). */
export const TIER_MEN: [string, string][] = [['', ''], ['Deckhands', 'Юнги'], ['Marines', 'Морпехи'], ['Musketeers', 'Мушкетёры'], ['Gunners', 'Канониры'], ['Boarders', 'Абордажники'], ['Officers’ guards', 'Офицерские гвардейцы'], ['The drowned', 'Утопленники']];

/** A captain as the hints see her: the army's advice reads `cap` (shared/src/data/armyadvice.ts — the server's
 *  captainAdvice for a session, captainFromSave for a saved profile); the rest is the mailer's own. */
export interface HintCaptain {
  acc: number;
  name: string;
  /** Null: no ship (nothing to advise on the army or the island's tiers). */
  cap: AdviceCaptain | null;
  online: boolean;
  /** Ms since she went ashore (0 aboard). */
  awayMs: number;
  /** Her campaign unfinished: its chapter, quests done in it, its size. */
  campaign: { ch: number; k: number; size: number } | null;
}

/** A saved profile's fields the advice reads (the server's Profile has them all). */
export interface SavedCaptain {
  level: number;
  gold?: number;
  army?: ArmyStack[];
  loadout: { classId: string; level?: number };
  captain?: string;
  talents?: Record<string, number>;
  curse?: number;
  reputation?: Partial<Record<string, number>>;
}

/** Her island's tree levels from the saved holding: the town's buildings and the base's (as server town.ts
 *  treeLevels reads them). Null: no island of her own. */
export function isleFromHolding(h: { buildings?: { id: string; level?: number }[]; yard?: { town?: { b?: Record<string, number> } } } | null | undefined): Partial<Record<string, number>> | null {
  if (!h) return null;
  const out: Partial<Record<string, number>> = {};
  const b = h.yard?.town?.b ?? { hall: 1 };
  for (const id of TREE_TOWN) out[id] = Math.max(0, Math.floor(b[id] ?? 0));
  for (const id of TREE_BASE) out[id] = Math.max(0, ...(h.buildings ?? []).filter((x) => x.id === id).map((x) => Math.max(1, x.level ?? 1)));
  return out;
}

/** The advice's captain from a saved profile (a captain away: no live ship): the same fields captainAdvice reads, the
 *  hull's hammocks by her loadout, her captain and talents (gear and passing effects aside). Null: no ship to read. */
export function captainFromSave(p: SavedCaptain, isle: Partial<Record<string, number>> | null): AdviceCaptain | null {
  const cls = SHIP_CLASSES[p.loadout?.classId as keyof typeof SHIP_CLASSES];
  if (!cls) return null;
  let crewMax = 0, shipLevel = 1;
  try {
    const st = computeShipStats(p.loadout as Parameters<typeof computeShipStats>[0], (p.captain ?? 'corsair') as Parameters<typeof computeShipStats>[1], (p.talents ?? {}) as Parameters<typeof computeShipStats>[2]);
    crewMax = st.crewMax;
    shipLevel = shipLevelOfSave(p);
  } catch {
    return null;
  }
  return {
    level: p.level, shipLevel, army: p.army ?? [], crewMax, slots: armySlots(cls.tier), gold: Math.floor(p.gold ?? 0), isle,
    deep: deepAllowed(p.curse ?? 0, p.reputation?.choir ?? 0, false),
  };
}

const shipLevelOfSave = (p: SavedCaptain): number => shipLevelOf(p.loadout as Parameters<typeof shipLevelOf>[0]);

export interface Hint {
  kind: HintKind;
  /** island: the building to raise next ('' — claim an island first); tier: the dwelling. */
  building?: TownId | '';
  tier?: number;
  /** army: the advice, its step never null. */
  army?: ArmyAdvice;
  /** return: the campaign's chapter she stands in. */
  chapter?: number;
}

const lvl = (isle: Partial<Record<string, number>> | null, id: string): number => Math.max(0, Math.floor(isle?.[id] ?? 0));
const tierOf = (u: string | undefined): number => (u && UNITS[u as keyof typeof UNITS] ? UNITS[u as keyof typeof UNITS].tier : 0);

/** The island never raised: none, or its hall at 1 and no Marine Barracks. */
export const isleRaw = (isle: Partial<Record<string, number>> | null): boolean => !isle || (lvl(isle, 'hall') <= 1 && lvl(isle, 'dw2') === 0);

/** Not a captain to write to: a bot of the load tests, an NPC, a QA account. */
export const notACaptain = (name: string): boolean => /^(bot|npc|qa|test)(\b|[\s_\-\d])/i.test(String(name ?? '').trim());

/** The hints due for her, the most useful first. */
export function adviceHints(c: HintCaptain): Hint[] {
  const out: Hint[] = [];
  if (notACaptain(c.name)) return out;
  const cap = c.cap;
  if (cap) {
    if (cap.level >= ADVICE_ISLE_LEVEL && isleRaw(cap.isle)) out.push({ kind: 'island', building: !cap.isle ? '' : lvl(cap.isle, 'dw1') === 0 ? 'dw1' : 'dw2' });
    if (cap.isle) {
      for (let t = 7; t >= 2; t--) {
        if (lvl(cap.isle, `dw${t}`) === 0 || cap.shipLevel < TIER_SHIP_LEVEL[t] || (t === 7 && !cap.deep)) continue;
        if (cap.army.some((s) => tierOf(s.u) >= t)) break; // her best open tier is aboard
        out.push({ kind: 'tier', tier: t, building: `dw${t}` as TownId });
        break;
      }
    }
    const a = armyAdvice(cap);
    if (a?.weak && a.step) out.push({ kind: 'army', army: a });
  }
  if (!c.online && c.awayMs >= ADVICE_AWAY && c.campaign) out.push({ kind: 'return', chapter: c.campaign.ch });
  return out;
}

// ------------------------------------------------------------------------------------------------ the limits

/** What was sent to her, by channel and kind (wall ms), and the day's last on each channel. */
export interface AdviceState {
  last: Partial<Record<AdviceChannel, Partial<Record<HintKind, number>>>>;
  /** The last letter; the last e-mail or VK/Telegram message (one a day, all together). */
  letterAt: number;
  outAt: number;
  /** She turned the e-mails off (the letter's one-click link). */
  emailOff?: boolean;
  /** The e-mail's unsubscribe token. */
  unsub?: string;
}

export const newAdviceState = (): AdviceState => ({ last: {}, letterAt: 0, outAt: 0 });

/** Her state's key in the kv table. */
export const adviceKey = (acc: number): string => `advice:${acc}`;

/** The one-click unsubscribe (GET /auth/unsub?a=<account>&t=<token>): true when the token was hers; the e-mails stop. */
export function adviceUnsubscribe(kv: { getKv<T>(k: string): T | undefined; setKv(k: string, v: unknown): void }, acc: number, token: string): boolean {
  const st = kv.getKv<AdviceState>(adviceKey(acc));
  if (!st?.unsub || typeof token !== 'string' || token.length !== st.unsub.length || token !== st.unsub) return false;
  kv.setKv(adviceKey(acc), { ...st, emailOff: true });
  return true;
}

/** The hint due on a channel now (null: none, by the limits). Pure. */
export function pickHint(hints: readonly Hint[], st: AdviceState, ch: AdviceChannel, now: number, c: Pick<HintCaptain, 'online' | 'awayMs'>): Hint | null {
  if (ch === 'letter') {
    if (now - st.letterAt < ADVICE_DAY_GAP) return null;
  } else {
    if (c.online || c.awayMs >= ADVICE_FAR) return null;
    if (now - st.outAt < ADVICE_DAY_GAP) return null;
    if (ch === 'email' && st.emailOff) return null;
  }
  const last = st.last[ch] ?? {};
  for (const h of hints) {
    if (ch === 'letter' && h.kind === 'return') continue;
    if (now - (last[h.kind] ?? -Infinity) < ADVICE_KIND_GAP) continue;
    return h;
  }
  return null;
}

/** Marks a hint sent on a channel. */
export function markSent(st: AdviceState, ch: AdviceChannel, kind: HintKind, now: number): void {
  (st.last[ch] ??= {})[kind] = now;
  if (ch === 'letter') st.letterAt = now;
  else st.outAt = now;
}

// ------------------------------------------------------------------------------------------------ the words

const bName = (id: TownId | '' | undefined, lang: AdviceLang): string => (id ? TOWN[id].names[0][lang === 'ru' ? 1 : 0] : '');
const men = (t: number | undefined, lang: AdviceLang): string => TIER_MEN[Math.max(1, Math.min(7, t ?? 1))][lang === 'ru' ? 1 : 0];

const BASE_NAMES: Record<string, [string, string]> = { warehouse: ['Warehouse', 'Склад'], shipyard: ['Shipyard', 'Верфь'], battery: ['Shore battery', 'Береговая батарея'], fort: ['Fort', 'Форт'] };
/** A building of the island's tree by its first name. */
const treeName = (id: string, lang: AdviceLang): string => {
  const t = (TOWN as Record<string, { names: [string, string][] } | undefined>)[id];
  const n = t ? t.names[0] : (BASE_NAMES[id] ?? [id, id]);
  return n[lang === 'ru' ? 1 : 0];
};

/** The letter's words (English; its Russian twin in advicePatterns): the subject and the body. Null: no letter. */
export function letterWords(h: Hint, lang: AdviceLang = 'en'): { subject: string; body: string } | null {
  const ru = lang === 'ru';
  const ANY = ru ? 'на острове или в любом порту, в том числе плавучем' : 'on your island or in any port, the floating ones too';
  if (h.kind === 'island') {
    const subject = ru ? 'Ключ к силе — ваш остров' : 'Your island is the key';
    const lead = ru ? 'Капитан, на одних юнгах дальше пятого уровня палубу не удержать. Сильные бойцы растут на вашем собственном острове: каждое жилище там открывает новый тир.' : 'Captain, deckhands alone will not hold a deck past the fifth level. Stronger men are bred on an island of your own: every dwelling you raise there opens a higher tier.';
    if (!h.building) return { subject, body: ru ? `${lead} Следующий шаг: займите остров (первый — даром) и постройте на нём «${bName('dw1', 'ru')}», затем «${bName('dw2', 'ru')}».` : `${lead} Next step: claim an island (the first is free) and build the ${bName('dw1', 'en')} on it, then the ${bName('dw2', 'en')}.` };
    if (h.building === 'dw1') return { subject, body: ru ? `${lead} Следующий шаг: постройте «${bName('dw1', 'ru')}», затем «${bName('dw2', 'ru')}» (Остров → Город). Морпехов потом нанимайте ${ANY}.` : `${lead} Next step: build the ${bName('dw1', 'en')}, then the ${bName('dw2', 'en')} (Island → Town). Then hire the marines ${ANY}.` };
    return { subject, body: ru ? `${lead} Следующий шаг: постройте «${bName('dw2', 'ru')}» (Остров → Город). Морпехов потом нанимайте ${ANY}.` : `${lead} Next step: build the ${bName('dw2', 'en')} (Island → Town). Then hire the marines ${ANY}.` };
  }
  if (h.kind === 'tier') {
    const m = men(h.tier, lang);
    return ru
      ? { subject: `${m} ждут вас`, body: `Капитан, на вашем острове уже стоит «${bName(h.building, 'ru')}», а бойцов оттуда на борту нет. ${m} намного сильнее юнг: наймите их ${ANY} и поставьте в первые отряды.` }
      : { subject: `${m} are waiting for you`, body: `Captain, the ${bName(h.building, 'en')} stands on your island, yet none of its men are aboard. ${m} are far stronger than deckhands: hire them ${ANY} and put them in your first stacks.` };
  }
  if (h.kind === 'army' && h.army?.step) {
    const subject = ru ? 'Команда слабовата для вашего уровня' : 'Your crew is weak for your level';
    const lead = ru ? 'Капитан, в абордаже ваша команда стоит меньше, чем море ждёт от капитана вашего уровня.' : 'Captain, in a boarding your crew is worth less than the sea expects of a captain of your level.';
    const s = h.army.step;
    const t = tierOf(s.unit);
    const body = (r: string, e: string) => ({ subject, body: `${lead} ${ru ? r : e}` });
    switch (s.kind) {
      case 'hire':
        if (t >= 1) return body(`Следующий шаг: наймите бойцов «${men(t, 'ru')}» ${ANY}.`, `Next step: hire ${men(t, 'en').toLowerCase()} ${ANY}.`);
        break;
      case 'silver':
        if (t >= 1) return body(`Следующий шаг: на бойцов «${men(t, 'ru')}» не хватает серебра — берите задания в порту, выигрывайте абордажи и продавайте добычу.`, `Next step: your purse is too light for ${men(t, 'en').toLowerCase()} — take port jobs, win boardings and sell the plunder.`);
        break;
      case 'build':
      case 'upgrade':
        if (s.building && (TREE_IDS as string[]).includes(s.building)) {
          const n = Math.max(1, s.level ?? 1);
          return body(`Следующий шаг на острове: «${treeName(s.building, 'ru')}», уровень ${n}. Каждое жилище открывает бойцов посильнее для найма ${ANY}.`, `Next step on your island: the ${treeName(s.building, 'en')}, level ${n}. Every dwelling opens stronger men to hire ${ANY}.`);
        }
        break;
      case 'claim':
        return body(`Следующий шаг: займите свой остров и постройте на нём «${bName('dw2', 'ru')}».`, `Next step: claim an island of your own and build the ${bName('dw2', 'en')} on it.`);
      case 'fill':
        return body('Следующий шаг: половина гамаков пуста — наберите команду в таверне любого порта.', 'Next step: half your hammocks are empty — sign men on at any port’s tavern.');
    }
    return body('Следующий шаг: заполните отряды лучшими бойцами, каких можно нанять.', 'Next step: fill your stacks with the best men you can hire.');
  }
  return null;
}

/** Every letter the mailer can write, English → Russian (the client's table of the server's words). */
export function advicePatterns(): [string, string][] {
  const out: [string, string][] = [];
  const add = (h: Hint) => {
    const en = letterWords(h, 'en'), ru = letterWords(h, 'ru');
    if (en && ru) out.push([en.subject, ru.subject], [en.body, ru.body]);
  };
  add({ kind: 'island', building: '' });
  add({ kind: 'island', building: 'dw1' });
  add({ kind: 'island', building: 'dw2' });
  for (let t = 2; t <= 7; t++) add({ kind: 'tier', tier: t, building: `dw${t}` as TownId });
  type Step = NonNullable<ArmyAdvice['step']>;
  const army = (step: Omit<Step, 'textRu' | 'textEn'>): Hint => ({ kind: 'army', army: { weak: true, ratio: 0, power: 0, norm: 1, best: null, step: { ...step, textRu: '', textEn: '' } } });
  for (const u of Object.keys(UNITS) as Step['unit'][]) {
    add(army({ kind: 'hire', unit: u }));
    add(army({ kind: 'silver', unit: u }));
  }
  for (const b of TREE_IDS as TreeId[]) for (let n = 1; n <= 5; n++) {
    add(army({ kind: 'build', building: b, level: n }));
    add(army({ kind: 'upgrade', building: b, level: n }));
  }
  add(army({ kind: 'claim' }));
  add(army({ kind: 'fill' }));
  out.push(['The Harbour Master', 'Начальник порта']);
  return [...new Map(out).entries()];
}

/** The words outside the game (the e-mail, the VK and Telegram notices), in her language: a subject, the letter's
 *  paragraphs, and one line for a notice (VK keeps 254 characters). */
export function outsideWords(h: Hint, lang: AdviceLang, name: string): { subject: string; paras: string[]; line: string } {
  const ru = lang === 'ru';
  const who = name ? (ru ? `Капитан ${name}` : `Captain ${name}`) : ru ? 'Капитан' : 'Captain';
  if (h.kind === 'return') {
    const c = h.chapter ?? 0;
    const p = ru ? `${who}, море ждёт вас: кампания не окончена${c ? `, глава ${c}` : ''}. Корабль стоит на якоре, следующий шаг — в журнале заданий.` : `${who}, the sea is waiting: your campaign is not finished${c ? `, chapter ${c}` : ''}. Your ship lies at anchor; the next step is in your quest log.`;
    return { subject: ru ? 'Вас ждут в море' : 'The sea is waiting for you', paras: [p], line: p };
  }
  const w = letterWords(h, lang);
  if (!w) return { subject: '', paras: [], line: '' };
  let body = w.body.replace(/^(Капитан|Captain),\s*/, `${who}, `);
  // the army's step in the helper's own words, when it gave them
  let armyLine = '';
  if (h.kind === 'army' && h.army?.step) {
    const t = (ru ? h.army.step.textRu : h.army.step.textEn).trim();
    if (t) {
      body = body.replace(/(Следующий шаг|Next step)( на острове| on your island)?: .*$/s, `$1: ${t}`);
      armyLine = ru ? `${who}, команда слабовата для вашего уровня. ${t}` : `${who}, your crew is weak for your level. ${t}`;
    }
  }
  const line = h.kind === 'island'
    ? ru ? `${who}, ключ к сильной команде — ваш остров: ${h.building ? '' : 'займите его, '}постройте «${bName('dw2', 'ru')}» и нанимайте морпехов в любом порту.` : `${who}, your island is the key to a strong crew: ${h.building ? '' : 'claim one, '}build the ${bName('dw2', 'en')} and hire marines in any port.`
    : h.kind === 'tier'
      ? ru ? `${who}, на вашем острове готовы ${men(h.tier, 'ru').toLowerCase()}: наймите их на острове или в любом порту.` : `${who}, ${men(h.tier, 'en').toLowerCase()} are ready on your island: hire them there or in any port.`
      : armyLine || body;
  return { subject: w.subject, paras: [body], line };
}
