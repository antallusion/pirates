// What the server says, in the player's language. The server speaks English; every sentence it can say is a pattern
// (tools/i18n-server.ts: "Sold {0} {1}."). An incoming toast is matched against the patterns — exact sentences
// first, then the most specific template — and the Russian twin is filled with the captured parts, which are
// themselves translated when they are known names or phrases. Unknown text passes through unchanged.

import { fishingPatterns } from '../../../shared/src/data/fishing.ts';
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
import { SERVER_RU_ARMS } from './server.ru.arms.ts'; // the yard's wider trade (2026-10-03)
import { SERVER_RU_PREMIUM } from './server.ru.premium.ts'; // the premium shop (owner, 2026-10-03)
import { SERVER_RU_BEASTS100 } from './server.ru.beasts100.ts'; // the hundred creatures (owner, 2026-10-03; docs/18 VII)
import { SERVER_RU_FLEET } from './server.ru.fleet.ts'; // the fleet of eighty (owner, 2026-10-03)
import { SERVER_RU_BOSSES } from './server.ru.bosses.ts'; // the ten bosses (owner, 2026-10-03)
import { SERVER_RU_V18 } from './server.ru.v18.ts';
import { SERVER_RU_THRONE } from './server.ru.throne.ts'; // docs/19 E1–E3
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
import { feminineRu, questPatterns } from '../../../shared/src/data/questgen.ts';
import { lairQuestPatterns } from '../../../shared/src/data/lairquests.ts';
import { arcPatterns } from '../../../shared/src/data/questarcs.ts';
import { dailyPatterns } from '../../../shared/src/data/dailies.ts';
import { commonPatterns } from '../../../shared/src/data/commongoal.ts';
import { guildGoalPatterns } from '../../../shared/src/data/guildgoal.ts';
import { elitePatterns } from '../../../shared/src/data/elite.ts';
import { questTitlePatterns } from '../../../shared/src/data/questtitles.ts';
import { taskPatterns } from '../../../shared/src/data/worldtasks.ts';

// The generated jobs' templates carry their Russian twins (shared/src/data/questgen.ts).
const TABLE: Record<string, string> = { ...Object.fromEntries(questPatterns()), ...Object.fromEntries(lairQuestPatterns()), ...Object.fromEntries(arcPatterns()), ...Object.fromEntries(dailyPatterns()), ...Object.fromEntries(commonPatterns()), ...Object.fromEntries(guildGoalPatterns()), ...Object.fromEntries(elitePatterns()), ...Object.fromEntries(questTitlePatterns()), ...Object.fromEntries(taskPatterns()), ...Object.fromEntries(levelPatterns()), ...Object.fromEntries(gearPatterns()), ...Object.fromEntries(encounterPatterns()), ...Object.fromEntries(happeningPatterns()), ...Object.fromEntries(fishingPatterns()), ...Object.fromEntries(beastPatterns()), ...Object.fromEntries(piratePatterns()), ...Object.fromEntries(raidPatterns()), ...Object.fromEntries(estatePatterns()), ...Object.fromEntries(caravanPatterns()), ...Object.fromEntries(sidePatterns()), ...Object.fromEntries(nemesisPatterns()), ...Object.fromEntries(companionPatterns()), ...Object.fromEntries(petPatterns()), ...Object.fromEntries(shantyPatterns()), ...Object.fromEntries(dicePatterns()), ...Object.fromEntries(regattaPatterns()), ...Object.fromEntries(bottlePatterns()), ...Object.fromEntries(chestPatterns()), ...Object.fromEntries(wonderPatterns()), ...Object.fromEntries(omenPatterns()), ...Object.fromEntries(dutchmanPatterns()), ...Object.fromEntries(fatePatterns()), ...Object.fromEntries(lookPatterns()), ...Object.fromEntries(guestPatterns()), ...Object.fromEntries(stormPatterns()), ...Object.fromEntries(servicePatterns()), ...Object.fromEntries(turncoatPatterns()), ...Object.fromEntries(descentPatterns()), ...Object.fromEntries(holidayPatterns()), ...Object.fromEntries(bazaarPatterns()), ...Object.fromEntries(sagaPatterns()), ...Object.fromEntries(renownPatterns()), ...Object.fromEntries(socialPatterns()), ...Object.fromEntries(settlementPatterns()), ...Object.fromEntries(raftPatterns()), ...Object.fromEntries(itemNamePatterns()), ...SERVER_RU_A, ...SERVER_RU_B, ...SERVER_RU_ADMIN, ...SERVER_RU_G, ...SERVER_RU_H, ...SERVER_RU_H3, ...Object.fromEntries(heroPatterns()), ...Object.fromEntries(artifactPatterns()), ...SERVER_RU_HERO, ...SERVER_RU_H4, ...SERVER_RU_H5, ...SERVER_RU_ISLES18, ...SERVER_RU_PATH, ...SERVER_RU_LAIRS, ...SERVER_RU_DRIFTS, ...SERVER_RU_V18, ...SERVER_RU_MARKS, ...SERVER_RU_THRONE, ...SERVER_RU_FINDS, ...SERVER_RU_ROAM, ...SERVER_RU_ARMS, ...SERVER_RU_PREMIUM, ...SERVER_RU_BEASTS100, ...SERVER_RU_FLEET, ...SERVER_RU_BOSSES };
/** The whole English → Russian table of the server's lines: the static ones and every pattern generator's. */
export function serverTable(): Record<string, string> {
  return TABLE;
}
const exact = new Map<string, string>();
let templates: { re: RegExp; ru: string; order: number[]; adjacent: number[] }[] | null = null;

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
    templates.push({ re: new RegExp(`^${src}$`, 's'), ru, order, adjacent });
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
    const n = m ? (lowerName(m[2]) ?? NAME_RU.get(m[2])) : undefined;
    if (!m || !n) return undefined;
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
    if (inner !== rest || !templates!.some((t) => t.re.test(s))) return `${exact.get('WORLD:') ?? 'Вести:'} ${inner}`;
  }
  // A giver's words as a job is taken ("Name, trade: “words” — the first step"): each part on its own, for a
  // job's own templates would swallow the whole line.
  if (depth === 0 && !exact.has(s)) {
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
    // A good inside the sentence is a common noun: «Доставить соль», not «Доставить Соль».
    return t.ru.replace(/\{(\d+)\}/g, (_, n: string, at: number) => {
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
  const i = s.indexOf(': ');
  if (i <= 0 || !latin(whole)) return whole;
  const split = `${translateLine(s.slice(0, i))}: ${translateLine(s.slice(i + 2))}`;
  return latin(split) < latin(whole) ? split : whole;
}

const MONTHS_RU: Record<string, string> = { Jan: 'янв', Feb: 'фев', Mar: 'мар', Apr: 'апр', May: 'мая', Jun: 'июн', Jul: 'июл', Aug: 'авг', Sep: 'сен', Oct: 'окт', Nov: 'ноя', Dec: 'дек' };

export function serverText(s: string): string {
  if (lang() !== 'ru' || !s) return s;
  // Dates the server writes in English ("04 Oct 2026 00:36 UTC") keep their numbers, lose their English.
  // Thousands the server writes with commas (1,020 silver) take the Russian space that does not break.
  return typeset(feminineRu(s, translateLine(s))).replace(/(\d),(?=\d{3}(?!\d))/g, '$1\u00a0').replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/g, (_, d: string, m: string, y: string) => `${d} ${MONTHS_RU[m]} ${y}`);
}

/** For tests: how many patterns are known. */
export function serverPatterns(): number {
  return Object.keys(TABLE).length;
}

// docs/18 #50: the titled captains of the sea in Russian wherever a person's name is shown.
nameHooks.title = (en) => serverText(en);
