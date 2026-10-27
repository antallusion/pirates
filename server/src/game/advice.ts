// The advice mailer (owner, 2026-10-28: «подсказки рассылать по почте»): the hints of shared/src/data/advice.ts sent to
// the captains — the island is the key, a tier her island opened and never hired, an army weak for her level, and
// «вас ждут» to one away with the campaign unfinished.
//  - the port's mailbox (post.ts deliver) for everyone: the main channel, on coming aboard and every ten minutes aboard,
//    and once a day for those away (it waits for her in the box);
//  - e-mail (the account's verified address, the auth service's mailer) to a captain away: her language, a link to
//    /play, and a one-click unsubscribe (/auth/unsub, advice state `emailOff`);
//  - VK and Telegram notices (tgnotify.ts pushText) where she linked them and said yes: VK's «not allowed» is silent.
// The limits (pickHint): a kind once in three days on each channel, a letter a day, an e-mail or a notice a day all
// together; nothing outside to a captain aboard or away two weeks and more; never to a bot. Kept in the kv table
// (`advice:<account>`; `advice:pass` — the day's pass over the captains away; `advice:stats` — the owner's figures).

import { randomBytes } from 'node:crypto';
import { ADVICE_CHANNELS, adviceHints, adviceKey as skey, letterWords, markSent, newAdviceState, notACaptain, outsideWords, pickHint } from '../../../shared/src/data/advice.ts';
import { armyAdvice } from '../../../shared/src/data/armyadvice.ts';
import { captainFromSave } from '../../../shared/src/data/advice.ts';
import type { AdviceChannel, AdviceLang, AdviceState, Hint, HintCaptain, SavedCaptain } from '../../../shared/src/data/advice.ts';
import type { AdviceCaptain } from '../../../shared/src/data/armyadvice.ts';
import { adviceCaptain as liveCaptain, isleOfAccount } from './armyadvice.ts';
import { CAMPAIGN_SIZE } from '../../../shared/src/data/campaign/plan.ts';
import { chapterOfSlot } from '../../../shared/src/data/campaign/progress.ts';
import type { Mailer } from '../mail.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import { moscowDay, moscowHour, pushText, pushable, tgnState } from './tgnotify.ts';

const MIN = 60_000;
/** Aboard: looked at every ten minutes. */
export const ADVICE_EVERY = 10 * MIN;
/** The day's pass over the captains away: from noon to eight in the evening, Moscow time. */
export const PASS_HOURS: [number, number] = [12, 20];
export const LETTER_FROM = 'The Harbour Master';

export function adviceState(game: Game, acc: number): AdviceState {
  const raw = game.db.getKv<AdviceState>(skey(acc));
  return raw ? { ...newAdviceState(), ...raw, last: { ...(raw.last ?? {}) } } : newAdviceState();
}
const save = (game: Game, acc: number, st: AdviceState) => game.db.setKv(skey(acc), st);

function tally(game: Game, ch: AdviceChannel, kind: string): void {
  const f = game.db.getKv<Record<string, number>>('advice:stats') ?? {};
  f[`${ch}:${kind}`] = (f[`${ch}:${kind}`] ?? 0) + 1;
  game.db.setKv('advice:stats', f);
}

// ------------------------------------------------------------------------------------------------ her, as the hints see her

/** A captain from her profile: aboard, the live ship as captainAdvice reads it (server armyadvice.ts); away, the same
 *  fields from the save (captainFromSave) and her island's tree. */
export function hintCaptain(game: Game, acc: number, name: string, p: Profile, s?: PlayerSession | null): HintCaptain {
  const online = !!s && game.sessions.has(s);
  let cap: AdviceCaptain | null = null;
  try {
    cap = s?.ship ? liveCaptain(game, s) : captainFromSave(p as unknown as SavedCaptain, isleOfAccount(game, acc));
  } catch {
    cap = null;
  }
  const camp = p.campaign;
  const campaign = camp && camp.started !== false && camp.at < CAMPAIGN_SIZE ? chapterOfSlot(camp.at) : null;
  const awayMs = online ? 0 : Math.max(0, game.wallNow() - (p.ashoreAt ?? tgnState(game, acc)?.seen ?? game.wallNow()));
  return { acc, name, cap, online, awayMs, campaign };
}

/** Her language outside the game: her VK or Telegram's, else Russian (the game's own sea). */
export function adviceLang(game: Game, acc: number): AdviceLang {
  return tgnState(game, acc)?.lang === 'en' ? 'en' : 'ru';
}

/** Her verified address (the hints never go to an address nobody confirmed). */
function emailOf(game: Game, acc: number): string | null {
  const a = game.db.accountById(acc);
  return a?.email && a.email_verified ? a.email : null;
}

// ------------------------------------------------------------------------------------------------ the e-mail

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The e-mail: plain words and a simple page (the game's colours: the deep sea, the brass), the «play» button, the
 *  one-click unsubscribe. */
export function adviceMail(h: Hint, lang: AdviceLang, name: string, base: string, unsubUrl: string): { subject: string; text: string; html: string } {
  const w = outsideWords(h, lang, name);
  const ru = lang === 'ru';
  const play = `${base.replace(/\/$/, '')}/play`;
  const subject = `GRAVETIDE — ${w.subject}`;
  const sign = ru ? '— Начальник порта' : '— The Harbour Master';
  const playL = ru ? 'Играть' : 'Play';
  const offL = ru ? 'Больше не присылать подсказки на почту' : 'Stop sending hints by e-mail';
  const text = [...w.paras, '', `${playL}: ${play}`, '', sign, '', `${offL}: ${unsubUrl}`].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#0b1620;font-family:Georgia,'Times New Roman',serif;color:#e8dcc0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1620;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#13222e;border:1px solid #6b5a33;border-radius:8px">
<tr><td style="padding:22px 28px 6px;font-size:13px;letter-spacing:4px;color:#c9a45c">GRAVETIDE</td></tr>
<tr><td style="padding:4px 28px 0;font-size:22px;color:#f1e3c2">${esc(w.subject)}</td></tr>
<tr><td style="padding:14px 28px 4px;font-size:16px;line-height:1.55">${w.paras.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join('')}</td></tr>
<tr><td style="padding:6px 28px 22px"><a href="${esc(play)}" style="display:inline-block;background:#c9a45c;color:#13222e;text-decoration:none;font-weight:bold;padding:11px 26px;border-radius:5px">${playL}</a></td></tr>
<tr><td style="padding:0 28px 22px;font-size:14px;color:#b9ab8c">${sign}</td></tr>
</table>
<p style="font-size:12px;color:#7d8a93;margin:14px 0 0"><a href="${esc(unsubUrl)}" style="color:#7d8a93">${offL}</a></p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Her unsubscribe token (made once). */
function unsubToken(st: AdviceState): string {
  return (st.unsub ??= randomBytes(12).toString('base64url'));
}

// ------------------------------------------------------------------------------------------------ sending

export interface AdvicePlan {
  ch: AdviceChannel;
  hint: Hint;
  /** The words as she reads them (the letter: English, the client shows her language). */
  subject: string;
  text: string;
}

/** What is due to her now on each channel (the limits; `force`: the limits ignored, her switches kept). */
export function advicePlan(game: Game, c: HintCaptain, st: AdviceState, opts: { force?: boolean; channels?: AdviceChannel[] } = {}): AdvicePlan[] {
  const now = game.wallNow();
  const hints = adviceHints(c);
  if (!hints.length) return [];
  const out: AdvicePlan[] = [];
  const lang = adviceLang(game, c.acc);
  for (const ch of opts.channels ?? ADVICE_CHANNELS) {
    if (ch === 'email' && (!emailOf(game, c.acc) || st.emailOff)) continue;
    if (ch === 'push' && !pushable(game, c.acc, now).vk && !pushable(game, c.acc, now).tg) continue;
    const hint = opts.force ? (hints.find((h) => ch !== 'letter' || h.kind !== 'return') ?? null) : pickHint(hints, st, ch, now, c);
    if (!hint) continue;
    if (ch === 'letter') {
      const w = letterWords(hint, 'en');
      if (w) out.push({ ch, hint, subject: w.subject, text: w.body });
    } else {
      const w = outsideWords(hint, lang, c.name);
      out.push({ ch, hint, subject: w.subject, text: ch === 'push' ? w.line : w.paras.join('\n') });
    }
  }
  // one outside a day, all together: the e-mail first, the notice only without it
  const email = out.find((p) => p.ch === 'email');
  return email && !opts.force ? out.filter((p) => p.ch !== 'push') : out;
}

/** The plan carried out: marked first (two passes at once cannot send twice), then sent. */
export async function adviceSend(game: Game, c: HintCaptain, plan: AdvicePlan[], mailer: Mailer | null, base: string): Promise<string[]> {
  if (!plan.length) return [];
  const now = game.wallNow();
  const st = adviceState(game, c.acc);
  for (const p of plan) markSent(st, p.ch, p.hint.kind, now);
  const token = unsubToken(st);
  save(game, c.acc, st);
  const done: string[] = [];
  for (const p of plan) {
    if (p.ch === 'letter') {
      deliver(game, c.acc, { from: LETTER_FROM, subject: p.subject, body: p.text, gold: 0, goods: null });
      done.push(`letter:${p.hint.kind}`);
    } else if (p.ch === 'email') {
      const to = emailOf(game, c.acc);
      if (!to || !mailer) continue;
      const lang = adviceLang(game, c.acc);
      const m = adviceMail(p.hint, lang, c.name, base, `${base.replace(/\/$/, '')}/auth/unsub?a=${c.acc}&t=${token}`);
      try {
        await mailer.send({ to, subject: m.subject, text: m.text, html: m.html });
        done.push(`email:${p.hint.kind}`);
      } catch {
        // (the mailer logs a masked address; the hint waits its three days anyway)
      }
    } else {
      const r = await pushText(game, c.acc, p.text);
      if (r.vk || r.tg) done.push(`push:${p.hint.kind}${r.vk ? ':vk' : ''}${r.tg ? ':tg' : ''}`);
    }
    tally(game, p.ch, p.hint.kind);
  }
  return done;
}

const mailerOf = (game: Game): Mailer | null => game.auth?.mailer ?? null;
const baseOf = (game: Game): string => game.auth?.publicUrl ?? '';

/** One captain looked at and written to. */
function adviseSession(game: Game, s: PlayerSession): void {
  if (!s.authed || !s.profile || notACaptain(s.name)) return;
  const c = hintCaptain(game, s.accountId, s.name, s.profile, s);
  const plan = advicePlan(game, c, adviceState(game, s.accountId), { channels: ['letter'] });
  if (plan.length) void adviceSend(game, c, plan, mailerOf(game), baseOf(game));
}

/** She came aboard: her hints' letter, if one is due. */
export function adviceOnLogin(game: Game, s: PlayerSession): void {
  try {
    adviseSession(game, s);
  } catch (e) {
    console.log(`[advice] login: ${(e as Error).message}`);
  }
}

const lastStep = new WeakMap<Game, number>();

/** From the game's second: every ten minutes the captains aboard (letters); once a day, in the afternoon (Moscow), the
 *  captains away (letters, e-mail, VK and Telegram). */
export function stepAdvice(game: Game): void {
  const now = game.wallNow();
  if (now - (lastStep.get(game) ?? 0) < ADVICE_EVERY) return;
  lastStep.set(game, now);
  try {
    for (const s of game.sessions) adviseSession(game, s);
    const h = moscowHour(now);
    const day = moscowDay(now);
    if (h < PASS_HOURS[0] || h >= PASS_HOURS[1] || (game.db.getKv<number>('advice:pass') ?? -1) >= day) return;
    game.db.setKv('advice:pass', day);
    for (const { c, plan } of adviceDry(game)) void adviceSend(game, c, plan, mailerOf(game), baseOf(game));
  } catch (e) {
    console.log(`[advice] step: ${(e as Error).message}`);
  }
}

/** The captains away and what each would be sent now (the day's pass; the admin's dry run). */
export function adviceDry(game: Game): { c: HintCaptain; plan: AdvicePlan[] }[] {
  const out: { c: HintCaptain; plan: AdvicePlan[] }[] = [];
  for (const row of game.db.allCaptains()) {
    if (notACaptain(row.name)) continue;
    const s = game.sessionByAccount(row.account_id);
    if (s && game.sessions.has(s)) continue;
    let p: Profile;
    try {
      p = JSON.parse(row.data) as Profile;
    } catch {
      continue;
    }
    if (!p || typeof p.level !== 'number') continue;
    const c = hintCaptain(game, row.account_id, row.name, p, null);
    const plan = advicePlan(game, c, adviceState(game, row.account_id));
    if (plan.length) out.push({ c, plan });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the admin

const lineOf = (c: HintCaptain, plan: AdvicePlan[]) => `${c.name} (#${c.acc}, ⚓${c.cap?.level ?? '?'}): ${plan.map((p) => `${p.ch}:${p.hint.kind}`).join(', ')}`;

/** `/advice [dry | preview <name> | send <name> | stats]`: who would get what now (nothing sent), one captain's hints
 *  in full, one captain's hints sent now (the limits ignored, her switches kept), the figures. */
export function adminAdvice(game: Game, s: PlayerSession, args: string[]): string {
  const cmd = args[0] ?? 'preview';
  if (cmd === 'stats') return `Advice sent (channel:kind → n): ${JSON.stringify(game.db.getKv('advice:stats') ?? {})}`;
  if (cmd === 'dry') {
    const list = adviceDry(game);
    return list.length ? `Would send to ${list.length} captains away:\n${list.map((x) => lineOf(x.c, x.plan)).join('\n')}` : 'Nobody away is due a hint now.';
  }
  const name = args.slice(1).join(' ').trim();
  const acc = name ? game.db.accountByName(name) : game.db.accountById(s.accountId);
  if (!acc) return `No captain named ${name}.`;
  const sess = game.sessionByAccount(acc.id);
  const prof = sess?.profile ?? (() => {
    const row = game.db.loadCaptain(acc.id);
    try {
      return row ? (JSON.parse(row.data) as Profile) : null;
    } catch {
      return null;
    }
  })();
  if (!prof) return `${acc.name} has no captain yet.`;
  const c = hintCaptain(game, acc.id, acc.name, prof, sess);
  const force = cmd === 'send';
  const plan = advicePlan(game, c, adviceState(game, acc.id), { force });
  const hints = adviceHints(c).map((h) => h.kind).join(', ') || 'none';
  const head = `${acc.name} (#${acc.id}, ⚓${c.cap?.level ?? '?'}, ship ⚓${c.cap?.shipLevel ?? '?'}, island ${c.cap?.isle ? JSON.stringify(c.cap.isle) : 'none'}, army ${c.cap ? `${armyAdvice(c.cap)?.ratio ?? '-'} of the norm` : '-'}, ${c.online ? 'aboard' : `away ${Math.round(c.awayMs / 3_600_000)} h`}): hints ${hints}; language ${adviceLang(game, acc.id)}.`;
  const body = plan.map((p) => `[${p.ch}:${p.hint.kind}] ${p.subject} — ${p.text}`).join('\n') || 'Nothing due by the limits.';
  if (force && plan.length) void adviceSend(game, c, plan, mailerOf(game), baseOf(game)).then((d) => console.log(`[advice] forced to #${acc.id}: ${d.join(', ') || 'nothing went'}`));
  return `${head}\n${force ? 'SENDING:\n' : ''}${body}`;
}
