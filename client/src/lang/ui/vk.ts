// VK's words on the game's screens (owner, 2026-10-20; docs/36_VK.md): the Mini App's sign-in, «Позвать друзей», the
// shop's votes. The Russian keeps to Cyrillic (the tests hold every Russian screen line to it): «ВКонтакте», «голоса».

export const EN = {
  'boot': 'Signing in with VK…',
  'bootFailed': 'VK sign-in failed. Close the game and open it in VK again.',
  'bootSlow': 'VK is slow to answer. One more moment, or try again.',
  'bootRetry': 'Try again',
  'invite': 'Invite friends',
  'inviteHint': 'Share the game with your VK friends.',
  'shareFailed': 'Sharing could not be opened. Try again.',
  'shared': 'Invitation sent.',
  'buyVotes': 'Buy for',
  'paid': 'Payment received: the doubloons are on their way.',
  'payCancelled': 'Payment cancelled.',
  'payFailed': 'The payment did not go through.',
  'payNote': 'Paid with VK votes. The doubloons arrive as soon as VK confirms the payment.',
  'notify': 'Notifications',
  'notifyOn': 'Notifications on',
  'notifyOff': 'Notifications stay off.',
  'notifyHint': 'VK tells you when the island has finished building, the daily gift is ready or the island is raided.',
};

export const RU: Record<keyof typeof EN, string> = {
  'boot': 'Вход через ВКонтакте…',
  'bootFailed': 'Не удалось войти через ВКонтакте. Закройте игру и откройте её снова.',
  'bootSlow': 'ВКонтакте отвечает медленно. Ещё немного — или попробуйте снова.',
  'bootRetry': 'Попробовать снова',
  'invite': 'Позвать друзей',
  'inviteHint': 'Поделиться игрой с друзьями во ВКонтакте.',
  'shareFailed': 'Не удалось открыть окно «Поделиться». Попробуйте ещё раз.',
  'shared': 'Приглашение отправлено.',
  'buyVotes': 'Купить за',
  'paid': 'Оплата получена: дублоны уже в пути.',
  'payCancelled': 'Оплата отменена.',
  'payFailed': 'Оплата не прошла.',
  'payNote': 'Оплата голосами ВКонтакте. Дублоны придут, как только ВКонтакте подтвердит оплату.',
  'notify': 'Уведомления',
  'notifyOn': 'Уведомления включены',
  'notifyOff': 'Уведомления остаются выключены.',
  'notifyHint': 'ВКонтакте сообщит, когда на острове закончена стройка, готов ежедневный подарок или остров ограбили.',
};
