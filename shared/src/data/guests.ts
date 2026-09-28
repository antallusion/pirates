// Guests on a captain's island (docs/12 P10 #13): their lines in both tongues.

export function guestPatterns(): [string, string][] {
  return [
    ['You are not invited to that island.', 'Вас не приглашали на этот остров.'],
    ['Sail to {0} first.', 'Сначала подойдите к острову {0}.'],
    ['{0} calls on your island.', 'Капитан {0} заходит к вам на остров.'],
    ['There is no tavern on that island.', 'На этом острове нет таверны.'],
    ["A round in {0}'s tavern: your crew is merrier.", 'Выпивка в таверне капитана {0} — команда повеселела.'],
    ['You have signed already.', 'Вы уже расписались.'],
    ['{0} signs your guestbook.', 'Капитан {0} оставляет запись в вашей книге гостей.'],
    ['{0} invites you to their island, {1}.', 'Капитан {0} приглашает вас на свой остров — {1}.'],
  ];
}
