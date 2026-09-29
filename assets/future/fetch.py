"""Download finished future-art jobs and rebuild INDEX.md.

jobs.tsv: id, family, job  (a second variant of an id is written as `<id>#2`)
urls.tsv: job, ts          (ts is the YYYYMMDD_HHMMSS in the result URL from jobs_wait)
Files land in assets/future/<family>/<name>.png; nothing here is wired into the game.
"""
import csv, json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

TARGET = {
    'omen': ('icon.omen_<id>', 'shared/src/data/omens.ts OMENS', 'omen notice and journal; currently no art (audit: omen 0/10)'),
    'wonder': ('icon.wonder_<kind>', 'shared/src/data/wonders.ts WONDER_KIND_IDS', 'Atlas of Wonders in the journal and map star; currently no art (0/8)'),
    'holiday': ('card.holiday_<id>', 'shared/src/data/holidays.ts HOLIDAYS', 'holiday announcement card; currently no art (0/4)'),
    'boss': ('monster.<id>', 'shared/src/data/bosses.ts BOSSES', 'boss sprite at sea, client/src/render/beasts.ts (monster.${id}); top-down, head up'),
    'figurehead': ('icon.fh_<id>', 'shared/src/data/shipbuild.ts FIGUREHEADS', 'figurehead icon at the shipyard; the last 2 of 11 missing'),
    'texture': ('tex.<id>', 'client/src/ui/skin.ts SKIN', 'UI skin texture, already requested by skin.ts but missing'),
    'talent': ('icon.talent_<id>', 'shared/src/data/talents.ts TALENTS', 'node icon in the talent tree, client/src/ui/talents.ts (needs a lookup; nodes have no icons today)'),
    'trait': ('icon.trait_<id>', 'shared/src/data/crew.ts TRAITS', 'crew / officer trait badge'),
    'deed': ('icon.deed_<id>', 'shared/src/data/deeds.ts DEEDS', 'deed (achievement) badge'),
    'boon': ('icon.boon_<id>', 'shared/src/data/descent.ts BOONS', 'boon choice in the Descent'),
    'happening': ('card.happen_<kind>', 'shared/src/data/happenings.ts HAPPENING_KINDS', 'world-event announcement card'),
    'set': ('icon.set_<id>', 'shared/src/data/items.ts SETS', 'item-set emblem in the gear window'),
    'variant': ('icon.variant_<id>', 'shared/src/data/shipbuild.ts VARIANTS', 'hull variant choice at the shipyard'),
    'wood': ('icon.wood_<id>', 'shared/src/data/shipbuild.ts WOODS', 'shipbuilding timber choice'),
    'harness': ('icon.harness_<id>', 'shared/src/data/companions.ts HARNESSES', 'orca companion harness'),
    'service': ('icon.service_<id>', 'shared/src/data/marque.ts SERVICES', 'letter-of-marque service emblem'),
}


NOTES = [
    '- `__v2` files are a second roll of the same prompt (gap families only); they come out near-identical, keep either.',
    '- Re-rolled after Higgsfield moderation ("nsfw" on blood/skeletons): talent_brd_terror, talent_brd_blooded, talent_shp_boneyard_secrets, trait_bloodthirsty.',
    '- set_bounty_hunter: faint letter-like marks on the rolled poster; check at icon size or re-roll.',
    '- boon_black_water is almost black by design; may need lifting when baked.',
    '- Baking hints: square scene icons (talent, trait, deed, boon, omen, wonder, variant) → `fit: opaque:192` like `icon.ab_*`; '
    'transparent objects (set, wood, harness, service, figurehead) → `sprite:192`; bosses → monster sprite like `monster.leviathan`; '
    'holiday / happening → 16:9 cards like `card.enc_*`; textures → `tex.*` as in skin.ts.',
    '- Code still needed before these show: a talent-node icon lookup in client/src/ui/talents.ts, and call sites for omen, wonder, '
    'holiday, happening, trait, deed, boon, set, variant, wood, harness and service art. Only boss, figurehead and texture ids are already requested by the game.',
]


def read(name):
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        return []
    with open(p, encoding='utf8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def main():
    jobs = read('jobs.tsv')
    with open(os.path.join(HERE, '..', 'manifest.json'), encoding='utf8') as f:
        cdn = json.load(f)['cdn']
    urls = {r['job']: f"{cdn}hf_{r['ts']}_{r['job']}.png" for r in read('urls.tsv')}
    # ts.txt: "<first 8 chars of job> <HHMMSS>" per line, date 20260929 unless given as YYYYMMDD_HHMMSS
    tp = os.path.join(HERE, 'ts.txt')
    if os.path.exists(tp):
        short = {}
        tokens = open(tp, encoding='utf8').read().split()
        for pre, ts in zip(tokens[::2], tokens[1::2]):
            short[pre] = ts if '_' in ts else f'20260929_{ts}'
        for j in jobs:
            ts = short.get(j['job'][:8])
            if ts and j['job'] not in urls:
                urls[j['job']] = f"{cdn}hf_{ts}_{j['job']}.png"
    rows = []
    for j in jobs:
        gid, fam, job = j['id'], j['family'], j['job']
        base, _, var = gid.partition('#')
        name = base.split('.', 1)[1] + (f'__v{var}' if var else '')
        rel = f'{fam}/{name}.png'
        dst = os.path.join(HERE, rel)
        url = urls.get(job)
        if url and not os.path.exists(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            urllib.request.urlretrieve(url, dst)
        rows.append((fam, base, rel, job, os.path.exists(dst)))

    out = ['# Future art (not wired into the game)', '',
           'Generated with Higgsfield `gpt_image_2_5`, 2K, quality high, in the house formulas of docs/06 §17.4.',
           'Each file is an original; bake with tools/art/process.py when it is wired in. `job` restores the prompt (`job_display`).',
           'PNG files are gitignored (OneDrive keeps them); this index, jobs.tsv and ts.txt are enough to re-download (python fetch.py).', '']
    done = sum(r[4] for r in rows)
    out.append(f'**{done} / {len(rows)} downloaded.**')
    out += ['', '## Notes', *NOTES]
    for fam in TARGET:
        fr = [r for r in rows if r[0] == fam]
        if not fr:
            continue
        key, data, where = TARGET[fam]
        out += ['', f'## {fam} — `{key}` ({len(fr)})', f'Data: `{data}`. Goes to: {where}.', '',
                '| id | file | job |', '|---|---|---|']
        out += [f'| `{b}` | {rel if ok else "_pending_"} | `{job}` |' for _, b, rel, job, ok in fr]
    with open(os.path.join(HERE, 'INDEX.md'), 'w', encoding='utf8') as f:
        f.write('\n'.join(out) + '\n')
    print(f'{done}/{len(rows)} downloaded')


if __name__ == '__main__':
    main()
