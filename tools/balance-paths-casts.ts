// Which orders each path gives in the battle (tools/balance-paths.ts's fights): node tools/balance-paths-casts.ts [level] [path]
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { newBattle, quickFinish, tacStats } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { HAMMOCKS, pathHero } from './balance-paths.ts';

const level = Number(process.argv[2] ?? 55);
const who = (process.argv[3] ?? 'corsair') as CaptainId;
const sl = Math.min(10, Math.ceil(level / 6));
const army = armyForLevel(sl, HAMMOCKS[sl], 7, 'player');
const side = (hero: HeroBattle, c: CaptainId): TacSideInput => ({ name: 'C', ship: 'W', captain: c, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero });
tacStats.on = true;
let rounds = 0, n = 0;
for (const b of CAPTAIN_IDS) for (let k = 0; k < 20; k++) {
  const rng = new Rng(1000 + k * 17);
  const bt = newBattle(side(pathHero(who, level, 11 + k * 7), who), side(pathHero(b, level, 5 + k * 13), b), k + 1, 0, rng);
  quickFinish(bt, 0, rng);
  rounds += bt.round;
  n++;
}
console.log(`${who} at ${level}: ${(rounds / n).toFixed(1)} rounds a battle; orders a battle:`);
for (const [k, v] of [...tacStats.casts].filter(([k]) => k.startsWith(`${who}:`)).sort((a, b) => b[1] - a[1])) console.log(`  ${k.slice(who.length + 1).padEnd(20)} ${(v / n).toFixed(2)}`);
