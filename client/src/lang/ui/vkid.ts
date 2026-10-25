// «Войти через VK ID» on the website (owner, 2026-10-25; docs/36_VK.md §8): the start screen's button, the offer to
// link the captain kept in this browser, settings' «Привязать VK», the notices' hint. The Russian keeps to Cyrillic but
// for VK's own names «VK ID» and «VK» (the owner's words; tests/vkid.test.ts).

export const EN = {
  'login': 'Sign in with VK ID',
  'loginShort': 'VK ID',
  'offer': 'Link VK ID to captain {name}',
  'link': 'Link VK',
  'linked': 'VK linked',
  'linkedToast': 'VK linked to this captain.',
  'signedIn': 'Signed in with VK ID.',
  'failed': 'VK ID does not answer. Try again in a minute.',
  'noteTitle': 'Notices in VK',
  'note': 'To get notices in VK, open the game in VK and allow notifications.',
  'noteOpen': 'Open the game in VK',
  'noteLater': 'Later',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'login': 'Войти через VK ID',
  'loginShort': 'VK ID',
  'offer': 'Привязать VK ID к капитану {name}',
  'link': 'Привязать VK',
  'linked': 'VK привязан',
  'linkedToast': 'VK привязан к этому капитану.',
  'signedIn': 'Вход через VK ID выполнен.',
  'failed': 'VK ID не отвечает. Попробуйте через минуту.',
  'noteTitle': 'Оповещения в VK',
  'note': 'Чтобы получать оповещения в VK, откройте игру в VK и разрешите уведомления.',
  'noteOpen': 'Открыть игру в VK',
  'noteLater': 'Позже',
};
