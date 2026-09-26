// WebGL layers (Phase 10): a shader sea under the 2D world (waves, moon sheen, foam, bioluminescent wakes) and a
// sky above it (drifting volumetric fog in parallax layers, lightning). The 2D renderer keeps ships, islands and
// the interface; without WebGL (or with ?gl=0) it draws the sea and the fog itself, as before.

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
export const MAX_WAKES = 48;

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return v; }
`;

const SEA_FRAG = `precision mediump float;
uniform vec2 res; uniform vec2 cam; uniform float zoom; uniform float time; uniform vec3 tint; uniform vec3 wind; uniform float night;
uniform vec4 wakes[${MAX_WAKES}]; uniform int nwakes;
uniform sampler2D tex; uniform float hasTex;
${NOISE}
// The long swell: it only shades the water (a slow roll of moonlight), the painted sea carries the detail.
float swell(vec2 w, vec2 d) {
  return sin(dot(w, d) * 0.018 - time * 0.7) * 0.6 + sin(dot(w, vec2(-d.y, d.x)) * 0.011 + time * 0.45) * 0.4
    + (fbm(w * 0.004 + d * time * 0.02) - 0.5) * 1.2;
}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 w = cam + (frag - res * 0.5) / zoom;
  vec2 d = normalize(wind.xy + vec2(0.0001));
  float s = clamp(wind.z, 0.0, 1.4);
  float e = 6.0;
  float hx = swell(w + vec2(e, 0.0), d) - swell(w - vec2(e, 0.0), d);
  float hy = swell(w + vec2(0.0, e), d) - swell(w - vec2(0.0, e), d);
  vec3 n = normalize(vec3(-hx, -hy, 3.0));
  vec3 moon = normalize(vec3(0.35, -0.55, 0.75));
  float diff = clamp(dot(n, moon), 0.0, 1.0);
  vec3 col;
  if (hasTex > 0.5) {
    // Two drifting layers of the painted sea, at different scales and angles, so the tile never shows.
    vec2 uv1 = w / 300.0 + d * time * 0.006;
    vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * (w / 190.0) - d * time * 0.009 + vec2(0.37, 0.61);
    vec3 t1 = texture2D(tex, uv1).rgb;
    vec3 t2 = texture2D(tex, uv2).rgb;
    float m = fbm(w * 0.0025 + time * 0.01);
    vec3 base = mix(t1, t2, 0.35 + 0.3 * m);
    // Wind raises the whitecaps the painting already has; a calm lays them down.
    float lum = dot(base, vec3(0.299, 0.587, 0.114));
    float caps = smoothstep(0.2, 0.5, lum);
    base = mix(base * 0.75, base, 0.3 + 0.7 * clamp(s, 0.0, 1.0)) + caps * vec3(0.45, 0.5, 0.55) * max(0.0, s - 0.6) * 0.3;
    col = base * (0.55 + tint * 6.0) * (0.78 + 0.5 * diff);
  } else {
    // Without the painting: near-black water, the swell's light, thin whitecap streaks (never broad patches).
    float h = swell(w, d) + (fbm(w * 0.05 - d * time * 0.25) - 0.5) * 0.6 * (0.5 + s);
    col = mix(tint * 0.75, tint * 1.6 + vec3(0.02, 0.035, 0.045), diff * 0.5 + h * 0.05);
    float streak = smoothstep(0.62, 0.78, fbm(vec2(dot(w, d) * 0.12, dot(w, vec2(-d.y, d.x)) * 0.03) + time * 0.1));
    float crest = smoothstep(0.55, 0.95, h * 0.5 + 0.5);
    col += vec3(0.5, 0.55, 0.58) * streak * crest * clamp(s - 0.3, 0.0, 1.0) * 0.35;
  }
  // Moonlight glints: tiny sparks on ripples that face the moon, only close enough to see them.
  float rip = noise(w * 0.9 + d * time * 1.4) * noise(w * 1.7 - d * time * 0.9);
  float spark = smoothstep(0.5, 0.72, rip) * smoothstep(0.35, 0.95, diff) * smoothstep(0.8, 2.2, zoom);
  col += vec3(0.6, 0.66, 0.74) * spark * (0.1 + 0.12 * (1.0 - night));
  // Wakes: white water by day, the glow of the deep's small lights by night.
  float glow = 0.0;
  for (int i = 0; i < ${MAX_WAKES}; i++) {
    if (i >= nwakes) break;
    vec4 k = wakes[i];
    vec2 dv = w - k.xy;
    float r = max(2.0, k.w);
    glow += exp(-dot(dv, dv) / (r * r)) * clamp(1.0 - k.z / 7.0, 0.0, 1.0);
  }
  glow = clamp(glow, 0.0, 1.2);
  // Churned water: the painting's own foam, broken up, where the wake runs; the deep's small lights by night.
  float churn = hasTex > 0.5 ? smoothstep(0.08, 0.45, texture2D(tex, w / 36.0 + d * time * 0.04).r) : 0.6;
  col = mix(col, vec3(0.62, 0.68, 0.72), clamp(glow * (0.22 + 0.7 * churn), 0.0, 0.75) * (1.0 - night * 0.5));
  col += vec3(0.18, 0.9, 0.78) * glow * churn * 0.22 * night;
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_FRAG = `precision mediump float;
uniform vec2 res; uniform vec2 cam; uniform float zoom; uniform float time; uniform vec2 wind; uniform float fog; uniform float flash; uniform float night;
uniform vec2 bolt[8]; uniform float boltOn;
uniform sampler2D fogTex; uniform float hasFog;
${NOISE}
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  // Fog: a thin haze over everything, and banks of mist streaked along the wind in three parallax layers;
  // it closes in toward the edges of sight, so the ship sails in a pocket of visibility.
  vec2 wd = normalize(wind + vec2(0.0001));
  // The banks drift with the wind (11-25 m/s) in world space; the painted mist tiles, so the drift loops forever.
  float spd = 6.0 + length(wind) * 10.0;
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float par = 1.0 + fi * 0.25;
    vec2 p = cam + (frag - res * 0.5) / zoom / par;
    p -= wd * time * spd * (1.0 + fi * 0.35);
    vec2 q = vec2(dot(p, wd), dot(p, vec2(-wd.y, wd.x)) * 1.7);
    vec2 uv = q / (520.0 + fi * 380.0) + vec2(fi * 0.37, fi * 0.21);
    // A slow curl: each bank changes shape as it goes.
    vec2 warp = vec2(noise(uv * 3.0 + time * 0.03), noise(uv * 3.0 + 7.1 - time * 0.025)) - 0.5;
    uv += warp * 0.12;
    float v = hasFog > 0.5 ? texture2D(fogTex, uv).r : fbm(uv * 5.0);
    a += smoothstep(0.22, 0.78, v) * (0.6 - fi * 0.14);
  }
  float edge = smoothstep(0.05, 0.75, length((frag - res * 0.5) / res.y));
  a = fog * (0.05 + a * 1.45) * mix(0.6, 1.0, edge);
  // Moonlit mist stays paler than the water it hides, by night as by day.
  vec3 fogc = mix(vec3(0.56, 0.6, 0.64), vec3(0.3, 0.34, 0.39), night);
  vec3 col = fogc + vec3(0.8, 0.85, 1.0) * flash * 0.35;
  float alpha = clamp(a + flash * 0.1, 0.0, 0.88);
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

export class GlSea extends Layer {
  private wakeData = new Float32Array(MAX_WAKES * 4);
  hasTexture = false;

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
    gl.uniform2f(this.u('cam'), o.camX, o.camY);
    gl.uniform1f(this.u('zoom'), o.zoom * k);
    gl.uniform1f(this.u('time'), o.time);
    gl.uniform3f(this.u('tint'), o.tint[0], o.tint[1], o.tint[2]);
    gl.uniform3f(this.u('wind'), o.wind[0], o.wind[1], o.wind[2]);
    gl.uniform1f(this.u('night'), o.night);
    const n = Math.min(MAX_WAKES, o.wakes.length);
    for (let i = 0; i < n; i++) {
      const w = o.wakes[o.wakes.length - n + i];
      this.wakeData.set([w.x, w.y, w.age, w.w], i * 4);
    }
    gl.uniform4fv(this.u('wakes[0]'), this.wakeData);
    gl.uniform1i(this.u('nwakes'), n);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export class GlSky extends Layer {
  hasTexture = false;

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
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (o.fog < 0.02 && o.flash < 0.01 && !o.bolt) return;
    gl.uniform2f(this.u('cam'), o.camX, o.camY);
    gl.uniform1f(this.u('zoom'), o.zoom * k);
    gl.uniform1f(this.u('time'), o.time);
    gl.uniform2f(this.u('wind'), o.wind[0], o.wind[1]);
    gl.uniform1f(this.u('fog'), o.fog);
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
