// The ship's ring and its hail (owner, 2026-11-01, over a merchant whose ring showed only «Нанять»: «мне нужно
// нападение, то есть атаковать или поговорить, применяется ко всем кораблям… нанять и все это бред ваще»). One rule for
// every ship:
//   the ring        «Атаковать» always (the guns, keeping the distance; under colours that forbid it, dimmed, and a tap
//                   says why with the one tap to the flag card); «Поговорить» for every ship with men aboard who talk
//                   (not the deep's: a beast, the drowned, a guard of the map — «Атаковать» alone there); «На абордаж»
//                   only within the grapples' 100 m and only when the attack is lawful; a struck ship's terms; ⓘ beside.
//   the hail        «Окликнуть»: what she has to say and what there is to do with her — by what she is, from the
//                   mechanics that exist (the hire at sea, the ceasefire's talks; a captain's whisper, card, invite),
//                   «Пропустить» to sail on. Nothing is offered that the game does not have.
// Pure choice-making here (tests/hail.test.ts); main.ts reads the state into the facts and does what is picked.

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/hail.ts';
import { EN as SEN, RU as SRU } from '../lang/ui/seahud.ts';
import { esc } from './dom.ts';
import { openSheet } from './kit/sheet.ts';
import type { SheetHandle } from './kit/sheet.ts';
import type { TmChoice } from './targetmenu.ts';

const L = dict(EN, RU);
const LS = dict(SEN, SRU);

/** What she is, by the ring's lights (main.ts markKind). */
export type MarkKind = 'deep' | 'pirate' | 'peaceful' | 'captain' | 'other';

/** A ship as the ring needs her. */
export interface RingFacts {
  kind: MarkKind;
  isPlayer: boolean;
  /** The attack is lawful now (the colours, the harbour's peace — main.ts attackable). */
  attackOk: boolean;
  /** Within the grapples' 100 m and a grapple takes her (main.ts canBoardNow). */
  boardNow: boolean;
  struck: boolean;
  /** The pursuit on her now, and how. */
  running: 'guns' | 'board' | null;
}

/** Men aboard who answer a hail: any captain, any ship of the sea's but the deep's — not a captain's escort (she
 *  answers to her own captain). */
export function canTalk(f: Pick<RingFacts, 'kind' | 'isPlayer'>): boolean {
  if (f.kind === 'deep') return false;
  if (f.kind === 'captain') return f.isPlayer;
  return true;
}

/** The ring's choices about a ship (ⓘ is beside them, not among them). Empty: nothing but ⓘ (a captain's escort she
 *  may not fight). */
export function shipRing(f: RingFacts): TmChoice[] {
  const out: TmChoice[] = [];
  // (a captain's escort her colours leave alone: nothing to do with her but her card)
  if (f.kind === 'captain' && !f.isPlayer && !f.attackOk) return out;
  const fight: TmChoice = { id: 'fight', art: 'talent_gun_rolling_broadside', label: LS('tm.attack'), title: f.struck ? LS('tm.fightStruck') : f.attackOk ? L('attackT') : L('attackOffT'), on: f.attackOk && f.running === 'guns' };
  if (!f.attackOk) fight.off = true;
  out.push(fight);
  if (f.kind === 'deep') return out; // the deep's: «Атаковать» alone (owner, 2026-10-31)
  if (f.attackOk && f.boardNow) out.push({ id: 'board', art: 'ab_red_hook_boarding', label: LS('tm.board'), title: L('boardT'), on: f.running === 'board' });
  if (f.struck && f.attackOk) {
    out.push({ id: 'sink', art: 'fire', label: LS('tm.sink'), title: LS('tm.sinkT') }, { id: 'release', art: 'stat_crew', label: LS('tm.release'), title: LS('tm.releaseT') });
    return out;
  }
  if (canTalk(f)) out.push({ id: 'talk', art: 'faction_free', label: L('talk'), title: L('talkT') });
  return out;
}

export type HailOpt = 'hire' | 'parley' | 'whisper' | 'inspect' | 'invite' | 'pass';

/** A ship as her hail needs her. */
export interface HailFacts {
  kind: MarkKind;
  isPlayer: boolean;
  name: string;
  npcRole?: string;
  /** Firing on her captain now (SF.HOSTILE). */
  hostile: boolean;
  /** One the hire at sea takes (HIRE_ROLES, not named nor elite, not in a fight — main.ts). */
  hirable: boolean;
  /** Her captain may call this captain into her group. */
  canInvite?: boolean;
}

export interface HailChoice {
  id: HailOpt;
  label: string;
  title: string;
  /** Shown but not to be taken now: why. */
  off?: string;
  primary?: boolean;
}

/** What she says when hailed. */
export function hailGreeting(f: HailFacts): string {
  if (f.isPlayer) return L('g.player', { name: f.name });
  const r = f.npcRole;
  if (r === 'merchant') return L('g.merchant');
  if (r === 'fisher') return L('g.fisher');
  if (r === 'patrol' || r === 'hunter') return L(f.hostile ? 'g.patrolHostile' : 'g.patrol');
  if (r === 'pirate' || f.kind === 'pirate') return L(f.hostile ? 'g.pirateHostile' : 'g.pirate');
  return L('g.other');
}

/** The hail's options for her (empty: she does not talk — the deep's, a captain's escort). */
export function hailOptions(f: HailFacts): HailChoice[] {
  if (!canTalk(f)) return [];
  const out: HailChoice[] = [];
  if (f.isPlayer) {
    out.push({ id: 'whisper', label: L('o.whisper'), title: L('o.whisper'), primary: true }, { id: 'inspect', label: L('o.inspect'), title: L('o.inspect') });
    if (f.canInvite) out.push({ id: 'invite', label: L('o.invite'), title: L('o.invite') });
  } else {
    // firing on her: the talks first (the ceasefire); a pirate's always offered — dimmed while he holds his fire
    const pirate = f.kind === 'pirate';
    if (f.hostile || pirate) out.push({ id: 'parley', label: L('o.parley'), title: L('o.parleyT'), primary: f.hostile, ...(f.hostile ? {} : { off: L('o.parleyOff') }) });
    if (f.hirable) out.push({ id: 'hire', label: L('o.hire'), title: L('o.hireT'), primary: !f.hostile });
  }
  out.push({ id: 'pass', label: L('o.pass'), title: L('o.pass') });
  return out;
}

/** Why the attack on her is refused now: the peace of a peaceful ship (the city or neutral flag), a captain the colours
 *  leave alone, a harbour's peace, too far. */
export type AttackNo = 'peace' | 'colours' | 'protected' | 'far';

export function attackNoText(why: AttackNo): string {
  return L(`no.${why}`);
}
/** The flag is the way out (a tap to its card). */
export function attackNoFlag(why: AttackNo): boolean {
  return why === 'peace' || why === 'colours';
}
export function attackNoButtons(): { how: string; ok: string } {
  return { how: L('no.how'), ok: L('no.ok') };
}

/** The hail's sheet: her name, what she says, the options as buttons. */
export class HailCard {
  private sheet: SheetHandle | null = null;
  /** The ship it is about, while it is up. */
  about: number | null = null;

  get open(): boolean {
    return !!this.sheet?.open;
  }

  show(id: number, f: HailFacts, pick: (o: HailOpt) => void): void {
    this.close();
    const opts = hailOptions(f);
    if (!opts.length) return;
    this.about = id;
    const btn = (o: HailChoice) => `<button type="button" class="btn${o.primary && !o.off ? ' btn-primary' : ''} hail-opt" data-hail="${o.id}" title="${esc(o.off ?? o.title)}"${o.off ? ' aria-disabled="true" data-off="1"' : ''}><b>${esc(o.label)}</b>${o.off ? `<span class="muted">${esc(o.off)}</span>` : ''}</button>`;
    this.sheet = openSheet({
      id: 'hail',
      cls: 'hail-panel',
      title: L('title', { name: f.name }),
      height: 'auto',
      passKeys: true,
      body: `<p class="hail-say">${esc(hailGreeting(f))}</p><div class="hail-opts">${opts.map(btn).join('')}</div>`,
      onClose: () => {
        this.sheet = null;
        this.about = null;
      },
    });
    this.sheet.body.querySelectorAll<HTMLElement>('[data-hail]').forEach((b) => (b.onclick = () => {
      if (b.dataset.off) return;
      const o = b.dataset.hail as HailOpt;
      this.close();
      if (o !== 'pass') pick(o);
    }));
  }

  close(): void {
    this.sheet?.close('code');
    this.sheet = null;
    this.about = null;
  }
}
