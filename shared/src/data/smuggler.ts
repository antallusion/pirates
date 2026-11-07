// «Услуга контрабандиста» — the smuggler's passage (forum, Эдуард, post 92: «в 11 главе получаю задание — зайти на остров
// Рассольный Приют, но так как это Шепчущий архипелаг и там не любят Корону с Лигой (в кармане "Патент Короны"), остров для
// меня закрыт, прохождение сюжета приостановлено! … вариант — добавить «Услугу контрабандиста», которая поможет тайно
// высадиться на берег и встретиться с заказчиком задания»; owner: «надо все упрощать… и автоматизировать»).
//
// A harbour that shuts its quay to her for her patent (its issuer's enemy) or for her standing (its flag holds her an
// enemy) is never a dead end: at its refusal a smuggler's boat offers to put her in by night. She pays once, says yes,
// and is in — no customs, no harbour master — and for SMUGGLE_PASS_MS after it the same boat takes her in and out of that
// harbour again. The price is a quarter of a sea-hour of her ship's waters when a step of one of her quests is there (a
// story never stops for a flag), three quarters for plain trade (a closed port is still a closed port). Skulls are the
// law's business, not the smugglers': a pirate haven's pardon or the wash.

/** How long the boat keeps taking her in and out of that harbour after she paid (wall ms). */
export const SMUGGLE_PASS_MS = 30 * 60_000;
/** Of a sea-hour of her waters (6 × 320 × 1.3^(⚓−1), the patent's measure): for a quest's step, for plain trade. */
export const SMUGGLE_QUEST_SHARE = 0.25;
export const SMUGGLE_TRADE_SHARE = 0.75;

/** The refusals the smugglers get round: the patent's enemy, a flag that holds her an enemy. */
export type SmuggleWhy = 'patent' | 'standing';

/** A sea-hour of her ship's waters at her level (the patent's measure: 6 × 320 × 1.3^(⚓−1) silver). */
export function waterHour(level: number): number {
  const anchor = Math.max(1, Math.min(10, Math.ceil(Math.max(1, level) / 6)));
  return 6 * 320 * 1.3 ** (anchor - 1);
}

/** Her passage's price at her level: for a quest's step there, or for trade. */
export function smugglePrice(level: number, quest: boolean): number {
  return Math.max(100, Math.round((waterHour(level) * (quest ? SMUGGLE_QUEST_SHARE : SMUGGLE_TRADE_SHARE)) / 50) * 50);
}

/** The offer as the harbour's refusal carries it to her screen. */
export interface SmuggleOffer {
  port: string;
  price: number;
  /** A step of one of her quests is in this harbour (the cheaper price). */
  quest: boolean;
  why: SmuggleWhy;
  /** Her patent's days left (why 'patent'), else 0. */
  days: number;
  /** The minutes the boat keeps taking her in and out. */
  mins: number;
}

/** Said (their Russian: smugglePatterns below, in the client's table). */
export const SMUGGLE_SAY = {
  patentWays: 'Your patent is at war with this harbour: its quay is shut to you. Ways in: wait out the patent ({0} days), strike its colours (the patent burns), or pay a smuggler to land you by night.',
  standingWays: '{0} considers you an enemy: its quay is shut to you. Ways in: mend your standing with its flag, or pay a smuggler to land you by night.',
  landed: 'The smuggler’s boat puts you in by night ({0} silver): no customs, no harbour master. For {1} minutes it takes you in and out of this harbour.',
  again: 'The smuggler’s boat takes you in again.',
  none: 'No smuggler will help here: the harbour lets you in, or turns you away for your skulls.',
  far: 'Come up to the harbour first: the smuggler’s boat waits off its quay.',
} as const;

/** English → Russian of every sentence above. */
export function smugglePatterns(): [string, string][] {
  return [
    ['Your patent is at war with this harbour: its quay is shut to you. Ways in: wait out the patent ({0} days), strike its colours (the patent burns), or pay a smuggler to land you by night.',
      'Ваш патент воюет с этой гаванью: её причал для вас закрыт. Как попасть: дождаться конца патента (дней: {0}), спустить его флаг (патент сгорит) или заплатить контрабандисту, чтобы он тайно высадил вас ночью.'],
    ['{0} considers you an enemy: its quay is shut to you. Ways in: mend your standing with its flag, or pay a smuggler to land you by night.',
      'Вы — враг фракции «{0}»: её причал для вас закрыт. Как попасть: поправить отношения с этим флагом или заплатить контрабандисту, чтобы он тайно высадил вас ночью.'],
    ['The smuggler’s boat puts you in by night ({0} silver): no customs, no harbour master. For {1} minutes it takes you in and out of this harbour.',
      'Лодка контрабандиста тайно высадила вас ночью ({0} серебра): ни таможни, ни начальника порта. Ещё {1} мин. она возит вас в эту гавань и обратно.'],
    [SMUGGLE_SAY.again, 'Лодка контрабандиста снова тайно доставила вас в гавань.'],
    [SMUGGLE_SAY.none, 'Контрабандист здесь не нужен: гавань вас пускает или не пускает из-за черепов.'],
    [SMUGGLE_SAY.far, 'Сначала подойдите к гавани: лодка контрабандиста ждёт у её причала.'],
  ];
}
