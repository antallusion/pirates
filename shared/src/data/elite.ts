// Group contracts (docs/11 P6), as WoW's [Group] quests: every port posts one a day — a raiders' flagship with two
// escorts in its waters, too strong for one ship, marked for a company of three. Everyone who takes the day's
// contract hunts the same flagship, and a groupmate's kill counts for the whole company.

import { REGIONS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import { hashString } from '../rng.ts';
import { QUESTS_BY_ID } from './quests.ts';
import type { QuestDef } from './quests.ts';
import { legacyQuestSize, questXp } from './xpcurve.ts';

/** The company a contract is made for. */
export const ELITE_GROUP = 3;

/** How strong the contract's quarry is, by the safety of the port's waters. */
const ELITE_LEVEL: Record<string, number> = { safe: 10, contested: 16, lawless: 24 };

const FLAVOURS: { name: [string, string]; summary: [string, string] }[] = [
  {
    name: ['The Iron Bounty', 'Железная награда'],
    summary: ['A raiders\' flagship and two escorts are bleeding the waters of {0}. No single ship will take her: gather a company.', 'Флагман налётчиков с двумя конвоирами обескровливает воды «{0}». Одному кораблю его не взять — соберите отряд.'],
  },
  {
    name: ['A Price on the Flagship', 'Цена за флагман'],
    summary: ['The office pays a fortune for one hull: the raider flagship that hunts in {0} with her two dogs. Bring friends.', 'Контора платит состояние за один корпус: флагман налётчиков, что охотится с двумя псами в водах «{0}». Возьмите друзей.'],
  },
  {
    name: ['The Warrant of the Office', 'Ордер портовой конторы'],
    summary: ['A warrant is out for the flagship of a raiding squadron in {0}. Three ships sail together; so should you.', 'Выписан ордер на флагман эскадры налётчиков в водах «{0}». Их трое — идите и вы не в одиночку.'],
  },
  {
    name: ['Blood Money for the Raider', 'Кровавые деньги за рейдера'],
    summary: ['Widows on the quay have pooled their silver for the raider who sank their men in {0}. She never sails alone.', 'Вдовы на причале сложились серебром за рейдера, потопившего их мужей в водах «{0}». Он никогда не ходит один.'],
  },
];

const STEP_SINK: [string, string] = ['Sink the raiders\' flagship in {0} (the gold mark leads to her).', 'Потопите флагман налётчиков в водах «{0}» — золотая метка ведёт к нему.'];
const STEP_HOME: [string, string] = ['Return to {0} for the bounty.', 'Вернитесь за наградой в порт {0}.'];
const MENTOR: [string, string] = ['The harbour office', 'Портовая контора'];

function fill(t: string, v: string): string {
  return t.replace('{0}', v);
}

/** Ports known to the contracts (their names and waters), set when the world is made. */
const PORTS = new Map<string, { id: string; name: string; region: RegionId }>();
export function registerElitePorts(ports: { id: string; name: string; region: RegionId }[]): void {
  PORTS.clear();
  for (const p of ports) PORTS.set(p.id, { id: p.id, name: p.name, region: p.region });
}

/** The quarry's strength for a port's waters. */
export function eliteLevel(region: RegionId): number {
  return ELITE_LEVEL[REGIONS[region].safety] ?? 10;
}

/** A port's contract of the day (registered as a quest, so journals and saved captains find it). */
export function eliteContractFor(portId: string, day: number): QuestDef | null {
  const id = `elite_${portId}_${day}`;
  if (QUESTS_BY_ID[id]) return QUESTS_BY_ID[id];
  const port = PORTS.get(portId);
  if (!port) return null;
  const f = FLAVOURS[hashString(id) % FLAVOURS.length];
  const region = REGIONS[port.region].name;
  const level = eliteLevel(port.region);
  const scale = 1 + level / 10;
  const q: QuestDef = {
    id, kind: 'job', name: f.name[0], mentor: MENTOR[0], port: port.id, summary: fill(f.summary[0], region), requires: { level: Math.max(1, level - 4) },
    steps: [
      { type: 'sink', count: 1, role: 'elite', region: port.region, text: fill(STEP_SINK[0], region) },
      { type: 'visit', port: port.id, text: fill(STEP_HOME[0], port.name) },
    ],
    reward: { xp: questXp(Math.max(1, level - 4), legacyQuestSize(1000 * scale, Math.max(1, level - 4))), silver: Math.round(1400 * scale) },
    category: 'elite', group: ELITE_GROUP, portrait: 'giver_harbour_master_m',
  };
  QUESTS_BY_ID[id] = q;
  return q;
}

/** A contract by its id (a saved captain's journal after a restart). */
export function eliteById(id: string): QuestDef | null {
  const m = /^elite_(.+)_(\d+)$/.exec(id);
  return m ? eliteContractFor(m[1], Number(m[2])) : null;
}

/** The server's lines about the contracts, English → Russian ({0} a region, a port or a name). */
export function elitePatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const f of FLAVOURS) out.push(f.name, f.summary);
  out.push(STEP_SINK, STEP_HOME, MENTOR);
  out.push(['{0} sails the {1} with two escorts in {2}. Take a company.', '{0} ведёт «{1}» с двумя конвоирами в водах «{2}». Возьмите отряд.']);
  out.push(["{0} and company sank the raiders' flagship {1} in {2}.", '{0} с отрядом потопили флагман налётчиков «{1}» в водах «{2}».']);
  return out;
}
