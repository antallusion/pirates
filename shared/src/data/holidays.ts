// The sea's holidays (docs/12 P10 #18): every weekend (Saturday and Sunday, UTC) one of four, by turns — the Night of
// the Drowned, the Herring Run, Powder Night, League Day. Each has its own sport and its own flag, won only while it
// lasts; on every holiday the pet sellers hold a fair (all four pets, at half price).

type Tr = [string, string];

export type HolidayId = 'drowned_night' | 'herring_run' | 'powder_night' | 'league_day';
export const HOLIDAY_IDS: HolidayId[] = ['drowned_night', 'herring_run', 'powder_night', 'league_day'];

export interface HolidayDef {
  name: Tr;
  text: Tr;
  /** The flag (FLAGS index) won by its deed, and what the deed is. */
  flag: number;
  deed: Tr;
  /** Points for the deed (the tournaments' unit). */
  need: number;
}

export const HOLIDAYS: Record<HolidayId, HolidayDef> = {
  drowned_night: {
    name: ['The Night of the Drowned', 'Ночь утопленников'],
    text: ['After dark the drowned rise off every sea. Sink one for its cursed gift: a fine piece, and a little of the curse.', 'С темнотой в каждом море поднимаются утопленники. Потопите призрака — получите его проклятый подарок: добрую вещь и немного проклятия.'],
    flag: 60, deed: ['Take a ghost’s gift', 'Получите подарок призрака'], need: 1,
  },
  herring_run: {
    name: ['The Herring Run', 'Сельдяной ход'],
    text: ['Herring fill every sea, and the fishing tournament is on: the heaviest catch of the run takes the prizes.', 'Сельдь наполняет все моря, идёт рыболовный турнир: самый тяжёлый улов за праздник забирает призы.'],
    flag: 61, deed: ['Catch 60 kg in the run', 'Поймайте 60 кг за праздник'], need: 60,
  },
  powder_night: {
    name: ['Powder Night', 'Пороховая ночь'],
    text: ['Fireworks over the ports after dark, and powder kegs afloat off every harbour. Burst them with your guns: the most kegs take the prizes.', 'После заката над портами фейерверки, а у каждой гавани качаются пороховые бочки. Взрывайте их из пушек: больше всех бочек — призы.'],
    flag: 62, deed: ['Burst 5 kegs', 'Взорвите 5 бочек'], need: 5,
  },
  league_day: {
    name: ['League Day', 'День Лиги'],
    text: ['The Gilded Ledger’s holiday: kinder prices in every League port. Sell there for the League’s seal.', 'Праздник Золочёного Гроссбуха: во всех портах Лиги добрые цены. Продайте там товара — получите печать Лиги.'],
    flag: 63, deed: ['Sell 3,000 silver of goods in League ports', 'Продайте товара на 3 000 серебра в портах Лиги'], need: 3000,
  },
};

export const DAY_MS = 86_400_000;
/** The tournaments' prizes (silver) for the first three, sent by letter when the holiday ends. */
export const TOURNAMENT_PRIZES = [5000, 2500, 1000];
/** Powder kegs afloat off each harbour, how far out, and how close a ball must fall to burst one. */
export const KEGS_PER_PORT = 3;
export const KEG_RING: [number, number] = [260, 620];
export const KEG_HIT_R = 18;
/** The Night of the Drowned: every minute after dark, the chance a ghost rises for each captain at sea. */
export const GHOST_RISE = 0.3;
/** The holiday fair: the pets' price. */
export const FAIR_PRICE = 0.5;

/** The holiday of a moment, and its span (null on a weekday). 1970-01-01 was a Thursday: Saturday is day % 7 === 2. */
export function holidayAt(wall: number): { id: HolidayId; start: number; end: number } | null {
  const day = Math.floor(wall / DAY_MS);
  const dow = ((day % 7) + 7) % 7;
  if (dow !== 2 && dow !== 3) return null;
  const sat = day - (dow - 2);
  return { id: HOLIDAY_IDS[Math.floor(sat / 7) % HOLIDAY_IDS.length], start: sat * DAY_MS, end: (sat + 2) * DAY_MS };
}

/** The next holiday from a moment (the current one's next if one is on). */
export function nextHoliday(wall: number): { id: HolidayId; start: number } {
  const day = Math.floor(wall / DAY_MS);
  let sat = day - (((day % 7) + 7) % 7) + 2;
  if (sat * DAY_MS <= wall) sat += 7;
  return { id: HOLIDAY_IDS[Math.floor(sat / 7) % HOLIDAY_IDS.length], start: sat * DAY_MS };
}

export function holidayPatterns(): [string, string][] {
  const out: [string, string][] = [
    ['The holiday begins: {0}. {1}', 'Начинается праздник: {0}. {1}'],
    ['The holiday is over: {0}.', 'Праздник закончился: {0}.'],
    ['A ghost’s gift: {0}. It is cold in your hand (+6 curse).', 'Подарок призрака: {0}. Он холодит руку (+6 к проклятию).'],
    ['A keg bursts! ({0} this holiday)', 'Бочка взорвалась! (за праздник: {0})'],
    ['The drowned rise off your bow.', 'У вас по носу поднимаются утопленники.'],
    ['{0}: place {1} in the tournament.', '{0}: {1}-е место в турнире.'],
    ['Your prize for {0}: {1} silver.', 'Ваш приз за праздник «{0}»: {1} серебра.'],
    ['The holiday fair', 'Праздничная ярмарка'],
  ];
  for (const h of Object.values(HOLIDAYS)) out.push([h.name[0], h.name[1]], [h.text[0], h.text[1]]);
  return out;
}
