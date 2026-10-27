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

import { UNITS } from './army.ts';
import type { ArmyStack } from './army.ts';
import { armyAdvice } from './armyadvice.ts';
import type { ArmyAdvice } from './armyadvice.ts';
import { TIER_SHIP_LEVEL, TOWN } from './town.ts';
import type { TownId } from './town.ts';

const DAY = 86_400_000;

export type AdviceKind = 'island' | 'tier' | 'army' | 'return';
export const ADVICE_KINDS: AdviceKind[] = ['island', 'tier', 'army', 'return'];
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

/** A captain as the hints see her (the server: from her session or her saved profile and island). */
export interface AdviceCaptain {
  acc: number;
  name: string;
  level: number;
  army: readonly ArmyStack[];
  /** Her ship's level (the tiers she may berth). */
  shipLevel: number;
  /** Her island's town buildings by level; null: no island of her own. */
  town: Partial<Record<string, number>> | null;
  online: boolean;
  /** Ms since she went ashore (0 aboard). */
  awayMs: number;
  /** Her campaign unfinished: its chapter, quests done in it, its size. */
  campaign: { ch: number; k: number; size: number } | null;
}

export interface Hint {
  kind: AdviceKind;
  /** island: the building to raise next ('' — claim an island first); tier/army: the building or the tier involved. */
  building?: TownId | '';
  tier?: number;
  army?: ArmyAdvice;
  /** return: the campaign's chapter she stands in. */
  chapter?: number;
}

const lvl = (town: Partial<Record<string, number>> | null, id: string): number => Math.max(0, Math.floor(town?.[id] ?? 0));
const tierOf = (u: string | undefined): number => (u && UNITS[u as keyof typeof UNITS] ? UNITS[u as keyof typeof UNITS].tier : 0);

/** The island never raised: none, or its hall at 1 and no Marine Barracks. */
export const isleRaw = (town: Partial<Record<string, number>> | null): boolean => !town || (lvl(town, 'hall') <= 1 && lvl(town, 'dw2') === 0);

/** Not a captain to write to: a bot of the load tests, an NPC, a QA account. */
export const notACaptain = (name: string): boolean => /^(bot|npc|qa|test)(\b|[\s_\-\d])/i.test(String(name ?? '').trim());

/** The hints due for her, the most useful first. */
export function adviceHints(c: AdviceCaptain): Hint[] {
  const out: Hint[] = [];
  if (notACaptain(c.name)) return out;
  if (c.level >= ADVICE_ISLE_LEVEL && isleRaw(c.town)) out.push({ kind: 'island', building: !c.town ? '' : lvl(c.town, 'dw1') === 0 ? 'dw1' : 'dw2' });
  if (c.town) {
    for (let t = 7; t >= 2; t--) {
      if (lvl(c.town, `dw${t}`) === 0 || c.shipLevel < TIER_SHIP_LEVEL[t]) continue;
      if (c.army.some((s) => tierOf(s.u) >= t)) break; // her best open tier is aboard
      out.push({ kind: 'tier', tier: t, building: `dw${t}` as TownId });
      break;
    }
  }
  const a = armyAdvice({ level: c.level, army: c.army, town: c.town, shipLevel: c.shipLevel });
  // (from the island's level: below it a green crew is the sea's own, and the hint would only be noise)
  if (a?.weak && c.level >= ADVICE_ISLE_LEVEL) out.push({ kind: 'army', army: a });
  if (!c.online && c.awayMs >= ADVICE_AWAY && c.campaign) out.push({ kind: 'return', chapter: c.campaign.ch });
  return out;
}

// ------------------------------------------------------------------------------------------------ the limits

/** What was sent to her, by channel and kind (wall ms), and the day's last on each channel. */
export interface AdviceState {
  last: Partial<Record<AdviceChannel, Partial<Record<AdviceKind, number>>>>;
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
export function pickHint(hints: readonly Hint[], st: AdviceState, ch: AdviceChannel, now: number, c: Pick<AdviceCaptain, 'online' | 'awayMs'>): Hint | null {
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
export function markSent(st: AdviceState, ch: AdviceChannel, kind: AdviceKind, now: number): void {
  (st.last[ch] ??= {})[kind] = now;
  if (ch === 'letter') st.letterAt = now;
  else st.outAt = now;
}

// ------------------------------------------------------------------------------------------------ the words

const bName = (id: TownId | '' | undefined, lang: AdviceLang): string => (id ? TOWN[id].names[0][lang === 'ru' ? 1 : 0] : '');
const men = (t: number | undefined, lang: AdviceLang): string => TIER_MEN[Math.max(1, Math.min(7, t ?? 1))][lang === 'ru' ? 1 : 0];

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
  if (h.kind === 'army' && h.army) {
    const subject = ru ? 'Команда слабовата для вашего уровня' : 'Your crew is weak for your level';
    const lead = ru ? 'Капитан, в абордаже ваша команда стоит меньше, чем море ждёт от капитана вашего уровня.' : 'Captain, in a boarding your crew is worth less than the sea expects of a captain of your level.';
    const s = h.army.step;
    const t = tierOf(s.unit);
    if (s.kind === 'hire' && t >= 1) return { subject, body: ru ? `${lead} Следующий шаг: наймите бойцов «${men(t, 'ru')}» ${ANY}.` : `${lead} Next step: hire ${men(t, 'en').toLowerCase()} ${ANY}.` };
    if (s.kind === 'build' && s.building && s.building in TOWN) return { subject, body: ru ? `${lead} Следующий шаг: постройте на острове «${bName(s.building as TownId, 'ru')}» — оно откроет бойцов посильнее.` : `${lead} Next step: build the ${bName(s.building as TownId, 'en')} on your island: it opens stronger men.` };
    if (s.kind === 'island') return { subject, body: ru ? `${lead} Следующий шаг: займите свой остров и постройте на нём «${bName('dw2', 'ru')}».` : `${lead} Next step: claim an island of your own and build the ${bName('dw2', 'en')} on it.` };
    return { subject, body: ru ? `${lead} Следующий шаг: заполните отряды лучшими бойцами, каких можно нанять.` : `${lead} Next step: fill your stacks with the best men you can hire.` };
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
  const army = (step: ArmyAdvice['step']): Hint => ({ kind: 'army', army: { weak: true, ratio: 0, step } });
  for (const u of Object.keys(UNITS)) add(army({ kind: 'hire', unit: u, textRu: '', textEn: '' }));
  for (let t = 1; t <= 7; t++) add(army({ kind: 'build', building: `dw${t}`, textRu: '', textEn: '' }));
  add(army({ kind: 'island', textRu: '', textEn: '' }));
  add(army({ kind: 'fill', textRu: '', textEn: '' }));
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
  if (h.kind === 'army' && h.army) {
    const t = (ru ? h.army.step.textRu : h.army.step.textEn).trim();
    if (t) body = body.replace(/(Следующий шаг|Next step): .*$/, `$1: ${t}`);
  }
  const line = h.kind === 'island'
    ? ru ? `${who}, ключ к сильной команде — ваш остров: ${h.building ? '' : 'займите его, '}постройте «${bName('dw2', 'ru')}» и нанимайте морпехов в любом порту.` : `${who}, your island is the key to a strong crew: ${h.building ? '' : 'claim one, '}build the ${bName('dw2', 'en')} and hire marines in any port.`
    : h.kind === 'tier'
      ? ru ? `${who}, на вашем острове готовы ${men(h.tier, 'ru').toLowerCase()}: наймите их на острове или в любом порту.` : `${who}, ${men(h.tier, 'en').toLowerCase()} are ready on your island: hire them there or in any port.`
      : body;
  return { subject: w.subject, paras: [body], line };
}
