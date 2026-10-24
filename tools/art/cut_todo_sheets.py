# Cuts the ChatGPT sheets in Downloads/gravetide_art/<folder>/<file> into cells named by asset id (docs/ART_TODO.md §3–4).
# python -I tools/art/cut_todo_sheets.py → Downloads/gravetide_art/_cells/<asset id>.png + _cells/index.json
# Panels are split on their black gutters (searched near the even split); green sprite sheets are split evenly and left
# unkeyed (process.py keyed mode, key #00ff00, then tools/art/quay_piers.py for the towns). Nothing is registered here:
# wiring into the manifest is left to the next chat (tools/art/slice_sheet.py style).
import json, os
from PIL import Image
import numpy as np

ROOT = 'C:/Users/enosi/Downloads/gravetide_art'
OUT = ROOT + '/_cells'

def harb(*ids): return ['bg.port_' + i for i in ids]

SHEETS = {
  # file: (rows, cols, kind, [asset ids, left to right, top row first])
  'ports_p1/bg_port_saltmarrow.png': (1, 1, 'panel', ['bg.port_saltmarrow']),
  'ports_p1/bg_port_gravesend.png': (1, 1, 'panel', ['bg.port_gravesend']),
  'ports_p1/bg_port_blackwater_tidewrack.png': (2, 1, 'panel', harb('blackwater', 'tidewrack')),
  'ports_p1/prop_ports_key_1.png': (2, 2, 'green', ['prop.port_saltmarrow', 'prop.port_gravesend', 'prop.port_blackwater', 'prop.port_tidewrack']),
  'ports_p1/bg_ports_early_1.png': (2, 2, 'panel', harb('black_coast_t24', 'black_coast_t0', 'gravewater_t22', 'whispering_t32')),
  'ports_p1/bg_ports_early_2.png': (2, 2, 'panel', harb('whispering_t62', 'gen_black_coast_crown_a', 'gen_black_coast_crown_b', 'gen_black_coast_league_a')),
  'ports_p1/bg_league_b_and_drops.png': (2, 2, 'panel', ['bg.port_gen_black_coast_league_b', 'card.drop_hamlet', 'card.drop_cove', 'card.drop_waystation']),
  'story/story_1.png': (2, 2, 'panel', ['card.lore_prologue', 'card.lore_epilogue', 'card.ch_01', 'card.ch_02']),
  'story/story_2.png': (2, 2, 'panel', ['card.ch_03', 'card.ch_04', 'card.ch_05', 'card.ch_06']),
  **{f'ports_p2/bg_port_{i}.png': (1, 1, 'panel', ['bg.port_' + i]) for i in ['hollowmere', 'wrecktide', 'harpoon_rest', 'saint_maw', 'fogmouth', 'cinderhold']},
  'ports_p2/prop_ports_key_2.png': (2, 2, 'green', ['prop.port_hollowmere', 'prop.port_wrecktide', 'prop.port_harpoon_rest', 'prop.port_saint_maw']),
  'ports_p2/prop_ports_key_3.png': (1, 2, 'green', ['prop.port_fogmouth', 'prop.port_cinderhold']),
  'ports_p2/bg_ports_campaign_01.png': (2, 2, 'panel', harb('whispering_t7', 'gravewater_t17', 'gravewater_t20', 'whispering_v3')),
  'ports_p2/bg_ports_campaign_02.png': (2, 2, 'panel', harb('whispering_t71', 'whispering_t13', 'whispering_t70', 'whispering_t45')),
  'ports_p2/bg_ports_campaign_03.png': (2, 2, 'panel', harb('dead_mans_expanse_t9', 'dead_mans_expanse_v3', 'whispering_t79', 'whispering_t23')),
  'ports_p2/bg_ports_campaign_04.png': (2, 2, 'panel', harb('whispering_t51', 'leviathan_reach_t10', 'leviathan_reach_t21', 'dead_mans_expanse_t10')),
  'ports_p2/bg_ports_campaign_05.png': (2, 2, 'panel', harb('dead_mans_expanse_t5', 'leviathan_reach_t14', 'leviathan_reach_t15', 'dead_mans_expanse_t1')),
  'ports_p2/bg_ports_campaign_06.png': (2, 2, 'panel', harb('dead_mans_expanse_t7', 'whispering_t35', 'whispering_t59', 'whispering_t3')),
  'ports_p2/bg_ports_campaign_07.png': (2, 2, 'panel', harb('ashen_isles_t13', 'ashen_isles_t6', 'ashen_isles_t3', 'drowned_crown_t31')),
  'ports_p2/bg_ports_campaign_08.png': (2, 2, 'panel', harb('drowned_crown_t11', 'drowned_crown_t8', 'drowned_crown_t2', 'ashen_isles_t17')),
  'ports_p2/bg_ports_campaign_09.png': (2, 2, 'panel', harb('drowned_crown_t22', 'drowned_crown_t9', 'drowned_crown_t6', 'drowned_crown_t13')),
  'ports_p2/bg_ports_campaign_10.png': (2, 2, 'panel', harb('drowned_crown_t19', 'drowned_crown_t28', 'drowned_crown_t0', 'raft_a')),
  'ports_p2/bg_ports_generic_1.png': (2, 2, 'panel', harb('gen_gravewater_league', 'gen_gravewater_free', 'gen_whispering_brokers', 'gen_whispering_free')),
  'ports_p2/bg_ports_generic_2.png': (2, 2, 'panel', harb('gen_ashen_confederacy', 'gen_ashen_free', 'gen_leviathan_harpoon', 'gen_leviathan_free')),
  'ports_p2/bg_ports_generic_3.png': (2, 2, 'panel', harb('gen_dead_free', 'gen_dead_confederacy', 'gen_drowned_choir', 'gen_drowned_free')),
  'isle/isle_map_dry.png': (1, 1, 'panel', ['isle.map.dry']),
  'isle/isle_map_drowned.png': (1, 1, 'panel', ['isle.map.drowned']),
  'ports_p2/bg_raft_b_and_trek.png': (2, 2, 'panel', ['bg.port_raft_b', 'bg.way_market', 'card.trek_lush', 'card.trek_stark']),
  **{f'story/story_{n}.png': (2, 2, 'panel', [f'card.ch_{c:02d}' for c in range(4 * n - 5, 4 * n - 1)]) for n in range(3, 10)},
  'story/story_10.png': (2, 2, 'panel', ['card.ch_35', 'card.ch_36', 'bg.way_tavern', 'bg.way_chapel']),
  'bosses/boss_cards_1.png': (3, 2, 'panel', ['card.' + k for k in ['old_moorings', 'old_tithe', 'fog_changeling', 'cinder_ray', 'drowned_prelate', 'rime_twins']]),
  'minigames/mg_1.png': (2, 2, 'panel', ['card.mg_' + k for k in ['talking_skull', 'drowned_ferryman', 'old_parrot', 'bosuns_lore']]),
  'minigames/mg_2.png': (2, 2, 'panel', ['card.mg_' + k for k in ['star_bearing', 'liars_dice', 'crown_anchor', 'castaway_coin']]),
  'minigames/mg_3.png': (2, 2, 'panel', ['card.mg_' + k for k in ['three_shells', 'bosun_whistle', 'flag_hoist', 'compass_needle']]),
  'minigames/mg_4.png': (2, 2, 'panel', ['card.mg_' + k for k in ['harpoon_lagoon', 'beach_trader', 'marooned_sailor', 'cursed_idol']]),
  'minigames/mg_5.png': (2, 2, 'panel', ['card.mg_' + k for k in ['smugglers_cave', 'mutineers_grave', 'three_levers', 'split_map']]),
  'icons/artifacts_1.png': (4, 4, 'panel', ['icon.art_' + k for k in ['drowned_bicorne', 'kelp_coat', 'needle_of_the_deep', 'red_hook_axe', 'hook_brace', 'bloodied_baldric', 'squall_glass', 'deck_grip_boots', 'ring_of_the_gale', 'first_mate_cutlass', 'quartermaster_rapier', 'mail_lined_coat', 'dress_uniform', 'tricorne_of_command', 'bandana_of_fury', 'cartridge_bandolier']]),
  'icons/artifacts_2.png': (4, 4, 'panel', ['icon.art_' + k for k in ['duellist_pistols', 'tide_boots', 'watch_glass', 'lodestone_compass', 'lucky_doubloon', 'mercy_medal', 'ring_of_brine', 'orca_talisman', 'admirals_signet', 'last_volley_tricorne', 'white_orca_fang', 'union_pike', 'union_pepperbox', 'union_buff_coat', 'union_boots', 'deep_bell']]),
  'icons/artifacts_3.png': (3, 4, 'panel', ['icon.art_' + k for k in ['drowned_sunstone', 'storm_bottle', 'storm_glass_eye', 'thunder_cap', 'thunder_horn', 'throne_needle', 'throne_hoop', 'throne_cloak']] + ['icon.relic_' + k for k in ['crown_of_the_deep', 'storm_orb', 'boarding_union', 'throne_compass']]),
  'p3/headers_endgame.png': (2, 2, 'panel', ['bg.descent', 'bg.abyss_raid', 'bg.throne', 'bg.citadel']),
  'p3/props_map_1.png': (2, 2, 'green', ['prop.citadel', 'prop.lookout', 'prop.castaways', 'isle.pen']),
  'p3/icons_small_1.png': (4, 4, 'panel', ['icon.map_port_' + k for k in ['capital', 'town', 'village', 'raft']] + [f'icon.gift_lv{n}' for n in (10, 20, 30, 40, 50, 60)] + ['icon.trail_' + k for k in ['plankton', 'ink', 'frost', 'mist', 'fire', 'gold']]),
  'p3/icons_cloths.png': (2, 5, 'panel', ['icon.cloth_' + k for k in ['black', 'crimson', 'navy', 'ivory', 'ochre', 'forest', 'plum', 'teal', 'ember', 'slate']]),
  'bosses/zb_cards_1.png': (2, 2, 'panel', ['card.zb_' + k for k in ['black_coast', 'gravewater', 'whispering', 'leviathan_reach']]),
  'bosses/zb_cards_2.png': (2, 2, 'panel', ['card.zb_' + k for k in ['ashen_isles', 'dead_mans_expanse', 'drowned_crown', 'the_abyss']]),
}

DARK = 28  # a gutter line: 98 % of its pixels darker than this

def cuts(profile, n):
  # the n-1 gutters nearest the even splits: (start, end) of the dark run, or the even split when there is none
  L = len(profile); res = []
  for k in range(1, n):
    c = round(L * k / n); w = max(4, L // 16)
    dark = [i for i in range(max(1, c - w), min(L - 1, c + w)) if profile[i] < DARK]
    if not dark: res.append((c, c)); continue
    runs, s = [], dark[0]
    for a, b in zip(dark, dark[1:] + [None]):
      if b != a + 1: runs.append((s, a + 1)); s = b
    res.append(min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - c)))
  return res

def edges(profile):
  # trim a dark outer frame of the sheet
  L = len(profile); a, b = 0, L
  while a < L // 20 and profile[a] < DARK: a += 1
  while b > L - L // 20 and profile[b - 1] < DARK: b -= 1
  return a, b

def spans(profile, n):
  a, b = edges(profile) if n > 1 else (0, len(profile))
  bounds = [a] + [x for g in cuts(profile, n) for x in g] + [b]
  return [(bounds[2 * i], bounds[2 * i + 1]) for i in range(n)]

def main():
  os.makedirs(OUT, exist_ok=True)
  index, missing = {}, []
  for rel, (rows, cols, kind, ids) in SHEETS.items():
    p = f'{ROOT}/{rel}'
    if not os.path.exists(p): missing.append(rel); continue
    im = Image.open(p).convert('RGB'); W, H = im.size
    lum = np.asarray(im.convert('L'), dtype=np.float32)
    if kind == 'green':
      xs = [(round(W * i / cols), round(W * (i + 1) / cols)) for i in range(cols)]
      ys = [(round(H * j / rows), round(H * (j + 1) / rows)) for j in range(rows)]
    else:
      xs = spans(np.percentile(lum, 98, axis=0), cols)
      ys = spans(np.percentile(lum, 98, axis=1), rows)
    k = 0
    for j in range(rows):
      for i in range(cols):
        box = (xs[i][0], ys[j][0], xs[i][1], ys[j][1])
        cell = im.crop(box); aid = ids[k]; k += 1
        cell.save(f'{OUT}/{aid}.png')
        index[aid] = {'sheet': rel, 'box': box, 'size': cell.size, 'kind': kind}
    print(f'{rel}: {W}x{H} -> ' + ', '.join(f'{a} {index[a]["size"][0]}x{index[a]["size"][1]}' for a in ids))
  json.dump(index, open(f'{OUT}/index.json', 'w'), indent=1)
  print(len(index), 'cells;', len(missing), 'sheets missing')

if __name__ == '__main__':
  main()
