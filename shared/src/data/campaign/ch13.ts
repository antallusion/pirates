// Chapter 13 — The Belfry Under the Ice (Act III, The Northern Waters). A church of the Drowned Crown lies under the
// fjord's ice; the clans remember it in song, the Order would rather not. The Bell-Warden cuts its bell free first and
// carries it to his ice fortress (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 13,
  region: 'leviathan_reach',
  hub: 'frostgate',
  title: ['The Belfry Under the Ice', 'Колокольня подо льдом'],
  blurb: [
    'A walled town in the fjord where the try-works never go out and the ice never quite lets go. Under that ice stands a church of the Drowned Crown, and someone is sawing his way down to its bell.',
    'Город за стенами во фьорде, где салотопни не гаснут, а лёд никогда до конца не отпускает. Подо льдом стоит церковь Утонувшей Короны, и кто-то пропиливает себе путь к её колоколу.',
  ],
  giver: ['Ingrid Holm, envoy of the northern clans', 'Ингрид Хольм, посланница северных кланов'],
  portrait: 'giver_envoy_f',
  reward: { ammo: true },
  quests: [
    {
      t: ['The Gate in the Fjord', 'Ворота во фьорде'],
      b: [
        'The Order has chained the fjord shut and lets in no ship it does not know. Gunnar’s harpoon will not open the chain, but the clans’ envoy might. She will meet you past {isle}, where the old belfry stump breaks the ice.',
        'Орден перегородил фьорд цепью и не пускает чужие корабли. Гарпун Гуннара цепь не откроет, а посланница кланов — может. Она встретит вас за островом {isle}, там, где лёд прорывает обломок старой звонницы.',
      ],
      d: [
        'Ingrid Holm steps aboard from a sledge on the ice. “The Order will let you in,” she says, “because I have not yet told them why.”',
        'Ингрид Хольм поднимается на борт прямо с саней. «Орден вас впустит, — говорит она, — потому что я ещё не сказала им зачем».',
      ],
      s: ['isle', 'hub'],
    },
    {
      t: ['Timber for the Order', 'Лес для Ордена'],
      b: [
        'Nothing grows in the fjord, and the Order’s try-works eat timber like a furnace eats coal. A captain who brings wood to {hub} is listened to. One who does not is watched.',
        'Во фьорде ничего не растёт, а салотопни Ордена пожирают лес, как топка уголь. Капитана, который привёз дрова в порт {hub}, слушают. Того, кто не привёз, — сторожат.',
      ],
      d: [
        'The Order’s quartermaster signs for the timber and, for the first time, looks you in the eye.',
        'Квартирмейстер Ордена расписывается за лес и впервые смотрит вам в глаза.',
      ],
      s: ['bring:timber'],
    },
    {
      t: ['The Song of the Sunken Church', 'Песня о затонувшей церкви'],
      b: [
        'The clans keep in song what the Order keeps out of its books. The oldest singer lives at {port} and sings only for those who bring her news from the south. Go and listen.',
        'Кланы хранят в песнях то, что Орден не пускает в свои книги. Старейшая певица живёт в порту {port} и поёт лишь тем, кто привозит ей вести с юга. Сходите и послушайте.',
      ],
      d: [
        'She sings of a church that the sea took in one night, with its bell still ringing as the water closed over it.',
        'Она поёт о церкви, которую море забрало за одну ночь, — колокол звонил, пока над ним не сомкнулась вода.',
      ],
      s: ['port', 'hub'],
    },
    {
      t: ['Saws in the Night', 'Ночные пилы'],
      b: [
        'At night the fjord ice groans in a straight line, and in the morning the Order finds square holes frozen over again. Ingrid wants the men with the saws. Keep watch, then take their boat.',
        'По ночам лёд фьорда стонет по прямой, а утром Орден находит квадратные проруби, уже затянутые льдом. Ингрид нужны люди с пилами. Несите дозор, а потом возьмите их лодку.',
      ],
      d: [
        'Their saws are long enough to cut to the depth of a church roof, and their boat has a grey sail folded under the thwart.',
        'Их пилы длинны настолько, чтобы прорезать лёд на глубину церковной крыши, а под банкой лодки сложен серый парус.',
      ],
      s: ['escort', 'board:1'],
    },
    {
      t: ['Frozen In', 'Вмёрзшие'],
      b: [
        'A clan trading ship was caught by the ice off {isle} three days ago, and her crew are burning her rails to stay warm. Ingrid’s cousin is aboard. Get there before they burn the masts.',
        'Три дня назад торговый корабль кланов вмёрз в лёд у острова {isle}, и его команда жжёт фальшборт, чтобы согреться. На борту двоюродный брат Ингрид. Успейте, пока они не сожгли мачты.',
      ],
      d: [
        'They come off over the ice roped together. Ingrid’s cousin says the ice froze around them in one night, far too fast.',
        'Они сходят по льду, связанные одной верёвкой. Брат Ингрид говорит, что лёд сковал их за одну ночь — слишком быстро.',
      ],
      s: ['isle', 'rescue'],
    },
    {
      t: ['Winter Fever', 'Зимняя лихорадка'],
      b: [
        'Fever has come to the clans’ winter camp at {port2}, and the Order’s physicians will not cross the ice. The apothecaries of {port} have what is needed. Carry it before the camp breaks up.',
        'В зимний лагерь кланов у порта {port2} пришла лихорадка, а лекари Ордена через лёд не ходят. У аптекарей порта {port} есть всё нужное. Довезите, пока лагерь не разбрёлся.',
      ],
      d: [
        'The clan elders touch their foreheads to your sleeve. Ingrid says it means more than any seal.',
        'Старейшины кланов касаются лбом вашего рукава. Ингрид говорит, это значит больше любой печати.',
      ],
      s: ['carry:medicine'],
    },
    {
      t: ['Shields of the Clans', 'Щиты кланов'],
      b: [
        'The clans will lend you warriors, but only once you have shown them you can fight on ice. Beasts have come down from the floes since the ringing began. Break their dens and choose your men.',
        'Кланы дадут вам воинов, но только когда увидят, что вы умеете драться на льду. С тех пор как начался звон, с льдин спустились звери. Разорите их логова и выберите себе людей.',
      ],
      d: [
        'The warriors paint a white line across your bow, the clans’ sign that the ship is now a hall of theirs.',
        'Воины проводят белую черту поперёк вашего носа — знак кланов, что корабль теперь стал их домом.',
      ],
      s: ['lair', 'recruit'],
    },
    {
      t: ['The Commander’s Doubt', 'Сомнения командора'],
      b: [
        'The Order’s commander says there is no church under the fjord and no one sawing the ice. He will believe a crew of sawyers in chains. Bring him one.',
        'Командор Ордена говорит, что под фьордом нет никакой церкви и никто не пилит лёд. Он поверит команде пильщиков в кандалах. Доставьте ему такую.',
      ],
      d: [
        'The commander questions them himself and comes out grey in the face. From then on the Order’s gate is open to you.',
        'Командор допрашивает их сам и выходит с серым лицом. С этого дня ворота Ордена для вас открыты.',
      ],
      s: ['board:1', 'hub'],
    },
    {
      t: ['Beneath the Fjord', 'Под фьордом'],
      b: [
        'The Order cuts you a hole of its own above the place the clans sing of. Send the first divers down into water so cold it stops a man’s breath, and let them come up quickly.',
        'Орден прорубает вам собственную прорубь над тем местом, о котором поют кланы. Спустите первых водолазов в воду, от холода которой перехватывает дыхание, и пусть поднимаются быстро.',
      ],
      d: [
        'Twenty fathoms down a weathervane in the shape of a ship stands straight and points north, as if the wind still blew.',
        'На глубине двадцати саженей стоит прямо флюгер в виде корабля и указывает на север, будто ветер ещё дует.',
      ],
      s: ['dive', 'hub'],
    },
    {
      t: ['The Chapel on the Shore', 'Часовня на берегу'],
      b: [
        'Every church of the Drowned Crown had a chapel on the nearest shore, where the bell was blessed before it was hung. Ingrid thinks the twin of this one stands on {isle}. Land and read the walls.',
        'У каждой церкви Утонувшей Короны была часовня на ближнем берегу, где колокол освящали, прежде чем повесить. Ингрид думает, что близнец этой стоит на острове {isle}. Высадитесь и прочтите стены.',
      ],
      d: [
        'The bell’s name is carved by the door: “The Long Winter”. Beneath it someone has scratched a fresh grey bell.',
        'У двери вырезано имя колокола: «Долгая зима». Под ним кто-то недавно нацарапал серый колокольчик.',
      ],
      s: ['land:ruins', 'hub'],
    },
    {
      t: ['Orcas in the Fjord', 'Косатки во фьорде'],
      b: [
        'A pod of orcas has followed the ringing into the fjord and now circles the Order’s fishing holes, taking anything that stands too close to the edge. Ingrid wants the fjord clear before the divers go down again.',
        'Стая косаток пришла за звоном во фьорд и теперь кружит у рыбачьих прорубей Ордена, хватая всё, что стоит слишком близко к краю. Ингрид хочет очистить фьорд, прежде чем водолазы снова пойдут вниз.',
      ],
      d: [
        'The pod is broken. The Order’s fishermen come back to their holes, but they stand three paces from the edge now.',
        'Стая разбита. Рыбаки Ордена возвращаются к прорубям, но теперь стоят в трёх шагах от края.',
      ],
      s: ['beast:orca', 'hub'],
    },
    {
      t: ['Grey Sails in the Ice', 'Серые паруса во льдах'],
      b: [
        'Ships under grey sails have come north from the Widow, bringing bronze-workers and chain to the Bell-Warden. Their convoy is beating up the coast. Stop it before it reaches the ice.',
        'С юга от Вдовы пришли корабли под серыми парусами — везут Звонарю литейщиков и цепи. Их конвой лавирует вдоль берега. Остановите его, пока он не дошёл до льдов.',
      ],
      d: [
        'Among the bronze-workers is an old man who weeps when he sees the clans’ white line: he cast bells for the Order once.',
        'Среди литейщиков — старик, который плачет, увидев белую черту кланов: когда-то он лил колокола для Ордена.',
      ],
      s: ['sink:3', 'board:1'],
    },
    {
      t: ['Powder for the Ice', 'Порох для льда'],
      b: [
        'To bring up a bell the ice must be opened wide, and saws are too slow. The Order has no powder to spare for anything but its walls. Bring gunpowder to {hub}.',
        'Чтобы поднять колокол, лёд нужно вскрыть широко, а пилами это слишком долго. Пороха у Ордена хватает только на стены. Привезите порох в порт {hub}.',
      ],
      d: [
        'The kegs are lowered onto the ice on sledges, and the whole town comes out to watch where they are laid.',
        'Бочонки спускают на лёд на санях, и весь город выходит посмотреть, где их заложат.',
      ],
      s: ['bring:gunpowder'],
    },
    {
      t: ['A Channel to the Belfry', 'Канал к колокольне'],
      b: [
        'A ship must reach the hole in open water, or the bell will sink back through the ice. Sound a passage past {isle} and on to {isle2}, where the pack is thinnest.',
        'Корабль должен подойти к проруби по открытой воде, иначе колокол провалится обратно под лёд. Проложите проход мимо острова {isle} и дальше, к острову {isle2}, где льды тоньше всего.',
      ],
      d: [
        'The passage is marked with flags on poles. By morning two of them have been pulled out and thrown down on the ice.',
        'Проход отмечен флажками на шестах. К утру два из них выдернуты и брошены на лёд.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['Winter Quarters', 'Зимние квартиры'],
      b: [
        'Ingrid has seen captains come north for one summer and stay for ever. If you mean to fight up here, your island must feed and warm your crews through the winter. Build what they need.',
        'Ингрид видела, как капитаны приходили на север на одно лето и оставались навсегда. Если вы намерены воевать здесь, ваш остров должен кормить и греть команды всю зиму. Постройте всё нужное.',
      ],
      d: [
        'Smoke rises from new chimneys on your island. The clans’ warriors call it the southern hall, and they mean it kindly.',
        'Над вашим островом поднимается дым из новых труб. Воины кланов зовут его южным домом — и говорят это по-доброму.',
      ],
      s: ['build', 'hub'],
    },
    {
      t: ['The Envoy’s Errand', 'Поручение посланницы'],
      b: [
        'Ingrid must carry word of the belfry to the sealers before the Order tells it wrong. Her sledges cannot cross the open leads. See her boats safely to {at}.',
        'Ингрид должна донести весть о колокольне до зверобоев раньше, чем Орден перескажет её по-своему. Её сани через открытые разводья не пройдут. Проводите её лодки до порта {at}.',
      ],
      d: [
        'The sealers’ headwoman hears Ingrid out and says, “Then the ice fortress is not a tale either.”',
        'Старшина зверобоев выслушивает Ингрид и говорит: «Значит, и ледяная крепость — не сказка».',
      ],
      s: ['escort', 'at:sealhold'],
    },
    {
      t: ['The Frost Wolf', 'Морозный волк'],
      b: [
        'A pirate the Hunters’ Guild calls the Frost Wolf has been raiding the Order’s supply ships, and since the ringing began he raids only those that carry timber or powder. Someone is paying him to choose.',
        'Пират, которого Гильдия охотников зовёт Морозным волком, грабит суда снабжения Ордена, а с тех пор как начался звон, берёт только те, что везут лес или порох. Кто-то платит ему за выбор.',
      ],
      d: [
        'His last letter, unsent, is addressed to “the Warden, at the fortress past the seal grounds”.',
        'Его последнее письмо, так и не отправленное, адресовано «Звонарю, в крепость за тюленьими лежбищами».',
      ],
      s: ['named', 'hub'],
    },
    {
      t: ['Soundings of the Fjord', 'Промеры фьорда'],
      b: [
        'The Order’s charts of the fjord are a century old and drawn for whalers, not for a ship carrying a bell. Chart the islands of the outer fjord, so the way out is known as well as the way in.',
        'Карты фьорда у Ордена столетней давности и сняты для китобоев, а не для корабля с колоколом. Нанесите на карту острова внешнего фьорда, чтобы путь наружу был известен не хуже пути внутрь.',
      ],
      d: [
        'Ingrid rolls up the new chart and says she has never seen the fjord look so small.',
        'Ингрид сворачивает новую карту и говорит, что никогда ещё фьорд не казался ей таким маленьким.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['Hounds on the Ice', 'Гончие на льду'],
      b: [
        'The Bell-Warden knows you are here. His hunters are waiting in the leads outside the fjord for any ship that leaves the Order’s gate. Ingrid wants a letter carried to {port}. Let them try to stop it.',
        'Звонарь знает, что вы здесь. Его охотники ждут в разводьях у выхода из фьорда любой корабль, что выйдет из ворот Ордена. Ингрид нужно доставить письмо в порт {port}. Пусть попробуют помешать.',
      ],
      d: [
        'The letter is delivered. At {port} they say an iron-bowed ship passed north two days ago, low in the water.',
        'Письмо доставлено. В порту {port} говорят, что два дня назад на север прошёл корабль с железным форштевнем, глубоко сидящий в воде.',
      ],
      s: ['sink:3:hunter', 'port'],
    },
    {
      t: ['Bought Guards', 'Купленная стража'],
      b: [
        'Two of the Order’s guard-boats have been seen talking to grey sails at night. The commander cannot believe it of his own men, so Ingrid asks you to go over their rails and find out.',
        'Две сторожевые лодки Ордена видели по ночам рядом с серыми парусами. Командор не может поверить в такое о своих людях, и Ингрид просит вас сойтись с ними борт о борт и всё выяснить.',
      ],
      d: [
        'In their lockers, Choir silver and the hour of the blast. The Bell-Warden knows when the ice will open.',
        'В их рундуках — серебро Хора и час взрыва. Звонарь знает, когда вскроют лёд.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['The Belfry Beneath', 'Звонница в глубине'],
      b: [
        'The powder opens the ice off {isle} with a roar that echoes down the fjord. Before the smoke clears, iron-bowed ships come out of the pack. Hold them off while the divers go down to the belfry.',
        'Порох вскрывает лёд у острова {isle} с грохотом, что эхом катится по фьорду. Не успевает рассеяться дым, как из льдов выходят корабли с железными форштевнями. Сдержите их, пока водолазы спускаются к звоннице.',
      ],
      d: [
        'The belfry is empty: the beam is freshly sawn, and a track of broken ice leads north. Ingrid says, “His fortress. Past the seal grounds.”',
        'Звонница пуста: балка свежеспилена, а на север уходит след из колотого льда. Ингрид говорит: «В его крепость. За тюленьи лежбища».',
      ],
      s: ['isle', 'board:2', 'dive', 'hub'],
    },
  ],
};
