// Navigation — "The wind is a weapon." docs/03_TALENT_TREES.md §4.1. 26 talents, 41 ranks before keystones.
// Static numbers live in perRank/fixed; situational effects (weather gauge, wake riding, lee shore…) are
// implemented in server/src/game/talentfx.ts and keyed by talent id.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'navigation' });

export const NAVIGATION: TalentDef[] = [
  // T1 — craft
  t({ id: 'nav_close_hauled', name: 'Close-Hauled', tier: 1, maxRank: 3, keystone: false, description: 'Point higher into the wind: the no-go zone shrinks by 4° per rank.', perRank: { noGoDeg: -4 } }),
  t({ id: 'nav_quick_trim', name: 'Quick Trim', tier: 1, maxRank: 2, keystone: false, description: 'Sail changes are 25% faster per rank.', perRank: { sailChangeRate: 0.25 } }),
  t({ id: 'nav_helmsmans_hands', name: "Helmsman's Hands", tier: 1, maxRank: 3, keystone: false, description: 'Turn rate +4% per rank; speed lost in hard turns −10% per rank.', perRank: { turnRate: 0.04, turnDrag: -0.1 } }),
  t({ id: 'nav_running_free', name: 'Running Free', tier: 1, maxRank: 2, keystone: false, description: 'With the wind within 30° of the stern, acceleration +10% per rank.', perRank: { runningFreeAccel: 0.1 } }),
  t({ id: 'nav_sea_legs', name: 'Sea Legs', tier: 1, maxRank: 2, keystone: false, description: 'Penalties from heavy seas — to your speed and to the spread of your guns — −20% per rank.', perRank: { seaPenalty: -0.2 } }),
  // T2 — first mechanics
  t({ id: 'nav_night_runner', name: 'Night Runner', tier: 2, maxRank: 2, keystone: false, description: '+6% speed per rank while sailing at night.', perRank: { nightSpeed: 0.06 } }),
  t({ id: 'nav_current_reader', name: 'Current Reader', tier: 2, maxRank: 1, keystone: false, description: 'Ocean currents push you 50% harder. Head-on currents still slow you.', fixed: { currentMul: 0.5 } }),
  t({ id: 'nav_tacking_drill', name: 'Tacking Drill', tier: 2, maxRank: 2, keystone: false, requires: 'nav_close_hauled', description: 'Coming about through the wind: 20% faster per rank, and the ship keeps way — speed does not fall below 40% / 50% of what it was.', perRank: { tackDrill: 1 } }),
  t({ id: 'nav_weather_gauge', name: 'Weather Gauge', tier: 2, maxRank: 1, keystone: false, description: 'Upwind of a hostile within 450 m: +8% speed, and the smoke of your broadsides blows onto them — their spread +10% for 3 s after each of your volleys.', flags: ['weather_gauge'] }),
  t({ id: 'nav_shallow_draft', name: 'Shallow Draft', tier: 2, maxRank: 2, keystone: false, description: 'Draft −10% per rank; reef and shoal damage −25% per rank. At rank 2 you cross shoals closed to your class as if one class lighter.', perRank: { draftMul: -0.1, reefDamage: -0.25 } }),
  t({ id: 'nav_sweeps', name: 'Sweeps', tier: 2, maxRank: 1, keystone: false, description: 'Oars: rowing speed +20%. Schooners and brigantines can row too (about 2 kn) in a calm or against the wind.', flags: ['sweeps_drill'] }),
  // T3 — the rules change
  t({ id: 'nav_spill_the_wind', name: 'Spill the Wind', tier: 3, maxRank: 1, keystone: false, requires: 'nav_helmsmans_hands', requiresRank: 2, description: 'ACTIVE (40 s). Spill the wind: for 1.5 s you lose half your speed without losing steerage, then turn 40% faster for 4 s. A pursuer in your wake overshoots onto your broadside.', active: { cooldown: 40 } }),
  t({ id: 'nav_storm_canvas', name: 'Storm Canvas', tier: 3, maxRank: 2, keystone: false, description: 'Storm damage to your sails −50% per rank. At rank 2 full sail in a storm is safe.', perRank: { stormSailDamage: -0.5 } }),
  t({ id: 'nav_wake_rider', name: 'Wake Rider', tier: 3, maxRank: 2, keystone: false, description: 'In the wake of another ship (up to 120 m behind her stern) +5% speed per rank. Works behind enemies — a tool of the chase.', flags: ['wake_rider'] }),
  t({ id: 'nav_dead_reckoning', name: 'Dead Reckoning', tier: 3, maxRank: 1, keystone: false, description: 'Your lookouts are not blinded by fog: the fog and storm-murk penalty to your sighting range is halved.', flags: ['dead_reckoning'] }),
  t({ id: 'nav_serpentine', name: 'Serpentine', tier: 3, maxRank: 3, keystone: false, description: 'While your rudder is over more than half, enemy shot is thrown off: each ball aimed at you has a 5% per rank chance to fall wide.', perRank: { evasion: 0.05 } }),
  t({ id: 'nav_lee_shore', name: 'Lee Shore', tier: 3, maxRank: 1, keystone: false, requires: 'nav_weather_gauge', description: 'A hostile caught between you and land downwind (within 250 m of the shore) gets −20% acceleration and −10% turn rate.', flags: ['lee_shore'] }),
  // T4 — specialisation
  t({ id: 'nav_stolen_wind', name: 'Stolen Wind', tier: 4, maxRank: 1, keystone: false, requires: 'nav_weather_gauge', description: 'Upwind of a hostile within 250 m your sails steal her wind: her maximum speed −15%. Does not stack between sources.', flags: ['stolen_wind'] }),
  t({ id: 'nav_flying_jib', name: 'Flying Jib', tier: 4, maxRank: 2, keystone: false, description: 'Maximum speed +3% per rank; acceleration +15% per rank.', perRank: { maxSpeed: 0.03, accel: 0.15 } }),
  t({ id: 'nav_anchor_pivot', name: 'Anchor Pivot', tier: 4, maxRank: 1, keystone: false, description: 'ACTIVE (60 s). Let go the anchor under way: the ship swings round 90–180° toward your rudder in 2.5 s, stops dead and takes 2% hull damage. Breaks any chase.', active: { cooldown: 60 } }),
  t({ id: 'nav_trade_winds', name: 'Trade Winds', tier: 4, maxRank: 2, keystone: false, description: 'Out of combat with no hostile within 1 km: +5% speed per rank.', flags: ['trade_winds'] }),
  // T5 — mastery
  t({ id: 'nav_master_of_sail', name: 'Master of Sail', tier: 5, maxRank: 2, keystone: false, requires: 'nav_close_hauled', requiresRank: 3, description: 'Speed lost to a poor point of sail −15% per rank.', perRank: { polarBoost: 0.15 } }),
  t({ id: 'nav_second_wind', name: 'Second Wind', tier: 5, maxRank: 1, keystone: false, description: 'When the hull drops below 30%: +25% speed and acceleration for 8 s. At most once per 90 s.', flags: ['second_wind'] }),
  t({ id: 'nav_iron_tiller', name: 'Iron Tiller', tier: 5, maxRank: 1, keystone: false, description: 'Your rudder cannot be shot away; effects that slow your turning (Tangled Rigging and the like) are 40% weaker.', flags: ['iron_tiller'] }),
  // Keystones
  t({ id: 'nav_windborn', name: 'Windborn', tier: 6, maxRank: 1, keystone: true, excludes: 'nav_storm_rider', description: 'KEYSTONE. +15% maximum speed, but −25% maximum hull. You live by never being caught. (Your speed cap rises to +35%.)', fixed: { maxSpeed: 0.15, hullMax: -0.25 } }),
  t({ id: 'nav_storm_rider', name: 'Storm Rider', tier: 6, maxRank: 1, keystone: true, excludes: 'nav_windborn', description: 'KEYSTONE. In a fresh wind or storm: +20% speed, +25% turn, storm-proof canvas, twice the sighting range through storm murk. In light airs (wind under 35%): −30% maximum speed and −15% turn, and no sweeps.', flags: ['storm_rider'] }),
];
