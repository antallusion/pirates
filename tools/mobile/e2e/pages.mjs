// docs/23 item 90 (the e2e-runner's method): page objects for a phone held sideways (812×375, touch). Every action is a
// finger — a tap at the middle of what the player sees, refused when something else lies over it — never a DOM click
// or a message sent past the interface. The admin server's chat lines set the scene (silver, a foe, an island); they
// are not the player's and are not counted as taps.
import * as L from '../m0/lib.mjs';

export class StepError extends Error {}

/** One phone, one captain: the finger, the waits and the frames of a journey. */
export class Phone {
  constructor(p, { out, tag, port, touch = true }) {
    this.p = p;
    /** A finger (a phone) or a mouse (a desk). */
    this.touch = touch;
    this.out = out;
    this.tag = tag;
    this.port = port;
    this.taps = 0;
    this.frame = 0;
    this.steps = [];
    this.t0 = Date.now();
  }

  sec() { return Math.round((Date.now() - this.t0) / 100) / 10; }

  /** A frame of this moment, named after the step. */
  async shot(label) {
    this.frame++;
    const name = `${this.tag}_${String(this.frame).padStart(2, '0')}_${label}`;
    await this.p.screenshot({ path: `${this.out}/${name}.png` }).catch(() => {});
    return name;
  }

  /** A step passed: its time, the taps so far, a frame. */
  async step(label, extra = {}) {
    const shot = await this.shot(label);
    this.steps.push({ step: label, t: this.sec(), taps: this.taps, shot, ...extra });
    L.log(`  ${this.tag} · ${this.sec()} s · ${this.taps} taps · ${label}${Object.keys(extra).length ? ' ' + JSON.stringify(extra) : ''}`);
  }

  /** Where the first visible, enabled match lies, and whether a finger would reach it. */
  where(sel) {
    return this.p.evaluate((q) => {
      const els = [...document.querySelectorAll(q)];
      const e = els.find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !x.disabled && !x.closest('.hidden') && getComputedStyle(x).visibility !== 'hidden'; });
      if (!e) return { st: els.length ? 'hidden' : 'none' };
      const r = e.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      if (r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1) return { st: 'offscreen', x, y, w: r.width, h: r.height };
      const t = document.elementFromPoint(x, y);
      if (t && t !== e && !e.contains(t) && !t.contains(e)) return { st: `covered by ${t.id || (typeof t.className === 'string' ? t.className.slice(0, 40) : t.tagName)}`, x, y };
      return { st: 'ok', x, y, w: Math.round(r.width), h: Math.round(r.height) };
    }, sel);
  }

  async visible(sel) { return (await this.where(sel)).st === 'ok'; }

  /** A new level's «выберите один из двух» comes up by itself over the sea: a player takes one (counted). */
  /** A touch on a point: a finger on a phone, a click on a desk. */
  press(x, y) { return this.touch ? this.p.touchscreen.tap(x, y) : this.p.mouse.click(x, y); }

  async levelUp() {
    const w = await this.where('.lu-sheet .lu-pick');
    if (w.st !== 'ok') return false;
    await this.press(w.x, w.y);
    this.taps++;
    await L.sleep(700);
    return true;
  }

  /** A finger on it, once it can be reached (within `ms`); throws with what stood in the way. */
  async tap(sel, what = sel, ms = 8000) {
    const t = Date.now();
    let w;
    for (;;) {
      w = await this.where(sel);
      if (w.st === 'ok') break;
      if (/covered by (k-scrim|.*lu-sheet)/.test(w.st) && (await this.levelUp())) continue;
      // Below the fold of a list that scrolls: a finger drags it there (a swipe a screenful, counted).
      if (w.st === 'offscreen') {
        const swipes = await this.p.evaluate((q) => {
          const e = [...document.querySelectorAll(q)].find((x) => x.getBoundingClientRect().width > 0);
          let box = e?.parentElement;
          while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
          if (!box) return 0;
          const before = box.scrollTop;
          e.scrollIntoView({ block: 'center' });
          return Math.max(1, Math.ceil(Math.abs(box.scrollTop - before) / (box.clientHeight * 0.8)));
        }, sel);
        if (swipes) {
          this.taps += swipes;
          this.swipes = (this.swipes ?? 0) + swipes;
          await L.sleep(300);
          continue;
        }
      }
      if (Date.now() - t > ms) throw new StepError(`cannot tap ${what}: ${w.st}`);
      await L.sleep(250);
    }
    await this.press(w.x, w.y);
    this.taps++;
    await L.sleep(450);
    return w;
  }

  /** A tap if it is there now; false if not. */
  async tapIf(sel, what = sel) {
    if (!(await this.visible(sel))) return false;
    try {
      await this.tap(sel, what, 1000);
    } catch (e) {
      if (e instanceof StepError) return false; // gone before the finger came down (the page moved on by itself)
      throw e;
    }
    return true;
  }

  async tapAt(x, y) {
    await this.press(x, y);
    this.taps++;
    await L.sleep(450);
  }

  /** Waits for a condition evaluated in Node (an async fn); throws with the label after `ms`. */
  async until(fn, ms, label) {
    const t = Date.now();
    for (;;) {
      // A new level's choice comes up by itself over whatever she was about to press: she takes it, as a player would.
      await this.levelUp();
      const v = await fn();
      if (v) return v;
      if (Date.now() - t > ms) throw new StepError(`timed out (${Math.round(ms / 1000)} s): ${label}`);
      await L.sleep(300);
    }
  }

  expect(ok, msg) { if (!ok) throw new StepError(msg); }

  admin(line, ms = 1200) { return L.say(this.p, line).then(() => L.sleep(ms)); }

  /** What the game knows of her. */
  state() {
    return this.p.evaluate(() => {
      const g = globalThis.gravetide, s = g?.state;
      if (!s) return null;
      const m = document.querySelector('#modal');
      return {
        docked: s.self?.dockedAt ?? null, level: s.self?.level, silver: s.self?.gold, crew: s.self?.crew, hull: s.you?.hull, hullMax: s.you?.hullMax,
        provisions: s.self?.cargo?.provisions ?? 0, cargo: { ...(s.self?.cargo ?? {}) },
        tac: s.boardTac ? { over: !!s.boardTac.over, winner: s.boardTac.over?.winner ?? null, you: s.boardTac.you } : null,
        modal: m && !m.classList.contains('hidden') ? (document.querySelector('#modal-panel')?.dataset.modal ?? '?') : null,
        onb: s.onboarding?.stage ?? null, pursuit: !!s.pursuit, risk: !!g.riskOpen?.(),
      };
    });
  }

  /** The sea's films are not the interface's: a tap ends each (counted, as the player taps it too). */
  async skipFilm() {
    if (!(await this.p.$('.film'))) return false;
    await L.sleep(400);
    await this.tapAt(400, 180);
    return true;
  }
}

/** The title screen to the sea: the name, «Выйти в море», the captain, «Принять командование» (taps counted). */
export async function signIn(ph, { name, know = true, captain = 'corsair' }) {
  const p = ph.p;
  await p.goto(`http://localhost:${ph.port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#login-name', { state: 'visible', timeout: 90000 });
  // The game's scripts in (a slow machine draws the title before they come; a tap then went nowhere).
  await p.waitForFunction(() => !!globalThis.gravetide, null, { timeout: 90000 });
  await ph.step('title');
  await ph.tap('#login-name', 'the name field');
  await p.keyboard.type(name);
  await ph.tap('#login-form button[type="submit"]', '«Выйти в море»');
  await ph.until(() => ph.visible(`.captain-card[data-id="${captain}"]`), 60000, 'the captain list');
  await ph.step('captains');
  await ph.tap(`.captain-card[data-id="${captain}"]`, `the captain «${captain}»`);
  const known = await p.evaluate(() => document.querySelector('#know-sea')?.checked ?? false);
  if (known !== know) await ph.tap('#know-sea', '«Я знаю море»');
  await ph.tap('#pick-captain', '«Принять командование»');
  // The prologue (a film and its cards): a tap ends each, as a player would.
  await ph.until(async () => {
    if (await p.$('#hud:not(.hidden)')) return true;
    if (await p.$('.film')) await ph.skipFilm();
    else if (await p.evaluate(() => !!document.querySelector('.prologue:not(.hidden), #prologue:not(.hidden), .pro-card'))) { await ph.press(400, 300); ph.taps++; await L.sleep(600); }
    return false;
  }, 90000, 'the HUD after the prologue');
  await L.sleep(1500);
  await ph.step('hud');
  // The handbook opens once on a first arrival without the First Watch: the cross shuts it (one tap).
  if (know && (await ph.visible('#modal-panel .x-btn')) && (await p.evaluate(() => !!document.querySelector('#modal-panel .help-list')))) {
    await ph.step('handbook');
    await ph.tap('#modal-panel .x-btn', 'the handbook\'s cross');
  }
}

/** Rounds of the hex battle by the round buttons: «Авто» and its wheel's choice (0 to the end, 1 a quick fight). */
export async function autoBattle(ph, choice = 0) {
  // (a battle may be over before its first turn: a frigate's 165 men against a sloop's 25)
  await ph.until(async () => (await ph.visible('.tb-pad [data-autow]')) || !(await ph.state())?.tac || !!(await ph.state())?.tac?.over, 20000, 'the hex battle\'s «Авто»');
  if (!(await ph.visible('.tb-pad [data-autow]'))) return;
  await ph.tap('.tb-pad [data-autow]', '«Авто»');
  // The wheel's choices take no pointer of their own (the wheel reads the finger from the window): a tap on the spot.
  const at = await ph.until(() => ph.p.evaluate((i) => {
    const e = document.querySelector(`.k-wheel:not(.hidden) .k-wheel-item[data-i="${i}"]`);
    const r = e?.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, choice), 5000, 'the «Авто» wheel');
  await ph.tapAt(at.x, at.y);
}

/** The end of a hex battle: its one screen and its one button. */
export async function battleEnd(ph, ms = 90000) {
  await ph.until(async () => { const s = await ph.state(); return !s?.tac || s.tac.over; }, ms, 'the hex battle\'s end');
  const s = await ph.state();
  if (s?.tac?.over) {
    await L.sleep(800);
    await ph.step('battle_end', { winner: s.tac.winner === s.tac.you ? 'her' : 'theirs' });
    await ph.tap('.tb-pad.over button, .tb-banner:not(.hidden) button, .tb-end button', 'the battle\'s end button', 15000).catch(() => {});
  }
  await ph.until(async () => !(await ph.state())?.tac, 20000, 'the sea again after the battle');
  return s?.tac ?? null;
}

/** The pirate nearest her, where it lies on the screen (to tap it as the mark). */
export function foeOnScreen(p, role = 'pirate') {
  return p.evaluate((r) => {
    const g = globalThis.gravetide, s = g.state, o = s.ownDisplay;
    let best = null, bd = 1e9;
    for (const x of s.ships.values()) {
      if (!x.info || (x.info.npcRole ?? x.info.role) !== r || !x.cur || x.id === s.entityId) continue;
      const d = Math.hypot(x.cur.x - o.x, x.cur.y - o.y);
      if (d < bd) { bd = d; best = x; }
    }
    if (!best) return null;
    const sx = g.renderer.sx(best.cur.x), sy = g.renderer.sy(best.cur.y);
    const on = sx > 0 && sy > 0 && sx < innerWidth && sy < innerHeight && document.elementFromPoint(sx, sy)?.id === 'world';
    return { id: best.id, d: Math.round(bd), x: sx, y: sy, on, hull: best.cur.hull, crew: best.cur.crew, name: best.info.name };
  }, role);
}
