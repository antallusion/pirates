// «Дальний переход» on screen (owner, 2026-10-28; client/src/ui/passage.ts, server/src/game/passage.ts).

export const EN = {
  on: 'Fair wind: way ×{n} — she cannot be stopped until she arrives',
  done: 'Passage made: her own way again, the helm is yours',
  hint: 'A long passage: the helm, the guns and the orders wait until she arrives',
  other: 'She is on a long passage: nobody may touch her',
  pill: 'Long passage: {t} to the mark, {d} left',
  km: 'km',
  m: 'm',
};

export const RU: Record<keyof typeof EN, string> = {
  on: 'Попутный ветер: ход ×{n} — корабль не остановить до прибытия',
  done: 'Переход окончен: ход прежний, штурвал ваш',
  hint: 'Дальний переход: штурвал, пушки и приказы — после прибытия',
  other: 'Корабль на дальнем переходе: его не тронуть',
  pill: 'Дальний переход: {t} до метки, осталось {d}',
  km: 'км',
  m: 'м',
};
