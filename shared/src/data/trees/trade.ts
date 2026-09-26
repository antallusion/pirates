// Trade — "Every port is a ledger." docs/03_TALENT_TREES.md §4.5. 24 talents, 37 ranks before keystones.
// Market rules live in server/src/game/economy.ts, ports.ts and tradefx.ts.

import type { TalentDef } from '../talents.ts';

const t = (d: Omit<TalentDef, 'tree'>): TalentDef => ({ ...d, tree: 'trade' });

export const TRADE: TalentDef[] = [
  // T1
  t({ id: 'trd_haggler', name: 'Haggler', tier: 1, maxRank: 3, keystone: false, description: 'Buy prices −2% and sell prices +2% per rank.', perRank: { buyMul: -0.02, sellMul: 0.02 } }),
  t({ id: 'trd_packer', name: 'Packer', tier: 1, maxRank: 2, keystone: false, description: 'Hold volume +8% per rank.', perRank: { holdVolume: 0.08 } }),
  t({ id: 'trd_ledger_keeper', name: 'Ledger Keeper', tier: 1, maxRank: 2, keystone: false, description: 'Import duties, warehouse rent and licence fees −15% per rank.', perRank: { dutyMul: -0.15 } }),
  t({ id: 'trd_local_contacts', name: 'Local Contacts', tier: 1, maxRank: 3, keystone: false, description: 'Standing from trade grows 10% faster per rank. At rank 3 every port shows you a deal of the day: one good 15% cheaper.', perRank: { tradeRep: 0.1 } }),
  t({ id: 'trd_bulk_buyer', name: 'Bulk Buyer', tier: 1, maxRank: 2, keystone: false, description: 'Price slippage on large deals −15% per rank.', perRank: { slippage: -0.15 } }),
  // T2
  t({ id: 'trd_market_sense', name: 'Market Sense', tier: 2, maxRank: 1, keystone: false, description: 'See price trends of every port you have visited on the world map.', flags: ['market_sense'] }),
  t({ id: 'trd_false_bottom', name: 'False Bottom', tier: 2, maxRank: 1, keystone: false, description: 'Contraband uses 30% less hold volume.', fixed: { contrabandVolumeMul: -0.3 }, flags: ['false_bottom'] }),
  t({ id: 'trd_contract_broker', name: 'Contract Broker', tier: 2, maxRank: 2, keystone: false, description: 'Rank 1: one more contract slot. Rank 2: contract rewards +10%.', perRank: { contractBroker: 1 } }),
  t({ id: 'trd_cold_hold', name: 'Cold Hold', tier: 2, maxRank: 2, keystone: false, description: 'Perishable cargo spoils 25% slower per rank.', perRank: { spoilage: -0.25 } }),
  t({ id: 'trd_appraiser', name: 'Appraiser', tier: 2, maxRank: 1, keystone: false, description: 'You see what plunder and cargo are worth at the best port you know, and your charts sell for 15% more.', flags: ['appraiser'] }),
  // T3
  t({ id: 'trd_gilded_insurance', name: 'Gilded Insurance', tier: 3, maxRank: 2, keystone: false, description: 'League insurance premiums −20% per rank; payouts +10% per rank.', perRank: { insurancePremium: -0.2, insurancePayout: 0.1 } }),
  t({ id: 'trd_convoy_rights', name: 'Convoy Rights', tier: 3, maxRank: 1, keystone: false, description: 'In safe and contested waters Crown and League patrols treat an attack on you as an attack on their own charge and come about to help.', flags: ['convoy_rights'] }),
  t({ id: 'trd_price_memory', name: 'Price Memory', tier: 3, maxRank: 2, keystone: false, requires: 'trd_market_sense', description: 'Prices of ports you have visited refresh by letter without a visit: every 30 min (rank 1) / 15 min (rank 2).', perRank: { priceMemory: 1 } }),
  t({ id: 'trd_speculator', name: 'Speculator', tier: 3, maxRank: 1, keystone: false, requires: 'trd_market_sense', description: 'Options: reserve up to 30% of a port\'s stock of a good at today\'s price for 2 h against a 20% deposit. Buy it later at the locked price — or lose the deposit.', flags: ['speculator'] }),
  t({ id: 'trd_dockhands', name: 'Dockhands', tier: 3, maxRank: 2, keystone: false, description: 'Swaying cargo across at sea and hauling from shore is 25% faster per rank: less time where they are waiting for you.', perRank: { transferSpeed: 0.25 } }),
  // T4
  t({ id: 'trd_established_route', name: 'Established Route', tier: 4, maxRank: 2, keystone: false, description: 'Each repeat run on the same route (port A → port B) within 24 h adds +1.5% per rank to sale prices in B (up to 3 stacks).', perRank: { routeBonus: 0.015 } }),
  t({ id: 'trd_rumor_mill', name: 'Rumor Mill', tier: 4, maxRank: 1, keystone: false, description: 'Taverns tell you of market events — fevers, gluts, sieges — 20 minutes before they break.', flags: ['rumor_mill'] }),
  t({ id: 'trd_heavy_hauler', name: 'Heavy Hauler', tier: 4, maxRank: 2, keystone: false, description: 'Speed lost to a heavy hold −20% per rank.', perRank: { loadPenalty: -0.2 } }),
  t({ id: 'trd_league_patron', name: 'League Patron', tier: 4, maxRank: 1, keystone: false, description: 'The Gilded Ledger serves you in every lawful port, and your credit line is at least 500 × your level.', flags: ['league_patron'] }),
  // T5
  t({ id: 'trd_monopolist', name: 'Monopolist', tier: 5, maxRank: 1, keystone: false, description: 'Sell 40% of a port\'s appetite for a good within an hour and the market gets used to you: your sales there move the price 25% less for 30 min, and your next sale of that good anywhere else earns +5%.', flags: ['monopolist'] }),
  t({ id: 'trd_profit_share', name: 'Profit Share', tier: 5, maxRank: 2, keystone: false, description: 'The crew takes a share: +1 morale per 1,000 silver of profit this voyage (up to +10 per rank).', perRank: { profitShare: 10 } }),
  t({ id: 'trd_prize_broker', name: 'Prize Broker', tier: 5, maxRank: 1, keystone: false, description: 'Prize courts and ransoms pay 15% more.', flags: ['prize_broker'] }),
  // Keystones
  t({ id: 'trd_honest_merchant', name: 'Honest Merchant', tier: 6, maxRank: 1, keystone: true, excludes: 'trd_counting_house', description: 'KEYSTONE. You can never attack non-hostile ships and will not load contraband; legal goods sell for +12%, and Crown and League patrols answer your distress in safe and contested waters.', flags: ['honest_merchant', 'convoy_rights'], fixed: { sellMul: 0.12 } }),
  t({ id: 'trd_counting_house', name: 'Counting House', tier: 6, maxRank: 1, keystone: true, excludes: 'trd_honest_merchant', description: 'KEYSTONE. Two fluyt caravans trade under your flag between ports you have visited, paying you 35% of their margins while you are at sea. They can be robbed; losing one costs League standing and 30 min to refit. Your own hold −40%.', flags: ['counting_house'], fixed: { holdVolume: -0.4 } }),
];
