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
