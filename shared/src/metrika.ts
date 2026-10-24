// Yandex Metrica (owner, 2026-10-24: Yandex Direct paid per conversion — a payment 200 ₽, a registration 5 ₽). The counter
// of gravetidegame.com and its subdomains; its goals (set up in Metrica):
//   registration — a new captain takes command (client/src/ui/captain.ts);
//   payment      — an order confirmed paid, once per order, with its price (site/js/shop.js, the web game's back page);
//   and Metrica's own «return from a payment system» goal, which needs only the tag on the page she comes back to.

export const METRIKA_ID = 113762378;

/** The tag as Metrica gives it (the loader, then init), for a page's head; `nonce` under a strict CSP. Webvisor only where
 *  the page is light (the website, not the game's canvas). */
export function metrikaTag(o: { webvisor?: boolean; nonce?: string } = {}): string {
  const opts = JSON.stringify({ ssr: true, webvisor: !!o.webvisor, clickmap: true, accurateTrackBounce: true, trackLinks: true });
  return `<script${o.nonce ? ` nonce="${o.nonce}"` : ''}>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${METRIKA_ID},'init',${opts});</script>`;
}

/** A goal reached, if the tag is on the page (a no-op otherwise: tests, a blocker). */
export function metrikaGoal(name: 'registration' | 'payment', params?: Record<string, unknown>, done?: () => void): void {
  const ym = (globalThis as { ym?: (...a: unknown[]) => void }).ym;
  if (typeof ym !== 'function') return void done?.();
  try {
    ym(METRIKA_ID, 'reachGoal', name, params ?? {}, done);
  } catch {
    done?.();
  }
}
