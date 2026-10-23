// Owner, 2026-10-23: «всякие смотровые, когда я делаю квест или подплываю — запускается два разных видоса зачем-то и не
// сразу показаны квесты, там задержка где-то минуту прежде чем квесты подгрузятся текстовые». In the Telegram layout on a
// phone on its side: a fresh captain set off a lookout, she lands there — every film that starts is logged (its id and
// when), and the campaign's quest words are timed from the page's start (the «…» placeholder until they are in).
// Screenshots at each moment; exit code 1 on two films for one moment or quest words not in at once.
//   GPORT=58611 SIZE=1093x481 TG=46 LANG2=ru OUT=assets/raw/audit/lookout node tools/mobile/ux/lookout.mjs
import * as L from '../m0/lib.mjs';
import { mkdirSync } from 'node:fs';
import os from 'node:os';

try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not allowed */ }
const [W, H] = (process.env.SIZE ?? '1093x481').split('x').map(Number);
const port = Number(process.env.GPORT ?? 58611);
const tg = Number(process.env.TG ?? 46);
const lang = process.env.LANG2 ?? 'ru';
const OUT = process.env.OUT ?? 'assets/raw/audit/lookout';
const FRESH = process.env.FRESH === '1'; // a fresh browser: no film seen yet
mkdirSync(OUT, { recursive: true });
const shot = (p, n) => p.screenshot({ path: `${OUT}/${W}x${H}_${lang}${tg ? '_tg' : ''}_${n}.png` });

const b = await L.browser();
let bad = 0;
const fail = (m) => { bad++; L.log('FAIL ' + m); };
try {
  const p = await L.page(b, [W, H], { lang, touch: true, films: true });
  await p.ctx.addInitScript((t) => {
    // every film logged as it starts, and let run 1.5 s before a tap skips it (as a player might)
    globalThis.__films = [];
    globalThis.__t0 = performance.now();
    const watch = () => new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('film')) {
        const src = n.querySelector('video')?.getAttribute('src') ?? '';
        globalThis.__films.push({ id: src.replace(/^.*\/|\.mp4.*$/g, ''), at: Math.round(performance.now() - globalThis.__t0) });
        setTimeout(() => n.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 1500);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) watch();
    else addEventListener('DOMContentLoaded', watch);
    if (t) addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('tg-app');
      document.documentElement.style.setProperty('--sa-t', `${t}px`);
      document.documentElement.style.setProperty('--tg-top', `${t}px`);
    });
  }, tg);
  await L.login(p, { port, know: true });
  const words = await p.evaluate(() => Math.round(performance.now() - globalThis.__t0));
  L.log('in game at', words, 'ms');
  await L.sleep(1500);
  await L.closeAll(p);
  await L.send(p, { t: 'undock' });
  await L.sleep(3000);
  await L.closeAll(p);
  for (const c of ['/god', '/heal']) { await L.say(p, c); await L.sleep(400); }
  // (the launch's film had its moment: the next one waits FILM_GAP_MS, ui/cutscene.ts)
  await L.sleep(46000);
  const films0 = await p.evaluate(() => globalThis.__films.length);
  await L.say(p, '/lookout');
  await L.sleep(2500);
  await shot(p, '1_off');
  // what the sea's bar offers here, and the land
  const acts = await p.evaluate(() => [...document.querySelectorAll('#tc-act, .tc-act2, .act-btn')].map((e) => `${e.dataset.act}:${e.textContent?.trim()}`));
  L.log('acts', JSON.stringify(acts));
  const t1 = await p.evaluate(() => Math.round(performance.now() - globalThis.__t0));
  await L.send(p, { t: 'land' });
  // the quests' words and the window over the landing, second by second
  const seen = [];
  for (let i = 0; i < 30; i++) {
    await L.sleep(1000);
    const v = await p.evaluate(() => {
      const s = globalThis.gravetide.state;
      const film = document.querySelector('.film video')?.getAttribute('src') ?? null;
      const modal = globalThis.gravetide.modal();
      const isle = !!document.querySelector('#isle-scene:not(.hidden), .islescene:not(.hidden)');
      const dots = [...document.querySelectorAll('.gs-row b, .jr-row b, .q-row b, .giver-name')].filter((e) => /^…|…$/.test(e.textContent ?? '')).length;
      return { film, modal, isle, landing: s.self?.landing?.feature ?? null, dots };
    });
    seen.push(v);
    if (i === 2) await shot(p, '2_landing');
    // the quests at once, the film or not: the journal opened over the landing
    if (i === 3) {
      await L.open(p, 'journal');
      await L.sleep(600);
      const j = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.jr-row b')].map((e) => e.textContent?.trim()), detail: document.querySelector('.giver-name')?.textContent?.trim() ?? '' }));
      L.log('journal at the lookout', JSON.stringify(j));
      if (!j.rows.length || j.rows.some((t) => !t || /…/.test(t)) || /…/.test(j.detail)) fail('the quests not shown at once: ' + JSON.stringify(j));
      await shot(p, '2b_journal');
      await L.open(p, null);
    }
  }
  await shot(p, '3_after');
  // and once more ashore at the same island (its scene, a job's landing): no second film for the one visit
  const acts2 = await p.evaluate(() => [...document.querySelectorAll('#tc-act, .tc-act2, .act-btn')].map((e) => `${e.dataset.act}:${e.textContent?.trim()}`));
  L.log('acts after', JSON.stringify(acts2));
  await L.send(p, { t: 'land' });
  await L.sleep(12000);
  await shot(p, '4_again');
  const films = await p.evaluate(() => globalThis.__films);
  const mine = films.slice(films0);
  L.log('films at the lookout', JSON.stringify(mine.map((f) => ({ ...f, after: f.at - t1 }))));
  L.log('timeline', JSON.stringify(seen));
  if (mine.length > 1) fail(`${mine.length} films for one landing: ${mine.map((f) => f.id).join(', ')}`);
  if (seen.some((v) => v.dots > 0)) fail('quest words still «…» after landing');
  if (p.errors.length) L.log('errors', p.errors.slice(0, 5).join(' | '));
} catch (e) {
  fail(String(e?.stack ?? e));
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
