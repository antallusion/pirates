// The mentors' play run fast (owner, 2026-11-15: «они должны качаться… проходить кампанию»): one mentor in a game of
// its own, the sea's clock run as fast as the machine goes; every five minutes of the sea her level, the campaign's
// quest and step, the steps credited (stuck), where she is. `node tools/mentor-sim.ts [hours] [mentor 0-2]`
import { makeGame, steps } from '../tests/helpers.ts';
import { Mentors } from '../server/src/game/mentors.ts';
import { campaignActive } from '../server/src/game/campaign.ts';
import { routeOf } from '../server/src/game/goalroute.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { TICK_RATE } from '../shared/src/constants.ts';

const hours = Number(process.argv[2] ?? 1);
const { game } = makeGame();
game.directorOn = true;
game.tacticalBoarding = true;
const http = (async () => { throw new Error('no model'); }) as never;
const mt = new Mentors(game, '', http);
mt.start(0);
mt.nextChat = Infinity;
const m = mt.list[Number(process.argv[3] ?? 0)];
const t0 = Date.now();
const said = new Map<string, number>();
const hear0 = (mt as unknown as { hear: (x: unknown, y: { t: string; msg?: string }) => void }).hear.bind(mt);
(mt as unknown as { hear: (x: unknown, y: { t: string; msg?: string }) => void }).hear = (x, y) => { if (x === m && y.t === "toast" && process.env.TOASTS) { const q0 = m.s.profile ? campaignActive(m.s.profile) : undefined; const k = `${y.msg} [${q0 ? QUESTS_BY_ID[q0.id].steps[q0.step]?.type : "-"}]`; said.set(k, (said.get(k) ?? 0) + 1); } hear0(x, y); };
process.on("exit", () => { if (process.env.TOASTS) console.log([...said].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${v}x ${k}`).join(String.fromCharCode(10))); });
let last = '';
for (let sec = 0; sec < hours * 3600; sec += 5) {
  steps(game, 5 * TICK_RATE);
  mt.tick();
  const p = m.s.profile, ship = m.s.ship;
  if (!p || !ship) continue;
  const qs = campaignActive(p);
  const st = qs ? QUESTS_BY_ID[qs.id].steps[qs.step] : undefined;
  const now = `${qs?.id ?? '-'}#${qs?.step ?? '-'} ${st?.type ?? ''}`;
  if (sec % 300 === 0 || now !== last) {
    console.log(`${(sec / 60).toFixed(1).padStart(6)}m L${p.level} xp${p.xp} at${p.campaign?.at} ${now} cred${m.credited} sunk${p.stats.sunk} brd${p.stats.boarded} hull${Math.round((100 * ship.hull) / ship.stats.hullMax)}% ${ship.alive ? '' : 'DEAD '}${ship.docked ? `dock:${ship.docked}` : `sea(${Math.round(ship.state.x)},${Math.round(ship.state.y)})`} ${routeOf(game, m.s) ? 'route' : ''}`);
    last = now;
  }
}
console.log(`real ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(0);
