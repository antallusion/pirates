// The Telegram bot's words (owner, 2026-10-11: «сделай мне еще телеграм версию на поддомене tg … премиум шоп сделай
// звездами … подключаться к игре … через телеграм»). The bot @gravetide_bot answers in the language its user's
// Telegram is set to: Russian for ru/uk/be, English otherwise. Each line is [English, Russian]; {name} holes are filled
// by tgText. The game's screens keep their own words in client/src/lang/ui/tg.ts.

export type TgLang = 'en' | 'ru';

export const TG_TEXTS = {
  welcome: [
    'Ahoy, {name}! GRAVETIDE is a pirate MMO on a living sea: a ship for an army, a captain for a hero, boarding fights on hexes.\n\nTap «Play» to set sail right here in Telegram.',
    'Привет, {name}! GRAVETIDE — пиратская MMO в живом море: корабль — это армия, капитан — герой, абордаж — бой на гексах.\n\nНажмите «Играть», чтобы выйти в море прямо в Telegram.',
  ],
  play: ['Play', 'Играть'],
  loginDone: ['Done! Go back to the game: you are signed in.', 'Готово, вернитесь в игру: вход выполнен.'],
  linkDone: ['Done! This Telegram is now linked to captain {name}. Go back to the game.', 'Готово! Этот Telegram привязан к капитану {name}. Вернитесь в игру.'],
  linkTaken: ['This Telegram is already linked to another captain ({name}). Sign in with it instead.', 'Этот Telegram уже привязан к другому капитану ({name}). Войдите через него.'],
  loginExpired: ['That sign-in link has expired or was used. Press «Sign in with Telegram» in the game again.', 'Ссылка для входа устарела или уже использована. Нажмите «Войти через Телеграм» в игре ещё раз.'],
  paysupport: [
    'Payment support: tell us here what went wrong — the captain\'s name, the date and the pack. Doubloons are credited the moment Telegram confirms a payment; if a payment went through and no doubloons came, we refund the Stars or credit the pack within 3 days.',
    'Поддержка по оплатам: напишите сюда, что случилось — имя капитана, дату и пакет. Дублоны зачисляются, как только Telegram подтвердит оплату; если оплата прошла, а дублоны не пришли, мы вернём звёзды или зачислим пакет в течение 3 дней.',
  ],
  terms: [
    'Terms: doubloons are the game\'s premium currency, bought with Telegram Stars only and never earned at sea. They belong to your account, buy premium ships and creatures in the game\'s shop, and cannot be exchanged back for Stars or money. A purchase can be refunded through /paysupport while its doubloons are unspent.',
    'Условия: дублоны — премиальная валюта игры, покупаются только за звёзды Telegram и не добываются в море. Они принадлежат вашему аккаунту, покупают премиальные корабли и существ в лавке игры и не обмениваются обратно на звёзды или деньги. Покупку можно вернуть через /paysupport, пока её дублоны не потрачены.',
  ],
  help: ['/start — play · /paysupport — payment support · /terms — terms of purchase', '/start — играть · /paysupport — поддержка по оплатам · /terms — условия покупки'],
  paid: ['{n} doubloons credited to captain {name}. Fair winds!', 'Капитану {name} зачислено дублонов: {n}. Попутного ветра!'],
  badPayment: ['This invoice is no longer valid. Open the shop in the game and try again.', 'Этот счёт больше не действует. Откройте лавку в игре и попробуйте ещё раз.'],
  confirmLogin: ['Sign-in to GRAVETIDE: choose the code shown on your screen.', 'Вход в GRAVETIDE: выберите код, который показан на вашем экране.'],
  confirmLink: ['Link this Telegram to captain «{name}»? Choose the code shown on your screen.', 'Привязать Телеграм к капитану «{name}»? Выберите код, который показан на вашем экране.'],
  confirmFrom: ['Sign-in from a new device: {device}, {time} (Moscow time).', 'Вход с нового устройства: {device}, {time} (МСК).'],
  confirmWarn: ['If you did not start this in the game yourself, press nothing.', 'Если вы не начинали это в игре сами — ничего не нажимайте.'],
  codeWrong: ['The code did not match: this sign-in is cancelled. Try again in the game.', 'Код не совпал: этот вход отменён. Попробуйте снова в игре.'],
  notYours: ['This confirmation is not yours.', 'Это подтверждение не для вас.'],
  someDevice: ['an unknown device', 'неизвестное устройство'],
  invoiceTitle: ['{n} doubloons', '{n} дублонов'],
  invoiceText: ['GRAVETIDE premium currency for captain {name}: {n} doubloons.', 'Премиальная валюта GRAVETIDE для капитана {name}: {n} дублонов.'],
  cmdStart: ['Play GRAVETIDE', 'Играть в GRAVETIDE'],
  cmdPaysupport: ['Payment support', 'Поддержка по оплатам'],
  cmdTerms: ['Terms of purchase', 'Условия покупки'],
} as const satisfies Record<string, readonly [string, string]>;

export type TgTextKey = keyof typeof TG_TEXTS;

/** The language of a Telegram user's client: Russian for ru/uk/be, English otherwise. */
export function tgLang(code: string | undefined | null): TgLang {
  return /^(ru|uk|be)/i.test(code ?? '') ? 'ru' : 'en';
}

/** A bot line in this language, its {holes} filled. */
export function tgText(key: TgTextKey, lang: TgLang, vars: Record<string, string | number> = {}): string {
  const s = TG_TEXTS[key][lang === 'ru' ? 1 : 0];
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The device a sign-in was asked from, by its browser's User-Agent: «Chrome, Android» (names are not translated). */
export function tgDevice(ua: string | undefined | null, lang: TgLang): string {
  const u = String(ua ?? '');
  const os = /Android/i.test(u) ? 'Android' : /iPhone|iPad|iPod/i.test(u) ? 'iOS' : /Windows/i.test(u) ? 'Windows' : /Mac OS X|Macintosh/i.test(u) ? 'macOS' : /Linux/i.test(u) ? 'Linux' : '';
  const br = /YaBrowser/i.test(u) ? 'Yandex' : /Edg\//i.test(u) ? 'Edge' : /OPR\/|Opera/i.test(u) ? 'Opera' : /Firefox\//i.test(u) ? 'Firefox' : /Chrome\//i.test(u) ? 'Chrome' : /Safari\//i.test(u) ? 'Safari' : '';
  return [br, os].filter(Boolean).join(', ') || tgText('someDevice', lang);
}

/** The hour and minute of a moment, Moscow time (the bot's confirmation: «12:04»). */
export function tgTime(ms: number): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(ms);
}
