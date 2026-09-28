// Stat modifier vocabulary shared by talents, captain passives, abilities, modules and status effects.
// Multiplicative stats (…Mul) combine additively inside their bucket, then multiply the base: base * (1 + Σ).
// Flags are boolean switches consumed by specific systems (e.g. 'battle_repair').

export type StatKey =
  | 'maxSpeed' | 'accel' | 'turnRate' | 'noGoDeg' | 'sailChangeRate' | 'currentMul' | 'nightSpeed'
  | 'reloadMul' | 'spreadMul' | 'gunDamageMul' | 'rangeMul' | 'doubleShotChance' | 'crewKillMul' | 'sailDamageMul'
  | 'hullMax' | 'armor' | 'sailHpMax' | 'repairRate' | 'battleRepairRate'
  | 'boardingRange' | 'boardingPower' | 'boardingCargoLoss' | 'moraleOnBoard' | 'enemyMoraleCollapse'
  | 'holdVolume' | 'crewMax' | 'detection' | 'provisionUse' | 'buyMul' | 'sellMul' | 'contrabandVolumeMul'
  | 'moraleRegen' | 'incomingDamageMul' | 'cooldownMul' | 'armorPct'
  // navigation
  | 'turnDrag' | 'runningFreeAccel' | 'seaPenalty' | 'tackDrill' | 'draftMul' | 'reefDamage' | 'stormSailDamage' | 'evasion' | 'polarBoost'
  // gunnery
  | 'chainSail' | 'chainRange' | 'fireRisk' | 'grapeCrew' | 'grapeMorale' | 'heatedShot' | 'gunCrewDrill' | 'swivels' | 'rakingFire'
  | 'mastBreak' | 'breachChance' | 'quickSwap' | 'chaserDamage' | 'chaserArc' | 'shotSpeed'
  // boarding
  | 'meleeDamage' | 'boardingNets' | 'matchSpeed' | 'marines' | 'transferSpeed' | 'boardingAxes' | 'prizeCrew' | 'blooded'
  | 'ironGrip' | 'holdTheLine'
  // trade
  | 'dutyMul' | 'tradeRep' | 'slippage' | 'contractBroker' | 'spoilage' | 'insurancePremium' | 'insurancePayout' | 'priceMemory'
  | 'routeBonus' | 'loadPenalty' | 'profitShare'
  // smuggling
  | 'hiddenSearch' | 'signature' | 'fence' | 'quickDump' | 'openSearch' | 'silentRunning' | 'bribe' | 'infamyDecay' | 'smugglersLuck'
  | 'ghostWake' | 'dangerousGoods'
  // survival
  | 'leakInflow' | 'surgeon' | 'stormHull' | 'materialVolume' | 'materialUse' | 'damageControl' | 'hardenedCrew' | 'longVoyage'
  | 'lifeboats' | 'planking' | 'grimEndurance' | 'fireFight'
  // shipwright
  | 'ballast' | 'salvage' | 'yardCost' | 'ramDealt' | 'ramTaken' | 'gunTrain' | 'bulkheads' | 'masterwork' | 'strapping' | 'fittings'
  // exploration
  | 'cartography' | 'forecast' | 'beachcomber' | 'treasureHunter' | 'diveDepth' | 'pathfinder' | 'tracking' | 'frontier'
  | 'anomalySight' | 'chartedWaters' | 'storesVolume' | 'eyeOfStorm'
  | 'dreadGain' | 'mysticMorale' | 'sanityLoss' | 'moraleBase'
  // command
  | 'moraleLoss' | 'wages' | 'officerXp' | 'hireCost' | 'drill' | 'inspire' | 'discipline' | 'veteranOfficers' | 'fieldPromotion'
  | 'fleetLogistics' | 'admiralsEye'
  // abyssal
  | 'abyssPower' | 'saltWard' | 'fogSight' | 'offering' | 'drownedShot' | 'stillWaters' | 'risingDead' | 'cursedCargo' | 'creepingHorror'
  | 'hollowMen' | 'seaRot' | 'pact';

export type Flag =
  | 'battle_repair' | 'market_sense' | 'honest_merchant' | 'tangled_rigging' | 'unsinkable' | 'blood_tide'
  | 'terror' | 'false_bottom' | 'dark_running' | 'hidden' | 'boarding_anywhere' | 'personal_wind'
  // navigation
  | 'weather_gauge' | 'sweeps_drill' | 'wake_rider' | 'dead_reckoning' | 'lee_shore' | 'stolen_wind' | 'trade_winds' | 'second_wind'
  | 'iron_tiller' | 'storm_rider'
  // gunnery
  | 'rolling_broadside' | 'skipping_shot' | 'spotter' | 'splinter_storm' | 'mortar_lore' | 'thunder_broadside' | 'crossfire' | 'red_hot'
  // boarding
  | 'pistol_volley' | 'bow_and_stern' | 'first_over_rail' | 'surrender_terms' | 'hull_to_hull' | 'warlord' | 'ransom' | 'no_quarter'
  // trade
  | 'appraiser' | 'convoy_rights' | 'speculator' | 'rumor_mill' | 'league_patron' | 'monopolist' | 'prize_broker' | 'counting_house'
  // smuggling
  | 'dark_lanterns' | 'fog_sense' | 'false_colors' | 'cove_knowledge' | 'night_market' | 'insider' | 'shadow_strike' | 'broker_friend'
  | 'nobodys_ship' | 'black_ledger'
  // survival
  | 'lime_and_salt' | 'sealed_magazine' | 'wet_decks' | 'scuttle_charges' | 'old_salt' | 'patchwork_hull'
  // shipwright
  | 'copper_sheathing' | 'master_fitter' | 'field_forge' | 'modular_refit' | 'ironbound_masts' | 'spare_rigging' | 'prize_refit'
  | 'legendary_keel' | 'boneyard_secrets' | 'iron_coffin' | 'overgunned'
  // dynamic combat: the dash's moment of evasion
  | 'evasive'
  // exploration
  | 'star_reader' | 'rumor_hound' | 'sounding_line' | 'ruin_reader' | 'map_of_the_dead' | 'lucky_dig' | 'leviathan_lore'
  | 'legend_seeker' | 'gold_fever' | 'beyond_the_edge' | 'gold_trail'
  // crew and officers (docs/02 §8)
  | 'boatswain' | 'quartermaster' | 'alchemist' | 'deep_pastor' | 'sailmaker' | 'harpooner' | 'well_fed' | 'fog_born'
  // command
  | 'signal_flags' | 'escort_captain' | 'line_of_battle' | 'fear_and_respect' | 'screen_flagship' | 'legend_at_helm' | 'admirals_pennant'
  | 'rule_of_the_lash'
  // abyssal
  | 'eyes_of_choir' | 'krakens_embrace' | 'voice_of_choir' | 'drowned_king' | 'crew_of_drowned' | 'heart_of_abyss'
  // bridges
  | 'chain_and_grapple' | 'storm_gunner' | 'ghost_trader' | 'blood_and_salt' | 'drowned_boarders' | 'flagship_yard' | 'exotic_goods'
  | 'night_raider' | 'tide_whisperer' | 'salvage_king' | 'grand_battery' | 'iron_will'
  // shipbuilding
  | 'drowned_silk' | 'cursed_wood' | 'fh_crown_lion' | 'fh_harpooneer' | 'fh_gilded_scale' | 'fh_drowned_man' | 'fh_saint_of_wrecks' | 'fh_white_orca'
  // world bosses (fittings)
  | 'choir_bell' | 'lightning_rod' | 'lantern_gland'
  // legendary ships
  | 'saint_maws_bell' | 'crowns_sorrow' | 'widows_lament' | 'lamplighter';

export type StatMods = Partial<Record<StatKey, number>>;

export interface ModifierSource {
  mods?: StatMods;
  flags?: Flag[];
}

export function sumMods(sources: Iterable<ModifierSource>): { mods: Record<StatKey, number>; flags: Set<Flag> } {
  const mods = {} as Record<StatKey, number>;
  const flags = new Set<Flag>();
  for (const s of sources) {
    if (s.mods) {
      for (const k in s.mods) {
        const key = k as StatKey;
        mods[key] = (mods[key] ?? 0) + (s.mods[key] ?? 0);
      }
    }
    if (s.flags) for (const f of s.flags) flags.add(f);
  }
  return { mods, flags };
}

export function mod(mods: Record<StatKey, number>, key: StatKey): number {
  return mods[key] ?? 0;
}
