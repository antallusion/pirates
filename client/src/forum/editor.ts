// The forum's editor (docs/32_FORUM.md): a toolbar (bold, italic, link, quote, list, spoiler, picture, video), a
// preview by the same renderer the server uses, a draft kept in localStorage, uploads (button, paste, drop),
// Ctrl+Enter to send, and the honeypot and the time since shown the server's traps want.

import { renderMd } from '../../../shared/src/forum/markdown.ts';
import { api, BASE, errText, esc, K, LANG, t, toast } from './core.ts';

export interface EditorOpts {
  draftKey: string;
  initial?: string;
  title?: string | null; // a title field (a new topic, or the first post's edit)
  sendLabel?: string;
  compact?: boolean;
  onSubmit(v: { body: string; title?: string; website: string; t: number }): Promise<void>;
  onCancel?: () => void;
}

export interface Editor {
  el: HTMLElement;
  insert(text: string, block?: boolean): void;
  quote(name: string, postId: number, text: string): void;
  replyTo(id: number | null, name?: string): void;
  replying(): number | null;
  focus(): void;
}

const svg = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
const TOOLS: { id: string; label: string; icon: string }[] = [
  { id: 'bold', label: 'ed_bold', icon: svg('M7 4h6.2a4.3 4.3 0 0 1 2.9 7.5A4.6 4.6 0 0 1 13.8 20H7V4zm3 3v3.6h3a1.8 1.8 0 0 0 0-3.6h-3zm0 6.4V17h3.6a1.8 1.8 0 0 0 0-3.6H10z') },
  { id: 'italic', label: 'ed_italic', icon: svg('M10 4h8v3h-2.6l-3.3 10H15v3H7v-3h2.6l3.3-10H10z') },
  { id: 'link', label: 'ed_link', icon: `<img src="${K('ico/link')}" alt="" width="20" height="20">` },
  { id: 'quote', label: 'ed_quote', icon: `<img src="${K('ico/quote')}" alt="" width="20" height="20">` },
  { id: 'list', label: 'ed_list', icon: svg('M4 5.5h2.5V8H4zm4 .2h12v2H8zM4 10.8h2.5v2.5H4zm4 .2h12v2H8zm-4 5.1h2.5v2.5H4zm4 .2h12v2H8z') },
  { id: 'spoiler', label: 'ed_spoiler', icon: `<img src="${K('ico/hide')}" alt="" width="20" height="20">` },
  { id: 'image', label: 'ed_image', icon: `<img src="${K('ico/spyglass')}" alt="" width="20" height="20">` },
  { id: 'video', label: 'ed_video', icon: `<img src="${K('ico/lighthouse')}" alt="" width="20" height="20">` },
];

export function mountEditor(host: HTMLElement, o: EditorOpts): Editor {
  const shownAt = Date.now();
  let replyId: number | null = null;
  const draft = (() => {
    try {
      return JSON.parse(localStorage.getItem(`gravetide.forum.draft.${o.draftKey}`) ?? 'null') as { body: string; title?: string } | null;
    } catch {
      return null;
    }
  })();
  const startBody = o.initial ?? draft?.body ?? '';
  const startTitle = o.title ?? draft?.title ?? '';
  host.innerHTML = `<form class="f-editor${o.compact ? ' compact' : ''}" novalidate>
${o.title !== undefined ? `<label class="f-ed-title"><span>${esc(t('ed_title'))}</span><input name="title" maxlength="100" minlength="4" required autocomplete="off" value="${esc(startTitle)}"></label>` : ''}
<div class="f-ed-reply" hidden></div>
<div class="f-ed-bar" role="toolbar" aria-label="Markdown">${TOOLS.map((x) => `<button type="button" class="f-ed-tool" data-tool="${x.id}" title="${esc(t(x.label))}" aria-label="${esc(t(x.label))}">${x.icon}</button>`).join('')}
<span class="f-ed-sp"></span><div class="f-ed-tabs" role="tablist"><button type="button" role="tab" class="on" data-tab="write" aria-selected="true">${esc(t('ed_write'))}</button><button type="button" role="tab" data-tab="preview" aria-selected="false">${esc(t('ed_preview'))}</button></div></div>
<div class="f-ed-area"><textarea name="body" rows="${o.compact ? 6 : 12}" placeholder="${esc(t('ed_placeholder'))}" aria-label="${esc(t('ed_write'))}">${esc(startBody)}</textarea><div class="f-ed-drop" aria-hidden="true">${esc(t('ed_drop'))}</div>
<div class="f-ed-preview f-md" hidden></div></div>
<input class="f-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<input type="file" class="f-ed-file" accept="image/png,image/jpeg,image/webp,video/mp4" hidden>
<div class="f-ed-foot"><span class="f-ed-hint">${esc(t('ed_hint'))}</span><span class="f-ed-status" aria-live="polite"></span>
${o.onCancel ? `<button type="button" class="btn-oak sm f-ed-cancel">${esc(t('ed_cancel'))}</button>` : ''}<button type="submit" class="btn-gold sm f-ed-send">${esc(o.sendLabel ?? t('ed_send'))}</button></div>
</form>`;
  const form = host.querySelector('form') as HTMLFormElement;
  const ta = form.querySelector('textarea') as HTMLTextAreaElement;
  const titleIn = form.querySelector('input[name=title]') as HTMLInputElement | null;
  const preview = form.querySelector('.f-ed-preview') as HTMLElement;
  const status = form.querySelector('.f-ed-status') as HTMLElement;
  const file = form.querySelector('.f-ed-file') as HTMLInputElement;
  const replyBox = form.querySelector('.f-ed-reply') as HTMLElement;
  const send = form.querySelector('.f-ed-send') as HTMLButtonElement;

  let saveTimer = 0;
  const saveDraft = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        const body = ta.value;
        const title = titleIn?.value;
        if (body.trim() || title?.trim()) localStorage.setItem(`gravetide.forum.draft.${o.draftKey}`, JSON.stringify({ body, title }));
        else localStorage.removeItem(`gravetide.forum.draft.${o.draftKey}`);
        if (body.trim()) status.textContent = t('ed_draft');
      } catch {
        /* a full or closed storage: no draft */
      }
    }, 600);
  };
  ta.addEventListener('input', saveDraft);
  titleIn?.addEventListener('input', saveDraft);

  /** Wrap the selection (or put the marks at the caret). */
  const wrap = (a: string, b = a, placeholder = '') => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder;
    ta.setRangeText(a + sel + b, s, e, 'end');
    if (!ta.value.slice(s, e).length && placeholder) ta.setSelectionRange(s + a.length, s + a.length + sel.length);
    ta.focus();
    saveDraft();
  };
  const insert = (text: string, block = false) => {
    const s = ta.selectionStart;
    const before = ta.value.slice(0, s);
    const pad = block && before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    ta.setRangeText(pad + text + (block ? '\n' : ''), s, ta.selectionEnd, 'end');
    ta.focus();
    saveDraft();
  };
  const linePrefix = (prefix: string) => {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const start = ta.value.lastIndexOf('\n', s - 1) + 1;
    const chunk = ta.value.slice(start, e) || '';
    ta.setRangeText(chunk.split('\n').map((l) => prefix + l).join('\n') || prefix, start, e, 'end');
    ta.focus();
    saveDraft();
  };

  const upload = async (f: File) => {
    status.textContent = t('ed_uploading');
    send.disabled = true;
    try {
      const r = await api<{ url: string; kind: string }>('upload', undefined, f);
      const cap = f.name.replace(/\.[^.]+$/, '').replace(/[[\]()]/g, '').slice(0, 60);
      insert(r.kind === 'video' ? `![${cap}](${r.url})` : `![${cap}](${r.url})`, true);
      status.textContent = '';
    } catch (e) {
      status.textContent = '';
      toast(errText(e), 'err');
    } finally {
      send.disabled = false;
    }
  };

  form.querySelector('.f-ed-bar')!.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    const tab = b.dataset.tab;
    if (tab) {
      const pv = tab === 'preview';
      form.querySelectorAll('.f-ed-tabs button').forEach((x) => {
        x.classList.toggle('on', (x as HTMLElement).dataset.tab === tab);
        x.setAttribute('aria-selected', String((x as HTMLElement).dataset.tab === tab));
      });
      preview.hidden = !pv;
      ta.hidden = pv;
      if (pv) preview.innerHTML = ta.value.trim() ? renderMd(ta.value, { lang: LANG, userBase: `${BASE}u/`, postBase: `${BASE}p/` }) : `<p class="muted">${esc(t('ed_empty_preview'))}</p>`;
      return;
    }
    switch (b.dataset.tool) {
      case 'bold': return wrap('**', '**', t('ed_bold').toLowerCase());
      case 'italic': return wrap('*', '*', t('ed_italic').toLowerCase());
      case 'link': {
        const u = prompt(t('ed_link_prompt'), 'https://');
        if (u && /^(https?:\/\/|\/)/.test(u)) wrap('[', `](${u.replace(/[\s)]/g, '')})`, t('ed_link').toLowerCase());
        return;
      }
      case 'quote': return linePrefix('> ');
      case 'list': return linePrefix('- ');
      case 'spoiler': return wrap(`[spoiler=${t('ed_spoiler_title')}]\n`, '\n[/spoiler]', '…');
      case 'image':
        file.accept = 'image/png,image/jpeg,image/webp';
        return file.click();
      case 'video':
        file.accept = 'video/mp4';
        return file.click();
    }
  });
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    file.value = '';
    if (f) void upload(f);
  });
  ta.addEventListener('paste', (ev) => {
    const f = [...(ev.clipboardData?.files ?? [])][0];
    if (f) {
      ev.preventDefault();
      void upload(f);
    }
  });
  const area = form.querySelector('.f-ed-area') as HTMLElement;
  area.addEventListener('dragover', (ev) => {
    if (ev.dataTransfer?.types.includes('Files')) {
      ev.preventDefault();
      area.classList.add('drag');
    }
  });
  area.addEventListener('dragleave', () => area.classList.remove('drag'));
  area.addEventListener('drop', (ev) => {
    area.classList.remove('drag');
    const f = ev.dataTransfer?.files?.[0];
    if (f) {
      ev.preventDefault();
      void upload(f);
    }
  });
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      form.requestSubmit();
    }
  });
  form.querySelector('.f-ed-cancel')?.addEventListener('click', () => o.onCancel?.());
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (send.disabled) return;
    send.disabled = true;
    try {
      await o.onSubmit({ body: ta.value, title: titleIn?.value, website: (form.elements.namedItem('website') as HTMLInputElement).value, t: Date.now() - shownAt });
      try {
        localStorage.removeItem(`gravetide.forum.draft.${o.draftKey}`);
      } catch {
        /* nothing kept */
      }
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      send.disabled = false;
    }
  });

  const ed: Editor = {
    el: form,
    insert,
    quote(name, postId, text) {
      const body = text.trim().split('\n').slice(0, 30).join('\n');
      insert(`[quote=${name.replace(/[\]#\n]/g, '')}#${postId}]\n${body}\n[/quote]\n`, true);
    },
    replyTo(id, name) {
      replyId = id;
      replyBox.hidden = !id;
      replyBox.innerHTML = id ? `<span>${esc(t('in_reply'))} <b>${esc(name ?? '')}</b></span><button type="button" class="f-ed-x">${esc(t('cancel_reply'))}</button>` : '';
      replyBox.querySelector('.f-ed-x')?.addEventListener('click', () => ed.replyTo(null));
    },
    replying: () => replyId,
    focus() {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    },
  };
  return ed;
}
