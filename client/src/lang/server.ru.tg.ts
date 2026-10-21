// The server's lines of Telegram (owner, 2026-10-11; docs/27): the Mini App's sign-in, the shop's Stars and the
// admin's refund, English → Russian. The bot's own words are in shared/src/data/telegram.ts.

export const SERVER_RU_TG: Record<string, string> = {
  'Telegram sign-in failed: open the game from the bot again.': 'Не удалось войти через Телеграм: откройте игру из бота снова.',
  'Payments are not open yet.': 'Оплата пока закрыта.',
  // the web game's YooKassa top-up (server/src/game/webshop.ts gameCheckout, owner 2026-10-21)
  'The payment could not be made. Try again in a minute.': 'Не удалось создать платёж. Попробуйте через минуту.',
  'Too many unpaid orders. Pay one or wait an hour.': 'Слишком много неоплаченных заказов. Оплатите один или подождите час.',
  'The receipt needs your e-mail: add it to your account.': 'Для чека нужна почта: добавьте её в аккаунт.',
  'The invoice could not be made. Try again in a minute.': 'Не удалось выставить счёт. Попробуйте через минуту.',
  'No payment desk on this server: the bot token is not set.': 'На этом сервере нет кассы: не задан токен бота.',
  'Usage: /refund charge_id': 'Так: /refund id_платежа',
  'Refund asked for payment {0}.': 'Возврат по платежу {0} запрошен.',
  'The refund failed: the Bot API did not answer.': 'Возврат не удался: Телеграм не ответил.',
  'No Stars payment {0} on record.': 'Платежа звёздами {0} нет в записях.',
  'Payment {0} was refunded already.': 'Платёж {0} уже возвращён.',
  'The refund failed: Bot API error {0}.': 'Возврат не удался: ошибка Телеграма {0}.',
  'Refunded {0} stars for payment {1}; {2} of {3} doubloons taken back.': 'Возвращено звёзд: {0} по платежу {1}; списано дублонов: {2} из {3}.',
};
