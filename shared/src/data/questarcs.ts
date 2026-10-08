// Story arcs (docs/11 P4): five written arcs to a region, three chapters each, laid over the generated jobs. The
// story is written by hand — who asks, what is at stake, how it ends; the places come from the world (the
// region's ports, its islands and their people), so every arc sits in its own waters. A chapter opens when the
// one before it is done. Each text keeps its Russian twin beside it.

import { Rng, hashString } from '../rng.ts';
import { REGIONS, REGION_IDS } from '../world/regions.ts';
import type { RegionId } from '../world/regions.ts';
import type { Island, Port, World } from '../world/worldgen.ts';
import { legacyWorld } from '../world/worldgen.ts';
import { islandLife } from '../world/islandlife.ts';
import type { GoodId } from './goods.ts';
import { GOODS } from './goods.ts';
import type { QuestDef, QuestStep } from './quests.ts';
import { SITE_NAMES, STEP_TEXT, fill, giverPortrait, numberedPattern } from './questgen.ts';
import { legacyQuestSize, questXp } from './xpcurve.ts';
import type { Profession, StepKind } from './questgen.ts';

type T = [string, string];
interface Chapter {
  name: T;
  summary: T;
  steps: StepKind[];
  good?: GoodId;
  site?: 'people' | 'pirate_camp' | 'smugglers' | 'ruins' | 'beasts';
}
export interface Arc {
  id: string;
  region: RegionId;
  giver: string;
  profession: Profession;
  chapters: [Chapter, Chapter, Chapter];
}

const C = (name: T, summary: T, steps: StepKind[], extra: Partial<Chapter> = {}): Chapter => ({ name, summary, steps, ...extra });
const A = (region: RegionId, id: string, giver: string, profession: Profession, chapters: [Chapter, Chapter, Chapter]): Arc => ({ id, region, giver, profession, chapters });

export const ARCS: Arc[] = [
  // ---------------------------------------------------------------- the Black Coast: Crown waters, lighthouses, fog
  A('black_coast', 'dark_lantern', 'Vesper Crane', 'lighthouse_keeper', [
    C(['The Dark Lantern', 'Тёмный фонарь'], ['{giver} keeps the light at {port}. Twice this month a ship struck the rocks on a clear night, as if another light had called her in. Look at {island}.', '{giver} хранит огонь маяка в порту {port}. Дважды за месяц корабль разбивался о скалы в ясную ночь, будто его звал другой огонь. Осмотрите остров {island}.'], ['land_any', 'home']),
    C(['Wreckers\' Lamps', 'Фонари мародёров'], ['Lamps and tallow on {island}. Wreckers. {giver} wants to know who buys what they strip — ask in {port2}.', 'На острове {island} — лампы и сало. Мародёры. {giver} хочет знать, кто скупает снятое с кораблей, — спросите в порту {port2}.'], ['visit2', 'home']),
    C(['The Light Goes Out', 'Огонь гаснет'], ['The wreckers\' friends in {port2} have a ship of their own in {region}. Sink them, and {giver}\'s light will be the only one on this coast again.', 'У друзей мародёров из порта {port2} есть свой корабль в водах «{region}». Потопите их — и огонь, что хранит {giver}, снова будет единственным на этом берегу.'], ['sink_pirates', 'home']),
  ]),
  A('black_coast', 'press_gang', 'Hester Marlow', 'widow', [
    C(['The Press-Gang', 'Вербовщики'], ['A press-gang took {giver}\'s son from the quay. His ship sailed for {port2}. Find him.', 'Вербовщики забрали сына вдовы ({giver}) прямо с причала. Его корабль ушёл в порт {port2}. Найдите его.'], ['visit2', 'home']),
    C(['A Sailor\'s Wage', 'Жалованье матроса'], ['He is alive, but bound to serve until his debt is paid. {giver} has nothing; the purser will take {good} for it.', 'Он жив, но служит, пока не отработает долг. У вдовы ({giver}) ничего нет; казначей примет товар «{good}».'], ['deliver2', 'home'], { good: 'rum' }),
    C(['Home From the Sea', 'Домой с моря'], ['The purser took the rum and freed the boy — but the ship that carries him home is hunted in {region}. See him safe.', 'Казначей взял ром и отпустил парня, но корабль, что везёт его домой, преследуют в водах «{region}». Проводите его.'], ['time_in', 'home']),
  ]),
  A('black_coast', 'admiralty_ledger', 'Osric Pryce', 'envoy', [
    C(['The Admiralty\'s Ledger', 'Книга Адмиралтейства'], ['{giver} audits the Admiralty. Powder bought for {port2} never reached it. Go and count the barrels.', '{giver} проверяет Адмиралтейство. Порох, купленный для порта {port2}, туда не дошёл. Пересчитайте бочки.'], ['visit2', 'home']),
    C(['Where the Powder Went', 'Куда ушёл порох'], ['The barrels were sold at the {site} on {island}. Land and see who holds them.', 'Бочки продали у места «{site}» на острове {island}. Высадитесь и посмотрите, у кого они.'], ['land_site', 'home'], { site: 'smugglers' }),
    C(['The Clerk\'s Confession', 'Признание писаря'], ['A clerk in {port3} signed the orders. {giver} needs the powder returned to {port2} before the hearing.', 'Приказы подписал писарь из порта {port3}. {giver} нужно вернуть порох в порт {port2} до слушания.'], ['visit3', 'deliver2', 'home'], { good: 'gunpowder' }),
  ]),
  A('black_coast', 'fog_saltmarrow', 'Silas Holloway', 'smuggler', [
    C(['Fog Over the Harbour', 'Туман над гаванью'], ['{giver} runs cargo in the fog. A customs cutter watches every night now. Show him you can pass an inspection clean.', '{giver} возит грузы в тумане. Теперь каждую ночь дежурит таможенный катер. Покажите, что пройдёте досмотр чистым.'], ['customs', 'home']),
    C(['The Informer', 'Осведомитель'], ['Someone in {port2} sells {giver}\'s runs to the Crown. Find the informer.', 'Кто-то в порту {port2} продаёт рейсы контрабандиста ({giver}) Короне. Найдите осведомителя.'], ['visit2', 'home']),
    C(['One Last Run', 'Последний рейс'], ['With the informer gone, {giver} has one last run before he quits the trade: contraband to {port3}.', 'Осведомителя больше нет, и у контрабандиста ({giver}) остался последний рейс перед уходом на покой: контрабанда в порт {port3}.'], ['pickup', 'deliver3', 'home'], { good: 'tobacco' }),
  ]),
  A('black_coast', 'last_frigate', 'Magnus Stroud', 'old_salt', [
    C(['The Last Crown Frigate', 'Последний фрегат Короны'], ['{giver} served on the frigate that went down off this coast forty years ago. Send divers to the wrecks and find her.', '{giver} служил на фрегате, что затонул у этого берега сорок лет назад. Спустите водолазов к затонувшим судам и найдите его.'], ['dive', 'home']),
    C(['Her Ensign', 'Её флаг'], ['The ensign was not aboard. {giver} remembers the captain rowed it ashore on {island}.', 'Флага на борту не было. {giver} помнит, что капитан отвёз его на берег острова {island}.'], ['land_any', 'home']),
    C(['Colours Home', 'Флаг домой'], ['The ensign belongs in the Admiralty chapel at {port2}. {giver} asks you to carry it there, and then to drink with him.', 'Флаг должен висеть в часовне Адмиралтейства в порту {port2}. {giver} просит отвезти его туда — а потом выпить с ним.'], ['visit2', 'home']),
  ]),
  // ---------------------------------------------------------------- Gravewater: the trade artery, convoys and wolves
  A('gravewater', 'convoy_contract', 'Esme Varga', 'merchant', [
    C(['The Convoy Contract', 'Договор конвоя'], ['{giver} wins the convoy contract if one run to {port2} arrives whole. Carry the sample cargo.', '{giver} получит договор на конвои, если один рейс в порт {port2} дойдёт целым. Отвезите пробный груз.'], ['pickup', 'deliver2', 'home'], { good: 'sugar' }),
    C(['Wolves on the Lane', 'Волки на пути'], ['Her rival hired pirates to ruin the second run. Clear them from {region}.', 'Соперник нанял пиратов, чтобы сорвать второй рейс. Очистите от них воды «{region}».'], ['sink_pirates', 'home']),
    C(['The Rival\'s Ledger', 'Книга соперника'], ['Proof of the hiring lies in {port3}. Bring it, and the House of {giver} rules the lane.', 'Доказательства найма лежат в порту {port3}. Привезите их — и торговый дом ({giver}) станет хозяином пути.'], ['visit3', 'home']),
  ]),
  A('gravewater', 'wolf_gravewater', 'Rurik Grimsby', 'garrison_captain', [
    C(['The Wolf of Gravewater', 'Волк Грейвуотера'], ['A pirate captain the sailors call the Wolf takes a convoy a week. {giver} wants his escorts sunk first.', 'Пиратский капитан, которого моряки зовут Волком, берёт по конвою в неделю. {giver} хочет сперва потопить его охрану.'], ['sink_pirates', 'home']),
    C(['The Wolf\'s Den', 'Логово Волка'], ['The Wolf careens at the {site} on {island}. Land and burn his stores.', 'Волк чинит корабли у места «{site}» на острове {island}. Высадитесь и сожгите его припасы.'], ['land_site', 'home'], { site: 'pirate_camp' }),
    C(['The Wolf at Bay', 'Волк загнан'], ['Without his stores he must fight. Take his ships by boarding and bring the tale to {giver}.', 'Без припасов ему придётся драться. Возьмите его корабли на абордаж и расскажите обо всём капитану ({giver}).'], ['board', 'home']),
  ]),
  A('gravewater', 'sugar_blood', 'Dagny Holt', 'widow', [
    C(['Sugar and Blood', 'Сахар и кровь'], ['{giver}\'s plantation on the coast burns every night. She needs {good} for the field hands from {port2}.', 'Плантация вдовы ({giver}) горит каждую ночь. Ей нужен товар «{good}» для работников из порта {port2}.'], ['deliver2', 'home'], { good: 'provisions' }),
    C(['Who Lights the Fires', 'Кто поджигает'], ['The fires come from the sea. {giver} saw a boat make for {island}.', 'Огонь приходит с моря. {giver} видела, как лодка шла к острову {island}.'], ['land_any', 'home']),
    C(['The Neighbour', 'Сосед'], ['The neighbour in {port3} wanted her land. {giver} wants him to know she will keep it — carry her answer.', 'Сосед из порта {port3} хотел её землю. {giver} хочет, чтобы он знал: она её не отдаст. Отвезите ответ.'], ['visit3', 'home']),
  ]),
  A('gravewater', 'insurance_fraud', 'Fenwick Doyle', 'merchant', [
    C(['Empty Holds', 'Пустые трюмы'], ['{giver} insures ships. Three went down in {region} this year — all heavy with cargo, the papers say. Dive the wrecks.', '{giver} страхует корабли. Три затонули в этом году в водах «{region}» — все с полными трюмами, если верить бумагам. Спуститесь к затонувшим судам.'], ['dive', 'home']),
    C(['The Scuttlers', 'Топители'], ['The holds were empty. The owners sank their own ships. Their man in {port2} will talk for a price.', 'Трюмы были пусты. Владельцы сами топили свои корабли. Их человек в порту {port2} заговорит за плату.'], ['visit2', 'home']),
    C(['Paid in Full', 'Расчёт сполна'], ['The owners fled with the money to {port3}. {giver} will settle it there.', 'Владельцы бежали с деньгами в порт {port3}. {giver} сведёт с ними счёты там.'], ['visit3', 'home']),
  ]),
  A('gravewater', 'merchant_heir', 'Leda Farrow', 'merchant', [
    C(['The Merchant Prince\'s Heir', 'Наследница торгового князя'], ['{giver} inherits a trading house nobody respects. Deliver {good} to {port2} on time and they will.', '{giver} унаследовала торговый дом, который никто не уважает. Доставьте товар «{good}» в порт {port2} вовремя — и зауважают.'], ['deliver2', 'home'], { good: 'cloth' }),
    C(['The Old Partners', 'Старые компаньоны'], ['Her father\'s partners in {port2} and {port3} must sign again. Visit both.', 'Компаньоны её отца в портах {port2} и {port3} должны подписать договор заново. Побывайте у обоих.'], ['visit2', 'visit3', 'home']),
    C(['A House Restored', 'Дом восстановлен'], ['One partner refused and hired pirates. Sink them in {region}, and the house stands.', 'Один компаньон отказался и нанял пиратов. Потопите их в водах «{region}» — и дом устоит.'], ['sink_pirates', 'home']),
  ]),
  // ---------------------------------------------------------------- the Whispering Archipelago: fog, islets, smugglers
  A('whispering', 'fog_ledger', 'Tamsin Quill', 'fence', [
    C(['The Fog Ledger', 'Туманная книга'], ['{giver} keeps a ledger of every cargo that passes the islets. Pages went missing at the {site} on {island}.', '{giver} ведёт книгу всех грузов, что проходят между островками. Страницы пропали у места «{site}» на острове {island}.'], ['land_site', 'home'], { site: 'smugglers' }),
    C(['The Pages', 'Страницы'], ['The pages were sold in {port2}. Buy them back, or take them.', 'Страницы продали в порту {port2}. Выкупите их — или заберите.'], ['visit2', 'home']),
    C(['Balance the Books', 'Свести баланс'], ['The ledger names a customs man who takes bribes. {giver} wants his cutters kept busy: sell contraband under his nose in {port2}.', 'В книге назван таможенник-взяточник. {giver} хочет, чтобы его катерам было чем заняться: продайте контрабанду у него под носом в порту {port2}.'], ['contraband', 'home']),
  ]),
  A('whispering', 'missing_broker', 'Yara Kell', 'smuggler', [
    C(['The Missing Broker', 'Пропавший посредник'], ['A Broker vanished between the islets with a chest of notes. {giver} saw her boat near {island}.', 'Посредница пропала среди островков с сундуком векселей. {giver} видела её лодку у острова {island}.'], ['land_any', 'home']),
    C(['Notes and Knives', 'Векселя и ножи'], ['She was taken to the {site} on {island}. The notes are still there.', 'Её увезли к месту «{site}» на острове {island}. Векселя всё ещё там.'], ['land_site', 'home'], { site: 'pirate_camp' }),
    C(['The Broker\'s Thanks', 'Благодарность посредницы'], ['The Broker is free and owes {giver}. Carry her notes to {port2}; the House pays well.', 'Посредница свободна и в долгу у контрабандистки ({giver}). Отвезите её векселя в порт {port2}: Дом платит щедро.'], ['visit2', 'home']),
  ]),
  A('whispering', 'dreamleaf_harvest', 'Juno Nettle', 'apothecary', [
    C(['The Dreamleaf Harvest', 'Урожай листа сновидений'], ['{giver} needs {good} before the harvest rots. The buyers wait in {port2}.', '{giver} нужно сбыть товар «{good}», пока урожай не сгнил. Покупатели ждут в порту {port2}.'], ['pickup', 'deliver2', 'home'], { good: 'dreamleaf' }),
    C(['Bad Dreams', 'Дурные сны'], ['Some of the leaf was poisoned. The sick in {port2} need medicine from {port3}.', 'Часть листа отравили. Больным в порту {port2} нужны лекарства из порта {port3}.'], ['visit3', 'deliver2', 'home'], { good: 'medicine' }),
    C(['The Poisoner', 'Отравитель'], ['The poisoner hides on {island}. {giver} wants him found before the next harvest.', 'Отравитель прячется на острове {island}. {giver} хочет найти его до следующего урожая.'], ['land_any', 'home']),
  ]),
  A('whispering', 'hollow_islet', 'Oswin Lowe', 'cartographer', [
    C(['The Hollow Islet', 'Полый островок'], ['{giver} charts the islets, and one is not where it was. Chart the waters around it.', '{giver} наносит островки на карту, а один оказался не там, где был. Нанесите на карту воды вокруг.'], ['chart', 'home']),
    C(['Moving Ground', 'Движущаяся земля'], ['The islet is {island}, and it floats. Land and see what holds it up.', 'Этот островок — {island}, и он плавает. Высадитесь и посмотрите, что его держит.'], ['land_any', 'home']),
    C(['Under the Roots', 'Под корнями'], ['Mangrove roots, and under them a hollow full of old cargo. {giver} wants divers down to the wrecks it came from.', 'Мангровые корни, а под ними — пустота со старым грузом. {giver} хочет спустить водолазов к судам, с которых он.'], ['dive', 'home']),
  ]),
  A('whispering', 'brokers_war', 'Kestrel Blackwood', 'fence', [
    C(['The Brokers\' War', 'Война посредников'], ['Two houses of Brokers fight for the islets. {giver} pays for ships taken from the other side.', 'Два дома посредников воюют за островки. {giver} платит за корабли, взятые у другой стороны.'], ['board', 'home']),
    C(['A Truce Offered', 'Предложение перемирия'], ['The other house asks for a truce. Carry {giver}\'s terms to {port2}.', 'Другой дом просит перемирия. Отвезите условия ({giver}) в порт {port2}.'], ['visit2', 'home']),
    C(['Signed in Fog', 'Подписано в тумане'], ['The truce is signed at the {site} on {island}, where neither house rules.', 'Перемирие подписывают у места «{site}» на острове {island}, где не правит ни один дом.'], ['land_site', 'home'], { site: 'people' }),
  ]),
  // ---------------------------------------------------------------- the Ashen Isles: volcanoes, powder, the Confederacy
  A('ashen_isles', 'powder_mill', 'Bram Tarrow', 'garrison_captain', [
    C(['The Powder Mill Fire', 'Пожар на пороховой мельнице'], ['The powder mill at {port} burned. {giver} needs {good} from {port2} to rebuild.', 'Пороховая мельница в порту {port} сгорела. {giver} нужен товар «{good}» из порта {port2}, чтобы её отстроить.'], ['deliver2', 'home'], { good: 'timber' }),
    C(['Sabotage', 'Диверсия'], ['It was no accident. The saboteur rowed out to {island}. Find him.', 'Это не случайность. Диверсант уплыл на остров {island}. Найдите его.'], ['land_any', 'home']),
    C(['The Crown\'s Hand', 'Рука Короны'], ['The saboteur was paid by Crown agents in {region}. Sink their ships.', 'Диверсанту платили агенты Короны в водах «{region}». Потопите их корабли.'], ['sink_hunters', 'home']),
  ]),
  A('ashen_isles', 'codes_trial', 'Ulric Wick', 'bosun', [
    C(['The Code\'s Trial', 'Суд по Кодексу'], ['A captain broke the Code and hides in {port2}. {giver} wants him brought to trial.', 'Капитан нарушил Кодекс и прячется в порту {port2}. {giver} хочет привести его на суд.'], ['visit2', 'home']),
    C(['Witnesses', 'Свидетели'], ['The trial needs witnesses from the {site} on {island}.', 'Суду нужны свидетели от места «{site}» на острове {island}.'], ['land_site', 'home'], { site: 'pirate_camp' }),
    C(['The Verdict', 'Приговор'], ['Guilty. His crew will not accept it. Board them before they flee.', 'Виновен. Его команда не смирится. Возьмите их на абордаж, пока не сбежали.'], ['board', 'home']),
  ]),
  A('ashen_isles', 'ember_bride', 'Isolde Umber', 'widow', [
    C(['The Ember Bride', 'Невеста углей'], ['{giver} was to be married in {port2}; her groom\'s ship never arrived. Ask there.', '{giver} должна была выйти замуж в порту {port2}; корабль жениха так и не пришёл. Спросите там.'], ['visit2', 'home']),
    C(['The Smoking Isle', 'Дымящийся остров'], ['His ship ran aground on {island} in the ash. Land and look for him.', 'Его корабль сел на мель у острова {island} в пепле. Высадитесь и найдите его.'], ['land_any', 'home']),
    C(['Ash and Oaths', 'Пепел и клятвы'], ['He lives, but lost everything. {giver} will marry him anyway — carry {good} for the wedding from {port2}.', 'Он жив, но потерял всё. {giver} всё равно выйдет за него — привезите товар «{good}» для свадьбы из порта {port2}.'], ['deliver2', 'home'], { good: 'rum' }),
  ]),
  A('ashen_isles', 'sulphur_lords', 'Ivo Maddox', 'merchant', [
    C(['The Sulphur Lords', 'Серные бароны'], ['Three families control the sulphur mines. {giver} wants to be the fourth: carry {good} to {port2}.', 'Три семьи держат серные рудники. {giver} хочет стать четвёртым: отвезите товар «{good}» в порт {port2}.'], ['deliver2', 'home'], { good: 'iron' }),
    C(['Claim Jumpers', 'Захватчики участков'], ['His claim on {island} was jumped. Land and see who dug there.', 'Его участок на острове {island} захватили. Высадитесь и посмотрите, кто там копал.'], ['land_any', 'home']),
    C(['A Seat at the Table', 'Место за столом'], ['The families will listen after a show of force. Sink ships in {region} that sail under their colours.', 'Семьи прислушаются после демонстрации силы. Потопите корабли в водах «{region}» под их флагами.'], ['sink_any', 'home']),
  ]),
  A('ashen_isles', 'brethren_election', 'Cato Frost', 'old_salt', [
    C(['The Brethren\'s Election', 'Выборы Братства'], ['The Brethren elect a new admiral. {giver} backs a captain who needs votes in {port2} and {port3}.', 'Братство выбирает нового адмирала. {giver} поддерживает капитана, которому нужны голоса в портах {port2} и {port3}.'], ['visit2', 'visit3', 'home']),
    C(['Buying Votes', 'Покупка голосов'], ['Votes cost rum. Carry {good} to {port2}.', 'Голоса стоят рома. Отвезите товар «{good}» в порт {port2}.'], ['deliver2', 'home'], { good: 'rum' }),
    C(['The Admiral\'s Proof', 'Доказательство адмирала'], ['The rival says their man cannot fight. Take prizes in his name.', 'Соперники говорят, что их человек не умеет драться. Приведите призы от его имени.'], ['prize', 'home']),
  ]),
  // ---------------------------------------------------------------- Leviathan Reach: ice, whalers, things larger
  A('leviathan_reach', 'white_bones', 'Wynn Coldharbour', 'whaler', [
    C(['The White Whale\'s Bones', 'Кости белого кита'], ['{giver} saw the bones of a whale larger than any ship on {island}. Land and measure them.', '{giver} видел на острове {island} кости кита больше любого корабля. Высадитесь и измерьте их.'], ['land_any', 'home']),
    C(['What Killed It', 'Что его убило'], ['The bones are scored by teeth. Keep the sea in {region} and see what hunts there.', 'На костях следы зубов. Проведите время в водах «{region}» и посмотрите, кто там охотится.'], ['time_in', 'home']),
    C(['Warn the Fleet', 'Предупредить флот'], ['The whaling fleet in {port2} must hear it before they sail.', 'Китобойный флот в порту {port2} должен узнать об этом до выхода в море.'], ['visit2', 'home']),
  ]),
  A('leviathan_reach', 'frozen_crew', 'Petra Reeve', 'harbour_master', [
    C(['The Frozen Crew', 'Замёрзшая команда'], ['A whaler came in with her whole crew frozen at their posts. {giver} wants to know where she had been — chart the ice.', 'Китобой пришёл с командой, замёрзшей на постах. {giver} хочет знать, где он был, — нанесите на карту льды.'], ['chart', 'home']),
    C(['The Last Log', 'Последняя запись'], ['Her log names {island}. Land there.', 'В её журнале упомянут остров {island}. Высадитесь там.'], ['land_any', 'home']),
    C(['Burial at Sea', 'Похороны в море'], ['The families in {port2} ask for their dead. Carry the word and the names.', 'Семьи в порту {port2} просят вернуть своих мёртвых. Отвезите весть и имена.'], ['visit2', 'home']),
  ]),
  A('leviathan_reach', 'harpoon_debt', 'Gideon Gault', 'merchant', [
    C(['The Harpoon Guild\'s Debt', 'Долг гильдии гарпунёров'], ['The Harpoon guild owes {giver} for a season\'s supply. Collect in {port2}.', 'Гильдия гарпунёров должна купцу ({giver}) за сезонные поставки. Взыщите долг в порту {port2}.'], ['visit2', 'home']),
    C(['Paid in Oil', 'Плата маслом'], ['They pay in whale oil. Carry it from {port2} home.', 'Они платят китовым жиром. Привезите его из порта {port2} домой.'], ['visit2', 'home']),
    C(['Bad Blood', 'Вражда'], ['A guild captain calls the deal robbery and hunts {giver}\'s ships. Sink the hunters.', 'Капитан гильдии называет сделку грабежом и охотится на корабли купца ({giver}). Потопите охотников.'], ['sink_hunters', 'home']),
  ]),
  A('leviathan_reach', 'singing_ice', 'Lark Holloway', 'cartographer', [
    C(['The Singing Ice', 'Поющий лёд'], ['The ice sings at night near {island}. {giver} wants a landing and a listen.', 'У острова {island} по ночам поёт лёд. {giver} хочет высадки и чтобы кто-то послушал.'], ['land_any', 'home']),
    C(['Crystal Under Snow', 'Хрусталь под снегом'], ['Crystal, not ice. {giver} wants a sample carried to the scholars in {port2}.', 'Не лёд — хрусталь. {giver} хочет, чтобы образец отвезли учёным в порт {port2}.'], ['visit2', 'home']),
    C(['What Sings Back', 'Что поёт в ответ'], ['The scholars say something answers the song from the deep. Send divers to the wrecks near it.', 'Учёные говорят, что песне отвечает нечто из глубины. Спустите водолазов к затонувшим судам поблизости.'], ['dive', 'home']),
  ]),
  A('leviathan_reach', 'leviathan_watch', 'Aldous Thorne', 'garrison_captain', [
    C(['The Leviathan Watch', 'Дозор левиафана'], ['{giver} keeps a watch for the great beasts. Keep the sea in {region} for his log.', '{giver} несёт дозор за великими тварями. Проведите время в водах «{region}» ради его журнала.'], ['time_in', 'home']),
    C(['A Harpoon Big Enough', 'Гарпун по размеру'], ['He needs {good} from {port2} for a harpoon big enough.', 'Ему нужен товар «{good}» из порта {port2} для гарпуна подходящего размера.'], ['deliver2', 'home'], { good: 'iron' }),
    C(['The Watch Relieved', 'Смена дозора'], ['The watch at {port3} must be relieved. Carry his orders.', 'Дозор в порту {port3} нужно сменить. Отвезите его приказы.'], ['visit3', 'home']),
  ]),
  // ---------------------------------------------------------------- Dead Man's Expanse: open ocean, currents, calms
  A('dead_mans_expanse', 'dead_calm', 'Jonas Pike', 'old_salt', [
    C(['The Dead Calm', 'Мёртвый штиль'], ['{giver} was becalmed in {region} for a month once. He wants someone to keep the sea there and come back sane.', '{giver} однажды месяц простоял в штиле в водах «{region}». Он хочет, чтобы кто-то провёл там время и вернулся в своём уме.'], ['time_in', 'home']),
    C(['The Castaways', 'Робинзоны'], ['His shipmates were left on {island}. Land and see if anyone remains.', 'Его товарищей оставили на острове {island}. Высадитесь и посмотрите, остался ли кто.'], ['land_any', 'home']),
    C(['Home at Last', 'Наконец домой'], ['One man remains, old now. Carry word of him to {port2}.', 'Остался один, теперь старик. Отвезите весть о нём в порт {port2}.'], ['visit2', 'home']),
  ]),
  A('dead_mans_expanse', 'ship_graveyard', 'Nell Carrow', 'pearl_diver', [
    C(['The Graveyard of Ships', 'Кладбище кораблей'], ['{giver} dives the ship graveyards. Send your divers down with hers.', '{giver} ныряет на кладбищах кораблей. Спустите своих водолазов вместе с её людьми.'], ['dive', 'home']),
    C(['A Name on a Bell', 'Имя на колоколе'], ['A bell brought up bears the name of a ship from {port2}. They should know.', 'На поднятом колоколе — имя корабля из порта {port2}. Там должны узнать.'], ['visit2', 'home']),
    C(['The Owner\'s Reward', 'Награда владельца'], ['The owner in {port2} pays for the rest of her cargo. Dive again.', 'Владелец из порта {port2} платит за остальной груз. Ныряйте снова.'], ['dive', 'home']),
  ]),
  A('dead_mans_expanse', 'castaway_king', 'Quint Orme', 'hermit', [
    C(['The Castaway King', 'Король робинзонов'], ['A castaway calls himself king of {island}. {giver} was his subject once. Land and meet him.', 'Один робинзон называет себя королём острова {island}. {giver} когда-то был его подданным. Высадитесь и встретьтесь с ним.'], ['land_any', 'home']),
    C(['Royal Supplies', 'Королевские припасы'], ['The king needs {good}. {giver} says he pays in pearls.', 'Королю нужен товар «{good}». {giver} говорит, что он платит жемчугом.'], ['deliver2', 'home'], { good: 'provisions' }),
    C(['Abdication', 'Отречение'], ['The king wants to go home to {port3}. Carry him.', 'Король хочет домой, в порт {port3}. Отвезите его.'], ['visit3', 'home']),
  ]),
  A('dead_mans_expanse', 'salt_pans', 'Edda Jessop', 'fishwife', [
    C(['The Salt Pans', 'Солончаки'], ['{giver} works the salt pans on {island} and has not been seen for a week. Land and look for her.', '{giver} работает на солончаках острова {island}, и её неделю никто не видел. Высадитесь и найдите её.'], ['land_any', 'home']),
    C(['Salt to Market', 'Соль на рынок'], ['The salt must reach {port2} before the rains.', 'Соль должна попасть в порт {port2} до дождей.'], ['pickup', 'deliver2', 'home'], { good: 'salt' }),
    C(['The Tax Man', 'Сборщик податей'], ['A tax man in {port3} claims the pans. {giver} wants him to see her papers.', 'Сборщик податей из порта {port3} претендует на солончаки. {giver} хочет показать ему свои бумаги.'], ['visit3', 'home']),
  ]),
  A('dead_mans_expanse', 'currents_map', 'Fenn Wick', 'cartographer', [
    C(['The Current\'s Map', 'Карта течений'], ['{giver} maps the great currents of {region}. Sail them and keep a log.', '{giver} наносит на карту большие течения в водах «{region}». Пройдите по ним и ведите журнал.'], ['time_in', 'home']),
    C(['Where They Meet', 'Где они сходятся'], ['The currents meet near {island}. Land there and mark it.', 'Течения сходятся у острова {island}. Высадитесь и отметьте место.'], ['land_any', 'home']),
    C(['The Map Sold', 'Карта продана'], ['The finished map is worth a fortune in {port2}. Carry it.', 'Готовая карта стоит в порту {port2} целое состояние. Отвезите её.'], ['visit2', 'home']),
  ]),
  // ---------------------------------------------------------------- the Drowned Crown: the drowned empire, cults
  A('drowned_crown', 'choir_hymn', 'Leda Moor', 'cultist', [
    C(['The Choir\'s Hymn', 'Гимн Хора'], ['{giver} hears a hymn from under the water near {island}. Land and listen.', '{giver} слышит гимн из-под воды у острова {island}. Высадитесь и послушайте.'], ['land_any', 'home']),
    C(['The Singers', 'Певцы'], ['The singers are ghost ships. {giver} wants them silenced.', 'Поют корабли-призраки. {giver} хочет, чтобы они замолчали.'], ['sink_ghosts', 'home']),
    C(['The Last Verse', 'Последний куплет'], ['The last verse is carved at the {site} on {island}. Copy it for {giver}.', 'Последний куплет высечен у места «{site}» на острове {island}. Перепишите его для сектанта ({giver}).'], ['land_site', 'home'], { site: 'ruins' }),
  ]),
  A('drowned_crown', 'drowned_heir', 'Osric Hawthorne', 'priest', [
    C(['The Drowned Heir', 'Утонувший наследник'], ['{giver} says the heir of the drowned empire lives, and was seen in {port2}.', '{giver} говорит, что наследник утонувшей империи жив и его видели в порту {port2}.'], ['visit2', 'home']),
    C(['The Heir\'s Seal', 'Печать наследника'], ['The heir\'s seal lies at the {site} on {island}. Without it no one will believe him.', 'Печать наследника лежит у места «{site}» на острове {island}. Без неё ему никто не поверит.'], ['land_site', 'home'], { site: 'ruins' }),
    C(['A Crown Refused', 'Отвергнутая корона'], ['The heir wants no crown, only peace. Sink the cultists who hunt him in {region}.', 'Наследнику не нужна корона, только покой. Потопите сектантов, что охотятся на него в водах «{region}».'], ['sink_any', 'home']),
  ]),
  A('drowned_crown', 'bells_under', 'Bess Lamb', 'widow', [
    C(['Bells Under Water', 'Колокола под водой'], ['{giver} hears her drowned husband\'s church bell ring. Send divers to the wrecks.', '{giver} слышит, как звонит колокол церкви её утонувшего мужа. Спустите водолазов к затонувшим судам.'], ['dive', 'home']),
    C(['The Bell\'s Tower', 'Башня колокола'], ['The bell hangs in a tower off {island}. Land and see.', 'Колокол висит в башне у острова {island}. Высадитесь и посмотрите.'], ['land_any', 'home']),
    C(['Let It Rest', 'Пусть покоится'], ['The priest in {port2} will say the words that let it rest.', 'Священник в порту {port2} произнесёт слова, что успокоят его.'], ['visit2', 'home']),
  ]),
  A('drowned_crown', 'crown_regalia', 'Silas Varga', 'fence', [
    C(['The Crown\'s Regalia', 'Регалии Короны'], ['{giver} has a buyer for the drowned empire\'s regalia. The sceptre lies at the {site} on {island}.', 'У скупщика ({giver}) есть покупатель на регалии утонувшей империи. Скипетр лежит у места «{site}» на острове {island}.'], ['land_site', 'home'], { site: 'ruins' }),
    C(['The Orb', 'Держава'], ['The orb went down with a ship. Dive for it.', 'Держава ушла на дно вместе с кораблём. Ныряйте за ней.'], ['dive', 'home']),
    C(['The Buyer', 'Покупатель'], ['The buyer waits in {port2} — and so do the cultists who want the regalia back.', 'Покупатель ждёт в порту {port2} — как и сектанты, что хотят вернуть регалии.'], ['visit2', 'home']),
  ]),
  A('drowned_crown', 'last_procession', 'Vesper Doyle', 'priest', [
    C(['The Last Procession', 'Последняя процессия'], ['Once a year the drowned walk in procession. {giver} asks you keep the sea in {region} that night.', 'Раз в год утонувшие выходят процессией. {giver} просит вас провести ту ночь в водах «{region}».'], ['time_in', 'home']),
    C(['Lanterns for the Dead', 'Фонари для мёртвых'], ['The procession needs lanterns: carry {good} to {port2}.', 'Процессии нужны фонари: отвезите товар «{good}» в порт {port2}.'], ['deliver2', 'home'], { good: 'cloth' }),
    C(['The Procession Ends', 'Конец процессии'], ['The procession ends at the {site} on {island}. Be there.', 'Процессия заканчивается у места «{site}» на острове {island}. Будьте там.'], ['land_site', 'home'], { site: 'ruins' }),
  ]),
  // ---------------------------------------------------------------- the Abyss: black storms, dead wind, a light below
  A('the_abyss', 'light_below', 'Rurik Stroud', 'cultist', [
    C(['The Light Below', 'Свет внизу'], ['{giver} has seen the light far below the Abyss. Keep the sea in {region} and see it too.', '{giver} видел свет глубоко под Бездной. Проведите время в водах «{region}» и увидьте его тоже.'], ['time_in', 'home']),
    C(['Closer', 'Ближе'], ['The light is brighter near {island}. Land there.', 'У острова {island} свет ярче. Высадитесь там.'], ['land_any', 'home']),
    C(['What Waits', 'Что ждёт'], ['Something waits under the light. Send divers to the wrecks around it — and pray.', 'Под светом что-то ждёт. Спустите водолазов к судам вокруг — и молитесь.'], ['dive', 'home']),
  ]),
  A('the_abyss', 'bone_reef', 'Hester Kell', 'hermit', [
    C(['The Bone Reef', 'Костяной риф'], ['{giver} lives near a reef made of bones. Land on {island} and see it.', '{giver} живёт у рифа из костей. Высадитесь на острове {island} и посмотрите.'], ['land_any', 'home']),
    C(['Whose Bones', 'Чьи кости'], ['Human bones among the beasts\'. The ghosts that sail here know whose. Send them down.', 'Среди звериных — человеческие кости. Призраки, что ходят здесь, знают чьи. Отправьте их на дно.'], ['sink_ghosts', 'home']),
    C(['A Grave Marked', 'Отмеченная могила'], ['{giver} wants the names carried to {port2}.', '{giver} хочет, чтобы имена отвезли в порт {port2}.'], ['visit2', 'home']),
  ]),
  A('the_abyss', 'black_storm_log', 'Dagny Crane', 'cartographer', [
    C(['The Black Storm Log', 'Журнал чёрного шторма'], ['{giver} logs the black storms. Keep the sea in {region} through one.', '{giver} ведёт журнал чёрных штормов. Проведите в водах «{region}» время одного из них.'], ['time_in', 'home']),
    C(['The Eye', 'Глаз бури'], ['At the storm\'s eye lies {island}. Land there.', 'В глазу бури лежит остров {island}. Высадитесь там.'], ['land_any', 'home']),
    C(['Published', 'Опубликовано'], ['The log must reach the scholars in {port2}.', 'Журнал должен попасть к учёным в порт {port2}.'], ['visit2', 'home']),
  ]),
  A('the_abyss', 'spore_gardens', 'Esme Gault', 'apothecary', [
    C(['The Spore Gardens', 'Сады спор'], ['Glowing caps grow on {island}. {giver} wants a landing and samples.', 'На острове {island} растут светящиеся грибы. {giver} хочет высадки и образцов.'], ['land_any', 'home']),
    C(['The Cure in the Caps', 'Лекарство в шляпках'], ['The caps cure the drowning fever. Carry {good} made from them to {port2}.', 'Эти грибы лечат лихорадку утопленников. Отвезите сделанный из них товар «{good}» в порт {port2}.'], ['deliver2', 'home'], { good: 'medicine' }),
    C(['The Garden Guarded', 'Охраняемый сад'], ['Ghost ships guard the gardens now. Send them down.', 'Теперь сады охраняют корабли-призраки. Отправьте их на дно.'], ['sink_ghosts', 'home']),
  ]),
  A('the_abyss', 'deeps_bargain', 'Magnus Blackwater', 'cultist', [
    C(['The Deep\'s Bargain', 'Сделка с глубиной'], ['{giver} made a bargain with the deep and wants it kept. Send divers to the wrecks as an offering.', '{giver} заключил сделку с глубиной и хочет её исполнить. Спустите водолазов к затонувшим судам — это подношение.'], ['dive', 'home']),
    C(['The Price', 'Цена'], ['The deep asks for ships. Sink them in {region}.', 'Глубина просит кораблей. Потопите их в водах «{region}».'], ['sink_any', 'home']),
    C(['Paid', 'Уплачено'], ['The bargain is paid. {giver} will tell the faithful in {port2}.', 'Сделка оплачена. {giver} расскажет об этом верным в порту {port2}.'], ['visit2', 'home']),
  ]),
];

/** The arcs on a world: each chapter a quest offered at the region's port, opening when the one before is done. */
export function generateArcs(world: World, seed: number): QuestDef[] {
  world = legacyWorld(world); // docs/18 III: the arcs a saved game knows keep their islands
  const out: QuestDef[] = [];
  for (const arc of ARCS) {
    const rng = new Rng((hashString(arc.id) ^ (seed * 40503)) >>> 0);
    const [cx, cy] = REGIONS[arc.region].center;
    const ports = world.ports.filter((p) => !p.raft); // the floating towns keep out of the stories (docs/16 P3)
    const regionPorts = ports.filter((p) => p.region === arc.region).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    const home: Port | undefined = regionPorts[0] ?? ports.slice().sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (!home) continue;
    const others = ports.filter((p) => p.id !== home.id).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y)).slice(0, 6);
    const islands = world.islands.filter((is) => is.region === arc.region && !is.portId && !is.minor);
    const level = [1, 6, 10, 14, 18, 16, 22, 40][REGION_IDS.indexOf(arc.region)] ?? 10;
    let prev: string | null = null;
    arc.chapters.forEach((ch, i) => {
      const port2 = others[rng.int(0, Math.max(0, others.length - 1))];
      const port3 = others.filter((p) => p !== port2)[rng.int(0, Math.max(0, others.length - 2))] ?? port2;
      const fits = (is: Island): string | undefined => {
        const here = [...is.features, ...islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: Math.round(is.radius), poly: is.poly, features: is.features, portId: is.portId }).map((x) => x.kind)];
        if (ch.site === 'people') return here.find((f) => f === 'fishers' || f === 'smugglers');
        if (ch.site === 'ruins') return here.find((f) => f === 'ruins' || f === 'shrine' || f === 'bell');
        if (ch.site === 'beasts') return here.find((f) => f === 'seals' || f === 'crabs' || f === 'turtles');
        return ch.site ? here.find((f) => f === ch.site) : undefined;
      };
      // The site in the arc's own waters, else on the nearest island that has it (safe waters keep no smugglers' camps).
      let siteIslands = ch.site ? islands.filter((is) => fits(is)) : [];
      if (ch.site && !siteIslands.length) siteIslands = world.islands.filter((is) => !is.portId && !is.minor && fits(is)).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y)).slice(0, 5);
      const landable = islands.filter((is) => is.features.some((f) => f !== 'port'));
      const island = ch.site ? (siteIslands.length ? rng.pick(siteIslands) : undefined) : landable.length ? rng.pick(landable) : islands.length ? rng.pick(islands) : undefined;
      // A chapter that needs a site the region lacks lands anywhere on the island instead.
      const steps = ch.steps.map((k) => (k === 'land_site' && (!island || !fits(island)) ? 'land_any' : k));
      if (steps.some((k) => k.startsWith('land')) && !island) return;
      const site = island && ch.site ? fits(island) : undefined;
      const good = ch.good ?? 'provisions';
      const n = steps.includes('time_in') ? 4 : steps.some((k) => k === 'pickup' || k.startsWith('deliver')) ? 10 : steps.includes('chart') ? 4 : steps.includes('contraband') ? 8 : 2;
      const v: Record<string, string> = {
        giver: arc.giver, port: home.name, port2: port2?.name ?? '', port3: port3?.name ?? '', island: island?.name ?? '', region: REGIONS[arc.region].name,
        good: GOODS[good].name, n: String(n), site: site ? SITE_NAMES[site] ?? site : '',
      };
      const qs: QuestStep[] = steps.map((k) => arcStep(k, { home, port2, port3, island, site, good, n, region: arc.region }, fill(STEP_TEXT[k][0], v)));
      const id = `a_${arc.region}_${arc.id}_${i + 1}`;
      const lvl = level + i * 2;
      out.push({
        id, kind: 'story', name: fill(ch.name[0], v), mentor: `${arc.giver}, ${PROF_EN[arc.profession]}`, port: home.id, summary: fill(ch.summary[0], v),
        requires: { level: lvl, ...(prev ? { done: [prev] } : {}) }, steps: qs,
        reward: { xp: questXp(lvl, legacyQuestSize((500 + i * 350) * (1 + lvl / 12), lvl)), silver: Math.round((500 + i * 400) * (1 + lvl / 12)) }, category: 'arc', template: `${arc.id}.${i + 1}`,
        portrait: giverPortrait(arc.profession, arc.giver),
      });
      prev = id;
    });
  }
  return out;
}

const PROF_EN: Record<Profession, string> = {
  harbour_master: 'harbour master', fishwife: 'fishwife', shipwright: 'shipwright', priest: 'priest', widow: 'widow', merchant: 'merchant', smuggler: 'smuggler',
  old_salt: 'old salt', apothecary: 'apothecary', cartographer: 'cartographer', garrison_captain: 'garrison captain', tavern_keeper: 'tavern keeper',
  pearl_diver: 'pearl diver', fence: 'fence', envoy: 'envoy', hermit: 'hermit', bosun: 'bosun', lighthouse_keeper: 'lighthouse keeper', whaler: 'whaler', cultist: 'cultist',
};

interface ArcParams { home: Port; port2?: Port; port3?: Port; island?: Island; site?: string; good: GoodId; n: number; region: RegionId }

function arcStep(k: StepKind, p: ArcParams, text: string): QuestStep {
  switch (k) {
    case 'pickup':
      return { type: 'pickup', port: p.home.id, good: p.good, qty: p.n, text };
    case 'deliver2':
      return { type: 'deliver', port: p.port2!.id, good: p.good, qty: p.n, text };
    case 'deliver3':
      return { type: 'deliver', port: p.port3!.id, good: p.good, qty: p.n, text };
    case 'visit2':
      return { type: 'visit', port: p.port2!.id, text };
    case 'visit3':
      return { type: 'visit', port: p.port3!.id, text };
    case 'home':
      return { type: 'visit', port: p.home.id, text };
    case 'back':
      return { type: 'land', island: p.island!.id, site: p.site, text };
    case 'sink_pirates':
      return { type: 'sink', count: p.n, role: 'pirate', region: p.region, text };
    case 'sink_ghosts':
      return { type: 'sink', count: p.n, role: 'ghost', text };
    case 'sink_hunters':
      return { type: 'sink', count: p.n, role: 'patrol', text };
    case 'sink_any':
      return { type: 'sink', count: p.n, region: p.region, text };
    case 'board':
      return { type: 'board', count: p.n, text };
    case 'prize':
      return { type: 'prize', count: Math.min(2, p.n), text };
    case 'land_site':
      return { type: 'land', island: p.island!.id, site: p.site, text };
    case 'land_any':
    case 'land_any2':
      return { type: 'land', island: p.island!.id, text };
    case 'dive':
      return { type: 'dive', count: p.n, text };
    case 'chart':
      return { type: 'chart', count: p.n, text };
    case 'reach':
      return { type: 'reach', region: p.region, text };
    case 'time_in':
      return { type: 'time_in', region: p.region, seconds: p.n * 60, text };
    case 'contraband':
      return { type: 'sell_contraband', qty: p.n, port: p.port2!.id, text };
    case 'customs':
      return { type: 'customs', text };
    case 'catch_any':
      return { type: 'catch', count: p.n, text };
    case 'catch_big':
      return { type: 'catch', count: 1, minKg: p.n, text };
    case 'hunt_whale':
      return { type: 'beast', count: p.n, group: 'whale', text };
    case 'hunt_orca':
      return { type: 'beast', count: p.n, group: 'orca', text };
    case 'hunt_shark':
      return { type: 'beast', count: p.n, group: 'shark', text };
    case 'sink_named':
      return { type: 'named', count: 1, text };
    case 'tribute':
      return { type: 'tribute', count: Math.min(2, p.n), text };
    case 'find_letter':
      return { type: 'letters', count: 1, text };
    case 'race2':
      return { type: 'race', port: p.port2!.id, seconds: Math.max(300, p.n * 60), text };
  }
}

/** The arcs' texts as translation patterns (placeholders numbered as in the generator's). */
export function arcPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const a of ARCS) for (const c of a.chapters) out.push(numberedPattern(c.name[0], c.name[1]), numberedPattern(c.summary[0], c.summary[1]));
  return out;
}
