// The owner's paintings of 2026-10-24 (docs/ART_TODO.md §4–§6, baked by tools/art/pack_oct24.py) and where the game
// shows each: one table per hook, so the client asks for an id and the tests check every id the game can ask for is in
// assets/manifest.json. Every list is in order of preference — a painting of its own, then its kindred, then the old
// picture — and the client draws the first that loads (client/src/ui/artfall.ts), so a file that fails keeps the old art.

import type { RegionId } from '../world/regions.ts';
import type { IslandBiome } from '../world/regions.ts';
import type { FactionId } from './factions.ts';

// ------------------------------------------------------------------------------------------------ the harbours

/** The generic harbours by sea and flag (§3): every harbour with no painting of her own shows her group's, a group of
 *  two alternating by the port's id. */
export const GENERIC_HARBOURS: Partial<Record<RegionId, Partial<Record<FactionId, readonly string[]>>>> = {
  black_coast: { crown: ['gen_black_coast_crown_a', 'gen_black_coast_crown_b'], league: ['gen_black_coast_league_a', 'gen_black_coast_league_b'] },
  gravewater: { league: ['gen_gravewater_league'], free: ['gen_gravewater_free'] },
  whispering: { brokers: ['gen_whispering_brokers'], free: ['gen_whispering_free'] },
  ashen_isles: { confederacy: ['gen_ashen_confederacy'], free: ['gen_ashen_free'] },
  leviathan_reach: { harpoon: ['gen_leviathan_harpoon'], free: ['gen_leviathan_free'] },
  dead_mans_expanse: { free: ['gen_dead_free'], confederacy: ['gen_dead_confederacy'] },
  drowned_crown: { choir: ['gen_drowned_choir'], free: ['gen_drowned_free'] },
};

/** The floating towns' two harbours: `raft_0..6` the hulks lashed side by side, `raft_7..12` the ring of rafts. */
export const RAFT_HARBOUR_SPLIT = 7;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A harbour's window header, best first: her own, a floating town's, her sea and flag's, her flag's. */
export function harbourArt(p: { id: string; region: RegionId; faction: FactionId; raft?: boolean }): string[] {
  const out = [`bg.port_${p.id}`];
  const raft = /^raft_(\d+)$/.exec(p.id);
  if (p.raft || raft) out.push(`bg.port_raft_${raft && Number(raft[1]) >= RAFT_HARBOUR_SPLIT ? 'b' : 'a'}`);
  const gen = GENERIC_HARBOURS[p.region]?.[p.faction];
  if (gen?.length) out.push(`bg.port_${gen[hash(p.id) % gen.length]}`);
  out.push(`bg.port_${p.faction}`);
  return out;
}

/** The chart's mark of a harbour by her size: a capital, a town, a village, a floating town. */
export function portMark(p: { id: string; key?: boolean; size?: number; raft?: boolean }): string {
  if (p.raft) return 'map_port_raft';
  if (p.key || (p.size ?? 1) >= 3) return 'map_port_capital';
  return (p.size ?? 1) >= 2 && !/_v\d+$/.test(p.id) ? 'map_port_town' : 'map_port_village';
}

// ------------------------------------------------------------------------------------------------ the story

export const LORE_CARD = { prologue: 'card.lore_prologue', epilogue: 'card.lore_epilogue' } as const;
export const CHAPTER_COUNT = 36;
/** A chapter's opener (its first quest, and its page of the campaign book). */
export const chapterCard = (n: number): string => `card.ch_${String(n).padStart(2, '0')}`;

/** Where a parcel or a letter of a harbour's board is handed over at the spot (questgen.ts handJobs). */
export type DropKind = 'hamlet' | 'cove' | 'waystation';
export const DROP_CARD: Record<DropKind, string> = { hamlet: 'card.drop_hamlet', cove: 'card.drop_cove', waystation: 'card.drop_waystation' };

/** A waystation's window header by its kind (the floating tavern, the hulk chapel, the raft market). */
export const WAY_HEADER: Record<'tavern' | 'chapel' | 'market', string> = { tavern: 'bg.way_tavern', chapel: 'bg.way_chapel', market: 'bg.way_market' };

/** The island trek's header: a green island's path or a bare one's, the old signal fire after them. */
const LUSH = new Set<IslandBiome>(['temperate', 'mossy', 'jungle', 'mangrove', 'atoll', 'fungal']);
export function trekArt(biome: IslandBiome | undefined): string[] {
  const own = biome ? (LUSH.has(biome) ? 'card.trek_lush' : 'card.trek_stark') : 'card.trek_lush';
  return [own, 'card.enc_signal_fire'];
}

/** The endgame windows' headers: the Maelstrom Stair, the Abyss raid, the Throne, the citadels. */
export const END_HEADER = { descent: 'bg.descent', raid: 'bg.abyss_raid', throne: 'bg.throne', citadel: 'bg.citadel' } as const;

/** A sea's zone boss's banner (her class id is `zb_<sea>`). */
export const zoneBossCard = (classId: string): string => `card.${classId}`;

// ------------------------------------------------------------------------------------------------ the small icons

/** The icons painted in this batch that took the place of a shared one: the old one stands in while the new one
 *  loads or if it fails (client/src/ui/dom.ts icon). The artifacts' and the relics' are added by artifacts.ts. */
export const ICON_KIN: Record<string, string> = {
  ...Object.fromEntries([10, 20, 30, 40, 50, 60].map((lv) => [`gift_lv${lv}`, 'tattoo_star'])),
  ...Object.fromEntries(['plankton', 'ink', 'frost', 'mist', 'fire', 'gold'].map((t) => [`trail_${t}`, 'cos_trails'])),
  ...Object.fromEntries(['black', 'crimson', 'navy', 'ivory', 'ochre', 'forest', 'plum', 'teal', 'ember', 'slate'].map((c) => [`cloth_${c}`, 'cos_flags'])),
};

/** A level's gift in the shop (lv10…lv60). */
export const giftIcon = (lv: number): string => `gift_lv${lv}`;
