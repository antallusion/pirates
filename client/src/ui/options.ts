// The options screen (docs/07 §11): interface, sight and motion, sound, controls. Every change applies at once.

import { lang, setLang, t } from '../i18n.ts';
import type { Key, Lang } from '../i18n.ts';
import { ACTIONS, conflicts, keyLabel, keyOf, PRESETS, settings, update } from '../settings.ts';
import type { Action, Colorblind, Settings } from '../settings.ts';
import { esc, icon } from './dom.ts';

const TAB_ICON: Record<string, string> = { ui: 'menu_options', vision: 'ab_spotters_eye', sound: 'opt_sound', controls: 'opt_controls' };

type Tab = 'ui' | 'vision' | 'sound' | 'controls';

export class OptionsScreen {
  private tab: Tab = 'ui';
  /** The binding waiting for a key: action and slot. */
  private listening: { action: Action; slot: 0 | 1 } | null = null;
  private root: HTMLElement | null = null;
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
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(t('opt.title'))}</h2>${document.body.classList.contains('touch') ? '' : `<div class="sub">${esc(t('opt.sub'))}</div>`}</div></div>
      <div class="tabs icon-tabs four">${tabs.map((x) => `<button class="tab ${x === this.tab ? 'active' : ''}" data-tab="${x}" title="${esc(t(`opt.tab.${x}` as Key))}">${icon(TAB_ICON[x])}<span>${esc(t(`opt.tab.${x}` as Key))}</span></button>`).join('')}</div>
      <div class="tab-caption">${esc(t(`opt.tab.${this.tab}` as Key))}</div>
      <div class="modal-body options">${this.body(s)}</div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.tab as Tab;
      this.listening = null;
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

  private body(s: Settings): string {
    const check = (k: keyof Settings, label: Key) => `<label class="check"><input type="checkbox" data-bool="${k}" ${s[k] ? 'checked' : ''}/> ${esc(t(label))}</label>`;
    const range = (k: 'uiScale' | 'textScale', label: Key, min: number, max: number) =>
      `<label class="opt-range"><span class="opt-l">${esc(t(label))}</span><input type="range" data-num="${k}" min="${min}" max="${max}" step="0.05" value="${s[k]}"/><output>${Math.round(s[k] * 100)}%</output></label>`;
    const vol = (k: keyof Settings['volume'], label: Key) =>
      `<label class="opt-range"><span class="opt-l">${esc(t(label))}</span><input type="range" data-vol="${k}" min="0" max="1" step="0.05" value="${s.volume[k]}"/><output>${Math.round(s.volume[k] * 100)}%</output></label>`;
    switch (this.tab) {
      case 'ui':
        return `<label class="opt-range sel"><span class="opt-l">${icon('opt_lang', '', 'ico-sm')}${esc(t('opt.lang'))}</span><select data-sel="lang" class="field">${(['en', 'ru'] as Lang[]).map((l) => `<option value="${l}" ${lang() === l ? 'selected' : ''}>${l === 'en' ? 'English' : 'Русский'}</option>`).join('')}</select></label>
          ${range('uiScale', 'opt.uiScale', 0.7, 2)}${range('textScale', 'opt.textScale', 0.9, 1.5)}
          ${check('highContrast', 'opt.highContrast')}${check('plainFont', 'opt.plainFont')}${check('plainTerms', 'opt.plainTerms')}
          <p class="muted">${esc(t('opt.readAloud', { key: keyLabel(s.keys.readAloud[0] || s.keys.readAloud[1]) }))}</p>`;
      case 'vision':
        return `<label class="opt-range sel"><span class="opt-l">${esc(t('opt.colorblind'))}</span><select data-sel="colorblind" class="field">${(['off', 'protan', 'deutan', 'tritan'] as Colorblind[]).map((c) => `<option value="${c}" ${s.colorblind === c ? 'selected' : ''}>${esc(t(`opt.cb.${c}` as Key))}</option>`).join('')}</select></label>
          ${check('lanternMarks', 'opt.lanternMarks')}${check('reduceFlashes', 'opt.reduceFlashes')}${check('screenShake', 'opt.screenShake')}${check('lanternFlicker', 'opt.lanternFlicker')}${check('reduceMotion', 'opt.reduceMotion')}
          <label class="opt-range sel"><span class="opt-l">${esc(t('opt.effects'))}</span><select data-sel="effects" class="field"><option value="auto" ${s.effects === 'auto' ? 'selected' : ''}>${esc(t('opt.effects.auto'))}</option><option value="low" ${s.effects === 'low' ? 'selected' : ''}>${esc(t('opt.effects.low'))}</option></select></label>
          ${check('webgl', 'opt.webgl')}`;
      case 'sound':
        return `${vol('master', 'opt.master')}${vol('sea', 'opt.sea')}${vol('combat', 'opt.combat')}${vol('ui', 'opt.uiVol')}${vol('music', 'opt.music')}${check('mono', 'opt.mono')}${check('captions', 'opt.captions')}`;
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
