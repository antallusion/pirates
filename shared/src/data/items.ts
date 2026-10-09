// Gear in slots, as an MMO's (docs/12 P1): items for the ship and for the captain, found at sea, won from bosses,
// bought in ports and made at a forge. Every item has a base (what it is and where it goes), an item level (the
// ship level it is made for, ⚓1–⚓10; a captain's by the captain's level band), a rarity (grey, green, blue, purple,
// orange) that sets how strong its main line is and how many extra lines it carries, and wear. Sets reward wearing
// several pieces of one kind; a legendary carries a gift no other has. Within a ship level the whole of it is worth
// about a fifth of a ship's strength: the ladder of levels (canon D12) stays the ladder.
//
// Ship gear shares the talents' caps (docs/03 §3.3), so it cannot stack past what a keystone allows. Where the yard's
// old fittings fill a slot (plating, sails, rudder, hold, quarters) an item there takes the fitting's place.

import type { ModuleId } from './ships.ts';
import type { Flag, StatKey, StatMods } from './stats.ts';
import { ARTIFACTS, artSeaSource } from './artifacts.ts';
import type { ArtForge } from './artifacts.ts';

export type ShipSlot = 'sails' | 'rigging' | 'plating' | 'rudder' | 'hold' | 'quarters' | 'battery' | 'banner' | 'relic' | 'tackle';
export type CaptainSlot = 'hat' | 'coat' | 'sash' | 'boots' | 'blade' | 'pistols' | 'spyglass' | 'compass' | 'charm' | 'ring';
export type Slot = ShipSlot | CaptainSlot;

export const SHIP_SLOTS: ShipSlot[] = ['sails', 'rigging', 'plating', 'rudder', 'hold', 'quarters', 'battery', 'banner', 'relic', 'tackle'];
export const CAPTAIN_SLOTS: CaptainSlot[] = ['hat', 'coat', 'sash', 'boots', 'blade', 'pistols', 'spyglass', 'compass', 'charm', 'ring'];

export function isShipSlot(s: Slot): s is ShipSlot {
  return (SHIP_SLOTS as string[]).includes(s);
}

/** The ship level at which each of her slots opens. */
export const SLOT_OPENS: Record<ShipSlot, number> = { sails: 1, plating: 1, hold: 1, quarters: 1, battery: 1, tackle: 1, rigging: 2, rudder: 2, banner: 4, relic: 5 };

/** The yard's old fitting an item in this slot takes the place of. */
export const MODULE_OF_SLOT: Partial<Record<ShipSlot, ModuleId>> = { sails: 'sail_plan', plating: 'hull_plating', rudder: 'rudder', hold: 'hold_expansion', quarters: 'crew_quarters' };

export const SLOT_NAMES: Record<Slot, [string, string]> = {
  sails: ['Sails', 'Паруса'], rigging: ['Spars & rigging', 'Рангоут и такелаж'], plating: ['Planking', 'Обшивка'], rudder: ['Rudder', 'Руль'],
  hold: ['Hold', 'Трюм'], quarters: ['Crew deck', 'Кубрик'], battery: ['Gun gear', 'Оснастка батарей'], banner: ['Banner', 'Знамя'],
  relic: ['Relic', 'Реликвия'], tackle: ['Fishing tackle', 'Промысловая снасть'],
  hat: ['Hat', 'Шляпа'], coat: ['Coat', 'Камзол'], sash: ['Sash', 'Перевязь'], boots: ['Boots', 'Сапоги'], blade: ['Blade', 'Клинок'],
  pistols: ['Pistols', 'Пистоли'], spyglass: ['Spyglass', 'Подзорная труба'], compass: ['Compass', 'Компас'], charm: ['Charm', 'Талисман'], ring: ['Ring', 'Перстень'],
};

// ------------------------------------------------------------------------------------------------ rarity

export type Rarity = 0 | 1 | 2 | 3 | 4;
export const RARITY_NAMES: [string, string][] = [['Common', 'Обычный'], ['Fine', 'Добротный'], ['Rare', 'Редкий'], ['Epic', 'Эпический'], ['Legendary', 'Легендарный']];
export const RARITY_COLOR = ['#9d9d9d', '#1eff00', '#0070dd', '#a335ee', '#ff8000'];
export const RARITY_MUL = [1, 1.1, 1.2, 1.3, 1.4];
/** Extra lines by rarity (a legendary's gift is apart from these). */
export const RARITY_AFFIXES = [0, 1, 2, 3, 3];

/** How an item's lines grow with its level: 6% a level. */
export function ilvlScale(ilvl: number): number {
  return 1 + 0.06 * (Math.max(1, Math.min(10, ilvl)) - 1);
}

// ------------------------------------------------------------------------------------------------ the captain's characteristics

export type CapStat = 'leadership' | 'marksmanship' | 'navigation' | 'fencing' | 'luck' | 'trade' | 'craft' | 'nerve';
export const CAP_STATS: CapStat[] = ['leadership', 'marksmanship', 'navigation', 'fencing', 'luck', 'trade', 'craft', 'nerve'];
export const CAP_STAT_NAMES: Record<CapStat, [string, string]> = {
  leadership: ['Leadership', 'Лидерство'], marksmanship: ['Marksmanship', 'Меткость'], navigation: ['Navigation', 'Навигация'], fencing: ['Fencing', 'Фехтование'],
  luck: ['Luck', 'Удача'], trade: ['Trade', 'Торговля'], craft: ['Fishing craft', 'Промысел'], nerve: ['Nerve', 'Хладнокровие'],
};

/** What one point of each characteristic does to the ship and her crew. */
export const CAP_STAT_MODS: Record<CapStat, StatMods> = {
  leadership: { moraleRegen: 0.01, boardingPower: 0.005, moraleLoss: -0.004 },
  marksmanship: { spreadMul: -0.004, gunDamageMul: 0.002 },
  navigation: { maxSpeed: 0.002, turnRate: 0.003 },
  fencing: { meleeDamage: 0.006 },
  luck: { treasureHunter: 0.01, salvage: 0.01 },
  trade: { buyMul: -0.002, sellMul: 0.002 },
  craft: {},
  nerve: { sanityLoss: -0.01, moraleLoss: -0.004 },
};

// ------------------------------------------------------------------------------------------------ extra lines (affixes)

export type AffixId =
  | 'hull' | 'armor' | 'speed' | 'turn' | 'reload' | 'damage' | 'range' | 'spread' | 'crew' | 'hold' | 'sails' | 'boarding' | 'sight' | 'repair'
  | 'fire' | 'leak' | 'stealth'
  | CapStat;

export interface AffixDef {
  /** A ship line: the stat and its value at item level 1, common. */
  stat?: StatKey;
  v: number;
  /** A captain's characteristic instead: points at item level 1, common. */
  cap?: CapStat;
  name: [string, string];
}

export const AFFIXES: Record<AffixId, AffixDef> = {
  hull: { stat: 'hullMax', v: 0.03, name: ['Hull', 'Корпус'] },
  armor: { stat: 'armor', v: 0.01, name: ['Armour', 'Броня'] },
  speed: { stat: 'maxSpeed', v: 0.015, name: ['Speed', 'Ход'] },
  turn: { stat: 'turnRate', v: 0.02, name: ['Turning', 'Поворот'] },
  reload: { stat: 'reloadMul', v: -0.02, name: ['Reload', 'Перезарядка'] },
  damage: { stat: 'gunDamageMul', v: 0.02, name: ['Gun damage', 'Урон орудий'] },
  range: { stat: 'rangeMul', v: 0.025, name: ['Range', 'Дальность'] },
  spread: { stat: 'spreadMul', v: -0.03, name: ['Spread', 'Разброс'] },
  crew: { stat: 'crewMax', v: 0.03, name: ['Crew', 'Экипаж'] },
  hold: { stat: 'holdVolume', v: 0.04, name: ['Hold', 'Трюм'] },
  sails: { stat: 'sailHpMax', v: 0.04, name: ['Sail strength', 'Прочность парусов'] },
  boarding: { stat: 'boardingPower', v: 0.03, name: ['Boarding', 'Абордаж'] },
  sight: { stat: 'detection', v: 0.03, name: ['Sight', 'Обзор'] },
  repair: { stat: 'repairRate', v: 0.05, name: ['Repairs', 'Ремонт'] },
  fire: { stat: 'fireRisk', v: -0.08, name: ['Fire risk', 'Риск пожара'] },
  leak: { stat: 'leakInflow', v: -0.06, name: ['Leaks', 'Течи'] },
  stealth: { stat: 'signature', v: -0.03, name: ['Signature', 'Заметность'] },
  leadership: { cap: 'leadership', v: 2, name: CAP_STAT_NAMES.leadership },
  marksmanship: { cap: 'marksmanship', v: 2, name: CAP_STAT_NAMES.marksmanship },
  navigation: { cap: 'navigation', v: 2, name: CAP_STAT_NAMES.navigation },
  fencing: { cap: 'fencing', v: 2, name: CAP_STAT_NAMES.fencing },
  luck: { cap: 'luck', v: 2, name: CAP_STAT_NAMES.luck },
  trade: { cap: 'trade', v: 2, name: CAP_STAT_NAMES.trade },
  craft: { cap: 'craft', v: 2, name: CAP_STAT_NAMES.craft },
  nerve: { cap: 'nerve', v: 2, name: CAP_STAT_NAMES.nerve },
};

const SHIP_AFFIXES: AffixId[] = ['hull', 'armor', 'speed', 'turn', 'reload', 'damage', 'range', 'spread', 'crew', 'hold', 'sails', 'boarding', 'sight', 'repair', 'fire', 'leak', 'stealth'];
const CAPTAIN_AFFIXES: AffixId[] = [...CAP_STATS.filter((c) => c !== 'craft'), 'sight', 'boarding', 'reload', 'spread'];

// ------------------------------------------------------------------------------------------------ bases

export type ItemBaseId = string;

export interface ItemBase {
  id: ItemBaseId;
  slot: Slot;
  name: [string, string];
  /** The main line: stats at item level 1, common (scaled by level and rarity). */
  main?: StatMods;
  /** Characteristics at item level 1, common (scaled likewise). */
  cap?: Partial<Record<CapStat, number>>;
  /** The price of the thing, never scaled: plating is heavy, silk tears. */
  cost?: StatMods;
  /** An icon id in the art manifest (item.<id>), else the slot's. */
  icon?: string;
  /** Sold by port chandlers (common and fine). */
  sold?: boolean;
}

const B = (id: string, slot: Slot, en: string, ru: string, rest: Omit<ItemBase, 'id' | 'slot' | 'name'> = {}): ItemBase => ({ id, slot, name: [en, ru], ...rest });

export const ITEM_BASES: Record<ItemBaseId, ItemBase> = Object.fromEntries([
  // Ship.
  B('canvas_sails', 'sails', 'Canvas Sails', 'Холщовые паруса', { main: { maxSpeed: 0.04, sailHpMax: 0.08 }, sold: true }),
  B('silk_sails', 'sails', 'Silk Topsails', 'Шёлковые марсели', { main: { maxSpeed: 0.06 }, cost: { sailHpMax: -0.06 } }),
  B('storm_sails', 'sails', 'Storm Canvas', 'Штормовые паруса', { main: { sailHpMax: 0.14, stormSailDamage: -0.2 } }),
  B('hemp_rigging', 'rigging', 'Hemp Rigging', 'Пеньковый такелаж', { main: { turnRate: 0.05, sailChangeRate: 0.08 }, sold: true }),
  B('iron_rigging', 'rigging', 'Iron-Bound Spars', 'Окованный рангоут', { main: { sailHpMax: 0.1, stormSailDamage: -0.1 } }),
  B('swift_rigging', 'rigging', 'Racing Rig', 'Гоночный такелаж', { main: { accel: 0.08, sailChangeRate: 0.15 } }),
  B('oak_plating', 'plating', 'Black Oak Planking', 'Обшивка из чёрного дуба', { main: { hullMax: 0.1, armor: 0.03 }, cost: { maxSpeed: -0.02 }, sold: true }),
  B('copper_sheathing', 'plating', 'Copper Sheathing', 'Медная обшивка', { main: { maxSpeed: 0.03, leakInflow: -0.15 } }),
  B('iron_belt', 'plating', 'Iron Belt', 'Железный пояс', { main: { armor: 0.05, hullMax: 0.06 }, cost: { maxSpeed: -0.03 } }),
  B('balanced_rudder', 'rudder', 'Balanced Rudder', 'Уравновешенный руль', { main: { turnRate: 0.08 }, sold: true }),
  B('iron_rudder', 'rudder', 'Iron-Shod Rudder', 'Окованный руль', { main: { turnRate: 0.04, damageControl: 0.1 } }),
  B('deep_hold', 'hold', 'Deep Hold', 'Глубокий трюм', { main: { holdVolume: 0.12 }, cost: { maxSpeed: -0.01 }, sold: true }),
  B('ice_hold', 'hold', 'Ice Hold', 'Ледник', { main: { holdVolume: 0.06, spoilage: -0.4 } }),
  B('false_hold', 'hold', 'False Bottom', 'Двойное дно', { main: { holdVolume: 0.05, hiddenSearch: -0.15 } }),
  B('hammocks', 'quarters', 'Hammock Deck', 'Гамаки в два яруса', { main: { crewMax: 0.12 }, sold: true }),
  B('drill_deck', 'quarters', 'Drill Deck', 'Учебная палуба', { main: { crewMax: 0.06, moraleRegen: 0.1 } }),
  B('marines_berth', 'quarters', 'Marines’ Berth', 'Кубрик морской пехоты', { main: { crewMax: 0.06, boardingPower: 0.06 } }),
  B('aiming_wedges', 'battery', 'Aiming Quoins', 'Прицельные клинья', { main: { spreadMul: -0.08 }, sold: true }),
  B('powder_cartridges', 'battery', 'Flannel Cartridges', 'Фланелевые картузы', { main: { reloadMul: -0.05 } }),
  B('long_barrels', 'battery', 'Lengthened Bores', 'Удлинённые стволы', { main: { rangeMul: 0.06 } }),
  B('double_charge', 'battery', 'Double Charges', 'Двойной заряд', { main: { gunDamageMul: 0.05 }, cost: { reloadMul: 0.03 } }),
  B('crown_ensign', 'banner', 'Crown Ensign', 'Флаг Короны', { main: { moraleRegen: 0.15, moraleLoss: -0.05 } }),
  B('black_flag', 'banner', 'Black Flag', 'Чёрный флаг', { main: { grapeMorale: 0.6, crewKillMul: 0.03 } }),
  B('league_pennant', 'banner', 'League Pennant', 'Вымпел Лиги', { main: { sellMul: 0.02, dutyMul: -0.05 } }),
  B('storm_glass', 'relic', 'Storm Glass', 'Штормовое стекло', { main: { stormHull: -0.2, stormSailDamage: -0.15 } }),
  B('saint_bone', 'relic', 'Saint’s Knucklebone', 'Мощи святого', { main: { sanityLoss: -0.2, moraleRegen: 0.05 } }),
  B('drowned_compass', 'relic', 'Drowned Man’s Lodestone', 'Магнит утопленника', { main: { detection: 0.08 } }),
  B('drift_net', 'tackle', 'Drift Net', 'Дрифтерная сеть', { cap: { craft: 3 }, sold: true }),
  B('trolling_rods', 'tackle', 'Trolling Rods', 'Троллинговые удилища', { cap: { craft: 3 } }),
  B('crab_traps', 'tackle', 'Crab Pots', 'Ловушки для крабов', { cap: { craft: 3 } }),
  B('squid_lamp', 'tackle', 'Squid Lamp', 'Фонарь для кальмаров', { cap: { craft: 3 } }),
  // Ship, the wider chandlery (owner, 2026-10-03): each piece does one thing no other piece of its slot does.
  B('lateen_sails', 'sails', 'Lateen Canvas', 'Латинские паруса', { main: { noGoDeg: -2 }, cost: { maxSpeed: -0.01 } }),
  B('black_sails', 'sails', 'Black Sails', 'Чёрные паруса', { main: { signature: -0.04, nightSpeed: 0.03 }, cost: { sailHpMax: -0.04 } }),
  B('studding_sails', 'sails', 'Studding Sails', 'Лисели', { main: { polarBoost: 0.08 }, sold: true }),
  B('quick_braces', 'rigging', 'Running Braces', 'Ходовые брасы', { main: { evasion: 0.03 } }),
  B('spare_spars', 'rigging', 'Spare Spars', 'Запасной рангоут', { main: { repairRate: 0.12 }, sold: true }),
  B('fighting_tops', 'rigging', 'Fighting Tops', 'Боевые марсы', { main: { crewKillMul: 0.06 } }),
  B('double_planking', 'plating', 'Doubled Planking', 'Двойная обшивка', { main: { planking: 0.02 }, cost: { maxSpeed: -0.01 } }),
  B('felt_lining', 'plating', 'Tarred Felt Lining', 'Просмолённый войлок', { main: { fireRisk: -0.15, leakInflow: -0.05 }, sold: true }),
  B('iron_stem', 'plating', 'Iron-Shod Stem', 'Окованный форштевень', { main: { ramDealt: 0.12, ramTaken: -0.08 } }),
  B('ship_wheel', 'rudder', 'Ship’s Wheel', 'Штурвал', { main: { turnDrag: -0.15, turnRate: 0.02 }, sold: true }),
  B('shoal_rudder', 'rudder', 'Lifting Rudder', 'Подъёмный руль', { main: { draftMul: -0.06, reefDamage: -0.2 } }),
  B('bread_room', 'hold', 'Bread Room', 'Хлебная кладовая', { main: { storesVolume: -0.15, provisionUse: -0.03 }, sold: true }),
  B('timber_racks', 'hold', 'Timber Racks', 'Стеллажи для леса', { main: { materialVolume: -0.15, materialUse: -0.05 } }),
  B('smugglers_nook', 'hold', 'Smuggler’s Lockers', 'Рундуки контрабандиста', { main: { contrabandVolumeMul: -0.12 } }),
  B('sick_bay', 'quarters', 'Sick Berth', 'Лазарет', { main: { surgeon: 0.05 }, sold: true }),
  B('armoury', 'quarters', 'Arms Room', 'Оружейная', { main: { meleeDamage: 0.06 } }),
  B('splinter_screens', 'quarters', 'Splinter Screens', 'Противоосколочные щиты', { main: { hardenedCrew: -0.06 } }),
  B('gun_tackle', 'battery', 'Train Tackles', 'Тали наводки', { main: { gunTrain: 2 }, sold: true }),
  B('grape_bags', 'battery', 'Canister Bags', 'Картечные мешки', { main: { grapeCrew: 0.1 } }),
  B('chain_lockers', 'battery', 'Chain-Shot Lockers', 'Рундуки книппелей', { main: { chainSail: 0.08, chainRange: 0.05 } }),
  B('gunlocks', 'battery', 'Flintlock Gunlocks', 'Кремнёвые замки', { main: { shotSpeed: 0.06 } }),
  B('signal_hoist', 'banner', 'Signal Hoist', 'Сигнальный фал', { main: { cooldownMul: -0.05 } }),
  B('grey_pennant', 'banner', 'Brokers’ Grey Pennant', 'Серый вымпел Брокеров', { main: { openSearch: -0.08, hiddenSearch: -0.2 } }),
  B('hand_of_glory', 'relic', 'Hand of Glory', 'Рука славы', { main: { treasureHunter: 0.15 } }),
  B('bottled_wind', 'relic', 'Wind in a Bottle', 'Ветер в бутылке', { main: { runningFreeAccel: 0.12 } }),
  B('coffin_nail', 'relic', 'Coffin Nail', 'Гвоздь из гроба', { main: { salvage: 0.15 } }),
  // Captain.
  B('tricorne', 'hat', 'Tricorne', 'Треуголка', { cap: { leadership: 4 }, sold: true }),
  B('admiral_hat', 'hat', 'Admiral’s Bicorne', 'Адмиральская двууголка', { cap: { leadership: 3, nerve: 2 } }),
  B('bandana', 'hat', 'Boarder’s Bandana', 'Бандана абордажника', { cap: { fencing: 4 } }),
  B('longcoat', 'coat', 'Longcoat', 'Длиннополый камзол', { cap: { nerve: 4 }, sold: true }),
  B('oilskin', 'coat', 'Whaler’s Oilskin', 'Промасленный плащ китобоя', { cap: { nerve: 3, craft: 2 } }),
  B('uniform', 'coat', 'Navy Uniform', 'Флотский мундир', { cap: { leadership: 3, marksmanship: 2 } }),
  B('baldric', 'sash', 'Baldric', 'Портупея', { cap: { fencing: 4 }, sold: true }),
  B('cartridge_belt', 'sash', 'Cartridge Belt', 'Патронташ', { cap: { marksmanship: 4 } }),
  B('seaboots', 'boots', 'Sea Boots', 'Морские сапоги', { cap: { navigation: 4 }, sold: true }),
  B('pilot_boots', 'boots', 'Pilot’s Boots', 'Ботфорты лоцмана', { cap: { navigation: 3, luck: 2 } }),
  B('cutlass', 'blade', 'Cutlass', 'Абордажная сабля', { cap: { fencing: 4 }, sold: true }),
  B('rapier', 'blade', 'Rapier', 'Рапира', { cap: { fencing: 3, luck: 2 } }),
  B('boarding_axe', 'blade', 'Boarding Axe', 'Абордажный топор', { cap: { fencing: 3 }, main: { boardingPower: 0.03 } }),
  B('duelling_pistols', 'pistols', 'Duelling Pistols', 'Дуэльные пистоли', { cap: { marksmanship: 4 }, sold: true }),
  B('blunderbuss', 'pistols', 'Blunderbuss', 'Мушкетон', { cap: { fencing: 2 }, main: { crewKillMul: 0.05 } }),
  B('brass_glass', 'spyglass', 'Brass Spyglass', 'Латунная подзорная труба', { cap: { marksmanship: 2 }, main: { detection: 0.04 }, sold: true }),
  B('night_glass', 'spyglass', 'Night Glass', 'Ночная труба', { main: { detection: 0.03, nightSpeed: 0.03 }, cap: { navigation: 2 } }),
  B('brass_compass', 'compass', 'Brass Compass', 'Латунный компас', { cap: { navigation: 4 }, sold: true }),
  B('dead_compass', 'compass', 'Dead Man’s Compass', 'Компас мертвеца', { cap: { luck: 4 } }),
  B('orca_tooth', 'charm', 'Orca Tooth', 'Зуб касатки', { cap: { luck: 3, nerve: 1 } }),
  B('saint_medal', 'charm', 'Saint’s Medal', 'Медальон святого', { cap: { nerve: 4 }, sold: true }),
  B('rabbit_foot', 'charm', 'Rabbit’s Foot', 'Кроличья лапка', { cap: { luck: 4 } }),
  B('league_ring', 'ring', 'League Signet', 'Перстень Лиги', { cap: { trade: 4 }, sold: true }),
  B('signet', 'ring', 'Captain’s Signet', 'Капитанская печатка', { cap: { leadership: 4 } }),
  B('skull_ring', 'ring', 'Skull Ring', 'Кольцо с черепом', { cap: { fencing: 2, nerve: 2 } }),
  // Captain, the wider chandlery: pairings of the characteristics no piece had yet, or a small line of the ship's.
  B('merchant_hat', 'hat', 'Beaver Hat', 'Бобровая шляпа', { cap: { trade: 3, leadership: 2 }, sold: true }),
  B('gunner_cap', 'hat', 'Gunner’s Leather Cap', 'Кожаная шапка канонира', { cap: { marksmanship: 3, nerve: 2 } }),
  B('buff_coat', 'coat', 'Buff Coat', 'Колет из буйволовой кожи', { cap: { fencing: 3, marksmanship: 2 }, sold: true }),
  B('smugglers_cloak', 'coat', 'Smuggler’s Cloak', 'Плащ контрабандиста', { cap: { luck: 2 }, main: { signature: -0.03 } }),
  B('powder_horn', 'sash', 'Powder Horn', 'Пороховой рог', { cap: { marksmanship: 3 }, main: { reloadMul: -0.02 }, sold: true }),
  B('buccaneer_boots', 'boots', 'Buccaneer’s Boots', 'Сапоги буканьера', { cap: { fencing: 2, navigation: 2 }, sold: true }),
  B('boarding_pike', 'blade', 'Boarding Pike', 'Абордажная пика', { cap: { fencing: 2 }, main: { boardingRange: 0.05 } }),
  B('officer_sabre', 'blade', 'Officer’s Sabre', 'Офицерская сабля', { cap: { fencing: 3, leadership: 2 }, sold: true }),
  B('pepperbox', 'pistols', 'Pepperbox', 'Перечница', { cap: { marksmanship: 3 }, main: { meleeDamage: 0.03 } }),
  B('ranging_glass', 'spyglass', 'Ranging Glass', 'Дальномерная труба', { cap: { marksmanship: 1 }, main: { rangeMul: 0.03 } }),
  B('sun_stone', 'compass', 'Sunstone', 'Солнечный камень', { cap: { navigation: 2 }, main: { fogSight: 0.1 } }),
  B('lucky_doubloon', 'charm', 'Lucky Doubloon', 'Счастливый дублон', { cap: { luck: 3, trade: 2 }, sold: true }),
  B('witch_bottle', 'charm', 'Witch Bottle', 'Ведьмина бутыль', { cap: { nerve: 2 }, main: { sanityLoss: -0.08 } }),
  B('gold_hoop', 'ring', 'Gold Earring', 'Золотая серьга', { cap: { luck: 2, marksmanship: 2 } }),
].map((b) => [b.id, b]));

export const BASES_BY_SLOT: Record<Slot, ItemBase[]> = Object.fromEntries([...SHIP_SLOTS, ...CAPTAIN_SLOTS].map((s) => [s, Object.values(ITEM_BASES).filter((b) => b.slot === s)])) as Record<Slot, ItemBase[]>;

// ------------------------------------------------------------------------------------------------ sets

export type SetId = 'bounty_hunter' | 'whaler' | 'fisher' | 'league' | 'sea_terror' | 'admiralty' | 'drowned' | 'storm' | 'master_gunner' | 'smuggler';

export interface SetDef {
  id: SetId;
  name: [string, string];
  /** Its pieces: slot → the piece's name. */
  pieces: Partial<Record<Slot, [string, string]>>;
  /** Bonuses at 2, 4 and 6 pieces. */
  bonus: { n: number; mods: StatMods; flags?: Flag[]; text: [string, string] }[];
}

export const SETS: Record<SetId, SetDef> = {
  bounty_hunter: {
    id: 'bounty_hunter', name: ['The Bounty Hunter', 'Охотник за головами'],
    pieces: { hat: ['Hunter’s Tricorne', 'Треуголка охотника'], coat: ['Hunter’s Greatcoat', 'Шинель охотника'], pistols: ['Warrant Pistols', 'Пистоли по ордеру'], spyglass: ['Tracker’s Glass', 'Труба следопыта'], battery: ['Chase Guns’ Gear', 'Оснастка погонных'], banner: ['Writ Pennant', 'Вымпел ордера'] },
    bonus: [
      { n: 2, mods: { detection: 0.05 }, text: ['+5% sight', '+5% к обзору'] },
      { n: 4, mods: { gunDamageMul: 0.04, chaserDamage: 0.15 }, text: ['+4% gun damage, chasers +15%', '+4% к урону орудий, погонные +15%'] },
      { n: 6, mods: { maxSpeed: 0.03 }, flags: ['spotter'], text: ['+3% speed; your spotter marks the quarry', '+3% к ходу; наводчик отмечает добычу'] },
    ],
  },
  whaler: {
    id: 'whaler', name: ['The Whaler', 'Китобой'],
    pieces: { coat: ['Whaler’s Oilskin', 'Плащ китобоя'], boots: ['Flensing Boots', 'Сапоги разделчика'], blade: ['Flensing Knife', 'Нож разделчика'], rigging: ['Line Winch Rigging', 'Такелаж с лебёдкой'], hold: ['Try-Works Hold', 'Трюм с салотопкой'], charm: ['Scrimshaw Charm', 'Резной амулет из кости'] },
    bonus: [
      { n: 2, mods: { sailHpMax: 0.05 }, text: ['+5% sail strength', '+5% к прочности парусов'] },
      { n: 4, mods: { holdVolume: 0.06 }, flags: ['fh_harpooneer'], text: ['+6% hold; the harpooneer’s eye against the deep', '+6% к трюму; глаз гарпунщика против тварей глубин'] },
      { n: 6, mods: { stormHull: -0.2 }, flags: ['leviathan_lore'], text: ['Storms bite less; the lore of the leviathan', 'Шторм бьёт слабее; знание левиафанов'] },
    ],
  },
  fisher: {
    id: 'fisher', name: ['The Fisherfolk', 'Рыбак-артельщик'],
    pieces: { hat: ['Sou’wester', 'Зюйдвестка'], coat: ['Fisherman’s Smock', 'Рыбацкая роба'], boots: ['Wading Boots', 'Бродни'], tackle: ['Guild Net', 'Артельная сеть'], hold: ['Salting Hold', 'Засолочный трюм'], charm: ['Lucky Float', 'Счастливый поплавок'] },
    bonus: [
      { n: 2, mods: { provisionUse: -0.1 }, text: ['Provisions last 10% longer', 'Провизия уходит на 10% медленнее'] },
      { n: 4, mods: { spoilage: -0.3 }, text: ['Catch spoils 30% slower', 'Улов портится на 30% медленнее'] },
      { n: 6, mods: { moraleRegen: 0.1 }, flags: ['well_fed'], text: ['A well-fed crew', 'Сытая команда'] },
    ],
  },
  league: {
    id: 'league', name: ['The League Factor', 'Купец Лиги'],
    pieces: { hat: ['Factor’s Hat', 'Шляпа фактора'], coat: ['Ledger Coat', 'Камзол счетовода'], ring: ['Gilded Signet', 'Позолоченная печатка'], hold: ['Bonded Hold', 'Опечатанный трюм'], banner: ['League Colours', 'Цвета Лиги'], compass: ['Route Compass', 'Компас торговых путей'] },
    bonus: [
      { n: 2, mods: { dutyMul: -0.1 }, text: ['Duties −10%', 'Пошлины −10%'] },
      { n: 4, mods: { sellMul: 0.03, buyMul: -0.02 }, text: ['Sell 3% dearer, buy 2% cheaper', 'Продажа на 3% дороже, покупка на 2% дешевле'] },
      { n: 6, mods: { holdVolume: 0.08 }, flags: ['convoy_rights'], text: ['+8% hold; the League’s convoy rights', '+8% к трюму; право на конвой Лиги'] },
    ],
  },
  sea_terror: {
    id: 'sea_terror', name: ['The Terror of the Seas', 'Гроза морей'],
    pieces: { hat: ['Terror’s Feathered Hat', 'Шляпа с пером грозы'], blade: ['Red Cutlass', 'Красная сабля'], sash: ['Brace of Pistols', 'Перевязь с пистолями'], banner: ['Jolly Roger', 'Весёлый Роджер'], quarters: ['Cutthroat Deck', 'Палуба головорезов'], ring: ['Plunder Ring', 'Перстень с добычи'] },
    bonus: [
      { n: 2, mods: { grapeMorale: 0.5 }, text: ['Grape costs their crew more nerve', 'Картечь сильнее бьёт по духу врага'] },
      { n: 4, mods: { boardingPower: 0.08 }, flags: ['first_over_rail'], text: ['+8% boarding; first over the rail', '+8% к абордажу; первым через борт'] },
      { n: 6, mods: { meleeDamage: 0.1 }, flags: ['terror'], text: ['+10% in the melee; Terror', '+10% в рукопашной; Ужас'] },
    ],
  },
  admiralty: {
    id: 'admiralty', name: ['The Admiralty', 'Адмиралтейство'],
    pieces: { hat: ['Admiral’s Bicorne', 'Двууголка адмирала'], coat: ['Dress Uniform', 'Парадный мундир'], sash: ['Admiralty Sash', 'Лента Адмиралтейства'], battery: ['Regulation Gun Gear', 'Уставная оснастка орудий'], plating: ['Navy Planking', 'Флотская обшивка'], banner: ['Admiral’s Flag', 'Адмиральский флаг'] },
    bonus: [
      { n: 2, mods: { reloadMul: -0.03 }, text: ['Reload −3%', 'Перезарядка −3%'] },
      { n: 4, mods: { hullMax: 0.05, moraleRegen: 0.1 }, text: ['+5% hull, steadier crew', '+5% к корпусу, команда стойче'] },
      { n: 6, mods: { gunDamageMul: 0.04 }, flags: ['line_of_battle'], text: ['+4% gun damage; the line of battle', '+4% к урону орудий; линия баталии'] },
    ],
  },
  drowned: {
    id: 'drowned', name: ['The Drowned', 'Утопленник'],
    pieces: { coat: ['Waterlogged Coat', 'Набухший камзол'], charm: ['Drowned Medallion', 'Медальон утопленника'], relic: ['Bell from the Deep', 'Колокол из глубины'], sails: ['Grey Sails', 'Серые паруса'], compass: ['Needle of the Dead', 'Стрелка мёртвых'], ring: ['Ring of Brine', 'Кольцо рассола'] },
    bonus: [
      { n: 2, mods: { sanityLoss: -0.25 }, text: ['Sanity drains 25% slower', 'Рассудок тает на 25% медленнее'] },
      { n: 4, mods: { signature: -0.08 }, flags: ['fog_born'], text: ['Harder to see; born of the fog', 'Её труднее заметить; рождена туманом'] },
      { n: 6, mods: { incomingDamageMul: -0.05 }, flags: ['eyes_of_choir'], text: ['−5% damage taken; the eyes of the Choir', '−5% входящего урона; глаза Хора'] },
    ],
  },
  storm: {
    id: 'storm', name: ['The Storm-Chaser', 'Штормовой'],
    pieces: { sails: ['Stormcloth', 'Штормовое полотно'], rigging: ['Lightning Stays', 'Штаги-громоотводы'], relic: ['Heart of the Storm', 'Сердце шторма'], coat: ['Storm Cloak', 'Штормовой плащ'], boots: ['Deck Grips', 'Палубные сапоги'], spyglass: ['Squall Glass', 'Шквальная труба'] },
    bonus: [
      { n: 2, mods: { stormSailDamage: -0.25 }, text: ['Storms tear 25% less canvas', 'Шторм рвёт на 25% меньше парусов'] },
      { n: 4, mods: { maxSpeed: 0.03 }, flags: ['storm_rider'], text: ['+3% speed; rides the storm', '+3% к ходу; оседлавшая шторм'] },
      { n: 6, mods: { stormHull: -0.3 }, flags: ['lightning_rod'], text: ['Storms bite far less; lightning finds no mast', 'Шторм почти не бьёт; молния не находит мачты'] },
    ],
  },
  master_gunner: {
    id: 'master_gunner', name: ['The Master Gunner', 'Мастер-канонир'],
    pieces: { hat: ['Master Gunner’s Cap', 'Шапка мастер-канонира'], sash: ['Linstock Sash', 'Перевязь с пальником'], pistols: ['Priming Pistols', 'Затравочные пистоли'], spyglass: ['Fall-of-Shot Glass', 'Труба для пристрелки'], battery: ['Master Gunner’s Quoins', 'Клинья мастер-канонира'], plating: ['Gun-Deck Lining', 'Обшивка батарейной палубы'] },
    bonus: [
      { n: 2, mods: { spreadMul: -0.04 }, text: ['Spread −4%', 'Разброс −4%'] },
      { n: 4, mods: { reloadMul: -0.03, shotSpeed: 0.05 }, text: ['Reload −3%; the balls fly 5% faster', 'Перезарядка −3%; ядра летят на 5% быстрее'] },
      { n: 6, mods: { gunDamageMul: 0.03 }, flags: ['skipping_shot'], text: ['+3% gun damage; a ball that falls short skips on into her', '+3% к урону орудий; недолёт рикошетит в борт'] },
    ],
  },
  smuggler: {
    id: 'smuggler', name: ['The Smuggler', 'Контрабандист'],
    pieces: { coat: ['Smuggler’s Greatcoat', 'Шинель контрабандиста'], boots: ['Soft-Soled Boots', 'Сапоги на мягкой подошве'], compass: ['Cove Compass', 'Компас тайных бухт'], hold: ['Hidden Hold', 'Потайной трюм'], sails: ['Moonless Sails', 'Безлунные паруса'], banner: ['False Colours', 'Чужой флаг'] },
    bonus: [
      { n: 2, mods: { hiddenSearch: -0.25 }, text: ['Hidden cargo is found 25% less often', 'Тайник находят на 25% реже'] },
      { n: 4, mods: { signature: -0.06, nightSpeed: 0.03 }, text: ['−6% signature, +3% speed at night', '−6% к заметности, +3% к ходу ночью'] },
      { n: 6, mods: { contrabandVolumeMul: -0.15 }, flags: ['dark_lanterns'], text: ['Contraband packs 15% tighter; at night none sees her past 250 m', 'Контрабанда плотнее на 15%; ночью её не видно дальше 250 м'] },
    ],
  },
};

export const SET_IDS = Object.keys(SETS) as SetId[];

// ------------------------------------------------------------------------------------------------ legendaries

export interface LegendaryDef {
  id: string;
  base: ItemBaseId;
  name: [string, string];
  /** Its gift: what no other item carries. */
  mods: StatMods;
  flags?: Flag[];
  text: [string, string];
}

export const LEGENDARY_ITEMS: Record<string, LegendaryDef> = Object.fromEntries([
  { id: 'north_less_compass', base: 'dead_compass', name: ['The Compass That Points No North', 'Компас, что не показывает на север'], mods: { treasureHunter: 0.25 }, flags: ['lucky_dig'], text: ['It points to what you want most: buried silver, mostly', 'Указывает на то, чего вы хотите больше всего: чаще всего — на зарытое серебро'] },
  { id: 'drowned_admiral_bell', base: 'saint_bone', name: ['Bell of the Drowned Admiral', 'Колокол утопленного адмирала'], mods: { sanityLoss: -0.3 }, flags: ['choir_bell'], text: ['Its toll drowns the Song of the deep for every ship near', 'Его звон заглушает Песнь глубин для всех кораблей рядом'] },
  { id: 'white_orca_tooth', base: 'orca_tooth', name: ['Tooth of the White Orca', 'Зуб Белой касатки'], mods: { incomingDamageMul: -0.03 }, flags: ['leviathan_lore'], text: ['The deep knows who wears it', 'Глубина знает, кто его носит'] },
  { id: 'vane_tricorne', base: 'tricorne', name: ['Edric Vane’s Tricorne', 'Треуголка Эдрика Вейна'], mods: { grapeMorale: 0.5, moraleLoss: -0.1 }, flags: ['fear_and_respect'], text: ['Her own crew fear her more than the enemy', 'Своя команда боится её больше, чем врага'] },
  { id: 'drowned_silk', base: 'silk_sails', name: ['Silk of the Drowned Bride', 'Шёлк утопленницы'], mods: { nightSpeed: 0.06 }, flags: ['drowned_silk'], text: ['Pale sails that never quite dry', 'Бледные паруса, что никогда не высыхают'] },
  { id: 'crown_culverins', base: 'double_charge', name: ['The Crown’s Thunder', 'Гром Короны'], mods: { gunDamageMul: 0.03 }, flags: ['thunder_broadside'], text: ['Every ball home stuns her crew', 'Каждое попадание оглушает её команду'] },
  { id: 'quill_cutlass', base: 'cutlass', name: ['Mara Quill’s Cutlass', 'Сабля Мары Квилл'], mods: { meleeDamage: 0.08 }, flags: ['first_over_rail'], text: ['First over the rail, every time', 'Всегда первой через борт'] },
  { id: 'widow_rod', base: 'storm_glass', name: ['Lightning Rod of the Storm Widow', 'Громоотвод Штормовой Вдовы'], mods: { stormHull: -0.3 }, flags: ['lightning_rod'], text: ['The storm’s fury runs down to the sea', 'Ярость шторма уходит в море'] },
].map((l) => [l.id, l as LegendaryDef]));

// ------------------------------------------------------------------------------------------------ items

export interface AffixRoll {
  a: AffixId;
  v: number;
}

export interface Item {
  uid: number;
  base: ItemBaseId;
  ilvl: number;
  rarity: Rarity;
  affixes: AffixRoll[];
  set?: SetId;
  legendary?: string;
  /** Wear, 0..100: at 0 it does nothing till mended. */
  dur: number;
  /** Bound to its owner (bosses' and quests' gifts): not sold to other captains. */
  bound?: boolean;
  /** Made Excellent at a forge: its main line +50%. */
  excellent?: boolean;
  /** A forge's tempering, +3% to the main line each (0..5). */
  temper?: number;
  /** Who made it. */
  maker?: string;
  /** A hero's artifact (docs/17 H2, shared/src/data/artifacts.ts): its own name, primaries and gifts; it never wears. */
  art?: string;
  /** docs/19 E13: an artifact forged at the island's workshop, and the roll before the last (kept till she chooses). */
  forge?: ArtForge;
  forgeWas?: ArtForge;
}

export function itemSlot(it: Item): Slot {
  return ITEM_BASES[it.base].slot;
}

/** Its name in English (the server's) or Russian. */
export function itemName(it: Item, ru = false): string {
  const k = ru ? 1 : 0;
  if (it.art && ARTIFACTS[it.art]) return ARTIFACTS[it.art].name[k];
  if (it.legendary) return LEGENDARY_ITEMS[it.legendary].name[k];
  if (it.set) return SETS[it.set].pieces[itemSlot(it)]?.[k] ?? ITEM_BASES[it.base].name[k];
  return ITEM_BASES[it.base].name[k];
}

/** How strong its main line is: level, rarity, Excellent work and tempering. */
export function mainScale(it: Item): number {
  return ilvlScale(it.ilvl) * RARITY_MUL[it.rarity] * (it.excellent ? 1.5 : 1) * (1 + 0.03 * (it.temper ?? 0));
}

/** An extra line's value on this item. */
export function affixValue(a: AffixId, ilvl: number, rarity: Rarity): number {
  const v = AFFIXES[a].v * ilvlScale(ilvl) * RARITY_MUL[rarity];
  return AFFIXES[a].cap ? Math.round(v) : Math.round(v * 1000) / 1000;
}

/** Everything an item gives: ship stats, the captain's characteristics and switches (nothing when worn through). */
export function itemEffect(it: Item): { mods: StatMods; cap: Partial<Record<CapStat, number>>; flags: Flag[] } {
  const mods: StatMods = {};
  const cap: Partial<Record<CapStat, number>> = {};
  const flags: Flag[] = [];
  if (it.art) {
    // An artifact's sea lines are its own (its primaries and battle gifts are the hero's: shared/src/data/hero.ts).
    const d = ARTIFACTS[it.art];
    for (const k in d?.mods ?? {}) mods[k as StatKey] = d!.mods![k as StatKey] ?? 0;
    flags.push(...(d?.flags ?? []));
    return { mods, cap, flags };
  }
  if (it.dur <= 0) return { mods, cap, flags };
  const base = ITEM_BASES[it.base];
  const s = mainScale(it);
  const add = (k: StatKey, v: number) => (mods[k] = (mods[k] ?? 0) + v);
  for (const k in base.main ?? {}) add(k as StatKey, (base.main![k as StatKey] ?? 0) * s);
  for (const k in base.cost ?? {}) add(k as StatKey, base.cost![k as StatKey] ?? 0);
  for (const c in base.cap ?? {}) cap[c as CapStat] = (cap[c as CapStat] ?? 0) + Math.round((base.cap![c as CapStat] ?? 0) * s);
  for (const r of it.affixes) {
    const d = AFFIXES[r.a];
    if (d.cap) cap[d.cap] = (cap[d.cap] ?? 0) + r.v;
    else if (d.stat) add(d.stat, r.v);
  }
  if (it.legendary) {
    const l = LEGENDARY_ITEMS[it.legendary];
    for (const k in l.mods) add(k as StatKey, l.mods[k as StatKey] ?? 0);
    flags.push(...(l.flags ?? []));
  }
  return { mods, cap, flags };
}

/** The captain's characteristics turned into ship stats. */
export function capStatMods(cap: Partial<Record<CapStat, number>>): StatMods {
  const out: StatMods = {};
  for (const c in cap) {
    const n = cap[c as CapStat] ?? 0;
    const per = CAP_STAT_MODS[c as CapStat];
    for (const k in per) out[k as StatKey] = (out[k as StatKey] ?? 0) + (per[k as StatKey] ?? 0) * n;
  }
  return out;
}

/** The set bonuses in force for these worn items. */
export function setBonuses(worn: Item[]): { mods: StatMods; flags: Flag[]; active: { set: SetId; n: number }[] } {
  const count = new Map<SetId, number>();
  for (const it of worn) if (it.set && it.dur > 0) count.set(it.set, (count.get(it.set) ?? 0) + 1);
  const mods: StatMods = {};
  const flags: Flag[] = [];
  const active: { set: SetId; n: number }[] = [];
  for (const [set, n] of count) {
    active.push({ set, n });
    for (const b of SETS[set].bonus) {
      if (n < b.n) continue;
      for (const k in b.mods) mods[k as StatKey] = (mods[k as StatKey] ?? 0) + (b.mods[k as StatKey] ?? 0);
      flags.push(...(b.flags ?? []));
    }
  }
  return { mods, flags, active };
}

/** All worn gear as one source for the ship's stats: items, characteristics and sets together. */
export function gearSource(worn: Item[]): { mods: StatMods; flags: Flag[]; cap: Partial<Record<CapStat, number>> } {
  const mods: StatMods = {};
  const flags: Flag[] = [];
  const cap: Partial<Record<CapStat, number>> = {};
  const addMods = (m: StatMods) => { for (const k in m) mods[k as StatKey] = (mods[k as StatKey] ?? 0) + (m[k as StatKey] ?? 0); };
  for (const it of worn) {
    const e = itemEffect(it);
    addMods(e.mods);
    flags.push(...e.flags);
    for (const c in e.cap) cap[c as CapStat] = (cap[c as CapStat] ?? 0) + (e.cap[c as CapStat] ?? 0);
  }
  addMods(capStatMods(cap));
  const sets = setBonuses(worn);
  addMods(sets.mods);
  flags.push(...sets.flags);
  // The hero's artifact sets worn whole (docs/17 H2).
  const arts = artSeaSource(worn);
  addMods(arts.mods);
  flags.push(...arts.flags);
  return { mods, flags, cap };
}

// ------------------------------------------------------------------------------------------------ making and finding

export interface Rng {
  float(): number;
  int(lo: number, hiInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
}

/** Weights of rarity by where an item comes from. */
export const RARITY_WEIGHTS: Record<'shop' | 'common' | 'elite' | 'boss' | 'quest', number[]> = {
  shop: [70, 30, 0, 0, 0],
  common: [50, 32, 14, 3.6, 0.4],
  elite: [0, 20, 55, 22, 3],
  boss: [0, 0, 30, 67, 3],
  quest: [0, 35, 50, 14, 1],
};

export function rollRarity(rng: Rng, source: keyof typeof RARITY_WEIGHTS): Rarity {
  const w = RARITY_WEIGHTS[source];
  let r = rng.float() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i as Rarity;
  }
  return 0;
}

/** A new item: a base (or one for a slot), a level, a rarity; its extra lines, a set piece now and then. */
export function makeItem(rng: Rng, uid: number, opts: { ilvl: number; rarity?: Rarity; source?: keyof typeof RARITY_WEIGHTS; base?: ItemBaseId; slot?: Slot; slots?: Slot[] }): Item {
  const rarity = opts.rarity ?? rollRarity(rng, opts.source ?? 'common');
  const slots = opts.slots ?? [...SHIP_SLOTS.filter((s) => s !== 'tackle'), ...CAPTAIN_SLOTS];
  const base = opts.base ? ITEM_BASES[opts.base] : rng.pick(BASES_BY_SLOT[opts.slot ?? rng.pick(slots)]);
  const ilvl = Math.max(1, Math.min(10, Math.round(opts.ilvl)));
  const it: Item = { uid, base: base.id, ilvl, rarity, affixes: [], dur: 100 };
  // A legendary of this base, if one exists, at a legendary rarity.
  if (rarity === 4) {
    const legs = Object.values(LEGENDARY_ITEMS).filter((l) => l.base === base.id);
    if (legs.length) it.legendary = rng.pick(legs).id;
  }
  // Epic and fine pieces of a set now and then (a set piece takes the set's name).
  if (!it.legendary && rarity >= 2 && rng.float() < (rarity === 3 ? 0.35 : 0.15)) {
    const sets = SET_IDS.filter((s) => SETS[s].pieces[base.slot]);
    if (sets.length) it.set = rng.pick(sets);
  }
  const pool = (isShipSlot(base.slot) ? SHIP_AFFIXES : CAPTAIN_AFFIXES).filter((a) => !(base.main && AFFIXES[a].stat && AFFIXES[a].stat! in base.main) && !(base.cap && AFFIXES[a].cap && AFFIXES[a].cap! in base.cap));
  for (let i = 0; i < RARITY_AFFIXES[rarity] && pool.length; i++) {
    const a = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    it.affixes.push({ a, v: affixValue(a, ilvl, rarity) });
  }
  return it;
}

/** An item's worth to a port chandler (sold for a quarter of it). */
export function itemValue(it: Item): number {
  if (it.art && ARTIFACTS[it.art]) return ARTIFACTS[it.art].price;
  return Math.round(120 * ilvlScale(it.ilvl) * it.ilvl * [1, 2.5, 6, 15, 40][it.rarity]);
}

/** Mending worn gear at a yard or a chandler: silver for each point of wear. */
export function mendCost(it: Item): number {
  return Math.ceil(((100 - it.dur) / 100) * itemValue(it) * 0.15);
}

/** Taken apart at a forge: planks, iron and canvas by its level, a rare material for epics and up. */
export function salvageYield(it: Item): { good: 'planks' | 'iron' | 'sailcloth' | 'leviathan_bone'; qty: number }[] {
  const n = Math.max(1, Math.round(it.ilvl * (1 + it.rarity) * 0.8));
  const out: { good: 'planks' | 'iron' | 'sailcloth' | 'leviathan_bone'; qty: number }[] = [{ good: 'planks', qty: n }, { good: 'iron', qty: Math.ceil(n / 2) }];
  if (itemSlot(it) === 'sails' || itemSlot(it) === 'rigging') out.push({ good: 'sailcloth', qty: Math.ceil(n / 2) });
  if (it.rarity >= 3) out.push({ good: 'leviathan_bone', qty: it.rarity - 2 });
  return out;
}

export const STASH_SIZE = 40;

/** Tempering at a forge: each step +3% to the main line, up to five; dearer every step, and it never breaks a piece. */
export const TEMPER_MAX = 5;
export function temperCost(it: Item): { silver: number; iron: number; planks: number } {
  const t = (it.temper ?? 0) + 1;
  return { silver: Math.round(itemValue(it) * 0.3 * t), iron: it.ilvl * t, planks: Math.ceil((it.ilvl * t) / 2) };
}

/** Reforging one extra line: silver by the piece's worth and rarity. */
export function reforgeCost(it: Item): number {
  return Math.round(itemValue(it) * 0.4 * (1 + it.rarity * 0.5));
}

/** A new line in place of line `i`: any the piece does not already carry, at the piece's level and rarity. */
export function reforgeLine(rng: Rng, it: Item, i: number): AffixRoll | null {
  const base = ITEM_BASES[it.base];
  const have = new Set(it.affixes.map((a) => a.a));
  const pool = (isShipSlot(base.slot) ? SHIP_AFFIXES : CAPTAIN_AFFIXES).filter((a) => !have.has(a) && !(base.main && AFFIXES[a].stat && AFFIXES[a].stat! in base.main) && !(base.cap && AFFIXES[a].cap && AFFIXES[a].cap! in base.cap));
  if (!pool.length || !it.affixes[i]) return null;
  const a = rng.pick(pool);
  return { a, v: affixValue(a, it.ilvl, it.rarity) };
}

/** The item level a captain of this level wears (captains' gear, like ships', runs ⚓1–⚓10). */
export function captainIlvl(captainLevel: number): number {
  return Math.max(1, Math.min(10, Math.ceil(captainLevel / 6)));
}

/** The item names, English → Russian, for the server's lines (loot, forge). */
export function itemNamePatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const b of Object.values(ITEM_BASES)) out.push(b.name);
  for (const s of Object.values(SETS)) for (const p of Object.values(s.pieces)) out.push(p!);
  for (const l of Object.values(LEGENDARY_ITEMS)) out.push(l.name);
  for (const n of Object.values(SLOT_NAMES)) out.push(n);
  return out;
}

/** The server's lines about gear, English → Russian. */
export function gearPatterns(): [string, string][] {
  return [
    ['No such item in your locker', 'Такого предмета в рундуке нет'],
    ['Not in the middle of a fight', 'Не посреди боя'],
    ['The {0} slot opens at ship level {1}', 'Ячейка «{0}» откроется на уровне корабля {1}'],
    ['Made for a ship of level {0}: yours is level {1}', 'Сделано для корабля уровня {0}, а ваш — уровня {1}'],
    ['Made for a captain of level {0} and up', 'Сделано для капитана уровня {0} и выше'],
    ['Nothing worn there', 'В этой ячейке ничего нет'],
    ['Your locker is full', 'Рундук полон'],
    ['Sold {0} for {1} silver.', 'Продано: {0} — {1} серебра.'],
    ['No yard here to break it down', 'Здесь нет верфи, чтобы разобрать это'],
    ['Broken down: {0}.', 'Разобрано: {0}.'],
    ['No yard here', 'Здесь нет верфи'],
    ['Your gear is sound', 'Снаряжение в порядке'],
    ['That is sold', 'Это уже продано'],
    ['Bought {0}.', 'Куплено: {0}.'],
    ['Your locker is full: {0} is left in the water.', 'Рундук полон: {0} остаётся в воде.'],
    ['Found: {0} ({1}, level {2}).', 'Найдено: {0} ({1}, уровень {2}).'],
    ['Clear your locker first: her gear needs {0} places', 'Сначала разберите рундук: её снаряжению нужно мест — {0}'],
    ['No forge here: tempering and reforging want a yard of the second rank or better', 'Здесь нет кузницы: закалке и перековке нужна верфь второго разряда и выше'],
    ['No such piece', 'Такого предмета нет'],
    ['Tempered to the full', 'Закалено до предела'],
    ['Needs {0} iron and {1} planks (in the hold)', 'Нужно железа — {0}, досок — {1} (в трюме)'],
    ['Tempered: {0} +{1}.', 'Закалено: {0} +{1}.'],
    ['No such line to reforge', 'Такой строки для перековки нет'],
    ['Reforged: {0}.', 'Перековано: {0}.'],
    ...RARITY_NAMES.map(([en, ru]): [string, string] => [en, ru]),
  ];
}
