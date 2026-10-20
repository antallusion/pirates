// The test mode's checkout page (server/src/game/webshop.ts): the game's own page in the site's dress, marked plainly
// as a test — no money moves. «Pay (test)» or «Decline» posts back to /api/site/pay/test, which settles the fake
// payment and checks it as YooKassa's would be checked, then sends the buyer to the shop's return page.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TEXT = {
  ru: { h: 'Тестовая оплата', warn: 'ТЕСТОВЫЙ РЕЖИМ: деньги не списываются. Это страница самой игры, а не ЮKassa.', who: 'Капитан', what: 'Товар', sum: 'Сумма', pay: 'Оплатить (тест)', no: 'Отказаться', done: 'Заказ уже закрыт.', back: 'Вернуться в магазин' },
  en: { h: 'Test payment', warn: 'TEST MODE: no money is charged. This is the game’s own page, not YooKassa.', who: 'Captain', what: 'Item', sum: 'Amount', pay: 'Pay (test)', no: 'Decline', done: 'This order is closed already.', back: 'Back to the shop' },
};

export function testCheckoutPage(o: { id: string; lang: 'ru' | 'en'; name: string; item: string; rub: number; open: boolean }): string {
  const t = TEXT[o.lang];
  const shop = o.lang === 'en' ? '/site/en/shop/' : '/site/shop/';
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(t.h)} — GRAVETIDE</title><link rel="stylesheet" href="/site/css/fonts.css"><link rel="stylesheet" href="/site/css/site.css"><link rel="stylesheet" href="/site/css/shop.css"></head>
<body class="pg-shop"><main class="wrap testpay"><div class="panel testpay-card"><img class="testpay-logo" src="/site/img/brand/logo.webp" alt="GRAVETIDE" width="120" height="96">
<p class="testpay-warn" role="alert">${esc(t.warn)}</p><h1>${esc(t.h)}</h1>
<dl><dt>${esc(t.who)}</dt><dd>${esc(o.name)}</dd><dt>${esc(t.what)}</dt><dd>${esc(o.item)}</dd><dt>${esc(t.sum)}</dt><dd>${o.rub.toLocaleString('ru-RU')} ₽</dd></dl>
${o.open ? `<form method="post" action="/api/site/pay/test"><input type="hidden" name="order" value="${esc(o.id)}"><div class="testpay-act"><button class="btn-gold" name="act" value="pay">${esc(t.pay)}</button><button class="btn-oak" name="act" value="cancel">${esc(t.no)}</button></div></form>` : `<p>${esc(t.done)}</p><p><a class="btn-oak sm" href="${shop}?order=${esc(o.id)}">${esc(t.back)}</a></p>`}
</div></main></body></html>`;
}
