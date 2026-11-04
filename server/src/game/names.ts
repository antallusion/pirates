// The names players choose (forum post 66, the tester Эдуард: «Сделайте хоть какую-то проверку того, как игроки называют
// своих пиратов»). New names are asked shared/src/namefilter.ts badName where they are typed (auth.ts, Game.ts, guilds.ts,
// shipbuilding.ts, companion.ts, wonders.ts, seasons.ts); this keeps the names given before the filter:
//   /names scan            every current name the filter refuses: captains, ships, companions, guilds and tags, wonders, islands
//   /names fix <id|all>    a captain's coarse name becomes «Капитан <id>» and she gets a free rename and a letter about it;
//                          a ship's becomes her captain's epithet, a companion's its first name, a guild's «Гильдия <id>»
//                          with the tag «G<id>», a wonder's and an island's go back to the sea's own
// The command runs for the server's admins (FORUM_ADMINS) on any server, and for everyone on a test server
// (GRAVETIDE_ADMIN=1). Her free rename: the captain's menu (her portrait) → «Сменить имя» → `{ t: 'rename' }` here.

import { sanitizeName } from '../auth.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { CALF_NAME } from '../../../shared/src/data/companions.ts';
import { badName, NAME_BAD } from '../../../shared/src/namefilter.ts';
import { deliver } from './post.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';

export type NameKind = 'captain' | 'ship' | 'companion' | 'guild' | 'tag' | 'wonder' | 'island';
export interface NameHit { kind: NameKind; account: number | null; ref: string; name: string }

let renameHook: ((account: number, name: string) => void) | null = null;
/** Told of every new captain's name (main.ts: the forum's member row follows at once, not at her next visit). */
export function setRenameHook(fn: ((account: number, name: string) => void) | null): void {
  renameHook = fn;
}

/** The server's admins by account id (FORUM_ADMINS): they may run /names on a live server. */
export function namesStaff(account: number, env = process.env.FORUM_ADMINS): boolean {
  return String(env ?? '').split(/[\s,]+/).filter(Boolean).map(Number).includes(account);
}

/** Her profile: the session's when she is aboard (the freshest), else her save. */
function profileOf(game: Game, account: number): { p: Profile; s: PlayerSession | null; row: { x: number; y: number; heading: number } | null } | null {
  const s = game.sessionByAccount(account);
  if (s?.profile) return { p: s.profile, s, row: null };
  const row = game.db.loadCaptain(account);
  if (!row) return null;
  try {
    return { p: JSON.parse(row.data) as Profile, s: null, row };
  } catch {
    return null;
  }
}
function keep(game: Game, account: number, x: { p: Profile; s: PlayerSession | null; row: { x: number; y: number; heading: number } | null }): void {
  if (x.s) {
    game.saveSession(x.s);
    game.pushSelf(x.s, true);
  } else if (x.row) game.db.saveCaptain(account, x.p, x.row.x, x.row.y, x.row.heading);
}

/** Every name the filter refuses now. */
export function scanNames(game: Game): NameHit[] {
  const out: NameHit[] = [];
  for (const a of game.db.allAccountNames()) if (badName(a.name)) out.push({ kind: 'captain', account: a.id, ref: String(a.id), name: a.name });
  for (const c of game.db.allCaptains()) {
    const x = profileOf(game, c.account_id);
    if (!x) continue;
    if (x.p.shipName && badName(x.p.shipName)) out.push({ kind: 'ship', account: c.account_id, ref: String(c.account_id), name: x.p.shipName });
    const pet = x.p.companion?.name;
    if (pet && badName(pet)) out.push({ kind: 'companion', account: c.account_id, ref: String(c.account_id), name: pet });
  }
  for (const g of Object.values(game.guilds.store(game).guilds)) {
    const adm = g.members.find((m) => m.rank === 'admiral')?.account ?? null;
    if (badName(g.name)) out.push({ kind: 'guild', account: adm, ref: String(g.id), name: g.name });
    if (badName(g.tag)) out.push({ kind: 'tag', account: adm, ref: String(g.id), name: g.tag });
  }
  for (const [id, r] of Object.entries(game.db.getKv<Record<string, { account: number; named: string | null }>>('wonders') ?? {})) {
    if (r.named && badName(r.named)) out.push({ kind: 'wonder', account: r.account, ref: id, name: r.named });
  }
  for (const [id, name] of Object.entries(game.db.getKv<Record<string, string>>('island_names') ?? {})) if (badName(name)) out.push({ kind: 'island', account: null, ref: id, name });
  return out;
}

/** A captain's new name everywhere the server keeps it at once: her account, her session and ship, her guild's roll,
 *  the forum. False: the name is taken. */
export function applyRename(game: Game, account: number, name: string): boolean {
  if (!game.db.renameAccount(account, name)) return false;
  const s = game.sessionByAccount(account);
  if (s) {
    s.name = name;
    if (s.ship) {
      s.ship.captainName = name;
      for (const o of game.sessions) o.knownEntities.delete(s.ship.id);
    }
  }
  const g = game.guilds.of(game, account);
  const m = g?.members.find((x) => x.account === account);
  if (m) {
    m.name = name;
    game.guilds.touch();
  }
  try {
    renameHook?.(account, name);
  } catch (e) {
    game.log(`[names] forum: ${(e as Error).message}`);
  }
  return true;
}

/** Her free rename (the captain's menu): a refusal's words, or null when done. */
export function renameCaptain(game: Game, s: PlayerSession, raw: unknown): string | null {
  const p = s.profile;
  if (!p) return 'No captain.';
  if (!((p.renames ?? 0) > 0)) return 'You have no free rename.';
  const name = sanitizeName(String(raw ?? ''));
  if (!name) return 'Name must be 3–20 letters, digits, spaces, apostrophes or dashes.';
  if (badName(name)) return NAME_BAD;
  if (name === s.name) return 'That is your name already.';
  const old = s.name;
  if (!applyRename(game, s.accountId, name)) return 'That name is already sailing these waters.';
  p.renames = (p.renames ?? 1) - 1;
  game.saveSession(s);
  game.pushSelf(s, true);
  game.log(`[names] ${old} (#${s.accountId}) is ${name} now`);
  return null;
}

const FROM = 'The Harbour Office';

/** What `/names fix` does to one hit; a line for the log. */
function fixHit(game: Game, h: NameHit): string {
  switch (h.kind) {
    case 'captain': {
      const acc = h.account!;
      let name = `Капитан ${acc}`;
      for (let i = 2; game.db.accountByName(name) && game.db.accountByName(name)!.id !== acc; i++) name = `Капитан ${acc}-${i}`;
      if (!applyRename(game, acc, name)) return `captain #${acc}: the name ${name} is taken`;
      const x = profileOf(game, acc);
      if (x) {
        x.p.renames = Math.min(9, (x.p.renames ?? 0) + 1);
        keep(game, acc, x);
      }
      deliver(game, acc, {
        from: FROM, subject: 'Your captain has a new name', gold: 0, goods: null,
        body: `The name «${h.name}» does not keep to the rules of the sea, so your captain sails as «${name}» now. A free rename is yours: tap your portrait (top left) and choose «Change name».`,
      });
      return `captain #${acc}: ${h.name} → ${name}`;
    }
    case 'ship': {
      const acc = h.account!;
      const x = profileOf(game, acc);
      if (!x) return `ship of #${acc}: no save`;
      const name = CAPTAINS[x.p.captain as CaptainId]?.epithet ?? 'Sea Wolf';
      x.p.shipName = name;
      if (x.s?.ship) {
        x.s.ship.name = name;
        for (const o of game.sessions) o.knownEntities.delete(x.s.ship.id);
      }
      keep(game, acc, x);
      deliver(game, acc, { from: FROM, subject: 'Your ship has a new name', gold: 0, goods: null, body: `The name «${h.name}» does not keep to the rules of the sea, so your ship sails as «${name}» now.` });
      return `ship of #${acc}: ${h.name} → ${name}`;
    }
    case 'companion': {
      const acc = h.account!;
      const x = profileOf(game, acc);
      if (!x?.p.companion) return `companion of #${acc}: none`;
      x.p.companion.name = CALF_NAME[0];
      keep(game, acc, x);
      return `companion of #${acc}: ${h.name} → ${CALF_NAME[0]}`;
    }
    case 'guild':
    case 'tag': {
      const g = game.guilds.get(game, Number(h.ref));
      if (!g) return `guild ${h.ref}: gone`;
      const was = `${g.name} [${g.tag}]`;
      if (h.kind === 'guild') g.name = `Гильдия ${g.id}`;
      else {
        g.tag = `G${g.id.toString(36).toUpperCase()}`.slice(0, 4);
        for (const m of g.members) {
          const s = game.sessionByAccount(m.account);
          if (s?.ship) {
            s.ship.guildTag = g.tag;
            for (const o of game.sessions) o.knownEntities.delete(s.ship.id);
          }
        }
      }
      game.guilds.touch();
      if (h.account !== null) deliver(game, h.account, { from: FROM, subject: 'Your guild has a new name', gold: 0, goods: null, body: `The name «${was}» does not keep to the rules of the sea, so your guild is «${g.name} [${g.tag}]» now.` });
      return `guild ${g.id}: ${was} → ${g.name} [${g.tag}]`;
    }
    case 'wonder': {
      const recs = game.db.getKv<Record<string, { named: string | null }>>('wonders') ?? {};
      if (recs[h.ref]) recs[h.ref].named = null;
      game.db.setKv('wonders', recs);
      return `wonder ${h.ref}: ${h.name} → the sea's own`;
    }
    case 'island': {
      const names = game.db.getKv<Record<string, string>>('island_names') ?? {};
      delete names[h.ref];
      game.db.setKv('island_names', names);
      return `island ${h.ref}: ${h.name} → its own name after the next restart`;
    }
  }
}

/** /names scan · /names fix <account id|all>: the answer line (the full list goes to the server's log too). */
export function namesAdmin(game: Game, args: string[]): string {
  const sub = (args[0] ?? 'scan').toLowerCase();
  const hits = scanNames(game);
  const line = (h: NameHit) => `${h.kind} ${h.kind === 'guild' || h.kind === 'tag' || h.kind === 'wonder' || h.kind === 'island' ? h.ref : `#${h.ref}`} «${h.name}»`;
  if (sub === 'scan') {
    for (const h of hits) game.log(`[names] scan: ${line(h)}`);
    if (!hits.length) return 'Names: nothing the filter refuses.';
    return `Names the filter refuses (${hits.length}): ${hits.slice(0, 40).map(line).join(' · ')}${hits.length > 40 ? ' …' : ''}. /names fix <id|all>`;
  }
  if (sub === 'fix') {
    const target = String(args[1] ?? '');
    if (!target) return 'Usage: /names scan · /names fix <id|all>';
    const pick = target === 'all' ? hits : hits.filter((h) => h.account === Number(target) && h.kind !== 'wonder' && h.kind !== 'island');
    if (!pick.length) return 'Names: nothing to fix.';
    const done = pick.map((h) => fixHit(game, h));
    for (const d of done) game.log(`[names] fix: ${d}`);
    return `Names fixed (${done.length}): ${done.slice(0, 30).join(' · ')}${done.length > 30 ? ' …' : ''}`;
  }
  return 'Usage: /names scan · /names fix <id|all>';
}
