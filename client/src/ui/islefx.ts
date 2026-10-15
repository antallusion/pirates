// The island screen alive (owner, 2026-10-15: «ты можешь программно анимировать как-то воду и локацию острова где
// стройка, сейчас все очень статично»). No new art: the painted map and the buildings' own pictures, moved by code.
//  - The sea (WebGL over the painted map): the water drawn through a slow scrolling ripple far from the shore, a swell
//    of light and shade, glints, the moon's path shimmering under the moon, foam lapping at the shore, the moored boat
//    bobbing at the pier. The land and the pier stand still (a hand-set outline of each map's island: MAP_FX).
//  - The air (a canvas over the buildings): chimney smoke, the windows' and the lanterns' warm flicker (found in the
//    pictures themselves: their lit pixels), pennants on the tall buildings, dust and hammer sparks on the plots at work,
//    a golden burst when a work is done, fog wisps, gulls or bats, and the biome's weather — snow on the ice, embers on
//    the volcano, fireflies in the jungle, fog on the temperate isle.
// The rules: no allocation per frame (the particles live in typed arrays, the paths are drawn from them), the particles
// capped, the loop stops when the scene closes or the tab hides, nothing moves for a captain who asks for less motion,
// and the quality steps down by itself when the frames run long (a weak phone).

import { ISO_H, ISO_W } from '../../../shared/src/data/isleiso.ts';
import type { IsoMap, Pt } from '../../../shared/src/data/isleiso.ts';
import { settings } from '../settings.ts';

/** Each map's living places, in its picture's pixels (set by eye: assets/raw/audit/load/poly.png). */
interface MapFx {
  /** The island and the pier: the sea's ripple stays off them. */
  land: Pt[][];
  /** The moon's path on the water: its x, from y0 to y1. */
  moon: [number, number, number];
  /** The moored boat (bobs at the pier). */
  boat: [number, number, number, number] | null;
  /** Lanterns, lava: warm lights that flicker. */
  lights: Pt[];
  /** Vents that steam. */
  vents: Pt[];
}

const MAP_FX: Record<IsoMap, MapFx> = {
  temperate: {
    moon: [190, 70, 360], boat: [282, 742, 350, 792], lights: [[186, 690], [283, 742]], vents: [],
    land: [[[500, 120], [660, 30], [960, 30], [1120, 80], [1200, 110], [1300, 200], [1400, 290], [1475, 330], [1480, 450], [1460, 560], [1470, 700], [1400, 780], [1330, 820], [1250, 900], [1180, 940], [1030, 945], [920, 890], [800, 940], [680, 935], [600, 860], [470, 780], [360, 720], [300, 700], [200, 680], [140, 640], [60, 560], [20, 510], [80, 440], [60, 340], [130, 280], [260, 220], [380, 200]],
      [[100, 700], [300, 630], [470, 640], [470, 720], [350, 800], [150, 810], [95, 760]]],
  },
  ice: {
    moon: [165, 90, 330], boat: null, lights: [[117, 612], [238, 700]], vents: [],
    land: [[[380, 180], [540, 40], [720, 20], [860, 80], [1000, 130], [1150, 200], [1300, 210], [1400, 300], [1480, 330], [1500, 450], [1460, 560], [1470, 700], [1380, 760], [1300, 790], [1200, 820], [1050, 860], [900, 850], [750, 880], [620, 860], [500, 780], [400, 700], [300, 660], [150, 600], [80, 560], [70, 470], [140, 400], [180, 330], [270, 250]],
      [[60, 620], [240, 560], [300, 620], [280, 720], [80, 720], [40, 680]]],
  },
  volcanic: {
    moon: [150, 130, 340], boat: null, lights: [[190, 735], [330, 690], [1088, 108], [1130, 205], [1290, 655], [1262, 728], [345, 505], [440, 742], [1172, 560], [575, 200]],
    vents: [[1108, 92], [1150, 188], [1330, 520], [1290, 560], [330, 500]],
    land: [[[280, 200], [440, 90], [640, 110], [900, 60], [1000, 0], [1100, 60], [1250, 120], [1350, 170], [1430, 220], [1450, 400], [1520, 500], [1500, 580], [1450, 700], [1380, 830], [1250, 820], [1100, 880], [1000, 920], [860, 900], [700, 860], [560, 780], [420, 720], [300, 680], [160, 620], [60, 590], [40, 420], [150, 360], [200, 260]],
      [[180, 700], [400, 670], [420, 720], [260, 790], [180, 770]]],
  },
  jungle: {
    moon: [180, 0, 150], boat: null, lights: [[215, 612], [101, 668]], vents: [],
    land: [[[380, 150], [560, 60], [700, 0], [880, 10], [1000, 90], [1140, 140], [1260, 170], [1350, 260], [1440, 330], [1480, 450], [1500, 560], [1470, 680], [1320, 730], [1220, 800], [1100, 830], [1000, 880], [880, 850], [740, 800], [600, 760], [450, 720], [330, 680], [170, 580], [60, 500], [40, 430], [90, 350], [160, 250], [260, 180]],
      [[90, 640], [260, 580], [350, 630], [280, 690], [120, 700], [80, 680]], [[300, 40], [330, 30], [400, 60], [440, 120], [300, 130]]],
  },
};

/** The sheets whose chimneys smoke, and the tall ones that fly a pennant (the hall and the fort have painted flags). */
const SMOKE = new Set(['forge', 'smokehouse', 'tavern', 'residents_house', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5', 'dw6', 'dw7', 'distillery', 'try_works', 'tar', 'workshop', 'fishing_village', 'sawmill', 'barracks', 'keep']);
const PENNANT = new Set(['keep', 'signal_tower', 'guild', 'chart_house', 'trophy_hall', 'market', 'shipyard', 'dry_dock']);

/** A building as the air draws about it. */
export interface FxSpot {
  key: string;
  el: HTMLImageElement;
  sheet: string;
  /** At work: scaffolding, dust and sparks. */
  work: boolean;
}

// ------------------------------------------------------------------------------------------------ the particles
// One pool of typed arrays; a slot is free when its age is past its life.
const CAP = 260;
const K_SMOKE = 1, K_DUST = 2, K_SPARK = 3, K_GOLD = 4, K_SNOW = 5, K_EMBER = 6, K_FLY = 7;
const pk = new Uint8Array(CAP);
const px = new Float32Array(CAP), py = new Float32Array(CAP), pvx = new Float32Array(CAP), pvy = new Float32Array(CAP);
const page = new Float32Array(CAP), plife = new Float32Array(CAP), psize = new Float32Array(CAP), pseed = new Float32Array(CAP);
let pFree = 0;

function spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number): number {
  for (let n = 0; n < CAP; n++) {
    const i = (pFree + n) % CAP;
    if (page[i] >= plife[i]) {
      pk[i] = kind;
      px[i] = x;
      py[i] = y;
      pvx[i] = vx;
      pvy[i] = vy;
      page[i] = 0;
      plife[i] = life;
      psize[i] = size;
      pseed[i] = Math.random() * 100;
      pFree = (i + 1) % CAP;
      return i;
    }
  }
  return -1;
}

/** How many of a kind are alive (the biome's weather keeps to its cap). */
function alive(kind: number): number {
  let n = 0;
  for (let i = 0; i < CAP; i++) if (pk[i] === kind && page[i] < plife[i]) n++;
  return n;
}

/** A soft round sprite drawn once (smoke, dust, glow). */
function softSprite(r: number, g: number, b: number, size = 64, core = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  if (core) gr.addColorStop(core, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  return c;
}

// ------------------------------------------------------------------------------------------------ the sea's shader

const VS = `attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}`;
const FS = `precision mediump float;
uniform sampler2D uMap,uMask;uniform float uT;uniform vec3 uMoon;uniform vec4 uBoat;uniform float uQ;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
void main(){
  vec4 m=texture2D(uMask,v);float w=m.r;float far=smoothstep(.62,.9,m.g)*w;
  vec2 uv=v;
  if(far>.001){vec2 p=v*vec2(46.,70.);float a=n(p+vec2(uT*.32,uT*.2));float b=n(p*1.7-vec2(uT*.25,-uT*.29));uv+=(vec2(a,b)-.5)*vec2(.0021,.0032)*far;}
  if(uBoat.z>0.){vec2 q=(v-uBoat.xy)/uBoat.zw;float inb=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);float e=min(min(q.x,1.-q.x),min(q.y,1.-q.y));inb*=smoothstep(0.,.18,e);uv.y+=sin(uT*1.6)*.0013*inb;uv.x+=sin(uT*1.05+.7)*.0005*inb;}
  vec4 c=texture2D(uMap,uv);
  if(w>.001){
    float sw=sin(v.x*13.+v.y*21.-uT*.55)*.5+.5;c.rgb*=1.+(sw-.5)*.07*far;
    float dy=v.y-uMoon.y;float near=exp(-abs(v.x-uMoon.x)*7.)*step(0.,dy);float g=n(v*vec2(520.,260.)+vec2(uT*1.4,-uT*.6))*n(v*vec2(150.,90.)-vec2(uT*.3,0.));float gl=smoothstep(.5,.8,g)*far*uQ*(.25+.75*near);
    float wid=.012+dy*.07;float path=smoothstep(wid,0.,abs(v.x-uMoon.x+sin(v.y*90.+uT)*.003))*step(0.,dy)*smoothstep(uMoon.z,uMoon.y+(uMoon.z-uMoon.y)*.4,v.y);
    float sh=n(vec2(v.x*170.,v.y*520.-uT*2.2));
    float shore=w*(1.-smoothstep(.5,.78,m.g));float lap=pow(sin(uT*1.25-m.g*34.)*.5+.5,3.);float fo=smoothstep(.45,.8,n(v*vec2(280.,420.)+vec2(uT*.15,0.)));
    c.rgb+=vec3(.72,.8,.88)*(gl*.22+path*smoothstep(.5,.85,sh)*.5*w+shore*lap*fo*.16);
  }
  gl_FragColor=c;
}`;

class SeaGL {
  canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private tMap: WebGLTexture;
  private tMask: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private fx: MapFx | null = null;
  lost = false;

  static make(): SeaGL | null {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'low-power' }) as WebGLRenderingContext | null;
      return gl ? new SeaGL(c, gl) : null;
    } catch {
      return null;
    }
  }

  private constructor(c: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = c;
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
    this.prog = p;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const k of ['uMap', 'uMask', 'uT', 'uMoon', 'uBoat', 'uQ']) this.u[k] = gl.getUniformLocation(p, k);
    const tex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tMap = tex();
    this.tMask = tex();
    gl.uniform1i(this.u.uMap, 0);
    gl.uniform1i(this.u.uMask, 1);
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  /** The map's picture and its sea's mask (once per map). */
  setMap(img: HTMLImageElement, fx: MapFx, scale: number): void {
    const gl = this.gl;
    this.fx = fx;
    this.canvas.width = Math.round(ISO_W * scale);
    this.canvas.height = Math.round(ISO_H * scale);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tMap);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tMask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MW, MH, 0, gl.RGBA, gl.UNSIGNED_BYTE, seaMask(fx));
    const b = fx.boat;
    gl.uniform4f(this.u.uBoat, b ? b[0] / ISO_W : 0, b ? b[1] / ISO_H : 0, b ? (b[2] - b[0]) / ISO_W : 0, b ? (b[3] - b[1]) / ISO_H : 0);
    gl.uniform3f(this.u.uMoon, fx.moon[0] / ISO_W, fx.moon[1] / ISO_H, fx.moon[2] / ISO_H);
  }

  draw(t: number, q: number): void {
    if (this.lost || !this.fx) return;
    const gl = this.gl;
    gl.uniform1f(this.u.uT, t);
    gl.uniform1f(this.u.uQ, q);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/** The sea's mask (MW × MH): R the water (softened at the shore), G the water far from the shore (a wide blur: about
 *  0.5 at the shoreline, 1 out at sea). */
const MW = 384, MH = 256;
const masks = new Map<MapFx, Uint8Array>();
function seaMask(fx: MapFx): Uint8Array {
  const hit = masks.get(fx);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = MW;
  c.height = MH;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.fillStyle = '#fff';
  x.fillRect(0, 0, MW, MH);
  x.fillStyle = '#000';
  x.scale(MW / ISO_W, MH / ISO_H);
  for (const poly of fx.land) {
    x.beginPath();
    poly.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.closePath();
    x.fill();
  }
  const d = x.getImageData(0, 0, MW, MH).data;
  const w = new Float32Array(MW * MH);
  for (let i = 0; i < w.length; i++) w[i] = d[i * 4] / 255;
  const r = blur(w, 2), g = blur(blur(w, 9), 9);
  const out = new Uint8Array(MW * MH * 4);
  for (let i = 0; i < w.length; i++) {
    out[i * 4] = Math.round(r[i] * 255);
    out[i * 4 + 1] = Math.round(g[i] * 255);
    out[i * 4 + 3] = 255;
  }
  masks.set(fx, out);
  return out;
}

/** A box blur of radius r, rows then columns. */
function blur(src: Float32Array, r: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < MH; y++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[y * MW + Math.min(MW - 1, Math.max(0, k))];
    for (let xx = 0; xx < MW; xx++) {
      tmp[y * MW + xx] = s / n;
      s += src[y * MW + Math.min(MW - 1, xx + r + 1)] - src[y * MW + Math.max(0, xx - r)];
    }
  }
  for (let xx = 0; xx < MW; xx++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[Math.min(MH - 1, Math.max(0, k)) * MW + xx];
    for (let y = 0; y < MH; y++) {
      out[y * MW + xx] = s / n;
      s += tmp[Math.min(MH - 1, y + r + 1) * MW + xx] - tmp[Math.max(0, y - r) * MW + xx];
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ a building's look

/** What a building's picture shows the air: its highest point (a chimney, a mast) and its lit windows, as shares. */
interface Look {
  top: [number, number];
  lights: [number, number][];
}
const looks = new Map<string, Look | null>();

function lookOf(img: HTMLImageElement): Look | null {
  const key = img.currentSrc || img.src;
  if (looks.has(key)) return looks.get(key)!;
  if (!img.complete || !img.naturalWidth) return null;
  let look: Look | null = null;
  try {
    const W = 72, H = Math.max(8, Math.round((72 * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    let top: [number, number] = [0.5, 0.2];
    find: for (let y = 0; y < H; y++) {
      for (let xx = Math.floor(W * 0.2); xx < W * 0.8; xx++) {
        if (d[(y * W + xx) * 4 + 3] > 150) {
          top = [(xx + 0.5) / W, (y + 0.5) / H];
          break find;
        }
      }
    }
    // the lit windows and torches: the warm bright pixels, gathered in cells of 6 × 6, the brightest few
    const cells = new Map<number, { n: number; x: number; y: number }>();
    for (let y = 0; y < H; y++) {
      for (let xx = 0; xx < W; xx++) {
        const i = (y * W + xx) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a > 200 && r > 175 && g > 95 && r - b > 95) {
          const k = Math.floor(y / 6) * 64 + Math.floor(xx / 6);
          const cl = cells.get(k) ?? { n: 0, x: 0, y: 0 };
          cl.n++;
          cl.x += xx;
          cl.y += y;
          cells.set(k, cl);
        }
      }
    }
    const lights = [...cells.values()].sort((a, b) => b.n - a.n).slice(0, 5).map((cl) => [(cl.x / cl.n + 0.5) / W, (cl.y / cl.n + 0.5) / H] as [number, number]);
    look = { top, lights };
  } catch {
    look = null;
  }
  looks.set(key, look);
  return look;
}

/** A building in the air's lists: where it stands now (map px) and what it does. */
interface Emit {
  key: string;
  el: HTMLImageElement;
  sheet: string;
  work: boolean;
  /** Its box in map px. */
  x: number;
  y: number;
  w: number;
  h: number;
  look: Look | null;
  src: string;
  next: number;
}

/** A building's box from its picture's place (none while its new picture is not in). */
function boxOf(e: Emit): void {
  const el = e.el;
  const k = Number(el.dataset.k) || 0;
  const ready = el.complete && el.naturalWidth > 0;
  e.x = parseFloat(el.style.left) || 0;
  e.y = parseFloat(el.style.top) || 0;
  e.w = !ready ? 0 : k ? el.naturalWidth * k : parseFloat(el.style.width) || 0;
  e.h = !ready ? 0 : k ? el.naturalHeight * k : parseFloat(el.style.height) || 0;
}

// ------------------------------------------------------------------------------------------------ the scene's fx

export class IsleFx {
  private world: HTMLElement;
  private sea: SeaGL | null = null;
  private seaFailed = false;
  private air: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private mapImg: HTMLImageElement | null = null;
  private map: IsoMap = 'temperate';
  private fx: MapFx = MAP_FX.temperate;
  private emits: Emit[] = [];
  private glows: { x: number; y: number; r: number; ph: number; a: number }[] = [];
  private pennants: { x: number; y: number; s: number; ph: number }[] = [];
  private bursts: { x: number; y: number; t0: number }[] = [];
  private wisps = new Float32Array(16 * 5);
  private birds = new Float32Array(5 * 5);
  private raf = 0;
  private running = false;
  private t0 = performance.now();
  private last = 0;
  private frameN = 0;
  /** Quality: 1 full, 0.5 lighter (fewer particles, the sea at 30 fps on a lower canvas). */
  private q = 1;
  private slow = 0;
  private spr: Record<'smoke' | 'dust' | 'glow' | 'gold' | 'fog' | 'ember' | 'fly', HTMLCanvasElement>;
  /** QA: frames and their times. */
  stats = { fps: 0, frameMs: 0, particles: 0, q: 1, sea: false };
  private fpsN = 0;
  private fpsT = 0;
  private busyMs = 0;

  constructor(world: HTMLElement) {
    this.world = world;
    this.air = document.createElement('canvas');
    this.air.className = 'is-air';
    this.air.setAttribute('aria-hidden', 'true');
    this.g = this.air.getContext('2d')!;
    this.spr = {
      smoke: softSprite(150, 150, 152, 64, 0.3),
      dust: softSprite(150, 122, 88, 48, 0.25),
      glow: softSprite(255, 168, 70, 64, 0.15),
      gold: softSprite(255, 214, 120, 96, 0.2),
      fog: softSprite(170, 180, 190, 128, 0.35),
      ember: softSprite(255, 120, 40, 16, 0.4),
      fly: softSprite(210, 255, 120, 16, 0.35),
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.halt();
      else if (this.running) this.loop();
    });
  }

  /** Whether the scene may move at all (a captain who asks for less motion sees it still). */
  static allowed(): boolean {
    return !settings().reduceMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** The map under the scene, its picture decoded. */
  setMap(map: IsoMap, img: HTMLImageElement): void {
    this.map = map;
    this.fx = MAP_FX[map];
    this.mapImg = img;
    this.setSize();
    if (!this.seaFailed && settings().webgl !== false) {
      try {
        this.sea ??= SeaGL.make();
        if (this.sea) {
          this.sea.canvas.className = 'is-water';
          this.sea.setMap(img, this.fx, this.q < 1 ? 0.6 : 1);
          if (!this.sea.canvas.parentElement) img.after(this.sea.canvas);
        }
      } catch {
        this.seaFailed = true;
        this.sea?.canvas.remove();
        this.sea = null;
      }
    }
    img.style.visibility = this.sea && this.running ? 'hidden' : '';
    if (!this.air.parentElement) this.world.append(this.air);
    // the map's lights and the weather start afresh
    this.glows.length = 0;
    for (const [x, y] of this.fx.lights) this.glows.push({ x, y, r: 26, ph: Math.random() * 10, a: 0.55 });
    this.seedAmbience();
    this.relight();
  }

  private setSize(): void {
    const s = this.q < 1 ? 0.5 : 0.75;
    const w = Math.round(ISO_W * s), h = Math.round(ISO_H * s);
    if (this.air.width !== w) {
      this.air.width = w;
      this.air.height = h;
    }
  }

  /** The buildings now (after each layout). */
  setSpots(spots: FxSpot[]): void {
    const was = new Map(this.emits.map((e) => [e.key, e]));
    this.emits = spots.map((s) => {
      const old = was.get(s.key);
      const src = s.el.dataset.src ?? s.el.src;
      const e: Emit = { key: s.key, el: s.el, sheet: s.sheet, work: s.work, x: 0, y: 0, w: 0, h: 0, look: old?.src === src && old.look ? old.look : null, src, next: old?.next ?? 0 };
      boxOf(e);
      return e;
    });
    this.relight();
  }

  /** A work done: a golden burst over the building. */
  celebrate(key: string): void {
    const e = this.emits.find((x) => x.key === key);
    if (!e || !e.w || !this.running) return;
    this.bursts.push({ x: e.x + e.w / 2, y: e.y + e.h * 0.55, t0: this.time() });
    if (this.bursts.length > 3) this.bursts.shift();
    for (let i = 0; i < 26 * this.q; i++) {
      const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50;
      spawn(K_GOLD, e.x + e.w * (0.3 + Math.random() * 0.4), e.y + e.h * (0.4 + Math.random() * 0.4), Math.cos(a) * v * 0.6, -Math.abs(Math.sin(a)) * v - 25, 1.2 + Math.random() * 0.8, 2 + Math.random() * 2);
    }
  }

  /** The windows' lights and the pennants from the buildings' pictures (each looked at once, when it is in). */
  private relight(): void {
    this.glows.length = this.fx.lights.length;
    this.pennants.length = 0;
    for (const e of this.emits) {
      if (e.w) e.look ??= lookOf(e.el);
      if (!e.look || !e.w || e.el.classList.contains('ghost')) continue;
      const lit = e.work ? 0.35 : 1;
      for (const [fx, fy] of e.look.lights) this.glows.push({ x: e.x + fx * e.w, y: e.y + fy * e.h, r: Math.max(8, e.w * 0.07), ph: Math.random() * 10, a: 0.42 * lit });
      if (PENNANT.has(e.sheet) && !e.work) this.pennants.push({ x: e.x + e.look.top[0] * e.w, y: e.y + e.look.top[1] * e.h, s: Math.max(10, e.w * 0.09), ph: Math.random() * 6 });
    }
    if (this.glows.length > 60) this.glows.length = 60;
  }

  private seedAmbience(): void {
    for (let i = 0; i < 16; i++) {
      const o = i * 5;
      this.wisps[o] = Math.random() * ISO_W;
      this.wisps[o + 1] = Math.random() * ISO_H;
      this.wisps[o + 2] = 6 + Math.random() * 10; // speed
      this.wisps[o + 3] = 160 + Math.random() * 220; // size
      this.wisps[o + 4] = Math.random() * 10; // phase
    }
    for (let i = 0; i < 5; i++) {
      const o = i * 5;
      this.birds[o] = 200 + Math.random() * (ISO_W - 400); // centre x
      this.birds[o + 1] = 120 + Math.random() * (ISO_H - 300);
      this.birds[o + 2] = 60 + Math.random() * 120; // radius
      this.birds[o + 3] = (0.15 + Math.random() * 0.2) * (Math.random() < 0.5 ? -1 : 1); // turn speed
      this.birds[o + 4] = Math.random() * 6.28;
    }
    page.fill(0);
    plife.fill(0);
  }

  start(): void {
    if (this.running || !IsleFx.allowed()) return;
    this.running = true;
    this.air.classList.remove('hidden');
    if (this.sea && this.mapImg) {
      this.sea.canvas.classList.remove('hidden');
      this.mapImg.style.visibility = 'hidden';
    }
    this.last = performance.now();
    if (!document.hidden) this.loop();
  }

  stop(): void {
    this.running = false;
    this.halt();
    this.air.classList.add('hidden');
    this.sea?.canvas.classList.add('hidden');
    if (this.mapImg) this.mapImg.style.visibility = '';
  }

  private halt(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (): void => {
    if (!this.running || document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
  };

  private time(): number {
    return (performance.now() - this.t0) / 1000;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t0 = performance.now();
    const t = (now - this.t0) / 1000;
    this.frameN++;
    // the sea at 30 fps (every other frame), the air at the screen's rate (every other frame too when lighter)
    if (this.sea && !this.sea.lost && (this.frameN & 1) === 0) this.sea.draw(t, this.q);
    if (this.sea?.lost) this.dropSea();
    if (this.q >= 1 || (this.frameN & 1) === 1) this.drawAir(t, this.q >= 1 ? dt : dt * 2);
    // the frame's cost; a weak phone steps down (and back up when it has room)
    const ms = performance.now() - t0;
    this.busyMs = this.busyMs * 0.95 + ms * 0.05;
    this.fpsN++;
    if (now - this.fpsT >= 1000) {
      const fps = (this.fpsN * 1000) / (now - this.fpsT || 1);
      this.stats.fps = Math.round(fps);
      this.stats.frameMs = Math.round(this.busyMs * 10) / 10;
      this.fpsN = 0;
      this.fpsT = now;
      this.slow = fps < 40 || this.busyMs > 9 ? this.slow + 1 : Math.max(0, this.slow - 1);
      if (this.slow >= 3 && this.q >= 1) this.setQuality(0.5);
      let n = 0;
      for (let i = 0; i < CAP; i++) if (page[i] < plife[i]) n++;
      this.stats.particles = n;
    }
  };

  private setQuality(q: number): void {
    this.q = q;
    this.stats.q = q;
    this.slow = 0;
    this.setSize();
    if (this.sea && this.mapImg) this.sea.setMap(this.mapImg, this.fx, q < 1 ? 0.6 : 1);
  }

  private dropSea(): void {
    this.sea?.canvas.remove();
    this.sea = null;
    this.seaFailed = true;
    if (this.mapImg) this.mapImg.style.visibility = '';
  }

  private drawAir(t: number, dt: number): void {
    const g = this.g;
    const s = this.air.width / ISO_W;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.air.width, this.air.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    this.stats.sea = !!this.sea;
    const q = this.q;
    // ---- the emitters: smoke, dust and sparks
    for (const e of this.emits) {
      if (!e.look || !e.w) {
        // its picture came in since: measured and looked at now
        if (e.el.complete && e.el.naturalWidth) {
          boxOf(e);
          e.look = lookOf(e.el);
          this.relight();
        }
        continue;
      }
      if (t < e.next) continue;
      if (e.work) {
        // the work: a puff of dust at the foot, now and then a hammer's sparks
        spawn(K_DUST, e.x + e.w * (0.22 + Math.random() * 0.56), e.y + e.h * (0.72 + Math.random() * 0.18), (Math.random() - 0.5) * 14, -6 - Math.random() * 8, 1.6 + Math.random(), 16 + Math.random() * 14);
        if (Math.random() < 0.55) {
          const sx = e.x + e.w * (0.3 + Math.random() * 0.4), sy = e.y + e.h * (0.35 + Math.random() * 0.3);
          for (let i = 0; i < 5 + 4 * q; i++) spawn(K_SPARK, sx, sy, (Math.random() - 0.5) * 70, -30 - Math.random() * 50, 0.35 + Math.random() * 0.35, 2 + Math.random() * 1.5);
        }
        e.next = t + (0.45 + Math.random() * 0.9) / q;
      } else if (SMOKE.has(e.sheet) && !e.el.classList.contains('ghost')) {
        spawn(K_SMOKE, e.x + e.look.top[0] * e.w + (Math.random() - 0.5) * 3, e.y + e.look.top[1] * e.h + 2, 4 + Math.random() * 4, -14 - Math.random() * 6, 3.2 + Math.random() * 1.6, 7 + Math.random() * 4);
        e.next = t + (0.32 + Math.random() * 0.25) / q;
      } else e.next = t + 5;
    }
    // the volcano's vents
    if (this.fx.vents.length && Math.random() < 0.12 * q) {
      const v = this.fx.vents[Math.floor(Math.random() * this.fx.vents.length)];
      spawn(K_SMOKE, v[0], v[1], 5 + Math.random() * 6, -10 - Math.random() * 6, 4 + Math.random() * 2, 14 + Math.random() * 8);
    }
    // ---- the biome's weather
    this.weather(t, q);
    // ---- fog wisps (under everything else in the air)
    const nWisp = (this.map === 'temperate' ? 12 : this.map === 'ice' ? 7 : 5) * (q >= 1 ? 1 : 0.6);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < nWisp; i++) {
      const o = i * 5;
      let x = this.wisps[o] + this.wisps[o + 2] * dt;
      if (x > ISO_W + 200) x = -200;
      this.wisps[o] = x;
      const sz = this.wisps[o + 3];
      g.globalAlpha = 0.07 + 0.04 * Math.sin(t * 0.2 + this.wisps[o + 4]);
      g.drawImage(this.spr.fog, x - sz, this.wisps[o + 1] - sz * 0.35, sz * 2, sz * 0.7);
    }
    // ---- the particles
    for (let i = 0; i < CAP; i++) {
      if (page[i] >= plife[i]) continue;
      page[i] += dt;
      const k = page[i] / plife[i];
      if (k >= 1) continue;
      const kind = pk[i];
      px[i] += pvx[i] * dt;
      py[i] += pvy[i] * dt;
      if (kind === K_SMOKE) {
        pvx[i] += 3 * dt; // the night's breeze
        const sz = psize[i] * (1 + k * 2.6);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 0.48 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k);
        g.drawImage(this.spr.smoke, px[i] - sz, py[i] - sz, sz * 2, sz * 2);
      } else if (kind === K_DUST) {
        const sz = psize[i] * (0.6 + k);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 0.5 * (1 - k) * Math.min(1, k * 6);
        g.drawImage(this.spr.dust, px[i] - sz, py[i] - sz * 0.6, sz * 2, sz * 1.2);
      } else if (kind === K_SPARK || kind === K_GOLD) {
        pvy[i] += (kind === K_SPARK ? 160 : 30) * dt;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1 - k;
        const sz = psize[i] * (kind === K_GOLD ? 3 : 2);
        g.drawImage(kind === K_GOLD ? this.spr.gold : this.spr.ember, px[i] - sz, py[i] - sz, sz * 2, sz * 2);
      } else if (kind === K_SNOW) {
        px[i] += Math.sin(t * 1.3 + pseed[i]) * 6 * dt;
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 0.75 * Math.min(1, (1 - k) * 4) * Math.min(1, k * 8);
        g.fillStyle = '#e8eef4';
        g.fillRect(px[i], py[i], psize[i], psize[i]);
      } else if (kind === K_EMBER) {
        px[i] += Math.sin(t * 2 + pseed[i]) * 8 * dt;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = (0.55 + 0.45 * Math.sin(t * 9 + pseed[i])) * (1 - k);
        const sz = psize[i] * 2;
        g.drawImage(this.spr.ember, px[i] - sz, py[i] - sz, sz * 2, sz * 2);
      } else if (kind === K_FLY) {
        pvx[i] += Math.sin(t * 0.9 + pseed[i]) * 8 * dt;
        pvy[i] += Math.cos(t * 1.1 + pseed[i]) * 8 * dt;
        pvx[i] *= 0.98;
        pvy[i] *= 0.98;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.max(0, Math.sin(t * 2.2 + pseed[i])) * Math.min(1, (1 - k) * 3);
        const sz = psize[i] * 2.4;
        g.drawImage(this.spr.fly, px[i] - sz, py[i] - sz, sz * 2, sz * 2);
      }
    }
    // ---- the warm lights: lanterns, lava, the windows
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.glows.length; i++) {
      const L = this.glows[i];
      const f = 0.72 + 0.16 * Math.sin(t * 7.3 + L.ph) + 0.12 * Math.sin(t * 13.1 + L.ph * 2.3);
      g.globalAlpha = L.a * f;
      const r = L.r * (0.9 + 0.1 * f);
      g.drawImage(this.spr.glow, L.x - r, L.y - r, r * 2, r * 2);
    }
    // ---- the golden bursts of a work done
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      const k = (t - b.t0) / 1.6;
      if (k >= 1) {
        this.bursts.splice(i, 1);
        continue;
      }
      const r = 30 + k * 140;
      g.globalAlpha = 0.55 * (1 - k);
      g.drawImage(this.spr.gold, b.x - r, b.y - r * 0.6, r * 2, r * 1.2);
    }
    // ---- pennants and birds
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.92;
    for (const p of this.pennants) {
      const s = p.s;
      g.strokeStyle = '#2a2420';
      g.lineWidth = Math.max(1.2, s * 0.09);
      g.beginPath();
      g.moveTo(p.x, p.y + 2);
      g.lineTo(p.x, p.y - s * 1.3);
      g.stroke();
      g.fillStyle = '#7a1f1c';
      g.beginPath();
      g.moveTo(p.x, p.y - s * 1.3);
      for (let j = 1; j <= 6; j++) {
        const u = j / 6;
        g.lineTo(p.x + u * s * 1.3, p.y - s * 1.3 + u * s * 0.22 + Math.sin(t * 5 + p.ph - u * 3.2) * s * 0.12 * u);
      }
      for (let j = 6; j >= 0; j--) {
        const u = j / 6;
        g.lineTo(p.x + u * s * 1.2, p.y - s * 1.3 + s * 0.5 * (1 - u) + u * s * 0.32 + Math.sin(t * 5 + p.ph - u * 3.2) * s * 0.12 * u);
      }
      g.closePath();
      g.fill();
    }
    const bats = this.map === 'volcanic' || this.map === 'jungle';
    g.strokeStyle = bats ? '#0d0b0c' : '#c9ccd0';
    g.lineWidth = bats ? 2.2 : 1.6;
    g.globalAlpha = bats ? 0.8 : 0.7;
    const nb = q >= 1 ? 5 : 3;
    for (let i = 0; i < nb; i++) {
      const o = i * 5;
      const a = this.birds[o + 4] + t * this.birds[o + 3];
      const bx = this.birds[o] + Math.cos(a) * this.birds[o + 2], by = this.birds[o + 1] + Math.sin(a) * this.birds[o + 2] * 0.55;
      const flap = Math.sin(t * (bats ? 14 : 7) + i * 1.7) * (bats ? 4 : 5);
      const sz = bats ? 7 : 9;
      g.beginPath();
      g.moveTo(bx - sz, by - flap);
      g.quadraticCurveTo(bx - sz * 0.4, by - 2 - flap * 0.3, bx, by);
      g.quadraticCurveTo(bx + sz * 0.4, by - 2 - flap * 0.3, bx + sz, by - flap);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** Snow on the ice, embers on the volcano, fireflies in the jungle (the temperate isle has its thicker fog). */
  private weather(t: number, q: number): void {
    if (this.map === 'ice') {
      const cap = Math.round(90 * q);
      if (alive(K_SNOW) < cap) for (let i = 0; i < 3; i++) spawn(K_SNOW, Math.random() * (ISO_W + 300) - 300, -10 + Math.random() * 200, 18 + Math.random() * 10, 30 + Math.random() * 25, 12 + Math.random() * 8, 1.6 + Math.random() * 1.8);
    } else if (this.map === 'volcanic') {
      const cap = Math.round(45 * q);
      if (alive(K_EMBER) < cap && Math.random() < 0.6) {
        const v = this.fx.lights[2 + Math.floor(Math.random() * (this.fx.lights.length - 2))] ?? [ISO_W / 2, ISO_H / 2];
        spawn(K_EMBER, v[0] + (Math.random() - 0.5) * 60, v[1], (Math.random() - 0.5) * 10, -18 - Math.random() * 22, 3 + Math.random() * 3, 1.2 + Math.random());
      }
    } else if (this.map === 'jungle') {
      const cap = Math.round(32 * q);
      if (alive(K_FLY) < cap && Math.random() < 0.3) spawn(K_FLY, 300 + Math.random() * 1000, 200 + Math.random() * 600, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 8 + Math.random() * 8, 1 + Math.random() * 0.8);
    }
    void t;
  }
}
