// Owner, 2026-10-18 («теперь вернемся к существам… некоторым из них надо давать разные скиллы, где-то хил, где-то еще
// какие-то способности… способности условно можно юзать только раз. где-то для 30% существ… и часть должны быть рдд,
// бить там магией или снарядами… кто-то там сплешем может бить»): the creatures' own abilities in the boarding battle.
//
// - An ability is a stack's own, given once a battle on its turn (the button «Способность» beside wait and defend, the
//   card in the book, the key F), pointed at a foe, at one of her own, at a hex or at nothing, as its kind says (`aim`).
//   Most take the stack's turn as a blow does; a few (`free`) leave it the rest of its turn — a leap, a fury, a hook that
//   pulls a foe within reach of its blow. One (`death`) is no button: it goes off by itself as the stack falls.
// - What it does is reckoned from the stack itself: its harm is its own blow's (`blowK` of it, as the battle's dice and
//   the stacks' Attack and Defense make it — so a large stack's fireball burns more than a small one's), its heals are
//   its own blows' worth (`healK`) at most a share of the stack healed (`cap`).
// - The great ones (a legend, a titan, a great one ashore) shrug off the abilities that take a turn, bind or move a
//   stack (`control`); the dead feel no fear nor song, no rot nor miasma.
// - A kind's ability is worth its `worth` more in the sea's reckoning of an army (army.ts armyPower and armyWeight), so a
//   lair, a drift or a roaming stack of a kind with one brings that many fewer heads, and its silver (`cost`) is as much
//   dearer (UNITS, applied once in army.ts): the tiers stay fair.
// - The server holds it (server/src/game/tacskills.ts), the field draws it (client/src/ui/tacskillfx.ts), the words are
//   client/src/lang/ui/skills.ts, the whole table docs/37_CREATURE_ABILITIES.md.
//
// Ranged (same order): a share of the creatures fire from afar — the land's gunners, harpooners, archers and the
// voodoo and ghost kinds with magic — HoMM3's way, as the men's musketeers do (army.ts 'shooter': no answer to a shot,
// half the blow in melee, shots counted). RANGED_KINDS turns eleven more kinds into shooters (65 of 271, 24%), with
// their charges; the field draws each one's missile (client MISSILE_OF) or its magic (MAGIC_OF): a hex bolt, ghost fire,
// a spark, a fire bolt, lightning.

import type { UnitId, UnitSpecial } from './army.ts';

export type SkillId =
  // Mending and warding (own side).
  | 'mend' | 'mass_mend' | 'raise' | 'ward' | 'bulwark' | 'cleanse' | 'haste' | 'rally' | 'toast'
  // Control (a foe).
  | 'fear' | 'stun' | 'freeze' | 'slow' | 'entangle' | 'siren' | 'curse' | 'mark' | 'ink' | 'taunt'
  // Harm over time.
  | 'rot' | 'miasma'
  // Harm at once: one, a chain, a splash, a line, a cone, a ring.
  | 'chain' | 'fireball' | 'firepot' | 'cone' | 'pierce' | 'volley' | 'aimed' | 'drain' | 'devour' | 'toll'
  // Moving stacks.
  | 'grapple' | 'tidal' | 'blink'
  // Self.
  | 'frenzy' | 'summon' | 'death_blast';

/** What an ability is pointed at: a foe's stack, one of her own (`own`; she herself among them), herself only (`self`),
 *  a free hex (`hex`), nothing (`none`: her whole side, or the foes round her), or nothing at all — it goes off as she
 *  falls (`death`). */
export type SkillAim = 'enemy' | 'own' | 'self' | 'hex' | 'none' | 'death';

/** How the field draws it (client/src/ui/tacskillfx.ts): each kind its own procedural look. */
export type SkillVfx = SkillId;

export interface SkillDef {
  id: SkillId;
  aim: SkillAim;
  /** The farthest hex from her it may be pointed at (absent: anywhere on the field). */
  range?: number;
  /** She keeps the rest of her turn after it (a leap, a fury, a hook): else it is her turn. */
  free?: boolean;
  /** Only a shooter with a charge left and no foe at arm's length (it fires one). */
  shot?: boolean;
  /** Turns a stack, binds it or moves it: the great ones shrug it off. */
  control?: boolean;
  /** Its harm, a share of her own blow on each it falls on (the first; `ringK` on the rest). */
  blowK?: number;
  ringK?: number;
  /** Its heal: her own blow's worth times this, at most `cap` of what the stack healed came aboard with. */
  healK?: number;
  cap?: number;
  /** The rounds a hold it lays lasts: 1 this round and the next. */
  rounds?: number;
  /** Hops of a chain, foes of a volley, turns of a rot. */
  n?: number;
  /** Its worth in the sea's reckoning of an army (×1+worth on the kind's might and its silver). */
  worth: number;
  /** The painted icon on its button (from what is in assets/icons). */
  icon: string;
}

const D = (id: SkillId, aim: SkillAim, worth: number, icon: string, o: Partial<SkillDef> = {}): SkillDef => ({ id, aim, worth, icon: `icon.${icon}`, ...o });

/** Every kind of ability: what it is pointed at and its numbers. */
export const SKILLS: Record<SkillId, SkillDef> = {
  mend: D('mend', 'own', 0.1, 'ab_brine_mend', { healK: 2.5, cap: 0.35 }),
  mass_mend: D('mass_mend', 'none', 0.12, 'boon_tide_mending', { healK: 0.9, cap: 0.15 }),
  raise: D('raise', 'own', 0.1, 'ab_deep_call', { healK: 2.5, cap: 0.3 }),
  ward: D('ward', 'own', 0.06, 'boon_iron_skin', { rounds: 1 }),
  bulwark: D('bulwark', 'self', 0.06, 'item_armoury', { rounds: 1 }),
  cleanse: D('cleanse', 'own', 0.05, 'good_salt', { healK: 1, cap: 0.1 }),
  haste: D('haste', 'own', 0.04, 'boon_swift_current', { rounds: 1 }),
  rally: D('rally', 'none', 0.08, 'ab_war_cry', { rounds: 1 }),
  toast: D('toast', 'none', 0.07, 'good_rum', { rounds: 1 }),
  fear: D('fear', 'enemy', 0.08, 'boon_undertow_curse', { range: 5, control: true }),
  stun: D('stun', 'enemy', 0.08, 'ammo_star', { range: 3, control: true, blowK: 0.6 }),
  freeze: D('freeze', 'enemy', 0.08, 'ammo_chain', { control: true, rounds: 1 }),
  slow: D('slow', 'enemy', 0.05, 'good_tar', { range: 5, rounds: 1, blowK: 0.3, ringK: 0.3 }),
  entangle: D('entangle', 'enemy', 0.05, 'item_crab_traps', { range: 4, control: true, rounds: 1, blowK: 0.3 }),
  siren: D('siren', 'enemy', 0.07, 'fh_mermaid', { range: 6, control: true }),
  curse: D('curse', 'enemy', 0.06, 'ammo_cursed', { rounds: 1 }),
  mark: D('mark', 'enemy', 0.06, 'ab_mark_target', { rounds: 1 }),
  ink: D('ink', 'enemy', 0.06, 'good_kraken_ink', { rounds: 1 }),
  taunt: D('taunt', 'none', 0.05, 'bt_colours', { range: 3, rounds: 1 }),
  rot: D('rot', 'enemy', 0.07, 'boon_black_water', { range: 6, blowK: 0.45, n: 3 }),
  miasma: D('miasma', 'enemy', 0.07, 'ammo_stinkpot', { blowK: 0.35, n: 2 }),
  chain: D('chain', 'enemy', 0.1, 'ab_storm_chaser', { blowK: 1, ringK: 0.7, n: 3 }),
  fireball: D('fireball', 'enemy', 0.1, 'ammo_incendiary', { blowK: 1, ringK: 0.6 }),
  firepot: D('firepot', 'enemy', 0.08, 'fire', { range: 6, blowK: 0.8, ringK: 0.4 }),
  cone: D('cone', 'enemy', 0.1, 'ab_grapeshot_frenzy', { range: 3, blowK: 0.9 }),
  pierce: D('pierce', 'enemy', 0.1, 'gun_whaling_gun', { blowK: 1, ringK: 0.8 }),
  volley: D('volley', 'none', 0.07, 'ab_double_shot', { shot: true, blowK: 0.7, n: 3 }),
  aimed: D('aimed', 'enemy', 0.07, 'ab_spotters_eye', { shot: true, blowK: 1.8 }),
  drain: D('drain', 'enemy', 0.08, 'boon_drowned_hands', { range: 5, blowK: 1 }),
  devour: D('devour', 'enemy', 0.08, 'ab_maw_of_the_deep', { range: 1, blowK: 1.6, healK: 0.3 }),
  toll: D('toll', 'none', 0.07, 'harness_bell', { range: 2, blowK: 0.5, rounds: 1 }),
  grapple: D('grapple', 'enemy', 0.06, 'ab_red_hook_boarding', { range: 4, free: true, control: true, blowK: 0.4 }),
  tidal: D('tidal', 'enemy', 0.06, 'ab_undertow', { range: 4, control: true, blowK: 0.6, ringK: 0.6 }),
  blink: D('blink', 'hex', 0.04, 'ab_vanish_into_fog', { range: 6, free: true }),
  frenzy: D('frenzy', 'self', 0.05, 'boon_salt_fury', { free: true, rounds: 1 }),
  summon: D('summon', 'hex', 0.1, 'ab_call_escort', { range: 1, healK: 0.35 }),
  death_blast: D('death_blast', 'death', 0.06, 'good_gunpowder', { blowK: 0.6 }),
};
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

/** The holds the abilities lay, in numbers (server/src/game/tacskills.ts; the words read them). */
export const SK = {
  /** ward: harm taken; bulwark: harm taken and she answers every blow. */
  ward: -0.4,
  bulwark: -0.5,
  /** haste and rally: hexes and initiative; rally a point of morale. */
  haste: { speed: 2, init: 3 },
  rally: { init: 2, morale: 1 },
  toast: { luck: 2, morale: 1 },
  /** slow (tar): hexes and initiative; entangle: she walks one hex at most. */
  slow: { speed: -2, init: -3 },
  curse: -0.3,
  mark: 0.35,
  ink: { shot: -0.6, melee: -0.2 },
  /** taunt: a taunted foe's blows on anyone but her are this much lighter; she takes this much less meanwhile. */
  taunt: { other: -0.5, taken: -0.2 },
  toll: -0.2,
  frenzy: { melee: 0.5, taken: 0.25 },
  /** freeze: spellbound (a blow wakes her) and chilled. */
  freeze: { speed: -2, init: -3 },
} as const;

/** Who holds which (owner: «где-то для 30% существ»): 83 of the 271 kinds (31%), spread over the land's creatures, the seven
 *  peoples, the shop's and the great ones; none of the men's fourteen (the ladder's own crew and the sea's pirates the
 *  whole balance of docs/31 is weighed on). Each fits its name. */
export const UNIT_SKILL: Partial<Record<UnitId, SkillId>> = {
  // The land's and the sea's creatures (bestiary.ts), the legends, the great ones ashore, the titans.
  rock_turtle: 'ward', marsh_serpent: 'miasma', lagoon_tentacle: 'grapple', cultist: 'curse', surf_drowned: 'raise', lantern_maw: 'fear',
  ancient_turtle: 'tidal', shoal_leviathan: 'devour', jaguar: 'frenzy', albatross: 'mark', giant_octopus: 'ink', crab_queen: 'summon',
  cave_wyrm: 'cone', storm_roc: 'stun', jungle_spider: 'entangle', banshee: 'freeze', mermaid: 'siren',
  white_whale: 'tidal', drowned_abbess: 'raise', mire_mother: 'summon', cinder_salamander: 'firepot',
  titan_kraken: 'grapple', titan_wrecks: 'death_blast',
  // The Crown.
  crown_drummer: 'rally', crown_surgeon: 'mend', crown_grenadier: 'firepot', crown_chaplain: 'cleanse', crown_rocketeer: 'fireball',
  // The Choir of the deep.
  choir_bellringer: 'toll', brine_sister: 'mass_mend', storm_witch: 'chain', rime_witch: 'freeze',
  // The Harpoon brotherhood.
  harpooner: 'pierce', master_harpooner: 'grapple', net_thrower: 'entangle', try_pot: 'slow', harpoon_commander: 'mark',
  // The fog brokers.
  fog_thief: 'blink', fog_shadow: 'ink', poisoner: 'miasma', assassin: 'rot', fog_cardsharp: 'toast',
  // The League.
  dock_bruiser: 'stun', paymaster: 'rally', petardier: 'death_blast', company_cannoneer: 'volley',
  // The free isles.
  island_elder: 'mass_mend', tide_shaman: 'tidal', tide_caller: 'haste', blowgun_hunter: 'rot', shark_dancer: 'blink', basalt_guardian: 'bulwark',
  // The Dutchman's dead.
  ghost_bosun: 'fear', lantern_wraith: 'drain', ghost_commodore: 'summon', frostbound: 'freeze', ghost_marksman: 'aimed',
  // The shop's (premiumbeasts.ts).
  golden_crab: 'toast', coral_basilisk: 'stun', abyssal_angler: 'siren', nautilus_knight: 'bulwark', lava_drake: 'fireball', sea_dragon: 'cone',
  thunderbird: 'chain', abyss_knight: 'drain', walrus_bull: 'taunt', brass_automaton: 'death_blast', storm_giant: 'stun', ember_phoenix: 'raise',
  megalodon: 'devour', marid: 'mass_mend', ice_wyvern: 'freeze', flying_squid: 'ink', selkie: 'cleanse', crimson_guard: 'taunt', storm_berserker: 'frenzy',
  spice_djinn: 'haste', pirate_lord: 'rally', silver_archer: 'volley', dragon_lancer: 'pierce', cask_mimic: 'death_blast', corposant: 'blink', sea_viper: 'slow',
};

/** What a summoner calls up (the `summon` ability): a stack of these, as many as `healK` of her own strength. */
export const SUMMON_OF: Partial<Record<UnitId, UnitId>> = { crab_queen: 'crab', mire_mother: 'giant_toad', ghost_commodore: 'ghost_sailor' };
export const summonOf = (u: UnitId): UnitId => SUMMON_OF[u] ?? 'crab';

/** A kind's ability (none: undefined). */
export const skillOf = (u: UnitId): SkillId | undefined => UNIT_SKILL[u];

/** The eleven kinds made to fire from afar (owner: «часть должны быть рдд, бить там магией или снарядами»): their
 *  charges and what they add to their specials. A ghost's fire, an angler's hex, a toad's and a naga's venom, an eel's spark, a
 *  phoenix's fire bolt (and its splash), the stones of the harpies and the apes. None of the peoples'
 *  kinds (a people's kind keeps the place it takes among the pirates' numbers, factionunits.ts). */
export const RANGED_KINDS: Partial<Record<UnitId, { shots: number; add?: UnitSpecial[] }>> = {
  banshee: { shots: 3 }, lantern_maw: { shots: 3 }, mist_wraith: { shots: 3 }, corposant: { shots: 3 }, giant_toad: { shots: 3 },
  electric_eel: { shots: 3 }, abyssal_angler: { shots: 3 }, ember_phoenix: { shots: 3, add: ['blast'] }, island_ape: { shots: 4 },
  cliff_harpy: { shots: 4 }, sea_naga: { shots: 3 },
};

/** What a shooter's charge is, for the field (client MAGIC_OF draws the magic, the rest are painted missiles), and the
 *  docs' table: 'ball' a musket's, 'shell' a gun's, 'bomb' a grenade or a pot, 'harpoon', 'arrow', 'dart', 'spear', and
 *  the magic: 'hex' a witch's bolt, 'ghost' ghost fire, 'spark', 'bolt' lightning, 'fire' a fire bolt, 'brine', 'bell'. */
export type ShotKind = 'ball' | 'shell' | 'bomb' | 'harpoon' | 'arrow' | 'dart' | 'spear' | 'net' | 'stone' | 'hex' | 'ghost' | 'spark' | 'bolt' | 'fire' | 'brine' | 'bell';
export const MAGIC_SHOTS: ReadonlySet<ShotKind> = new Set(['hex', 'ghost', 'spark', 'bolt', 'fire']);
export const SHOT_OF: Partial<Record<UnitId, ShotKind>> = {
  gunner: 'shell', bombardier: 'bomb', hermit: 'harpoon', cultist: 'hex', mermaid: 'spear', harpooner: 'harpoon', master_harpooner: 'harpoon', harpoon_gunner: 'harpoon',
  crown_grenadier: 'bomb', crown_mortar: 'shell', crown_rocketeer: 'bomb', choir_chanter: 'bell', choir_cantor: 'bell', brine_witch: 'hex', poisoner: 'dart',
  blowgun_hunter: 'dart', alchemist: 'bomb', fog_thief: 'bomb', island_archer: 'arrow', net_thrower: 'net', net_master: 'net', phantom_gunner: 'shell',
  storm_witch: 'bolt', tide_shaman: 'brine', tide_caller: 'brine', company_cannoneer: 'shell', petardier: 'bomb', fog_viper: 'dart', choir_toller: 'bell',
  thunderbird: 'bolt', rime_witch: 'hex', line_harpooner: 'harpoon', hunt_master: 'harpoon', fog_chemist: 'bomb', mask_archer: 'arrow', ghost_bomber: 'bomb',
  banshee: 'ghost', lantern_maw: 'ghost', mist_wraith: 'ghost', corposant: 'ghost', giant_toad: 'dart', storm_giant: 'bolt', electric_eel: 'spark', abyssal_angler: 'hex',
  ember_phoenix: 'fire', island_ape: 'stone', cliff_harpy: 'stone', sea_naga: 'dart', storm_caller: 'bolt', ghost_navigator: 'ghost', spice_djinn: 'fire',
  bell_priest: 'bell', silver_archer: 'arrow', dragon_lancer: 'harpoon', pearl_siren: 'brine', mermaid_queen: 'brine', bell_diver: 'bell', night_smuggler: 'bomb',
  bastion_gunner: 'shell', ledger_enforcer: 'ball',
};
export const shotOf = (u: UnitId): ShotKind => SHOT_OF[u] ?? 'ball';

/** A kind's worth beyond its numbers in the sea's reckoning of an army: its ability's (army.ts armyPower, armyWeight). */
export function skillWorth(u: UnitId): number {
  const s = UNIT_SKILL[u];
  return s ? SKILLS[s].worth : 0;
}

/** An ability's numbers as its line reads them (client/src/lang/ui/skills.ts, docs/37): `k` and `ring` her blow's
 *  share in percent, `heal` and `cap` in percent, `range` hexes, `n` hops, foes or turns, `r` the rounds a hold lasts,
 *  `a` and `b` its hold's two numbers (percent or points). */
export function skillVars(id: SkillId): Record<string, number> {
  const d = SKILLS[id];
  const pc = (x: number) => Math.round(Math.abs(x) * 100);
  const out: Record<string, number> = {};
  if (d.blowK) out.k = pc(d.blowK);
  if (d.ringK) out.ring = pc(d.ringK);
  if (d.healK) out.heal = pc(d.healK);
  if (d.cap) out.cap = pc(d.cap);
  if (d.range) out.range = d.range;
  if (d.n) out.n = d.n;
  out.r = (d.rounds ?? 1) + 1;
  const ab: Partial<Record<SkillId, [number, number]>> = {
    ward: [pc(SK.ward), 0], bulwark: [pc(SK.bulwark), 0], haste: [SK.haste.speed, SK.haste.init], rally: [SK.rally.init, SK.rally.morale], toast: [SK.toast.luck, SK.toast.morale],
    slow: [-SK.slow.speed, -SK.slow.init], freeze: [-SK.freeze.speed, -SK.freeze.init], curse: [pc(SK.curse), 0], mark: [pc(SK.mark), 0], ink: [pc(SK.ink.shot), pc(SK.ink.melee)],
    taunt: [pc(SK.taunt.other), pc(SK.taunt.taken)], toll: [pc(SK.toll), 0], frenzy: [pc(SK.frenzy.melee), pc(SK.frenzy.taken)],
  };
  const x = ab[id];
  if (x) {
    out.a = x[0];
    out.b = x[1];
  }
  return out;
}
