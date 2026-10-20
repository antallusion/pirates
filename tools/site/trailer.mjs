// The home page's hero trailer (owner, 2026-10-20): «видос секунд на 15… эффектно смонтировать с переходами… прям много
// нарезок». A ~15 s silent loop cut from the game's own cutscenes (assets/video/*.mp4, 1280×720 @ 24 fps) by ffmpeg:
// calm → rising → a climax of fast cuts → a wide last shot that melts back into the first, so the loop has no seam.
//
//   node tools/site/trailer.mjs            the master, the web encodes and the posters into site/video/
//   node tools/site/trailer.mjs --sheet    plus a contact sheet of 12 frames (in the temp folder)
//   node tools/site/trailer.mjs --master   only the master (to look at the cut)
//
// FFMPEG may point at another ffmpeg. Every ffmpeg runs one at a time at below-normal priority on 4 threads at most
// (the owner's machine is busy enough). Re-cutting is editing SHOTS: a clip, its in-point, how long it is on screen,
// the transition into the next shot and its effects.

import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'assets', 'video');
const OUT = join(ROOT, 'site', 'video');
const TMP = join(os.tmpdir(), 'gt-trailer');
const FFMPEG = process.env.FFMPEG ?? 'C:/Users/enosi/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
const THREADS = '4';
const W = 1280, H = 720, FPS = 24;

/**
 * One shot: `clip` (assets/video/<clip>.mp4), `at` its in-point (s), `len` its time on screen (s), `x` the transition
 * into the next shot [xfade type, seconds] (a hard cut is ['cut']), `speed` > 1 runs it faster, `zoom` 'punch' (a hit:
 * 1.14 → 1 in a quarter second), 'in' (a slow push) or 'out' (a slow pull), `flash` 'gold' | 'white' (it comes out of a
 * flash of that colour).
 * @type {{ clip: string, at: number, len: number, x: [string, number?], speed?: number, zoom?: 'punch' | 'in' | 'out', flash?: 'gold' | 'white' }[]}
 */
const SHOTS = [
  // I. calm: the fog, the deep, the ghosts
  { clip: 'trailer_1_fog', at: 1.9, len: 1.3, x: ['fade', 0.35], zoom: 'in' },
  { clip: 'cut_abyss', at: 3.3, len: 1.0, x: ['fade', 0.3], zoom: 'in' },
  { clip: 'cut_hollow_admiral', at: 2.9, len: 1.0, x: ['smoothleft', 0.25] },
  { clip: 'cut_isle_crystal', at: 3.3, len: 0.8, x: ['fadeblack', 0.3] },
  { clip: 'cut_descent', at: 3.1, len: 0.9, x: ['cut'], zoom: 'in' },
  // II. rising: the Dutchman, the storm, the broadside, the beasts, the grapples
  { clip: 'trailer_6_dutchman', at: 3.5, len: 0.75, x: ['fadewhite', 0.12] },
  { clip: 'cut_black_storm', at: 0.3, len: 0.6, x: ['cut'], flash: 'white' },
  { clip: 'trailer_2_broadside', at: 3.0, len: 0.65, x: ['slideleft', 0.18] },
  { clip: 'cut_ancient_leviathan', at: 2.1, len: 0.65, x: ['cut'] },
  { clip: 'cut_abyss_eye_down', at: 0.4, len: 0.6, x: ['zoomin', 0.2], zoom: 'punch' },
  { clip: 'cut_treasure', at: 3.8, len: 0.55, x: ['cut'], flash: 'gold' },
  { clip: 'trailer_3_grapples', at: 2.1, len: 0.55, x: ['smoothleft', 0.15], speed: 1.2 },
  // III. the climax: hard cuts on the beat, flashes on the hits
  { clip: 'trailer_4_melee', at: 3.0, len: 0.45, x: ['cut'], speed: 1.3, flash: 'white' },
  { clip: 'raid_1_broadside', at: 3.5, len: 0.45, x: ['cut'], speed: 1.3, zoom: 'punch' },
  { clip: 'trailer_5_kraken', at: 3.9, len: 0.45, x: ['cut'], speed: 1.2 },
  { clip: 'cut_cinder_ray_down', at: 0.4, len: 0.4, x: ['cut'], speed: 1.3, flash: 'gold' },
  { clip: 'raid_3_fireship', at: 1.0, len: 0.4, x: ['cut'], speed: 1.3 },
  { clip: 'cut_white_whale', at: 2.3, len: 0.45, x: ['fadewhite', 0.1], speed: 1.2, zoom: 'punch' },
  { clip: 'raid_7_swivel', at: 2.5, len: 0.4, x: ['cut'], speed: 1.3 },
  { clip: 'cut_storm', at: 2.2, len: 0.4, x: ['cut'], speed: 1.3, flash: 'white' },
  { clip: 'cut_kraken_boss', at: 2.2, len: 0.45, x: ['cut'], speed: 1.3, zoom: 'punch' },
  { clip: 'cut_old_tithe', at: 2.4, len: 0.4, x: ['cut'], speed: 1.3 },
  { clip: 'cut_powder_night', at: 2.6, len: 0.5, x: ['fadeblack', 0.25], speed: 1.2, flash: 'gold' },
  // IV. the last wide shot: the black flag over the burning sea, melting back into the fog
  { clip: 'trailer_7_black_flag', at: 2.6, len: 1.9, x: ['cut'], zoom: 'out' },
];
/** The loop: the last LOOP seconds dissolve into the first ones, so the end frame is the start frame. */
const LOOP = 0.5;

/** The site's grade: crushed blacks, teal shadows, brass highlights, a soft vignette, a light luma grain. */
const GRADE = [
  'eq=contrast=1.1:saturation=0.9:gamma=0.98',
  'colorbalance=rs=-0.05:gs=0.0:bs=0.06:rm=-0.02:gm=0.0:bm=0.02:rh=0.07:gh=0.035:bh=-0.05',
  "curves=master='0/0 0.08/0.03 0.5/0.49 0.85/0.86 1/0.97'",
  'vignette=angle=PI/4.6',
  'noise=c0s=4:c0f=t+u',
].join(',');

const FLASH = { gold: '0xFFD27A', white: '0xFFFFFF' };

const run = (args) =>
  new Promise((ok, no) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', process.env.FFLOG ?? 'error', '-y', ...args], { stdio: ['ignore', 'inherit', process.env.FFLOG ? 'inherit' : 'pipe'] });
    try { os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* not ours to lower */ }
    let err = '';
    p.stderr?.on('data', (d) => (err += d));
    p.on('close', (c) => (c ? no(new Error(`ffmpeg ${c}: ${err.slice(-1500)}`)) : ok()));
  });

const r3 = (n) => Math.round(n * 1000) / 1000;
const r6 = (n) => n.toFixed(6);

/** The cut: every shot trimmed, timed, zoomed and flashed, the transitions chained, the grade, the seamless loop. */
function graph() {
  // everything is counted in whole frames, so the transitions' offsets fall on frames and never drift
  const fr = (sec) => Math.max(1, Math.round(sec * FPS));
  const xf = (s) => (s.x[0] === 'cut' ? 1 : fr(s.x[1]));
  const inputs = [];
  const chains = [];
  let total = 0; // the chained stream's length so far, in frames
  SHOTS.forEach((s, i) => {
    const last = i === SHOTS.length - 1;
    const n = fr(s.len) + (last ? 0 : xf(s)); // a shot runs on under the transition into the next one
    const D = r6(n / FPS);
    const speed = s.speed ?? 1;
    inputs.push('-ss', String(s.at), '-t', String(r3((n / FPS) * speed + 0.2)), '-i', join(SRC, `${s.clip}.mp4`));
    const f = [`setpts=(PTS-STARTPTS)/${speed}`, `fps=${FPS}`, `trim=end_frame=${n}`, 'setpts=PTS-STARTPTS'];
    if (s.zoom === 'punch') f.push(`scale=w='trunc(${W}*(1+0.14*max(0\,1-t/0.25))/2)*2':h=-2:eval=frame:flags=bicubic`);
    else if (s.zoom === 'in') f.push(`scale=w='trunc(${W}*(1+0.07*t/${D})/2)*2':h=-2:eval=frame:flags=bicubic`);
    else if (s.zoom === 'out') f.push(`scale=w='trunc(${W}*(1.09-0.09*t/${D})/2)*2':h=-2:eval=frame:flags=bicubic`);
    if (s.zoom) f.push(`crop=${W}:${H}`);
    else f.push(`scale=${W}:${H}`);
    if (s.flash) f.push(`fade=t=in:st=0:d=0.16:color=${FLASH[s.flash]}`);
    f.push('format=yuv420p', 'setsar=1', 'settb=AVTB');
    chains.push(`[${i}:v]${f.join(',')}[s${i}]`);
    if (i === 0) total = n;
    else {
      const prev = SHOTS[i - 1];
      const type = prev.x[0] === 'cut' ? 'fade' : prev.x[0];
      const off = total - xf(prev);
      chains.push(`[${i === 1 ? 's0' : `x${i - 1}`}][s${i}]xfade=transition=${type}:duration=${r6(xf(prev) / FPS)}:offset=${r6(off / FPS)}[x${i}]`);
      total = off + n;
    }
  });
  const end = `x${SHOTS.length - 1}`;
  const loop = fr(LOOP);
  const len = total - loop; // frames
  chains.push(`[${end}]${GRADE},split[ga][gb]`);
  chains.push(`[ga]trim=start_frame=${loop},setpts=PTS-STARTPTS[main]`);
  // (the head fades in over the tail by its alpha: an xfade ends the film early when its second input is this short)
  const off = r6((len - loop) / FPS);
  chains.push(`[gb]trim=end_frame=${loop},setpts=PTS-STARTPTS+${off}/TB,format=yuva420p,fade=t=in:st=${off}:d=${r6(loop / FPS)}:alpha=1[head]`);
  chains.push(`[main][head]overlay=eof_action=pass:format=yuv420,trim=end_frame=${len},format=yuv420p[v]`);
  return { inputs, filter: chains.join(';\n'), len: len / FPS };
}

const size = (f) => `${(statSync(f).size / 1048576).toFixed(2)} MB`;

async function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const { inputs, filter, len } = graph();
  const master = join(TMP, 'master.mp4');
  console.log(`cut: ${SHOTS.length} shots, ${len.toFixed(2)} s`);
  await run(['-threads', THREADS, '-filter_threads', THREADS, ...inputs, '-filter_complex', filter, '-map', '[v]', '-an', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-threads', THREADS, master]);
  if (process.argv.includes('--master')) return console.log(`master: ${master}`);

  // the vertical crop for phones held upright (the hero is taller than wide there): the middle of the frame, unscaled
  const VERT = 'crop=432:720:(iw-432)/2:0';
  const x264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-g', String(FPS * 2), '-an', '-threads', THREADS];
  const vp9 = (crf) => ['-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-g', String(FPS * 2), '-pix_fmt', 'yuv420p', '-an', '-threads', THREADS];
  const jobs = [
    ['trailer-1280.mp4', `scale=${W}:${H}`, x264(26)],
    ['trailer-1280.webm', `scale=${W}:${H}`, vp9(38)],
    ['trailer-960.mp4', 'scale=960:540:flags=lanczos', x264(29)],
    ['trailer-960.webm', 'scale=960:540:flags=lanczos', vp9(40)],
    ['trailer-v.mp4', VERT, x264(27)],
    ['trailer-v.webm', VERT, vp9(40)],
  ];
  for (const [name, vf, codec] of jobs) {
    await run(['-threads', THREADS, '-i', master, '-vf', vf, ...codec, join(OUT, name)]);
    console.log(`${name}: ${size(join(OUT, name))}`);
  }
  // the posters: the loop's first frame (it is also the last), as AVIF and JPEG, wide and upright
  for (const [name, vf] of [['trailer-poster', `scale=${W}:${H}`], ['trailer-poster-v', VERT]]) {
    await run(['-threads', THREADS, '-i', master, '-frames:v', '1', '-vf', vf, '-q:v', '3', join(OUT, `${name}.jpg`)]);
    await run(['-threads', THREADS, '-i', master, '-frames:v', '1', '-vf', vf, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '20', '-cpu-used', '6', join(OUT, `${name}.avif`)]);
    console.log(`${name}: ${size(join(OUT, `${name}.jpg`))} jpg, ${size(join(OUT, `${name}.avif`))} avif`);
  }
  if (process.argv.includes('--sheet')) {
    const sheet = join(TMP, 'contact-sheet.jpg');
    await run(['-threads', THREADS, '-i', join(OUT, 'trailer-1280.mp4'), '-vf', `fps=12/${len.toFixed(3)},scale=426:240,tile=4x3:padding=4:color=0x07090f`, '-frames:v', '1', '-q:v', '3', sheet]);
    console.log(`sheet: ${sheet}`);
  }
}

await main();
