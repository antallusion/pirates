// Chapter 33 — Song of the Deep (Act VI, the Abyss). The ancient leviathans beyond the Wall, driven by the Choir's
// goad-bells; Ilse Harrow learns their song, and the eldest of them shows the way to the Eye (docs/36).

import type { ChapterSrc } from './types.ts';

export const CHAPTER: ChapterSrc = {
  n: 33,
  region: 'the_abyss',
  more: ['drowned_crown'],
  hub: 'marrowdeep',
  title: ['Song of the Deep', 'Песнь глубины'],
  blurb: [
    'The oldest things in the sea live beyond the Wall, and they sing. The Choir has learned to drive them with bells. Ilse Harrow has learned to listen, and what she hears is a map.',
    'За Стеной живут самые древние существа моря, и они поют. Хор научился гнать их колоколами. Ильзе Харроу научилась слушать, и то, что она слышит, — карта.',
  ],
  giver: ['Ilse Harrow, the Listener of Saint Maw', 'Ильзе Харроу, Слушающая из Сент-Мо'],
  portrait: 'giver_hermit_f',
  reward: { map: 3 },
  quests: [
    {
      t: ['A Song Through the Wall', 'Песня сквозь Стену'],
      b: [
        'Ilse Harrow has heard singing in her sleep since the Wall opened, all the way from Saint Maw, and she has come to {hub} to be nearer to it. Take her through the Wall. She wants to hear it awake.',
        'С тех пор как открылась Стена, Ильзе Харроу слышит во сне пение, даже в Сент-Мо, и она приехала в порт {hub}, чтобы быть ближе к нему. Отвезите её за Стену. Она хочет услышать его наяву.',
      ],
      d: [
        'Beyond the Wall Ilse stands at the rail with her eyes shut for an hour. “Not bells,” she says at last. “Voices. Very old ones.”',
        'За Стеной Ильзе целый час стоит у борта с закрытыми глазами. «Не колокола, — говорит она наконец. — Голоса. Очень старые».',
      ],
      s: ['reach', 'hub'],
    },
    {
      t: ['A Song Under the Keel', 'Песня под килем'],
      b: [
        'Ilse asks you to heave to near {isle} and keep the ship still, no guns, no bells, no orders shouted, while she lies with her ear to the planks of the hold.',
        'Ильзе просит лечь в дрейф у острова {isle} и держать корабль неподвижно — ни пушек, ни склянок, ни громких команд, — пока она лежит, прижавшись ухом к доскам трюма.',
      ],
      d: [
        'The whole hull hums like a struck glass. Ilse comes up from the hold pale and smiling: “They are talking about us.”',
        'Весь корпус гудит, как стакан, по которому ударили. Ильзе выходит из трюма бледная и улыбается: «Они говорят о нас».',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['A Beast Gone Mad', 'Обезумевший зверь'],
      b: [
        'A leviathan has staved in two fishing smacks off {hub} and is circling the harbour mouth, roaring at the lighthouse. Ilse says it is not hunting; it is in pain. It must be driven off before it takes the quay.',
        'Левиафан проломил два рыбацких смэка у порта {hub} и кружит у входа в гавань, ревя на маяк. Ильзе говорит, что он не охотится, ему больно. Его надо отогнать, пока он не разнёс причал.',
      ],
      d: [
        'In the beast’s side, driven deep, the divers find a small bronze bell, still ringing by itself.',
        'В боку зверя, глубоко вбитый, водолазы находят маленький бронзовый колокол, который всё ещё звенит сам по себе.',
      ],
      s: ['beast:any', 'hub'],
    },
    {
      t: ['The Goad-Bells', 'Колокола-погонщики'],
      b: [
        'The Choir hangs bells under its hulls and rings them in a pattern that drives the leviathans before it like cattle. Ilse can hear the pattern from a mile off. Find the ships that ring it and silence them.',
        'Хор подвешивает колокола под днищами и звонит в них так, что левиафаны бегут перед ним, как скот. Ильзе слышит этот звон за милю. Найдите корабли, которые звонят, и заставьте их замолчать.',
      ],
      d: [
        'With the goad-bells silent, the beasts sound and are gone. The sea is so quiet you can hear the rigging tick.',
        'Колокола-погонщики умолкли, звери ныряют и исчезают. Море так тихо, что слышно, как потрескивает такелаж.',
      ],
      s: ['board:2', 'sink:3'],
    },
    {
      t: ['A Hold Full of Bells', 'Трюм, полный колоколов'],
      b: [
        'One captured hull is full of goad-bells, packed in straw. Ilse will not have them sunk, for the beasts would still hear them. There is a shrine on {isle} where, she says, such things were once unmade.',
        'Один захваченный корабль набит колоколами-погонщиками, переложенными соломой. Ильзе не даёт их топить: звери будут слышать их и со дна. На острове {isle} есть святилище, где, по её словам, такие вещи когда-то обращали в ничто.',
      ],
      d: [
        'In the shrine’s basin of sweet water each bell gives one last note and goes quiet for good.',
        'В чаше святилища с пресной водой каждый колокол издаёт последнюю ноту и замолкает навсегда.',
      ],
      s: ['land:shrine', 'hub'],
    },
    {
      t: ['The Whaler’s Echo', 'Эхо китобоя'],
      b: [
        'A whaler sails out of the dark with her try-pots smoking, a hundred years after she went missing hunting the oldest of the leviathans. Her echo still chases it. Board her: Ilse wants her harpooner’s logbook.',
        'Из темноты выходит китобой с дымящимися салотопками — через сто лет после того, как он пропал, охотясь на древнейшего из левиафанов. Его эхо всё ещё гонится за ним. Возьмите его на абордаж: Ильзе нужен журнал его гарпунщика.',
      ],
      d: [
        'The harpooner’s last entry: “It looked at us. We put up the irons. We are not hunters any more.”',
        'Последняя запись гарпунщика: «Оно посмотрело на нас. Мы убрали гарпуны. Мы больше не охотники».',
      ],
      s: ['sink:3:ghost', 'board'],
    },
    {
      t: ['Irons on the Bottom', 'Гарпуны на дне'],
      b: [
        'The whaler’s log names the place where she put up her irons: in the lee of {isle}. Ilse believes the harpoons were thrown overboard there, and that the oldest one remembers where. Send divers down.',
        'Журнал китобоя называет место, где убрали гарпуны: с подветренной стороны острова {isle}. Ильзе верит, что гарпуны выбросили там за борт и что древнейший помнит это место. Спустите водолазов.',
      ],
      d: [
        'Forty irons lie in a ring on the sand, all pointing outward, like a vow laid down.',
        'Сорок гарпунов лежат кругом на песке, все остриями наружу, будто положенный обет.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['The Island That Breathes', 'Остров, который дышит'],
      b: [
        'The fishers say {isle} rises a hand’s breadth every hour and sinks again, and there is warm wind from its caves. Ilse thinks one of the old ones sleeps beneath it. Land a party, and walk softly.',
        'Рыбаки говорят, что остров {isle} каждый час поднимается на ладонь и опускается вновь, а из его пещер тянет тёплым ветром. Ильзе думает, что под ним спит один из древних. Высадите отряд, и ступайте тихо.',
      ],
      d: [
        'The island breathes. Your landing party comes back whispering, though no one told them to.',
        'Остров дышит. Ваш десант возвращается шёпотом, хотя никто им этого не приказывал.',
      ],
      s: ['land', 'hub'],
    },
    {
      t: ['The Salt Caves', 'Соляные пещеры'],
      b: [
        'In the salt caves of {isle} live creatures that feed on what the leviathans shed, and they have grown bold and many. Ilse needs to go in to listen. Clear the way for her.',
        'В соляных пещерах острова {isle} живут твари, которые кормятся тем, что сбрасывают левиафаны, и они расплодились и обнаглели. Ильзе нужно пройти внутрь и послушать. Расчистите ей дорогу.',
      ],
      d: [
        'Deep in the caves the salt walls carry the song like a speaking tube. Ilse sits down on the floor and starts to write.',
        'В глубине пещер соляные стены проводят песню, как переговорная труба. Ильзе садится на пол и начинает писать.',
      ],
      s: ['land', 'lair'],
    },
    {
      t: ['Deaf Crews', 'Оглохшие команды'],
      b: [
        'The song is beautiful and it is too loud: half the crews in {hub} have gone deaf in one ear, and some hear nothing but the song even ashore. Bring medicine for the surgeons before they are deaf as well.',
        'Песня прекрасна, но слишком громка: половина команд в порту {hub} оглохла на одно ухо, а некоторые даже на берегу не слышат ничего, кроме песни. Привезите лекарства для лекарей, пока они сами не оглохли.',
      ],
      d: [
        'Drops of oil, wax for the ears and long sleep. By morning the sailors are cursing again, which the surgeons call a good sign.',
        'Масляные капли, воск в уши и долгий сон. К утру матросы снова бранятся, и лекари считают это добрым знаком.',
      ],
      s: ['bring:medicine'],
    },
    {
      t: ['Jory Whistles Back', 'Джори насвистывает в ответ'],
      b: [
        'Jory Penn has found he can whistle a note the beasts answer. Ilse is delighted and a little afraid. She asks you to take him out past {isle} and let him try, with the guns run in and no one laughing.',
        'Джори Пенн обнаружил, что умеет насвистывать ноту, на которую отвечают звери. Ильзе в восторге и немного напугана. Она просит вывести его за остров {isle} и дать попробовать — пушки убраны, и никто не смеётся.',
      ],
      d: [
        'Jory whistles, and a hill of black water rises beside the ship and sinks again, gently. He is shaking and grinning like a boy.',
        'Джори свистит, и рядом с кораблём поднимается холм чёрной воды и мягко опускается. Его трясёт, и он ухмыляется, как мальчишка.',
      ],
      s: ['isle', 'escort'],
    },
    {
      t: ['Ore From the Feeding Grounds', 'Руда с кормовых отмелей'],
      b: [
        'Ilse wants dampers for your own ship’s bell, so that nothing aboard answers the Choir’s goads. Only abyssal ore will do, the kind found on the feeding grounds of the leviathans. Bring it to {hub} for the founders.',
        'Ильзе хочет поставить глушители на колокол вашего корабля, чтобы ничто на борту не отзывалось на погонщиков Хора. Годится только абиссальная руда — та, что лежит на кормовых отмелях левиафанов. Привезите её литейщикам в порт {hub}.',
      ],
      d: [
        'The new dampers are dark and heavy as river stones. Your ship’s bell now rings as if from under a blanket.',
        'Новые глушители тёмные и тяжёлые, как речные камни. Корабельный колокол теперь звучит будто из-под одеяла.',
      ],
      s: ['bring:abyssal_ore'],
    },
    {
      t: ['The Widow’s Huntsmen', 'Ловчие Вдовы'],
      b: [
        'The Widow has learned who silenced her goads, and she has sent hunters after you, ships with grey bells at their bows that ring the moment they sight your sails. Turn on them before they can bring the beasts down on you.',
        'Вдова узнала, кто заглушил её погонщиков, и пустила по вашему следу охотников — корабли с серыми колоколами на носу, которые начинают звонить, едва завидят ваши паруса. Развернитесь к ним, пока они не натравили на вас зверей.',
      ],
      d: [
        'The last of her huntsmen goes down with his bell still ringing. Nothing answers it: the beasts have learned your sails, too.',
        'Последний ловчий идёт ко дну, а его колокол всё звонит. Ничто не откликается: звери тоже запомнили ваши паруса.',
      ],
      s: ['sink:4:hunter', 'board'],
    },
    {
      t: ['The Great Migration', 'Великий ход'],
      b: [
        'The leviathans are on the move, all of them, south past {isle} and {isle2}, and Ilse says they have not moved like this in a thousand years. Follow them at a distance and mark the way they go.',
        'Левиафаны пришли в движение, все разом: на юг, мимо островов {isle} и {isle2}, и Ильзе говорит, что так они не ходили тысячу лет. Следуйте за ними на расстоянии и отметьте их путь.',
      ],
      d: [
        'Every one of them is heading for the light in the deep, slowly, the way old men walk to church.',
        'Все они идут к свету в глубине — медленно, как старики идут в церковь.',
      ],
      s: ['isle', 'isle2'],
    },
    {
      t: ['A Calf in Chains', 'Детёныш в цепях'],
      b: [
        'A young leviathan has been caught in a Choir chain off {isle}, an anchor cable with bells wired along it, and it cannot sound. Its mother circles it, and the sea there boils. Send divers down to cut it loose.',
        'У острова {isle} молодой левиафан запутался в цепи Хора — якорном канате с привязанными колоколами — и не может уйти на глубину. Мать кружит вокруг, и море там кипит. Спустите водолазов и освободите его.',
      ],
      d: [
        'The calf slips the last link and dives. The mother rolls once beside your hull, so close you could touch her eye.',
        'Детёныш выскальзывает из последнего звена и уходит вниз. Мать перекатывается у вашего борта так близко, что можно коснуться её глаза.',
      ],
      s: ['isle', 'dive'],
    },
    {
      t: ['Wind Dead, Sea Alive', 'Ветер мёртв, море живо'],
      b: [
        'In the dead calm after the migration, the sea fills with echoes: ships the beasts swallowed rise to follow them south. Ilse begs you to keep the waters clear for the stragglers. Hold them for as long as it takes.',
        'В мёртвом штиле после великого хода море наполняется эхом: корабли, проглоченные зверями, поднимаются и идут за ними на юг. Ильзе умоляет вас очистить воды для отставших. Держитесь, сколько понадобится.',
      ],
      d: [
        'The last straggler passes, an old one, scarred white along its back, and it sings one long phrase as it goes by.',
        'Проходит последний отставший, старый, с белыми шрамами вдоль спины, и, минуя вас, поёт одну длинную фразу.',
      ],
      s: ['escort', 'sink:4:ghost'],
    },
    {
      t: ['The Eldest in Chains', 'Древнейший в цепях'],
      b: [
        'The scarred one was singing of the Eldest: the oldest of them all, chained by the Widow at the edge of the deep so that its song cannot reach the Eye. The chain-ships lie at anchor round it. Take them.',
        'Покрытый шрамами пел о Древнейшем — самом старом из всех: Вдова приковала его на краю глубины, чтобы его песня не дошла до Ока. Корабли, держащие цепи, стоят вокруг на якорях. Захватите их.',
      ],
      d: [
        'Two chains are loose. The Eldest stirs, and a swell runs out from it like a breath across the whole sea.',
        'Две цепи отданы. Древнейший шевелится, и от него по всему морю бежит зыбь, как выдох.',
      ],
      s: ['board:2', 'hub'],
    },
    {
      t: ['A Map in the Song', 'Карта в песне'],
      b: [
        'Ilse has filled three notebooks in the caves and on your deck, and she is sure now: the song is a chart, sung by beasts that remember every reef of the deep. Help her prove it. Chart the islands the song names.',
        'Ильзе исписала три тетради в пещерах и на вашей палубе и теперь уверена: песня — это карта, её поют звери, которые помнят каждый риф глубины. Помогите ей это доказать. Нанесите на карту острова, о которых поётся в песне.',
      ],
      d: [
        'Every island is where the song says it is. Ilse copies the chart fair, three times over, and gives you one.',
        'Каждый остров там, где о нём поётся. Ильзе набело переписывает карту в трёх списках и один отдаёт вам.',
      ],
      s: ['chart', 'hub'],
    },
    {
      t: ['The Voice of the Eldest', 'Голос Древнейшего'],
      b: [
        'The last chain-ships have closed round the Eldest off {isle}, ringing every bell they have to keep it down. Break their ring, take the ships that hold the chains, and let it sing.',
        'Последние корабли с цепями сомкнулись вокруг Древнейшего у острова {isle} и бьют во все колокола, чтобы удержать его внизу. Прорвите их кольцо, захватите корабли с цепями — и дайте ему запеть.',
      ],
      d: [
        'The Eldest rises, vast as an island, and sings, and every lens beyond the Wall flares at once. Ilse is weeping: “It is telling us the way to the Eye.”',
        'Древнейший поднимается, огромный, как остров, и поёт, и все линзы за Стеной разом вспыхивают. Ильзе плачет: «Он показывает нам путь к Оку».',
      ],
      s: ['isle', 'sink:5', 'board:2', 'hub'],
    },
  ],
};
