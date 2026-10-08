// The server's lines of the beasts' sea fight, the order that waits for the shot to stop and the carpenters at sea
// (owner, 2026-10-07: «акулы всякие они не должны убивать моих людей», «ошибок типа "не под огнём" быть не должно»,
// «нажимая на ремонт ничего не происходит»), English → Russian.

export const SERVER_RU_BEASTFIGHT: Record<string, string> = {
  // The beasts bite the hull and the rudder, never the men.
  'A shark worries at your rudder!': 'Акула треплет руль!',
  // An order refused only for the shot flying waits for it to stop (an «info», not a refusal).
  'Done as soon as the firing stops.': 'Исполним, как только стихнет пальба.',
  'Heaving to: done as soon as she lies still.': 'Ложимся в дрейф: исполним, как только корабль встанет.',
  // The carpenters at sea: plain words of what they lack; the yard in port; the quartermaster's stores.
  'No planks aboard: the carpenters mend the hull with planks, one plank for 40 points of it. Buy planks in port, or have the yard mend her.': 'В трюме нет досок: плотники чинят корпус досками, одна доска — 40 единиц корпуса. Купите доски в порту или почините корабль на верфи.',
  'No sailcloth aboard: the carpenters mend the sails with sailcloth, one bolt for 20 points of them. Buy sailcloth in port, or have the yard mend her.': 'В трюме нет парусины: паруса чинят парусиной, один рулон — 20 единиц парусов. Купите парусину в порту или почините корабль на верфи.',
  'No planks or sailcloth aboard: the carpenters mend her with them. Buy them in port, or have the yard mend her.': 'В трюме нет ни досок, ни парусины, а плотники чинят корабль ими. Купите их в порту или почините корабль на верфи.',
  'She is already sound.': 'Корабль цел — чинить нечего.',
  'The quartermaster takes on {0} planks and {1} sailcloth for the carpenters ({2} silver).': 'Квартирмейстер берёт для плотников досок: {0}, парусины: {1} ({2} серебра).',
};
