// Words of the film frame (client/src/ui/cutscene.ts).

export const EN = {
  'skip': 'Click or press any key to skip',
  'skipTouch': 'Tap to skip',
  'label': 'Film',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'skip': 'Нажмите любую клавишу, чтобы пропустить',
  'skipTouch': 'Коснитесь, чтобы пропустить',
  'label': 'Фильм',
};
