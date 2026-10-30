// A season card's reward in words and a picture (shared/src/data/seasonpass.ts PassReward): the game's window
// (client/src/ui/seasonpass.ts), the website's card of the pass (webdetail.ts) and the site's page of it read the same
// lines. Pictures are asset ids of the manifest (the game's own art: no new pictures were made for the pass).

import { ARTIFACTS } from './artifacts.ts';
import { cosItem } from './cosmetics.ts';
import { PLATES, TITLES } from './cosmetics.ts';
import { RECRUIT_KINDS } from './shop.ts';
import { UNITS } from './army.ts';
import type { PassReward } from './seasonpass.ts';
import { SHIP_CLASSES } from './ships.ts';
import { levelRange } from './shiplevel.ts';
import { shipName, unitNames } from './webshop.ts';

type Tr = [string, string];

export interface PassLine {
  k: string;
  /** An asset id of the manifest. */
  icon: string;
  name: Tr;
  qty: Tr;
  hint?: Tr;
  /** A milestone's thing (a creature stack, an artifact, a cosmetic of the pass's own, the hull). */
  big?: boolean;
}

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const times = (n: number): Tr => [`×${fmt(n)}`, `×${fmt(n)}`];
const ruN = (n: number, one: string, few: string, many: string) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const hoursTr = (h: number): Tr => (h >= 48 && h % 24 === 0 ? [`${h / 24} d`, `${h / 24} ${ruN(h / 24, 'день', 'дня', 'дней')}`] : [`${fmt(h)} h`, `${fmt(h)} ч`]);
const minsTr = (m: number): Tr => (m >= 60 && m % 60 === 0 ? hoursTr(m / 60) : [`${m} min`, `${m} мин`]);

const RES: Record<string, Tr> = {
  timber: ['Timber', 'Брёвна'], coal: ['Coal and stone', 'Уголь и камень'], tar: ['Pine tar', 'Смола'], iron: ['Iron', 'Железо'], provisions: ['Island provisions', 'Провизия острова'],
};
const COS_KIND: Record<string, Tr> = { title: ['Title', 'Звание'], plate: ['Plate', 'Плашка'], frame: ['Frame', 'Рамка'], emblem: ['Emblem', 'Эмблема'], cloth: ['Flag cloth', 'Полотнище флага'], trail: ['Wake', 'След за кормой'], emote: ['Emote', 'Эмоция'] };
const PAINTED_TRAILS = new Set(['plankton', 'ink', 'frost', 'mist', 'fire', 'gold']);
const PAINTED_CLOTHS = new Set(['black', 'crimson', 'navy', 'ivory', 'ochre', 'forest', 'plum', 'teal', 'ember', 'slate']);

/** A cosmetic's picture: a plate or a frame painted, a title on the plate of its tier, a wake's or a cloth's icon. */
export function cosIcon(key: string): string {
  const [kind, id] = key.split(':');
  if (kind === 'frame' || kind === 'plate' || kind === 'emblem' || kind === 'emote') return `cos.${kind}_${id}`;
  if (kind === 'title') {
    const t = TITLES.find((x) => x.id === id);
    return `cos.plate_${PLATES.find((p) => p.id === ['driftwood', 'bronze', 'silver', 'gold', 'abyss'][Math.max(0, Math.min(4, t?.tier ?? 1))])?.id ?? 'bronze'}`;
  }
  if (kind === 'trail') return PAINTED_TRAILS.has(id) ? `icon.trail_${id}` : 'icon.cos_trails';
  if (kind === 'cloth') return PAINTED_CLOTHS.has(id) ? `icon.cloth_${id}` : 'icon.cos_flags';
  return 'icon.cos_bundle';
}

/** A reward as a line. `silverMin`: silver a minute at her ship's level (the window's); none — said in minutes of the
 *  sea (the site). */
export function passLine(r: PassReward, silverMin?: number): PassLine {
  switch (r.k) {
    case 'silver': {
      if (silverMin !== undefined) {
        const n = Math.max(100, Math.round((silverMin * r.min) / 10) * 10);
        return { k: 'silver', icon: 'icon.coin', name: ['Silver', 'Серебро'], qty: [fmt(n), fmt(n)], hint: [`${r.min} minutes of the sea’s silver at your ship’s level`, `${r.min} мин. морского заработка на уровне вашего корабля`] };
      }
      return { k: 'silver', icon: 'icon.coin', name: ['Silver', 'Серебро'], qty: [`${r.min} min of the sea`, `${r.min} мин. моря`], hint: ['Minutes of the sea’s silver at your ship’s level', 'Минуты морского заработка на уровне вашего корабля'] };
    }
    case 'res': return { k: `res_${r.good}`, icon: `icon.good_${r.good}`, name: RES[r.good], qty: times(r.n), hint: ['Into your island’s yard (silver at its worth with no island).', 'Во двор острова (без острова — серебром по цене).'] };
    case 'speed': return { k: 'speed', icon: 'icon.ui_hourglass', name: ['Speed-ups', 'Ускорения'], qty: minsTr(r.min), hint: ['Into your store: any work on the island or the yard.', 'В запас: на любую стройку острова или верфи.'] };
    case 'map': return { k: 'map', icon: 'icon.map_treasure', name: ['Treasure maps', 'Карты сокровищ'], qty: times(r.n), hint: ['Of your waters’ tier.', 'По силам ваших вод.'] };
    case 'scrolls': return { k: 'scrolls', icon: 'icon.ui_scroll', name: ['Auto-battle scrolls', 'Свитки автобоя'], qty: times(r.n), hint: ['One scroll for one battle fought by «Auto».', 'Один свиток — один бой на «Авто».'] };
    case 'kit': return { k: 'kit', icon: 'icon.sp_mend_hull', name: ['Repair kits', 'Ремкомплекты'], qty: times(r.n), hint: ['Hull, canvas, rudder and guns whole at once.', 'Корпус, паруса, руль и пушки — целы сразу.'] };
    case 'charm': return { k: 'charm', icon: 'icon.item_rabbit_foot', name: ['Lucky charms', 'Талисманы удачи'], qty: times(r.n), hint: ['+1 luck and +15 morale for one boarding.', '+1 к удаче и +15 к духу на один абордаж.'] };
    case 'xp': return { k: 'xp', icon: 'icon.xp', name: ['Elixir of experience', 'Эликсир опыта'], qty: hoursTr(r.hours), hint: ['+50% experience for battles.', '+50% опыта за бои.'] };
    case 'wind': return { k: 'wind', icon: 'icon.sp_fair_wind', name: ['Fair wind', 'Попутный ветер'], qty: hoursTr(r.hours), hint: ['+10% speed on a voyage.', '+10% к скорости в походе.'] };
    case 'prod': return { k: 'prod', icon: 'icon.build_farm', name: ['Harvest season', 'Урожайный сезон'], qty: hoursTr(r.hours), hint: ['+50% from every producer of your island.', '+50% к добыче всех промыслов острова.'] };
    case 'rscroll': return { k: 'rscroll', icon: 'icon.ui_phial', name: ['Scrolls of resurrection', 'Свитки воскрешения'], qty: times(r.n), hint: ['One raises one stack of your fallen.', 'Один поднимает один отряд павших.'] };
    case 'cos': {
      const x = cosItem(r.key);
      const kind = r.key.split(':')[0];
      return { k: `cos_${r.key}`, icon: cosIcon(r.key), name: x?.name ?? [r.key, r.key], qty: COS_KIND[kind] ?? ['', ''], hint: ['Yours for good; other captains see it.', 'Ваше навсегда; его видят другие капитаны.'], big: true };
    }
    case 'units': {
      const d = UNITS[r.u];
      return { k: `units_${r.u}`, icon: `unit.${r.u}`, name: unitNames(r.u), qty: times(r.n), hint: [`Tier ${d?.tier ?? '?'}: a gift’s stack of their own, by letter — they fight and train, but their losses are not made good.`, `Уровень ${d?.tier ?? '?'}: подарочный отряд письмом — сражаются и учатся, но павших не восполнить.`], big: true };
    }
    case 'art': {
      const a = ARTIFACTS[r.id];
      return { k: `art_${r.id}`, icon: `icon.art_${r.id}`, name: a?.name ?? [r.id, r.id], qty: [a?.cls === 'major' ? 'Rare artifact' : 'Artifact', a?.cls === 'major' ? 'Редкий артефакт' : 'Артефакт'], hint: ['Into your locker.', 'В сундук снаряжения.'], big: true };
    }
    case 'ship': {
      const d = SHIP_CLASSES[r.c];
      const lv = levelRange(r.c)[0];
      return { k: `ship_${r.c}`, icon: d.sprite, name: shipName(r.c), qty: [`Ship ⚓${lv}`, `Корабль ⚓${lv}`], hint: [`Rank ${d.tier}, ${d.gunPortsPerSide} guns a side, her own ${d.premium?.beasts?.[0]?.n ?? 0} creatures: sold nowhere else. Into a berth of your port.`, `Ранг ${d.tier}, ${d.gunPortsPerSide} пушек на борт, свои ${d.premium?.beasts?.[0]?.n ?? 0} существ — нигде не продаётся. К причалу вашего порта.`], big: true };
    }
  }
}

/** The line kinds' names (the tests hold the pass's creatures to them: no premium kind is ever a reward). */
export const LINE_KINDS: readonly string[] = [...RECRUIT_KINDS, 'bombardier', 'cutthroat'];
