// The creature jobs of the ports' boards (docs/18 II item 23): «clear the island of crabs», «bring the shell of the rock
// turtles», «break the lairs of these waters» — generated beside the quest generator's own (docs/11 P4) with their own
// dice, from the lairs within a short sail of each port, so the generator's jobs a saved game knows keep their ids.
// Each template carries its Russian twin (the client makes translation patterns of them, as of questgen's).

import { advHour } from './advmap.ts';
import { BEAST_PLURAL, LAND_RES_DEF } from './bestiary.ts';
import type { LandRes } from './bestiary.ts';
import { LAIRS, buildLairs } from './lairs.ts';
import type { Lair } from './lairs.ts';
import { GIVER_MEN, GIVER_WOMEN, GIVER_LAST, PROFESSIONS, fill, giverPortrait, numberedPattern } from './questgen.ts';
import type { Profession } from './questgen.ts';
import type { QuestDef } from './quests.ts';
import { captainLevelFor } from './shiplevel.ts';
import { Rng, hashString } from '../rng.ts';
import { questXp } from './xpcurve.ts';
import { REGIONS } from '../world/regions.ts';
import type { World } from '../world/worldgen.ts';

interface Plot {
  id: 'clear' | 'bring' | 'cull';
  giver: Profession[];
  name: [string, string];
  summary: [string, string];
  steps: [string, string][];
}

export const LAIR_PLOTS: Plot[] = [
  {
    id: 'clear', giver: ['fishwife', 'old_salt', 'pearl_diver', 'hermit'],
    name: ['Clear {island} of the {beasts}', 'Очистить остров {island}: {beasts}'],
    summary: ['{giver} cannot put a boat ashore on {island} for the {beasts} of its {lair}. Land a party and clear them out.', '{giver} не может высадиться на острове {island}: там «{lair}» — {beasts}. Высадите отряд и очистите остров.'],
    steps: [['Beat the {lair} on {island}.', 'Разбейте логово «{lair}» на острове {island}.'], ['Return to {port}: {giver} is waiting.', 'Вернитесь в порт {port}: вас ждёт {giver}.']],
  },
  {
    id: 'bring', giver: ['apothecary', 'shipwright', 'merchant', 'priest'],
    name: ['{res} for {giver}', '{res} для заказчика: {giver}'],
    summary: ['{giver} pays well for {res} from the lairs of the land\'s creatures: {n} pieces, brought to {port}.', '{giver} хорошо платит за {res} из логов существ суши: {n} шт., доставить в порт {port}.'],
    steps: [['Bring {res} × {n} to {port}.', 'Доставьте в порт {port}: {res} × {n}.']],
  },
  {
    id: 'cull', giver: ['garrison_captain', 'harbour_master', 'whaler', 'bosun'],
    name: ['The Lairs of {region}', 'Логова вод «{region}»'],
    summary: ['{giver} wants the islands of {region} safe for the boats again: break {n} lairs of the land\'s creatures there.', '{giver} хочет, чтобы на острова вод «{region}» снова можно было высаживаться: разбейте там логова существ суши — {n}.'],
    steps: [['Beat lairs of the land\'s creatures: {n}.', 'Разбейте логова существ суши: {n}.'], ['Return to {port}: {giver} is waiting.', 'Вернитесь в порт {port}: вас ждёт {giver}.']],
  },
];

/** A creature job's size against a quest of the usual size (docs/26): an island cleared and the way back, each lair of a
 *  cull, the resources brought (the lairs' own fights teach beside it). */
export const LAIR_JOB_SIZE: Record<Plot['id'], number> = { clear: 1, cull: 0.5, bring: 0.8 };

/** What each land resource is called in a job's line (the client words it). */
const RES_NAME: Record<LandRes, string> = { shell: 'Shell', bone: 'Bone', venom: 'Venom' };

/** Three creature jobs a port (clear an island, bring a resource, break the lairs of its waters), the same on every
 *  server of this seed; none when no lair lies within a short sail of it. */
export function generateLairJobs(world: World, seed: number): QuestDef[] {
  const out: QuestDef[] = [];
  // The first three a port as they always were (the lairs before docs/19 D2, the islands hidden before D4), then
  // (docs/19 D4) three more on dice of their own over every lair near — another lair where there is one.
  const all = buildLairs(world).filter((l) => l.island >= 0 && l.role === 'shore');
  const legacy = all.filter((l) => !l.id.endsWith('d') && !(world.islands[l.island]?.hidden && !world.islands[l.island]?.veil));
  const lairs = all.filter((l) => !world.islands[l.island]?.hidden);
  for (const port of world.ports) {
    if (port.raft) continue;
    const by = (a: Lair, b: Lair) => Math.hypot(a.x - port.x, a.y - port.y) - Math.hypot(b.x - port.x, b.y - port.y);
    const near0 = legacy.filter((l) => Math.hypot(l.x - port.x, l.y - port.y) < 24000).sort(by);
    if (!near0.length) continue;
    const rng0 = new Rng((hashString(`lairjobs:${port.id}`) ^ (seed * 2246822519)) >>> 0);
    const first: Lair = near0[rng0.int(0, Math.min(near0.length, 6) - 1)];
    const near1 = lairs.filter((l) => l !== first && Math.hypot(l.x - port.x, l.y - port.y) < 24000).sort(by);
    const rng1 = new Rng((hashString(`lairjobs2:${port.id}`) ^ (seed * 2246822519)) >>> 0);
    for (const [pick, rng, tag] of [[first, rng0, ''], ...(near1.length ? [[near1[rng1.int(0, Math.min(near1.length, 8) - 1)], rng1, '_2']] : [])] as [Lair, Rng, string][]) {
      const level = pick.level;
      const hour = advHour(level);
      for (const plot of LAIR_PLOTS) {
        const profession = plot.giver[rng.int(0, plot.giver.length - 1)];
        const giver = `${rng.pick(rng.chance(0.5) ? GIVER_MEN : GIVER_WOMEN)} ${rng.pick(GIVER_LAST)}`;
        const def = LAIRS[pick.kind];
        const res = (Object.keys(LAND_RES_DEF) as LandRes[])[rng.int(0, 2)];
        const n = plot.id === 'bring' ? rng.int(4, 10) : plot.id === 'cull' ? rng.int(2, 3) : 1;
        const v: Record<string, string> = {
          giver, port: port.name, island: world.islands[pick.island].name, lair: def.name[0], beasts: BEAST_PLURAL[def.mix[0][0]][0], res: RES_NAME[res], n: String(n), region: REGIONS[port.region].name,
        };
        const steps: QuestDef['steps'] = plot.id === 'clear'
          ? [{ type: 'lair', count: 1, island: pick.island, kind: pick.kind, text: fill(plot.steps[0][0], v) }, { type: 'visit', port: port.id, text: fill(plot.steps[1][0], v) }]
          : plot.id === 'bring'
          ? [{ type: 'landres', port: port.id, res, qty: n, text: fill(plot.steps[0][0], v) }]
          : [{ type: 'lair', count: n, text: fill(plot.steps[0][0], v) }, { type: 'visit', port: port.id, text: fill(plot.steps[1][0], v) }];
        const worth = plot.id === 'bring' ? n * LAND_RES_DEF[res].value * 1.6 : plot.id === 'cull' ? hour * 0.25 * n : hour * 0.3;
        out.push({
          id: `lj_${port.id}_${plot.id}${tag}`, kind: 'job', name: fill(plot.name[0], v), mentor: `${giver}, ${PROFESSIONS[profession][0]}`, port: port.id, summary: fill(plot.summary[0], v),
          requires: { level: Math.max(1, captainLevelFor(Math.max(1, level - 1))) }, steps, reward: { xp: questXp(Math.max(1, captainLevelFor(Math.max(1, level - 1))), LAIR_JOB_SIZE[plot.id] * (plot.id === 'cull' ? n : 1)), silver: Math.round(worth / 10) * 10 },
          category: 'hunt', template: `lair.${plot.id}`, portrait: giverPortrait(profession, giver),
        });
      }
    }
  }
  return out;
}

/** Every creature job's template, English and Russian (placeholders numbered by first use), for the client. */
export function lairQuestPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const p of LAIR_PLOTS) {
    out.push(numberedPattern(p.name[0], p.name[1]), numberedPattern(p.summary[0], p.summary[1]));
    for (const [en, ru] of p.steps) out.push(numberedPattern(en, ru));
  }
  for (const [k, en] of Object.entries(RES_NAME)) out.push([en, LAND_RES_DEF[k as LandRes].name[1].replace(/^./, (c) => c.toUpperCase())]);
  return out;
}
