// The fog of war's layer (owner, 2026-10-17; the rules in shared/src/data/fog.ts): one module the sea's view, the
// minimap and the world map all call, so the far zoom and free pan of the camera (another hand's work) only have to call
// `drawFog` with their own view of the world.
//
// The captain's fog is a 96 × 96 bitset of kilometre squares. It goes to the GPU as a low 96 × 96 mask texture, read
// with a soft blur and broken by a slow drifting mist (two layers of noise), into a small WebGL canvas of its own at
// half the view's size, which is then laid over the 2D canvas at the caller's moment — so the caller decides what lies
// under the fog (islands, ports, lairs, the sea's things) and what over it (her own ship, her goals' marks, her scouts).
// Without WebGL the mask itself is stretched over the view, smoothed and blurred: soft edges, no drift.
// Nothing is drawn when every square in view is seen (the common case close in).

import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import { FOG_CELL, FOG_SIDE, courseAt, fogHas, fogSeen } from '../../../shared/src/data/fog.ts';
import type { ScoutView, ScoutsView } from '../../../shared/src/fogproto.ts';
import type { FarCtx, FarLayer } from './farsea.ts';

/** A view of the world on a canvas: a world point (x, y) stands at ((x − x0)·k, (y − y0)·k) in the canvas's units, the
 *  view `w` × `h` of them. `time` in seconds drifts the mist (0: still); `alpha` the fog's weight (1: the sea's). */
export interface FogView {
  x0: number;
  y0: number;
  k: number;
  w: number;
  h: number;
  time: number;
  alpha?: number;
  /** The GL canvas's pixels per unit of the view (1 for a small dial; ½ for a screen — the fog is soft anyway). */
  q?: number;
  /** The mist's tone: 0 the sea's dark murk; 1 a paler grey cloud (the minimap's dial is near black under it). */
  tone?: number;
}

/** What of a list of the chart's things she may see: those in squares she has seen (all of them before her fog came). */
export function visibleOnChart<T extends { x: number; y: number }>(bits: Uint8Array | null | undefined, list: T[]): T[] {
  return bits ? list.filter((o) => fogSeen(bits, o.x, o.y)) : list;
}

/** Whether a point on the chart is under the fog (no fog yet: never). */
export function underFog(bits: Uint8Array | null | undefined, x: number, y: number): boolean {
  return !!bits && !fogSeen(bits, x, y);
}

/** Any unseen square in view (and a square about it, for the soft edge). */
export function fogInView(bits: Uint8Array, v: FogView): boolean {
  const x1 = v.x0 + v.w / v.k, y1 = v.y0 + v.h / v.k;
  const cx0 = Math.floor(v.x0 / FOG_CELL) - 1, cx1 = Math.floor(x1 / FOG_CELL) + 1;
  const cy0 = Math.floor(v.y0 / FOG_CELL) - 1, cy1 = Math.floor(y1 / FOG_CELL) + 1;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= FOG_SIDE || cy >= FOG_SIDE) return true;
      if (!fogHas(bits, cy * FOG_SIDE + cx)) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ the mask

let maskOf: Uint8Array | null = null;
let maskVer = -1;
const lum = new Uint8Array(FOG_SIDE * FOG_SIDE);
let canvas2d: HTMLCanvasElement | null = null;
let canvas2dVer = -1;
let canvas2dTone = 0;

/** The mask (255 under the fog) for this version of the bits. */
function mask(bits: Uint8Array, ver: number): Uint8Array {
  if (maskOf !== bits || maskVer !== ver) {
    for (let i = 0; i < lum.length; i++) lum[i] = fogHas(bits, i) ? 0 : 255;
    maskOf = bits;
    maskVer = ver;
  }
  return lum;
}

// ------------------------------------------------------------------------------------------------ WebGL

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D mask; uniform vec2 org; uniform vec2 span; uniform vec2 res; uniform float t; uniform float a; uniform float blur; uniform float tone; uniform float oct;
float hash(vec2 p) { p = mod(p, 289.0); vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, w = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { if (float(i) >= oct) break; v += w * noise(p); s += w; p = p * 2.03 + vec2(17.0, 9.0); w *= 0.5; } return v / s * 0.9375; }
float m(vec2 p) { if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return 1.0; return texture2D(mask, p).r; }
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = org + vec2(uv.x, 1.0 - uv.y) * span;
  float c = blur;
  float f = m(p) * 0.36 + (m(p + vec2(c, 0.0)) + m(p - vec2(c, 0.0)) + m(p + vec2(0.0, c)) + m(p - vec2(0.0, c))) * 0.12
    + (m(p + vec2(c, c)) + m(p - vec2(c, c)) + m(p + vec2(c, -c)) + m(p + vec2(-c, c))) * 0.04;
  vec2 q = p * 16.0;
  float n = fbm(q + vec2(t * 0.018, t * 0.011));
  float n2 = fbm(q * 2.6 + vec2(-t * 0.026, t * 0.015) + 5.2);
  float d = smoothstep(0.26, 0.74, f + (n - 0.5) * 0.55);
  vec3 col = mix(mix(vec3(0.028, 0.038, 0.048), vec3(0.15, 0.17, 0.19), tone), mix(vec3(0.19, 0.21, 0.24), vec3(0.36, 0.39, 0.42), tone), clamp(n2 * n2 * 1.5, 0.0, 1.0));
  float al = d * a * (0.93 + 0.07 * n2);
  gl_FragColor = vec4(col * al, al);
}`;

class FogGl {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private tex: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private texOf: Uint8Array | null = null;
  private texVer = -1;

  static create(): FogGl | null {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }) as WebGLRenderingContext | null;
      return gl ? new FogGl(c, gl) : null;
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
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'fog shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('fog program');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['mask', 'org', 'span', 'res', 't', 'a', 'blur', 'tone', 'oct']) this.u[n] = gl.getUniformLocation(prog, n);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(this.u.mask, 0);
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      glFog = null; // the 2D fog from now on
    });
  }

  /** The fog of a view drawn into the GL canvas's lower-left `pw` × `ph` pixels. */
  draw(bits: Uint8Array, ver: number, v: FogView, pw: number, ph: number): boolean {
    const gl = this.gl;
    if (gl.isContextLost()) return false;
    if (this.canvas.width < pw || this.canvas.height < ph) {
      this.canvas.width = Math.max(this.canvas.width, pw);
      this.canvas.height = Math.max(this.canvas.height, ph);
    }
    if (this.texOf !== bits || this.texVer !== ver) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, FOG_SIDE, FOG_SIDE, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, mask(bits, ver));
      this.texOf = bits;
      this.texVer = ver;
    }
    gl.viewport(0, 0, pw, ph);
    gl.uniform2f(this.u.org, v.x0 / WORLD_SIZE, v.y0 / WORLD_SIZE);
    gl.uniform2f(this.u.span, v.w / v.k / WORLD_SIZE, v.h / v.k / WORLD_SIZE);
    gl.uniform2f(this.u.res, pw, ph);
    gl.uniform1f(this.u.t, v.time % 4000);
    gl.uniform1f(this.u.a, v.alpha ?? 1);
    gl.uniform1f(this.u.blur, 0.62 / FOG_SIDE);
    gl.uniform1f(this.u.tone, v.tone ?? 0);
    // the mist's finer octaves only where they are bigger than a few pixels (no static on a far chart)
    const unit = (WORLD_SIZE / 16) * v.k * (pw / v.w);
    gl.uniform1f(this.u.oct, Math.max(1, Math.min(4, Math.floor(Math.log2(Math.max(1, unit / 6))) + 1)));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }
}

/** The one GL fog of the page (undefined: not tried yet; null: none — the 2D fog). */
let glFog: FogGl | null | undefined;
function fogGl(): FogGl | null {
  if (glFog === undefined) {
    const off = typeof location !== 'undefined' && /[?&]gl=0\b/.test(location.search);
    glFog = off ? null : FogGl.create();
  }
  return glFog;
}

// ------------------------------------------------------------------------------------------------ the layer

/** The fog over a view, drawn onto `g` (in its current transform, the view at its origin). `ver` changes whenever the
 *  bits do (the mask is only rebuilt then). */
export function drawFog(g: CanvasRenderingContext2D, bits: Uint8Array | null | undefined, ver: number, v: FogView): void {
  if (!bits || v.w <= 0 || v.h <= 0 || !fogInView(bits, v)) return;
  const gl = fogGl();
  const q = v.q ?? (v.w * v.h > 200_000 ? 0.5 : 1);
  const pw = Math.max(16, Math.min(1400, Math.ceil(v.w * q))), ph = Math.max(16, Math.min(1400, Math.ceil(v.h * q)));
  if (gl && gl.draw(bits, ver, v, pw, ph)) {
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(gl.canvas, 0, gl.canvas.height - ph, pw, ph, 0, 0, v.w, v.h);
    g.restore();
    return;
  }
  draw2d(g, bits, ver, v);
}

/** Without WebGL: the mask stretched over the view, smoothed, blurred where the canvas can. */
function draw2d(g: CanvasRenderingContext2D, bits: Uint8Array, ver: number, v: FogView): void {
  if (!canvas2d) {
    canvas2d = document.createElement('canvas');
    canvas2d.width = canvas2d.height = FOG_SIDE;
  }
  const tone = v.tone ?? 0;
  if (canvas2dVer !== ver || maskOf !== bits || canvas2dTone !== tone) {
    canvas2dTone = tone;
    const m = mask(bits, ver);
    const cg = canvas2d.getContext('2d')!;
    const img = cg.createImageData(FOG_SIDE, FOG_SIDE);
    for (let i = 0; i < m.length; i++) {
      img.data[i * 4] = 8 + tone * 50;
      img.data[i * 4 + 1] = 11 + tone * 54;
      img.data[i * 4 + 2] = 15 + tone * 56;
      img.data[i * 4 + 3] = m[i] ? 236 : 0;
    }
    cg.putImageData(img, 0, 0);
    canvas2dVer = ver;
  }
  const a = v.alpha ?? 1;
  const cell = FOG_CELL * v.k;
  g.save();
  g.beginPath();
  g.rect(0, 0, v.w, v.h);
  g.clip();
  g.globalAlpha = a;
  g.imageSmoothingEnabled = true;
  if ('filter' in g && cell > 3) g.filter = `blur(${Math.min(14, cell * 0.35).toFixed(1)}px)`;
  // (the world beyond its edge is fog too)
  g.fillStyle = 'rgba(8,11,15,0.92)';
  const wx0 = -v.x0 * v.k, wy0 = -v.y0 * v.k, ws = WORLD_SIZE * v.k;
  if (wx0 > 0) g.fillRect(0, 0, wx0, v.h);
  if (wy0 > 0) g.fillRect(0, 0, v.w, wy0);
  if (wx0 + ws < v.w) g.fillRect(wx0 + ws, 0, v.w - wx0 - ws, v.h);
  if (wy0 + ws < v.h) g.fillRect(0, wy0 + ws, v.w, v.h - wy0 - ws);
  g.drawImage(canvas2d, wx0, wy0, ws, ws);
  g.restore();
}

// ------------------------------------------------------------------------------------------------ the far view

/** The fog as the far view's chart layer (renderer.farLayers, farsea.ts): over its land, under its live marks, in its
 *  own transform; as strong as the chart is (the near sea's fog under it already). Her scouts on it too. */
export function fogFarLayer(state: { seen: Uint8Array | null; seenVer: number; scouts: ScoutsView | null; scoutsAt: number }, still = () => false): FarLayer {
  return (g: CanvasRenderingContext2D, c: FarCtx) => {
    drawFog(g, state.seen, state.seenVer, { x0: c.camX - c.w / 2 / c.zoom, y0: c.camY - c.h / 2 / c.zoom, k: c.zoom, w: c.w, h: c.h, time: still() ? 0 : performance.now() / 1000, alpha: c.mix, q: 0.5 });
    drawScouts(g, state.scouts, state.scoutsAt, c.sx, c.sy, 12);
  };
}

// ------------------------------------------------------------------------------------------------ the scouts on a chart

/** Where a scout is now (the server's wall clock reckoned on from its view; /speed's pace with it), or null at home. */
export function scoutNow(v: ScoutsView, sc: ScoutView, at: number, nowMs = performance.now()): { x: number; y: number; heading: number; home: boolean; d: number } | null {
  if (sc.state !== 'out' || !sc.route || sc.t0 === undefined) return null;
  const wall = v.now + (nowMs - at) * (v.rate || 1);
  const d = Math.min(sc.total ?? 0, Math.max(0, ((wall - sc.t0) / 1000) * v.speed));
  const p = courseAt(sc.route, d);
  return { ...p, home: d >= (sc.back ?? 0), d };
}

/** Her scouts on a chart: what is left of each course dashed, the turn a small ring, the scout a little pale sail. */
export function drawScouts(g: CanvasRenderingContext2D, v: ScoutsView | null, at: number, tx: (x: number) => number, ty: (y: number) => number, size: number, route = true): void {
  if (!v) return;
  for (const sc of v.list) {
    const now = scoutNow(v, sc, at);
    if (!now || !sc.route) continue;
    if (route) {
      // the course from her on (the rest of the way out, and home)
      g.save();
      g.setLineDash([Math.max(2, size * 0.25), Math.max(3, size * 0.3)]);
      g.lineWidth = Math.max(1, size * 0.1);
      g.strokeStyle = 'rgba(150,215,225,0.7)';
      g.beginPath();
      g.moveTo(tx(now.x), ty(now.y));
      let run = 0;
      for (let i = 2; i + 1 < sc.route.length; i += 2) {
        run += Math.hypot(sc.route[i] - sc.route[i - 2], sc.route[i + 1] - sc.route[i - 1]);
        if (run > now.d) g.lineTo(tx(sc.route[i]), ty(sc.route[i + 1]));
      }
      g.stroke();
      g.restore();
      if (!now.home && sc.back) {
        const turn = courseAt(sc.route, sc.back);
        g.strokeStyle = 'rgba(150,215,225,0.85)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(tx(turn.x), ty(turn.y), Math.max(3, size * 0.32), 0, Math.PI * 2);
        g.stroke();
      }
    }
    // the sail: a small pale lateen, dark-edged, turned to her heading
    g.save();
    g.translate(tx(now.x), ty(now.y));
    g.rotate(now.heading);
    const s = Math.max(4, size * 0.5);
    g.fillStyle = '#cfeef2';
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.lineWidth = Math.max(1, s * 0.18);
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.62, s * 0.7);
    g.lineTo(0, s * 0.38);
    g.lineTo(-s * 0.62, s * 0.7);
    g.closePath();
    g.stroke();
    g.fill();
    g.restore();
  }
}
