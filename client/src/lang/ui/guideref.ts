// «Лоцманская книга» → «Справочник» (client/src/ui/guideref.ts): the frame's words; the entries' names, kinds and
// facets come in both tongues from shared/src/data/guide/reference.ts.
export const EN = {
  title: 'Reference',
  search: 'Search by name…',
  searchL: 'Search the reference',
  kinds: 'What to show',
  filters: 'Filters',
  reset: 'Reset',
  resetL: 'Reset the filters',
  count: '{n} of {m}',
  none: 'Nothing found. Try another word or reset the filters.',
  open: 'Open the card',
};
export const RU: Record<keyof typeof EN, string> = {
  title: 'Справочник',
  search: 'Поиск по названию…',
  searchL: 'Поиск по справочнику',
  kinds: 'Что показать',
  filters: 'Фильтры',
  reset: 'Сброс',
  resetL: 'Сбросить фильтры',
  count: '{n} из {m}',
  none: 'Ничего не нашлось. Попробуйте другое слово или сбросьте фильтры.',
  open: 'Открыть карточку',
};
