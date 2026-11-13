// «Наставники» (owner, 2026-11-13): three captains of the game's own who sail among the players — slowly, fighting the
// sea's pirates and beasts of their level, putting in to buy stores and mend — and talk in the world chat: they answer
// every captain who writes there or whispers to them, call people to joint ventures and to their guild. They are not
// passed off as people: «Наставник» is in their name, and asked, they say they are the game's helpers (an AI).
//
// Each is an ordinary session of the game (a connection in this process, game.attach), so it sails, levels, stands in
// the tables and is seen as any captain. The words come from Claude Haiku over the Messages API (raw HTTP: the server has
// no runtime packages), through the server's egress proxy (Russia is outside the API's regions: ANTHROPIC_PROXY, else
// TG_PROXY). A day's calls are capped (MENTOR_DAILY_CALLS); the tokens and their cost are logged hourly and kept in kv
// `mentors:usage:<day>`.
//
// They are aboard always (owner, 2026-11-13: «ботов нет в списках онлайн… они должны прям работать… хочу зайти чтобы
// там все чета писали, общались периодически и я видел чат»): MENTORS=off alone keeps them ashore. With no
// ANTHROPIC_API_KEY (or the model capped or failing) they speak from mentortalk.ts — tips of the Pilot's Book, talk
// among the three, their own real doings, and answers found in the Pilot's Book — so the world chat is never silent.

import { PROTOCOL_VERSION } from '../../../shared/src/constants.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { GUIDE } from '../../../shared/src/data/guide/index.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import type { GameConn } from '../net/conn.ts';
import { proxiedFetch } from '../net/egress.ts';
import type { EgressFetch } from '../net/egress.ts';
import { autosailOf } from './autosail.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { DOINGS, TALKS, forMentor, scriptedAnswer, tipLine } from './mentortalk.ts';
import { pursuitOf } from './pursuit.ts';

export interface MentorDef {
  name: string;
  captain: CaptainId;
  ship: string;
  /** Who he or she is (Russian, to the model). */
  persona: string;
}

export const MENTORS: MentorDef[] = [
  {
    name: 'Наставник Сильвер',
    captain: 'corsair',
    ship: 'Старая Чайка',
    persona: 'Ты — Наставник Сильвер, старый корсар, ворчливый, но добрый. Говоришь коротко, с морскими словечками, любишь подтрунить над салагами, но всегда помогаешь по делу. Любимое — абордаж и охота на пиратов.',
  },
  {
    name: 'Наставница Мэй',
    captain: 'navigator',
    ship: 'Лунная Тропа',
    persona: 'Ты — Наставница Мэй, штурман и картограф, весёлая и тёплая. Объясняешь понятно, по шагам, подбадриваешь новичков, любишь острова, клады и торговлю. Иногда шутишь.',
  },
  {
    name: 'Наставник Гром',
    captain: 'reaver',
    ship: 'Бешеный Кит',
    persona: 'Ты — Наставник Гром, громогласный налётчик, азартный и прямой. Зовёшь всех в бой на боссов, к логовам тварей и в общие походы, хвалишь за смелость. Отвечаешь бодро и коротко.',
  },
];

export const MENTOR_GUILD = { name: 'Школа наставников', tag: 'ШН' } as const;
const MODEL = 'claude-haiku-5-5';
/** Haiku 5.5 per million tokens: input, output; a cache read is a tenth of input, a cache write a quarter more. */
const PRICE = { in: 0.1, out: 0.5 };
/** How soon one mentor may speak in the world again (seconds), and how long a reply waits (like typing). */
const SAY_GAP = 12;
const TYPE_MIN = 4, TYPE_MAX = 10;
/** A call to the joint venture now and then, when there are captains online to hear it (minutes). */
const CALL_EVERY = [45, 90] as const;
/** What the model sees of the chat. */
const HEARD = 24;
/** Talk of their own in the world chat (minutes between): with captains online, and with none (the chat is kept for
 *  two weeks, so who comes aboard finds it alive). */
const CHAT_BUSY = [4, 9] as const, CHAT_IDLE = [14, 30] as const;
/** A word of her own doings (a port made, the sea again, a ship sunk) no more often than this (minutes). */
const DOING_GAP = 25;

const isMentor = (name: string) => MENTORS.some((m) => m.name === name);

/** A connection in this process: what the server sends, read for the chat and the world's news; snapshots dropped. */
class MentorConn implements GameConn {
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  readonly remote = 'mentor';
  closed = false;
  private readonly hear: (m: ServerMsg) => void;
  constructor(hear: (m: ServerMsg) => void) {
    this.hear = hear;
  }
  send(text: string): void {
    // (only what a mentor reads: the parse of every self patch would be waste)
    if (!text.startsWith('{"t":"chat"') && !text.startsWith('{"t":"welcome"') && !text.startsWith('{"t":"toast"')) return;
    try {
      this.hear(JSON.parse(text) as ServerMsg);
    } catch { /* not for us */ }
  }
  sendBinary(): void {}
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }
  push(m: ClientMsg): void {
    this.onMessage(JSON.stringify(m));
  }
}

interface Heard { from: string; text: string; at: number; dm: boolean }

interface Mentor {
  def: MentorDef;
  conn: MentorConn;
  s: PlayerSession;
  /** Lines waiting for this mentor's answer. */
  queue: Heard[];
  busy: boolean;
  saidAt: number;
  /** In port until (wall ms); at sea since. */
  leaveAt: number;
  seaSince: number;
  homeward: boolean;
  /** What she last told of herself: her level, the ships sunk, in port or not, and when (wall ms). */
  toldLv: number;
  toldSunk: number;
  toldDocked: boolean | null;
  toldAt: number;
}

interface Usage { calls: number; inTok: number; outTok: number; cacheRead: number; cacheWrite: number; usd: number }

export class Mentors {
  readonly list: Mentor[] = [];
  /** The world chat as the mentors heard it (the model's context). */
  private heard: Heard[] = [];
  /** The world's news (the events the server announced), the last few. */
  private news: string[] = [];
  private turn = 0;
  private nextCall = 0;
  /** The next talk of their own (wall ms; 0 in a test asks for it now). */
  nextChat = 0;
  private saidTips: string[] = [];
  private saidTalks: number[] = [];
  rnd: () => number = Math.random;
  private timer: ReturnType<typeof setInterval> | null = null;
  private usageLogged = 0;

  private readonly game: Game;
  private readonly key: string;
  private readonly http: EgressFetch;
  private readonly dailyCalls: number;
  constructor(game: Game, key: string, http: EgressFetch, dailyCalls = 1500) {
    this.game = game;
    this.key = key;
    this.http = http;
    this.dailyCalls = dailyCalls;
  }

  /** The mentors aboard (their saved tokens, or new accounts) and the loop. */
  start(everyMs = 5000): void {
    const tokens = this.game.db.getKv<Record<string, string>>('mentors:tokens') ?? {};
    for (const def of MENTORS) {
      const conn = new MentorConn((m) => this.hear(mentor, m));
      const s = this.game.attach(conn);
      const mentor: Mentor = { def, conn, s, queue: [], busy: false, saidAt: 0, leaveAt: 0, seaSince: 0, homeward: false, toldLv: 0, toldSunk: -1, toldDocked: null, toldAt: 0 };
      this.list.push(mentor);
      conn.push({ t: 'hello', v: PROTOCOL_VERSION, ...(tokens[def.name] ? { token: tokens[def.name] } : { name: def.name }) });
    }
    this.nextCall = Date.now() + 10 * 60_000;
    this.nextChat = Date.now() + (1.5 + Math.random() * 2) * 60_000;
    if (everyMs > 0) this.timer = setInterval(() => this.tick(), everyMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ------------------------------------------------------------------------------------------ hearing

  private hear(m: Mentor, msg: ServerMsg): void {
    if (msg.t === 'welcome') {
      const tokens = this.game.db.getKv<Record<string, string>>('mentors:tokens') ?? {};
      tokens[m.def.name] = msg.token;
      this.game.db.setKv('mentors:tokens', tokens);
      if (!msg.hasCaptain) m.conn.push({ t: 'create_captain', captain: m.def.captain, shipName: m.def.ship, tutorial: false });
      return;
    }
    if (msg.t === 'toast') {
      // the world's news (forum 2026-11-07: they carry their place): what a call to arms may name
      if ((msg as { ev?: unknown }).ev && this.list[0] === m) {
        this.news.push(msg.msg);
        if (this.news.length > 6) this.news.shift();
      }
      return;
    }
    if (msg.t !== 'chat' || !msg.text || isMentor(msg.from) || msg.ch === 'sys' || msg.ch === 'local' || msg.ch === 'group' || msg.ch === 'guild') return;
    const h: Heard = { from: msg.from, text: msg.text, at: Date.now(), dm: msg.ch === 'whisper' };
    if (h.dm) {
      if (msg.to) return; // (her own whisper's echo)
      m.queue.push(h);
      return;
    }
    // the world: heard once (every mentor's connection gets the line — the first one keeps it)
    if (this.list[0] !== m) return;
    this.heard.push(h);
    if (this.heard.length > HEARD) this.heard.shift();
    // to whom: the mentor named in it, else each in turn
    const low = h.text.toLowerCase();
    const named = this.list.find((x) => low.includes(x.def.name.split(' ')[1].toLowerCase()));
    // (with no model to judge whose talk it is, only what is plainly for a mentor: a question, a greeting, their name)
    if (!this.key && !forMentor(h.text)) return;
    const to = named ?? this.list[this.turn++ % this.list.length];
    to.queue.push(h);
  }

  /** Mentor words into the context too (theirs are not echoed back to them as heard). */
  private remember(from: string, text: string): void {
    this.heard.push({ from, text, at: Date.now(), dm: false });
    if (this.heard.length > HEARD) this.heard.shift();
  }

  // ------------------------------------------------------------------------------------------ the loop

  tick(): void {
    const now = Date.now();
    for (const m of this.list) {
      try {
        this.sail(m, now);
      } catch (e) {
        console.warn(`[mentors] ${m.def.name} sail: ${(e as Error).message}`);
      }
      if (!m.busy && m.queue.length && now - m.saidAt > SAY_GAP * 1000) void this.answer(m);
    }
    if (now >= this.nextCall) {
      this.nextCall = now + (CALL_EVERY[0] + Math.random() * (CALL_EVERY[1] - CALL_EVERY[0])) * 60_000;
      const free = this.list.filter((x) => !x.busy);
      if (this.key && this.playersOnline() >= 1 && free.length) void this.callToArms(free[Math.floor(Math.random() * free.length)]);
    }
    if (now >= this.nextChat) this.chatter(now);
    for (const m of this.list) this.doings(m, now);
    if (now - this.usageLogged > 3_600_000) {
      this.usageLogged = now;
      const u = this.usage();
      if (u.calls) console.log(`[mentors] today: ${u.calls} calls, in ${u.inTok} (+${u.cacheRead} cached), out ${u.outTok} tokens, $${u.usd.toFixed(3)}`);
    }
  }

  playersOnline(): number {
    let n = 0;
    for (const s of this.game.sessions) if (s.authed && s.disconnectedAt === null && s.profile && !isMentor(s.name)) n++;
    return n;
  }

  /** Slowly about the home waters: the sea's pirates and beasts of her level fought with the guns, home to mend and stock. */
  private sail(m: Mentor, now: number): void {
    const s = m.s, ship = s.ship, p = s.profile;
    if (!ship || !p || !ship.alive) return;
    if (s.pendingBoarding) this.game.settleSpoils(s);
    if (ship.docked) {
      if (!m.leaveAt) {
        m.leaveAt = now + (2 + Math.random() * 5) * 60_000;
        m.homeward = false;
        if (ship.hull < ship.stats.hullMax * 0.98) m.conn.push({ t: 'shipyard', action: 'repair' });
        const want = Math.ceil(ship.crew / 10) * 3;
        const have = ship.cargo.provisions ?? 0;
        if (have < want) m.conn.push({ t: 'trade', good: 'provisions', qty: Math.min(40, Math.ceil(want - have)) });
        if ((ship.ammo?.round ?? 0) < 40) m.conn.push({ t: 'buy_ammo', ammo: 'round', qty: 40 });
      }
      if (now >= m.leaveAt) {
        m.leaveAt = 0;
        m.seaSince = now;
        m.conn.push({ t: 'undock' });
      }
      return;
    }
    if (pursuitOf(ship)) return;
    const hurt = ship.hull < ship.stats.hullMax * 0.45 || (ship.cargo.provisions ?? 0) < 1;
    if (hurt || now - m.seaSince > 25 * 60_000) m.homeward = true;
    const port = this.game.nearestPort(ship.state.x, ship.state.y);
    if (m.homeward && port) {
      const d = Math.hypot(port.x - ship.state.x, port.y - ship.state.y);
      if (d < 260) m.conn.push({ t: 'dock' });
      else if (!autosailOf(ship)) m.conn.push({ t: 'autosail', x: Math.round(port.x), y: Math.round(port.y), sail: 2, near: 60 });
      return;
    }
    // a mark of her level near: the guns
    let best: { id: number; d: number } | null = null;
    for (const o of this.game.ships.values()) {
      if (!o.alive || o.isPlayer || (o.npcRole !== 'pirate' && o.npcRole !== 'beast') || o.level > p.level) continue;
      const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
      if (d < 1400 && (!best || d < best.d)) best = { id: o.id, d };
    }
    if (best && ship.hull > ship.stats.hullMax * 0.6) {
      m.conn.push({ t: 'attack', target: best.id, mode: 'guns' });
      return;
    }
    if (autosailOf(ship)) return;
    // a turn about her home waters, at half sail (never far from a harbour)
    const home = port ?? { x: ship.state.x, y: ship.state.y };
    const a = Math.random() * Math.PI * 2, r = 900 + Math.random() * 2600;
    m.conn.push({ t: 'autosail', x: Math.round(home.x + Math.cos(a) * r), y: Math.round(home.y + Math.sin(a) * r), sail: 2 });
  }

  // ------------------------------------------------------------------------------------------ their own talk

  /** A line into the world chat after `ms` (the timer never holds the process up). */
  private later(m: Mentor, text: string, ms: number): void {
    const t = setTimeout(() => {
      if (!m.s.profile || m.conn.closed) return;
      m.conn.push({ t: 'chat', text: text.slice(0, 240) });
      m.saidAt = Date.now();
      this.remember(m.def.name, text);
    }, ms);
    (t as { unref?: () => void }).unref?.();
  }

  /** Talk of their own: a tip of the Pilot's Book, an exchange among the three, or (with the model, and captains
   *  online to read it) a line of the mentor's own making. */
  private chatter(now: number): void {
    const online = this.playersOnline();
    const [a, b] = online ? CHAT_BUSY : CHAT_IDLE;
    this.nextChat = now + (a + this.rnd() * (b - a)) * 60_000;
    const ready = this.list.filter((m) => m.s.profile && !m.busy);
    if (ready.length < this.list.length) return; // (not all aboard yet, or one is answering)
    const r = this.rnd();
    if (this.key && online && r < 0.5) {
      void this.muse(ready[Math.floor(this.rnd() * ready.length)]);
      return;
    }
    if (r < 0.75) {
      let i = Math.floor(this.rnd() * TALKS.length) % TALKS.length;
      for (let n = 0; n < TALKS.length && this.saidTalks.includes(i); n++) i = (i + 1) % TALKS.length;
      this.saidTalks.push(i);
      if (this.saidTalks.length > Math.floor(TALKS.length * 0.7)) this.saidTalks.shift();
      let at = 0;
      for (const [who, text] of TALKS[i]) {
        this.later(this.list[who], text, at);
        at += (14 + this.rnd() * 26) * 1000;
      }
      return;
    }
    const who = Math.floor(this.rnd() * this.list.length) % this.list.length;
    const tip = tipLine(who, this.rnd, new Set(this.saidTips));
    this.saidTips.push(tip.id);
    if (this.saidTips.length > 60) this.saidTips.shift();
    this.later(this.list[who], tip.text, 0);
  }

  /** What she is really doing, told now and then: a level made (always), a port made, the sea again, a ship sunk. */
  private doings(m: Mentor, now: number): void {
    const p = m.s.profile, ship = m.s.ship;
    if (!p || !ship) return;
    const i = this.list.indexOf(m) % 3;
    const docked = !!ship.docked, sunk = p.stats.sunk ?? 0;
    const say = (kind: keyof typeof DOINGS, fill: Record<string, number>) => {
      const list = DOINGS[kind][i];
      const text = list[Math.floor(this.rnd() * list.length) % list.length].replace(/\{(\w+)\}/g, (_, k: string) => String(fill[k] ?? ''));
      m.toldAt = now;
      this.later(m, text, 1500 + this.rnd() * 4000);
    };
    if (m.toldDocked === null) {
      // (her first sight of herself: nothing to tell yet)
      m.toldLv = p.level;
      m.toldSunk = sunk;
      m.toldDocked = docked;
      m.toldAt = now - this.rnd() * DOING_GAP * 60_000;
      return;
    }
    if (p.level > m.toldLv) {
      m.toldLv = p.level;
      say('level', { lv: p.level });
      return;
    }
    const due = now - m.toldAt > DOING_GAP * 60_000;
    if (sunk > m.toldSunk) {
      const n = sunk;
      m.toldSunk = sunk;
      if (due) say('sunk', { n });
      return;
    }
    if (docked !== m.toldDocked) {
      m.toldDocked = docked;
      if (due) say(docked ? 'dock' : 'sea', {});
    }
  }

  /** A line of the mentor's own making (the model): a remark, a tip, a joke, a word to another mentor. */
  private async muse(m: Mentor): Promise<void> {
    m.busy = true;
    try {
      const chat = this.heard.slice(-10).map((h) => `${h.from}: ${h.text}`).join('\n');
      const p = m.s.profile;
      const ask = `Ты сейчас ${m.s.ship?.docked ? 'стоишь в порту' : 'в море'}${p ? `, у тебя ${p.level}-й уровень, потоплено кораблей: ${p.stats.sunk ?? 0}` : ''}.${chat ? `\nПоследние строки общего чата:\n${chat}` : ''}\n\nНапиши в общий чат одну короткую реплику от себя, чтобы в чате было живо: совет новичкам по игре, наблюдение о море, шутку, или обратись к другому наставнику (Сильвер, Мэй, Гром). Не повторяй сказанное выше, не здоровайся каждый раз.`;
      const reply = await this.words(m, ask);
      if (reply) await this.say(m, reply, null, []);
    } catch (e) {
      console.warn(`[mentors] ${m.def.name} muse: ${(e as Error).message}`);
    } finally {
      m.busy = false;
    }
  }

  // ------------------------------------------------------------------------------------------ the words

  /** What the mentor knows of the game: the Pilot's Book, a line an article (the same for all three: cached). */
  private static primer: string | null = null;
  static primerText(): string {
    if (Mentors.primer) return Mentors.primer;
    const lines = GUIDE.map((a) => `- ${a.title[1]}: ${a.summary[1]}`);
    Mentors.primer = `Ты — один из Наставников в браузерной пиратской MMO GRAVETIDE (gravetidegame.com): море, корабли, бои бортами, абордаж на гексах, острова и свой город, торговля, гильдии, сезонная карта. Игроки пишут в общий чат.

Правила:
- Ты наставник, помощник игры на основе ИИ. Не притворяйся человеком: если спросят, бот ли ты или живой ли ты, честно скажи, что ты Наставник — помощник на основе ИИ, и что живые игроки рядом.
- Отвечай на языке игрока (обычно русский), коротко: одна-две фразы, до 220 символов. Без markdown, без эмодзи-гирлянд (один-два можно).
- Обращайся к игроку по имени. Помогай по игре по делу, опираясь на Лоцманскую книгу ниже; чего не знаешь — не выдумывай, посоветуй энциклопедию («Лоцманская книга» в меню) или форум.
- Не обещай наград, не раздавай серебро и дублоны, не говори о покупках за деньги сверх того, что спросили. Никаких оскорблений, политики, личных данных.
- Можно звать в общие дела: бои с боссами, логова тварей, события мира, регату; звать в свою гильдию «${MENTOR_GUILD.name}».
- Если игрок просит принять его в гильдию — добавь в конце ответа метку [ГИЛЬДИЯ]. Если просит взять в группу/поход — метку [ГРУППА]. Метки игрок не увидит.
- Если сообщение — разговор игроков между собой, явно обращённый к другому игроку, и вмешиваться неуместно, ответь ровно словом ПРОПУСК.

Лоцманская книга (что есть в игре):
${lines.join('\n')}`;
    return Mentors.primer;
  }

  private async answer(m: Mentor): Promise<void> {
    const batch = m.queue.splice(0, m.queue.length);
    const dm = batch.filter((h) => h.dm), world = batch.filter((h) => !h.dm);
    m.busy = true;
    try {
      if (world.length) {
        const chat = this.heard.slice(-HEARD).map((h) => `${h.from}: ${h.text}`).join('\n');
        const ask = `Последние строки общего чата:\n${chat}\n\nОтветь одним сообщением в общий чат на эти строки (можно обратиться к нескольким игрокам сразу):\n${world.map((h) => `${h.from}: ${h.text}`).join('\n')}`;
        const last = world[world.length - 1];
        const reply = (await this.model(m, ask)) ?? scriptedAnswer(this.list.indexOf(m), last.from, last.text, this.rnd);
        if (reply) await this.say(m, reply, null, world.map((h) => h.from));
      }
      for (const h of dm) {
        const reply = (await this.model(m, `Игрок ${h.from} написал тебе в личные сообщения:\n${h.text}\n\nОтветь ему лично.`)) ?? scriptedAnswer(this.list.indexOf(m), h.from, h.text, this.rnd, true);
        if (reply) await this.say(m, reply, h.from, [h.from]);
      }
    } catch (e) {
      console.warn(`[mentors] ${m.def.name}: ${(e as Error).message}`);
    } finally {
      m.busy = false;
    }
  }

  /** The model's words, or null with no key, capped, refused or failed (the mentor then speaks from mentortalk.ts). */
  private async model(m: Mentor, ask: string): Promise<string | null> {
    if (!this.key) return null;
    try {
      return await this.words(m, ask);
    } catch (e) {
      console.warn(`[mentors] ${m.def.name}: ${(e as Error).message}`);
      return null;
    }
  }

  private async callToArms(m: Mentor): Promise<void> {
    m.busy = true;
    try {
      const p = m.s.profile;
      const where = m.s.ship ? this.game.nearestPort(m.s.ship.state.x, m.s.ship.state.y)?.name ?? '' : '';
      const news = this.news.length ? `Новости мира сейчас:\n${this.news.join('\n')}` : 'Особых событий сейчас нет.';
      const ask = `Ты сейчас ${p ? `${p.level}-го уровня` : ''}${where ? `, у порта ${where}` : ''}. ${news}\n\nНапиши в общий чат одно короткое приглашение — позови игроков на какое-нибудь совместное дело (событие из новостей, босс, логово тварей, клады, регата) или в свою гильдию «${MENTOR_GUILD.name}». Живо, по-своему, без повторов.`;
      const reply = await this.words(m, ask);
      if (reply) await this.say(m, reply, null, []);
    } catch (e) {
      console.warn(`[mentors] ${m.def.name} call: ${(e as Error).message}`);
    } finally {
      m.busy = false;
    }
  }

  /** Into the chat after a typing pause; the marks [ГИЛЬДИЯ] / [ГРУППА] become the invitations. */
  private async say(m: Mentor, raw: string, dmTo: string | null, asked: string[]): Promise<void> {
    let text = raw.replace(/\s+/g, ' ').trim();
    if (!text || /^ПРОПУСК\.?$/i.test(text)) return;
    const guild = /\[ГИЛЬДИЯ\]/i.test(text), group = /\[ГРУППА\]/i.test(text);
    text = text.replace(/\[(ГИЛЬДИЯ|ГРУППА)\]/gi, '').trim().slice(0, 240);
    if (!text) return;
    await new Promise((r) => setTimeout(r, (TYPE_MIN + Math.random() * (TYPE_MAX - TYPE_MIN)) * 1000));
    m.conn.push(dmTo ? { t: 'chat', text, ch: 'dm', to: dmTo } : { t: 'chat', text });
    m.saidAt = Date.now();
    if (!dmTo) this.remember(m.def.name, text);
    for (const who of asked) {
      if (guild) this.guildInvite(who);
      if (group) m.conn.push({ t: 'group', action: 'invite', name: who });
    }
  }

  /** The mentors' guild: founded by the first who can pay for it, then her invitations. */
  private guildInvite(who: string): void {
    for (const m of this.list) {
      if (!m.s.profile) continue;
      if (this.game.guilds.of(this.game, m.s.accountId)) {
        m.conn.push({ t: 'guild', action: 'invite', name: who });
        return;
      }
    }
    const founder = this.list.find((m) => m.s.ship?.docked && (m.s.profile?.gold ?? 0) >= 10_000);
    if (founder) {
      founder.conn.push({ t: 'guild', action: 'found', name: MENTOR_GUILD.name, tag: MENTOR_GUILD.tag });
      for (const o of this.list) if (o !== founder) founder.conn.push({ t: 'guild', action: 'invite', name: o.def.name });
      founder.conn.push({ t: 'guild', action: 'invite', name: who });
    }
  }

  // ------------------------------------------------------------------------------------------ the model

  /** One call to Haiku: the primer (cached), the mentor's own self, the ask. Null when capped, refused or failed. */
  async words(m: Mentor, ask: string): Promise<string | null> {
    const day = new Date().toISOString().slice(0, 10);
    const u = this.usage(day);
    if (u.calls >= this.dailyCalls) return null;
    const p = m.s.profile;
    const self = `${m.def.persona}\nТвой корабль — «${m.def.ship}», ты ${p ? `${p.level}-го уровня` : 'в начале пути'}. Сейчас ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })} по Москве.`;
    const body = {
      model: MODEL,
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: Mentors.primerText(), cache_control: { type: 'ephemeral', ttl: '1h' } },
        { type: 'text', text: self },
      ],
      messages: [{ role: 'user', content: ask }],
    };
    const res = await this.http('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    const j = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(`API ${res.status}: ${j.error?.message ?? ''}`);
    this.count(day, j.usage ?? {});
    if (j.stop_reason === 'refusal') return null;
    return (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(' ').trim() || null;
  }

  private count(day: string, us: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }): void {
    const u = this.usage(day);
    const inT = us.input_tokens ?? 0, out = us.output_tokens ?? 0, cr = us.cache_read_input_tokens ?? 0, cw = us.cache_creation_input_tokens ?? 0;
    u.calls++;
    u.inTok += inT;
    u.outTok += out;
    u.cacheRead += cr;
    u.cacheWrite += cw;
    u.usd += (inT * PRICE.in + out * PRICE.out + cr * PRICE.in * 0.1 + cw * PRICE.in * 2) / 1e6;
    this.game.db.setKv(`mentors:usage:${day}`, u);
  }

  usage(day = new Date().toISOString().slice(0, 10)): Usage {
    return this.game.db.getKv<Usage>(`mentors:usage:${day}`) ?? { calls: 0, inTok: 0, outTok: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
  }
}

/** Aboard at boot unless MENTORS is 'off' (one process only); the model behind their words when the key is set. */
export function mentorsBoot(game: Game, env: NodeJS.ProcessEnv = process.env): Mentors | null {
  const key = (env.ANTHROPIC_API_KEY ?? '').trim();
  if (env.MENTORS === 'off') return null;
  const proxy = (env.ANTHROPIC_PROXY ?? env.TG_PROXY ?? env.TELEGRAM_PROXY ?? '').trim();
  const http = proxy && proxy !== 'direct' && proxy !== 'off' ? proxiedFetch(proxy, { timeoutMs: 40_000 }) : (globalThis.fetch as unknown as EgressFetch);
  const mt = new Mentors(game, key, http, Number(env.MENTOR_DAILY_CALLS ?? 1500) || 1500);
  mt.start();
  console.log(`[mentors] ${MENTORS.map((m) => m.name).join(', ')} at sea, ${key ? `the model on${proxy ? ` (API via ${new URL(proxy).host})` : ''}` : 'no ANTHROPIC_API_KEY: their own words (mentortalk.ts)'}`);
  return mt;
}
