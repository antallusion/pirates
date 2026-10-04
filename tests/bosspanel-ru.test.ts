// QA, 2026-10-04: every line of every great one's panel reads in Russian on a Russian screen — its name, each phase's
// name and hint, and its parts (the Hollow Admiral's «… (lantern lit)» once came through in English).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_IDS, BOSSES } from '../shared/src/data/bosses.ts';
import { summon } from '../server/src/game/bosses.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { placeName } from '../client/src/ui/maps.ts';
import type { BossView } from '../shared/src/protocol.ts';
import { join, makeGame } from './helpers.ts';

const latin = (s: string) => (s.match(/[A-Za-z]{3,}/g) ?? []).join(' ');

test('every great one\'s panel — its name, phases, hints and parts — reads in Russian', () => {
  const { game } = makeGame();
  const c = join(game, 'Reader');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === 'Reader')!;
  const ship = s.ship!;
  ship.state.x = 40000;
  ship.state.y = 40000;
  const lines = new Map<string, string>();
  const bosses = game.bosses as unknown as { broadcast(g: typeof game): void; fights: Map<number, { phase: number; kind: string }> };
  for (const id of BOSS_IDS) {
    const f = summon(game, id, ship.state.x + 700, ship.state.y);
    for (let ph = 0; ph < Math.max(1, BOSSES[id].phases.length); ph++) {
      (f as unknown as { phase: number }).phase = ph;
      c.inbox.length = 0;
      bosses.broadcast(game);
      const list = (c.last('boss')?.list ?? []) as BossView[];
      const v = list.find((x) => x.kind === id);
      assert.ok(v, `${id}: a panel within reach`);
      for (const t of [v.name, v.phaseName, v.hint, ...v.parts.map((p) => p.label)]) if (t) lines.set(t, id);
    }
    bosses.fights.delete(f.id as unknown as number);
    game.removeShip((f as unknown as { id: number }).id);
  }
  setLang('ru');
  applyDataLocale('ru');
  try {
    // As the panel reads them (client/src/ui/hud.ts): a ship «name (lantern lit)» by its name and a light.
    const read = (t: string) => {
      const lamp = /^(.*) \(lantern (?:lit|out)\)$/.exec(t);
      return lamp ? placeName(lamp[1]) : serverText(t);
    };
    const english = [...lines].map(([t, id]) => ({ id, t, ru: read(t) })).filter((x) => latin(x.ru));
    assert.deepEqual(english.map((x) => `${x.id}: ${x.t} → ${x.ru}`), [], 'every line in Russian');
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
