// The living sea's scenes (2026-10-16): her damage, the dusk, the night, a storm, the fog and the seas' grades.
//   GPORT=58989 OUT=assets/raw/audit/gfx [SIZE=844x390] [LANG2=ru] [GL=0] [CALM=1] node tools/mobile/gfx/scenes.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT ?? 'assets/raw/audit/gfx';
const port = Number(process.env.GPORT ?? 58989);
const [W, H] = (process.env.SIZE ?? '844x390').split('x').map(Number);
const lang = process.env.LANG2 ?? 'ru';
const tag = (process.env.GL === '0' ? '2d_' : '') + (process.env.CALM ? 'calm_' : '');
mkdirSync(OUT, { recursive: true });
const b = await L.browser();
const p = await L.page(b, [W, H], { lang });
if (process.env.GL === '0') await p.ctx.addInitScript(() => { try { localStorage.setItem('gravetide.gl', 'off'); } catch {} });
if (process.env.CALM) await p.ctx.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('gravetide.settings') || '{}'); s.reduceMotion = true; localStorage.setItem('gravetide.settings', JSON.stringify(s)); } catch {} });
const dismiss = async () => {
  await L.closeAll(p, 1);
  for (let i = 0; i < 4; i++) {
    const n = await p.evaluate(() => { const x = [...document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-poshut]')]; x.forEach((e) => e.click()); return x.length; });
    if (!n) break;
    await L.sleep(400);
  }
};
try {
  await L.login(p, { port, know: true });
  await L.closeAll(p);
  await L.say(p, '/level 12'); await L.sleep(800); await L.closeAll(p);
  await L.send(p, { t: 'undock' }); await L.sleep(2500); await L.closeAll(p);
  await L.say(p, '/noboard on');
  const scene = async (name, cmds, wait = 2500) => {
    for (const c of cmds) { await L.say(p, c); await L.sleep(400); }
    await L.sleep(wait);
    await dismiss();
    await L.sleep(500);
    const f = `${OUT}/scene_${tag}${name}_${W}x${H}_${lang}.png`;
    await p.screenshot({ path: f });
    L.log(name, f);
  };
  await scene('damage', ['/god', '/tp 21000 70000', '/time 13', '/weather calm', '/foe merchant brig 90', '/hurt 18'], 4000);
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 2; });
  await scene('wake', [], 4000);
  await scene('dusk', ['/time 18'], 2500);
  await scene('night', ['/time 23'], 2500);
  await scene('storm', ['/weather storm'], 3000);
  await scene('ice', ['/tp leviathan_reach', '/time 13', '/weather calm'], 3500);
  await scene('ash', ['/tp ashen_isles', '/weather calm'], 3500);
  await scene('abyss', ['/tp the_abyss', '/weather calm'], 3500);
  await scene('fog', ['/tp whispering', '/weather fog'], 3500);
  if (p.errors.length) L.log('page errors', p.errors.slice(0, 6));
} finally {
  await b.close();
}
