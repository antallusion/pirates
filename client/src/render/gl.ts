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
${NOISE}
float height(vec2 w) {
  vec2 d = normalize(wind.xy + vec2(0.0001));
  float s = 0.5 + wind.z;
  float h = 0.0;
  h += sin(dot(w, d) * 0.045 - time * 1.1) * 0.5;
  h += sin(dot(w, vec2(-d.y, d.x)) * 0.031 + time * 0.8) * 0.25;
  h += (fbm(w * 0.012 + d * time * 0.08) - 0.5) * 1.6 * s;
  h += (fbm(w * 0.05 - d * time * 0.25) - 0.5) * 0.5 * s;
  return h;
}
void main() {
  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 w = cam + (frag - res * 0.5) / zoom;
  float e = 1.5;
  float h = height(w);
  vec3 n = normalize(vec3(height(w - vec2(e, 0.0)) - height(w + vec2(e, 0.0)), height(w - vec2(0.0, e)) - height(w + vec2(0.0, e)), 1.2));
  vec3 moon = normalize(vec3(0.35, -0.55, 0.75));
  float diff = clamp(dot(n, moon), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-moon, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 40.0);
  vec3 deep = tint * 0.75;
  vec3 col = mix(deep, tint * 1.7 + vec3(0.02, 0.04, 0.05), diff * 0.55 + h * 0.08);
  col += vec3(0.55, 0.65, 0.75) * spec * (0.35 + 0.4 * (1.0 - night));
  float foam = smoothstep(0.75, 1.05, h * (0.6 + wind.z * 0.6)) * (0.25 + wind.z * 0.35);
  col += vec3(0.6, 0.65, 0.68) * foam;
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
  vec3 bio = mix(vec3(0.75, 0.8, 0.82), vec3(0.18, 0.9, 0.78), night);
  col += bio * glow * (0.18 + 0.35 * night);
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_FRAG = `precision mediump float;
uniform vec2 res; uniform vec2 cam; uniform float zoom; uniform float time; uniform vec2 wind; uniform float fog; uniform float flash; uniform float night;
uniform vec2 bolt[8]; uniform float boltOn;
${NOISE}
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 frag = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 w = cam + (frag - res * 0.5) / zoom;
  // Three banks of fog, each drifting with the wind at its own height (parallax), thickest where they overlap.
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float par = 1.0 + fi * 0.18;
    vec2 q = (cam + (frag - res * 0.5) / zoom / par) * (0.0016 + fi * 0.0009) + wind * time * (0.01 + fi * 0.006) + fi * 7.3;
    a += smoothstep(0.35, 0.85, fbm(q)) * (0.55 - fi * 0.12);
  }
  a *= fog;
  vec3 fogc = mix(vec3(0.42, 0.47, 0.52), vec3(0.12, 0.16, 0.2), night);
  vec3 col = fogc + vec3(0.8, 0.85, 1.0) * flash * 0.6;
  float alpha = clamp(a * 0.85 + flash * 0.25, 0.0, 0.9);
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
