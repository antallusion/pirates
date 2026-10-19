// The main campaign (docs/36, owner 2026-10-17: «в сюжете минимум (в кампании главной) должно быть 700 крутых квестов и
// только пройдя их ты должен быть максимального уровня, не считая побочек»). The source the chapters are written in:
// every text a pair [English, Russian], every step a short code the builder (build.ts) lays on the world's ports and
// islands of the chapter's seas at the quest's level, with its words from steps.ts or the chapter's own.

import type { RegionId } from '../../world/regions.ts';

/** A text in both tongues: [English, Russian]. Places come as placeholders (see PLACEHOLDERS), never written out. */
export type T = [string, string];

/**
 * A step's code (1–4 steps a quest; `carry` is two steps):
 *
 *   hub                      put in at the chapter's port (its mentor waits there)
 *   at:<port id>             put in at that very port ({at}): gravesend, cinderhold, saltmarrow…
 *   port | port2             put in at a port of the chapter's seas picked for this quest ({port}, {port2})
 *   isle | isle2             sail into the waters of an island ({isle}, {isle2}) — a visit, no landing
 *   land | land2             land a party on {isle} / {isle2}
 *   land:<site>              land at a site of the island: ruins | shrine | bell | fishers | smugglers | pirate_camp | seals | crabs | turtles
 *   board[:N]                take N ships by boarding (ships of the quest's level or above)
 *   sink[:N][:role]          sink N ships (role: pirate | ghost | patrol | merchant | hunter; none: any flag)
 *   lair[:N]                 beat N lairs of the land's creatures
 *   beast[:group][:N]        hunt N beasts of the sea (group: whale | orca | shark | any)
 *   chart[:N]                chart N islands never seen
 *   dive[:N]                 send divers down to N wrecks
 *   catch[:N]                take N fish
 *   named                    sink a named pirate captain (the Hunters' Guild's wanted)
 *   rescue[:N]               save N souls from the sea
 *   prize                    bring a prize ship to a prize court
 *   tribute[:N]              take N tributes from merchants
 *   carry:<good>[:N]         take on N of a good at {port}, deliver it to {port2} (two steps)
 *   bring:<good>[:N]         deliver N of a good to the hub (she buys it where it is sold)
 *   escort[:min]             hold the chapter's waters for N minutes at sea (a convoy seen through, a watch kept)
 *   reach                    sail into the chapter's sea ({region})
 *   claim                    hold an island of your own (claim one)
 *   build[:N]                lay N works on your own island (a building, a producer, a level)
 *   recruit[:N]              sign on N men for the ship's army (a tavern, a dwelling)
 *   customs                  pass a Crown inspection with contraband aboard
 *   contraband[:N]           sell N units of contraband at a black market
 *   buy:<shop>               buy at a port's shop (provisions | sailcloth | arms: guns or hands | trade: a good)
 *   neutral[:N]              beat N neutral stacks: the sea's roaming creatures (or a lair of the land's)
 *   found                    sail to the island nearest the location (the opening's: the start's) and claim it
 *
 * A count left out is the builder's, by the quest's level (more and harder further on).
 */
export type StepCode = string;

/** A step: its code, or its code with the chapter's own words (placeholders as in PLACEHOLDERS; {n} the count). */
export type StepSrc = StepCode | [StepCode, string, string];

/** The placeholders a text may use. {giver} is the chapter's mentor; {hub} her port; {n} a step's count; {good} its
 *  good; {site} its site; {region} the chapter's sea. */
export const PLACEHOLDERS = ['hub', 'at', 'port', 'port2', 'isle', 'isle2', 'region', 'giver', 'n', 'good', 'site'] as const;

/** One quest of a chapter. */
export interface QuestSrc {
  /** The title (2–5 words, no placeholders: the journal shows it by itself). */
  t: T;
  /** The briefing: 1–3 sentences, who asks, what is at stake. */
  b: T;
  /** The completion line: one short sentence. */
  d: T;
  /** 1–4 steps (a `carry` counts two). */
  s: StepSrc[];
  /** The campaign's opening (owner, 2026-10-19: «обучение по покупкам… атака корабля… абордаж… нападение на нейтралов…
   *  к ближайшему острову основать свой город… в первые минут 5-10 с учетом плаваний»): its fights put out on the lane
   *  from the start's quay to the island its town is founded on, at this share of the way (and within `r` of it), so
   *  the newcomer sails one short course and meets them on it. */
  lane?: { at: number; r: number };
  /** A branch (a choice of two ways): this quest is the first way, `alt` the second. Both fill the same place in the
   *  campaign; the choice is remembered under `key` (and told in docs/36). */
  alt?: { key: string; /** the two ways' labels, as the cards say them */ label: [T, T]; t: T; b: T; d: T; s: StepSrc[] };
}

/** A chapter of the campaign. */
export interface ChapterSrc {
  n: number;
  /** The sea it is played in; places are drawn from it (and `more`) at the quest's level. */
  region: RegionId;
  more?: RegionId[];
  /** The port of its mentor (a fixed port id, shared/src/world/regions.ts KEY_PORTS or newports.ts NEW_PORTS). */
  hub: string;
  title: T;
  /** One or two sentences for the journal's page. */
  blurb: T;
  /** Who gives its quests: [name and calling, имя и звание] — «Орен Галт, лоцман». */
  giver: T;
  /** The giver's face (portrait.giver_<profession>_<f|m>). */
  portrait: string;
  quests: QuestSrc[];
  /** The chapter's end: a title to wear, a treasure map, shot for the guns. */
  reward?: { title?: T; map?: 1 | 2 | 3; ammo?: boolean };
}
