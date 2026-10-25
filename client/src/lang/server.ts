// What the server says, in the player's language. The server speaks English; every sentence it can say is a pattern
// (tools/i18n-server.ts: "Sold {0} {1}."). An incoming toast is matched against the patterns — exact sentences
// first, then the most specific template — and the Russian twin is filled with the captured parts, which are
// themselves translated when they are known names or phrases. Unknown text passes through unchanged.

import { fishingPatterns } from '../../../shared/src/data/fishing.ts';
import { ruCounts } from './counts.ts';
import { importAgain } from '../importagain.ts';
import { cosPatterns } from '../../../shared/src/data/cosmetics.ts'; // docs/32 §12
import { beastPatterns } from '../../../shared/src/data/beasts.ts';
import { piratePatterns } from '../../../shared/src/data/pirates.ts';
import { raidPatterns } from '../../../shared/src/data/raiding.ts';
import { estatePatterns } from '../../../shared/src/data/estate.ts';
import { caravanPatterns } from '../../../shared/src/data/caravans.ts';
import { sidePatterns } from '../../../shared/src/data/sidequests.ts';
import { nemesisPatterns } from '../../../shared/src/data/nemesis.ts';
import { companionPatterns, petPatterns } from '../../../shared/src/data/companions.ts';
import { shantyPatterns } from '../../../shared/src/data/shanty.ts';
import { dicePatterns } from '../../../shared/src/data/dice.ts';
import { regattaPatterns } from '../../../shared/src/data/regatta.ts';
import { bottlePatterns } from '../../../shared/src/data/bottles.ts';
import { chestPatterns } from '../../../shared/src/data/chests.ts';
import { wonderPatterns } from '../../../shared/src/data/wonders.ts';
import { omenPatterns } from '../../../shared/src/data/omens.ts';
import { dutchmanPatterns } from '../../../shared/src/data/dutchman.ts';
import { fatePatterns } from '../../../shared/src/data/fates.ts';
import { lookPatterns } from '../../../shared/src/data/looks.ts';
import { guestPatterns } from '../../../shared/src/data/guests.ts';
import { stormPatterns } from '../../../shared/src/data/storms.ts';
import { servicePatterns } from '../../../shared/src/data/marque.ts';
import { turncoatPatterns } from '../../../shared/src/data/turncoats.ts';
import { descentPatterns } from '../../../shared/src/data/descent.ts';
import { holidayPatterns } from '../../../shared/src/data/holidays.ts';
import { bazaarPatterns } from '../../../shared/src/data/bazaar.ts';
import { sagaPatterns } from '../../../shared/src/data/saga.ts';
import { renownPatterns } from '../../../shared/src/data/renown.ts';
import { socialPatterns } from '../../../shared/src/data/social.ts';
import { SERVER_RU_G } from './server.ru.g.ts';
import { SERVER_RU_H } from './server.ru.h.ts';
import { SERVER_RU_ROUTE } from './server.ru.route.ts';
import { SERVER_RU_HIRE } from './server.ru.hire.ts'; // owner, 2026-10-25: a ship of the sea hired as a guard
import { SERVER_RU_TRUCE } from './server.ru.truce.ts'; // owner, 2026-10-18: the two choices, the ceasefire talks
import { SERVER_RU_WAY } from './server.ru.way.ts'; // docs/35: the floating waystations, the resurrection
import { SERVER_RU_ADRIFT } from './server.ru.adrift.ts';
import { SERVER_RU_BUYFAIL } from './server.ru.buyfail.ts'; // owner 2026-10-21: the honest refusals of a purchase // owner 2026-10-20: the jury rig, scuttling home
import { SERVER_RU_TAC16 } from './server.ru.tac16.ts'; // the battle's deployment, kept fights and replay (owner, 2026-10-16)
import { SERVER_RU_BOARD } from './server.ru.board.ts'; // the port's «Задания», the jobs' level bands (owner, 2026-10-16)
import { SERVER_RU_CAMPAIGN } from './server.ru.campaign.ts'; // docs/36, the main campaign's own lines
import { SERVER_RU_H3 } from './server.ru.h3.ts';
import { SERVER_RU_HERO } from './server.ru.hero.ts';
import { SERVER_RU_PATH } from './server.ru.path.ts';
import { heroPatterns } from '../../../shared/src/data/hero.ts';
import { artifactPatterns } from '../../../shared/src/data/artifacts.ts';
import { SERVER_RU_H4 } from './server.ru.h4.ts';
import { SERVER_RU_H5 } from './server.ru.h5.ts';
import { SERVER_RU_ISLES18 } from './server.ru.isles18.ts';
import { SERVER_RU_LAIRS } from './server.ru.lairs.ts';
import { SERVER_RU_DRIFTS } from './server.ru.drifts.ts';
import { SERVER_RU_MARKS } from './server.ru.marks.ts';
import { SERVER_RU_FINDS } from './server.ru.finds.ts';
import { SERVER_RU_ROAM } from './server.ru.roam.ts'; // docs/19 D7
import { SERVER_RU_BATTLE } from './server.ru.battle.ts'; // owner, 2026-10-22
import { SERVER_RU_REACH } from './server.ru.reach.ts'; // owner, 2026-10-22: the reaches
import { SERVER_RU_HERE } from './server.ru.here.ts'; // owner, 2026-10-23: a quest step's own button in port
import { SERVER_RU_ARMS } from './server.ru.arms.ts'; // the yard's wider trade (2026-10-03)
import { SERVER_RU_PREMIUM } from './server.ru.premium.ts'; // the premium shop (owner, 2026-10-03)
import { SERVER_RU_BEASTS100 } from './server.ru.beasts100.ts'; // the hundred creatures (owner, 2026-10-03; docs/18 VII)
import { SERVER_RU_FLEET } from './server.ru.fleet.ts'; // the fleet of eighty (owner, 2026-10-03)
import { SERVER_RU_BOSSES } from './server.ru.bosses.ts'; // the ten bosses (owner, 2026-10-03)
import { SERVER_RU_V18 } from './server.ru.v18.ts';
import { SERVER_RU_THRONE } from './server.ru.throne.ts'; // docs/19 E1–E3
import { SERVER_RU_CIT } from './server.ru.cit.ts'; // docs/19 E4–E8
import { SERVER_RU_RESEARCH } from './server.ru.research.ts'; // the yard's tree of hulls (owner, 2026-10-04)
import { SERVER_RU_ZONEBOSSES } from './server.ru.zonebosses.ts'; // the zone bosses (owner, 2026-10-04; docs/21)
import { SERVER_RU_M34 } from './server.ru.m34.ts'; // the quick sea fight (docs/23 phases 3–4)
import { SERVER_RU_GROUP } from './server.ru.group.ts'; // a group's boarding (docs/25 block Е)
import { SERVER_RU_M78 } from './server.ru.m78.ts'; // the first quarter of an hour (docs/23 phase 7)
import { SERVER_RU_FLAGS } from './server.ru.flags.ts'; // the colours and «Абордаж: выкл» (docs/24 C1, D1–D3)
import { SERVER_RU_BEASTFIGHT } from './server.ru.beastfight.ts'; // the beasts' fight, the order under fire, the carpenters (2026-10-07)
import { SERVER_RU_ISLE } from './server.ru.isle.ts'; // a hull striking the rocks (owner, 2026-10-08)
import { SERVER_RU_RETAIN } from './server.ru.retain.ts'; // the daily gift, the Telegram notices (owner, 2026-10-16)
import { SERVER_RU_TG } from './server.ru.tg.ts'; // Telegram: the Mini App, Stars, refunds (owner, 2026-10-11)
import { SERVER_RU_FOG } from './server.ru.fog.ts'; // the fog of war and the island's scouts (owner, 2026-10-17)
import { SERVER_RU_RELICS } from './server.ru.relics.ts'; // docs/19 E12, E13, E16
import { SERVER_RU_CONTRACTS } from './server.ru.contracts.ts'; // docs/19 E15
import { SERVER_RU_ARENA } from './server.ru.arena.ts'; // docs/19 E14
import { SERVER_RU_SEASKILL } from './server.ru.seaskill.ts'; // docs/25 items 13–43
import { SERVER_RU_CHAT } from './server.ru.chat.ts'; // docs/28, the chat
import { SERVER_RU_SEAUX } from './server.ru.seaux.ts'; // the sail-to on tap, her wreckage, the castaways (seaux 2026-10-11)
import { raftPatterns, settlementPatterns } from '../../../shared/src/world/worldgen.ts';
import { happeningPatterns } from '../../../shared/src/data/happenings.ts';
import { encounterPatterns } from '../../../shared/src/data/encounters.ts';
import { gearPatterns, itemNamePatterns } from '../../../shared/src/data/items.ts';
import { levelPatterns } from '../../../shared/src/data/shiplevel.ts';
import { lang, typeset } from '../i18n.ts';
import { COMMON_RU, NAME_RU, TEXT_RU } from './data.ts';
import { composedNameRu, nameHooks, personNameRu } from './names.ts';
import { SERVER_RU_A } from './server.ru.a.ts';
import { SERVER_RU_B } from './server.ru.b.ts';
import { SERVER_RU_ADMIN } from './server.ru.admin.ts';
import { GIVER_WOMEN, feminineAfter, feminineRu, questPatterns } from '../../../shared/src/data/questgen.ts';
import { lairQuestPatterns } from '../../../shared/src/data/lairquests.ts';
import { arcPatterns } from '../../../shared/src/data/questarcs.ts';
import { dailyPatterns } from '../../../shared/src/data/dailies.ts';
import { commonPatterns } from '../../../shared/src/data/commongoal.ts';
import { guildGoalPatterns } from '../../../shared/src/data/guildgoal.ts';
import { elitePatterns } from '../../../shared/src/data/elite.ts';
import { questTitlePatterns } from '../../../shared/src/data/questtitles.ts';
import { taskPatterns } from '../../../shared/src/data/worldtasks.ts';

// The generated jobs' templates carry their Russian twins (shared/src/data/questgen.ts).
const TABLE: Record<string, string> = { ...Object.fromEntries(cosPatterns()), ...Object.fromEntries(questPatterns()), ...Object.fromEntries(lairQuestPatterns()), ...Object.fromEntries(arcPatterns()), ...Object.fromEntries(dailyPatterns()), ...Object.fromEntries(commonPatterns()), ...Object.fromEntries(guildGoalPatterns()), ...Object.fromEntries(elitePatterns()), ...Object.fromEntries(questTitlePatterns()), ...Object.fromEntries(taskPatterns()), ...Object.fromEntries(levelPatterns()), ...Object.fromEntries(gearPatterns()), ...Object.fromEntries(encounterPatterns()), ...Object.fromEntries(happeningPatterns()), ...Object.fromEntries(fishingPatterns()), ...Object.fromEntries(beastPatterns()), ...Object.fromEntries(piratePatterns()), ...Object.fromEntries(raidPatterns()), ...Object.fromEntries(estatePatterns()), ...Object.fromEntries(caravanPatterns()), ...Object.fromEntries(sidePatterns()), ...Object.fromEntries(nemesisPatterns()), ...Object.fromEntries(companionPatterns()), ...Object.fromEntries(petPatterns()), ...Object.fromEntries(shantyPatterns()), ...Object.fromEntries(dicePatterns()), ...Object.fromEntries(regattaPatterns()), ...Object.fromEntries(bottlePatterns()), ...Object.fromEntries(chestPatterns()), ...Object.fromEntries(wonderPatterns()), ...Object.fromEntries(omenPatterns()), ...Object.fromEntries(dutchmanPatterns()), ...Object.fromEntries(fatePatterns()), ...Object.fromEntries(lookPatterns()), ...Object.fromEntries(guestPatterns()), ...Object.fromEntries(stormPatterns()), ...Object.fromEntries(servicePatterns()), ...Object.fromEntries(turncoatPatterns()), ...Object.fromEntries(descentPatterns()), ...Object.fromEntries(holidayPatterns()), ...Object.fromEntries(bazaarPatterns()), ...Object.fromEntries(sagaPatterns()), ...Object.fromEntries(renownPatterns()), ...Object.fromEntries(socialPatterns()), ...Object.fromEntries(settlementPatterns()), ...Object.fromEntries(raftPatterns()), ...Object.fromEntries(itemNamePatterns()), ...SERVER_RU_A, ...SERVER_RU_B, ...SERVER_RU_ADMIN, ...SERVER_RU_G, ...SERVER_RU_H, ...SERVER_RU_H3, ...Object.fromEntries(heroPatterns()), ...Object.fromEntries(artifactPatterns()), ...SERVER_RU_HERO, ...SERVER_RU_H4, ...SERVER_RU_H5, ...SERVER_RU_ISLES18, ...SERVER_RU_PATH, ...SERVER_RU_LAIRS, ...SERVER_RU_DRIFTS, ...SERVER_RU_V18, ...SERVER_RU_MARKS, ...SERVER_RU_THRONE, ...SERVER_RU_CIT, ...SERVER_RU_FINDS, ...SERVER_RU_ROAM, ...SERVER_RU_ARMS, ...SERVER_RU_PREMIUM, ...SERVER_RU_BEASTS100, ...SERVER_RU_FLEET, ...SERVER_RU_BOSSES, ...SERVER_RU_RESEARCH, ...SERVER_RU_ZONEBOSSES, ...SERVER_RU_M34, ...SERVER_RU_M78, ...SERVER_RU_FLAGS, ...SERVER_RU_BEASTFIGHT, ...SERVER_RU_ISLE, ...SERVER_RU_RELICS, ...SERVER_RU_CONTRACTS, ...SERVER_RU_ARENA, ...SERVER_RU_GROUP, ...SERVER_RU_SEASKILL, ...SERVER_RU_TG, ...SERVER_RU_CHAT, ...SERVER_RU_SEAUX, ...SERVER_RU_ROUTE, ...SERVER_RU_BOARD, ...SERVER_RU_TAC16, ...SERVER_RU_RETAIN, ...SERVER_RU_WAY, ...SERVER_RU_TRUCE, ...SERVER_RU_HIRE, ...SERVER_RU_FOG, ...SERVER_RU_CAMPAIGN, ...SERVER_RU_ADRIFT, ...SERVER_RU_BUYFAIL, ...SERVER_RU_BATTLE, ...SERVER_RU_REACH, ...SERVER_RU_HERE };
/** docs/36: the main campaign's words (its 720 quests: titles, briefings, steps, completion lines) — a module of their own,
 *  loaded after the first screen (main.ts) and merged into the table; a line of a quest read before they come stays in
 *  English till the screen draws it again. */
let campaignLoad: Promise<void> | null = null;
export function loadCampaignWords(): Promise<void> {
  // (tried again on a dropped connection; a load that failed for good is forgotten, so the next call tries anew)
  campaignLoad ??= importAgain(() => import('../../../shared/src/data/campaign/patterns.ts')).then((m) => {
    for (const [en, ru] of m.campaignPatterns()) if (TABLE[en] === undefined) TABLE[en] = ru;
    templates = null;
    exact.clear();
    campaignReady = true;
  }, () => {
    campaignLoad = null;
  });
  return campaignLoad;
}
let campaignReady = false;
export const campaignWordsReady = (): boolean => campaignReady;

/** A campaign quest's words (docs/36): in Russian once its words are in; before that an ellipsis, never English. */
export function cmpText(s: string): string {
  if (lang() !== 'ru' || campaignReady || !s) return serverText(s);
  const ru = serverText(s);
  return /[A-Za-z]/.test(ru) ? '…' : ru;
}

/** The whole English → Russian table of the server's lines: the static ones and every pattern generator's. */
export function serverTable(): Record<string, string> {
  return TABLE;
}
const exact = new Map<string, string>();
let templates: { re: RegExp; ru: string; order: number[]; adjacent: number[]; world: boolean }[] | null = null;

function compile(): void {
  templates = [];
  for (const [en, ru] of Object.entries(TABLE)) {
    if (!/\{\d+\}/.test(en)) {
      exact.set(en, ru);
      continue;
    }
    const order: number[] = [];
    const src = en.split(/(\{\d+\})/).map((part) => {
      const m = /^\{(\d+)\}$/.exec(part);
      if (m) {
        order.push(Number(m[1]));
        return '(.*?)'; // may be empty: the English plural 's' of a singular
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    // Parts side by side ("in {0}{1}"): the lazy match leaves the first empty, so they are split again below.
    const adjacent: number[] = [];
    let seen = 0;
    for (const m of en.matchAll(/\{\d+\}(?=(\{\d+\})?)/g)) {
      if (m[1]) adjacent.push(seen);
      seen++;
    }
    templates.push({ re: new RegExp(`^${src}$`, 's'), ru, order, adjacent, world: en.startsWith('WORLD: ') });
  }
  // The most literal text first: "Sold {0} sugar" before "{0} {1}".
  const lit = (t: { re: RegExp }) => t.re.source.replace(/\(\.\*\?\)/g, '').length;
  templates.sort((a, b) => lit(b) - lit(a));
}

/** Names the server lowers inside a sentence ("short of provisions"): the Russian name, lowered too. */
let lowerNames: Map<string, string> | null = null;
function lowerName(s: string): string | undefined {
  if (!lowerNames || lowerNames.size < NAME_RU.size) {
    lowerNames = new Map();
    for (const [en, ru] of NAME_RU) lowerNames.set(en.toLowerCase(), ru.charAt(0).toLowerCase() + ru.slice(1));
  }
  return s === s.toLowerCase() ? lowerNames.get(s) : undefined;
}

/** A fragment the tables know as it stands (a name, a phrase, a number). */
function known(s: string): boolean {
  return /^[\d\s.,:;×x+\-%]*$/.test(s) || NAME_RU.has(s) || exact.has(s) || TEXT_RU.has(s) || !!composedNameRu(s) || !!personNameRu(s) || lowerName(s) !== undefined;
}

/** "30 planks & pitch, 20 iron": counts of goods (or of anything the names know), one or a list (docs/15 item 8:
 *  the island's store lacks them). */
function counted(s: string): string | undefined {
  const out: string[] = [];
  for (const it of s.split(', ')) {
    const m = /^(\d[\d,.]*) (.+)$/.exec(it);
    // (the silver in a list of goods — «296 silver» — as the goods: QA circle, it kept the whole list in English)
    const n = m ? (m[2] === 'silver' ? 'серебро' : lowerName(m[2]) ?? NAME_RU.get(m[2])) : undefined;
    if (!m || !n) {
      // a phrase of its own among the goods («1 Provisions, paid 34 silver» — a hamlet's catch: mid-game QA 2026-10-23)
      const t = exact.get(it) ?? (templates ? translate(it, 2) : it);
      if (t === it || latin(t)) return undefined;
      out.push(t);
      continue;
    }
    out.push(`${n.charAt(0).toLowerCase()}${n.slice(1)} — ${m[1]}`); // «доски и смола — 30», as the yard's own line
  }
  return out.join(', ');
}

/** A captured fragment: a known name, a known phrase, or itself. */
function part(s: string, depth: number): string {
  if (!s) return s;
  return NAME_RU.get(s) ?? lowerName(s) ?? exact.get(s) ?? composedNameRu(s) ?? personNameRu(s) ?? counted(s) ?? (depth < 2 ? translate(s, depth + 1) : s);
}

function translate(s: string, depth: number): string {
  if (!templates) compile();
  // World news ("WORLD: …") is a heading over any sentence: the sentence is translated on its own.
  if (depth === 0 && s.startsWith('WORLD: ') && !exact.has(s)) {
    const rest = s.slice(7);
    const inner = translate(rest, 0);
    // News with a line of its own ("WORLD: {0} is first ashore…") is read whole when the line stripped of its
    // «WORLD:» was only half read by a looser template (QA, 2026-10-04: «Вести: Anna: добыча — the White Orca!»).
    const half = inner !== rest && latin(inner) > 0 && templates!.some((t) => t.world && t.re.test(s));
    if (!half && (inner !== rest || !templates!.some((t) => t.re.test(s)))) return `${exact.get('WORLD:') ?? 'Вести:'} ${inner}`;
  }
  // A giver's words as a job is taken ("Name, trade: “words” — the first step"): each part on its own, for a
  // job's own templates would swallow the whole line.
  // (A letter's word — «A letter from …: “subject” — N silver enclosed» — is read whole by its own template: QA,
  // 2026-10-04, the zone bosses' prize money came half in English.)
  if (depth === 0 && !exact.has(s) && !s.startsWith('A letter from ')) {
    const a = s.indexOf(': “'), b = s.lastIndexOf('” — ');
    if (a > 0 && b > a + 3) return `${translate(s.slice(0, a), 0)}: «${translate(s.slice(a + 3, b), 0)}» — ${translate(s.slice(b + 4), 0)}`;
  }
  const hit = exact.get(s) ?? TEXT_RU.get(s) ?? composedNameRu(s);
  if (hit) return hit;
  for (const t of templates!) {
    const m = t.re.exec(s);
    if (!m) continue;
    const caps = m.slice(1);
    for (const i of t.adjacent) {
      const c = caps[i + 1];
      if (caps[i] !== '' || !c || known(c)) continue;
      // One side must be known as it stands; the other may be a sentence of its own.
      const says = (x: string) => known(x) || (depth < 2 && translate(x, depth + 1) !== x);
      for (let k = 1; k < c.length; k++) {
        const l = c.slice(0, k), r = c.slice(k);
        if ((known(l) && says(r)) || (says(l) && known(r))) {
          caps[i] = l;
          caps[i + 1] = r;
          break;
        }
      }
    }
    const vals: Record<number, string> = {};
    t.order.forEach((n, i) => (vals[n] = part(caps[i], depth)));
    // A woman giver's verb takes her ending (questgen.ts feminineAfter).
    let ru = t.ru;
    t.order.forEach((n, i) => {
      if (GIVER_WOMEN.some((w) => caps[i]?.startsWith(`${w} `))) ru = feminineAfter(ru, `{${n}}`);
    });
    // A good inside the sentence is a common noun: «Доставить соль», not «Доставить Соль».
    return ru.replace(/\{(\d+)\}/g, (_, n: string, at: number) => {
      const v = vals[Number(n)] ?? '';
      return at > 0 && COMMON_RU.has(v) ? v.charAt(0).toLowerCase() + v.slice(1) : v;
    });
  }
  return s;
}

const latin = (s: string) => (s.match(/[A-Za-z]/g) ?? []).length;

/** A line of two parts ("A quest: its next step") may be read whole, or half by half when a template of one half
 *  would swallow the other: the reading that leaves less English wins. */
function translateLine(s: string): string {
  const whole = translate(s, 0);
  // A price's refusal with what is missing after it (owner, 2026-10-21; shared/src/data/buyfail.ts lackMore): «Needs 50
  // silver: 20 more needed» — the price's own line (with its full stop, as it is written alone) and the shortfall.
  const more = latin(whole) ? /^(.+): (\d+) more needed$/.exec(s) : null;
  if (more) {
    const a = translateLine(more[1]), b = translateLine(`${more[1]}.`);
    return `${(latin(b) < latin(a) ? b : a).replace(/\.$/, '')}: не хватает ещё ${more[2]}`;
  }
  const i = s.indexOf(': ');
  if (i <= 0 || !latin(whole)) return whole;
  const split = `${translateLine(s.slice(0, i))}: ${translateLine(s.slice(i + 2))}`;
  return latin(split) < latin(whole) ? split : whole;
}

const MONTHS_RU: Record<string, string> = { Jan: 'янв', Feb: 'фев', Mar: 'мар', Apr: 'апр', May: 'мая', Jun: 'июн', Jul: 'июл', Aug: 'авг', Sep: 'сен', Oct: 'окт', Nov: 'ноя', Dec: 'дек' };

export function serverText(s: string): string {
  if (lang() !== 'ru' || !s) return s;
  // Dates the server writes in English ("04 Oct 2026 00:36 UTC") keep their numbers, lose their English.
  // Thousands the server writes with commas (1,020 silver) take the Russian space that does not break; a fraction of a
  // kilometre takes the Russian comma («4,4 км», late-game QA 2026-10-23: «4.4 км» beside the lookout's «1,6 км»).
  // A name quoted in its own Russian («Фитиль и сало») inside a line that quotes it again keeps one pair of guillemets
  // («нападение на ««Фитиль и сало»»», QA 2026-10-09).
  // (a count's noun in the number's form: «22 человека», not the table's one word for all — lang/counts.ts)
  return typeset(feminineRu(s, ruCounts(translateLine(s)))).replace(/««([^«»]*)»»/g, '«$1»').replace(/(\d),(?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d)\.(\d+)(?=\s?(?:\u043a\u043c|\u043c\u00b3|\u0443\u0437\u043b)(?![\u0430-\u044f\u0451]))/g, '$1,$2').replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g, (_, d: string, m: string, y: string) => `${d} ${MONTHS_RU[m]} ${y}`);
}

/** For tests: how many patterns are known. */
export function serverPatterns(): number {
  return Object.keys(TABLE).length;
}

// docs/18 #50: the titled captains of the sea in Russian wherever a person's name is shown.
nameHooks.title = (en) => serverText(en);
