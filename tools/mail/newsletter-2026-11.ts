// The November 2026 newsletter (owner, 2026-11-05: «для всех зарегистрированных пользователей, которые оставили свою
// почту, сделай рассылку … о том, что у нас добавилось в игре за последнее время … все иконки, все ассеты бери прямо
// из игры»). One letter to every account with an address that has not unsubscribed (the advice mailer's `emailOff`,
// its one-click /auth/unsub link made the same way), through the game's own mailer (Sendersy on production).
//
//   node tools/mail/newsletter-2026-11.ts render <dir>        the HTML and the text into <dir> (a sample captain)
//   node tools/mail/newsletter-2026-11.ts list                 who would get it (masked), nothing sent
//   node tools/mail/newsletter-2026-11.ts test <address>       one copy to <address>
//   node tools/mail/newsletter-2026-11.ts send                 everyone, throttled; resumable (the log is the memory)
//
// Env: DB_PATH (the live gravetide.db), SENDERSY_API_KEY / SMTP_URL / MAIL_FROM (as the game's), PUBLIC_URL,
// GT_MAIL_TS (the path to server/src/mail.ts; by default the repo's), NL_LOG (the send log), NL_GAP_MS (the pause).
// Images live in assets/mail/ (PNG/JPG copies of the game's own art) and are served from <PUBLIC_URL>/assets/mail/.

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = (process.env.PUBLIC_URL ?? 'https://gravetidegame.com').replace(/\/$/, '');
const IMG = `${BASE}/assets/mail`;
const CAMPAIGN = 'newsletter-2026-11';
export const SUBJECT = 'GRAVETIDE: острова до 10 уровня, элита и Лоцманская книга';
const PREHEADER = 'Пиратская столица, семь элитных бойцов, переход ×10 между портами и ещё немало нового в море.';

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GOLD = '#e8c46a';
const TEXT = '#eadcbc';
const MUTED = '#a99a7a';
const CARD = '#112230';
const LINE = '#3a3320';
const FONT = "Georgia,'Times New Roman',Times,serif";

interface Row { img: string; title: string; line: string }
const ROWS: Row[] = [
  { img: 'book.png', title: 'Лоцманская книга', line: 'Энциклопедия всей механики в картинках — в игре и на сайте: море, бой, флаги, остров, армия и ответы на вопросы капитанов.' },
  { img: 'passage.png', title: 'Переход между портами ×10', line: 'Между портами-узлами корабль идёт в десять раз быстрее, а в 1 км вокруг узла — «Тихая гавань», где капитаны не дерутся.' },
  { img: 'patent.png', title: 'Каперский патент и Служба флагу', line: 'Возьмите патент в законном порту и топите врагов города без черепа. Звание и жалованье службы патент не отнимает.' },
  { img: 'find.png', title: '«Найти» на карте моря', line: 'Поиск порта, острова или логова прямо на карте, а в журнале — «Показать на карте» у каждого задания.' },
  { img: 'boats.png', title: 'Шлюпы с острова', line: 'Нанимайте бойцов острова прямо в море: шлюпы сами догонят корабль. И абордаж стал заметно резвее.' },
  { img: 'berth.png', title: 'Причал', line: 'Корабли ждут в своём порту, «Перегнать сюда» приведёт любой. Команду при смене корабля больше не увольняют.' },
];

/** The letter for one captain: subject, HTML (tables, inline styles, 600 px) and the plain text. */
export function buildMail(name: string, unsubUrl: string): { subject: string; html: string; text: string } {
  const play = `${BASE}/play`;
  const guide = `${BASE}/site/guide/`;
  const forum = `${BASE}/site/forum/`;
  const hello = name ? `Капитан ${name}!` : 'Капитан!';

  const row = (r: Row, last: boolean) => `
<tr><td style="padding:0 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>
<td width="60" valign="top" style="width:60px;padding:14px 0${last ? '' : `;border-bottom:1px solid ${LINE}`}"><img src="${IMG}/${r.img}" width="52" height="52" alt="" style="display:block;width:52px;height:52px;border:0;outline:none;border-radius:8px"></td>
<td valign="top" style="padding:14px 0 14px 12px;font-family:${FONT}${last ? '' : `;border-bottom:1px solid ${LINE}`}">
<div style="font-size:17px;line-height:22px;font-weight:bold;color:${GOLD}">${esc(r.title)}</div>
<div style="font-size:14px;line-height:20px;color:${TEXT};padding-top:3px">${esc(r.line)}</div>
</td></tr></table>
</td></tr>`;

  const html = `<!doctype html>
<html lang="ru" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(SUBJECT)}</title>
<style>
@media (max-width:620px){ .px{padding-left:16px!important;padding-right:16px!important} .h1{font-size:24px!important;line-height:30px!important} .fimg{width:96px!important;height:auto!important} .fcol{width:104px!important} }
a{color:${GOLD}}
</style>
</head>
<body style="margin:0;padding:0;background:#070d14;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#070d14;font-size:1px;line-height:1px">${esc(PREHEADER)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#070d14" style="background:#070d14"><tr><td align="center" style="padding:20px 8px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0c1822" style="max-width:600px;background:#0c1822;border:1px solid #5a4a26;border-radius:10px;border-collapse:separate;overflow:hidden">

<tr><td style="padding:0;line-height:0;font-size:0"><a href="${play}" style="text-decoration:none"><img src="${IMG}/hero.jpg" width="600" alt="GRAVETIDE — пиратская MMO" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:10px 10px 0 0"></a></td></tr>

<tr><td class="px" align="center" style="padding:24px 28px 6px;font-family:${FONT}">
<div style="font-size:12px;letter-spacing:4px;color:${MUTED};text-transform:uppercase">Вести с моря · ноябрь</div>
<div class="h1" style="font-size:28px;line-height:34px;color:${GOLD};font-weight:bold;padding-top:8px">Что нового в GRAVETIDE</div>
<div style="font-size:15px;line-height:22px;color:${TEXT};padding-top:10px">${esc(hello)} Пока вы были на берегу, море изменилось: острова выросли до столиц, в казармах появилась элита, а в порту — книга, где расписано всё.</div>
</td></tr>

<tr><td class="px" style="padding:18px 24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="background:${CARD};border:1px solid #4a3d20;border-radius:8px;border-collapse:separate"><tr>
<td class="fcol" width="130" valign="bottom" style="width:130px;padding:10px 0 0 10px;line-height:0;font-size:0"><img class="fimg" src="${IMG}/hall10.jpg" width="120" height="185" alt="Ратуша 10 уровня — Пиратская столица" style="display:block;width:120px;height:185px;border:0;border-radius:6px 6px 0 0"></td>
<td valign="middle" style="padding:16px 18px 16px 14px;font-family:${FONT}">
<div style="font-size:11px;letter-spacing:3px;color:${MUTED};text-transform:uppercase">Главное</div>
<div style="font-size:21px;line-height:26px;font-weight:bold;color:${GOLD};padding-top:4px">Острова до 10 уровня</div>
<div style="font-size:14px;line-height:21px;color:${TEXT};padding-top:6px">Все 15 построек города и все промыслы растут до 10-го уровня. Ратуша 10 — <b style="color:${GOLD}">«Пиратская столица»</b>: 2 500 серебра в казну каждый день.</div>
</td></tr></table>
</td></tr>

<tr><td class="px" style="padding:14px 24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="background:${CARD};border:1px solid #4a3d20;border-radius:8px;border-collapse:separate">
<tr><td style="padding:0;line-height:0;font-size:0"><img src="${IMG}/elite.jpg" width="550" alt="Семь элитных бойцов острова" style="display:block;width:100%;max-width:550px;height:auto;border:0;border-radius:8px 8px 0 0"></td></tr>
<tr><td style="padding:12px 18px 16px;font-family:${FONT}">
<div style="font-size:21px;line-height:26px;font-weight:bold;color:${GOLD}">Элита острова</div>
<div style="font-size:14px;line-height:21px;color:${TEXT};padding-top:6px">С 8-го уровня жилища каждый ярус открывает третьего, элитного бойца: Боцманы, Морские гренадеры, Снайперы, Мортирные расчёты, Клинки корсаров, Адмиральская гвардия и Ужасы глубин.</div>
</td></tr></table>
</td></tr>

<tr><td style="padding:10px 0 0"></td></tr>
${ROWS.map((r, i) => row(r, i === ROWS.length - 1)).join('')}

<tr><td class="px" style="padding:6px 24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#16212a" style="background:#16212a;border:1px dashed #5a4a26;border-radius:8px;border-collapse:separate"><tr>
<td width="48" valign="middle" style="width:48px;padding:10px 0 10px 12px"><img src="${IMG}/sound.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0"></td>
<td valign="middle" style="padding:10px 6px;font-family:${FONT};font-size:13px;line-height:19px;color:${TEXT}">Настоящая пиратская музыка и звуки моря, новый трейлер на сайте, а промокоды теперь вводятся в <b style="color:${GOLD}">«Настройки → Промокод»</b>.</td>
<td width="48" valign="middle" style="width:48px;padding:10px 12px 10px 0"><img src="${IMG}/gift.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0"></td>
</tr></table>
</td></tr>

<tr><td align="center" style="padding:28px 24px 8px">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${play}" style="height:54px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="${GOLD}"><center style="color:#1a1206;font-family:Georgia,serif;font-size:20px;font-weight:bold;">В море</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${play}" style="display:inline-block;background:${GOLD};background-image:linear-gradient(#f3d98c,#d9ac4a);color:#1a1206;font-family:${FONT};font-size:20px;font-weight:bold;line-height:54px;text-align:center;text-decoration:none;width:260px;border-radius:7px;border:1px solid #f6e3a6;box-shadow:0 4px 18px rgba(232,196,106,.25)">В море</a><!--<![endif]-->
</td></tr>
<tr><td align="center" style="padding:10px 24px 26px;font-family:${FONT};font-size:14px;line-height:22px;color:${MUTED}">
<a href="${guide}" style="color:${GOLD};text-decoration:underline">Лоцманская книга</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${forum}" style="color:${GOLD};text-decoration:underline">Форум: новости и&nbsp;обсуждения</a>
</td></tr>

<tr><td class="px" align="center" style="padding:16px 28px 20px;border-top:1px solid ${LINE};font-family:${FONT}">
<img src="${IMG}/logo.png" width="64" height="60" alt="GRAVETIDE" style="display:block;width:64px;height:60px;border:0;margin:0 auto">
<div style="font-size:12px;line-height:18px;color:#7d8a93;padding-top:8px">Вы получили это письмо, потому что указали почту при регистрации в GRAVETIDE (gravetidegame.com).</div>
<div style="font-size:12px;line-height:18px;padding-top:6px"><a href="${esc(unsubUrl)}" style="color:#7d8a93;text-decoration:underline">Отписаться от писем</a></div>
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;

  const text = [
    `${hello}`,
    '',
    'ЧТО НОВОГО В GRAVETIDE',
    '',
    '— Острова до 10 уровня. Все 15 построек города и все промыслы растут до 10-го уровня. Ратуша 10 — «Пиратская столица»: 2 500 серебра в казну каждый день.',
    '— Элита острова. С 8-го уровня жилища каждый ярус открывает элитного бойца: Боцманы, Морские гренадеры, Снайперы, Мортирные расчёты, Клинки корсаров, Адмиральская гвардия и Ужасы глубин.',
    ...ROWS.map((r) => `— ${r.title}. ${r.line}`),
    '— А ещё: настоящая пиратская музыка и звуки, новый трейлер, промокоды в «Настройки → Промокод».',
    '',
    `В море: ${play}`,
    `Лоцманская книга: ${guide}`,
    `Форум: ${forum}`,
    '',
    'Вы получили это письмо, потому что указали почту при регистрации в GRAVETIDE.',
    `Отписаться: ${unsubUrl}`,
  ].join('\n');

  return { subject: SUBJECT, html, text };
}

// ------------------------------------------------------------------------------------------------ the list and the send

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const notACaptain = (name: string): boolean => /^(bot|npc|qa|test)(\b|[\s_\-\d])/i.test(String(name ?? '').trim());
const mask = (a: string) => { const [u, d] = a.split('@'); return d ? `${u.slice(0, 1)}***@${d}` : '***'; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Target { acc: number; name: string; email: string }

async function openDb() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(process.env.DB_PATH ?? '/opt/gravetide/data/gravetide.db');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}
type Db = Awaited<ReturnType<typeof openDb>>;

function getKv(db: Db, key: string): Record<string, unknown> | undefined {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
  return r ? JSON.parse(r.value) : undefined;
}

/** Everyone with an address, not unsubscribed, no bot or test account, one letter per address (the earliest account). */
function targets(db: Db): { list: Target[]; skipped: Record<string, number> } {
  const rows = db.prepare("SELECT id, name, email FROM accounts WHERE email IS NOT NULL AND email <> '' ORDER BY id").all() as { id: number; name: string; email: string }[];
  const seen = new Set<string>();
  const list: Target[] = [];
  const skipped: Record<string, number> = { invalid: 0, bot: 0, unsubscribed: 0, duplicate: 0 };
  for (const r of rows) {
    const email = String(r.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { skipped.invalid++; continue; }
    if (notACaptain(r.name)) { skipped.bot++; continue; }
    if ((getKv(db, `advice:${r.id}`) as { emailOff?: boolean } | undefined)?.emailOff) { skipped.unsubscribed++; continue; }
    if (seen.has(email)) { skipped.duplicate++; continue; }
    seen.add(email);
    list.push({ acc: r.id, name: r.name, email });
  }
  return { list, skipped };
}

/** Her one-click unsubscribe link, the token made and kept once (as server/src/game/advice.ts adviceUnsubUrl). */
function unsubUrl(db: Db, acc: number): string {
  const key = `advice:${acc}`;
  const st = (getKv(db, key) ?? { last: {}, letterAt: 0, outAt: 0 }) as { unsub?: string };
  if (!st.unsub) {
    st.unsub = randomBytes(12).toString('base64url');
    db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .run(key, JSON.stringify(st), Date.now());
  }
  return `${BASE}/auth/unsub?a=${acc}&t=${st.unsub}`;
}

async function mailer() {
  const path = process.env.GT_MAIL_TS ?? new URL('../../server/src/mail.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const m = await import(pathToFileURL(path).href);
  return { mailer: m.mailerFromEnv((s: string) => console.log(s)), MailRejected: m.MailRejected };
}

const LOG = process.env.NL_LOG ?? `/opt/gravetide/data/${CAMPAIGN}.log`;
function logLine(o: Record<string, unknown>): void {
  appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), campaign: CAMPAIGN, ...o }) + '\n');
}
/** Addresses already done (sent, or refused by the mail service as unknown): never mailed twice. */
function done(): Set<string> {
  const out = new Set<string>();
  if (!existsSync(LOG)) return out;
  for (const l of readFileSync(LOG, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try {
      const o = JSON.parse(l);
      if (o.kind === 'bulk' && (o.status === 'sent' || o.status === 'invalid')) out.add(o.email);
    } catch { /* a torn line */ }
  }
  return out;
}

async function main(): Promise<void> {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'render') {
    const dir = arg ?? '.';
    mkdirSync(dir, { recursive: true });
    const m = buildMail('Нефигугум', `${BASE}/auth/unsub?a=0&t=sample`);
    writeFileSync(join(dir, `${CAMPAIGN}.html`), m.html);
    writeFileSync(join(dir, `${CAMPAIGN}.txt`), `Subject: ${m.subject}\n\n${m.text}\n`);
    console.log(`rendered into ${dir}`);
    return;
  }
  if (cmd === 'list') {
    const db = await openDb();
    const { list, skipped } = targets(db);
    const d = done();
    for (const t of list) console.log(`${t.acc}\t${mask(t.email)}\t${d.has(t.email) ? 'done' : 'pending'}`);
    console.log(JSON.stringify({ total: list.length, skipped }));
    return;
  }
  if (cmd === 'test') {
    if (!arg || !EMAIL_RE.test(arg)) throw new Error('test <address>');
    const { mailer: ml } = await mailer();
    const m = buildMail('', `${BASE}/auth/unsub?a=0&t=test`);
    await ml.send({ to: arg, subject: m.subject, text: m.text, html: m.html });
    logLine({ kind: 'test', email: arg, status: 'sent' });
    console.log(`test sent to ${mask(arg)}`);
    return;
  }
  if (cmd === 'send') {
    const db = await openDb();
    const { list, skipped } = targets(db);
    const d = done();
    const { mailer: ml, MailRejected } = await mailer();
    const gap = Number(process.env.NL_GAP_MS ?? 1500);
    const n = { sent: 0, failed: 0, invalid: 0, already: 0 };
    for (const t of list) {
      if (d.has(t.email)) { n.already++; continue; }
      const m = buildMail(t.name, unsubUrl(db, t.acc));
      try {
        await ml.send({ to: t.email, subject: m.subject, text: m.text, html: m.html });
        n.sent++;
        logLine({ kind: 'bulk', acc: t.acc, email: t.email, status: 'sent' });
      } catch (e) {
        const invalid = e instanceof MailRejected && (e as { kind?: string }).kind === 'invalid';
        if (invalid) n.invalid++; else n.failed++;
        logLine({ kind: 'bulk', acc: t.acc, email: t.email, status: invalid ? 'invalid' : 'failed', error: String((e as Error).message) });
      }
      await sleep(gap);
    }
    const summary = { total: list.length, ...n, skipped };
    logLine({ kind: 'summary', ...summary });
    console.log(JSON.stringify(summary));
    return;
  }
  console.log('usage: render <dir> | list | test <address> | send');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
