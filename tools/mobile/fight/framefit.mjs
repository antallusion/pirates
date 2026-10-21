// Owner, 2026-10-21: the creatures' poses at one height (shared/src/data/framefit.ts). The boarding field's own figure
// painter (TacticalPanel.figure, the code a battle draws its stacks with) on a sheet over the page: each kind's idle
// stack beside the same stack mid-blow (and mid-flinch), with the fit off (as before) and on.
//
//   GPORT=58640 SIZE=844x390 OUT=docs/img/framefit node tools/mobile/fight/framefit.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const OUT = process.env.OUT ?? 'docs/img/framefit';
mkdirSync(OUT, { recursive: true });
const KINDS = (process.env.KINDS ?? 'merrow_warden,cormorant,hammerhead,mire_mother,lagoon_tentacle,reef_raider,boat_steerer,giant_manta,cinder_salamander,moray,crab,sea_naga').split(',');
const b = await L.browser();
const p = await L.page(b, [W, H], { lang: 'ru' });
try {
  await L.login(p, { port: Number(process.env.GPORT ?? 58640), name: 'Fit' + Math.random().toString(36).slice(2, 6), know: true });
  await L.closeAll(p, 3);
  const ok = await p.evaluate(async (kinds) => {
    const A = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/src\/assets\.ts(\?|$)/.test(n))); // the app's own instance (its ?b= stamp)
    const ids = kinds.flatMap((k) => ['', '_b', '_atk', '_hit'].map((x) => `unit.${k}${x}`));
    for (let i = 0; i < 100 && !ids.every((id) => A.sprite(id)); i++) await new Promise((r) => setTimeout(r, 300));
    return ids.filter((id) => !A.sprite(id));
  }, KINDS);
  L.log('missing', ok);
  const F_SAVED = '__fitSaved';
  const draw = (on, kinds, pose) => p.evaluate(async ([on, kinds, pose, F_SAVED]) => {
    const F = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/shared\/src\/data\/framefit\.ts(\?|$)/.test(n)));
    globalThis[F_SAVED] ??= { ...F.FRAME_FIT };
    for (const k of Object.keys(F.FRAME_FIT)) delete F.FRAME_FIT[k];
    if (on) Object.assign(F.FRAME_FIT, globalThis[F_SAVED]);
    const t = globalThis.gravetide.tactical;
    let c = document.getElementById('fitqa');
    if (!c) {
      c = document.createElement('canvas');
      c.id = 'fitqa';
      c.style.cssText = 'position:fixed;inset:0;z-index:99999;width:100vw;height:100vh';
      document.body.append(c);
    }
    c.width = innerWidth;
    c.height = innerHeight;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#3a2a1c');
    bg.addColorStop(1, '#22180f');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    const v = { you: 0, stacks: [], allies: [] };
    const cols = 3, rows = Math.ceil(kinds.length / cols);
    const cw = c.width / cols, rh = (c.height - 26) / rows;
    const w = Math.min(cw / 3.2, rh / 2.3);
    const ft = t.ft;
    t.ft = 1000; // a still clock: the idle stack between its breaths, the blow held at its middle
    g.font = '12px sans-serif';
    g.fillStyle = '#f2e6c8';
    g.fillText(`${on ? 'AFTER (fit on)' : 'BEFORE (fit off)'} — idle | ${pose}`, 8, 16);
    kinds.forEach((k, i) => {
      const cx = (i % cols) * cw + cw / 2, cy = 26 + Math.floor(i / cols) * rh + rh * 0.62;
      for (const [j, id] of [[0, 1], [1, 3]]) {
        const s = { id, side: 0, face: 0, unit: k, kind: 'unit', sp: [], count: 10, hex: 0 };
        t.act.delete(id);
        if (j) t.act.set(id, [pose === 'atk' ? { k: 'atk', t0: -29000, hit: 31000, dx: 0, dy: 0 } : { k: 'hurt', t0: 1000 - 470, hit: 1000, dx: 0, dy: 0 }]);
        const x = cx + (j ? 0.62 : -0.62) * w * 1.2;
        t.figure(g, s, `unit.${k}`, x, cy, w, false, 0, v);
        t.act.delete(id);
      }
      g.fillStyle = '#f2e6c8';
      g.fillText(k, cx - cw / 2 + 6, cy + w * 0.62);
    });
    t.ft = ft;
    return true;
  }, [on, kinds, pose, F_SAVED]);
  const chunks = [KINDS.slice(0, 6), KINDS.slice(6, 12)];
  for (const [ci, kinds] of chunks.entries()) {
    for (const pose of ['atk', 'hit']) {
      for (const on of [false, true]) {
        await draw(on, kinds, pose);
        await L.sleep(150);
        await p.screenshot({ path: `${OUT}/battle_${W}x${H}_${ci + 1}_${pose}_${on ? 'after' : 'before'}.png` });
      }
    }
  }
  L.log('errors', p.errors.slice(0, 5));
} finally {
  await b.close();
}
