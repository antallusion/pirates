// «Выход» (forum 45): the tray's button and the menu's tile ask the server (server/src/game/exit.ts); in port she leaves
// at once, at sea «ВЫХОД ЧЕРЕЗ 0:30» counts down in the top band (any order of hers calls it off — the server says so,
// and why); done, the «Вы вышли» screen with «Вернуться» (a fresh page: the line was closed with no reconnect, 4003).

import type { ExitWhy, ServerMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/fx.ts';
import { esc, icon } from './dom.ts';
import { buttonHtml } from './kit/button.ts';

const L = dict(EN, RU);

export interface ExitHooks {
  send(m: { t: 'logout'; cancel?: boolean }): void;
  on(f: (m: ServerMsg) => void): void;
  /** World time now (the server's clock as the client keeps it). */
  now(): number;
  toast(msg: string, kind: 'bad' | 'info'): void;
}

/** «ВЫХОД ЧЕРЕЗ 0:30»: the seconds left as m:ss. */
export function exitClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Why it was called off, in her words (nothing for her own «Отмена»: she knows). */
export function exitWhyText(why: ExitWhy | undefined): string {
  return why === 'action' ? L('exitOffAction') : why === 'fire' ? L('exitOffFire') : why === 'fight' ? L('exitOffFight') : '';
}

export class ExitUi {
  private until = 0;
  private timer = 0;
  private banner: HTMLElement;
  private screen: HTMLElement;
  private h: ExitHooks;
  left = false;

  constructor(h: ExitHooks) {
    this.h = h;
    this.banner = document.createElement('div');
    this.banner.id = 'hud-exit';
    this.banner.className = 'hidden';
    this.banner.setAttribute('role', 'status');
    this.banner.setAttribute('aria-live', 'polite');
    document.body.append(this.banner);
    this.screen = document.createElement('section');
    this.screen.id = 'screen-exit';
    this.screen.className = 'hidden';
    this.screen.setAttribute('role', 'dialog');
    this.screen.setAttribute('aria-modal', 'true');
    document.body.append(this.screen);
    h.on((m) => {
      if (m.t !== 'exit') return;
      if (m.done) return this.showLeft();
      if (m.until > 0) return this.start(m.until);
      const was = this.until > 0;
      this.stop();
      const words = exitWhyText(m.why);
      if (words && (was || m.why === 'fight' || m.why === 'fire')) h.toast(words, 'bad');
    });
  }

  /** Her «Выход» pressed. */
  ask(): void {
    if (this.left) return;
    this.h.send({ t: 'logout' });
  }

  /** The line closed for good (4003): the screen, whether or not the word came first. */
  closed(): void {
    this.showLeft();
  }

  private start(until: number): void {
    this.until = until;
    this.banner.classList.remove('hidden');
    this.draw();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.draw(), 250);
  }

  private stop(): void {
    this.until = 0;
    clearInterval(this.timer);
    this.banner.classList.add('hidden');
  }

  private draw(): void {
    const left = this.until - this.h.now();
    const t = exitClock(left);
    const key = `${t}|${document.documentElement.lang}`;
    if (this.banner.dataset.k === key) return;
    this.banner.dataset.k = key;
    this.banner.innerHTML = `<span class="ex-t"><b>${esc(L('exitIn', { t }))}</b><small>${esc(L('exitHint'))}</small></span>${buttonHtml({ kind: 'secondary', label: L('exitCancel'), cls: 'ex-x btn-small' })}`;
    this.banner.querySelector<HTMLButtonElement>('.ex-x')!.onclick = () => this.h.send({ t: 'logout', cancel: true });
  }

  private showLeft(): void {
    if (this.left) return;
    this.left = true;
    this.stop();
    this.screen.innerHTML = `<div class="ex-card">${icon('ui_anchor', '⚓', 'ex-ico')}<h2>${esc(L('leftTitle'))}</h2><p>${esc(L('leftText'))}</p>${buttonHtml({ kind: 'primary', label: L('leftBack'), cls: 'ex-back' })}</div>`;
    this.screen.classList.remove('hidden');
    const back = this.screen.querySelector<HTMLButtonElement>('.ex-back')!;
    back.onclick = () => location.reload();
    back.focus({ preventScroll: true });
  }
}
