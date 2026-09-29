"""Wire art from the assets/future stockpile into the manifest, with no download and no generation.

    python tools/art/wire_future.py <fit|-> <id>[#2] ...     # e.g.  sprite:192 icon.fh_dutchman icon.fh_white_orca
    python tools/art/wire_future.py <fit|-> --family <name>   # every id of a family in assets/future/jobs.tsv

`#2` picks the `__v2` roll of an id. `-` keeps the kind's default fit (process.py). The PNG from assets/future is
copied into the originals cache (assets/raw/<remote>), registered with its job and CDN name, then baked.
"""

import csv
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FUTURE = os.path.join(ROOT, 'assets', 'future')
RAW = os.path.join(ROOT, 'assets', 'raw')


def rows():
    with open(os.path.join(FUTURE, 'jobs.tsv'), encoding='utf8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def stamps():
    """job -> YYYYMMDD_HHMMSS of its result, as fetch.py reads them."""
    out = {}
    p = os.path.join(FUTURE, 'urls.tsv')
    if os.path.exists(p):
        with open(p, encoding='utf8', newline='') as f:
            out.update({r['job']: r['ts'] for r in csv.DictReader(f, delimiter='\t')})
    tokens = open(os.path.join(FUTURE, 'ts.txt'), encoding='utf8').read().split()
    short = {pre: ts if '_' in ts else f'20260929_{ts}' for pre, ts in zip(tokens[::2], tokens[1::2])}
    for r in rows():
        out.setdefault(r['job'], short.get(r['job'][:8]))
    return out


def main(argv):
    fit, rest = argv[0], argv[1:]
    table = rows()
    if rest[:1] == ['--family']:
        want = [r['id'] for r in table if r['family'] == rest[1] and '#' not in r['id']]
    else:
        want = rest
    by_id = {r['id']: r for r in table}
    ts = stamps()
    with open(os.path.join(ROOT, 'assets', 'manifest.json'), encoding='utf8') as f:
        cdn = json.load(f)['cdn']
    batch = []
    for gid in want:
        r = by_id[gid]
        base, _, var = gid.partition('#')
        name = base.split('.', 1)[1] + (f'__v{var}' if var else '')
        src = os.path.join(FUTURE, r['family'], f'{name}.png')
        remote = f"hf_{ts[r['job']]}_{r['job']}.png"
        os.makedirs(RAW, exist_ok=True)
        shutil.copyfile(src, os.path.join(RAW, remote))
        entry = {'id': base, 'job': r['job'], 'url': cdn + remote}
        if fit != '-':
            entry['fit'] = fit
        batch.append(entry)
    path = os.path.join(RAW, 'b_future.json')
    with open(path, 'w', encoding='utf8') as f:
        json.dump(batch, f, indent=1)
    py = sys.executable
    subprocess.run([py, os.path.join(ROOT, 'tools', 'art', 'register.py'), path], check=True)
    subprocess.run([py, os.path.join(ROOT, 'tools', 'art', 'process.py'), '--force', *[b['id'] for b in batch]], check=True)


if __name__ == '__main__':
    main(sys.argv[1:])
