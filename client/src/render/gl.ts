// WebGL layers (Phase 10): a shader sea under the 2D world (waves, moon sheen, foam, bioluminescent wakes) and a
// sky above it (drifting volumetric fog in parallax layers, lightning). The 2D renderer keeps ships, islands and
// the interface; without WebGL (or with ?gl=0) it draws the sea and the fog itself, as before.

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
export const MAX_WAKES = 48;

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const PRECISION = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

// A hash that stays sound for any input: lattice points wrap at 289, so noise(p + 289) == noise(p) and, with exact
// doubling between octaves, fbm too. The CPU keeps every offset below 289 (or below 1 for the tiling textures),
// so nothing the shader sees ever grows with the world or with time — no banding far from the origin, no jumps.
const NOISE = `
float hash(vec2 p) {
  p = mod(p, 289.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.0 + vec2(17.0, 9.0); a *= 0.5; } return v; }
`;

const SEA_FRAG = `${PRECISION}
uniform vec2 res; uniform float zoom; uniform vec3 tint; uniform vec2 dir; uniform float strength; uniform float night;
uniform vec2 ph; uniform vec2 offA; uniform vec2 offB; uniform vec2 offC; uniform vec2 offE; uniform vec2 offF;
uniform vec2 t1; uniform vec2 t2; uniform vec2 t3;
uniform vec4 wakes[${MAX_WAKES}]; uniform int nwakes;
uniform sampler2D tex; uniform float hasTex;
${NOISE}
// The long swell, in metres from the camera: it only shades the water (a slow roll of moonlight).
float swell(vec2 l, vec2 d) {
  return sin(dot(l, d) * 0.018 + ph.x) * 0.6 + sin(dot(l, vec2(-d.y, d.x)) * 0.011 + ph.y) * 0.4
    + (fbm(l * 0.004 + offA) - 0.5) * 1.2;
}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 l = (frag - res * 0.5) / zoom;
  vec2 d = dir;
  float s = clamp(strength, 0.0, 1.4);
  float e = 6.0;
  float hx = swell(l + vec2(e, 0.0), d) - swell(l - vec2(e, 0.0), d);
  float hy = swell(l + vec2(0.0, e), d) - swell(l - vec2(0.0, e), d);
  vec3 n = normalize(vec3(-hx, -hy, 3.0));
  vec3 moon = normalize(vec3(0.35, -0.55, 0.75));
  float diff = clamp(dot(n, moon), 0.0, 1.0);
  vec3 col;
  float sparkSrc;
  if (hasTex > 0.5) {
    // Two drifting layers of the painted sea, at different scales and angles, so the tile never shows.
    vec3 c1 = texture2D(tex, l / 300.0 + t1).rgb;
    vec3 c2 = texture2D(tex, mat2(0.8, -0.6, 0.6, 0.8) * (l / 190.0) + t2).rgb;
    float m = fbm(l * 0.0025 + offC);
    vec3 base = mix(c1, c2, 0.35 + 0.3 * m);
    // Wind raises the whitecaps the painting already has; a calm lays them down.
    float lum = dot(base, vec3(0.299, 0.587, 0.114));
    float caps = smoothstep(0.2, 0.5, lum);
    base = mix(base * 0.75, base, 0.3 + 0.7 * clamp(s, 0.0, 1.0)) + caps * vec3(0.45, 0.5, 0.55) * max(0.0, s - 0.6) * 0.3;
    col = base * (0.55 + tint * 6.0) * (0.78 + 0.5 * diff);
  } else {
    // Without the painting: near-black water, the swell's light, thin whitecap streaks (never broad patches).
    float h = swell(l, d) + (fbm(l * 0.05 + offB) - 0.5) * 0.6 * (0.5 + s);
    col = mix(tint * 0.75, tint * 1.6 + vec3(0.02, 0.035, 0.045), diff * 0.5 + h * 0.05);
    float streak = smoothstep(0.62, 0.78, fbm(l * vec2(0.06, 0.02) + offB));
    float crest = smoothstep(0.55, 0.95, h * 0.5 + 0.5);
    col += vec3(0.5, 0.55, 0.58) * streak * crest * clamp(s - 0.3, 0.0, 1.0) * 0.35;
  }
  // Moonlight glints: tiny sparks on ripples that face the moon, only close enough to see them.
  float rip = noise(l * 0.9 + offE) * noise(l * 1.7 + offF);
  float spark = smoothstep(0.5, 0.72, rip) * smoothstep(0.35, 0.95, diff) * smoothstep(0.8, 2.2, zoom);
  col += vec3(0.6, 0.66, 0.74) * spark * (0.1 + 0.12 * (1.0 - night));
  // Wakes (positions from the camera): white water by day, the glow of the deep's small lights by night.
  // Each point of a wake spreads as a ring as it ages: together they draw the two arms of the wake running out from
  // her quarters (a Kelvin wake), with the churned water close astern of her — not a pale haze over her (owner,
  // 2026-10-07: «надо работать над рассеканием воды»).
  float glow = 0.0;
  for (int i = 0; i < ${MAX_WAKES}; i++) {
    if (i >= nwakes) break;
    vec4 k = wakes[i];
    vec2 dv = l - k.xy;
    float r = max(2.0, k.w);
    float d = length(dv);
    float fade = clamp(1.0 - k.z / 7.0, 0.0, 1.0);
    float arm = (d - r * 0.62) / (r * 0.16 + 0.8);
    float core = exp(-dot(dv, dv) / (r * r * 0.1)) * clamp(1.0 - k.z / 2.5, 0.0, 1.0);
    glow += (exp(-arm * arm) * 0.85 + core * 0.8) * fade;
  }
  glow = clamp(glow, 0.0, 1.2);
  // Churned water: the painting's own foam, broken into streaks, where the wake runs; the deep's small lights by night.
  float churn = hasTex > 0.5 ? smoothstep(0.2, 0.55, texture2D(tex, l / 30.0 + t3).r) : 0.6;
  col = mix(col, vec3(0.68, 0.74, 0.78), clamp(glow * (0.15 + 0.95 * churn), 0.0, 0.7) * (1.0 - night * 0.5));
  col += vec3(0.18, 0.9, 0.78) * glow * churn * 0.22 * night;
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_FRAG = `${PRECISION}
uniform vec2 res; uniform float zoom; uniform float fog; uniform float flash; uniform float night;
uniform vec2 axis[3]; uniform vec2 off[3]; uniform vec2 warpOff;
uniform vec2 bolt[8]; uniform float boltOn;
uniform sampler2D fogTex; uniform float hasFog;
${NOISE}
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  // Fog: a thin haze over everything, and banks of mist streaked along the wind in three parallax layers; it
  // closes in toward the edges of sight, so the ship sails in a pocket of visibility. The drift is integrated on the
  // CPU (a gust changes the speed, never the position), so the banks glide without a jump.
  vec2 l = (frag - res * 0.5) / zoom;
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 p = l / (1.0 + fi * 0.25);
    vec2 ax = axis[i];
    vec2 q = vec2(dot(p, ax), dot(p, vec2(-ax.y, ax.x)) * 1.7);
    vec2 uv = q / (520.0 + fi * 380.0) + off[i];
    // A slow curl from the painting itself: each bank changes shape as it goes.
    vec2 warp;
    if (hasFog > 0.5) warp = vec2(texture2D(fogTex, uv * 2.0 + warpOff).r, texture2D(fogTex, uv * 2.0 - warpOff + vec2(0.5, 0.25)).r) - 0.5;
    else warp = vec2(noise(uv * 3.0), noise(uv * 3.0 + 7.1)) - 0.5;
    uv += warp * 0.12;
    float v = hasFog > 0.5 ? texture2D(fogTex, uv).r : fbm(uv * 5.0);
    a += smoothstep(0.22, 0.78, v) * (0.6 - fi * 0.14);
  }
  // The captain always sees her own deck: the mist thins to a third around the middle of the screen.
  float edge = smoothstep(0.04, 0.6, length((frag - res * 0.5) / res.y));
  a = fog * (0.05 + a * 1.45) * mix(0.32, 1.0, edge);
  // Moonlit mist stays paler than the water it hides, by night as by day.
  vec3 fogc = mix(vec3(0.56, 0.6, 0.64), vec3(0.3, 0.34, 0.39), night);
  vec3 col = fogc + vec3(0.8, 0.85, 1.0) * flash * 0.35;
  float alpha = clamp(a + flash * 0.1, 0.0, 0.85);
  // A lightning bolt across the sky.
  if (boltOn > 0.0) {
    float d = 1e5;
    for (int i = 0; i < 7; i++) d = min(d, seg(frag, bolt[i], bolt[i + 1]));
    float core = exp(-d * d / 3.0), halo = exp(-d / 28.0);
    col = mix(col, vec3(0.9, 0.95, 1.0), clamp(core + halo * 0.6, 0.0, 1.0));
    alpha = max(alpha, clamp(core * boltOn + halo * 0.45 * boltOn, 0.0, 1.0));
  }
  gl_FragColor = vec4(col * alpha, alpha);
}`;

function compile(gl: WebGLRenderingContext, frag: string): WebGLProgram | null {
  const mk = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[gl] shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };
  const v = mk(gl.VERTEX_SHADER, VERT), f = mk(gl.FRAGMENT_SHADER, frag);
  if (!v || !f) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[gl] link:', gl.getProgramInfoLog(prog));
    return null;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return prog;
}

class Layer {
  readonly canvas: HTMLCanvasElement;
  protected gl: WebGLRenderingContext;
  protected prog: WebGLProgram;
  private loc = new Map<string, WebGLUniformLocation | null>();

  constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, prog: WebGLProgram) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
  }

  protected u(name: string): WebGLUniformLocation | null {
    if (!this.loc.has(name)) this.loc.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.loc.get(name)!;
  }

  resize(w: number, h: number, dpr: number): void {
    // The sea and the fog are soft: they render at up to 1.5× device pixels, and the browser scales them.
    const k = Math.min(dpr, 1.5);
    this.canvas.width = Math.round(w * k);
    this.canvas.height = Math.round(h * k);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** A repeating texture from an image, resampled to 1024² so WebGL 1 can tile and mip-map it. */
  protected texture(img: HTMLImageElement, unit: number, uniform: string, flag: string): void {
    const gl = this.gl;
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    c.getContext('2d')!.drawImage(img, 0, 0, 1024, 1024);
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.useProgram(this.prog);
    gl.uniform1i(this.u(uniform), unit);
    gl.uniform1f(this.u(flag), 1);
  }

  protected begin(): number {
    const gl = this.gl;
    gl.useProgram(this.prog);
    const k = this.canvas.width / Math.max(1, this.canvas.clientWidth || this.canvas.width);
    gl.uniform2f(this.u('res'), this.canvas.width, this.canvas.height);
    return k;
  }
}

function makeLayer(id: string, frag: string, alpha: boolean): { canvas: HTMLCanvasElement; gl: WebGLRenderingContext; prog: WebGLProgram } | null {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  const gl = canvas.getContext('webgl', { alpha, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const prog = compile(gl, frag);
  if (!prog) return null;
  return { canvas, gl, prog };
}

const TAU = Math.PI * 2;
const wrap = (v: number, p: number) => v - Math.floor(v / p) * p;
/** Exponential approach: `k` of the way from `a` to `b` for a step `dt` with time constant `tau`. */
const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

export class GlSea extends Layer {
  private wakeData = new Float32Array(MAX_WAKES * 4);
  hasTexture = false;
  // The wind as the sea feels it: eased over seconds, so a gust or a turn of the wind never snaps the water.
  private dx = 0;
  private dy = 1;
  private s = 0.5;
  // Distance the wind has driven the surface (metres of "wind run"), the swell phases, and the last camera.
  private runX = 0;
  private runY = 0;
  private ph1 = 0;
  private ph2 = 0;
  private cx = NaN;
  private cy = NaN;
  private last = NaN;

  /** The painted sea (`tex.ocean`) under the shader's light. */
  setTexture(img: HTMLImageElement): void {
    this.texture(img, 0, 'tex', 'hasTex');
    this.hasTexture = true;
  }

  static create(): GlSea | null {
    const l = makeLayer('world-sea', SEA_FRAG, false);
    return l ? new GlSea(l.canvas, l.gl, l.prog) : null;
  }

  draw(o: { camX: number; camY: number; zoom: number; time: number; tint: [number, number, number]; wind: [number, number, number]; night: number; wakes: { x: number; y: number; age: number; w: number }[] }): void {
    const gl = this.gl;
    const k = this.begin();
    const dt = Number.isFinite(this.last) ? Math.min(0.1, Math.max(0, o.time - this.last)) : 0;
    this.last = o.time;
    const len = Math.hypot(o.wind[0], o.wind[1]) || 1;
    const e = Number.isFinite(this.cx) ? ease(dt, 3) : 1;
    this.dx += (o.wind[0] / len - this.dx) * e;
    this.dy += (o.wind[1] / len - this.dy) * e;
    const dl = Math.hypot(this.dx, this.dy) || 1;
    this.dx /= dl;
    this.dy /= dl;
    this.s += (o.wind[2] - this.s) * e;
    const { dx, dy } = this;
    this.runX += dx * dt;
    this.runY += dy * dt;
    // The swell's phases move with the camera (so the waves stay put in the world) and roll on with time.
    if (Number.isFinite(this.cx)) {
      const mx = o.camX - this.cx, my = o.camY - this.cy;
      this.ph1 = wrap(this.ph1 + 0.018 * (mx * dx + my * dy) - 0.7 * dt, TAU);
      this.ph2 = wrap(this.ph2 + 0.011 * (mx * -dy + my * dx) + 0.45 * dt, TAU);
    }
    this.cx = o.camX;
    this.cy = o.camY;
    const t = o.time, cx = o.camX, cy = o.camY, rx = this.runX, ry = this.runY;
    const n289 = (x: number, y: number): [number, number] => [wrap(x, 289), wrap(y, 289)];
    gl.uniform1f(this.u('zoom'), o.zoom * k);
    gl.uniform3f(this.u('tint'), o.tint[0], o.tint[1], o.tint[2]);
    gl.uniform2f(this.u('dir'), dx, dy);
    gl.uniform1f(this.u('strength'), this.s);
    gl.uniform1f(this.u('night'), o.night);
    gl.uniform2f(this.u('ph'), this.ph1, this.ph2);
    gl.uniform2f(this.u('offA'), ...n289(cx * 0.004 + rx * 0.02, cy * 0.004 + ry * 0.02));
    gl.uniform2f(this.u('offB'), ...n289(cx * 0.05 - rx * 0.25, cy * 0.05 - ry * 0.25));
    gl.uniform2f(this.u('offC'), ...n289(cx * 0.0025 + t * 0.01, cy * 0.0025 + t * 0.01));
    gl.uniform2f(this.u('offE'), ...n289(cx * 0.9 + rx * 1.4, cy * 0.9 + ry * 1.4));
    gl.uniform2f(this.u('offF'), ...n289(cx * 1.7 - rx * 0.9, cy * 1.7 - ry * 0.9));
    gl.uniform2f(this.u('t1'), wrap(cx / 300 + rx * 0.006, 1), wrap(cy / 300 + ry * 0.006, 1));
    // mat2(0.8, -0.6, 0.6, 0.8) in GLSL is column-major: (0.8x + 0.6y, -0.6x + 0.8y).
    const bx = cx / 190, by = cy / 190;
    gl.uniform2f(this.u('t2'), wrap(0.8 * bx + 0.6 * by - rx * 0.009 + 0.37, 1), wrap(-0.6 * bx + 0.8 * by - ry * 0.009 + 0.61, 1));
    gl.uniform2f(this.u('t3'), wrap(cx / 36 + rx * 0.04, 1), wrap(cy / 36 + ry * 0.04, 1));
    const n = Math.min(MAX_WAKES, o.wakes.length);
    for (let i = 0; i < n; i++) {
      const w = o.wakes[o.wakes.length - n + i];
      this.wakeData.set([w.x - cx, w.y - cy, w.age, w.w], i * 4);
    }
    gl.uniform4fv(this.u('wakes[0]'), this.wakeData);
    gl.uniform1i(this.u('nwakes'), n);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export class GlSky extends Layer {
  hasTexture = false;
  private wx = 0;
  private wy = 1;
  private fog = NaN;
  private off = new Float64Array(6);
  private cx = NaN;
  private cy = NaN;
  private last = NaN;

  /** Painted mist (`tex.fog`) for the fog banks. */
  setTexture(img: HTMLImageElement): void {
    this.texture(img, 0, 'fogTex', 'hasFog');
    this.hasTexture = true;
  }

  static create(): GlSky | null {
    const l = makeLayer('world-sky', SKY_FRAG, true);
    return l ? new GlSky(l.canvas, l.gl, l.prog) : null;
  }

  draw(o: { camX: number; camY: number; zoom: number; time: number; wind: [number, number]; fog: number; flash: number; night: number; bolt: [number, number][] | null; boltOn: number }): void {
    const gl = this.gl;
    const k = this.begin();
    const dt = Number.isFinite(this.last) ? Math.min(0.1, Math.max(0, o.time - this.last)) : 0;
    this.last = o.time;
    // The wind and the density ease in over seconds: a gust quickens the banks, it never throws them.
    const first = !Number.isFinite(this.cx);
    const e = first ? 1 : ease(dt, 4);
    this.wx += (o.wind[0] - this.wx) * e;
    this.wy += (o.wind[1] - this.wy) * e;
    this.fog = Number.isFinite(this.fog) ? this.fog + (o.fog - this.fog) * ease(dt, 2.5) : o.fog;
    const wl = Math.hypot(this.wx, this.wy) || 1;
    const ux = this.wx / wl, uy = this.wy / wl;
    // The banks run with the wind at 11-25 m/s; each layer a little faster, the nearer the faster.
    const spd = 6 + wl * 10;
    const mx = first ? 0 : o.camX - this.cx, my = first ? 0 : o.camY - this.cy;
    this.cx = o.camX;
    this.cy = o.camY;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const axes = new Float32Array(6), offs = new Float32Array(6);
    for (let i = 0; i < 3; i++) {
      // Streaks lie along the wind; the field turns about the middle of the screen, not about the world's origin.
      const ang = Math.atan2(uy, ux) + (i - 1) * 0.35;
      const ax = Math.cos(ang), ay = Math.sin(ang);
      const scale = 520 + i * 380;
      // World motion of the mist under the camera: the camera's own move against the drift (the nearer layers look
      // larger in the shader, so the same move carries them faster across the screen — parallax).
      const vx = mx - ux * spd * (1 + i * 0.35) * dt, vy = my - uy * spd * (1 + i * 0.35) * dt;
      const qx = vx * ax + vy * ay, qy = (vx * -ay + vy * ax) * 1.7;
      if (first) {
        this.off[i * 2] = i * 0.37;
        this.off[i * 2 + 1] = i * 0.21;
      }
      this.off[i * 2] = wrap(this.off[i * 2] + qx / scale, 1);
      this.off[i * 2 + 1] = wrap(this.off[i * 2 + 1] + qy / scale, 1);
      axes.set([ax, ay], i * 2);
      offs.set([this.off[i * 2], this.off[i * 2 + 1]], i * 2);
    }
    if (this.fog < 0.02 && o.flash < 0.01 && !o.bolt) return;
    gl.uniform1f(this.u('zoom'), o.zoom * k);
    gl.uniform2fv(this.u('axis[0]'), axes);
    gl.uniform2fv(this.u('off[0]'), offs);
    gl.uniform2f(this.u('warpOff'), wrap(o.time * 0.013, 1), wrap(o.time * 0.009, 1));
    gl.uniform1f(this.u('fog'), this.fog);
    gl.uniform1f(this.u('flash'), o.flash);
    gl.uniform1f(this.u('night'), o.night);
    const pts = new Float32Array(16);
    if (o.bolt) o.bolt.slice(0, 8).forEach(([x, y], i) => pts.set([x * k, y * k], i * 2));
    gl.uniform2fv(this.u('bolt[0]'), pts);
    gl.uniform1f(this.u('boltOn'), o.bolt ? o.boltOn : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

/** Whether to try WebGL at all (?gl=0 or the saved setting turn it off). */
export function glWanted(): boolean {
  if (new URLSearchParams(location.search).get('gl') === '0') return false;
  return localStorage.getItem('gravetide.gl') !== 'off';
}
