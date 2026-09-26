"""Add Higgsfield results to assets/manifest.json.

    python tools/art/register.py batch.json

batch.json is a list of {"id": "monster.kraken", "job": "<job id>", "url": "<result url>"} with optional
"local" (defaults to <folder of the kind>/<name>.png, .jpg for opaque fits) and "fit" (see process.py).
Existing ids are replaced: the old job stays recoverable from git history.
"""

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MANIFEST = os.path.join(ROOT, 'assets', 'manifest.json')

FOLDER = {
    'ship': 'ships', 'monster': 'monsters', 'creature': 'creatures', 'prop': 'props', 'build': 'buildings',
    'icon': 'icons', 'fx': 'fx', 'part': 'fx', 'ui': 'ui', 'tex': 'textures', 'portrait': 'portraits',
    'card': 'cards', 'art': 'art', 'bg': 'art',
}
OPAQUE = {'tex', 'portrait', 'card', 'art', 'bg'}


def write_manifest(m):
    ids = list(m['assets'])
    width = max(len(i) for i in ids) + 3
    lines = ['{', f'  "$comment": {json.dumps(m["$comment"], ensure_ascii=False)},', f'  "cdn": {json.dumps(m["cdn"])},', '  "assets": {']
    for k, aid in enumerate(ids):
        key = f'"{aid}":'.ljust(width)
        body = json.dumps(m['assets'][aid], ensure_ascii=False).replace('{"', '{ "').replace('"}', '" }').replace('", "', '", "')
        lines.append(f'    {key}{body}{"," if k < len(ids) - 1 else ""}')
    lines += ['  }', '}', '']
    with open(MANIFEST, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


def main(path):
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    with open(path, encoding='utf-8') as f:
        batch = json.load(f)
    for b in batch:
        aid = b['id']
        kind, name = aid.split('.', 1)
        url = b['url']
        if not url.startswith(m['cdn']):
            raise SystemExit(f'{aid}: {url} is not on the manifest CDN')
        local = b.get('local') or f'{FOLDER[kind]}/{name}.{"jpg" if kind in OPAQUE else "png"}'
        entry = {'local': local, 'remote': url[len(m['cdn']):], 'job': b['job']}
        if b.get('fit'):
            entry['fit'] = b['fit']
        m['assets'][aid] = entry
        print(f'{aid} -> {local}')
    write_manifest(m)


if __name__ == '__main__':
    main(sys.argv[1])
