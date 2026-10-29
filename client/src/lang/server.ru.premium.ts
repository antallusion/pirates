// The server's lines of the premium shop (owner, 2026-10-03: doubloons, the hulls and creatures they buy, the tester's
// console), English → Russian. A sum of doubloons is written «дубл.»: the server cannot decline it by the number.

import { webPatterns } from '../../../shared/src/data/webshop.ts';

export const SERVER_RU_PREMIUM: Record<string, string> = {
  // A purchase from the website's shop delivered aboard (owner, 2026-10-20; server/src/game/webshop.ts).
  ...Object.fromEntries(webPatterns()),
  'Doubloons credited to your account: {0}.': 'Зачислено дублонов на ваш счёт: {0}.',
  // The premium captains are bought (owner, 2026-10-19; server/src/game/captainshop.ts).
  'That captain is sold for doubloons': 'Этого капитана нужно сначала купить за дублоны',
  'That captain is free to choose': 'Этого капитана можно выбрать бесплатно',
  'That captain is yours already': 'Этот капитан уже ваш',
  'Not enough doubloons: top up your account first.': 'Не хватает дублонов: сначала пополните счёт.',
  'A hull is delivered in port: make port first.': 'Корабль передают только в порту: сначала зайдите в гавань.',
  'The yard has her on the ways.': 'Корабль сейчас на стапеле верфи.',
  'Captain level {0} is needed to command a {1}': 'Чтобы командовать кораблём «{1}», нужен уровень капитана {0}',
  'No hammocks aboard for {0} more.': 'На борту не хватает коек: нужно ещё {0}.',
  'Not in the middle of a fight.': 'Не посреди боя.',
  'The deep’s own serve only a captain who keeps the deep: the Choir’s favour, a cursed hull or a drowned crew.': 'Глубинные служат лишь капитану, которого приняла бездна: милость Хора, проклятый корпус или команда утопленников.',
  'No room aboard her for the creatures that come with her.': 'На этом корабле нет места для существ, что идут вместе с ним.',
  'The {0} is yours for {1} doubloons. Your old ship is berthed here.': '«{0}» теперь ваш — за {1} дубл. Ваш старый корабль стоит здесь у причала.',
  '{0} {1} join your army for {2} doubloons.': 'В вашу армию встают {1} ({0}) за {2} дубл.',
  'The sample catalogue is in the shop: two hulls and two kinds of creature.': 'В лавке образцы для теста: два корабля и два вида существ.',
  'The sample catalogue is out of the shop.': 'Образцы для теста убраны из лавки.',
  'Doubloons: {0}. Usage: /doubloons N|-N|sample [on|off]': 'Дублоны: {0}. Как: /doubloons N|-N|sample [on|off]',
  'No more than {0} at once.': 'Не больше {0} за раз.',
  'Not that many: {0} on the account.': 'Столько нет: на счёте {0}.',
  'Doubloons: {0}.': 'Дублоны: {0}.',
  // «Свиток автобоя» (owner, 2026-10-11): the scrolls, the shop's packs and the tester's /scrolls.
  'No auto-battle scroll: buy them for doubloons in the shop.': 'Нет свитка автобоя: купите свитки за дублоны в лавке.',
  'Auto-battle scrolls: +{0} for {1} doubloons ({2} in all).': 'Свитки автобоя: +{0} за {1} дубл. (всего {2}).',
  'Auto-battle scrolls: {0}. Usage: /scrolls N|-N': 'Свитки автобоя: {0}. Как: /scrolls N|-N',
  'Auto-battle scrolls: {0}.': 'Свитки автобоя: {0}.',
  // The shop's goods (owner, 2026-10-15; server/src/game/shop.ts).
  'Bought for {0} doubloons.': 'Куплено за {0} дубл.',
  'Bought as often as it may be for now.': 'Пока больше купить нельзя: лимит исчерпан.',
  'This is for your own island: claim one first.': 'Это для собственного острова: сначала займите остров.',
  'No room for it: make room first.': 'Для этого нет места: сначала освободите.',
  'No room in the hold for it.': 'В трюме для этого нет места.',
  'Your ship’s level is too low for this tier.': 'Уровень корабля мал для этого уровня бойцов.',
  'You have as much of it as may be held.': 'У вас уже столько, сколько можно держать.',
  'There is nothing for it to do now.': 'Сейчас для этого нет дела.',
  'This offer is gone.': 'Это предложение уже ушло.',
  'Buy the first brigade of your own before the second.': 'Сначала купите первую свою бригаду, потом вторую.',
  'Slowly: one purchase at a time.': 'Не так быстро: по одной покупке.',
  'No speed-ups in store: buy them in the shop.': 'В запасе нет ускорений: купите их в лавке.',
  'No speed-ups left: buy them in the shop.': 'Ускорителей не осталось: купите их в лавке.',
  'No repair kits in store: buy them in the shop.': 'В запасе нет ремкомплектов: купите их в лавке.',
  'A repair kit: she is whole again ({0} left).': 'Ремкомплект: корабль снова цел (осталось {0}).',
  'A lucky charm: +1 luck and +{0} morale for this boarding ({1} left).': 'Талисман удачи: +1 к удаче и +{0} к боевому духу в этом абордаже (осталось {1}).',
  'A gift for level {0} is in the shop for three days.': 'Подарок к уровню {0} — в лавке на три дня.',
  'The captain’s subscription: {0} doubloons and an auto-battle scroll for today.': 'Капитанская подписка: {0} дубл. и свиток автобоя за сегодня.',
  'Your first top-up comes double: {0} doubloons wait for you in the shop.': 'Первое пополнение — вдвойне: {0} дубл. ждут вас в лавке.',
  'Its captain holds a charter of protection: no landing on that island.': 'У капитана этого острова охранная грамота: высадиться нельзя.',
  'The shop': 'Лавка',
};
