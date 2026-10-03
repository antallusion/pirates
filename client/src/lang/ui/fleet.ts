// Words of the fleet of eighty (owner, 2026-10-03; docs/02 §1.A.9) on screen: the four lists the premium shop's hulls
// are shelved by, and a premium hull's gift on her card and her ship's screen (client/src/ui/premium.ts, dialogs.ts).

export const EN = {
  'list.combat': 'Warships',
  'list.trade': 'Traders',
  'list.fast': 'Runners',
  'list.hauler': 'Haulers',
  'gift': 'Her gift',
  'kind.rally': 'At bay',
  'kind.strike': 'Her shot',
  'kind.toll': 'In a fight',
  'kind.deck': 'Boarding',
  'kind.sail': 'Under sail',
  'kind.trade': 'In port',
  'kind.muster': 'Her company',
  'own': 'Her own creatures come back to her in port, up to the number she came with.',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'list.combat': 'Боевые',
  'list.trade': 'Торговые',
  'list.fast': 'Быстрые',
  'list.hauler': 'Грузовые',
  'gift': 'Её дар',
  'kind.rally': 'В беде',
  'kind.strike': 'Её ядра',
  'kind.toll': 'В бою',
  'kind.deck': 'Абордаж',
  'kind.sail': 'Под парусами',
  'kind.trade': 'В порту',
  'kind.muster': 'Её люди',
  'own': 'Её существа возвращаются к ней в порту — до того числа, с которым она пришла.',
};
