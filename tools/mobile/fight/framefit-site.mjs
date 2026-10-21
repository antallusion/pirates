// Owner, 2026-10-21: the site shop window's creature — its figure and its blow in turn at one height
// (shared/src/data/framefit.ts via the detail's `hero.fit`). Each pose shot alone (the alternation held), before (the
// fit taken out of the answer: the old contain-fit) and after.
//
//   GPORT=58640 OUT=docs/img/framefit ITEM=unit_merrow_warden_2 node tools/mobile/fight/framefit-site.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'docs/img/framefit';
const ITEM = process.env.ITEM ?? 'unit_merrow_warden_2';
const PORT = Number(process.env.GPORT ?? 58640);
mkdirSync(OUT, { recursive: true });
const b = await L.browser();
const rows = [];
try {
  for (const [W, H] of [[375, 812], [1440, 900]]) {
    for (const on of [false, true]) {
      const p = await L.page(b, [W, H], { lang: 'ru', touch: W < 1000 });
      if (!on) await p.route('**/api/site/shop/item**', async (r) => {
        const res = await r.fetch();
        const j = await res.json();
        if (j.detail?.hero) delete j.detail.hero.fit;
        await r.fulfill({ response: res, json: j });
      });
      await p.goto(`http://localhost:${PORT}/site/shop/?cat=unit&item=${ITEM}`, { waitUntil: 'networkidle', timeout: 90000 });
      await p.waitForSelector('.pd-art.fig img.p1', { timeout: 30000 });
      await p.addStyleTag({ content: '.pd-art.anim .p0, .pd-art.anim .p1 { animation: none !important; transition: none !important; }' });
      await p.evaluate(() => Promise.all([...document.querySelectorAll('.pd-art img')].map((i) => i.decode().catch(() => {}))));
      for (const pose of ['p0', 'p1']) {
        await p.evaluate((pose) => {
          for (const i of document.querySelectorAll('.pd-art.anim img')) i.style.opacity = i.classList.contains(pose) ? '1' : '0';
          document.querySelector('.pd-art').scrollIntoView({ block: 'center' });
        }, pose);
        await L.sleep(200);
        const art = await p.$('.pd-art');
        const name = `site_${ITEM}_${W}x${H}_${pose === 'p0' ? 'figure' : 'attack'}_${on ? 'after' : 'before'}`;
        await art.screenshot({ path: `${OUT}/${name}.png` });
        // The painted box of each pose (the picture's own pixels: the box drawn, as object-fit leaves it).
        const r = await p.evaluate((pose) => {
          const i = document.querySelector(`.pd-art img.${pose}`);
          const b = i.getBoundingClientRect();
          const s = Math.min(b.width / i.naturalWidth, b.height / i.naturalHeight);
          const fit = getComputedStyle(i).objectFit;
          return { w: Math.round(fit === 'fill' ? b.width : i.naturalWidth * s), h: Math.round(fit === 'fill' ? b.height : i.naturalHeight * s), nat: [i.naturalWidth, i.naturalHeight] };
        }, pose);
        rows.push({ name, ...r });
      }
      if (p.errors.length) L.log('errors', p.errors.slice(0, 3));
      await p.ctx.close();
    }
  }
} finally {
  await b.close();
}
console.log(JSON.stringify(rows, null, 1));
