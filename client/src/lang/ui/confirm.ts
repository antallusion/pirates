// Words of the confirmation frame (client/src/ui/confirm.ts).

export const EN = {
  'yes': 'Go ahead',
  'no': 'Cancel',
  'ok': 'Understood',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'yes': 'Подтвердить',
  'no': 'Отмена',
  'ok': 'Понятно',
};
