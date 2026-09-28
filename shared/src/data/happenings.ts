// The sea's shorter events (docs/12 P2), hours rather than days: the Crown's silver galleon under way, the Brethren of
// the Coast gathering round a baron, a star falling on an island, an eclipse, a fleet lost to the Great Storm, a port's
// festival. The server writes their lines in English; here are the Russian twins.

export type HappeningKind = 'silver_convoy' | 'brethren' | 'star' | 'eclipse' | 'lost_fleet' | 'festival';
export const HAPPENING_KINDS: HappeningKind[] = ['silver_convoy', 'brethren', 'star', 'eclipse', 'lost_fleet', 'festival'];

export function happeningPatterns(): [string, string][] {
  return [
    ['The silver galleon sails from {0} to {1}', 'Серебряный галеон идёт из {0} в {1}'],
    ['The Crown’s silver galleon {0} weighs anchor at {1} for {2}, with two frigates at her side. A fortune under sail.', 'Серебряный галеон Короны «{0}» снимается с якоря в {1} и идёт в {2}, по бортам два фрегата. Целое состояние под парусами.'],
    ['{0} took the silver galleon {1}! The Crown will want that silver back.', '{0} берёт серебряный галеон «{1}»! Корона захочет вернуть это серебро.'],
    ['The silver galleon {0} reached {1} safely.', 'Серебряный галеон «{0}» благополучно дошёл до {1}.'],
    ['The silver galleon {0} is gone, and nobody will say where.', 'Серебряный галеон «{0}» исчез, и никто не скажет куда.'],
    ['The Brethren gather off {0}', 'Береговое братство собирается у острова {0}'],
    ['The Brethren of the Coast gather off {0} in {1}: Baron {2} holds court among his captains. Scatter them, or keep clear.', 'Береговое братство собирается у острова {0} в водах «{1}»: барон {2} держит совет со своими капитанами. Разгоните их — или держитесь подальше.'],
    ['Baron {0} is sunk off {1}, and the Brethren scatter!', 'Барон {0} потоплен у острова {1}, и Братство разбегается!'],
    ['The Brethren weigh anchor off {0}.', 'Братство снимается с якоря у острова {0}.'],
    ['A falling star on {0}', 'Падающая звезда на острове {0}'],
    ['A star falls from the sky onto {0} in {1}! The first to anchor off it claims the star-iron.', 'С неба падает звезда — на остров {0} в водах «{1}»! Первый, кто встанет там на якорь, заберёт звёздное железо.'],
    ['{0} claims the fallen star on {1}!', '{0} забирает упавшую звезду с острова {1}!'],
    ['The fallen star on {0} cools, and the sea forgets it.', 'Упавшая звезда на острове {0} остывает, и море о ней забывает.'],
    ['The eclipse', 'Затмение'],
    ['The sun goes dark. For a while the drowned are bold, and strange things walk the water.', 'Солнце меркнет. На время утопленники смелеют, и по воде ходят странные вещи.'],
    ['The sun comes back.', 'Солнце возвращается.'],
    ['The lost fleet of {0}', 'Потерянный флот в водах «{0}»'],
    ['The Great Storm has scattered a whole fleet over {0}: empty hulls drift everywhere, and their holds are full.', 'Великий шторм разметал по водам «{0}» целый флот: повсюду дрейфуют пустые корпуса, а трюмы у них полны.'],
    ['The last of the lost fleet sinks in {0}.', 'Последний корабль потерянного флота тонет в водах «{0}».'],
    ['Festival in {0}', 'Праздник в {0}'],
    ['{0} holds its festival: prices are kind, the taverns are loud, and there will be fireworks after dark.', 'В {0} праздник: цены добрые, в тавернах шумно, а после заката будет фейерверк.'],
    ['The festival in {0} is over.', 'Праздник в {0} закончился.'],
    ['The star-iron is yours: {0} of it in the hold.', 'Звёздное железо ваше: в трюме {0}.'],
    ['The festival warms your crew.', 'Праздник согревает вашу команду.'],
  ];
}
