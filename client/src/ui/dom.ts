// Tiny DOM helpers. All server-provided strings are escaped before being placed in markup.

export function $(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} missing`);
  return e;
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function pct(v: number): string {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

export function bar(cls: string, frac: number): string {
  return `<div class="bar ${cls}"><i style="width:${pct(frac)}"></i></div>`;
}

export function knots(ms: number): string {
  // Game meters/second → displayed knots on the compressed world scale.
  return (ms * 0.8).toFixed(1);
}

/** Re-renders a panel without losing what the player is typing: values and focus survive by id or data key. */
export function keepInputs(root: HTMLElement, render: () => void): void {
  const key = (el: Element) => el.id || [...el.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-dirty').map((a) => `${a.name}=${a.value}`).join('&');
  const saved = new Map<string, string>();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    const k = key(el);
    if (k && el.dataset.dirty) saved.set(k, el.value);
  });
  const active = document.activeElement && root.contains(document.activeElement) ? key(document.activeElement) : '';
  render();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    const k = key(el);
    if (k && saved.has(k)) {
      el.value = saved.get(k)!;
      el.dataset.dirty = '1';
      el.dispatchEvent(new Event('change'));
    }
    el.addEventListener('input', () => (el.dataset.dirty = '1'));
    el.addEventListener('change', () => (el.dataset.dirty = '1'));
    if (active && k === active) el.focus();
  });
}
