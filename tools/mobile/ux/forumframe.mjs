// Proof shots of the forum's framed avatars (owner, 2026-10-29: Elordaert's profile — the portrait spilled under and
// over the square frame and was not centred in its hole): the profile, the members, a topic's post header and the
// topic lists, desktop and phone. The seed has no members with portraits, so the forum's API answers are patched in
// the page with captains' portraits (the rendering is the client's own). Usage: node tools/mobile/ux/forumframe.mjs <tag>
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/enosi/mobaudit/package.json');
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/enosi/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const TAG = process.argv[2] ?? 'after';
const OUT = `assets/raw/audit/forumframe/${TAG}`;
mkdirSync(OUT, { recursive: true });
const B = 'http://127.0.0.1:58830';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--qa-tag=ff830'] });
try {
  execSync(`powershell -NoProfile -Command "$m = Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | ? { $_.CommandLine -like '*qa-tag=ff830*' }; foreach ($p in $m) { Get-CimInstance Win32_Process -Filter \\"ParentProcessId=$($p.ProcessId)\\" | % { (Get-Process -Id $_.ProcessId).PriorityClass = 'BelowNormal' }; (Get-Process -Id $p.ProcessId).PriorityClass = 'BelowNormal' }"`, { stdio: 'ignore' });
} catch {}
const FACES = ['reaver', 'pirate_03', 'admiral', 'giver_widow_f', 'officer_iron_jaw', 'pirate_17', 'drowned', 'res_gunner_f'];
const fake = (i) => ({ id: 0, name: i ? `Капитан ${i}` : 'Elordaert', role: 'user', avatar: `/assets/portraits/${FACES[i % FACES.length]}.webp`, rank: 3, captain: 'drowned', level: 24, online: i % 2 === 0, posts: 40 + i, rep: 5 });
function patch(o, n = { i: 0 }) {
  if (Array.isArray(o)) return o.map((x) => patch(x, n));
  if (o && typeof o === 'object') {
    if (typeof o.avatar === 'string' && 'name' in o && 'role' in o) Object.assign(o, fake(0), { id: o.id, posts: o.posts ?? 40 });
    for (const k of Object.keys(o)) o[k] = patch(o[k], n);
  }
  return o;
}
async function pg(W, H) {
  const touch = W < 1000;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, locale: 'ru-RU', deviceScaleFactor: 2 });
  await ctx.route('**/api/forum/**', async (route) => {
    const res = await route.fetch();
    let j;
    try { j = await res.json(); } catch { return route.fulfill({ response: res }); }
    if (route.request().url().includes('list/members')) j = { ...j, total: 8, members: FACES.map((_, i) => fake(i)) };
    else j = patch(j);
    return route.fulfill({ response: res, json: j });
  });
  return ctx.newPage();
}
const shots = [
  ['/site/forum/u/0', 'profile'],
  ['/site/forum/l/members', 'members'],
  ['/site/forum/t/1', 'topic'],
  ['/site/forum/', 'home'],
  ['/site/forum/l/topics', 'topics'],
];
for (const [W, H, dev] of [[1366, 900, 'desk'], [390, 844, 'phone'], [812, 375, 'land']]) {
  const p = await pg(W, H);
  for (const [u, n] of shots) {
    await p.goto(B + u, { waitUntil: 'load', timeout: 120000 });
    await sleep(2500);
    await p.screenshot({ path: `${OUT}/${n}_${dev}.png` });
    // the framed avatar close up
    const el = await p.$('.f-ring-square, .f-prof-ava .f-ava, .f-member .f-ava');
    if (el) await el.screenshot({ path: `${OUT}/${n}_${dev}_ava.png` }).catch(() => {});
  }
  await p.context().close();
}
await b.close();
console.log('shots in', OUT);
