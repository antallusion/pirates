"""Cut GRAVETIDE's trailer from its seven shots (tools/art/videos.py, trailer_1..7), each faded into the next.

    python tools/art/cut_trailer.py      # assets/video/trailer.mp4 (720p H.264, a fade in and out)
    python tools/art/cut_trailer.py raids  # assets/video/trailer_raids.mp4, the seven attacks

Also: python tools/art/cut_trailer.py encode <raw.mp4> <id>  — one clip from Higgsfield into assets/video/<id>.mp4.
"""

import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'video')
FF = shutil.which('ffmpeg') or 'ffmpeg'
FP = shutil.which('ffprobe') or 'ffprobe'
SHOTS = ['trailer_1_fog', 'trailer_2_broadside', 'trailer_3_grapples', 'trailer_4_melee', 'trailer_5_kraken', 'trailer_6_dutchman', 'trailer_7_black_flag']
# The second trailer, «Набеги» (raids): seven attacks (tools/art/videos.py, the fifth reel).
RAIDS = ['raid_1_broadside', 'raid_2_chain', 'raid_3_fireship', 'raid_4_mortar', 'raid_5_ram', 'raid_6_town', 'raid_7_swivel']
FADE = 0.6


def probe(path):
    r = subprocess.run([FP, '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', path], capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    return float(j['format']['duration']), any(s['codec_type'] == 'audio' for s in j['streams'])


def encode(src, vid):
    """A clip as the game serves it: 1280×720, H.264, small, starting at once in a browser."""
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, vid + '.mp4')
    _, audio = probe(src)
    cmd = [FF, '-y', '-v', 'error', '-i', src, '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    cmd += ['-c:a', 'aac', '-b:a', '96k'] if audio else ['-an']
    subprocess.run(cmd + [dst], check=True)
    print(dst, os.path.getsize(dst) // 1024, 'KB')
    index()


def index():
    """assets/video/index.json: the films there are (the game shows only those, ui/cutscene.ts)."""
    ids = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.mp4'))
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(ids, f)


def trailer(shots=SHOTS, name='trailer'):
    paths = [os.path.join(OUT, s + '.mp4') for s in shots]
    missing = [p for p in paths if not os.path.exists(p)]
    if missing:
        raise SystemExit('missing: ' + ', '.join(os.path.basename(p) for p in missing))
    info = [probe(p) for p in paths]
    audio = all(a for _, a in info)
    cmd = [FF, '-y', '-v', 'error']
    for p in paths:
        cmd += ['-i', p]
    # Each shot fades into the next; the whole fades in from black and out to black.
    chain, last, t = [], '[0:v]', info[0][0]
    for i in range(1, len(paths)):
        out = f'[v{i}]'
        chain.append(f'{last}[{i}:v]xfade=transition=fade:duration={FADE}:offset={t - FADE:.3f}{out}')
        last, t = out, t + info[i][0] - FADE
    chain.append(f'{last}fade=t=in:st=0:d=0.8,fade=t=out:st={t - 1.0:.3f}:d=1.0[vout]')
    amap = []
    if audio:
        alast = '[0:a]'
        for i in range(1, len(paths)):
            aout = f'[a{i}]'
            chain.append(f'{alast}[{i}:a]acrossfade=d={FADE}{aout}')
            alast = aout
        amap = ['-map', alast, '-c:a', 'aac', '-b:a', '128k']
    dst = os.path.join(OUT, name + '.mp4')
    cmd += ['-filter_complex', ';'.join(chain), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    cmd += amap if audio else ['-an']
    subprocess.run(cmd + [dst], check=True)
    print(dst, f'{t:.1f} s', os.path.getsize(dst) // 1024, 'KB')
    index()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'encode':
        encode(sys.argv[2], sys.argv[3])
    elif len(sys.argv) > 1 and sys.argv[1] == 'raids':
        trailer(RAIDS, 'trailer_raids')
    else:
        trailer()
