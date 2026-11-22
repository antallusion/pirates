// An island put right once (forum 128, Эдуард, 2026-11-21): with every building slot taken he razed his tar works and
// his fishery, both at level 5, to free a plot for a building — the island never said a free plot takes producers only
// (base.ts whyNot; the empty plot now says so). Both are set back at level 5 and a letter tells him why.

import type { ProducerKind } from '../../../shared/src/data/base.ts';
import { plotCount, yardOf } from './base.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { deliver } from './post.ts';

interface IsleFix {
  ref: string;
  account: number;
  island: number;
  restore: { kind: ProducerKind; level: number }[];
}

export const ISLE_FIXES: IsleFix[] = [{ ref: 'raze128:161:2026-11-21', account: 161, island: 25, restore: [{ kind: 'tar', level: 5 }, { kind: 'fishery', level: 5 }] }];
const KEY = 'islefix_done';

/** Applies a fix: each producer back at its level (the one standing of its kind raised, else laid on a free plot). */
export function applyIsleFix(game: Game, f: IsleFix): string[] {
  const h = ownIsland(game, f.account);
  if (!h || h.island !== f.island) return [];
  const y = yardOf(game, h);
  const done: string[] = [];
  const taken = (plot: number) => h.buildings.some((b) => b.plot === plot) || y.producers.some((p) => p.plot === plot) || y.jobs.some((j) => j.plot === plot);
  for (const r of f.restore) {
    const have = y.producers.filter((p) => p.kind === r.kind).sort((a, b) => a.level - b.level)[0];
    if (have && have.level < r.level) {
      have.level = r.level;
      y.jobs = y.jobs.filter((j) => !(j.plot === have.plot && !j.ship));
      done.push(`${r.kind}:${r.level}@${have.plot}`);
      continue;
    }
    if (have) continue;
    let plot = -1;
    for (let k = 0; k < plotCount(game, h) && plot < 0; k++) if (!taken(k)) plot = k;
    if (plot < 0) continue;
    y.producers.push({ kind: r.kind, plot, level: r.level });
    done.push(`${r.kind}:${r.level}@${plot}`);
  }
  if (done.length) {
    game.holdings.touch();
    deliver(game, f.account, {
      from: 'Команда GRAVETIDE',
      subject: 'Смолокурня и рыбная артель возвращены',
      body:
        'Капитан, вы снесли смолокурню и рыбную артель 5-го уровня, чтобы освободить участок под здание. Остров не предупредил вас, что все места под здания уже заняты, а свободный участок принимает только промыслы. Это наша недоработка: теперь пустой участок говорит об этом прямо.\n\n' +
        'Оба промысла возвращены на остров на 5-м уровне, а серебро, полученное за снос, остаётся у вас. Попутного ветра!',
      gold: 0,
      goods: null,
    });
    game.db.ledger(f.account, 'isle_fix', 0, `${f.ref}:${done.join(',')}`);
  }
  return done;
}

/** Every two seconds: a fix not yet done is applied, once. */
export function stepIsleFix(game: Game): void {
  const doneRefs = game.db.getKv<string[]>(KEY) ?? [];
  for (const f of ISLE_FIXES) {
    if (doneRefs.includes(f.ref)) continue;
    if (!ownIsland(game, f.account)) continue;
    const r = applyIsleFix(game, f);
    game.db.setKv(KEY, [...doneRefs, f.ref]);
    console.log(`[islefix] ${f.ref}: ${r.length ? r.join(', ') : 'nothing to do'}`);
  }
}
