// The Floating Bazaar (docs/12 P10 #19): a captain opens a stall on her ship in port — goods from her hold and pieces
// from her locker at her own prices — and sails on; a shadow of her ship with a signboard stays at the anchorage, the
// captains in port buy from it, and her takings follow her by letter.

/** Silver to open a stall; the harbour's cut of each sale; how many lines of goods and of pieces; how long it stands. */
export const STALL_FEE = 150;
export const HARBOUR_CUT = 0.05;
export const STALL_GOODS = 6;
export const STALL_ITEMS = 6;
export const STALL_DAYS = 7;
/** Takings are sent by letter at most this often (minutes). */
export const PAY_EVERY_MIN = 10;
/** A price may be no more than this many times the good's base price. */
export const PRICE_CAP = 10;

export function bazaarPatterns(): [string, string][] {
  return [
    ['You open a stall at {0}.', 'Вы открыли лавку в порту {0}.'],
    ['You already keep a stall at {0}.', 'У вас уже есть лавка в порту {0}.'],
    ['You keep no stall here.', 'У вас здесь нет лавки.'],
    ['The stall is full.', 'Лавка заполнена.'],
    ['You have not that much aboard.', 'Столько у вас на борту нет.'],
    ['That price will not do.', 'Такая цена не годится.'],
    ['A bound piece is not for sale.', 'Привязанную вещь продать нельзя.'],
    ['No such piece in your locker', 'В рундуке нет такой вещи'],
    ['No such line at that stall.', 'У этой лавки нет такой строки.'],
    ['Your hold has no room for it.', 'В трюме для этого нет места.'],
    ['Your locker is full', 'Ваш рундук полон'],
    ['Not enough silver', 'Не хватает серебра'],
    ['That is your own stall.', 'Это ваша собственная лавка.'],
    ['You close your stall: what was left is back aboard.', 'Вы закрыли лавку: всё непроданное вернулось на борт.'],
    ['{0} buys at your stall in {1}: {2} silver.', 'Капитан {0} купил в вашей лавке в порту {1}: {2} серебра.'],
    ['The Floating Bazaar', 'Плавучий базар'],
    ['Takings at {0}', 'Выручка в порту {0}'],
    ['Your stall at {0} took {1} silver (the harbour kept its cut).', 'Ваша лавка в порту {0} выручила {1} серебра (гавань взяла свою долю).'],
    ['Your stall at {0} has closed after a week: what was left waits for you.', 'Ваша лавка в порту {0} закрылась через неделю: непроданное ждёт вас.'],
  ];
}
