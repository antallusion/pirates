// Quick look at the start screen at the phone sizes (docs/27 QA): PORT=58998 node tools/tg/shot-login.mjs [tag]
import * as L from '../mobile/m0/lib.mjs';
const PORT = Number(process.env.PORT ?? 58998);
const tag = process.argv[2] ?? 'login';
const b = await L.browser();
for (const [w, h] of [[480, 270], [640, 360], [812, 375], [915, 412], [1440, 900]]) {
  for (const lang of ['ru', 'en']) {
    const p = await L.page(b, [w, h], { lang });
    await p.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#login-name', { state: 'visible', timeout: 90000 });
    await p.evaluate(() => document.fonts.ready);
    await L.sleep(1500);
    await p.screenshot({ path: `docs/img/tg/${tag}__${w}x${h}_${lang}.jpg`, type: 'jpeg', quality: 70 });
    await p.ctx.close();
  }
}
await b.close();
