// The players' chat (owner, 2026-09-30: "a chat for players, show player icons, make chat icons from our pictures"):
// a panel a button opens, channels as tabs with their icons, each line with the speaker's face in a brass ring and
// the name in the colour of what she is to you, emblems written as `:coin:` shown as the game's own pictures, the
// last sixty lines kept and a count of the unread on the button.

import { esc, faceOf, icon, portraitUrl } from './dom.ts';
import { sagaCardHtml } from './saga.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/hud.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { SagaCard } from '../../../shared/src/protocol.ts';

const L = dict(EN, RU);

/** The chat's emblems: a token and the picture it shows (all from the game's own icons). */
export const EMOTES: readonly (readonly [string, string])[] = [
  ['coin', 'icon.coin'], ['skull', 'icon.danger'], ['anchor', 'icon.anchor'], ['compass', 'icon.item_brass_compass'],
  ['xp', 'icon.xp'], ['rum', 'icon.good_rum'], ['cannon', 'icon.gun_long_9'], ['map', 'icon.map_treasure'],
  ['fish', 'icon.good_fish'], ['crown', 'icon.faction_crown'], ['monster', 'icon.map_monster'], ['storm', 'icon.weather_storm'],
];
/** Other words for the same pictures (typed by hand; the picker offers the first names). */
const ALIASES: Record<string, string> = { danger: 'icon.danger', kraken: 'icon.map_monster', gold: 'icon.coin', ship: 'icon.map_ship' };
const EMOTE_ART = new Map<string, string>([...EMOTES, ...Object.entries(ALIASES)]);

/** A line's words as HTML: escaped first, then each known `:token:` becomes its picture (unknown ones stay words). */
export function chatBody(text: string, art: (id: string) => string = (id) => icon(id, '', 'emo')): string {
  return esc(text).replace(/:([a-z]{2,10}):/g, (m, k: string) => {
    const id = EMOTE_ART.get(k);
    if (!id) return m;
    const img = art(id);
    return img ? img.replace('<img ', `<img title=":${k}:" `) : m;
  });
}

export type ChatChannel = 'all' | 'group' | 'guild' | 'whisper';
export const CHAT_CHANNELS: ChatChannel[] = ['all', 'group', 'guild', 'whisper'];
const TAB_ART: Record<ChatChannel, string> = { all: 'menu_chat', group: 'tab_group', guild: 'tab_guild', whisper: 'tab_letters' };

/** What a speaker is to the reader, for the colour of the name. */
export type ChatRel = 'self' | 'group' | 'guild' | 'friend' | 'whisper' | 'crown' | 'free' | 'other';

export interface ChatLine {
  from: string;
  text: string;
  ch?: 'group' | 'guild' | 'whisper';
  to?: string;
  card?: SagaCard;
  face?: string;
  fac?: 'free' | 'crown';
  lv?: number;
}

export interface ChatContext {
  self: string | null;
  group: string[];
  guild: string[];
  friends: string[];
}

export function chatRel(m: ChatLine, c: ChatContext): ChatRel {
  const name = m.ch === 'guild' ? m.from.replace(/^\[[^\]]*\]\s*/, '') : m.from;
  if (c.self && name === c.self) return 'self';
  if (m.ch === 'whisper') return 'whisper';
  if (c.group.includes(name)) return 'group';
  if (m.ch === 'guild' || c.guild.includes(name)) return 'guild';
  if (c.friends.includes(name)) return 'friend';
  if (m.fac) return m.fac;
  return 'other';
}

const REL_COLOR: Record<ChatRel, string> = {
  self: '#e8c46a', group: '#8fdc9a', guild: '#9fc3e8', friend: '#7fd0d8', whisper: '#e0a8e8',
  crown: FACTIONS.crown.lantern, free: '#e0776b', other: '#d8cdb4',
};

export class ChatPanel {
  private root = document.getElementById('chat')!;
  private log = document.getElementById('chat-log')!;
  private input = document.getElementById('chat-input') as HTMLInputElement;
  private toggleBtn = document.getElementById('chat-toggle')!;
  private badge = document.getElementById('chat-unread')!;
  private emotes = document.getElementById('chat-emotes')!;
  private unread = 0;
  private tabUnread = new Map<ChatChannel, number>();
  /** Who the reader is and who is near to her (set by the shell each time a line comes). */
  context: () => ChatContext = () => ({ self: null, group: [], guild: [], friends: [] });
  /** The channel picked (the field says where plain words go). */
  onPick: (ch: ChatChannel) => void = () => {};
  /** The send button. */
  onSend: () => void = () => {};

  constructor() {
    // A phone's keyboard comes up only when the field is touched: the button just opens the log.
    this.toggleBtn.onclick = () => (this.isOpen ? this.close() : this.open(!document.body.classList.contains('touch')));
    document.getElementById('chat-close')!.onclick = () => this.close();
    const send = document.getElementById('chat-send')!;
    send.addEventListener('pointerdown', (e) => e.preventDefault()); // a phone keeps its keyboard up
    send.onclick = () => this.onSend();
    const emoBtn = document.getElementById('chat-emote-btn')!;
    emoBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    emoBtn.onclick = () => {
      this.drawEmotes();
      this.emotes.classList.toggle('hidden');
    };
    this.art();
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  get filter(): ChatChannel {
    return (this.root.dataset.filter as ChatChannel | undefined) ?? 'all';
  }

  /** The pictures on the buttons (again once the art has loaded). */
  art(): void {
    this.toggleBtn.querySelector('.chat-tg-ico')!.innerHTML = icon('menu_chat', '✉', 'ico');
    document.getElementById('chat-emote-btn')!.innerHTML = icon('coin', '☺', 'ico-sm');
    document.getElementById('chat-send')!.innerHTML = `<span>${esc(L('chatSend'))}</span>`;
    document.getElementById('chat-close')!.setAttribute('aria-label', L('chatClose'));
    this.toggleBtn.title = L('chatOpen');
    this.drawEmotes();
  }

  open(focus: boolean): void {
    this.root.classList.add('open');
    document.body.classList.add('chat-open');
    this.unread = 0;
    this.tabUnread.delete(this.filter);
    this.drawBadge();
    this.log.scrollTop = this.log.scrollHeight;
    if (focus) this.input.focus();
  }

  close(): void {
    this.root.classList.remove('open');
    document.body.classList.remove('chat-open');
    this.emotes.classList.add('hidden');
    this.input.blur();
  }

  private drawEmotes(): void {
    this.emotes.innerHTML = EMOTES.map(([k, id]) => `<button type="button" data-emo="${k}" title=":${k}:">${icon(id, `:${k}:`, 'emo')}</button>`).join('');
    this.emotes.querySelectorAll<HTMLElement>('[data-emo]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.onclick = () => this.insert(`:${b.dataset.emo}:`);
    });
  }

  /** An emblem into the field where the caret stands. */
  private insert(token: string): void {
    const v = this.input.value;
    const at = this.input.selectionStart ?? v.length, end = this.input.selectionEnd ?? at;
    const before = v.slice(0, at), after = v.slice(end);
    const pad = before && !before.endsWith(' ') ? ' ' : '';
    const next = `${before}${pad}${token} ${after}`.slice(0, this.input.maxLength > 0 ? this.input.maxLength : 200);
    this.input.value = next;
    const caret = Math.min(next.length, before.length + pad.length + token.length + 1);
    this.input.setSelectionRange(caret, caret);
    if (!document.body.classList.contains('touch')) this.input.focus();
  }

  /** The channels as tabs with their pictures; a count on a tab with lines not yet seen. */
  tabs(): void {
    const el = document.getElementById('chat-tabs')!;
    const cur = this.filter;
    el.innerHTML = CHAT_CHANNELS.map((ch) => {
      const n = this.tabUnread.get(ch) ?? 0;
      return `<button type="button" class="ct${ch === cur ? ' on' : ''}" data-ct="${ch}" title="${esc(L(`ct_${ch}`))}">${icon(TAB_ART[ch], '', 'ico-sm')}<span class="ct-l">${esc(L(`ct_${ch}`))}</span>${n && ch !== cur ? `<i class="ct-n">${n > 9 ? '9+' : n}</i>` : ''}</button>`;
    }).join('');
    el.querySelectorAll<HTMLElement>('[data-ct]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // the field keeps its focus (and a phone its keyboard)
      const ch = b.dataset.ct as ChatChannel;
      this.root.dataset.filter = ch;
      this.tabUnread.delete(ch);
      this.tabs();
      this.log.scrollTop = this.log.scrollHeight;
      this.onPick(ch);
    }));
  }

  /** A line in the log: the face, the name in its colour, the channel's word, the time and the words. */
  add(m: ChatLine): void {
    const c = this.context();
    const rel = chatRel(m, c);
    const own = rel === 'self';
    const d = document.createElement('div');
    d.className = `cl${m.ch ? ` chat-${m.ch}` : ''}${own ? ' cl-own' : ''}`;
    const face = (m.face && portraitUrl(m.face)) || portraitUrl(faceOf(m.from));
    const tag = m.ch === 'group' ? L('chatGroup') : m.ch === 'guild' ? L('chatGuild') : m.ch === 'whisper' ? (m.to ? L('chatWhisperTo', { name: m.to }) : L('chatWhisper')) : '';
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const lv = m.lv ? `<span class="cl-lv">${esc(L('lv', { n: m.lv }))}</span>` : '';
    d.innerHTML = `<span class="cl-face"${face ? ` style="background-image:url('${esc(face)}')"` : ''}></span><div class="cl-body"><div class="cl-head"><b class="cl-name" style="color:${REL_COLOR[rel]}">${esc(m.from)}</b>${lv}${tag ? `<i class="cl-tag">${esc(tag)}</i>` : ''}<time>${time}</time></div><div class="cl-text">${m.card ? sagaCardHtml(m.card) : chatBody(m.text)}</div></div>`;
    const stick = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
    this.log.append(d);
    // Sixty lines kept (the tabs filter them).
    while (this.log.children.length > 60) this.log.firstChild!.remove();
    if (stick || own) this.log.scrollTop = this.log.scrollHeight;
    if (own) return;
    const ch: ChatChannel = m.ch ?? 'all';
    if (!this.isOpen) {
      this.unread++;
      this.drawBadge();
    }
    if (!this.isOpen || (this.filter !== 'all' && this.filter !== ch)) {
      if (ch !== 'all') this.tabUnread.set(ch, (this.tabUnread.get(ch) ?? 0) + 1);
      this.tabs();
    }
  }

  private drawBadge(): void {
    this.badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
    this.badge.classList.toggle('hidden', this.unread === 0);
    this.toggleBtn.classList.toggle('has-unread', this.unread > 0);
  }
}
