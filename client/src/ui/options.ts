// The options screen (docs/07 §11). docs/23 item 75: it opens on the six that matter on a phone — sound, music,
// language, auto-fire, auto-battle with the weak, the interface's size — and the seventh, the minimap with a mark
// (owner, 2026-10-09: «это в настройках должно меняться»); «Подробнее» leads to the rest
// (interface, sight and motion, sound, controls) as chips of the band. Every change applies at once.

import { lang, setLang, t } from '../i18n.ts';
import type { Key, Lang } from '../i18n.ts';
import { ACTIONS, DENSITIES, conflicts, keyLabel, keyOf, PRESETS, settings, update } from '../settings.ts';
import type { Action, Colorblind, Settings } from '../settings.ts';
import { esc, icon } from './dom.ts';
import { dict } from '../i18n.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../lang/ui/win.ts';
import { chipRow, winHead } from './kit/window.ts';
import { tgDeepLink, tgLinked, tgSettingsButton } from '../tg.ts'; // «Привязать Телеграм» (docs/27)

const W = dict(WIN_EN, WIN_RU);
/** The interface's sizes on the main page (uiScale). */
export const UI_SIZES = [0.85, 1, 1.15, 1.3] as const;

const TAB_ICON: Record<string, string> = { ui: 'menu_options', vision: 'ab_spotters_eye', sound: 'opt_sound', controls: 'opt_controls' };

type Tab = 'ui' | 'vision' | 'sound' | 'controls';

export class OptionsScreen {
  private tab: Tab = 'ui';
  /** The six main settings, or the rest («Подробнее»). */
  private more = false;
  /** The binding waiting for a key: action and slot. */
  private listening: { action: Action; slot: 0 | 1 } | null = null;
  private root: HTMLElement | null = null;
  /** The account's Telegram: linked, not yet, or null (no Telegram on the server) — docs/27. */
  private tg: boolean | null = null;
  close: () => void = () => {};

  constructor() {
    addEventListener(
      'keydown',
      (e) => {
        if (!this.listening || !this.root?.isConnected) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const k = e.key === 'Escape' ? '' : keyOf(e);
        const { action, slot } = this.listening;
        const keys = { ...settings().keys, [action]: [...settings().keys[action]] as [string, string] };
        keys[action][slot] = k;
        this.listening = null;
        update({ keys });
        this.render(this.root);
      },
      true,
    );
  }

  /** Whether a key press belongs to this screen (rebinding). */
  get capturing(): boolean {
    return this.listening !== null;
  }

  render(root: HTMLElement): void {
    this.root = root;
    const s = settings();
    const tabs: Tab[] = ['ui', 'vision', 'sound', 'controls'];
    const chips = this.more ? chipRow([{ id: 'main', icon: 'menu_options', label: W('opt.back') }, ...tabs.map((x) => ({ id: x, icon: TAB_ICON[x], label: t(`opt.tab.${x}` as Key) }))], this.tab, 'otab') : '';
    root.innerHTML = `${winHead(W('opt.title'), { crest: 'menu_options', chips })}
      <div class="modal-body w-body options${this.more ? '' : ' opt-main'}">${this.more ? this.body(s) : this.main(s)}</div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-otab]').forEach((b) => (b.onclick = () => {
      if (b.dataset.otab === 'main') this.more = false;
      else this.tab = b.dataset.otab as Tab;
      this.listening = null;
      this.render(root);
    }));
    root.querySelector<HTMLButtonElement>('[data-otg]')?.addEventListener('click', () => {
      let token: string | null = null;
      try { token = localStorage.getItem('gravetide.token'); } catch { /* no storage */ }
      void tgDeepLink({ token, onLinked: () => {
        this.tg = true;
        if (this.root?.isConnected) this.render(this.root);
      } });
    });
    if (!this.more) {
      let token: string | null = null;
      try { token = localStorage.getItem('gravetide.token'); } catch { /* no storage */ }
      void tgLinked(token).then((v) => {
        if (v === this.tg) return;
        this.tg = v;
        if (this.root === root && root.isConnected && !this.more) this.render(root);
      });
    }
    root.querySelector<HTMLButtonElement>('[data-omore]')?.addEventListener('click', () => {
      this.more = true;
      this.render(root);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-oswitch]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.oswitch as 'autoFire' | 'autoWeak';
      update({ [k]: !settings()[k] } as Partial<Settings>);
      this.render(root);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-olang]').forEach((b) => (b.onclick = () => {
      setLang(b.dataset.olang as Lang);
      this.render(root);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-omm]').forEach((b) => (b.onclick = () => {
      update({ mmTarget: b.dataset.omm === 'show' ? 'show' : 'hide' });
      this.render(root);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-osize]').forEach((b) => (b.onclick = () => {
      update({ uiScale: Number(b.dataset.osize) });
      this.render(root);
    }));
    root.querySelectorAll<HTMLInputElement>('input[data-bool]').forEach((el) => (el.onchange = () => update({ [el.dataset.bool!]: el.checked } as Partial<Settings>)));
    root.querySelectorAll<HTMLInputElement>('input[data-num]').forEach((el) => (el.oninput = () => {
      update({ [el.dataset.num!]: Number(el.value) } as Partial<Settings>);
      const out = el.parentElement?.querySelector('output');
      if (out) out.textContent = `${Math.round(Number(el.value) * 100)}%`;
    }));
    root.querySelectorAll<HTMLInputElement>('input[data-vol]').forEach((el) => (el.oninput = () => {
      update({ volume: { ...settings().volume, [el.dataset.vol!]: Number(el.value) } });
      const out = el.parentElement?.querySelector('output');
      if (out) out.textContent = `${Math.round(Number(el.value) * 100)}%`;
    }));
    root.querySelectorAll<HTMLSelectElement>('select[data-sel]').forEach((el) => (el.onchange = () => {
      const k = el.dataset.sel!;
      if (k === 'lang') {
        setLang(el.value as Lang);
        this.render(root);
      } else update({ [k]: el.value } as Partial<Settings>);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => (b.onclick = () => {
      update({ keys: structuredClone(PRESETS[b.dataset.preset as keyof typeof PRESETS]) });
      this.render(root);
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach((b) => {
      const [action, slot] = b.dataset.bind!.split(':') as [Action, string];
      b.onclick = () => {
        this.listening = { action, slot: Number(slot) as 0 | 1 };
        this.render(root);
      };
      b.oncontextmenu = (e) => {
        e.preventDefault();
        const keys = { ...settings().keys, [action]: [...settings().keys[action]] as [string, string] };
        keys[action][Number(slot)] = '';
        update({ keys });
        this.render(root);
      };
    });
  }

  /** docs/23 item 75: the six on one page (two columns on a phone held sideways), and «Подробнее». */
  private main(s: Settings): string {
    const row = (ico: string, label: string, ctl: string, hint = '', cls = '') => `<div class="opt-row${cls ? ` ${cls}` : ''}"${hint ? ` data-hint="${esc(hint)}"` : ''}>${icon(ico, '', 'opt-ico')}<span class="opt-name">${esc(label)}</span>${ctl}</div>`;
    const vol = (k: 'master' | 'music', label: string) => `<input type="range" data-vol="${k}" min="0" max="1" step="0.05" value="${s.volume[k]}" aria-label="${esc(label)}"/><output>${Math.round(s.volume[k] * 100)}%</output>`;
    const sw = (k: 'autoFire' | 'autoWeak', label: string) => `<button type="button" class="w-switch" role="switch" aria-checked="${s[k]}" aria-label="${esc(label)}" data-oswitch="${k}"><i aria-hidden="true"></i><span>${esc(s[k] ? W('opt.on') : W('opt.off'))}</span></button>`;
    // Each language by its own name (a language's name is not translated: the class keeps the checks off it).
    const seg = (items: [string, string, boolean][], attr: string, label: string) => `<span class="w-seg" role="group" aria-label="${esc(label)}">${items.map(([v, l, on]) => `<button type="button" class="w-chip${on ? ' on' : ''}${attr === 'olang' ? ' no-tr' : ''}" aria-pressed="${on}" data-${attr}="${esc(v)}"${attr === 'olang' ? ` lang="${esc(v)}"` : ''}>${esc(l)}</button>`).join('')}</span>`;
    const near = UI_SIZES.reduce((a, b) => (Math.abs(b - s.uiScale) < Math.abs(a - s.uiScale) ? b : a), 1 as number);
    return `<div class="opt-grid">
      ${row('opt_sound', W('opt.sound'), vol('master', W('opt.sound')))}
      ${row('opt_sound', W('opt.music'), vol('music', W('opt.music')))}
      ${row('opt_lang', W('opt.lang'), seg([['ru', 'Русский', lang() === 'ru'], ['en', 'English', lang() === 'en']], 'olang', W('opt.lang')))}
      ${row('fire', W('opt.autofire'), sw('autoFire', W('opt.autofire')), W('opt.autofireHint'))}
      ${row('bt_auto', W('opt.autobattle'), sw('autoWeak', W('opt.autobattle')), W('opt.autobattleHint'))}
      ${row('menu_options', W('opt.size'), seg(UI_SIZES.map((v) => [String(v), `${Math.round(v * 100)}%`, v === near] as [string, string, boolean]), 'osize', W('opt.size')), W('opt.sizeHint'))}
      ${row('menu_map', W('opt.mmTarget'), seg([['hide', W('opt.mmHide'), s.mmTarget === 'hide'], ['show', W('opt.mmShow'), s.mmTarget === 'show']], 'omm', W('opt.mmTarget')), W('opt.mmTargetHint'), 'opt-row--wide')}
    </div>
    <div class="opt-foot"><button type="button" class="k-btn k-btn--secondary k-btn--md opt-more" data-omore>${esc(W('opt.more'))}</button>${tgSettingsButton(this.tg)}</div>`;
  }

  private body(s: Settings): string {
    const check = (k: keyof Settings, label: Key) => `<label class="check"><input type="checkbox" data-bool="${k}" ${s[k] ? 'checked' : ''}/> ${esc(t(label))}</label>`;
    const range = (k: 'uiScale' | 'textScale' | 'hudAlpha', label: Key, min: number, max: number) =>
      `<label class="opt-range"><span class="opt-l">${esc(t(label))}</span><input type="range" data-num="${k}" min="${min}" max="${max}" step="0.05" value="${s[k]}"/><output>${Math.round(s[k] * 100)}%</output></label>`;
    const vol = (k: keyof Settings['volume'], label: Key) =>
      `<label class="opt-range"><span class="opt-l">${esc(t(label))}</span><input type="range" data-vol="${k}" min="0" max="1" step="0.05" value="${s.volume[k]}"/><output>${Math.round(s.volume[k] * 100)}%</output></label>`;
    switch (this.tab) {
      case 'ui':
        return `<label class="opt-range sel"><span class="opt-l">${icon('opt_lang', '', 'ico-sm')}${esc(t('opt.lang'))}</span><select data-sel="lang" class="field">${(['en', 'ru'] as Lang[]).map((l) => `<option value="${l}" ${lang() === l ? 'selected' : ''}>${l === 'en' ? 'English' : 'Русский'}</option>`).join('')}</select></label>
          <label class="opt-range sel"><span class="opt-l">${esc(t('opt.density'))}</span><select data-sel="density" class="field">${DENSITIES.map((d) => `<option value="${d}" ${s.density === d ? 'selected' : ''}>${esc(t(`opt.dens.${d}` as Key))}</option>`).join('')}</select></label>
          ${range('uiScale', 'opt.uiScale', 0.7, 2)}${range('textScale', 'opt.textScale', 0.9, 1.5)}${range('hudAlpha', 'opt.hudAlpha', 0.3, 1)}
          ${check('highContrast', 'opt.highContrast')}${check('plainFont', 'opt.plainFont')}${check('plainTerms', 'opt.plainTerms')}${check('classicBoarding', 'opt.classicBoarding')}${check('autoFire', 'opt.autoFire')}${check('autoWeak', 'opt.autoWeak')}${check('expertHud', 'opt.expertHud')}${check('expertGuns', 'opt.expertGuns')}${check('tacConfirm', 'opt.tacConfirm')}${check('firstHints', 'opt.firstHints')}
          <p class="muted">${esc(t('opt.readAloud', { key: keyLabel(s.keys.readAloud[0] || s.keys.readAloud[1]) }))}</p>`;
      case 'vision':
        return `<label class="opt-range sel"><span class="opt-l">${esc(t('opt.colorblind'))}</span><select data-sel="colorblind" class="field">${(['off', 'protan', 'deutan', 'tritan'] as Colorblind[]).map((c) => `<option value="${c}" ${s.colorblind === c ? 'selected' : ''}>${esc(t(`opt.cb.${c}` as Key))}</option>`).join('')}</select></label>
          ${check('lanternMarks', 'opt.lanternMarks')}${check('reduceFlashes', 'opt.reduceFlashes')}${check('screenShake', 'opt.screenShake')}${check('vibrate', 'opt.vibrate')}${check('lanternFlicker', 'opt.lanternFlicker')}${check('reduceMotion', 'opt.reduceMotion')}
          <label class="opt-range sel"><span class="opt-l">${esc(t('opt.effects'))}</span><select data-sel="effects" class="field"><option value="auto" ${s.effects === 'auto' ? 'selected' : ''}>${esc(t('opt.effects.auto'))}</option><option value="low" ${s.effects === 'low' ? 'selected' : ''}>${esc(t('opt.effects.low'))}</option></select></label>
          ${check('webgl', 'opt.webgl')}`;
      case 'sound':
        return `${vol('master', 'opt.master')}${vol('sea', 'opt.sea')}${vol('combat', 'opt.combat')}${vol('ui', 'opt.uiVol')}${vol('music', 'opt.music')}${check('shipVoices', 'opt.shipVoices')}${check('mono', 'opt.mono')}${check('captions', 'opt.captions')}`;
      case 'controls': {
        const clash = conflicts(s.keys);
        const bad = new Set([...clash.keys()]);
        return `<div class="opt-presets">${esc(t('opt.preset'))}: ${(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((p) => `<button class="btn btn-small" data-preset="${p}">${esc(t(`opt.preset.${p}` as Key))}</button>`).join(' ')}</div>
          ${clash.size ? `<p class="bad">${esc(t('opt.conflict', { keys: [...clash.keys()].map(keyLabel).join(', ') }))}</p>` : ''}
          <p class="muted">${esc(t('opt.clear'))}</p>
          <table class="grid keymap">${ACTIONS.map((a) => `<tr><td>${esc(t(`act.${a}` as Key))}</td>${([0, 1] as const).map((slot) => {
            const k = s.keys[a][slot];
            const wait = this.listening?.action === a && this.listening.slot === slot;
            return `<td><button class="btn btn-small bind ${k && bad.has(k) ? 'clash' : ''} ${wait ? 'wait' : ''}" data-bind="${a}:${slot}">${esc(wait ? t('opt.press') : keyLabel(k))}</button></td>`;
          }).join('')}</tr>`).join('')}</table>`;
      }
    }
  }
}
