// Smuggling — "What the Crown does not see, the Crown does not tax." docs/03_TALENT_TREES.md §4.6.
// 24 talents, 36 ranks before keystones. Stealth, inspections and the black market live in
// server/src/game/smugglefx.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'smuggling' });

export const SMUGGLING: TalentDef[] = [
  // T1
  t({ id: 'smg_hidden_compartments', name: 'Hidden Compartments', tier: 1, maxRank: 3, keystone: false, description: 'Customs find contraband in a hidden compartment (False Bottom) 25% less often per rank: 10% → about 3%.', perRank: { hiddenSearch: -0.25 } }),
  t({ id: 'smg_low_profile', name: 'Low Profile', tier: 1, maxRank: 3, keystone: false, description: 'Your ship\'s signature −4% per rank: other captains and NPCs make you out later.', perRank: { signature: -0.04 } }),
  t({ id: 'smg_fence_contacts', name: 'Fence Contacts', tier: 1, maxRank: 2, keystone: false, description: 'Black-market sale prices +5% per rank.', perRank: { fence: 0.05 } }),
  t({ id: 'smg_dark_lanterns', name: 'Dark Lanterns', tier: 1, maxRank: 1, keystone: false, description: 'At night other captains cannot see you beyond 250 m — a dark shape with no name.', flags: ['dark_lanterns'] }),
  t({ id: 'smg_quick_dump', name: 'Quick Dump', tier: 1, maxRank: 2, keystone: false, description: 'Cargo goes over the side at once (normally 5 s), in marked casks only you can see for 10 min (rank 1) / 20 min (rank 2).', perRank: { quickDump: 1 } }),
  // T2
  t({ id: 'smg_forged_papers', name: 'Forged Papers', tier: 2, maxRank: 2, keystone: false, description: 'Customs find contraband in an open hold 10 points less often per rank (60% → 40%). At rank 2 contraband bought from the Brokers carries their stamp: League customs pass it.', perRank: { openSearch: -0.1 } }),
  t({ id: 'smg_fog_sense', name: 'Fog Sense', tier: 2, maxRank: 1, keystone: false, description: 'In fog you see 50% further.', flags: ['fog_sense'] }),
  t({ id: 'smg_false_colors', name: 'False Colors', tier: 2, maxRank: 1, keystone: false, description: 'ACTIVE. Hoist a merchant\'s flag: patrols let you pass and other captains see an "Unknown Merchant". Firing or passing within 100 m of a patrol unmasks you; 5 min cooldown.', active: { cooldown: 300 } }),
  t({ id: 'smg_silent_running', name: 'Silent Running', tier: 2, maxRank: 2, keystone: false, description: 'Under half sail or less +5% speed per rank; moving at half speed or less, your signature −8% more per rank.', perRank: { silentRunning: 1 } }),
  t({ id: 'smg_greased_palms', name: 'Greased Palms', tier: 2, maxRank: 2, keystone: false, description: 'Bribing customs instead of being searched is 25% cheaper per rank. At rank 2 a bribe also buys entry to a lawful port at Wanted 1–2.', perRank: { bribe: -0.25 } }),
  // T3
  t({ id: 'smg_cove_knowledge', name: 'Cove Knowledge', tier: 3, maxRank: 1, keystone: false, description: 'Six hidden coves of the Whispering Archipelago appear on your chart (anyone can stumble on them). In a cove: no NPC will attack you, contraband sells at 90% of the black market, and repairs need no planks.', flags: ['cove_knowledge'] }),
  t({ id: 'smg_slip_away', name: 'Slip Away', tier: 3, maxRank: 1, keystone: false, requires: 'smg_fog_sense', description: 'ACTIVE (3 min). At night or in fog with no enemy within 200 m: you vanish for 20 s — seen only within 250 m. Firing reveals you.', active: { cooldown: 180 } }),
  t({ id: 'smg_clean_slate', name: 'Clean Slate', tier: 3, maxRank: 2, keystone: false, description: 'Wanted fades 25% faster per rank.', perRank: { infamyDecay: 0.25 } }),
  t({ id: 'smg_decoy_barrels', name: 'Decoy Barrels', tier: 3, maxRank: 1, keystone: false, description: 'ACTIVE (2 min). Three decoy casks over the side: each NPC pursuer has a 50% chance to lose you for 8 s; other captains see them as real cargo.', active: { cooldown: 120 } }),
  t({ id: 'smg_smugglers_luck', name: "Smuggler's Luck", tier: 3, maxRank: 2, keystone: false, requires: 'smg_hidden_compartments', requiresRank: 2, description: 'When you sink, contraband has a 20% chance per rank to be waiting for you in the Brokers\' warehouse in Fogmouth instead of the sea.', perRank: { smugglersLuck: 0.2 } }),
  // T4
  t({ id: 'smg_night_market', name: 'Night Market', tier: 4, maxRank: 1, keystone: false, description: 'At night any contested or lawless port has a fence who buys contraband at 85% of Fogmouth\'s price.', flags: ['night_market'] }),
  t({ id: 'smg_ghost_wake', name: 'Ghost Wake', tier: 4, maxRank: 2, keystone: false, description: 'Your wake fades fast: hunters on your trail lose it 30% per rank more often whenever you are out of their sight.', perRank: { ghostWake: 0.3 } }),
  t({ id: 'smg_insider', name: 'Insider', tier: 4, maxRank: 1, keystone: false, description: 'Crown patrols in your region appear on your minimap.', flags: ['insider'] }),
  t({ id: 'smg_dangerous_goods', name: 'Dangerous Goods', tier: 4, maxRank: 2, keystone: false, description: 'Dangerous cargo sells 8% dearer per rank: cursed relics anywhere, gunpowder in safe waters.', perRank: { dangerousGoods: 0.08 } }),
  // T5
  t({ id: 'smg_shadow_strike', name: 'Shadow Strike', tier: 5, maxRank: 1, keystone: false, description: 'Your first broadside from hiding (night, fog, Slip Away — before she saw you) deals +30% damage, and for 4 s she loses sight of you.', flags: ['shadow_strike'] }),
  t({ id: 'smg_broker_friend', name: 'Friend of the Brokers', tier: 5, maxRank: 1, keystone: false, description: 'Once per voyage you may enter a Crown port at Wanted 3 as if you were Wanted 1: a Brokers\' forged licence.', flags: ['broker_friend'] }),
  t({ id: 'smg_ghost_cargo', name: 'Ghost Cargo', tier: 5, maxRank: 2, keystone: false, description: 'Contraband takes 10% less hold per rank (with False Bottom, down to 40% at most).', perRank: { contrabandVolumeMul: -0.1 } }),
  // Keystones
  t({ id: 'smg_nobodys_ship', name: "Nobody's Ship", tier: 6, maxRank: 1, keystone: true, excludes: 'smg_black_ledger', description: 'KEYSTONE. No name, no flag. Crimes in contested waters raise no Wanted if no witness within 800 m survives the next 10 minutes; customs search you half as often. All reputation grows 50% slower and Crown ports will not have you.', flags: ['nobodys_ship'] }),
  t({ id: 'smg_black_ledger', name: 'Black Ledger', tier: 6, maxRank: 1, keystone: true, excludes: 'smg_nobodys_ship', description: 'KEYSTONE. Contraband sells 20% dearer and every contested or lawless port has a fence; the Brokers offer you hot contraband runs. Legal goods sell 20% cheaper, League standing cannot rise above neutral, and League contracts and patrol protection are closed to you.', flags: ['black_ledger'] }),
];
