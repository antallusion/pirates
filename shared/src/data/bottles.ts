// Bottle mail (docs/12 P10 #6): the rules of a bottle thrown into the sea, and its lines in both tongues.

export const BOTTLE_COST = 10;
export const BOTTLE_MAX_NOTE = 240;
export const BOTTLE_MAX_SILVER = 500;
export const BOTTLE_FIND_R = 220;
export const BOTTLE_MIN_AGE_MS = 3600_000;
export const BOTTLE_SINK_MS = 14 * 86_400_000;

export function bottlePatterns(): [string, string][] {
  return [
    ['The bottle bobs away on the current.', 'Бутылка уплывает по течению.'],
    ['A bottle is thrown from a ship at sea.', 'Бутылку бросают с корабля в море.'],
    ['Write something first.', 'Сначала напишите записку.'],
    ['A bottle in the waves! A note from {0}.', 'В волнах бутылка! Записка от капитана {0}.'],
    ['A bottle in the waves! A note from {0}. Inside: {1} silver.', 'В волнах бутылка! Записка от капитана {0}. Внутри — {1} серебра.'],
    ['Bottle: {0}', 'Бутылка: {0}'],
    ['A message in a bottle', 'Послание в бутылке'],
    ['The sea', 'Море'],
    ['Your bottle was found', 'Вашу бутылку нашли'],
    ['Your bottle was found by {0} after {1} days afloat.', 'Вашу бутылку выловил капитан {0} — она плавала {1} дн.'],
  ];
}
