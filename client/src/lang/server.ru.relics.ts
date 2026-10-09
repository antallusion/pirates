// The server's lines of docs/19 E12 (relics: server/src/game/relics.ts), E13 (the workshop's anvil:
// server/src/game/landecon.ts) and E16 (the Choir's invasions: server/src/game/invasions.ts), English → Russian.
// A relic is «реликвия «…»» in the sentence; an artifact's name stands in «…».

export const SERVER_RU_RELICS: Record<string, string> = {
  // E12: the relics.
  'A part of the {0}: {1} ({2}/{3}).': 'Часть реликвии «{0}»: {1} ({2}/{3}).',
  'The {0} is whole: its parts are one relic.': 'Реликвия «{0}» собрана: её части стали одним целым.',
  'The {0} comes apart into its parts.': 'Реликвия «{0}» распалась на части.',
  '{0} assembles the {1}.': '{0} собирает реликвию «{1}».',
  // /relic (the tester's console).
  'Relic parts: {0} worn, {1} in the locker, {2} dropped; relics assembled: {3}.': 'Части реликвий: надето {0}, в рундуке {1}, выпало {2}; собрано реликвий: {3}.',
  'Parts dropped: {0} of {1}.': 'Выпало частей: {0} из {1}.',
  'Every relic part is gone.': 'Все части реликвий убраны.',
  'The {0}: its parts are in the locker.': 'Реликвия «{0}»: части в рундуке.',
  'The {0} is worn.': 'Реликвия «{0}» надета.',
  // E13: the workshop's anvil.
  'Only an artifact goes to the anvil.': 'На наковальню идёт только артефакт.',
  'It has no primaries to spread.': 'У него нет первичных навыков, чтобы их перековать.',
  'Build a market in your town first: its workshop keeps the anvil.': 'Сначала постройте рынок в городе: наковальня — в его мастерской.',
  'Lie off your island: its workshop forges it.': 'Встаньте у своего острова: ковать будет его мастерская.',
  'Choose first: the new roll or the old one.': 'Сначала выберите: новая работа или прежняя.',
  'The anvil rings over the {0}: keep the new work or the old.': 'Наковальня звенит над артефактом «{0}»: оставьте новую работу или прежнюю.',
  'Nothing waits at the anvil.': 'На наковальне ничего не ждёт.',
  'The {0} keeps its old work.': '«{0}»: оставлена прежняя работа.',
  'The {0} takes its new work.': '«{0}»: принята новая работа.',
};
