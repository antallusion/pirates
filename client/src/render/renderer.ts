// Strictly top-down renderer (Canvas 2D). Layer order:
// ocean → currents & wind streaks → shallows/islands → ports & props → wakes → loot → ships →
// projectiles & particles → darkness/light pass → fog/rain → screen-space overlays.
// Art rules: docs/06_ART_DIRECTION.md (near-black water, warm lanterns vs cold ocean, turquoise ≤ 8%).

import { LFG_GOAL_DEFS, parseLfgTag } from '../../../shared/src/data/social.ts';
import { lfgLabel } from '../ui/social.ts';
import { HULLS, LAMPS, LOOK_COLORS, decodeLook } from '../../../shared/src/data/looks.ts';
import { flagCanvas } from './flag.ts';
import { namedLabel } from '../ui/hud.ts';
import { BEASTS, beastOfClass } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { drawBeast, drawCarcass, drawDolphin } from './beasts.ts';
import { drawLair, drawMuzzles } from './lairs.ts';
import type { LairView } from '../../../shared/src/protocol.ts';
import { EN as SEN, RU as SRU } from '../lang/ui/livesea.ts';
import { EN as IEN, RU as IRU } from '../lang/ui/isles.ts';
import { SEASON_NAMES, TIDAL_NAMES } from '../../../shared/src/data/isles.ts';
import { drawBanks, drawBeams, drawLookouts, drawReefLight, litLights, reefInLight, towerPoints } from './isles.ts';
import type { IslesCtx } from './isles.ts';
import type { TidalView } from '../../../shared/src/protocol.ts';
const LI = dict(IEN, IRU);
import { calfLength } from '../../../shared/src/data/companions.ts';
import { drawShoalBirds, drawShoals, drawSights } from './sights.ts';
import { THREAT_COLOR, combatLevelOf, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import type { Threat } from '../../../shared/src/data/shiplevel.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GUNS, SHIP_CLASSES, AMMO, CHASER_CONE, isZoneBossClass } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { nightFactor, SPEED_SCALE } from '../../../shared/src/constants.ts';
import { clamp, headingVec } from '../../../shared/src/math.ts';
import { placeName } from '../ui/maps.ts';
import { serverText } from '../lang/server.ts';
import type { IslandData, SeaMarkData, ShipInfo } from '../../../shared/src/protocol.ts';
import { markInReach } from '../../../shared/src/data/seamarks.ts';
import { SF, curseStageFromFlags } from '../../../shared/src/protocol.ts';
import { fbm } from '../../../shared/src/rng.ts';
import type { SailState } from '../../../shared/src/sim/sailing.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { IslandBiome } from '../../../shared/src/world/regions.ts';
import { assetMeta, pattern, sprite } from '../assets.ts';
import type { ClientState, RemoteShip } from '../state.ts';
import { Fx } from './fx.ts';
import type { CritPart } from './fx.ts';
import { drawBossZones, drawMonster, drawPveSites } from './monsters.ts';
import { drawAdvWorld, drawGuardShip, guardTag } from './advmap.ts'; // docs/17 H4
import { drawLairsWorld } from './beastlairs.ts'; // docs/18 II
import { drawDriftsWorld } from './drifts.ts'; // docs/18 IV
import { drawFindsWorld } from './seafinds.ts'; // docs/19 D5
import { drawRoamsWorld } from './roamers.ts'; // docs/19 D7
import { drawIsleHalo, drawIsleLevel, drawIsleOver, drawMist, drawTurtles } from './isletype.ts'; // docs/18 III
import type { IsleTypeCtx } from './isletype.ts';
import { EN as I18_EN, RU as I18_RU } from '../lang/ui/isles18.ts';
import { TURTLE_NAMES } from '../../../shared/src/world/drift.ts';
import { GlSea, GlSky, glWanted } from './gl.ts';
import { CELL, SpriteAtlas } from './atlas.ts';
import type { SailKey } from './atlas.ts';
import { FACTION_SIGN } from './relation.ts';
import { buildRelief } from './terrain.ts';
import type { Palette } from './terrain.ts';
import { dict, lang } from '../i18n.ts';
import { personName } from '../lang/names.ts';
import { dec1 } from '../ui/dom.ts';
import { shipCloth, shipColours } from '../ui/flags.ts'; // docs/24 D1–D2
import type { ShipColours } from '../ui/flags.ts';
import { EN as FL_EN, RU as FL_RU } from '../lang/ui/flags.ts';
import { objective } from '../ui/track.ts';
import { AIM_CHARGE, AIM_PERFECT, AIM_TAP, AIM_WAVER, aimFocus, windDrift } from '../../../shared/src/data/gunnery.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { islandLife } from '../../../shared/src/world/islandlife.ts';
import type { LifeSite } from '../../../shared/src/world/islandlife.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';

const L = dict(REN, RRU);
const LF = dict(FL_EN, FL_RU); // docs/24: a captain's colours
const hasRole = (r: string): r is 'merchant' => `role.${r}` in REN;
import { cbColor, settings } from '../settings.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';

const BIOME_TINT: Record<IslandBiome, string> = {
  temperate: 'rgba(40,52,40,0.35)',
  mossy: 'rgba(38,58,48,0.4)',
  volcanic: 'rgba(40,18,14,0.55)',
  ice: 'rgba(170,185,200,0.45)',
  ruins: 'rgba(40,60,62,0.45)',
  bone: 'rgba(150,145,130,0.4)',
  barren: 'rgba(70,64,55,0.4)',
  jungle: 'rgba(20,60,26,0.45)',
  mangrove: 'rgba(30,48,34,0.5)',
  atoll: 'rgba(200,190,150,0.25)',
  saltflat: 'rgba(220,215,200,0.45)',
  blacksand: 'rgba(18,18,20,0.5)',
  fungal: 'rgba(70,40,80,0.45)',
  crystal: 'rgba(90,110,160,0.4)',
};
const BIOME_BASE: Record<IslandBiome, string> = {
  temperate: '#2a3026', mossy: '#26322b', volcanic: '#1d1614', ice: '#8d98a3', ruins: '#2a3131', bone: '#6f6a5f', barren: '#3b372f',
  jungle: '#1f3a22', mangrove: '#24332a', atoll: '#b9a77c', saltflat: '#cfc9b8', blacksand: '#1e1c1c', fungal: '#34263a', crystal: '#4a5670',
};
/** The seven living-island biomes have their own paintings (docs/11 P5); should one fail to load, the island
 *  wears an older painting under the biome's colour: a glaze over the land. */
const BIOME_GLAZE: Partial<Record<IslandBiome, string>> = {
  jungle: 'rgba(10,70,20,0.38)', mangrove: 'rgba(18,52,40,0.4)', atoll: 'rgba(238,214,160,0.38)', saltflat: 'rgba(238,234,222,0.5)',
  blacksand: 'rgba(8,8,10,0.42)', fungal: 'rgba(96,40,118,0.36)', crystal: 'rgba(80,112,196,0.34)',
};

/** Higgsfield art by biome: the land, its shore, and what grows or lies on it. */
const BIOME_LAND: Record<IslandBiome, string> = {
  temperate: 'tex.land_temperate', mossy: 'tex.land_mossy', volcanic: 'tex.land_volcanic', ice: 'tex.land_ice', ruins: 'tex.land_ruins', bone: 'tex.land_bone', barren: 'tex.land_barren',
  jungle: 'tex.land_temperate', mangrove: 'tex.land_mossy', atoll: 'tex.sand', saltflat: 'tex.land_barren', blacksand: 'tex.land_volcanic', fungal: 'tex.land_mossy', crystal: 'tex.land_ice',
};
const BIOME_SHORE: Record<IslandBiome, string> = {
  temperate: 'tex.sand', mossy: 'tex.rock', volcanic: 'tex.shore_black', ice: 'tex.shore_ice', ruins: 'tex.rock', bone: 'tex.land_bone', barren: 'tex.rock',
  jungle: 'tex.sand', mangrove: 'tex.rock', atoll: 'tex.sand', saltflat: 'tex.sand', blacksand: 'tex.shore_black', fungal: 'tex.rock', crystal: 'tex.rock',
};
const BIOME_DECOR: Record<IslandBiome, string> = {
  temperate: 'prop.decor_temperate', mossy: 'prop.decor_mossy', volcanic: 'prop.decor_volcanic', ice: 'prop.decor_ice', ruins: 'prop.decor_barren', bone: 'prop.decor_bone', barren: 'prop.decor_barren',
  jungle: 'prop.decor_temperate', mangrove: 'prop.decor_mossy', atoll: 'prop.decor_temperate', saltflat: 'prop.decor_barren', blacksand: 'prop.decor_volcanic', fungal: 'prop.decor_mossy', crystal: 'prop.decor_ice',
};
/** The seven living-island biomes' own land and decor (docs/11 P5), over the stand-ins above when loaded. */
const BIOME_OWN: Partial<Record<IslandBiome, { land: string; decor: string; shore?: string }>> = {
  jungle: { land: 'tex.land_jungle', decor: 'prop.decor_jungle' }, mangrove: { land: 'tex.land_mangrove', decor: 'prop.decor_mangrove' },
  atoll: { land: 'tex.land_atoll', decor: 'prop.decor_atoll', shore: 'tex.shore_coral' }, saltflat: { land: 'tex.land_saltflat', decor: 'prop.decor_saltflat' },
  blacksand: { land: 'tex.land_blacksand', decor: 'prop.decor_blacksand' }, fungal: { land: 'tex.land_fungal', decor: 'prop.decor_fungal' },
  crystal: { land: 'tex.land_crystal', decor: 'prop.decor_crystal' },
};
/** A town's painting on the chart: her own where the manifest has one (the twenty towns of step 8, prop.port_<id>:
 *  shared/src/world/newports.ts), else her flag's town, else any town — so a painting that arrives is drawn at once. */
const townArt = (p: { id: string; faction: string }): string | null => {
  for (const id of [`prop.port_${p.id}`, `prop.port_${p.faction}`, 'prop.port_town']) if (sprite(id)) return id;
  return null;
};
const landArt = (b: IslandBiome): string => {
  const own = BIOME_OWN[b]?.land;
  return own && sprite(own) ? own : BIOME_LAND[b];
};
const shoreArt = (b: IslandBiome): string => {
  const own = BIOME_OWN[b]?.shore;
  return own && sprite(own) ? own : BIOME_SHORE[b];
};
const decorArt = (b: IslandBiome): string => {
  const own = BIOME_OWN[b]?.decor;
  return own && sprite(own) ? own : BIOME_DECOR[b];
};
/** A world boss painted apart from its class (the Hollow Admiral's flagship, the Ancient Leviathan), when loaded. */
const bossArt = (id: number, state: ClientState): string | undefined => {
  const b = state.bosses.find((f) => f.id === id);
  return b && sprite(`monster.${b.kind}`) ? `monster.${b.kind}` : undefined;
};
/** Island features: the sprite, its size in metres, where it stands (salt, inset toward the centre). */
const FEATURE_ART: Record<string, { id: string; size: number; salt: number; inset: number }> = {
  lighthouse: { id: 'prop.lighthouse', size: 70, salt: 1, inset: 0.04 },
  wreck: { id: 'prop.shipwreck', size: 80, salt: 2, inset: -0.1 },
  ruins: { id: 'prop.ruins', size: 110, salt: 3, inset: 0.3 },
  shrine: { id: 'prop.shrine', size: 70, salt: 4, inset: 0.35 },
  grove: { id: 'prop.grove', size: 120, salt: 5, inset: 0.4 },
  mine: { id: 'prop.mine', size: 70, salt: 6, inset: 0.3 },
  pearl_bank: { id: 'prop.pearl_bank', size: 80, salt: 7, inset: -0.06 },
  cache: { id: 'prop.cache', size: 34, salt: 8, inset: 0.25 },
  fort: { id: 'prop.fort', size: 120, salt: 9, inset: 0.2 },
  volcano: { id: 'prop.volcano', size: 150, salt: 10, inset: 0.55 },
  bones: { id: 'prop.bones', size: 110, salt: 11, inset: 0.05 },
  bell: { id: 'prop.bell_tower', size: 70, salt: 12, inset: -0.12 },
  hermit: { id: 'prop.hermit', size: 60, salt: 13, inset: 0.25 },
  spring: { id: 'prop.spring', size: 60, salt: 14, inset: 0.4 },
};

/** The kinds of island each landmark of tools/art/isles.py suits (null: any): the lighthouse, the hilltop temple, the
 *  toppled statue, the ring fort, the step pyramid, the hollow tree, the wreck ashore, the stone face, the sunken
 *  spire, the menhirs, the windmill farm, the crater's observatory, the frozen wreck, the crystal tower, the mushroom
 *  chapel, the pirate fort. */
const LANDMARK_KINDS: (IslandBiome[] | null)[] = [
  null, ['temperate', 'mossy', 'ruins', 'barren', 'bone'], null, ['temperate', 'mossy', 'barren', 'bone', 'ruins'],
  ['jungle', 'ruins', 'mangrove'], ['temperate', 'mossy', 'jungle', 'mangrove'], null, ['barren', 'ruins', 'jungle', 'blacksand', 'volcanic'],
  ['mossy', 'ruins', 'mangrove', 'bone'], ['temperate', 'mossy', 'bone', 'barren'], ['temperate'], ['volcanic', 'blacksand'],
  ['ice'], ['crystal'], ['fungal'], ['jungle', 'blacksand', 'saltflat', 'barren', 'temperate'],
];

interface Decor {
  x: number;
  y: number;
  rot: number;
  size: number;
  /** A big clump on a green island is a whole grove. */
  grove: boolean;
  /** On fungal and crystal isles, one of their own shapes instead of the old clump; on any, one of its things. */
  odd: boolean;
  /** Which of the island's own things (0..1). */
  pick: number;
}

/** Fungal caps: a cluster of pale domes with dark gills. */
function drawCaps(g: CanvasRenderingContext2D, size: number): void {
  const caps: [number, number, number][] = [[0, 0, 0.32], [-0.22, 0.14, 0.2], [0.24, 0.1, 0.18], [0.05, -0.24, 0.15]];
  for (const [dx, dy, r] of caps) {
    const x = dx * size, y = dy * size, rr = r * size;
    const grd = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr);
    grd.addColorStop(0, 'rgba(226,206,240,0.95)');
    grd.addColorStop(0.6, 'rgba(150,104,176,0.9)');
    grd.addColorStop(1, 'rgba(52,30,64,0.85)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40,20,50,0.5)';
    g.lineWidth = Math.max(0.5, rr * 0.08);
    g.beginPath();
    g.arc(x, y, rr * 0.55, 0, Math.PI * 2);
    g.stroke();
  }
}

/** Crystal shards: thin facets rising together, lit on one side. */
function drawShards(g: CanvasRenderingContext2D, size: number): void {
  const shards: [number, number, number, number][] = [[0, 0, 0.5, 0.13], [-0.18, 0.08, 0.36, 0.1], [0.2, 0.06, 0.4, 0.1], [0.06, 0.2, 0.28, 0.08]];
  for (const [dx, dy, h, w] of shards) {
    const x = dx * size, y = dy * size, hh = h * size, ww = w * size;
    const grd = g.createLinearGradient(x - ww, y, x + ww, y - hh);
    grd.addColorStop(0, 'rgba(70,90,150,0.95)');
    grd.addColorStop(0.5, 'rgba(170,200,245,0.95)');
    grd.addColorStop(1, 'rgba(236,244,255,0.95)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x - ww, y);
    g.lineTo(x, y - hh);
    g.lineTo(x + ww, y);
    g.lineTo(x, y + ww * 0.6);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(0.5, ww * 0.12);
    g.beginPath();
    g.moveTo(x, y - hh);
    g.lineTo(x, y + ww * 0.6);
    g.stroke();
  }
}

/** A small deterministic generator (the same island always wears the same decor). */
function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function inPoly(poly: number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface DrawShip {
  id: number;
  x: number;
  y: number;
  h: number;
  spd: number;
  sail: number;
  hull: number;
  sails: number;
  flags: number;
  classId: ShipClassId;
  info: ShipInfo | null;
  own: boolean;
  sinkT: number;
}

const LS = dict(SEN, SRU);

/** A lair's name and state over its fort (docs/16 #7). */
function lairLabel(l: LairView): { name: string; state: string | null; color: string } {
  const name = LS('lair.label', { captain: serverText(l.captain), level: l.level });
  if (l.stormed) return { name, state: LS('lair.stormed'), color: '#9a9a9a' };
  if (l.open) return { name, state: LS('lair.open'), color: '#f2c14e' };
  const bits = [l.hp <= 0 ? LS('lair.silenced') : null, l.garrison ? LS('lair.garrison', { n: l.garrison }) : null].filter(Boolean) as string[];
  return { name, state: bits.length ? bits.join(' · ') : null, color: l.hp <= 0 ? '#e8c46a' : '#e07a5a' };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly fx = new Fx();
  w = 0;
  h = 0;
  dpr = 1;
  camX = 0;
  camY = 0;
  zoom = 2.6; // px per meter
  targetZoom = 2.6;
  /** Once the captain zooms, the screen size no longer picks the zoom. */
  userZoomed = false;
  /** Her mark within the close fight's band (her gun captains fire) or not yet: the word under its ring (main.ts). */
  markRange: 'in' | 'far' | null = null;
  time = 0;
  mouseX = 0;
  mouseY = 0;
  onLightning: () => void = () => {};
  private dark: HTMLCanvasElement;
  private dg: CanvasRenderingContext2D;
  private noise: HTMLCanvasElement;
  private noisePattern: CanvasPattern | null = null;
  private rain: { x: number; y: number; s: number }[] = [];
  private streaks: { x: number; y: number; t: number }[] = [];
  private lightning = 0;
  private nextLightning = 5;
  private sinkStarts = new Map<number, number>();
  readonly atlas = new SpriteAtlas();
  /** A look-ahead offset in metres (the gamepad's right stick). */
  look = { x: 0, y: 0 };
  /** The camera's look ahead of her bow, eased on its own so a turn does not swing her across the screen. */
  private lead = { x: 0, y: 0 };
  private shipCache = new Map<string, { canvas: HTMLCanvasElement; extentY: number; cx: number; cy: number }>();
  private wakes = new Map<number, { x: number; y: number; t: number; w: number }[]>();

  /** WebGL layers: the shader sea below, the fog and lightning above (null: the 2D fallback draws them). */
  readonly sea: GlSea | null;
  readonly sky: GlSky | null;
  private bolt: [number, number][] | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const want = glWanted();
    this.sea = want ? GlSea.create() : null;
    this.sky = this.sea ? GlSky.create() : null;
    if (this.sea) canvas.before(this.sea.canvas);
    if (this.sky) canvas.after(this.sky.canvas);
    // Over a shader sea the world canvas is transparent where there is only water.
    this.g = canvas.getContext('2d', { alpha: !!this.sea })!;
    this.dark = document.createElement('canvas');
    this.dg = this.dark.getContext('2d')!;
    this.noise = this.makeNoise(256);
    this.resize();
    addEventListener('resize', () => this.resize());
    for (let i = 0; i < 260; i++) this.rain.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
    for (let i = 0; i < 70; i++) this.streaks.push({ x: Math.random(), y: Math.random(), t: Math.random() * 4 });
  }

  resize(): void {
    // Phones and tablets draw at 1.5× at most: three full-screen layers at 3× cost more than they show.
    this.dpr = Math.min(matchMedia('(pointer: coarse)').matches ? 1.5 : 2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.sea?.resize(this.w, this.h, this.dpr);
    this.sky?.resize(this.w, this.h, this.dpr);
    this.dark.width = Math.round(this.w / 2);
    this.dark.height = Math.round(this.h / 2);
    // The default view spans about 260 m across the short side of the screen: a phone still sees a broadside's
    // reach around her, a desktop keeps the close view.
    if (!this.userZoomed) this.targetZoom = clamp(Math.min(this.w, this.h) / 260, 1.3, 2.6);
  }

  private makeNoise(size: number): HTMLCanvasElement {
    // Tileable fog/wave noise generated once (fallback when the ocean texture is unavailable).
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    const period = 8;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * period, v = (y / size) * period;
        // Tile by blending four offset samples.
        const fx = x / size, fy = y / size;
        const n =
          fbm(u, v, 7) * (1 - fx) * (1 - fy) + fbm(u - period, v, 7) * fx * (1 - fy) + fbm(u, v - period, 7) * (1 - fx) * fy + fbm(u - period, v - period, 7) * fx * fy;
        const i = (y * size + x) * 4;
        const val = Math.round(n * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  sx(x: number): number {
    return (x - this.camX) * this.zoom + this.w / 2;
  }
  sy(y: number): number {
    return (y - this.camY) * this.zoom + this.h / 2;
  }
  toWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.w / 2) / this.zoom + this.camX, y: (py - this.h / 2) / this.zoom + this.camY };
  }

  /** Main frame. */
  private frameNo = 0;

  render(state: ClientState, own: SailState | null, dt: number, aim: { side: 'port' | 'starboard' | null; dist: number; boardTarget: number | null; chaser: 'bow' | 'stern' | null; charge?: { side: 'port' | 'starboard'; held: number } | null; target?: number | null; range?: 'in' | 'far' | null }): void {
    this.time += dt;
    this.markRange = aim.range ?? null;
    this.frameNo++;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 8);
    const g = this.g;
    if (own) {
      // Look a little ahead of the ship, further at the pace of the sea, but never so far that she leaves the middle
      // of the screen: the look ahead eases slower than she turns, so she stays put and the sea turns about her.
      const v = headingVec(own.heading);
      const reach = Math.min(own.speed * SPEED_SCALE * 0.8, (Math.min(this.w, this.h) * 0.18) / Math.max(0.1, this.zoom));
      // A long way off (the first frame, a respawn, a teleport): cut straight to her instead of flying the chart.
      const far = Math.hypot(own.x - this.camX, own.y - this.camY) > 1500;
      const kl = far ? 1 : Math.min(1, dt * 0.8);
      this.lead.x += (v.x * reach - this.lead.x) * kl;
      this.lead.y += (v.y * reach - this.lead.y) * kl;
      const k = far ? 1 : Math.min(1, dt * 6);
      this.camX += (own.x + this.lead.x + this.look.x - this.camX) * k;
      this.camY += (own.y + this.lead.y + this.look.y - this.camY) * k;
    }
    // Particle LOD: the frame time picks it; nothing decorative is born off screen.
    this.fx.frame(dt * 1000);
    {
      const mx = this.w / 2 / this.zoom + 120, my = this.h / 2 / this.zoom + 120;
      this.fx.view = { x0: this.camX - mx, y0: this.camY - my, x1: this.camX + mx, y1: this.camY + my };
    }
    this.fx.update(dt);
    const opt = settings();
    const shake = opt.screenShake ? this.fx.shake : 0;
    const shx = shake ? (Math.random() - 0.5) * shake * 8 : 0, shy = shake ? (Math.random() - 0.5) * shake * 8 : 0;
    g.setTransform(this.dpr, 0, 0, this.dpr, shx * this.dpr, shy * this.dpr);

    const night = nightFactor(state.estServerTime());
    this.nightNow = night;
    const opt0 = settings();
    const region = REGIONS[state.region];
    this.drawOcean(state, region.waterTint);
    this.drawCurrents(state);
    const islands = this.visibleIslands(state);
    this.drawWhirlpools(state);
    const ictx = this.islesCtx(state, night);
    this.drawReefs(state, ictx);
    this.drawSeaMarks(state);
    drawBanks(g, state, ictx); // banks the tide or a season has bared (docs/16 #25)
    for (const is of islands) this.drawShallows(is);
    const tctx = (this.tctx = this.isleTypeCtx(night)); // docs/18 III: each kind's water, the mist, the levels, the turtle islands
    for (const is of islands) drawIsleHalo(g, is, tctx);
    for (const is of islands) this.drawIsland(is, state);
    this.drawPorts(state);
    drawLookouts(g, state, ictx, state.wind[0]); // lookouts on the headlands (docs/16 #24)
    this.drawIsles18(state, own, islands, tctx);
    drawAdvWorld(g, state, this.advCtx()); // the adventure map's things on their skerries (docs/17 H4)
    drawLairsWorld(g, state, this.advCtx()); // the lairs of the land's creatures on their islands (docs/18 II)
    drawDriftsWorld(g, state, this.advCtx()); // drifting creatures and the season's legend (docs/18 IV)
    drawFindsWorld(g, state, this.advCtx()); // the sea's small things (docs/19 D5)
    drawRoamsWorld(g, state, this.advCtx()); // the creatures roaming the sea (docs/19 D7)
    // The pirate lairs near her (docs/16 #7): the fort, its guns on the shore, the camp.
    if (this.zoom >= 0.12) {
      const ctx = { sx: (x: number) => this.sx(x), sy: (y: number) => this.sy(y), zoom: this.zoom, time: opt0.reduceMotion ? 0 : this.time, night, w: this.w, h: this.h, fx: this.fx, label: (l: LairView) => lairLabel(l) };
      for (const l of state.wanted?.lairs ?? []) drawLair(g, l, ctx);
    }

    // Ships.
    const ships: DrawShip[] = [];
    for (const s of state.ships.values()) ships.push(this.toDraw(s));
    if (own && state.you && state.self) {
      ships.push({
        id: state.entityId, x: own.x, y: own.y, h: own.heading, spd: own.speed, sail: own.sail, hull: state.you.hull / state.you.hullMax,
        sails: state.you.sails / state.you.sailsMax, flags: state.you.flags, classId: state.self.loadout.classId, info: null, own: true, sinkT: 0,
      });
    }
    this.berth(ships, state);
    const stalls = this.stallShadows(state);
    ships.push(...stalls.map((x) => x.ship));
    for (const s of ships) this.updateWake(s, dt);
    this.drawWakes();
    this.drawLoot(state);
    drawShoals(g, state.shoals, state.self?.fishing?.traps ?? [], (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, this.w, this.h);
    this.drawCarcasses(state);
    this.drawBuoys(state);
    this.drawWonders(state);
    this.drawLanterns(state);
    this.drawStormHeart(state);
    this.drawStair(state);
    this.drawKegs(state);
    this.drawOrderMarks(state);
    drawSights(g, state.sights, (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, own ? { x: own.x, y: own.y } : null, this.w, this.h);
    this.drawDuelRing(state);
    drawPveSites(g, state.pveSites, (x) => this.sx(x), (y) => this.sy(y), this.zoom, this.time, this.w, this.h);
    drawBossZones(g, state.bosses, (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, false); // no pulsing zones when motion is reduced
    this.drawCompanions(state, ships);
    this.drawPods(state, ships);
    for (const s of ships) this.drawShip(s, state);
    drawMuzzles(g, this.fx, (x) => this.sx(x), (y) => this.sy(y), this.zoom);
    drawShoalBirds(g, state.shoals, (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, this.w, this.h);
    this.drawStallSigns(stalls);
    this.drawDeckPets(state, ships);
    this.drawTethers(state, ships);
    this.drawBalls();
    this.drawParticles(false);

    // The Islands of Light burn in the Abyss's dark.
    for (const l of state.self?.abyss?.lights ?? []) this.fx.light(l.x, l.y, 700, 'rgba(255,245,210,1)', 0.9, 0.05);
    this.drawLighting(state, ships, night);
    // The lit lighthouses' beams sweep the dark (docs/16 #23).
    { const lit = litLights(state); if (lit.length) drawBeams(g, lit, towerPoints(state.islands, lit, (is) => this.featurePoint(is, 1, 0.04)), ictx); }
    drawBossZones(g, state.bosses, (x) => this.sx(x), (y) => this.sy(y), this.zoom, opt.reduceMotion ? 0 : this.time, true);
    this.drawParticles(true);
    this.drawWeather(state, dt);

    // Overlays (not affected by darkness).
    if (own && state.you && state.self) this.drawAim(state, own, aim, ships);
    if (own && state.self) this.drawOwnMark(state, own);
    // Names from the lowest on the screen up, each stepping above any it would lie on.
    this.labelBoxes = [];
    for (const s of [...ships].filter((x) => !x.own).sort((a, b) => b.y - a.y)) this.drawLabel(s, state, aim.boardTarget === s.id, aim.target === s.id);
    if (own) this.drawThreatMarks(ships, own);
    if (own) this.drawQuestMark(state, own);
    this.drawTexts();
    this.drawVignette(state.fog, night);
    this.drawDescentDark(state);
    if (this.fx.flash > 0) {
      // Reduced flashes: a gentle 30% lift instead of a white-out.
      // Lightning lights the sea for an instant; it must not wash the whole screen white.
      g.fillStyle = `rgba(210,225,255,${this.fx.flash * (opt.reduceFlashes ? 0.08 : 0.22)})`;
      g.fillRect(0, 0, this.w, this.h);
    }
  }

  // ------------------------------------------------------------------ ocean

  private drawOcean(state: ClientState, tint: string): void {
    const g = this.g;
    if (this.sea) {
      // The shader sea: the 2D canvas is cleared to let it through; wind streaks stay for reading the wind.
      g.clearRect(-20, -20, this.w + 40, this.h + 40);
      // The painted sea and mist join the shaders once they have loaded.
      if (!this.sea.hasTexture) {
        const t = sprite('tex.ocean');
        if (t) this.sea.setTexture(t.img);
      }
      if (this.sky && !this.sky.hasTexture) {
        const f = sprite('tex.fog');
        if (f) this.sky.setTexture(f.img);
      }
      const wakes: { x: number; y: number; age: number; w: number }[] = [];
      for (const w of this.wakes.values()) for (let i = Math.max(0, w.length - 12); i < w.length; i++) wakes.push({ x: w[i].x, y: w[i].y, age: this.time - w[i].t, w: w[i].w * (1 + (this.time - w[i].t) * 0.35) });
      wakes.sort((a, b) => b.age - a.age);
      const wv = headingVec(state.wind[0]);
      this.sea.draw({
        camX: this.camX, camY: this.camY, zoom: this.zoom, time: this.time, tint: hexRgb(tint), wind: [wv.x, wv.y, clamp(state.wind[1], 0, 1.4)],
        night: nightFactor(state.estServerTime()), wakes,
      });
      this.drawStreaks(state);
      return;
    }
    g.fillStyle = tint;
    g.fillRect(-20, -20, this.w + 40, this.h + 40);
    const tex = pattern(g, 'tex.ocean');
    const wind = headingVec(state.wind[0]);
    const tile = 240; // meters per texture tile
    if (tex) {
      const s = sprite('tex.ocean')!;
      const k = (tile * this.zoom) / s.img.naturalWidth;
      const drift = this.time * 1.6;
      for (const [alpha, scale, dx, dy] of [
        [0.55, 1, wind.x * drift, wind.y * drift],
        [0.22, 0.63, -wind.y * drift * 0.7 + 90, wind.x * drift * 0.7 + 40],
      ] as const) {
        const m = new DOMMatrix().translate(this.sx(dx), this.sy(dy)).scale(k * scale);
        tex.setTransform(m);
        g.globalAlpha = alpha;
        g.fillStyle = tex;
        g.fillRect(0, 0, this.w, this.h);
      }
      g.globalAlpha = 1;
    } else {
      this.noisePattern ??= g.createPattern(this.noise, 'repeat');
      const p = this.noisePattern!;
      const k = (tile * this.zoom) / 256;
      const drift = this.time * 2;
      p.setTransform(new DOMMatrix().translate(this.sx(wind.x * drift), this.sy(wind.y * drift)).scale(k));
      g.globalAlpha = 0.07;
      g.fillStyle = p;
      g.globalCompositeOperation = 'screen';
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    // Moonlit sheen band that slowly moves.
    const grd = g.createLinearGradient(0, 0, this.w, this.h);
    const t = (Math.sin(this.time * 0.05) + 1) / 2;
    grd.addColorStop(clamp(t - 0.25, 0, 1), 'rgba(120,150,180,0)');
    grd.addColorStop(t, 'rgba(120,150,180,0.05)');
    grd.addColorStop(clamp(t + 0.25, 0, 1), 'rgba(120,150,180,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, this.w, this.h);

    this.drawStreaks(state);
  }

  /** Wind streaks: short pale dashes drifting downwind (readability of wind direction). */
  private drawStreaks(state: ClientState): void {
    const g = this.g;
    const wind = headingVec(state.wind[0]);
    g.strokeStyle = 'rgba(200,215,225,0.10)';
    g.lineWidth = 1;
    const len = 10 + state.wind[1] * 16;
    for (const st of this.streaks) {
      st.t += 0.016;
      const life = (st.t % 4) / 4;
      const px = ((st.x * this.w + wind.x * life * 180) % this.w + this.w) % this.w;
      const py = ((st.y * this.h + wind.y * life * 180) % this.h + this.h) % this.h;
      g.globalAlpha = Math.sin(life * Math.PI) * clamp(state.wind[1], 0.2, 1);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + wind.x * len, py + wind.y * len);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawCurrents(state: ClientState): void {
    const g = this.g;
    const navigator = state.self?.captain === 'navigator';
    g.save();
    g.lineCap = 'butt';
    for (const c of state.currents) {
      g.beginPath();
      for (let i = 0; i < c.points.length; i++) {
        const [x, y] = c.points[i];
        if (i === 0) g.moveTo(this.sx(x), this.sy(y));
        else g.lineTo(this.sx(x), this.sy(y));
      }
      g.setLineDash([14 * this.zoom, 60 * this.zoom]);
      g.lineDashOffset = -this.time * c.strength * 4 * this.zoom;
      g.strokeStyle = navigator ? 'rgba(140,200,220,0.2)' : 'rgba(140,180,200,0.06)';
      g.lineWidth = clamp(c.width * 0.004 * this.zoom, 1, 6);
      g.stroke();
    }
    g.restore();
  }

  // ------------------------------------------------------------------ islands

  private visibleIslands(state: ClientState): IslandData[] {
    const out: IslandData[] = [];
    const margin = 200;
    const hw = this.w / 2 / this.zoom + margin, hh = this.h / 2 / this.zoom + margin;
    for (const is of state.islands.values()) {
      if (Math.abs(is.x - this.camX) - is.r > hw || Math.abs(is.y - this.camY) - is.r > hh) continue;
      out.push(is);
    }
    return out;
  }

  /** A coast or reef outline, rounded: curves through the edges' midpoints with the vertices as control points. */
  private path(poly: number[], scale = 1, cx = 0, cy = 0): void {
    const g = this.g;
    const n = poly.length / 2;
    const px = (i: number) => this.sx(cx + (poly[(i % n) * 2] - cx) * scale);
    const py = (i: number) => this.sy(cy + (poly[(i % n) * 2 + 1] - cy) * scale);
    g.beginPath();
    if (n < 4) {
      for (let i = 0; i < n; i++) (i ? g.lineTo(px(i), py(i)) : g.moveTo(px(i), py(i)));
      g.closePath();
      return;
    }
    g.moveTo((px(0) + px(1)) / 2, (py(0) + py(1)) / 2);
    for (let i = 1; i <= n; i++) g.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
    g.closePath();
  }

  private drawWhirlpools(state: ClientState): void {
    const g = this.g;
    for (const w of state.whirlpools) {
      const reach = w.radius * 2.2;
      if (Math.abs(w.x - this.camX) - reach > this.w / 2 / this.zoom || Math.abs(w.y - this.camY) - reach > this.h / 2 / this.zoom) continue;
      const cx = this.sx(w.x), cy = this.sy(w.y);
      // Darkening funnel.
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, reach * this.zoom);
      grd.addColorStop(0, 'rgba(0,0,0,0.75)');
      grd.addColorStop(0.3, 'rgba(2,6,8,0.45)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, reach * this.zoom, 0, Math.PI * 2);
      g.fill();
      // Spiral foam arms rotating with the flow: the painted maelstrom when it has loaded.
      const dirSign = w.clockwise ? 1 : -1;
      const spin = this.time * 0.25 * dirSign;
      const art = sprite('prop.whirlpool');
      if (art) {
        const size = reach * 2 * this.zoom;
        g.save();
        g.translate(cx, cy);
        g.rotate(spin * 1.6);
        if (!w.clockwise) g.scale(-1, 1);
        g.globalAlpha = 0.85;
        g.drawImage(art.img, -size / 2, -size / 2, size, size);
        g.restore();
      }
      g.lineWidth = Math.max(1, 2 * this.zoom);
      for (let arm = 0; arm < (art ? 0 : 5); arm++) {
        g.beginPath();
        for (let i = 0; i <= 60; i++) {
          const t = i / 60;
          const r = reach * (1 - t * 0.95);
          const a = spin + (arm / 5) * Math.PI * 2 + dirSign * t * Math.PI * 3.2;
          const x = cx + Math.sin(a) * r * this.zoom, y = cy - Math.cos(a) * r * this.zoom;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokeStyle = `rgba(200,212,220,${0.08 + (arm % 2) * 0.05})`;
        g.stroke();
      }
      if (this.zoom < 2.5) {
        g.font = 'italic 14px "Cormorant Garamond", Georgia, serif';
        g.fillStyle = 'rgba(208,106,94,0.6)';
        g.textAlign = 'center';
        g.fillText(w.name, cx, cy - w.radius * 0.4 * this.zoom);
      }
    }
  }

  /** The frame's context for batch E's drawing (docs/16 #23–25). */
  /** Where the adventure map draws (docs/17 H4). */
  private advCtx(): { sx: (x: number) => number; sy: (y: number) => number; zoom: number; time: number; w: number; h: number } {
    return { sx: (x) => this.sx(x), sy: (y) => this.sy(y), zoom: this.zoom, time: settings().reduceMotion ? 0 : this.time, w: this.w, h: this.h };
  }

  private islesCtx(state: ClientState, night: number): IslesCtx {
    const now = state.estServerTime();
    const ru = lang() === 'ru' ? 1 : 0;
    const label = (b: TidalView) => {
      const name = TIDAL_NAMES[b.name][ru];
      const n = Math.max(1, Math.round((b.turn - now) / 60));
      return b.kind === 'season' ? LI('tide.seasonUp', { name, season: SEASON_NAMES[b.season][ru] }) : LI('tide.up', { name, n });
    };
    return { sx: (x) => this.sx(x), sy: (y) => this.sy(y), zoom: this.zoom, time: settings().reduceMotion ? 0 : this.time, night, w: this.w, h: this.h, label, lookLabel: (c) => LI(c ? 'look.done' : 'look.label') };
  }

  private drawReefs(state: ClientState, ictx?: IslesCtx): void {
    const g = this.g;
    const hw = this.w / 2 / this.zoom + 300, hh = this.h / 2 / this.zoom + 300;
    // Shoals within reach of a lit lighthouse take its warm edge at night (docs/16 #23).
    const lit = ictx && ictx.night >= 0.35 ? litLights(state) : [];
    for (const rf of state.reefs.values()) {
      if (Math.abs(rf.x - this.camX) - rf.r > hw || Math.abs(rf.y - this.camY) - rf.r > hh) continue;
      g.save();
      g.lineJoin = 'round';
      this.path(rf.poly);
      // Pale water over coral and sand: reads as danger without shouting. The painted seabed shows through.
      const bed = this.tiled('tex.reef', 120, rf.x | 0);
      if (bed) {
        g.globalAlpha = 0.55;
        g.fillStyle = bed;
        g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(52,96,92,0.18)';
      g.fill();
      g.lineWidth = 24 * this.zoom;
      g.strokeStyle = 'rgba(40,84,82,0.10)';
      g.stroke();
      this.path(rf.poly, 0.55, rf.x, rf.y);
      g.fillStyle = 'rgba(120,150,130,0.16)';
      g.fill();
      // Breakers.
      this.path(rf.poly);
      g.setLineDash([2 * this.zoom, 7 * this.zoom]);
      g.lineDashOffset = -this.time * 3 * this.zoom;
      g.strokeStyle = 'rgba(215,225,228,0.30)';
      g.lineWidth = Math.max(1, 1.6 * this.zoom);
      g.stroke();
      g.setLineDash([]);
      if (this.zoom > 1.2) {
        g.font = 'italic 11px "Cormorant Garamond", Georgia, serif';
        g.fillStyle = 'rgba(200,215,210,0.55)';
        g.textAlign = 'center';
        g.fillText(L('reef', { m: rf.depth.toFixed(1) }), this.sx(rf.x), this.sy(rf.y));
      }
      if (lit.length && ictx && reefInLight(lit, rf)) drawReefLight(g, rf, ictx, () => this.path(rf.poly));
      g.restore();
    }
  }

  private drawShallows(is: IslandData): void {
    if (is.mist) return; // a hidden island's mist hides her shallows too (docs/18 #30)
    const g = this.g;
    g.save();
    g.lineJoin = 'round';
    this.path(is.poly);
    const strange = REGIONS[is.region].strangeness;
    const base = strange > 0.4 ? '20,70,72' : '40,70,80';
    for (const [w, a] of [[110, 0.05], [60, 0.07], [28, 0.1]] as const) {
      g.lineWidth = w * this.zoom;
      g.strokeStyle = `rgba(${base},${a})`;
      g.stroke();
    }
    g.restore();
  }

  /** The dense sea's marks (docs/16 P3): wreck fields half awash, lane buoys, lantern floats, driftwood, floating
   *  bones and ice floes — from the painted wrecks and flotsam where they are, drawn by hand where they are not. */
  private drawSeaMarks(state: ClientState): void {
    if (!state.seaMarks.size) return;
    const g = this.g;
    const z = this.zoom;
    const hw = this.w / 2 / z + 150, hh = this.h / 2 / z + 150;
    const t = settings().reduceMotion ? 0 : this.time;
    const spriteAt = (id: string, px: number, py: number, sz: number, rot: number, alpha: number): boolean => {
      const spr = sprite(id);
      if (!spr) return false;
      g.save();
      g.globalAlpha = alpha;
      g.translate(px, py);
      g.rotate(rot);
      g.drawImage(spr.img, -sz / 2, -sz / 2, sz, sz);
      g.restore();
      return true;
    };
    for (const m of state.seaMarks.values()) {
      if (Math.abs(m.x - this.camX) - m.r > hw || Math.abs(m.y - this.camY) - m.r > hh) continue;
      const x = this.sx(m.x), y = this.sy(m.y), size = m.r * 2 * z;
      const rnd = seeded(m.seed);
      switch (m.kind) {
        case 'wreck': {
          // Dark water over the sunken part, the broken hull awash, planks and casks about it.
          g.fillStyle = 'rgba(4,10,14,0.28)';
          g.beginPath();
          g.ellipse(x, y, size * 0.55, size * 0.4, m.rot, 0, Math.PI * 2);
          g.fill();
          if (!spriteAt('prop.shipwreck', x, y, size, m.rot, 0.82)) {
            g.fillStyle = '#2b2119';
            g.beginPath();
            g.ellipse(x, y, size * 0.4, size * 0.13, m.rot, 0, Math.PI * 2);
            g.fill();
          }
          for (let k = 0; k < 3; k++) {
            const a = rnd() * Math.PI * 2, d = (0.45 + rnd() * 0.35) * size;
            spriteAt('prop.flotsam', x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.22 + rnd() * 0.14), rnd() * 6.28, 0.8);
          }
          // Foam where the swell breaks on the timbers.
          g.strokeStyle = `rgba(215,225,228,${0.14 + 0.08 * Math.sin(t * 1.5 + m.id)})`;
          g.lineWidth = Math.max(1, 1.5 * z);
          g.setLineDash([2 * z, 6 * z]);
          g.beginPath();
          g.ellipse(x, y, size * 0.5, size * 0.3, m.rot, 0, Math.PI * 2);
          g.stroke();
          g.setLineDash([]);
          break;
        }
        case 'drift':
          for (let k = 0; k < 3; k++) {
            const a = rnd() * Math.PI * 2, d = rnd() * size * 0.45;
            const px = x + Math.cos(a) * d + Math.sin(t * 0.3 + k) * 2 * z, py = y + Math.sin(a) * d;
            if (!spriteAt(k === 0 ? 'prop.wreckage' : 'prop.flotsam', px, py, size * (k === 0 ? 0.7 : 0.4), rnd() * 6.28 + t * 0.02, 0.85)) {
              g.fillStyle = '#3a2c1f';
              g.fillRect(px - 6 * z, py - 1.5 * z, 12 * z, 3 * z);
            }
          }
          break;
        case 'bones':
          g.fillStyle = 'rgba(4,10,14,0.22)';
          g.beginPath();
          g.ellipse(x, y, size * 0.5, size * 0.35, m.rot, 0, Math.PI * 2);
          g.fill();
          if (!spriteAt('prop.bones', x, y, size, m.rot, 0.8)) {
            g.strokeStyle = '#cfc6b0';
            g.lineWidth = 3 * z;
            for (let k = 0; k < 6; k++) {
              const a = m.rot + (k - 2.5) * 0.25;
              g.beginPath();
              g.arc(x, y, size * 0.35, a - 0.4, a + 0.4);
              g.stroke();
            }
          }
          break;
        case 'floe': {
          const n = 9;
          g.beginPath();
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + m.rot, r = m.r * z * (0.7 + rnd() * 0.3);
            const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8;
            if (k) g.lineTo(px, py);
            else g.moveTo(px, py);
          }
          g.closePath();
          g.save();
          g.translate(4 * z, 6 * z);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fill();
          g.restore();
          g.fillStyle = '#c9d6de';
          g.fill();
          g.strokeStyle = 'rgba(240,248,252,0.8)';
          g.lineWidth = Math.max(1, 1.5 * z);
          g.stroke();
          break;
        }
        case 'buoy':
        case 'lantern': {
          const r = Math.max(3, m.r * z);
          const by = y - Math.sin(t * 1.3 + m.id) * r * 0.3;
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.beginPath();
          g.ellipse(x + r * 0.3, y + r * 0.4, r * 1.1, r * 0.7, 0, 0, Math.PI * 2);
          g.fill();
          // A ring of ripples about her.
          g.strokeStyle = 'rgba(210,222,228,0.18)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y, r * (1.8 + 0.3 * Math.sin(t * 1.3 + m.id)), 0, Math.PI * 2);
          g.stroke();
          if (m.kind === 'buoy') {
            g.fillStyle = '#9e2a22';
            g.beginPath();
            g.arc(x, by, r, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = '#e6dcc4';
            g.beginPath();
            g.arc(x, by, r, -Math.PI * 0.2, Math.PI * 0.2);
            g.lineTo(x, by);
            g.fill();
            g.beginPath();
            g.arc(x, by, r, Math.PI * 0.8, Math.PI * 1.2);
            g.lineTo(x, by);
            g.fill();
            g.strokeStyle = '#1b120b';
            g.lineWidth = 1;
            g.beginPath();
            g.arc(x, by, r, 0, Math.PI * 2);
            g.stroke();
            if (this.nightNow > 0.3) this.fx.light(m.x, m.y, 70, 'rgba(255,90,70,1)', 0.5 * this.nightNow * (0.6 + 0.4 * Math.sin(t * 2 + m.id)), 0.05);
          } else {
            // A lantern on a little raft of planks: the candles set out for the drowned.
            g.fillStyle = '#3b2c1e';
            g.fillRect(x - r * 1.2, by - r * 0.7, r * 2.4, r * 1.4);
            g.fillStyle = '#f2c46a';
            g.beginPath();
            g.arc(x, by, r * 0.5, 0, Math.PI * 2);
            g.fill();
            this.fx.light(m.x, m.y, 110, 'rgba(255,190,110,1)', (0.25 + 0.5 * this.nightNow) * (0.8 + 0.2 * Math.sin(t * 5 + m.id)), 0.05);
          }
          break;
        }
      }
      this.drawMarkState(state, m, x, y, t);
    }
  }

  /** A sea mark's state for her: worked today (a faint ring and a tick), within reach (a gold ring that breathes),
   *  her boats at it (the ring filling as they work). */
  private drawMarkState(state: ClientState, m: SeaMarkData, x: number, y: number, t: number): void {
    const g = this.g, z = this.zoom;
    const own = state.ownDisplay;
    const busy = state.markBusy?.id === m.id ? state.markBusy : null;
    const done = state.markDone.has(m.id);
    const near = own ? markInReach(m, own.x, own.y) : false;
    if (!busy && !done && !near) return;
    const R = Math.max(10, m.r * z + 8 * z);
    g.save();
    if (busy) {
      const frac = Math.max(0, Math.min(1, 1 - (busy.until - state.estServerTime()) / busy.total));
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = Math.max(3, 4 * z);
      g.beginPath();
      g.arc(x, y, R, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#e8c36a';
      g.lineWidth = Math.max(2, 3 * z);
      g.beginPath();
      g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      g.stroke();
    } else if (done) {
      g.strokeStyle = 'rgba(200,205,200,0.35)';
      g.lineWidth = Math.max(1, 1.2 * z);
      g.setLineDash([3 * z, 5 * z]);
      g.beginPath();
      g.arc(x, y, R, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      // The tick of a mark searched.
      const s = Math.max(5, 6 * z), cx = x + R * 0.72, cy = y - R * 0.72;
      g.fillStyle = 'rgba(12,16,18,0.75)';
      g.beginPath();
      g.arc(cx, cy, s * 1.15, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#b9c7a4';
      g.lineWidth = Math.max(1.5, 1.6 * z);
      g.beginPath();
      g.moveTo(cx - s * 0.55, cy);
      g.lineTo(cx - s * 0.1, cy + s * 0.45);
      g.lineTo(cx + s * 0.6, cy - s * 0.45);
      g.stroke();
    } else {
      g.strokeStyle = `rgba(232,195,106,${0.35 + 0.25 * Math.sin(t * 2.4 + m.id)})`;
      g.lineWidth = Math.max(1.5, 2 * z);
      g.setLineDash([6 * z, 5 * z]);
      g.beginPath();
      g.arc(x, y, R, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  /** A floating town (docs/16 P3): old hulls moored side by side in two rows, gangplanks along the middle, huts and
   *  crates on the decks, a breakwater of wreckage at either end and lanterns at night — all from the painted ships
   *  and props, top-down. Its land is the hulks: ships moor off its side as at any quay. */
  private drawRaftTown(is: IslandData): void {
    const g = this.g;
    const z = this.zoom;
    const n = is.poly.length / 2;
    // The long axis: the farthest vertex from the middle.
    let r = 0, rot = 0;
    for (let i = 0; i < n; i++) {
      const dx = is.poly[i * 2] - is.x, dy = is.poly[i * 2 + 1] - is.y, d = Math.hypot(dx, dy);
      if (d > r) {
        r = d;
        rot = Math.atan2(dy, dx);
      }
    }
    const short = r * 0.62;
    const rnd = seeded(is.id * 7717 + 3);
    g.save();
    g.translate(this.sx(is.x), this.sy(is.y));
    g.rotate(rot);
    // Dark, still water in the lee of the hulls.
    g.fillStyle = 'rgba(3,8,11,0.35)';
    g.beginPath();
    g.ellipse(0, 0, r * 1.08 * z, short * 1.12 * z, 0, 0, Math.PI * 2);
    g.fill();
    const hulls: ShipClassId[] = ['galleon', 'fluyt', 'brig', 'frigate', 'schooner', 'xebec'];
    const beam = short * 0.5;
    const len = short * 0.95;
    const decks: [number, number][] = [];
    for (const row of [-1, 1]) {
      for (let u = -r * 0.82; u <= r * 0.82; u += beam * 0.62) {
        const v = row * short * 0.47;
        if ((u * u) / (r * r) + (v * v) / (short * short) > 0.78) continue;
        const img = this.shipImage(hulls[Math.floor(rnd() * hulls.length)], 1);
        const h = len * z * (0.85 + rnd() * 0.2);
        const w = h * (img.canvas.width / img.canvas.height);
        g.save();
        g.translate(u * z, v * z);
        // Bows out: each row's hulls lie across the town, sterns to the middle walk.
        g.rotate((row > 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.12);
        g.drawImage(img.canvas, -w / 2, -h * 0.55, w, h);
        g.restore();
        decks.push([u, v]);
      }
    }
    // The middle walk: gangplanks from hull to hull along the long axis.
    g.strokeStyle = '#4a3624';
    g.lineWidth = Math.max(2, short * 0.12 * z);
    g.beginPath();
    g.moveTo(-r * 0.8 * z, 0);
    g.lineTo(r * 0.8 * z, 0);
    g.stroke();
    g.strokeStyle = 'rgba(20,12,6,0.6)';
    g.lineWidth = 1;
    for (let u = -r * 0.8; u < r * 0.8; u += 7) {
      g.beginPath();
      g.moveTo(u * z, -short * 0.06 * z);
      g.lineTo(u * z, short * 0.06 * z);
      g.stroke();
    }
    // A breakwater of wreckage at either end.
    const wall = sprite('prop.wreck_wall');
    if (wall) {
      const ww = short * 1.5 * z, wh = ww * ((wall.img.naturalHeight || wall.img.height) / (wall.img.naturalWidth || wall.img.width));
      for (const end of [-1, 1]) {
        g.save();
        g.translate(end * r * 0.93 * z, 0);
        g.rotate(Math.PI / 2 + (end > 0 ? Math.PI : 0));
        g.drawImage(wall.img, -ww / 2, -wh / 2, ww, wh);
        g.restore();
      }
    }
    // Huts, crates and boats on and by the decks.
    const prop = (id: string, u: number, v: number, sz: number, a: number) => {
      const spr = sprite(id);
      if (!spr) return;
      g.save();
      g.translate(u * z, v * z);
      g.rotate(a);
      g.drawImage(spr.img, (-sz / 2) * z, (-sz / 2) * z, sz * z, sz * z);
      g.restore();
    };
    decks.forEach(([u, v], i) => {
      if (i % 3 === 0) prop('prop.life_hut', u, v * 0.7, short * 0.34, rnd() * 6.28);
      else if (i % 3 === 1) prop('prop.life_crates', u, v * 0.6, short * 0.22, rnd() * 6.28);
    });
    prop('prop.life_boat', 0, short * 1.12, short * 0.3, Math.PI / 2);
    prop('prop.life_boat', r * 0.4, -short * 1.1, short * 0.28, -Math.PI / 2);
    g.restore();
    // Lanterns strung along the walk.
    const glow = 0.25 + 0.65 * this.nightNow;
    for (let k = -2; k <= 2; k++) {
      const u = k * r * 0.35;
      const wx = is.x + Math.cos(rot) * u, wy = is.y + Math.sin(rot) * u;
      g.fillStyle = `rgba(255,200,120,${0.5 + 0.4 * this.nightNow})`;
      g.beginPath();
      g.arc(this.sx(wx), this.sy(wy), Math.max(1.5, 2.2 * z), 0, Math.PI * 2);
      g.fill();
      if (glow > 0.3) this.fx.light(wx, wy, 90, 'rgba(255,170,90,1)', glow * 0.6, 0.05);
    }
  }

  private tctx: IsleTypeCtx | null = null;
  /** docs/18 III: where the kinds and levels of the islands and the turtle islands draw. */
  private isleTypeCtx(night: number): IsleTypeCtx {
    return { sx: (x) => this.sx(x), sy: (y) => this.sy(y), zoom: this.zoom, time: settings().reduceMotion ? 0 : this.time, night, w: this.w, h: this.h, path: (p, k, cx, cy) => this.path(p, k, cx, cy) };
  }

  /** docs/18 III: the turtle islands, and each island's level by her when she is close. */
  private drawIsles18(state: ClientState, own: SailState | null, islands: IslandData[], c: IsleTypeCtx): void {
    const L18 = lang() === 'ru' ? I18_RU : I18_EN;
    const ru = lang() === 'ru' ? 1 : 0;
    const now = state.estServerTime();
    if (state.turtles.length) {
      drawTurtles(this.g, state.turtles, now, c, (t) => {
        const n = Math.max(1, Math.round((t.turn - now) / 60));
        const name = TURTLE_NAMES[t.name]?.[ru] ?? '';
        return (t.up ? L18['turtle.up'] : L18['turtle.down']).replace('{name}', name).replace('{lv}', String(t.level)).replace('{n}', String(n));
      });
    }
    if (!own || !state.self || this.zoom < 0.3) return;
    const mine = shipLevelOf(state.self.loadout);
    for (const is of islands) {
      if (is.mist || Math.hypot(is.x - own.x, is.y - own.y) - is.r > 2600) continue;
      drawIsleLevel(this.g, is, c, mine, L18.deadly);
    }
  }

  private drawIsland(is: IslandData, state: ClientState): void {
    if (is.mist) {
      drawMist(this.g, is, this.tctx ?? this.isleTypeCtx(this.nightNow)); // a hidden island not yet found (docs/18 #30)
      return;
    }
    if (is.raft) {
      this.drawRaftTown(is);
      return;
    }
    const g = this.g;
    g.save();
    g.lineJoin = 'round';
    // Height: the land throws a soft shadow on the water, away from the moon (south-east).
    g.save();
    g.translate(7 * this.zoom, 10 * this.zoom);
    this.path(is.poly);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fill();
    g.restore();
    // The shore: sand, black sand, ice or rock by biome, a band along the coast.
    this.path(is.poly);
    const shore = this.tiled(shoreArt(is.biome), 60, is.id) ?? this.tiled('tex.sand', 60, is.id);
    g.strokeStyle = shore ?? (is.biome === 'volcanic' ? '#241c19' : is.biome === 'ice' ? '#9aa4ad' : '#4d463b');
    g.lineWidth = 20 * this.zoom;
    g.stroke();
    // The land in its biome's painting (the old flat tint only when the art is missing).
    const landId = landArt(is.biome);
    const land = this.tiled(landId, 150, is.id) ?? this.tiled('tex.land', 150, is.id);
    g.fillStyle = land ?? BIOME_BASE[is.biome];
    g.fill();
    if (!sprite(landId)) {
      g.fillStyle = BIOME_TINT[is.biome];
      g.fill();
    }
    const glaze = landId === BIOME_LAND[is.biome] ? BIOME_GLAZE[is.biome] : undefined;
    if (glaze) {
      g.fillStyle = glaze;
      g.fill();
    }
    // Relief: hill-shaded height, cliffs and beaches (terrain.ts), clipped to the coast. Until an island's mask
    // is built (at most one a frame), concentric cores stand in.
    const relief = this.reliefOf(is);
    if (relief) {
      this.path(is.poly);
      g.save();
      g.clip();
      g.globalAlpha = sprite(landId) ? 0.5 : 1;
      g.drawImage(relief.canvas, this.sx(relief.x0), this.sy(relief.y0), relief.size * this.zoom, relief.size * this.zoom);
      g.restore();
    } else {
      for (const [sc, a] of [[0.72, 0.18], [0.45, 0.2]] as const) {
        this.path(is.poly, sc, is.x, is.y);
        g.fillStyle = is.biome === 'ice' ? `rgba(230,238,245,${a * 0.8})` : `rgba(8,10,8,${a})`;
        g.fill();
      }
    }
    this.drawBiomeLand(is);
    drawIsleOver(g, is, this.tctx ?? this.isleTypeCtx(this.nightNow)); // her kind on her land (docs/18 #27)
    // What grows and lies on the island.
    const decorId = decorArt(is.biome);
    const decor = sprite(decorId);
    const ownDecor = decorId !== BIOME_DECOR[is.biome];
    const grove = sprite('prop.grove');
    const props = this.isleProps(is);
    const lm = this.landmarkOf(is);
    if (decor && this.zoom > 0.3) {
      for (const d of this.decorOf(is, state)) {
        if (lm && Math.hypot(d.x - is.x, d.y - is.y) < lm.size * 0.55) continue; // clear ground round her landmark
        const size = d.size * this.zoom;
        const x = this.sx(d.x), y = this.sy(d.y);
        if (x < -size || y < -size || x > this.w + size || y > this.h + size) continue;
        g.save();
        g.translate(x, y);
        g.rotate(d.rot);
        // The island's own things among the clumps (owner, 2026-10-04: tools/art/isles.py): a cottage, a well, a
        // ring of stones — a few of her kind's sixteen, so no two islands of a kind are dressed alike.
        const prop = d.odd && props.length && (d.pick * 997) % 1 < 0.45 ? sprite(props[Math.floor(d.pick * props.length)]) : null;
        if (prop) {
          const ps = size * 0.6, k = ps / Math.max(prop.img.width, prop.img.height);
          g.drawImage(prop.img, (-prop.img.width * k) / 2, (-prop.img.height * k) / 2, prop.img.width * k, prop.img.height * k);
        }
        // Fungal and crystal isles grow their own shapes among the old clumps (until their own decor loads).
        else if (d.odd && !ownDecor && is.biome === 'fungal') drawCaps(g, size);
        else if (d.odd && !ownDecor && is.biome === 'crystal') drawShards(g, size);
        else g.drawImage((d.grove && grove ? grove : decor).img, -size / 2, -size / 2, size, size);
        g.restore();
      }
    }
    // A great island's landmark at her heart (tools/art/isles.py): a ruined temple, a stone circle, a wreck ashore.
    if (lm && this.zoom > 0.12) {
      const art = sprite(lm.id);
      if (art) {
        const size = lm.size * this.zoom, k = size / Math.max(art.img.width, art.img.height);
        g.save();
        g.translate(this.sx(is.x), this.sy(is.y));
        g.rotate(lm.rot);
        g.drawImage(art.img, (-art.img.width * k) / 2, (-art.img.height * k) / 2, art.img.width * k, art.img.height * k);
        g.restore();
      }
    }
    // Glowing caps and singing crystal give off a little light by night.
    if ((is.biome === 'fungal' || is.biome === 'crystal') && this.nightNow > 0.3 && this.zoom > 0.3) {
      const decors = this.decorOf(is, state);
      for (let k = 0; k < decors.length && k < 4; k++) {
        const d = decors[(k * 5) % decors.length];
        this.fx.light(d.x, d.y, 60 + d.size, is.biome === 'fungal' ? 'rgba(170,120,255,1)' : 'rgba(140,200,255,1)', 0.35 * this.nightNow, 0.05);
      }
    }
    this.drawShoreRocks(is);
    // Surf: two soft broken lines of foam working along the coast.
    this.path(is.poly);
    g.setLineDash([3 * this.zoom, 9 * this.zoom]);
    g.lineDashOffset = this.time * 4 * this.zoom;
    g.strokeStyle = 'rgba(210,220,225,0.2)';
    g.lineWidth = Math.max(1, 2.2 * this.zoom);
    g.stroke();
    this.path(is.poly, 1.035, is.x, is.y);
    g.setLineDash([2 * this.zoom, 13 * this.zoom]);
    g.lineDashOffset = -this.time * 3 * this.zoom;
    g.strokeStyle = 'rgba(200,212,220,0.1)';
    g.stroke();
    g.setLineDash([]);
    // Name label when zoomed out enough to matter or discovered.
    const known = state.discovered.has(is.id);
    // A village's island goes by the village's name, and the port writes it already.
    if (known && is.r > 180 && this.zoom < 2.2 && !is.portId) {
      g.font = `italic ${Math.round(clamp(is.r * this.zoom * 0.08, 11, 18))}px "Cormorant Garamond", Georgia, serif`;
      g.fillStyle = 'rgba(216,210,196,0.55)';
      g.textAlign = 'center';
      g.fillText(is.name, this.sx(is.x), this.sy(is.y));
    }
    g.restore();
    this.drawFeatures(is);
    this.drawLife(is);
  }

  /** Rocky coasts: stones just off the shore, and white water breaking on a few of them. */
  private drawShoreRocks(is: IslandData): void {
    const b = is.biome;
    if (this.zoom < 0.3 || !(b === 'volcanic' || b === 'crystal' || b === 'ice' || b === 'blacksand' || b === 'ruins' || b === 'barren' || b === 'temperate')) return;
    const g = this.g;
    const rnd = seeded(is.id * 613 + 29);
    const n = is.poly.length / 2;
    const stone = b === 'ice' ? '#9aa6b0' : b === 'crystal' ? '#6c7ca0' : b === 'volcanic' || b === 'blacksand' ? '#1c1817' : '#4a4640';
    const count = Math.min(14, Math.round(n / 3));
    for (let k = 0; k < count; k++) {
      const v = Math.floor(rnd() * n);
      const px = is.poly[v * 2], py = is.poly[v * 2 + 1];
      const dx = px - is.x, dy = py - is.y, l = Math.hypot(dx, dy) || 1;
      const off = 8 + rnd() * 22;
      const x = this.sx(px + (dx / l) * off), y = this.sy(py + (dy / l) * off);
      const r = (3 + rnd() * 6) * this.zoom;
      if (x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) continue;
      g.fillStyle = stone;
      g.beginPath();
      g.ellipse(x, y, r * 1.3, r, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
      // Every third stone has the sea breaking on it.
      if (k % 3 === 0) {
        const a = 0.25 + 0.2 * Math.sin(this.time * 1.7 + k * 1.3);
        g.strokeStyle = `rgba(226,234,238,${Math.max(0, a)})`;
        g.lineWidth = Math.max(1, 1.6 * this.zoom);
        g.beginPath();
        g.arc(x, y, r * (1.6 + 0.4 * Math.sin(this.time * 1.7 + k)), 0, Math.PI * 2);
        g.stroke();
      }
    }
  }

  /** The island's people and beasts (shared/src/world/islandlife.ts): hamlets with boats drawn up, camps with
   *  their fires, a garrisoned fort under its flag, seals, crabs and turtles on the beach, gulls wheeling over. */
  private drawLife(is: IslandData): void {
    if (this.zoom < 0.28) return;
    const sites = islandLife({ id: is.id, region: is.region, biome: is.biome, x: is.x, y: is.y, r: is.r, poly: is.poly, features: is.features, portId: is.portId });
    for (const s of sites) this.drawSite(is, s);
  }

  private drawSite(is: IslandData, s: LifeSite): void {
    const g = this.g;
    const z = this.zoom;
    const x = this.sx(s.x), y = this.sy(s.y);
    const reach = (s.kind === 'gulls' ? is.r : 90) * z;
    if (x < -reach || y < -reach || x > this.w + reach || y > this.h + reach) return;
    const vx = is.poly[s.v * 2] - is.x, vy = is.poly[s.v * 2 + 1] - is.y, vl = Math.hypot(vx, vy) || 1;
    const ox = vx / vl, oy = vy / vl; // seaward
    const tx = -oy, ty = ox; // along the shore
    const t = this.time;
    const night = this.nightNow;
    const rnd = seeded(is.id * 97 + s.v * 13 + s.kind.length);
    const along = Math.atan2(ty, tx);
    const facingSea = Math.atan2(ox, -oy); // turns a sprite drawn head-up to face the sea
    /** The painted sprite (docs/11 P5) at px size on its longest side; false when it has not loaded. Sprites come
     *  without shadows (docs/06 §5.2): a soft one is laid under what stands on the ground, away from the moon. */
    const art = (id: string, px: number, py: number, size: number, rot = 0, kx = 1, ky = 1, shadow = 0.38): boolean => {
      const sp = sprite(id);
      if (!sp) return false;
      const k = size / Math.max(sp.img.naturalWidth, sp.img.naturalHeight);
      const w = sp.img.naturalWidth * k, h = sp.img.naturalHeight * k;
      if (shadow > 0) {
        g.fillStyle = `rgba(0,0,0,${shadow})`;
        g.beginPath();
        g.ellipse(px + size * 0.07, py + size * 0.09, (w * sp.extentX * Math.abs(kx)) / 2, (h * sp.extentY * Math.abs(ky)) / 2, rot, 0, Math.PI * 2);
        g.fill();
      }
      g.save();
      g.translate(px, py);
      g.rotate(rot);
      g.scale(kx, ky);
      g.drawImage(sp.img, -w / 2, -h / 2, w, h);
      g.restore();
      return true;
    };
    const hut = (hx: number, hy: number, w: number, roof: string) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(hx - w / 2 + 2 * z, hy - w / 2 + 3 * z, w, w * 0.8);
      g.fillStyle = '#4b3a28';
      g.fillRect(hx - w / 2, hy - w / 2, w, w * 0.8);
      g.fillStyle = roof;
      g.beginPath();
      g.moveTo(hx - w * 0.62, hy - w * 0.1);
      g.lineTo(hx, hy - w * 0.72);
      g.lineTo(hx + w * 0.62, hy - w * 0.1);
      g.closePath();
      g.fill();
    };
    const fire = (fx: number, fy: number, wx: number, wy: number) => {
      const f = 0.75 + 0.25 * Math.sin(t * 9 + rnd() * 6);
      g.fillStyle = `rgba(255,${Math.round(150 + 60 * f)},80,0.95)`;
      g.beginPath();
      g.arc(fx, fy, 2.4 * z * f + 1, 0, Math.PI * 2);
      g.fill();
      if (night > 0.25) this.fx.light(wx, wy, 90, 'rgba(255,160,80,1)', 0.55 * night, 0.05);
      else if (Math.random() < 0.02) this.fx.smoke(wx, wy, 1, 6);
    };
    switch (s.kind) {
      case 'fishers':
      case 'smugglers':
      case 'pirate_camp': {
        const people = s.kind === 'fishers';
        const tentArt = people ? 'prop.life_hut' : s.kind === 'pirate_camp' ? 'prop.life_pirate_tent' : 'prop.life_tent';
        const gap = sprite(tentArt) ? 21 : 16;
        for (let i = 0; i < s.n; i++) {
          const k = i - (s.n - 1) / 2;
          const hx = x + tx * k * gap * z - ox * 4 * z * (i % 2), hy = y + ty * k * gap * z - oy * 4 * z * (i % 2);
          if (art(tentArt, hx, hy, (people ? 20 : 17) * z, facingSea + (((i * 37) % 7) - 3) * 0.09)) continue;
          if (people) hut(hx, hy, 11 * z, '#6d5237');
          else {
            // Tents: canvas triangles, the pirates' black.
            g.fillStyle = s.kind === 'pirate_camp' ? '#2a2422' : '#8c8068';
            g.beginPath();
            g.moveTo(hx - 7 * z, hy + 5 * z);
            g.lineTo(hx, hy - 7 * z);
            g.lineTo(hx + 7 * z, hy + 5 * z);
            g.closePath();
            g.fill();
          }
        }
        if (people) {
          // Boats drawn up on the beach, one out on the water.
          for (let i = 0; i < 2; i++) {
            const bob = i === 1 ? Math.sin(t * 1.3 + s.v) * 1.5 * z : 0;
            const bx = x + ox * (14 + i * 22) * z + tx * (i * 10 - 5) * z, by = y + oy * (14 + i * 22) * z + ty * (i * 10 - 5) * z + bob;
            if (art('prop.life_boat', bx, by, 15 * z, along + Math.PI / 2 + (i ? 0.25 : -0.15))) continue;
            g.save();
            g.translate(bx, by);
            g.rotate(Math.atan2(ty, tx));
            g.fillStyle = '#5a4128';
            g.beginPath();
            g.ellipse(0, 0, 6 * z, 2.2 * z, 0, 0, Math.PI * 2);
            g.fill();
            g.restore();
          }
          if (night > 0.25) this.fx.light(s.x, s.y, 90, 'rgba(255,190,110,1)', 0.55 * night, 0.05);
        } else {
          // Crates by the smugglers' fire; the pirates fly the black.
          if (s.kind === 'smugglers') {
            g.fillStyle = '#6b5032';
            if (!art('prop.life_crates', x + ox * 11 * z, y + oy * 11 * z, 13 * z, facingSea)) for (let i = 0; i < 3; i++) g.fillRect(x + (i * 5 - 7) * z + ox * 10 * z, y + oy * 10 * z + (i % 2) * 4 * z, 4 * z, 4 * z);
          } else {
            const fx = x - ox * 12 * z, fy = y - oy * 12 * z;
            g.strokeStyle = '#2a1e14';
            g.lineWidth = Math.max(1, 1.2 * z);
            g.beginPath();
            g.moveTo(fx, fy);
            g.lineTo(fx, fy - 18 * z);
            g.stroke();
            const flap = Math.sin(t * 4 + s.v) * 2 * z;
            g.fillStyle = '#0c0c0c';
            g.beginPath();
            g.moveTo(fx, fy - 18 * z);
            g.lineTo(fx + 10 * z, fy - 15 * z + flap);
            g.lineTo(fx, fy - 12 * z);
            g.closePath();
            g.fill();
          }
          fire(x + ox * 4 * z, y + oy * 4 * z, s.x, s.y);
        }
        break;
      }
      case 'garrison': {
        // A small star fort of grey stone under the region's colours (painted, or drawn when the art is missing).
        if (!art('prop.life_fort', x, y, 46 * z, facingSea)) {
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2, rr = (i % 2 ? 11 : 19) * z;
            const px = x + 3 * z + Math.cos(a) * rr, py = y + 4 * z + Math.sin(a) * rr;
            if (i) g.lineTo(px, py);
            else g.moveTo(px, py);
          }
          g.fill();
          g.fillStyle = '#6a6760';
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2, rr = (i % 2 ? 11 : 19) * z;
            const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
            if (i) g.lineTo(px, py);
            else g.moveTo(px, py);
          }
          g.closePath();
          g.fill();
          g.fillStyle = '#4c4a45';
          g.fillRect(x - 5 * z, y - 5 * z, 10 * z, 10 * z);
        }
        const flap = Math.sin(t * 4 + s.v) * 1.5 * z;
        g.strokeStyle = '#2a2622';
        g.lineWidth = Math.max(1, z);
        g.beginPath();
        g.moveTo(x, y - 5 * z);
        g.lineTo(x, y - 22 * z);
        g.stroke();
        g.fillStyle = REGIONS[is.region].safety === 'safe' ? '#a33a2e' : '#2e5a8a';
        g.beginPath();
        g.moveTo(x, y - 22 * z);
        g.lineTo(x + 11 * z, y - 19 * z + flap);
        g.lineTo(x, y - 16 * z);
        g.closePath();
        g.fill();
        if (night > 0.25) this.fx.light(s.x, s.y, 130, 'rgba(255,200,130,1)', 0.6 * night, 0.05);
        break;
      }
      case 'seals':
      case 'turtles':
      case 'crabs': {
        for (let i = 0; i < s.n; i++) {
          const k = i - (s.n - 1) / 2 + (rnd() - 0.5) * 0.6;
          let bx = x + tx * k * (s.kind === 'crabs' ? 7 : 11) * z + ox * (rnd() * 6) * z;
          let by = y + ty * k * (s.kind === 'crabs' ? 7 : 11) * z + oy * (rnd() * 6) * z;
          if (s.kind === 'crabs') {
            // Sideways, as crabs go.
            const w = Math.sin(t * (1.4 + i * 0.3) + i) * 5 * z;
            bx += tx * w;
            by += ty * w;
            if (art('creature.crab', bx, by, Math.max(5, 5.5 * z), facingSea + Math.sin(t * 3 + i) * 0.15)) continue;
            g.fillStyle = '#b8452f';
            g.beginPath();
            g.arc(bx, by, Math.max(1.2, 1.8 * z), 0, Math.PI * 2);
            g.fill();
          } else if (s.kind === 'seals') {
            const breathe = 1 + 0.06 * Math.sin(t * 1.1 + i * 2);
            const lie = along + (rnd() - 0.5);
            if (art('creature.seal', bx, by, 13 * z, lie + Math.PI / 2, 1, breathe)) continue;
            g.fillStyle = '#5d6168';
            g.beginPath();
            g.ellipse(bx, by, 5.5 * z * breathe, 2.4 * z, lie, 0, Math.PI * 2);
            g.fill();
          } else {
            const crawl = Math.sin(t * 0.3 + i * 2) * 3 * z;
            bx += ox * crawl;
            by += oy * crawl;
            // Head the way it crawls: to the sea while the wave of its walk rises, inland as it falls.
            if (art('creature.turtle', bx, by, Math.max(6, 9 * z), facingSea + (Math.cos(t * 0.3 + i * 2) < 0 ? Math.PI : 0))) continue;
            g.fillStyle = '#4f5a34';
            g.beginPath();
            g.ellipse(bx, by, 3.6 * z, 3 * z, 0, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#2f3620';
            g.lineWidth = Math.max(0.6, 0.6 * z);
            g.stroke();
          }
        }
        break;
      }
      case 'gulls': {
        const rr = is.r * 0.45 * z;
        g.strokeStyle = 'rgba(236,238,240,0.85)';
        g.lineWidth = Math.max(1, 1.1 * z);
        for (let i = 0; i < s.n; i++) {
          const a = t * (0.25 + (i % 3) * 0.05) + (i / s.n) * Math.PI * 2 + rnd() * 0.5;
          const gx = x + Math.cos(a) * rr * (0.7 + 0.3 * Math.sin(i)), gy = y + Math.sin(a) * rr * (0.7 + 0.3 * Math.cos(i));
          const flap = (2 + Math.sin(t * 8 + i * 1.7) * 1.6) * z;
          const span = 4 * z + 2;
          // Heading along its circle; the wings beat by narrowing the span.
          if (art('creature.gull', gx, gy, span * 2.4, Math.atan2(-Math.sin(a), -Math.cos(a)), 0.55 + 0.45 * Math.abs(Math.sin(t * 8 + i * 1.7)), 1, 0)) continue;
          g.beginPath();
          g.moveTo(gx - span, gy - flap);
          g.quadraticCurveTo(gx - span / 2, gy - flap * 0.2, gx, gy);
          g.quadraticCurveTo(gx + span / 2, gy - flap * 0.2, gx + span, gy - flap);
          g.stroke();
        }
        break;
      }
    }
  }

  /** A texture tiled in world space: `metres` per tile, shifted by `seed` so neighbours do not match. */
  private tiled(id: string, metres: number, seed = 0): CanvasPattern | null {
    const p = pattern(this.g, id);
    const s = sprite(id);
    if (!p || !s) return null;
    p.setTransform(new DOMMatrix().translate(this.sx(seed * 137), this.sy(seed * 91)).scale((this.zoom * metres) / s.img.naturalWidth));
    return p;
  }

  /** How dark the sea is this frame (0 day … 1 night), for what glows on the islands. */
  private nightNow = 0;

  private decorCache = new Map<number, Decor[]>();
  private propCache = new Map<number, { n: number; ids: string[] }>();

  /** A great island's landmark (no port, no lagoon, a bounding radius of 420 m or more): one of the sixteen that suit
   *  her kind, by her id; null while none is painted. */
  private landmarkOf(is: IslandData): { id: string; size: number; rot: number } | null {
    if (is.r < 420 || is.portId || is.biome === 'atoll' || is.isle === 'atoll') return null;
    const fit = LANDMARK_KINDS.map((kinds, i) => ({ i, ok: !kinds || kinds.includes(is.biome) })).filter((x) => x.ok && sprite(`prop.landmark_${x.i + 1}`));
    if (!fit.length) return null;
    const pick = fit[is.id % fit.length].i;
    return { id: `prop.landmark_${pick + 1}`, size: Math.min(240, is.r * 0.32), rot: ((is.id * 37) % 360) * (Math.PI / 180) };
  }

  /** The island's own few of her kind's sixteen things (tools/art/isles.py), chosen by her id: three to five of them. */
  private isleProps(is: IslandData): string[] {
    const all: string[] = [];
    for (let n = 1; n <= 16; n++) if (sprite(`prop.isle_${is.biome}_${n}`)) all.push(`prop.isle_${is.biome}_${n}`);
    const hit = this.propCache.get(is.id);
    if (hit && hit.n === all.length) return hit.ids;
    const rnd = seeded(is.id * 131 + 7);
    const ids = all.map((id) => ({ id, k: rnd() })).sort((a, b) => a.k - b.k).slice(0, 3 + (is.id % 3)).map((x) => x.id);
    this.propCache.set(is.id, { n: all.length, ids });
    return ids;
  }

  /** Where an island's decor stands: inside the coast, clear of its port town and of each other. */
  private decorOf(is: IslandData, state: ClientState): Decor[] {
    const hit = this.decorCache.get(is.id);
    if (hit) return hit;
    const rnd = seeded(is.id * 7919 + 17);
    const inner = is.poly.map((v, i) => (i % 2 === 0 ? is.x + (v - is.x) * 0.78 : is.y + (v - is.y) * 0.78));
    const port = is.portId ? state.ports.find((p) => p.id === is.portId) : null;
    // Decor by area: a rock has a clump or two, a great island is wooded and strewn.
    const dense = is.biome === 'jungle' || is.biome === 'mangrove' ? 1.6 : is.biome === 'saltflat' ? 0.4 : 1;
    const want = Math.max(3, Math.min(56, Math.round(((is.r * is.r) / 26000) * dense)));
    const lk = is.isle === 'atoll' ? 0.72 : 0.6; // an atoll of docs/18 #25 keeps a wider lagoon
    const lagoon = is.biome === 'atoll' || is.isle === 'atoll' ? is.poly.map((v, i) => (i % 2 === 0 ? is.x + (v - is.x) * lk : is.y + (v - is.y) * lk)) : null;
    const out: Decor[] = [];
    for (let k = 0; k < want * 6 && out.length < want; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * is.r;
      const x = is.x + Math.cos(a) * r, y = is.y + Math.sin(a) * r;
      if (!inPoly(inner, x, y)) continue;
      if (lagoon && inPoly(lagoon, x, y)) continue;
      if (port && Math.hypot(x - port.x, y - port.y) < 380) continue;
      const size = 42 + rnd() * Math.min(120, 30 + is.r / 10);
      if (out.some((d) => Math.hypot(d.x - x, d.y - y) < (d.size + size) * 0.55)) continue;
      // (`pick` from a hash, not the stream: the clumps keep the places they always had)
      const pick = Math.abs(Math.sin(is.id * 12.9898 + out.length * 78.233) * 43758.5453) % 1;
      out.push({ x, y, rot: rnd() * Math.PI * 2, size, grove: size > 95 && (is.biome === 'temperate' || is.biome === 'mossy' || is.biome === 'jungle'), odd: rnd() < 0.55, pick });
    }
    this.decorCache.set(is.id, out);
    if (this.decorCache.size > 200) this.decorCache.delete(this.decorCache.keys().next().value!);
    return out;
  }

  private reliefCache = new Map<number, { canvas: HTMLCanvasElement; x0: number; y0: number; size: number }>();
  private reliefBuiltAt = -1;

  /** The island's relief mask, built lazily (one per frame) and kept for the 60 most recently seen islands. */
  private reliefOf(is: IslandData): { canvas: HTMLCanvasElement; x0: number; y0: number; size: number } | null {
    const hit = this.reliefCache.get(is.id);
    if (hit) {
      this.reliefCache.delete(is.id);
      this.reliefCache.set(is.id, hit);
      return hit;
    }
    if (this.reliefBuiltAt === this.frameNo) return null;
    this.reliefBuiltAt = this.frameNo;
    const b = is.biome;
    const palette: Palette = b === 'ice' || b === 'crystal' ? 'ice' : b === 'volcanic' || b === 'blacksand' ? 'dark' : b === 'bone' || b === 'barren' || b === 'atoll' || b === 'saltflat' ? 'pale' : 'green';
    const rocky = b === 'volcanic' || b === 'ruins' || b === 'crystal' ? 1 : b === 'mossy' || b === 'mangrove' || b === 'atoll' || b === 'saltflat' ? 0 : b === 'fungal' || b === 'jungle' ? 0.25 : 0.5;
    const r = buildRelief(is.poly, is.x, is.y, 0x51ed + is.id * 977, palette, rocky);
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d')!.putImageData(new ImageData(r.rgba as unknown as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0);
    const entry = { canvas: c, x0: r.x0, y0: r.y0, size: r.w * r.res };
    this.reliefCache.set(is.id, entry);
    while (this.reliefCache.size > 60) this.reliefCache.delete(this.reliefCache.keys().next().value!);
    return entry;
  }

  /** What a living-island biome lays on its land: the atoll's lagoon, the salt pan's cracks, the mangrove's roots
   *  walking out into the water. */
  private drawBiomeLand(is: IslandData): void {
    const g = this.g;
    if (is.biome === 'atoll') {
      this.path(is.poly, 0.6, is.x, is.y);
      // The lagoon is a shallow of the dark sea (docs/06 §6.1: grey-green, never azure — turquoise is the deep's own
      // light), a shade lighter toward its rim, with a thin moonlit edge of foam.
      const grd = g.createRadialGradient(this.sx(is.x), this.sy(is.y), 0, this.sx(is.x), this.sy(is.y), is.r * 0.6 * this.zoom);
      grd.addColorStop(0, 'rgba(18,28,30,0.95)');
      grd.addColorStop(0.8, 'rgba(30,43,44,0.93)');
      grd.addColorStop(1, 'rgba(52,64,60,0.88)');
      g.fillStyle = grd;
      g.fill();
      g.strokeStyle = 'rgba(127,144,156,0.3)';
      g.lineWidth = Math.max(1, 3 * this.zoom);
      g.stroke();
    } else if (is.biome === 'saltflat' && this.zoom > 0.25) {
      const rnd = seeded(is.id * 131 + 5);
      g.save();
      this.path(is.poly, 0.85, is.x, is.y);
      g.clip();
      g.strokeStyle = 'rgba(120,112,96,0.35)';
      g.lineWidth = Math.max(0.6, 1.2 * this.zoom);
      for (let k = 0; k < 14; k++) {
        let x = is.x + (rnd() - 0.5) * is.r * 1.4, y = is.y + (rnd() - 0.5) * is.r * 1.4;
        g.beginPath();
        g.moveTo(this.sx(x), this.sy(y));
        for (let s = 0; s < 4; s++) {
          x += (rnd() - 0.5) * is.r * 0.3;
          y += (rnd() - 0.5) * is.r * 0.3;
          g.lineTo(this.sx(x), this.sy(y));
        }
        g.stroke();
      }
      g.restore();
    } else if (is.biome === 'mangrove' && this.zoom > 0.35) {
      g.strokeStyle = 'rgba(36,30,22,0.7)';
      g.lineWidth = Math.max(0.8, 1.6 * this.zoom);
      const n = is.poly.length / 2;
      for (let i = 0; i < n; i += 1) {
        const px = is.poly[i * 2], py = is.poly[i * 2 + 1];
        const dx = px - is.x, dy = py - is.y, l = Math.hypot(dx, dy) || 1;
        for (let k = -1; k <= 1; k++) {
          const ox = (-dy / l) * k * 10, oy = (dx / l) * k * 10;
          g.beginPath();
          g.moveTo(this.sx(px + ox - (dx / l) * 6), this.sy(py + oy - (dy / l) * 6));
          g.quadraticCurveTo(this.sx(px + ox + (dx / l) * 10 + oy * 0.3), this.sy(py + oy + (dy / l) * 10 - ox * 0.3), this.sx(px + ox + (dx / l) * 18), this.sy(py + oy + (dy / l) * 18));
          g.stroke();
        }
      }
    }
  }

  private featurePoint(is: IslandData, salt: number, inset: number): { x: number; y: number } {
    const n = is.poly.length / 2;
    const i = ((is.id * 7 + salt * 13) % n) * 2;
    const px = is.poly[i], py = is.poly[i + 1];
    return { x: px + (is.x - px) * inset, y: py + (is.y - py) * inset };
  }

  private drawFeatures(is: IslandData): void {
    const g = this.g;
    for (const f of is.features) {
      const art = FEATURE_ART[f];
      if (!art) continue;
      const p = this.featurePoint(is, art.salt, art.inset);
      const spr = sprite(art.id);
      const size = art.size * this.zoom;
      const x = this.sx(p.x), y = this.sy(p.y);
      if (x < -size || y < -size || x > this.w + size || y > this.h + size) continue;
      // A live volcano breathes: a slow column of dark smoke drifts off its crater.
      if (f === 'volcano' && Math.random() < 0.08) this.fx.smoke(p.x + (Math.random() - 0.5) * 8, p.y + (Math.random() - 0.5) * 8, 1, 14, true);
      if (spr) {
        g.save();
        g.translate(x, y);
        // Everything but the lighthouse turns a little, so no two islands look stamped.
        if (f !== 'lighthouse') g.rotate(((is.id * 37 + art.salt * 11) % 628) / 100);
        if (f === 'wreck' || f === 'pearl_bank') g.globalAlpha = 0.9;
        g.drawImage(spr.img, -size / 2, -size / 2, size, size);
        g.restore();
      } else if (f === 'lighthouse') {
        g.fillStyle = '#5c5a55';
        g.beginPath();
        g.arc(x, y, 6 * this.zoom, 0, Math.PI * 2);
        g.fill();
      } else if (f === 'ruins' || f === 'shrine') {
        g.save();
        g.translate(x, y);
        g.strokeStyle = 'rgba(160,160,150,0.45)';
        g.lineWidth = Math.max(1, 1.5 * this.zoom);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + is.id;
          g.strokeRect(Math.sin(a) * 12 * this.zoom - 3 * this.zoom, -Math.cos(a) * 12 * this.zoom - 3 * this.zoom, 6 * this.zoom, 6 * this.zoom);
        }
        g.restore();
      }
    }
  }

  /** Where each port town stands: on the land behind its anchorage, its quays at the shore (computed once). */
  private portLayout = new Map<string, { x: number; y: number; ang: number; size: number; reach: number } | null>();

  private layoutPort(p: ClientState['ports'][number], island: { x: number; y: number; r: number; poly: number[] }): { x: number; y: number; ang: number; size: number; reach: number } {
    const dx = island.x - p.x, dy = island.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // The ray from the anchorage to the island's heart: where it makes landfall and where it leaves the land again.
    const hits: number[] = [];
    const poly = island.poly;
    for (let i = 0; i < poly.length; i += 2) {
      const ax = poly[i], ay = poly[i + 1], bx = poly[(i + 2) % poly.length], by = poly[(i + 3) % poly.length];
      const ex = bx - ax, ey = by - ay;
      const den = ux * ey - uy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - p.x) * ey - (ay - p.y) * ex) / den;
      const u = ((ax - p.x) * uy - (ay - p.y) * ux) / den;
      if (t > 0 && u >= 0 && u <= 1) hits.push(t);
    }
    hits.sort((m, n) => m - n);
    // An anchorage already on the land (a river mouth, a lagoon) starts the town where it lies.
    const ashore = inPoly(poly, p.x, p.y);
    const tIn = ashore ? 0 : hits[0] ?? d * 0.6;
    const tOut = (ashore ? hits[0] : hits[1]) ?? d + island.r * 0.5;
    // The town's body fills the upper three quarters of the painting, the quays the foot: the body must fit the land.
    // A bay or a spit can end the first stretch of land early; the heart of the island is land all the same.
    const depth = Math.max(80, tOut - tIn, d - tIn + island.r * 0.25);
    const size = Math.max(140, Math.min(230 + p.size * 80, (depth * 0.8) / 0.64));
    const shoreX = p.x + ux * tIn, shoreY = p.y + uy * tIn;
    // Local +y turns to the sea, so the quays at the painting's foot reach into the water.
    return { x: shoreX + ux * size * 0.24, y: shoreY + uy * size * 0.24, ang: Math.atan2(-dx, dy) + Math.PI, size, reach: tIn };
  }

  private drawPorts(state: ClientState): void {
    const g = this.g;
    for (const p of state.ports) {
      if (Math.abs(p.x - this.camX) * this.zoom > this.w + 600 * this.zoom || Math.abs(p.y - this.camY) * this.zoom > this.h + 600 * this.zoom) continue;
      const art = p.raft ? null : townArt(p);
      const spr = art ? sprite(art) : undefined;
      const island = [...state.islands.values()].find((is) => is.portId === p.id);
      if (!island) continue;
      let lay = this.portLayout.get(p.id);
      if (!lay) this.portLayout.set(p.id, (lay = this.layoutPort(p, island)));
      const size = lay.size * this.zoom;
      const path = () => {
        g.beginPath();
        for (let i = 0; i < island.poly.length; i += 2) {
          if (i === 0) g.moveTo(this.sx(island.poly[i]), this.sy(island.poly[i + 1]));
          else g.lineTo(this.sx(island.poly[i]), this.sy(island.poly[i + 1]));
        }
        g.closePath();
      };
      const town = () => {
        g.translate(this.sx(lay.x), this.sy(lay.y));
        g.rotate(lay.ang);
        if (spr) g.drawImage(spr.img, -size / 2, -size / 2, size, size);
        else {
          g.fillStyle = '#26272a';
          g.fillRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.64);
        }
      };
      // The town's streets and walls stand only on the land — no ship sails through a house. (A floating town is its
      // hulks, drawn with the island.)
      if (!p.raft) {
        g.save();
        path();
        g.clip();
        town();
        g.restore();
      }
      // The quays: the painting's foot at its own proportions (never stretched), out from the shore over the water.
      // The anchorage lies off the pier heads, where ships in port ride broadside to the quay (berth()).
      g.save();
      g.translate(this.sx(lay.x), this.sy(lay.y));
      g.rotate(lay.ang);
      if (spr) {
        const iw = spr.img.naturalWidth || spr.img.width, ih = spr.img.naturalHeight || spr.img.height;
        g.drawImage(spr.img, 0, ih * 0.735, iw, ih * 0.265, -size / 2, size * 0.235, size, size * 0.265);
      }
      g.restore();
      // Name & flag.
      g.font = `${Math.round(clamp(14 * this.zoom, 12, 22))}px "IM Fell English SC", Georgia, serif`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.6)';
      const name = placeName(p.name);
      g.fillText(name, this.sx(p.x) + 1, this.sy(p.y) - 40 * this.zoom + 1);
      g.fillStyle = FACTIONS[p.faction].lantern;
      g.fillText(name, this.sx(p.x), this.sy(p.y) - 40 * this.zoom);
      // The harbour's reach: a faint ring of calmer water, no dashes.
      g.strokeStyle = 'rgba(176,141,87,0.14)';
      g.lineWidth = Math.max(1, 2 * this.zoom);
      g.beginPath();
      g.arc(this.sx(p.x), this.sy(p.y), 420 * this.zoom, 0, Math.PI * 2);
      g.stroke();
    }
  }

  /** Ships in port ride at the anchorage off the pier heads, broadside to the quay and side by side: never on a jetty,
   *  never on each other. */
  private berth(ships: DrawShip[], state: ClientState): void {
    const byPort = new Map<string, DrawShip[]>();
    for (const s of ships) {
      if (!(s.flags & SF.DOCKED)) continue;
      const p = state.ports.find((q) => Math.hypot(q.x - s.x, q.y - s.y) < 250);
      if (!p || !this.portLayout.has(p.id)) continue;
      let list = byPort.get(p.id);
      if (!list) byPort.set(p.id, (list = []));
      list.push(s);
    }
    for (const [id, list] of byPort) {
      const lay = this.portLayout.get(id)!;
      const p = state.ports.find((q) => q.id === id)!;
      list.sort((a, b) => Number(b.own) - Number(a.own) || a.id - b.id);
      const ax = Math.cos(lay.ang), ay = Math.sin(lay.ang); // along the quay
      const sx = -Math.sin(lay.ang), sy = Math.cos(lay.ang); // out to sea
      list.forEach((s, i) => {
        const row = Math.floor(i / 5), col = [0, 1, -1, 2, -2][i % 5];
        const along = col * (Math.max(SHIP_CLASSES[s.classId].length, 30) + 14);
        s.x = p.x + ax * along + sx * row * 34;
        s.y = p.y + ay * along + sy * row * 34;
        s.h = lay.ang + Math.PI / 2;
      });
    }
  }

  /** The Floating Bazaar's shadows (docs/12 P10 #19): a ghost of each stall's ship at its port's anchorage, a row
   *  further out than the ships in port, with its signboard. */
  private stallShadows(state: ClientState): { ship: DrawShip; name: string }[] {
    const out: { ship: DrawShip; name: string }[] = [];
    const byPort = new Map<string, typeof state.bazaarShadows>();
    for (const sh of state.bazaarShadows) {
      let list = byPort.get(sh.port);
      if (!list) byPort.set(sh.port, (list = []));
      list.push(sh);
    }
    for (const [id, list] of byPort) {
      const lay = this.portLayout.get(id);
      const p = state.ports.find((q) => q.id === id);
      if (!lay || !p) continue;
      const ax = Math.cos(lay.ang), ay = Math.sin(lay.ang), sx = -Math.sin(lay.ang), sy = Math.cos(lay.ang);
      const art = townArt(p);
      const slips = (art && art !== 'prop.port_town' ? assetMeta(art)?.slips : null) ?? [];
      let free = 0;
      list.forEach((sh, i) => {
        const cls = SHIP_CLASSES[sh.classId];
        // Moored in a slip between the piers, bow to the quay, where no ship sails: when she fits one.
        const slip = slips[i];
        if (slip && cls.length <= slip[3] * lay.size * 0.95 && cls.beam <= slip[1] * lay.size * 0.7) {
          const lx = (slip[0] - 0.5) * lay.size, ly = (slip[2] + slip[3] / 2 - 0.5) * lay.size;
          out.push({
            name: sh.name,
            ship: { id: -1_000_000 - sh.owner, x: lay.x + ax * lx + sx * ly, y: lay.y + ay * lx + sy * ly, h: lay.ang, spd: 0, sail: 0, hull: 1, sails: 1, flags: SF.HIDDEN, classId: sh.classId, info: null, own: false, sinkT: 0 },
          });
          return;
        }
        // Else two rows out from the anchorage: clear of the ships in port and of one riding there after leaving.
        const k = free++;
        const row = 2 + Math.floor(k / 5), col = [0, 1, -1, 2, -2][k % 5];
        const along = col * (Math.max(cls.length, 30) + 14);
        out.push({
          name: sh.name,
          ship: { id: -1_000_000 - sh.owner, x: p.x + ax * along + sx * row * 38, y: p.y + ay * along + sy * row * 38, h: lay.ang + Math.PI / 2, spd: 0, sail: 0, hull: 1, sails: 1, flags: SF.HIDDEN, classId: sh.classId, info: null, own: false, sinkT: 0 },
        });
      });
    }
    return out;
  }

  /** A stall's signboard over its shadow: dark wood, a brass rim, the keeper's name. */
  private drawStallSigns(stalls: { ship: DrawShip; name: string }[]): void {
    if (!stalls.length) return;
    const g = this.g;
    const sign = lang() === 'ru' ? 'Лавка' : 'Stall';
    g.save();
    g.font = '600 11px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const { ship, name } of stalls) {
      const x = this.sx(ship.x), y = this.sy(ship.y) - SHIP_CLASSES[ship.classId].beam * this.zoom - 16;
      if (x < -80 || y < -40 || x > this.w + 80 || y > this.h + 40) continue;
      const text = `${sign} · ${personName(name)}`;
      const w = g.measureText(text).width + 16, h = 18;
      g.fillStyle = 'rgba(38,26,16,0.92)';
      roundRect(g, x - w / 2, y - h / 2, w, h, 3);
      g.fill();
      g.strokeStyle = '#a88440';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#f0d9b0';
      g.fillText(text, x, y + 0.5);
    }
    g.restore();
  }

  // ------------------------------------------------------------------ ships

  private toDraw(s: RemoteShip): DrawShip {
    const c = s.cur;
    const classId = s.info?.classId ?? 'sloop';
    let sinkT = 0;
    if (c.flags & SF.SINKING) {
      if (!this.sinkStarts.has(s.id)) this.sinkStarts.set(s.id, this.time);
      sinkT = this.time - (this.sinkStarts.get(s.id) ?? this.time);
    }
    return { id: s.id, x: c.x, y: c.y, h: c.h, spd: c.spd, sail: c.sail, hull: c.hull, sails: c.sails, flags: c.flags, classId, info: s.info, own: false, sinkT };
  }

  private updateWake(s: DrawShip, dt: number): void {
    let w = this.wakes.get(s.id);
    if (!w) this.wakes.set(s.id, (w = []));
    const last = w[w.length - 1];
    const cls = SHIP_CLASSES[s.classId];
    if (s.spd > 0.8 && (!last || Math.hypot(last.x - s.x, last.y - s.y) > 4)) {
      const back = headingVec(s.h + Math.PI);
      w.push({ x: s.x + back.x * cls.length * 0.45, y: s.y + back.y * cls.length * 0.45, t: this.time, w: cls.beam * (0.6 + s.spd / 20) });
    }
    while (w.length && this.time - w[0].t > 7) w.shift();
    void dt;
  }

  private drawWakes(): void {
    // Over the shader sea the wake is churned water in the shader itself: no lines on top of it.
    if (this.sea) {
      for (const [id, w] of this.wakes) if (!w.length) this.wakes.delete(id);
      return;
    }
    const soft = 1;
    const g = this.g;
    g.save();
    g.lineCap = 'round';
    for (const [id, w] of this.wakes) {
      if (w.length < 2) {
        if (!w.length) this.wakes.delete(id);
        continue;
      }
      for (let i = 1; i < w.length; i++) {
        const a = w[i - 1], b = w[i];
        const age = this.time - b.t;
        const alpha = clamp(0.16 * (1 - age / 7), 0, 0.16);
        const spread = b.w * (1 + age * 0.35);
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        g.strokeStyle = `rgba(200,212,220,${alpha * soft})`;
        g.lineWidth = Math.max(1, 1.6 * this.zoom * (1 - age / 8));
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(this.sx(a.x + nx * spread * side * 0.5 * (1 - 0.1)), this.sy(a.y + ny * spread * side * 0.5 * (1 - 0.1)));
          g.lineTo(this.sx(b.x + nx * spread * side * 0.5), this.sy(b.y + ny * spread * side * 0.5));
          g.stroke();
        }
        g.strokeStyle = `rgba(160,180,190,${alpha * 0.5})`;
        g.lineWidth = Math.max(1, b.w * 0.5 * this.zoom * (1 - age / 8));
        g.beginPath();
        g.moveTo(this.sx(a.x), this.sy(a.y));
        g.lineTo(this.sx(b.x), this.sy(b.y));
        g.stroke();
      }
    }
    g.restore();
  }

  /** Floating loot (art, 2026-09-30): the painted flotsam — the bigger wreckage for a rich haul — riding the swell on
   *  its own soft shadow, with a small plate of what it is worth. */
  private drawLoot(state: ClientState): void {
    const g = this.g;
    for (const l of state.loot.values()) {
      const rich = l.value >= 400;
      const spr = sprite(rich ? 'prop.wreckage' : 'prop.flotsam') ?? sprite('prop.flotsam') ?? sprite('prop.wreckage');
      const size = Math.max(26, (rich ? 46 : 36) * this.zoom);
      const x = this.sx(l.x), y = this.sy(l.y);
      if (x < -size || y < -size || x > this.w + size || y > this.h + size) continue;
      const bob = settings().reduceMotion ? 0 : Math.sin(this.time * 1.5 + l.x) * 0.08;
      g.save();
      g.translate(x, y);
      // The water darkens a little under it.
      const sh = g.createRadialGradient(size * 0.06, size * 0.08, 0, size * 0.06, size * 0.08, size * 0.62);
      sh.addColorStop(0, 'rgba(0,0,0,0.32)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.beginPath();
      g.arc(size * 0.06, size * 0.08, size * 0.62, 0, Math.PI * 2);
      g.fill();
      g.rotate(bob + ((l.x * 0.37) % (Math.PI * 2)));
      if (spr) {
        const k = size / Math.max(spr.img.naturalWidth, spr.img.naturalHeight);
        g.drawImage(spr.img, (-spr.img.naturalWidth * k) / 2, (-spr.img.naturalHeight * k) / 2, spr.img.naturalWidth * k, spr.img.naturalHeight * k);
      } else {
        g.fillStyle = '#6b5436';
        for (let k = 0; k < 5; k++) g.fillRect(Math.sin(k * 2.1) * size * 0.3, Math.cos(k * 1.7) * size * 0.3, size * 0.18, size * 0.12);
      }
      g.restore();
      if (l.value > 0 && this.zoom > 0.35) {
        const label = L('salvage', { n: Math.round(l.value).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB') });
        g.font = '600 11px Inter, sans-serif';
        const tw = g.measureText(label).width;
        const ly = y + size * 0.5 + 11;
        g.fillStyle = 'rgba(5,10,14,0.6)';
        g.beginPath();
        g.roundRect(x - tw / 2 - 5, ly - 9, tw + 10, 16, 4);
        g.fill();
        g.fillStyle = 'rgba(232,200,120,0.95)';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(label, x, ly);
        g.textBaseline = 'alphabetic';
      }
    }
  }

  private drawShip(s: DrawShip, state: ClientState): void {
    const g = this.g;
    const cls = SHIP_CLASSES[s.classId];
    const len = cls.length * this.zoom, beam = cls.beam * this.zoom;
    const x = this.sx(s.x), y = this.sy(s.y);
    if (x < -len * 2 || y < -len * 2 || x > this.w + len * 2 || y > this.h + len * 2) return;
    if (!s.own && drawGuardShip(g, state, s, len, this.advCtx())) return; // a guard of the adventure map (docs/17 H4)
    if (cls.monster) {
      drawMonster(g, { id: s.id, x, y, h: s.h, classId: s.classId, flags: s.flags, hull: s.hull, sinkT: s.sinkT, art: bossArt(s.id, state) }, this.zoom, this.time);
      if (s.classId === 'lantern_maw' && !(s.flags & SF.SUBMERGED)) {
        const v = headingVec(s.h);
        this.fx.light(s.x + v.x * cls.length * 0.62, s.y + v.y * cls.length * 0.62, 160, 'rgba(255,225,150,1)', 0.9, 0.05);
      }
      // Every horror of the deep glows a little: pale eyes, rot-light, the sheen of wet hide.
      if (!(s.flags & SF.SUBMERGED) && s.classId !== 'kraken_tentacle' && s.classId !== 'hulk' && !beastOfClass(s.classId)) this.fx.light(s.x, s.y, cls.length * 0.6, s.classId === 'black_serpent' ? 'rgba(201,224,74,1)' : 'rgba(150,190,200,1)', 0.2, 0.05);
      if (s.classId === 'wreck_core' || s.classId === 'whale_heart') this.fx.light(s.x, s.y, 60, s.classId === 'wreck_core' ? 'rgba(46,230,200,1)' : 'rgba(200,40,50,1)', 0.6, 0.05);
      return;
    }
    // Inside the Lantern Maw: only her own captain sees her, a shadow in its gut.
    if ((s.flags & SF.SWALLOWED) && !s.own) return;
    const hidden = (s.flags & SF.HIDDEN) !== 0 || (s.flags & SF.SWALLOWED) !== 0;
    const sinking = s.sinkT > 0 || (s.flags & SF.SINKING) !== 0;
    const sinkF = sinking ? clamp(s.sinkT / 6, 0, 1) : 0;
    // Heel: she leans to leeward with the wind on her beam and her canvas set; water in the hold adds a list.
    const heel = shipHeel(s.h, state.wind[0], state.wind[1], s.sail, cls.tier, s.own ? state.you?.water ?? 0 : 0, settings().reduceMotion ? 0 : Math.sin(this.time * 0.9 + s.id));
    g.save();
    g.translate(x, y);
    // Engine shadow: offset toward the moon-lit side (south-east), softened; a heeled hull throws it wider to leeward.
    g.save();
    g.rotate(s.h);
    g.fillStyle = `rgba(0,0,0,${0.35 * (1 - sinkF)})`;
    g.beginPath();
    g.ellipse(beam * (0.35 + heel * 0.5), beam * 0.45, beam * (0.62 + Math.abs(heel) * 0.35), len * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.rotate(s.h + (sinking ? sinkF * 0.35 : 0));
    const scale = 1 - sinkF * 0.25;
    g.scale(scale, scale);
    // Seen from above, a heeled ship shows less deck and her masts lean out to leeward.
    if (heel) {
      g.translate(heel * beam * 0.18, 0);
      g.transform(1 - Math.abs(heel) * 0.14, 0, heel * 0.06, 1, 0, 0);
    }
    g.globalAlpha = (hidden ? 0.45 : 1) * (1 - sinkF * 0.85);
    const stage = curseStageFromFlags(s.flags);
    const art = bossArt(s.id, state) ?? cls.sprite;
    const hullImg = this.shipImage(cls.id, stage, art);
    // Scale so the drawn subject matches hull length.
    const imgH = len / hullImg.extentY;
    const imgW = imgH * (hullImg.canvas.width / hullImg.canvas.height);
    // From the atlas, in the colours she flies; the full image when she is drawn larger than her cell.
    const a = this.atlas.get(`${art}|${stage}|${hullImg.canvas.width}x${hullImg.canvas.height}`, () => hullImg.canvas, this.sailKey(s), this.lookPaint(s, state));
    if (Math.max(imgW, imgH) * this.dpr > CELL) g.drawImage(a.full, -imgW * hullImg.cx, -imgH * hullImg.cy, imgW, imgH);
    else g.drawImage(a.page, a.sx, a.sy, a.sw, a.sh, -imgW * hullImg.cx, -imgH * hullImg.cy, imgW, imgH);
    this.drawPennant(s, len, beam, state);
    // Sail damage tint (torn canvas reads as darker patches).
    if (s.sails < 0.6) {
      g.fillStyle = `rgba(10,10,10,${(0.6 - s.sails) * 0.5})`;
      g.fillRect(-beam * 0.9, -len * 0.3, beam * 1.8, len * 0.5);
    }
    g.restore();

    // Damage smoke and fire.
    if (s.hull < 0.5 && Math.random() < (0.5 - s.hull) * 0.5) this.fx.smoke(s.x + (Math.random() - 0.5) * cls.beam, s.y + (Math.random() - 0.5) * cls.length * 0.6, 1, 5, true);
    if ((s.flags & SF.FIRE) && Math.random() < 0.6) {
      this.fx.add({ kind: 'fire', x: s.x + (Math.random() - 0.5) * cls.beam, y: s.y + (Math.random() - 0.5) * cls.length * 0.5, vy: -2, life: 0.6, size: 3, grow: 4, color: '#ff8a3c' });
      this.fx.light(s.x, s.y, 60, 'rgba(255,140,60,1)', 0.5, 0.1);
    }
    if (s.flags & SF.BOARDING) {
      // Grapple lines to the ship we're locked with.
      for (const o of state.ships.values()) {
        if (o.id === s.id || !(o.cur.flags & SF.BOARDING)) continue;
        if (Math.hypot(o.cur.x - s.x, o.cur.y - s.y) > 60) continue;
        g.strokeStyle = 'rgba(180,160,120,0.7)';
        g.lineWidth = 1;
        for (let k = -1; k <= 1; k++) {
          g.beginPath();
          g.moveTo(x + k * 4, y + k * 4);
          g.lineTo(this.sx(o.cur.x) - k * 4, this.sy(o.cur.y) - k * 4);
          g.stroke();
        }
      }
    }
  }

  /**
   * Ship image with curse growth baked in, clipped to the hull silhouette ('source-atop').
   * Cached per class and stage; procedural hull and growth when sprites are unavailable.
   */
  private shipImage(id: ShipClassId, stage: number, art = SHIP_CLASSES[id].sprite): { canvas: HTMLCanvasElement; extentY: number; cx: number; cy: number } {
    const spr = sprite(art);
    const key = `${id}|${art}|${stage}|${spr ? 1 : 0}|${sprite('fx.curse_growth') ? 1 : 0}`;
    const hit = this.shipCache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    const cls = SHIP_CLASSES[id];
    let entry: { canvas: HTMLCanvasElement; extentY: number; cx: number; cy: number };
    if (spr) {
      c.width = spr.img.naturalWidth;
      c.height = spr.img.naturalHeight;
      c.getContext('2d')!.drawImage(spr.img, 0, 0);
      entry = { canvas: c, extentY: spr.extentY, cx: spr.cx, cy: spr.cy };
    } else {
      // Procedural hull at 6 px per meter.
      const k = 6;
      c.width = Math.ceil(cls.beam * k * 2.4);
      c.height = Math.ceil(cls.length * k * 1.1);
      const pg = c.getContext('2d')!;
      pg.translate(c.width / 2, c.height / 2);
      const prev = this.g;
      (this as unknown as { g: CanvasRenderingContext2D }).g = pg;
      this.proceduralShip(id, cls.length * k, cls.beam * k, 0.8, 1);
      (this as unknown as { g: CanvasRenderingContext2D }).g = prev;
      entry = { canvas: c, extentY: 1 / 1.1, cx: 0.5, cy: 0.5 };
    }
    if (stage > 0) {
      const cg = c.getContext('2d')!;
      cg.globalCompositeOperation = 'source-atop';
      const growth = sprite('fx.curse_growth');
      const veins = sprite('fx.curse_veins');
      if (growth) {
        cg.globalAlpha = [0, 0.35, 0.65, 0.85][stage];
        cg.drawImage(growth.img, 0, 0, c.width, c.height);
      } else {
        // Barnacle crust: pale speckles, denser with each stage.
        let seed = id.length * 97 + stage;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        cg.fillStyle = 'rgba(190,185,168,0.55)';
        for (let i = 0; i < 120 * stage; i++) {
          cg.beginPath();
          cg.arc(rnd() * c.width, rnd() * c.height, 1 + rnd() * 3, 0, Math.PI * 2);
          cg.fill();
        }
      }
      if (stage >= 3) {
        if (veins) {
          cg.globalAlpha = 0.8;
          cg.drawImage(veins.img, 0, 0, c.width, c.height);
        } else {
          cg.strokeStyle = 'rgba(46,230,200,0.55)';
          cg.lineWidth = 1.5;
          for (let i = 0; i < 8; i++) {
            cg.beginPath();
            cg.moveTo(c.width * (0.3 + 0.05 * i), c.height * 0.1);
            cg.bezierCurveTo(c.width * 0.2, c.height * 0.4, c.width * 0.8, c.height * 0.6, c.width * (0.35 + 0.04 * i), c.height * 0.9);
            cg.stroke();
          }
        }
      }
      cg.globalAlpha = 1;
      cg.globalCompositeOperation = 'source-over';
    }
    this.shipCache.set(key, entry);
    return entry;
  }

  /** A captain's look (docs/12 P10 #12): the paint and pattern the atlas gives her ship. */
  private lookPaint(s: DrawShip, state: ClientState): { hull: [number, number, number] | null; sail: number; c1: [number, number, number]; c2: [number, number, number] } | undefined {
    const l = decodeLook(s.own ? state.self?.look : s.info?.look);
    if (!l || (l.hull === 0 && l.sail === 0)) return undefined;
    const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const hull = HULLS[l.hull].hex;
    return { hull: hull ? rgb(hull) : null, sail: l.sail, c1: rgb(LOOK_COLORS[l.c1].hex), c2: rgb(LOOK_COLORS[l.c2].hex) };
  }

  /** Sail colours: navies and factions dye theirs; a captain under the Black Flag tars them. */
  private sailKey(s: DrawShip): SailKey {
    if (s.classId === 'ghost_ship') return 'none';
    if (s.own || s.info?.isPlayer) return s.flags & SF.BLACK_FLAG ? 'black' : 'none';
    const f = s.info?.faction;
    return f && f !== 'player' ? f : 'none';
  }

  /** Faction pennant at the masthead, streaming downwind. Players fly black. */
  private pennants = new Map<string, HTMLCanvasElement>();
  /** The painted pennant dyed a colour (cached per colour): the cloth takes the hue, the gold stripe and the shading stay. */
  private pennantArt(color: string): HTMLCanvasElement | null {
    const spr = sprite('part.pennant');
    if (!spr) return null;
    let c = this.pennants.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = spr.img.naturalWidth || 512;
    c.height = spr.img.naturalHeight || 216;
    const x = c.getContext('2d')!;
    x.drawImage(spr.img, 0, 0);
    x.globalCompositeOperation = 'color';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(spr.img, 0, 0);
    this.pennants.set(color, c);
    return c;
  }

  private drawPennant(s: DrawShip, len: number, beam: number, state: ClientState): void {
    const g = this.g;
    // A captain's colours (docs/24 D1): the pirate flag black, neutral colours white, the Green Pennant green, her city's
    // in its colours (or her own flag, docs/12 P10 #12, over them; a season's pennant before them).
    const player = s.own || s.info?.isPlayer;
    const season = s.own ? state.self?.pennant : s.info?.pennant;
    // Her own flag (docs/12 P10 #12), unless she flies the Black Flag or the Green Pennant.
    const lookKey = s.own ? state.self?.look : s.info?.look;
    const look = player && !(s.flags & (SF.BLACK_FLAG | SF.NEUTRAL | SF.GREEN_PENNANT)) ? decodeLook(lookKey) : null;
    if (look && lookKey && (look.field || look.emblem || look.c1 || look.c2 !== 1 || look.c3 !== 2)) {
      const flow = state.wind[0] - s.h - Math.PI / 2;
      const w = beam * 0.62, h = w * 0.66; // a small flag at the masthead, not a sail
      g.save();
      g.translate(0, -len * 0.18);
      g.rotate(flow + Math.sin(this.time * 3 + s.id) * 0.06);
      const flag = flagCanvas(look.emblem);
      g.globalAlpha = 0.35;
      g.drawImage(flag, 1, 1 - h / 2, w, h); // its shadow on the deck and the sea
      g.globalAlpha = 1;
      g.drawImage(flag, 0, -h / 2, w, h);
      g.restore();
      return;
    }
    const city = s.own ? (state.self?.pvp.flag === 'faction' ? state.self.pvp.city : null) : s.info?.city;
    const color = player ? (s.flags & SF.BLACK_FLAG ? '#0b0b0b' : s.flags & SF.NEUTRAL ? '#e6e0d0' : s.flags & SF.GREEN_PENNANT ? '#3f7d4a' : season ?? (city ? FACTIONS[city].flag : '#3b4652')) : s.info && s.info.faction !== 'player' ? FACTIONS[s.info.faction].flag : '#444';
    const trim = s.own || s.info?.isPlayer ? '#d8d2c4' : 'rgba(0,0,0,0.6)';
    const wave = Math.sin(this.time * 6 + s.id) * beam * 0.12;
    const y0 = -len * 0.18;
    // The painted streamer at the masthead, dyed to her colours, blowing downwind.
    const art = this.pennantArt(color);
    if (art) {
      const flow = state.wind[0] - s.h - Math.PI / 2;
      const w = beam * 0.8, h = w * 0.4;
      g.save();
      g.translate(0, y0);
      g.rotate(flow + Math.sin(this.time * 3 + s.id) * 0.06);
      g.drawImage(art, 0, -h / 2, w, h);
      g.restore();
      return;
    }
    g.beginPath();
    g.moveTo(0, y0);
    g.quadraticCurveTo(beam * 0.5, y0 + len * 0.04 + wave, beam * 1.05, y0 + len * 0.09 + wave * 1.5);
    g.lineTo(0, y0 + len * 0.07);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = trim;
    g.lineWidth = Math.max(0.5, this.zoom * 0.3);
    g.stroke();
  }

  private proceduralShip(id: ShipClassId, len: number, beam: number, sail: number, sailHp: number): void {
    const g = this.g;
    const ghost = id === 'ghost_ship';
    // Hull.
    g.beginPath();
    g.moveTo(0, -len / 2);
    g.bezierCurveTo(beam * 0.55, -len * 0.3, beam * 0.55, len * 0.3, beam * 0.4, len / 2);
    g.lineTo(-beam * 0.4, len / 2);
    g.bezierCurveTo(-beam * 0.55, len * 0.3, -beam * 0.55, -len * 0.3, 0, -len / 2);
    g.closePath();
    g.fillStyle = ghost ? '#141a1a' : '#241b14';
    g.fill();
    g.strokeStyle = ghost ? 'rgba(46,230,200,0.5)' : '#0a0806';
    g.lineWidth = 1.5;
    g.stroke();
    // Deck.
    g.fillStyle = ghost ? '#1d2322' : '#4a3b2b';
    g.beginPath();
    g.ellipse(0, 0, beam * 0.34, len * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    // Masts & sails.
    const cls = SHIP_CLASSES[id];
    const masts = cls.tier >= 3 ? 3 : cls.tier === 2 ? 2 : 1;
    for (let m = 0; m < masts; m++) {
      const my = -len * 0.25 + (m * len * 0.5) / Math.max(1, masts - 1 || 1) - (masts === 1 ? -len * 0.05 : 0);
      const w = beam * (0.9 + sail * 0.6);
      g.fillStyle = `rgba(${ghost ? '120,130,125' : '190,184,165'},${0.35 + sail * 0.55 * (0.4 + sailHp * 0.6)})`;
      if (cls.rig === 'fore_aft') {
        g.beginPath();
        g.moveTo(0, my - len * 0.08);
        g.lineTo(w * 0.5, my + len * 0.12);
        g.lineTo(0, my + len * 0.14);
        g.fill();
      } else {
        g.fillRect(-w / 2, my - 2, w, Math.max(2, len * 0.05 * (0.5 + sail)));
      }
      g.fillStyle = '#15100b';
      g.beginPath();
      g.arc(0, my, Math.max(1.5, beam * 0.08), 0, Math.PI * 2);
      g.fill();
    }
  }

  /** The duel ring: a dashed red circle on the water. */
  private drawDuelRing(state: ClientState): void {
    const d = state.duel;
    if (!d) return;
    const g = this.g;
    g.save();
    g.strokeStyle = d.startsIn > 0 ? 'rgba(224,184,98,0.7)' : 'rgba(208,90,80,0.75)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(this.sx(d.cx), this.sy(d.cy), d.r * this.zoom, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  private drawTethers(state: ClientState, ships: DrawShip[]): void {
    const g = this.g;
    const now = state.estServerTime();
    const pos = new Map(ships.map((s) => [s.id, s]));
    this.fx.tethers = this.fx.tethers.filter((t) => t.until > now && pos.has(t.a) && pos.has(t.b) && pos.get(t.b)!.flags & SF.TETHERED);
    g.save();
    for (const t of this.fx.tethers) {
      const a = pos.get(t.a)!, b = pos.get(t.b)!;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 6; // the cable sags
      g.strokeStyle = 'rgba(150,130,95,0.9)';
      g.lineWidth = Math.max(1, 0.6 * this.zoom);
      g.beginPath();
      g.moveTo(this.sx(a.x), this.sy(a.y));
      g.quadraticCurveTo(this.sx(mx), this.sy(my), this.sx(b.x), this.sy(b.y));
      g.stroke();
    }
    for (const bm of this.fx.beams) {
      const a = 1 - bm.t / 0.6;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(46,230,200,${a})`;
      g.lineWidth = Math.max(2, 3 * this.zoom * a);
      g.beginPath();
      g.moveTo(this.sx(bm.x), this.sy(bm.y));
      g.lineTo(this.sx(bm.x2), this.sy(bm.y2));
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  private drawBalls(): void {
    const g = this.g;
    for (const b of this.fx.balls) {
      if (b.delay > 0) continue;
      const r = Math.max(1.4, (b.ammo === 'grape' ? 0.5 : 0.9) * this.zoom);
      if (b.trail.length > 1) {
        g.strokeStyle = 'rgba(40,40,40,0.35)';
        g.lineWidth = r;
        g.beginPath();
        g.moveTo(this.sx(b.trail[0][0]), this.sy(b.trail[0][1]));
        for (const [tx, ty] of b.trail) g.lineTo(this.sx(tx), this.sy(ty));
        g.stroke();
      }
      g.fillStyle = b.ammo === 'chain' ? '#3b3b3b' : '#111';
      g.beginPath();
      g.arc(this.sx(b.x), this.sy(b.y), r, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawParticles(emissive: boolean): void {
    const g = this.g;
    // Painted particles (Higgsfield `part.*`) where they exist; the drawn shapes otherwise.
    const smokeArt = sprite('part.smoke'), splashArt = sprite('part.splash'), fireArt = sprite('part.fire'), blastArt = sprite('part.explosion');
    for (const p of this.fx.particles) {
      const isEm = p.kind === 'flash' || p.kind === 'fire' || p.kind === 'spark' || p.kind === 'ring';
      if (isEm !== emissive || p.kind === 'text') continue;
      const a = 1 - p.t / p.life;
      const x = this.sx(p.x), y = this.sy(p.y), s = Math.max(0.5, p.size * this.zoom);
      const spin = ((p.x * 13 + p.y * 7) % 6.28) + p.t * 0.4;
      const art = p.kind === 'smoke' && smokeArt && !/^#0/.test(p.color) ? smokeArt : p.kind === 'splash' ? splashArt : p.kind === 'fire' ? fireArt : p.kind === 'flash' && p.size * this.zoom > 3 ? blastArt : null;
      if (art) {
        const d = s * (p.kind === 'smoke' ? 2.0 : p.kind === 'splash' ? 2.4 : 2.2);
        g.save();
        if (p.kind === 'fire' || p.kind === 'flash') g.globalCompositeOperation = 'lighter';
        g.globalAlpha = p.kind === 'smoke' ? a * a * 0.3 : p.kind === 'splash' ? a * 0.85 : a;
        g.translate(x, y);
        g.rotate(spin);
        // Powder smoke is grey and thin, never a white cloud: a darkened copy made once.
        g.drawImage(art === smokeArt ? this.greySmoke(art.img) : art.img, -d / 2, -d / 2, d, d);
        g.restore();
        continue;
      }
      switch (p.kind) {
        case 'smoke':
          g.fillStyle = p.color;
          g.globalAlpha = a * a * 0.2;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          break;
        case 'splash':
          g.strokeStyle = p.color;
          g.globalAlpha = a * 0.7;
          g.lineWidth = Math.max(1, this.zoom);
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.stroke();
          break;
        case 'foam':
        case 'splinter':
          g.fillStyle = p.color;
          g.globalAlpha = a;
          g.fillRect(x - s / 2, y - s / 2, s, s);
          break;
        case 'glow':
          g.fillStyle = p.color;
          g.globalAlpha = a * 0.8;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          break;
        case 'flash':
        case 'fire':
        case 'spark': {
          g.globalCompositeOperation = 'lighter';
          const grd = g.createRadialGradient(x, y, 0, x, y, s);
          grd.addColorStop(0, p.color);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd;
          g.globalAlpha = a;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ring':
          g.strokeStyle = p.color;
          g.globalAlpha = a * 0.6;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.stroke();
          break;
      }
    }
    g.globalAlpha = 1;
  }

  private smokeGrey: HTMLCanvasElement | null = null;

  private greySmoke(img: HTMLImageElement): HTMLCanvasElement {
    if (this.smokeGrey) return this.smokeGrey;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cg = c.getContext('2d')!;
    cg.drawImage(img, 0, 0);
    cg.globalCompositeOperation = 'source-atop';
    cg.fillStyle = 'rgba(40,44,48,0.45)';
    cg.fillRect(0, 0, c.width, c.height);
    return (this.smokeGrey = c);
  }

  private drawTexts(): void {
    const g = this.g;
    g.textAlign = 'center';
    // Plates of several parts struck on one ship stand one above another, the newest on top of the stack.
    const stack = new Map<number, number>();
    for (let i = this.fx.particles.length - 1; i >= 0; i--) {
      const p = this.fx.particles[i];
      if (p.kind !== 'text' || !p.badge) continue;
      const k = p.ship ?? -1, n = stack.get(k) ?? 0;
      stack.set(k, n + 1);
      this.drawCritBadge(p.badge, p.text!, this.sx(p.x), this.sy(p.y) - n * 28, p.t, p.life, p.color);
    }
    for (const p of this.fx.particles) {
      if (p.kind !== 'text' || !p.text || p.badge) continue;
      const a = 1 - p.t / p.life;
      g.globalAlpha = a;
      g.font = `600 ${p.size}px Inter, sans-serif`;
      g.fillStyle = '#000';
      g.fillText(p.text, this.sx(p.x) + 1, this.sy(p.y) + 1);
      g.fillStyle = p.color;
      g.fillText(p.text, this.sx(p.x), this.sy(p.y));
    }
    g.globalAlpha = 1;
  }

  /** A critical hit's plate over the target (docs/16 #2): a dark plate with a gold rim, the struck part drawn on the
   *  left and its word beside it; it pops up in the first moment, holds, and fades as it climbs. */
  private drawCritBadge(part: CritPart, text: string, x: number, y: number, t: number, life: number, color: string): void {
    const g = this.g;
    const pop = t < 0.14 ? 0.6 + (t / 0.14) * 0.55 : t < 0.26 ? 1.15 - ((t - 0.14) / 0.12) * 0.15 : 1;
    const alpha = t > life - 0.6 ? Math.max(0, (life - t) / 0.6) : 1;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(pop, pop);
    g.font = '700 15px Inter, sans-serif';
    const tw = g.measureText(text).width;
    const w = tw + 34, h = 24;
    const x0 = -w / 2, y0 = -h / 2;
    g.fillStyle = 'rgba(12,10,8,0.84)';
    g.beginPath();
    g.roundRect(x0, y0, w, h, 6);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 1.5;
    g.stroke();
    critIcon(g, part, x0 + 13, 0, color);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, x0 + 25, 1);
    g.restore();
  }

  // ------------------------------------------------------------------ light

  private drawLighting(state: ClientState, ships: DrawShip[], night: number): void {
    const dg = this.dg;
    const W = this.dark.width, H = this.dark.height;
    const k = 0.5; // dark canvas is half resolution
    // Night falls hard but not blind: a phone in a lit room must still read the sea (docs/06 §5.8).
    const darkness = 0.12 + night * 0.4 + (state.weather === 'storm' || state.weather === 'black_storm' ? 0.1 : 0);
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, H);
    dg.fillStyle = `rgba(3,6,14,${darkness})`;
    dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = 'destination-out';
    const hole = (wx: number, wy: number, r: number, strength: number) => {
      const x = this.sx(wx) * k, y = this.sy(wy) * k, rr = r * this.zoom * k;
      if (x < -rr || y < -rr || x > W + rr || y > H + rr) return;
      const grd = dg.createRadialGradient(x, y, 0, x, y, rr);
      grd.addColorStop(0, `rgba(0,0,0,${strength})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = grd;
      dg.beginPath();
      dg.arc(x, y, rr, 0, Math.PI * 2);
      dg.fill();
    };
    const glows: { x: number; y: number; r: number; color: string; a: number }[] = [];
    const marks: { x: number; y: number; sign: string; color: string }[] = [];
    const opt = settings();
    for (const s of ships) {
      if (s.flags & SF.LANTERNS_OUT || s.sinkT > 0) continue;
      const cls = SHIP_CLASSES[s.classId];
      const back = headingVec(s.h + Math.PI);
      const lx = s.x + back.x * cls.length * 0.4, ly = s.y + back.y * cls.length * 0.4;
      hole(lx, ly, 40 + cls.length * 0.8, 0.6);
      if (s.own) hole(s.x, s.y, 90, 0.22); // her own deck just readable, no halo
      // A captain's lanterns burn the colour of her look (docs/12 P10 #12).
      const lamp = decodeLook(s.own ? state.self?.look : s.info?.look)?.lamp ?? 0;
      const fac = s.own || s.info?.isPlayer ? LAMPS[lamp].color : s.info && s.info.faction !== 'player' ? cbColor(opt.colorblind, FACTIONS[s.info.faction].lantern) : '#f2b35a';
      // Lanterns flicker a little (unless the options still them).
      const flick = opt.lanternFlicker ? 0.88 + 0.12 * Math.sin(this.time * 9 + s.id * 1.7) * Math.sin(this.time * 3.1 + s.id) : 1;
      // A lantern is a point of warm light on the water, not a cloud about the hull.
      glows.push({ x: lx, y: ly, r: 4 + cls.length * 0.14, color: fac, a: 0.3 * flick });
      // Lantern marks: the faction's sign by her lantern at battle zoom.
      if (opt.lanternMarks && this.zoom >= 1.4 && s.info && s.info.faction !== 'player') marks.push({ x: lx, y: ly, sign: FACTION_SIGN[s.info.faction], color: fac });
    }
    for (const p of state.ports) {
      hole(p.x, p.y, 520, 0.8);
      glows.push({ x: p.x, y: p.y, r: 90, color: cbColor(opt.colorblind, FACTIONS[p.faction].lantern), a: 0.28 });
    }
    // A lighthouse burns only when it is lit (docs/16 #23): by the Crown, for a keeper's pay, or its island's own.
    const litIds = new Set(litLights(state).map((l) => l.island));
    for (const is of state.islands.values()) {
      if (!is.features.includes('lighthouse') || !litIds.has(is.id)) continue;
      const p = this.featurePoint(is, 1, 0.04);
      hole(p.x, p.y, 260, 0.85);
      glows.push({ x: p.x, y: p.y, r: 40, color: '#f5c77a', a: 0.6 });
      // Rotating beam.
      const a = this.time * 0.6 + is.id;
      for (const off of [0, Math.PI]) {
        const v = headingVec(a + off);
        hole(p.x + v.x * 500, p.y + v.y * 500, 260, 0.35);
        hole(p.x + v.x * 1000, p.y + v.y * 1000, 300, 0.25);
      }
      if (REGIONS[is.region].strangeness > 0.3 && is.features.includes('shrine')) glows.push({ x: is.x, y: is.y, r: 70, color: '#2ee6c8', a: 0.25 });
    }
    for (const l of this.fx.lights) {
      const f = 1 - l.t / l.life;
      hole(l.x, l.y, l.r, l.intensity * f);
      glows.push({ x: l.x, y: l.y, r: l.r * 0.4, color: l.color, a: 0.5 * l.intensity * f });
    }
    dg.globalCompositeOperation = 'source-over';
    const g = this.g;
    g.drawImage(this.dark, 0, 0, this.w, this.h);
    // Additive lantern glow (warm against cold water).
    g.globalCompositeOperation = 'lighter';
    for (const gl of glows) {
      const x = this.sx(gl.x), y = this.sy(gl.y), r = gl.r * this.zoom;
      if (x < -r || y < -r || x > this.w + r || y > this.h + r) continue;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, hexA(gl.color, gl.a * (0.4 + night * 0.6)));
      grd.addColorStop(1, hexA(gl.color, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    if (marks.length) {
      g.font = '600 13px Inter, sans-serif';
      g.textAlign = 'left';
      for (const m of marks) {
        const x = this.sx(m.x) + 7, y = this.sy(m.y) + 4;
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillText(m.sign, x + 1, y + 1);
        g.fillStyle = m.color;
        g.fillText(m.sign, x, y);
      }
    }
    // Cold moonlight grade.
    g.fillStyle = `rgba(40,70,110,${0.04 + night * 0.05})`;
    g.globalCompositeOperation = 'soft-light';
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'source-over';
  }

  private drawWeather(state: ClientState, dt: number): void {
    const g = this.g;
    // Fog: noise layer drifting with the wind (the shader sky draws it when WebGL is on).
    if (state.fog > 0.08 && !this.sky) {
      this.noisePattern ??= g.createPattern(this.noise, 'repeat');
      const p = this.noisePattern!;
      const wind = headingVec(state.wind[0]);
      const drift = this.time * 6;
      p.setTransform(new DOMMatrix().translate(this.sx(wind.x * drift), this.sy(wind.y * drift)).scale((900 * this.zoom) / 256));
      g.fillStyle = p;
      g.globalAlpha = state.fog * 0.22;
      g.globalCompositeOperation = 'screen';
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(70,82,92,${state.fog * 0.16})`;
      g.fillRect(0, 0, this.w, this.h);
      g.globalAlpha = 1;
    }
    const raining = state.weather === 'rain' || state.weather === 'storm' || state.weather === 'black_storm';
    if (raining) {
      const heavy = state.weather !== 'rain';
      const wind = headingVec(state.wind[0]);
      g.strokeStyle = state.weather === 'black_storm' ? 'rgba(120,200,190,0.25)' : 'rgba(180,195,210,0.28)';
      g.lineWidth = 1;
      g.beginPath();
      const n = heavy ? this.rain.length : this.rain.length / 2;
      for (let i = 0; i < n; i++) {
        const r = this.rain[i];
        r.y += dt * r.s * 1.6;
        r.x += dt * wind.x * 0.3;
        if (r.y > 1) r.y -= 1;
        if (r.x > 1) r.x -= 1;
        if (r.x < 0) r.x += 1;
        const x = r.x * this.w, y = r.y * this.h;
        g.moveTo(x, y);
        g.lineTo(x + wind.x * 6, y + 14 * r.s);
      }
      g.stroke();
      if (heavy) {
        this.nextLightning -= dt;
        if (this.nextLightning <= 0) {
          this.nextLightning = 6 + Math.random() * 12; // series of strikes at least 4 s apart
          this.lightning = 1;
          this.fx.screenFlash(0.8);
          this.onLightning();
          // A bolt from the top of the sky down to somewhere over the sea.
          let x = this.w * (0.15 + Math.random() * 0.7), y = -10;
          const pts: [number, number][] = [[x, y]];
          for (let i = 0; i < 7; i++) {
            x += (Math.random() - 0.5) * this.w * 0.08;
            y += this.h * (0.06 + Math.random() * 0.06);
            pts.push([x, y]);
          }
          this.bolt = pts;
        }
      }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3);
    if (this.lightning <= 0) this.bolt = null;
    if (this.sky) {
      const wv = headingVec(state.wind[0]);
      this.sky.draw({
        camX: this.camX, camY: this.camY, zoom: this.zoom, time: this.time, wind: [wv.x * (0.5 + state.wind[1]), wv.y * (0.5 + state.wind[1])],
        fog: clamp(state.fog, 0, 1), flash: settings().reduceFlashes ? this.fx.flash * 0.25 : this.fx.flash, night: nightFactor(state.estServerTime()), bolt: this.bolt, boltOn: settings().reduceFlashes ? 0 : this.lightning,
      });
    }
  }

  private drawVignette(fog: number, night: number): void {
    const g = this.g;
    const grd = g.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, `rgba(0,0,0,${0.4 + night * 0.15 + fog * 0.12})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, this.w, this.h);
  }

  // ------------------------------------------------------------------ overlays

  private band = { top: 0, bottom: 0, at: -1 };
  private hudRects: DOMRect[] = [];
  /** The free band of the screen between the top panels and the bottom block (measured twice a second). */
  private hudBand(): { top: number; bottom: number } {
    if (this.time - this.band.at > 0.5 || this.band.at < 0) {
      let top = 0, bottom = this.h;
      this.hudRects = [];
      for (const sel of ['#hud-captain', '#hud-map', '#hud-region', '#hud-goals:not(.hidden)', '#hud-prompt', '#hud-stack > :not(.hidden)', '#hud-bottom', '#hud-menu', '#tc-stick', '#tc-fire', '#tc-act:not(.hidden)', '#tc-special:not(.hidden)', '#tc-target:not(.hidden)', '#tc-menu', '#tc-news:not(.hidden)', '#chat-toggle', '#chat.open', '#toasts:not(:empty)', '#encounter:not(.hidden)', '#surrender:not(.hidden)', '#advcard:not(.hidden)']) {
        document.querySelectorAll<HTMLElement>(sel).forEach((e) => {
          const r = e.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) this.hudRects.push(r);
        });
      }
      for (const sel of ['#hud-captain', '#hud-map', '#hud-region', '#hud-stack > :not(.hidden)']) {
        document.querySelectorAll<HTMLElement>(sel).forEach((e) => {
          const r = e.getBoundingClientRect();
          if (r.height > 0 && r.top < this.h * 0.45) top = Math.max(top, r.bottom);
        });
      }
      for (const sel of ['#hud-bottom', '#tc-stick', '#tc-fire']) {
        const e = document.querySelector<HTMLElement>(sel);
        const r = e?.getBoundingClientRect();
        if (r && r.height > 0 && r.top > this.h * 0.5) bottom = Math.min(bottom, r.top);
      }
      this.band = { top: Math.min(top, this.h * 0.45), bottom: Math.max(bottom, this.h * 0.55), at: this.time };
    }
    return this.band;
  }

  /** Whether a threat mark (its circle and range) at x, y is clear of every HUD block and on the screen. */
  /** Ships' name boxes drawn this frame, so no name lies on another. */
  private labelBoxes: { l: number; r: number; t: number; b: number }[] = [];

  /** Marks placed on the screen's edge this frame (threats, then the quest's), so none lies on another. */
  private rimTaken: [number, number][] = [];

  /** A place on the screen's edge for a mark pointing at angle a: where the ray leaves the screen, or the nearest place
   *  along the edge clear of the HUD's blocks and of the marks already there. */
  private rimSpot(a: number, labelW = 0, off = 27): [number, number] {
    const menuCol = !document.body.classList.contains('touch') && this.w < 1100 ? 56 : 0;
    const L = 30, R = this.w - 30 - menuCol, T = 30, B = this.h - 30;
    const cx = this.w / 2, cy = this.h / 2;
    const edge = (b: number): [number, number] => {
      const dx = Math.cos(b), dy = Math.sin(b);
      const kx = dx > 1e-6 ? (R - cx) / dx : dx < -1e-6 ? (L - cx) / dx : Infinity;
      const ky = dy > 1e-6 ? (B - cy) / dy : dy < -1e-6 ? (T - cy) / dy : Infinity;
      const k = Math.min(kx, ky);
      return [cx + dx * k, cy + dy * k];
    };
    // The mark's range is written inward of it (docs/17 H5's QA: on a narrow phone «3,1 км» lay half under the right
    // column's plates): its box must be clear of the HUD too.
    const labelFree = (q: [number, number]) => {
      if (labelW <= 0) return true;
      const lx = q[0] - Math.cos(a) * off, ly = q[1] - Math.sin(a) * off, hw = labelW / 2 + 2;
      if (lx - hw < 2 || lx + hw > this.w - 2) return false;
      return !this.hudRects.some((r) => lx + hw > r.left && lx - hw < r.right && ly + 8 > r.top && ly - 8 < r.bottom);
    };
    const free = (q: [number, number]) => this.clearOfHud(q[0], q[1]) && labelFree(q) && !this.rimTaken.some(([x, y]) => Math.hypot(x - q[0], y - q[1]) < 46);
    for (let i = 0; i <= 90; i++) {
      for (const b of i ? [a + i * 0.035, a - i * 0.035] : [a]) {
        const q = edge(b);
        if (free(q)) {
          this.rimTaken.push(q);
          return q;
        }
      }
    }
    const q = edge(a);
    this.rimTaken.push(q);
    return q;
  }

  private clearOfHud(x: number, y: number): boolean {
    const m = 18;
    if (x < m || x > this.w - m || y < m || y > this.h - m) return false;
    return !this.hudRects.some((q) => x > q.left - m && x < q.right + m && y > q.top - m && y < q.bottom + m);
  }

  /** Hostile ships and bosses beyond the edge of the screen: a mark on the rim pointing at each, with the range,
   * so a phone's close view never hides who is coming. */
  private drawThreatMarks(ships: DrawShip[], own: SailState): void {
    const g = this.g;
    this.hudBand(); // the HUD's blocks, measured
    this.rimTaken = [];
    const marks: { s: DrawShip; d: number }[] = [];
    for (const s of ships) {
      if (s.own || s.sinkT > 0) continue;
      const boss = s.info?.npcRole === 'boss';
      if (!boss && !(s.flags & SF.HOSTILE)) continue;
      const d = Math.hypot(s.x - own.x, s.y - own.y);
      if (d > (boss ? 4000 : 2000)) continue;
      const px = this.sx(s.x), py = this.sy(s.y);
      if (px > 0 && px < this.w && py > 0 && py < this.h) continue;
      marks.push({ s, d });
    }
    marks.sort((a, b) => a.d - b.d);
    g.save();
    g.font = '600 11px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const drawn: number[] = [];
    for (const { s, d } of marks) {
      if (this.rimTaken.length >= 5) break;
      const a = Math.atan2(this.sy(s.y) - this.h / 2, this.sx(s.x) - this.w / 2);
      // One mark for a crowd (a kraken's eight arms): the nearest speaks for them.
      if (drawn.some((b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) < 0.12)) continue;
      drawn.push(a);
      const text = d >= 1000 ? L('dist.km', { n: dec1(d / 1000) }) : L('dist.m', { n: Math.round(d / 10) * 10 });
      const [x, y] = this.rimSpot(a, g.measureText(text).width, 26);
      const boss = s.info?.npcRole === 'boss';
      const col = boss ? '#2ee6c8' : '#e0503c';
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = 'rgba(8,10,14,0.75)';
      g.beginPath();
      g.arc(0, 0, 15, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(11, 0);
      g.lineTo(2, -7);
      g.lineTo(4, 0);
      g.lineTo(2, 7);
      g.closePath();
      g.fill();
      g.rotate(-a);
      g.fillStyle = 'rgba(240,230,200,0.95)';
      g.fillText(text, 0 - Math.cos(a) * 26, 0 - Math.sin(a) * 26);
      g.translate(-x, -y);
    }
    g.restore();
  }

  /** The tracked quest's goal (docs/11 P6): a gold ring on it when in sight, else a gold mark on the rim pointing
   *  the way with the range — gone once there (inside the region, or near the port or island). */
  private drawQuestMark(state: ClientState, own: SailState): void {
    // The HUD's «Now:» — the followed quest, a contract's port, the nearest sign: one gold mark leads there.
    const o = objective(state, own.x, own.y);
    if (!o || o.x === undefined || o.y === undefined || o.d === undefined || o.d < 150) return;
    const p = { x: o.x, y: o.y, d: o.d };
    const g = this.g;
    const gold = '#d9b25a';
    const px = this.sx(p.x), py = this.sy(p.y);
    const label = p.d >= 1000 ? L('dist.km', { n: dec1(p.d / 1000) }) : L('dist.m', { n: Math.round(p.d / 10) * 10 });
    g.save();
    g.font = '600 11px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (px > 40 && px < this.w - 40 && py > 40 && py < this.h - 40) {
      // In sight: a slow gold ring round the place.
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.4);
      g.strokeStyle = `rgba(217,178,90,${0.55 + 0.35 * pulse})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px, py, 16 + 4 * pulse, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = gold;
      g.beginPath();
      g.moveTo(px, py - 6);
      g.lineTo(px + 5, py);
      g.lineTo(px, py + 6);
      g.lineTo(px - 5, py);
      g.closePath();
      g.fill();
      g.restore();
      return;
    }
    // Out of sight: on the screen's edge like the threat marks, clear of the HUD and of them.
    this.hudBand();
    const a = Math.atan2(py - this.h / 2, px - this.w / 2);
    const [x, y] = this.rimSpot(a, g.measureText(label).width, 27);
    g.translate(x, y);
    g.fillStyle = 'rgba(8,10,14,0.8)';
    g.beginPath();
    g.arc(0, 0, 15, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = gold;
    g.lineWidth = 2;
    g.stroke();
    // A gold diamond inside, the arrow's tip toward the goal.
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(4, 0);
    g.lineTo(0, 5);
    g.lineTo(-4, 0);
    g.closePath();
    g.fill();
    g.rotate(a);
    g.beginPath();
    g.moveTo(21, 0);
    g.lineTo(15, -5);
    g.lineTo(15, 5);
    g.closePath();
    g.fill();
    g.rotate(-a);
    g.fillStyle = 'rgba(240,226,190,0.95)';
    g.fillText(label, -Math.cos(a) * 27, -Math.sin(a) * 27);
    g.restore();
  }

  private drawAim(state: ClientState, own: SailState, aim: { side: 'port' | 'starboard' | null; dist: number; chaser: 'bow' | 'stern' | null; charge?: { side: 'port' | 'starboard'; held: number } | null }, ships: DrawShip[]): void {
    const you = state.you!;
    const self = state.self!;
    const cls = SHIP_CLASSES[self.loadout.classId];
    const x = this.sx(own.x), y = this.sy(own.y);
    // The guns stand at her side: the marks start there, not in her middle.
    const hull = cls.beam * this.zoom * 0.6;
    if (aim.chaser) {
      const has = aim.chaser === 'bow' ? cls.bowChasers : cls.sternChasers;
      if (has) {
        const ready = you.reload[aim.chaser] >= 1;
        const keel = aim.chaser === 'bow' ? own.heading : own.heading + Math.PI;
        const range = GUNS.long_9.range * (state.ownStats?.rangeMul ?? 1) * AMMO[you.ammoSel === 'grape' ? 'round' : you.ammoSel].rangeMul;
        const dw = clamp(aim.dist, 40, range);
        const d = dw * this.zoom;
        this.drawFall(x, y, keel - Math.PI / 2, CHASER_CONE * 0.5, cls.length * this.zoom * 0.5, range * this.zoom, d, ready ? [143, 179, 217] : [110, 118, 126], ready ? 1 : 0.5, this.driftOf(state, keel, dw, you.ammoSel === 'grape' ? 'round' : you.ammoSel));
      }
    }
    for (const side of ['port', 'starboard'] as const) {
      const gun = GUNS[self.loadout.guns[side]];
      const range = gun.range * (state.ownStats?.rangeMul ?? 1) * AMMO[you.ammoSel].rangeMul;
      const ready = you.reload[side] >= 1;
      const active = aim.side === side;
      const h = own.heading + (side === 'port' ? -Math.PI / 2 : Math.PI / 2);
      const a = h - Math.PI / 2;
      if (!active) {
        // The other side only says it is loaded: a short row of brass dots off her side.
        if (ready) this.dots(x, y, a, hull + 6, hull + 34, 7, [224, 184, 98], 0.35);
        continue;
      }
      // A held broadside (dynamic combat): the mark narrows as the crews take aim, burns gold in the perfect window
      // and reddens when held too long.
      const held = aim.charge?.side === side ? aim.charge.held : 0;
      const focus = aimFocus(held);
      const c = held / AIM_CHARGE;
      const perfect = focus.perfect, waver = held >= AIM_TAP && c > AIM_WAVER;
      const spread = ((gun.spreadDeg * Math.PI) / 180 * 3 + 0.12) * (held >= AIM_TAP ? focus.spread : 1);
      const dw = clamp(aim.dist, 40, range);
      const d = dw * this.zoom;
      const tone: [number, number, number] = !ready ? [150, 130, 105] : perfect ? [255, 226, 140] : waver ? [214, 112, 96] : [224, 184, 98];
      this.drawFall(x, y, a, spread, hull, range * this.zoom, d, tone, !ready ? 0.45 : perfect ? 1.35 : 1, this.driftOf(state, h, dw, you.ammoSel, 1 + (gun.shotSpeed ?? 0)));
      if (held > 0) this.drawCharge(x, y, c, perfect, waver);
      this.drawRakes(state, own, ships, side, range, h, spread);
    }
  }

  /** Her own ship always found on the dark water (owner, 2026-09-29): a thin brass ring, and the law's marks over her. */
  private drawOwnMark(state: ClientState, own: SailState): void {
    const g = this.g;
    const cls = SHIP_CLASSES[state.self!.loadout.classId];
    const x = this.sx(own.x), y = this.sy(own.y);
    const r = Math.max(16, cls.length * this.zoom * 0.62);
    g.save();
    g.strokeStyle = `rgba(217,178,90,${0.28 + 0.2 * this.nightNow})`;
    g.lineWidth = 1.5;
    g.setLineDash([3, 5]);
    g.lineDashOffset = -this.time * 4;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    const w = state.self!.wanted ?? 0;
    if (w > 0) {
      g.font = '600 12px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillText('☠'.repeat(w), x + 1, y - r - 5);
      g.fillStyle = cbColor(settings().colorblind, '#e0776b');
      g.fillText('☠'.repeat(w), x, y - r - 6);
    }
    g.restore();
  }

  /** The cross wind's drift of a ball laid `dist` metres along world heading `h` (docs/16 #1), in metres (+ to the
   *  right of her line) — the same reckoning as the server's (shared/src/data/gunnery.ts). */
  private driftOf(state: ClientState, h: number, dist: number, ammo: keyof typeof AMMO, gunSpeed = 1): number {
    const speed = AMMO[ammo].speed * (1 + (state.ownStats ? tval(state.ownStats, 'shotSpeed') : 0)) * gunSpeed;
    return windDrift(state.wind[0], state.wind[1], h, dist, speed);
  }

  /** A gunner's mark on the water instead of a lit wedge: where the shot will fall (a feathered band at the aim range,
   * as wide as the spread there, soft at its ends), the line of flight to it in dots, the reach as a faint row of dots.
   * `drift` (metres, + to the right): the cross wind carries the fall downwind of the line she lays — the band stands
   * where the balls will land, a hollow ring where she laid them, and a short hook from one to the other. */
  private drawFall(x: number, y: number, a0: number, spread: number, r0: number, reach: number, d: number, tone: [number, number, number], k: number, drift = 0): void {
    const g = this.g;
    const [cr, cg, cb] = tone;
    const col = (al: number) => `rgba(${cr},${cg},${cb},${Math.min(1, al * k).toFixed(3)})`;
    const dm = d / Math.max(1e-6, this.zoom); // the aim range in metres
    const a = a0 + Math.atan2(drift, Math.max(1, dm));
    g.save();
    if (Math.abs(drift) * this.zoom >= 2.5) {
      // Where she laid them: a hollow ring, and the hook of the wind to the fall.
      const lx = x + Math.cos(a0) * d, ly = y + Math.sin(a0) * d;
      g.strokeStyle = col(0.55);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(lx, ly, 3.2, 0, Math.PI * 2);
      g.stroke();
      const n = Math.max(2, Math.round(Math.abs(a - a0) * d / 5));
      for (let i = 1; i < n; i++) {
        const t = a0 + ((a - a0) * i) / n;
        g.fillStyle = col(0.3 + 0.5 * (i / n));
        g.beginPath();
        g.arc(x + Math.cos(t) * d, y + Math.sin(t) * d, 1.1, 0, Math.PI * 2);
        g.fill();
      }
      // An arrowhead at the fall, pointing downwind along the hook.
      const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d;
      const dir = a + (Math.sign(a - a0) * Math.PI) / 2;
      g.fillStyle = col(0.9);
      g.beginPath();
      g.moveTo(fx + Math.cos(dir) * 4, fy + Math.sin(dir) * 4);
      g.lineTo(fx + Math.cos(dir + 2.5) * 4, fy + Math.sin(dir + 2.5) * 4);
      g.lineTo(fx + Math.cos(dir - 2.5) * 4, fy + Math.sin(dir - 2.5) * 4);
      g.closePath();
      g.fill();
      // How far, in words, beyond the fall.
      if (Math.abs(drift) >= 1.5) {
        g.font = '600 11px Inter, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const far = d + Math.max(8, reach * 0.05) + 16; // beyond the fall's outer arc
        const tx = x + Math.cos(a) * far, ty = y + Math.sin(a) * far;
        const label = L('drift', { n: Math.round(Math.abs(drift)) });
        g.fillStyle = `rgba(0,0,0,${Math.min(0.8, 0.7 * k).toFixed(3)})`;
        g.fillText(label, tx + 1, ty + 1);
        g.fillStyle = col(0.95);
        g.fillText(label, tx, ty);
      }
    }
    // The fall: where the shot will land, as dotted arcs across the spread (no fill: a filled band reads as a blot on
    // the water) — the middle arc bright, two faint ones before and beyond it for the scatter in range.
    const depth = Math.max(8, reach * 0.05);
    const inner = Math.max(r0, d - depth);
    const arcDots = (r: number, gap: number, size: number, alpha: number) => {
      const step = gap / Math.max(1, r);
      for (let t = a - spread; t <= a + spread + 1e-6; t += step) {
        const f = Math.sin(((t - (a - spread)) / (spread * 2)) * Math.PI);
        if (f < 0.08) continue;
        g.fillStyle = col(alpha * (0.35 + 0.65 * f));
        g.beginPath();
        g.arc(x + Math.cos(t) * r, y + Math.sin(t) * r, size, 0, Math.PI * 2);
        g.fill();
      }
    };
    arcDots(d, 8, 1.7, 0.8);
    if (d - depth > r0 + 4) arcDots(d - depth, 11, 1.2, 0.35);
    arcDots(d + depth, 11, 1.2, 0.35);
    // Where the middle of the fall lies: a short bright tick across the band.
    g.strokeStyle = col(0.85);
    g.lineWidth = 2;
    g.lineCap = 'round';
    const span = Math.min(spread * 0.55, 18 / Math.max(1, d));
    g.beginPath();
    g.arc(x, y, d, a - span, a + span);
    g.stroke();
    g.restore();
    // The line of flight, and the reach.
    this.dots(x, y, a, r0 + 8, Math.max(r0 + 8, inner - 6), 12, tone, 0.45 * k);
    const step = 16 / Math.max(1, reach);
    g.fillStyle = col(0.3);
    for (let t = a - spread; t <= a + spread; t += step) {
      const f = Math.sin(((t - (a - spread)) / (spread * 2)) * Math.PI);
      g.globalAlpha = f;
      g.beginPath();
      g.arc(x + Math.cos(t) * reach, y + Math.sin(t) * reach, 1.3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /** A row of small dots from r0 to r1 along an angle, fading in toward the far end. */
  private dots(x: number, y: number, a: number, r0: number, r1: number, gap: number, tone: [number, number, number], alpha: number): void {
    const g = this.g;
    const cx = Math.cos(a), cy = Math.sin(a);
    for (let r = r0; r <= r1; r += gap) {
      const f = r1 > r0 ? 0.35 + 0.65 * ((r - r0) / (r1 - r0)) : 1;
      g.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${(alpha * f).toFixed(3)})`;
      g.beginPath();
      g.arc(x + cx * r, y + cy * r, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** The charge of a held broadside: a ring around your ship that fills, with the perfect window marked on it. */
  private drawCharge(x: number, y: number, c: number, perfect: boolean, waver: boolean): void {
    const g = this.g;
    const r = 30 + 6 * this.zoom;
    const full = AIM_WAVER + 0.1; // the ring's whole turn
    const at = (v: number) => -Math.PI / 2 + (Math.min(v, full) / full) * Math.PI * 2;
    g.save();
    g.lineCap = 'round';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(8,10,14,0.55)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    // The perfect window.
    g.strokeStyle = 'rgba(255,226,140,0.45)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(x, y, r, at(AIM_PERFECT[0]), at(AIM_PERFECT[1]));
    g.stroke();
    g.strokeStyle = perfect ? '#ffe28c' : waver ? '#d06a5e' : 'rgba(240,230,200,0.9)';
    g.lineWidth = perfect ? 5 : 3;
    if (perfect) {
      g.shadowColor = 'rgba(255,220,130,0.9)';
      g.shadowBlur = 12;
    }
    g.beginPath();
    g.arc(x, y, r, at(0), at(c));
    g.stroke();
    g.restore();
  }

  /** Ships in the fan that would be raked (the balls running along their keel): a red mark along the keel. */
  private drawRakes(state: ClientState, own: SailState, ships: DrawShip[], side: 'port' | 'starboard', range: number, h: number, spread: number): void {
    const g = this.g;
    for (const s of ships) {
      if (s.own || s.sinkT > 0 || !(s.flags & SF.HOSTILE)) continue;
      const dx = s.x - own.x, dy = s.y - own.y;
      const d = Math.hypot(dx, dy);
      if (d > range || d < 20) continue;
      const bearing = Math.atan2(dx, -dy);
      if (Math.abs(Math.atan2(Math.sin(bearing - h), Math.cos(bearing - h))) > spread + 0.05) continue;
      const keel = headingVec(s.h);
      const along = Math.abs((dx / d) * keel.x + (dy / d) * keel.y);
      if (along < 0.87) continue;
      const len = Math.max(14, SHIP_CLASSES[s.classId].length * 0.55) * this.zoom;
      const x = this.sx(s.x), y = this.sy(s.y);
      g.save();
      g.strokeStyle = 'rgba(224,80,60,0.9)';
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.moveTo(x - keel.x * len, y - keel.y * len);
      g.lineTo(x + keel.x * len, y + keel.y * len);
      g.stroke();
      g.setLineDash([]);
      g.font = '600 11px Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillText(L('raking'), x + 1, y - len * 0.6 - 9);
      g.fillStyle = '#ff9a80';
      g.fillText(L('raking'), x, y - len * 0.6 - 10);
      g.restore();
    }
    void state;
    void side;
  }

  /** The Flying Dutchman's green lanterns on the water (docs/12 P10 #10), where his pages lie. */
  private drawLanterns(state: ClientState): void {
    const v = state.dutchman;
    if (!v) return;
    const g = this.g;
    const t = settings().reduceMotion ? 0 : this.time;
    for (const pg of v.pages) {
      if (pg.taken) continue;
      const x = this.sx(pg.x), y = this.sy(pg.y);
      if (x < -120 || y < -120 || x > this.w + 120 || y > this.h + 120) continue;
      const a = 0.6 + 0.3 * Math.sin(t * 2.3 + pg.i);
      const gr = g.createRadialGradient(x, y, 0, x, y, 90 * this.zoom + 20);
      gr.addColorStop(0, `rgba(140,255,170,${a})`);
      gr.addColorStop(1, 'rgba(140,255,170,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, 90 * this.zoom + 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b2a20';
      g.fillRect(x - 3, y - 7, 6, 10);
      g.fillStyle = `rgba(200,255,210,${a})`;
      g.fillRect(x - 2, y - 5, 4, 6);
    }
  }

  /** A letter of marque's order (docs/12 P10 #15): the patrol's marks (pennant buoys with a ring), and an arrow at the
   *  screen's edge toward the nearest mark, the quarry or the port. */
  private drawOrderMarks(state: ClientState): void {
    const o = state.self?.service?.order;
    const own = state.ownDisplay;
    if (!o || o.kind === 'hunt' || !own || state.self?.dockedAt) return; // a hunt is anywhere in its sea
    const g = this.g;
    const t = settings().reduceMotion ? 0 : this.time;
    const r = Math.max(6, 7 * this.zoom);
    const targets: [number, number][] = o.marks?.length ? o.marks : [[o.x, o.y]];
    const near = [...targets].sort((a, b) => Math.hypot(a[0] - own.x, a[1] - own.y) - Math.hypot(b[0] - own.x, b[1] - own.y))[0];
    let arrow = true;
    for (const [mx, my] of o.marks ?? []) {
      const x = this.sx(mx), y = this.sy(my);
      if (x < -60 || y < -60 || x > this.w + 60 || y > this.h + 60) continue;
      if (mx === near[0] && my === near[1]) arrow = false;
      const k = (t * 0.7) % 1;
      g.strokeStyle = `rgba(240,213,138,${0.7 * (1 - k)})`;
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r * (1.5 + k * 2.5), 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#2a1a10'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y + r); g.lineTo(x, y - r * 2.2); g.stroke();
      g.fillStyle = '#c9a25a';
      g.beginPath(); g.moveTo(x, y - r * 2.2); g.lineTo(x + r * 1.6, y - r * 1.7); g.lineTo(x, y - r * 1.2); g.closePath(); g.fill();
      g.fillStyle = '#1b2a3a';
      g.beginPath(); g.arc(x, y + r * 0.4, r * 0.7, 0, Math.PI * 2); g.fill();
    }
    if (!o.marks?.length) {
      const x = this.sx(near[0]), y = this.sy(near[1]);
      arrow = x < -60 || y < -60 || x > this.w + 60 || y > this.h + 60;
    }
    if (arrow) this.edgeArrow(this.sx(near[0]), this.sy(near[1]), '#f0d58a');
  }

  /** Powder Night's kegs (docs/12 P10 #18): a staved keg afloat, iron hoops, a red powder mark, bobbing. */
  private drawKegs(state: ClientState): void {
    const kegs = state.holiday?.kegs;
    if (!kegs?.length) return;
    const g = this.g;
    const t = settings().reduceMotion ? 0 : this.time;
    const r = Math.max(6, 3.2 * this.zoom);
    kegs.forEach(([kx, ky], i) => {
      const x = this.sx(kx), y = this.sy(ky);
      if (x < -30 || y < -30 || x > this.w + 30 || y > this.h + 30) return;
      const bob = Math.sin(t * 1.7 + i * 1.3) * r * 0.12;
      // A thin red ring pulsing about it: a target to aim at.
      const k = (t * 0.6 + i * 0.3) % 1;
      g.strokeStyle = `rgba(224,110,80,${0.65 * (1 - k)})`;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, r * (2 + k * 2.2), 0, Math.PI * 2); g.stroke();
      g.save();
      g.translate(x, y + bob);
      g.rotate(Math.sin(t * 0.6 + i) * 0.3 + i);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(r * 0.3, r * 0.35, r * 1.35, r * 0.95, 0, 0, Math.PI * 2); g.fill();
      const wood = g.createLinearGradient(-r, 0, r, 0);
      wood.addColorStop(0, '#3a2414'); wood.addColorStop(0.5, '#7a5230'); wood.addColorStop(1, '#3a2414');
      g.fillStyle = wood;
      g.beginPath(); g.ellipse(0, 0, r * 1.25, r * 0.85, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1c130c'; g.lineWidth = Math.max(1, r * 0.12);
      g.stroke();
      g.strokeStyle = '#4b4f55'; g.lineWidth = Math.max(1, r * 0.18);
      for (const hx of [-0.55, 0.55]) { g.beginPath(); g.moveTo(r * hx, -r * 0.78); g.lineTo(r * hx, r * 0.78); g.stroke(); }
      g.fillStyle = '#8e2a2a';
      g.beginPath(); g.arc(0, 0, r * 0.28, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }

  /** The Maelstrom Stair (docs/12 P10 #17): the painted maelstrom turning slowly over a pale-green light far below; the
   *  arena's edge while she is going down; an arrow at the screen's edge toward it from the sea about. */
  private drawStair(state: ClientState): void {
    const v = state.descent;
    if (!v) return;
    const g = this.g;
    const z = this.zoom;
    const x = this.sx(v.gate.x), y = this.sy(v.gate.y);
    const R = 260 * z, A = v.gate.r * z;
    const t = settings().reduceMotion ? 0 : this.time;
    const run = v.run;
    if (x < -A || y < -A || x > this.w + A || y > this.h + A) {
      if (!run) this.edgeArrow(x, y, '#8fe3d0');
      else this.edgeArrow(x, y, '#e07a6a');
      return;
    }
    g.save();
    const glow = g.createRadialGradient(x, y, 0, x, y, R * 1.3);
    glow.addColorStop(0, `rgba(120,230,200,${0.28 + 0.08 * Math.sin(t * 1.4)})`);
    glow.addColorStop(0.35, 'rgba(10,30,34,0.55)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y, R * 1.3, 0, Math.PI * 2); g.fill();
    const art = sprite('prop.whirlpool');
    if (art) {
      g.save();
      g.translate(x, y);
      g.rotate(-t * 0.3);
      g.globalAlpha = run ? 0.45 : 0.9; // fighting in it, the hulls must read over the water
      g.drawImage(art.img, -R, -R, R * 2, R * 2);
      g.restore();
    } else {
      g.lineWidth = Math.max(1, 2 * z);
      for (let arm = 0; arm < 5; arm++) {
        g.beginPath();
        for (let i = 0; i <= 50; i++) {
          const k = i / 50, r = R * (1 - k * 0.92), a = -t * 0.3 + (arm / 5) * Math.PI * 2 - k * Math.PI * 3;
          const px = x + Math.sin(a) * r, py = y - Math.cos(a) * r;
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.strokeStyle = 'rgba(200,225,220,0.16)';
        g.stroke();
      }
    }
    // The arena's edge while she is going down.
    if (run) {
      g.strokeStyle = 'rgba(143,227,208,0.35)';
      g.lineWidth = Math.max(1.5, 2 * z);
      g.setLineDash([14, 10]);
      g.beginPath(); g.arc(x, y, A, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  /** The tier's darkness (docs/12 P10 #17): the sea beyond her lanterns goes black, dusk or pitch. */
  private drawDescentDark(state: ClientState): void {
    const run = state.descent?.run;
    const own = state.ownDisplay;
    if (!run || !own || run.dark === 'moonlit' || run.boons.includes('lantern')) return;
    const g = this.g;
    const x = this.sx(own.x), y = this.sy(own.y);
    const inner = Math.max(120, 220 * this.zoom), outer = Math.max(this.w, this.h) * 0.75;
    const a = run.dark === 'pitch' ? 0.88 : 0.6;
    const grd = g.createRadialGradient(x, y, inner * 0.6, x, y, Math.max(inner + 40, outer));
    grd.addColorStop(0, 'rgba(2,5,8,0)');
    grd.addColorStop(0.35, `rgba(2,5,8,${a * 0.6})`);
    grd.addColorStop(1, `rgba(2,5,8,${a})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, this.w, this.h);
  }

  /** The heart of the Storm of the Century (docs/12 P10 #14): a turning dark eye with a pale rim, the lightning's
   *  reach about it, a flash now and then; off the screen, an arrow at the edge. */
  private drawStormHeart(state: ClientState): void {
    const v = state.storm;
    if (!v || v.rest > 0) return;
    const g = this.g;
    const z = this.zoom;
    const x = this.sx(v.x), y = this.sy(v.y);
    const R = v.core * z, O = v.r * z;
    if (x < -O || y < -O || x > this.w + O || y > this.h + O) {
      this.edgeArrow(x, y, '#9fd0ff');
      return;
    }
    const t = settings().reduceMotion ? 0 : this.time;
    g.save();
    // The lightning's reach.
    g.strokeStyle = 'rgba(160,200,255,0.22)';
    g.lineWidth = 1.5;
    g.setLineDash([10, 8]);
    g.beginPath(); g.arc(x, y, O, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    // The eye: dark, turning.
    const gr = g.createRadialGradient(x, y, 0, x, y, R * 1.4);
    gr.addColorStop(0, 'rgba(6,10,20,0.55)');
    gr.addColorStop(0.7, 'rgba(20,32,56,0.35)');
    gr.addColorStop(1, 'rgba(20,32,56,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, R * 1.4, 0, Math.PI * 2); g.fill();
    g.translate(x, y);
    g.rotate(t * 0.35);
    g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      g.rotate(Math.PI / 2);
      g.strokeStyle = `rgba(190,215,255,${0.28 + 0.1 * Math.sin(t * 1.3 + k)})`;
      g.lineWidth = Math.max(1.5, 4 * z);
      g.beginPath(); g.arc(0, 0, R * (0.45 + k * 0.12), 0, Math.PI * 0.9); g.stroke();
    }
    g.rotate(-t * 0.35);
    // Its pale rim, pulsing.
    const pulse = 0.5 + 0.3 * Math.sin(t * 2.1);
    g.strokeStyle = `rgba(200,228,255,${pulse})`;
    g.lineWidth = Math.max(2, 3 * z);
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    // A flash inside now and then.
    const beat = Math.floor(t * 1.7);
    if (t && (beat * 7919) % 5 === 0 && (t * 1.7) % 1 < 0.25) {
      const a0 = ((beat * 2654435761) % 628) / 100;
      g.strokeStyle = 'rgba(235,245,255,0.9)';
      g.lineWidth = Math.max(1.5, 2.5 * z);
      g.beginPath();
      let px = Math.cos(a0) * R * 0.9, py = Math.sin(a0) * R * 0.9;
      g.moveTo(px, py);
      for (let i = 1; i <= 5; i++) {
        px = px * 0.72 + ((((beat + i) * 97) % 21) - 10) * z * 3;
        py = py * 0.72 + ((((beat + i) * 61) % 21) - 10) * z * 3;
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.restore();
  }

  /** The wonders of the sea (docs/12 P10 #8), drawn where they lie: a lagoon's glow, bones, an arch, drowned spires,
   *  a boiling ring, ice, coral, singing rocks. */
  private drawWonders(state: ClientState): void {
    const near = state.wonders?.near;
    if (!near?.length) return;
    const g = this.g;
    const t = settings().reduceMotion ? 0 : this.time;
    const z = this.zoom;
    for (const w of near) {
      const x = this.sx(w.x), y = this.sy(w.y);
      const R = 200 * z;
      if (x < -R || y < -R || x > this.w + R || y > this.h + R) continue;
      const seed = w.id.charCodeAt(1) * 13 + (w.id.charCodeAt(2) || 0);
      g.save();
      g.translate(x, y);
      switch (w.kind) {
        case 'lagoon': {
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 160 * z);
          const a = 0.35 + 0.15 * Math.sin(t * 0.8 + seed);
          gr.addColorStop(0, `rgba(80,230,220,${a})`);
          gr.addColorStop(1, 'rgba(80,230,220,0)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(0, 0, 160 * z, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'bones': {
          g.strokeStyle = 'rgba(226,214,186,0.85)';
          g.lineWidth = Math.max(1.5, 3 * z);
          g.rotate(seed);
          for (let i = -4; i <= 4; i++) {
            g.beginPath(); g.arc(i * 14 * z, 0, 22 * z, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
          }
          g.beginPath(); g.moveTo(-70 * z, 0); g.lineTo(70 * z, 0); g.stroke();
          break;
        }
        case 'arch': {
          g.rotate(seed);
          g.fillStyle = '#3b3a38';
          g.strokeStyle = '#1b1a18';
          g.lineWidth = 2;
          g.beginPath(); g.arc(0, 0, 36 * z, Math.PI, 0); g.arc(0, 0, 22 * z, 0, Math.PI, true); g.closePath(); g.fill(); g.stroke();
          break;
        }
        case 'cathedral': {
          g.fillStyle = 'rgba(20,34,40,0.55)';
          for (let i = -2; i <= 2; i++) {
            g.beginPath(); g.moveTo(i * 26 * z - 9 * z, 30 * z); g.lineTo(i * 26 * z, -(40 + (2 - Math.abs(i)) * 18) * z); g.lineTo(i * 26 * z + 9 * z, 30 * z); g.fill();
          }
          const k = (t * 0.3) % 1;
          g.strokeStyle = `rgba(160,200,210,${0.4 * (1 - k)})`;
          g.lineWidth = 1.5;
          g.beginPath(); g.arc(0, 0, (30 + k * 90) * z, 0, Math.PI * 2); g.stroke();
          break;
        }
        case 'geyser': {
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70 * z);
          gr.addColorStop(0, 'rgba(255,140,60,0.45)');
          gr.addColorStop(1, 'rgba(255,140,60,0)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(0, 0, 70 * z, 0, Math.PI * 2); g.fill();
          for (let i = 0; i < 6; i++) {
            const k = ((t * 0.25 + i / 6) % 1);
            g.fillStyle = `rgba(235,235,235,${0.35 * (1 - k)})`;
            g.beginPath(); g.arc(Math.sin(i * 2.1 + seed) * 20 * z, -k * 90 * z, (10 + k * 26) * z, 0, Math.PI * 2); g.fill();
          }
          break;
        }
        case 'ice': {
          g.fillStyle = 'rgba(200,230,245,0.9)';
          g.strokeStyle = 'rgba(90,140,170,0.9)';
          g.lineWidth = 1.2;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + seed, r = 26 * z;
            const px = Math.cos(a) * r, py = Math.sin(a) * r, h = (22 + (i % 3) * 10) * z;
            g.beginPath(); g.moveTo(px - 8 * z, py); g.lineTo(px, py - h); g.lineTo(px + 8 * z, py); g.closePath(); g.fill(); g.stroke();
          }
          break;
        }
        case 'coral': {
          const cols = ['#e0605a', '#f0a050', '#c070d0', '#50c0b0', '#f0e070'];
          for (let i = 0; i < 26; i++) {
            const a = i * 2.39996 + seed, r = Math.sqrt(i / 26) * 90 * z;
            g.fillStyle = cols[i % cols.length] + '99';
            g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, (4 + (i % 3) * 2) * z, 0, Math.PI * 2); g.fill();
          }
          break;
        }
        case 'singing': {
          g.fillStyle = '#4a4a48';
          for (let i = 0; i < 4; i++) {
            const a = i * 1.7 + seed;
            g.beginPath(); g.ellipse(Math.cos(a) * 24 * z, Math.sin(a) * 24 * z, 10 * z, 7 * z, a, 0, Math.PI * 2); g.fill();
          }
          for (let i = 0; i < 3; i++) {
            const k = ((t * 0.35 + i / 3) % 1);
            g.strokeStyle = `rgba(220,220,200,${0.35 * (1 - k)})`;
            g.lineWidth = 1.2;
            g.beginPath(); g.arc(0, 0, (30 + k * 80) * z, 0, Math.PI * 2); g.stroke();
          }
          break;
        }
      }
      g.restore();
    }
  }

  /** The regatta's buoys (docs/12 P10 #5): red and white, numbered; the one she sails for rings. */
  private drawBuoys(state: ClientState): void {
    const v = state.regatta;
    if (!v || !v.buoys.length || !(v.signedUp || v.next !== null)) return;
    const g = this.g;
    const t = settings().reduceMotion ? 0 : this.time;
    const r = Math.max(6, 7 * this.zoom);
    v.buoys.forEach(([bx, by], i) => {
      const x = this.sx(bx), y = this.sy(by);
      const next = v.next === i;
      if (x < -60 || y < -60 || x > this.w + 60 || y > this.h + 60) {
        // The buoy she sails for, off the screen: an arrow at the edge points the way.
        if (next) this.edgeArrow(x, y, '#ffe08a');
        return;
      }
      if (next) {
        const k = (t * 0.8) % 1;
        g.strokeStyle = `rgba(255,224,138,${0.8 * (1 - k)})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, r * (1.4 + k * 2.2), 0, Math.PI * 2); g.stroke();
      }
      const bob = Math.sin(t * 1.6 + i) * r * 0.08;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.3, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b3261e';
      g.beginPath(); g.arc(x, y + bob, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#efe6d0';
      g.beginPath(); g.arc(x, y + bob, r, -Math.PI * 0.25, Math.PI * 0.25); g.lineTo(x, y + bob); g.fill();
      g.beginPath(); g.arc(x, y + bob, r, Math.PI * 0.75, Math.PI * 1.25); g.lineTo(x, y + bob); g.fill();
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y + bob, r, 0, Math.PI * 2); g.stroke();
      g.font = `700 ${Math.round(Math.max(11, r * 1.1))}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillStyle = next ? '#ffe08a' : '#f0e6cc';
      g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 3;
      const label = i === 0 ? '⚑' : String(i);
      g.strokeText(label, x, y - r * 1.2);
      g.fillText(label, x, y - r * 1.2);
    });
  }

  /** An arrow on the screen's edge toward a point beyond it. */
  private edgeArrow(x: number, y: number, color: string): void {
    const g = this.g;
    const cx = this.w / 2, cy = this.h / 2;
    const a = Math.atan2(y - cy, x - cx);
    const m = 34;
    const k = Math.min(Math.abs((cx - m) / Math.cos(a) || 1e9), Math.abs((cy - m) / Math.sin(a) || 1e9));
    const ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
    g.save();
    g.translate(ex, ey);
    g.rotate(a);
    g.fillStyle = color;
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-3, 0); g.lineTo(-8, 10); g.closePath();
    g.stroke(); g.fill();
    g.restore();
  }

  /** Good omens alongside (docs/16 #9): dolphins leaping in the bow wave, a humpback abeam, orcas in the wake —
   *  beside every ship that has them, as the orca calves are. */
  private drawPods(state: ClientState, ships: DrawShip[]): void {
    const g = this.g;
    const t = settings().reduceMotion ? 0 : this.time;
    for (const s of ships) {
      const pod = state.pets.get(s.id)?.pod;
      if (!pod || s.sinkT > 0) continue;
      const cls = SHIP_CLASSES[s.classId];
      const x = this.sx(s.x), y = this.sy(s.y);
      if (x < -300 || y < -300 || x > this.w + 300 || y > this.h + 300) continue;
      const L = cls.length * this.zoom, B = cls.beam * this.zoom;
      g.save();
      g.translate(x, y);
      g.rotate(s.h);
      if (pod === 'dolphins') {
        // Five of them riding the bow wave and along her sides, each leaping in its turn.
        // Drawn larger than life (as the pets are) so they read at sea: each leaps in its turn, white water where it
        // breaks the surface and falls back.
        const spots: [number, number][] = [[-1.5, -0.62], [1.5, -0.55], [-2.3, -0.18], [2.4, -0.05], [0.25, -0.86]];
        const base = Math.max(15, 6.5 * this.zoom);
        spots.forEach(([bx, by], i) => {
          const ph = t * 1.6 + i * 1.3;
          const leap = Math.max(0, Math.sin(ph));
          const len = base * (1 + leap * 0.3);
          const px = bx * B * 0.6 + Math.sin(t * 0.8 + i) * B * 0.12, py = by * L - Math.cos(ph) * L * 0.05;
          g.save();
          g.translate(px, py);
          // The wake it cuts: two short white strokes behind it.
          g.strokeStyle = `rgba(225,235,240,${0.25 + 0.35 * leap})`;
          g.lineWidth = Math.max(1, base * 0.08);
          g.beginPath();
          g.moveTo(-base * 0.12, base * 0.45);
          g.lineTo(-base * 0.3, base * 1.2);
          g.moveTo(base * 0.12, base * 0.45);
          g.lineTo(base * 0.3, base * 1.2);
          g.stroke();
          if (leap < 0.25 || (leap > 0.9 && Math.cos(ph) < 0)) {
            g.fillStyle = `rgba(235,244,248,${0.55 - leap * 0.4})`;
            g.beginPath();
            g.ellipse(0, len * 0.1, len * 0.42, len * 0.28, 0, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 0.55 + 0.45 * Math.min(1, leap * 2);
          if (leap > 0.3) {
            g.fillStyle = 'rgba(0,0,0,0.25)';
            g.beginPath();
            g.ellipse(len * 0.12, len * 0.18, len * 0.14, len * 0.42, 0, 0, Math.PI * 2);
            g.fill();
          }
          drawDolphin(g, len, t, s.id + i);
          g.restore();
        });
      } else if (pod === 'humpback') {
        const len = Math.max(46, 17 * this.zoom), dive = 0.55 + 0.45 * Math.sin(t * 0.45 + s.id);
        g.translate(B * 0.5 + len * 0.35 + 6 * this.zoom, -L * 0.05 + Math.sin(t * 0.3) * L * 0.05);
        // The white water about her back as she rolls, and her spout when she breathes.
        g.fillStyle = `rgba(222,234,240,${0.12 + 0.2 * dive})`;
        g.beginPath();
        g.ellipse(0, 0, len * 0.3, len * 0.6, 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.45 + 0.55 * dive;
        drawBeast(g, 'humpback', len, len * 0.28, t, s.id);
        const breath = (t * 0.45 + s.id) % (Math.PI * 2);
        if (breath > 1.2 && breath < 2.2) {
          const k = 1 - Math.abs(breath - 1.7) / 0.5;
          g.globalAlpha = 0.7 * k;
          g.fillStyle = '#eef4f7';
          for (let i = 0; i < 5; i++) {
            g.beginPath();
            g.arc(Math.sin(i * 2.1) * len * 0.05, -len * (0.3 + i * 0.05 * k), len * (0.04 + 0.02 * i) * (0.6 + k), 0, Math.PI * 2);
            g.fill();
          }
        }
      } else {
        // Three orcas in her wake, weaving.
        for (let i = 0; i < 3; i++) {
          const len = Math.max(18, 8 * this.zoom), dive = 0.55 + 0.45 * Math.sin(t * 0.8 + i * 2 + s.id);
          g.save();
          g.translate((i - 1) * B * 0.9 + Math.sin(t * 0.9 + i) * B * 0.2, L * (0.62 + i * 0.12));
          g.globalAlpha = 0.35 + 0.65 * dive;
          drawBeast(g, 'orca', len, len * 0.3, t, s.id + i);
          g.restore();
        }
      }
      g.restore();
    }
  }

  /** The orca calves in their captains' wakes (docs/12 P10 #2): on the starboard quarter, surfacing and diving. */
  private drawCompanions(state: ClientState, ships: DrawShip[]): void {
    const g = this.g;
    for (const s of ships) {
      const pet = state.pets.get(s.id);
      if (!pet?.orca || s.sinkT > 0) continue;
      const cls = SHIP_CLASSES[s.classId];
      const x = this.sx(s.x), y = this.sy(s.y);
      if (x < -200 || y < -200 || x > this.w + 200 || y > this.h + 200) continue;
      const clen = calfLength(pet.orca) * this.zoom;
      const t = settings().reduceMotion ? 0 : this.time;
      // It rises and dives in a slow rhythm, weaving a little on the ship's quarter.
      const dive = 0.55 + 0.45 * Math.sin(t * 0.7 + s.id);
      const weave = Math.sin(t * 0.9 + s.id * 1.7) * cls.beam * 0.25 * this.zoom;
      g.save();
      g.translate(x, y);
      g.rotate(s.h);
      g.translate(cls.beam * 0.5 * this.zoom + clen * 0.45 + 3 * this.zoom + weave, cls.length * 0.12 * this.zoom);
      g.rotate(Math.sin(t * 0.9 + s.id * 1.7) * 0.12);
      g.globalAlpha = 0.35 + 0.65 * dive;
      drawBeast(g, 'white_orca', clen, clen * 0.3, t, s.id);
      g.restore();
    }
  }

  /** The pets on deck (docs/12 P10 #3): a cat on the stern, a parrot on a yard, a monkey in the shrouds, a dog aft. */
  private drawDeckPets(state: ClientState, ships: DrawShip[]): void {
    const g = this.g;
    for (const s of ships) {
      const pet = state.pets.get(s.id)?.deck;
      if (!pet || s.sinkT > 0 || (s.flags & SF.HIDDEN)) continue;
      const cls = SHIP_CLASSES[s.classId];
      const x = this.sx(s.x), y = this.sy(s.y);
      if (x < -100 || y < -100 || x > this.w + 100 || y > this.h + 100) continue;
      const u = Math.max(1.6, this.zoom * 1.1); // a pet's size on screen (drawn larger than life to be seen)
      const t = settings().reduceMotion ? 0 : this.time;
      const L = cls.length * this.zoom, B = cls.beam * this.zoom;
      g.save();
      g.translate(x, y);
      g.rotate(s.h);
      switch (pet) {
        case 'cat': {
          g.translate(0, L * 0.34);
          g.fillStyle = '#141414';
          g.beginPath(); g.ellipse(0, 0, u * 1.1, u * 1.6, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(0, -u * 1.7, u * 0.8, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#141414'; g.lineWidth = u * 0.45; g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, u * 1.4); g.quadraticCurveTo(u * 1.6 * Math.sin(t * 2), u * 2.4, u * 1.2, u * 2.8); g.stroke();
          g.fillStyle = '#e8c46a';
          g.fillRect(-u * 0.4, -u * 1.9, u * 0.22, u * 0.22); g.fillRect(u * 0.18, -u * 1.9, u * 0.22, u * 0.22);
          break;
        }
        case 'parrot': {
          g.translate(B * 0.32 + Math.sin(t * 3) * u * 0.2, -L * 0.1);
          g.fillStyle = '#b3261e';
          g.beginPath(); g.ellipse(0, 0, u * 0.8, u * 1.3, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#2f7d4f';
          g.beginPath(); g.ellipse(u * 0.5, u * 0.2, u * 0.45, u * 1.0, 0.3, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#e8c46a';
          g.beginPath(); g.arc(0, -u * 1.3, u * 0.35, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'monkey': {
          g.translate(-B * 0.3, -L * 0.18 + Math.sin(t * 1.5) * u);
          g.fillStyle = '#6b4a2b';
          g.beginPath(); g.ellipse(0, 0, u, u * 1.2, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(0, -u * 1.3, u * 0.75, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#9b2a1a';
          g.fillRect(-u * 0.5, -u * 2.1, u, u * 0.45);
          g.strokeStyle = '#6b4a2b'; g.lineWidth = u * 0.35; g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, u); g.quadraticCurveTo(-u * 2, u * 2, -u * 1.4 + Math.sin(t * 2) * u * 0.5, u * 2.8); g.stroke();
          break;
        }
        case 'dog': {
          g.translate(-B * 0.12, L * 0.27);
          g.fillStyle = '#8a8272';
          g.beginPath(); g.ellipse(0, 0, u * 1.1, u * 2.0, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(0, -u * 2.2, u * 0.8, u * 0.95, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#4a4438';
          g.beginPath(); g.ellipse(-u * 0.7, -u * 2.3, u * 0.3, u * 0.55, -0.4, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(u * 0.7, -u * 2.3, u * 0.3, u * 0.55, 0.4, 0, Math.PI * 2); g.fill();
          break;
        }
      }
      g.restore();
    }
  }

  /** The carcasses afloat (docs/12 P4), in their blood. */
  private drawCarcasses(state: ClientState): void {
    const g = this.g;
    for (const c of state.carcasses) {
      const cls = SHIP_CLASSES[BEASTS[c.beast].cls];
      const x = this.sx(c.x), y = this.sy(c.y);
      const len = cls.length * this.zoom, beam = cls.beam * this.zoom;
      if (x < -len * 2 || y < -len * 2 || x > this.w + len * 2 || y > this.h + len * 2) continue;
      g.save();
      g.translate(x, y);
      g.rotate(c.h + Math.sin(this.time * 0.3 + c.id) * 0.05);
      drawCarcass(g, c.beast, len, beam, c.progress, c.blood, this.time, c.id);
      g.restore();
    }
  }

  private drawBeastLabel(s: DrawShip, state: ClientState, beast: BeastId, isTarget: boolean): void {
    const g = this.g;
    const cls = SHIP_CLASSES[s.classId];
    const def = BEASTS[beast];
    const lvl = s.info?.shipLevel ?? def.level[0];
    const threat = levelThreat(state, s.classId, lvl);
    const col = THREAT_COLOR[threat];
    const badge = threat === 'skull' ? '☠' : String(lvl);
    const name = def.name[lang() === 'ru' ? 1 : 0];
    const x = this.sx(s.x), y = this.sy(s.y) - (Math.max(cls.length, 10) * this.zoom) / 2 - 14;
    g.font = '700 10px Inter, sans-serif';
    const pillW = g.measureText(badge).width + 8;
    g.font = '600 11px Inter, sans-serif';
    const nameW = g.measureText(name).width;
    const total = pillW + 4 + nameW;
    const px = clamp(x - total / 2, 2, Math.max(2, this.w - total - 2));
    g.fillStyle = 'rgba(8,10,14,0.78)';
    roundRect(g, px, y - 10, pillW, 13, 3);
    g.fill();
    g.lineWidth = s.info?.elite ? 2 : 1;
    g.strokeStyle = s.info?.elite ? '#e8c46a' : col;
    g.stroke();
    g.textAlign = 'center';
    g.font = '700 10px Inter, sans-serif';
    g.fillStyle = col;
    g.fillText(badge, px + pillW / 2, y);
    g.textAlign = 'left';
    g.font = '600 11px Inter, sans-serif';
    g.fillStyle = '#000';
    g.fillText(name, px + pillW + 5, y + 1);
    g.fillStyle = def.predator ? '#e0a08a' : '#bcd3dc';
    g.fillText(name, px + pillW + 4, y);
    g.textAlign = 'center';
    const w = 40;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(x - w / 2 - 1, y + 5, w + 2, 5);
    g.fillStyle = '#b23a3a';
    g.fillRect(x - w / 2, y + 6, w * clamp(s.hull, 0, 1), 3);
    if (isTarget) {
      const r = Math.max(cls.length, 10) * this.zoom * 0.62;
      g.strokeStyle = hexA(col, 0.85);
      g.lineWidth = this.markRange === 'in' ? 2 : 1.5;
      g.setLineDash(this.markRange === 'in' ? [] : [6, 5]);
      g.beginPath();
      g.ellipse(this.sx(s.x), this.sy(s.y), r, r, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      this.rangeWord(this.sx(s.x), this.sy(s.y) + r);
    }
  }

  /** A captain's colours after her name (docs/24 D1): a little cloth on a pole, 15×11 from (x, y) at its top-left —
   *  white for neutral, black with a red bar for the pirate flag, her city's colours — and, with boarding off (C1), a
   *  grapnel's ring struck through beside it. */
  private colourFlag(c: ShipColours, x: number, y: number): void {
    const g = this.g;
    const { c: cloth, s: stripe } = shipCloth(c);
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(x - 1, y - 1, 15, 13);
    g.fillStyle = '#8a7a5c';
    g.fillRect(x, y, 2, 12);
    g.beginPath();
    g.moveTo(x + 2, y);
    g.lineTo(x + 13, y);
    g.lineTo(x + 11, y + 4);
    g.lineTo(x + 13, y + 8);
    g.lineTo(x + 2, y + 8);
    g.closePath();
    g.fillStyle = cloth;
    g.fill();
    g.strokeStyle = c.kind === 'neutral' ? stripe : 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = stripe;
    if (c.kind === 'pirate') g.fillRect(x + 6, y + 1, 2, 7);
    else if (c.kind === 'faction') g.fillRect(x + 2, y + 5, 10, 2);
    if (c.noBoard) {
      const bx = x + 20, by = y + 5;
      g.strokeStyle = '#e6a04a';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(bx, by, 4.5, 0, Math.PI * 2);
      g.moveTo(bx - 3.2, by + 3.2);
      g.lineTo(bx + 3.2, by - 3.2);
      g.stroke();
    }
    g.restore();
  }

  /** «в дальности» / «далеко» under her mark's ring (owner, 2026-10-07: she must see when her guns reach). */
  private rangeWord(x: number, y: number): void {
    if (!this.markRange) return;
    const g = this.g;
    const word = L(this.markRange === 'in' ? 'range.in' : 'range.far');
    g.save();
    g.font = '600 11px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillStyle = 'rgba(0,0,0,0.75)';
    g.fillText(word, x + 1, y + 5);
    g.fillStyle = this.markRange === 'in' ? '#c9e3a0' : '#d9b48a';
    g.fillText(word, x, y + 4);
    g.restore();
  }

  private drawLabel(s: DrawShip, state: ClientState, boardTarget: boolean, isTarget = false): void {
    const g = this.g;
    if (!s.info || s.flags & SF.HIDDEN) return;
    const cls = SHIP_CLASSES[s.classId];
    // The beasts of the sea (docs/12 P4): a level in its frame, the name, and a bar of its strength.
    const beast = beastOfClass(s.classId);
    if (beast) {
      if (s.flags & SF.SUBMERGED) return;
      this.drawBeastLabel(s, state, beast, isTarget && !boardTarget);
      return;
    }
    // Monsters and their parts: the boss panel names them; over the water only a thin bar of their strength.
    if (cls.monster) {
      if (s.flags & SF.SUBMERGED) return;
      // Whole limbs carry no bar: eight full bars over the arms of a kraken are only clutter.
      if (s.hull >= 0.995 && s.info.npcRole === 'boss') return;
      const bx = this.sx(s.x), by = this.sy(s.y) - (Math.min(cls.length, 60) * this.zoom) / 2 - 8;
      const w = Math.min(70, 26 + cls.length * 0.3);
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(bx - w / 2 - 1, by - 1, w + 2, 5);
      g.fillStyle = '#b23a3a';
      g.fillRect(bx - w / 2, by, w * clamp(s.hull, 0, 1), 3);
      return;
    }
    // A ship past the screen's edge has its threat mark; its name is not drawn as a stub at the border, and a
    // ship on screen near an edge keeps its name inside it.
    const sxs = this.sx(s.x);
    if (sxs < 0 || sxs > this.w) return;
    let x = sxs;
    let y = this.sy(s.y) - (cls.length * this.zoom) / 2 - 16;
    const hostile = (s.flags & SF.HOSTILE) !== 0;
    const info = s.info;
    const faction = info.faction !== 'player' ? FACTIONS[info.faction] : null;
    g.textAlign = 'center';
    g.font = '600 11px Inter, sans-serif';
    // The faction's sign leads every NPC's name (§11.1): never the lantern's colour alone.
    // NPC ships' names read in the player's language, as in every toast about them; captains name their own.
    const named = info.named ? namedLabel(info.named) : null;
    const label = info.isPlayer ? `${info.captainName} · ${info.name}` : named ? `☠ ${named.name}` : `${faction ? FACTION_SIGN[info.faction as FactionId] + ' ' : ''}${placeName(info.name)}`;
    const cb = settings().colorblind;
    const role = info.npcRole && hasRole(info.npcRole) ? L(`role.${info.npcRole}`) : info.npcRole;
    const tag = guardTag(state, s.id) ?? (named ? named.tag : info.isPlayer ? `${info.title ? serverText(info.title) + ' · ' : ''}${L('level', { n: info.level ?? 1 })}${info.wanted ? ' · ' + '☠'.repeat(info.wanted) : ''}` : info.npcRole === 'boss' ? L(isZoneBossClass(info.classId) ? 'zboss' : 'boss') : cls.monster ? L('hulk') : L('tag.npc', { cls: cls.name, faction: faction?.short ?? '', role: role ?? '' }).replace(/·\s*·/g, '·').replace(/\s+·?\s*$/, '').replace(/\s{2,}/g, ' '));
    // Her level (canon D12) leads the name as WoW's does: the number in a frame coloured by how far she stands above
    // your own ship, a gold frame for an elite built for a company, a skull when no shot of yours would tell.
    // Her own ships from the island's shipyard (docs/15) sail on her side: their level, never a threat's skull.
    const ownShip = info.npcRole === 'escort' && !!state.self?.fleet?.escorts.some((e) => e.own && e.atSea && e.name === info.name);
    const threat = info.shipLevel ? (ownShip ? 'even' : levelThreat(state, info.classId, info.shipLevel)) : null;
    const badge = info.shipLevel ? (threat === 'skull' ? '☠' : String(info.shipLevel)) : '';
    g.font = '700 10px Inter, sans-serif';
    const pillW = badge ? g.measureText(badge).width + 8 : 0;
    const badgeW = badge ? pillW + 4 : 0;
    g.font = '600 11px Inter, sans-serif';
    // Both lines keep inside the screen: the name and, under it, the (often longer) class line.
    // Her colours (docs/24 D1): a little flag after a captain's name, its words on the line under it.
    const col = info.isPlayer ? shipColours(s.flags, info) : null;
    const flagW = col ? (col.noBoard ? 29 : 17) : 0;
    const nameW = g.measureText(label).width + badgeW + flagW;
    g.font = '10px Inter, sans-serif';
    const lfText = info.isPlayer ? lfgLabel(info.lfg) : null;
    const lfW = lfText ? g.measureText(lfText).width + 16 : 0; // her pennant for company (docs/16 #31)
    const half = Math.max(nameW, g.measureText(tag).width, lfW) / 2 + 6;
    g.font = '600 11px Inter, sans-serif';
    x = clamp(x, half, Math.max(half, this.w - half));
    // Never on another ship's name: step up above it (the Admiral's Eye line makes a taller box).
    const tall = state.self?.inspect.some((i) => i.id === s.id) ? 36 : 24;
    const over = info.isPlayer && info.lfg ? 12 : 0; // her pennant for company rides over the name (docs/16 #31)
    for (let k = 0; k < 4; k++) {
      const hit = this.labelBoxes.find((b) => x - half < b.r && x + half > b.l && y - 12 - over < b.b && y + tall > b.t);
      if (!hit) break;
      y = hit.t - tall - 3;
    }
    this.labelBoxes.push({ l: x - half, r: x + half, t: y - 12 - over, b: y + tall });
    const lx = x + (badgeW - flagW) / 2;
    if (badge) {
      const px = x - nameW / 2, py = y - 10, ph = 13;
      const col = THREAT_COLOR[threat!];
      g.fillStyle = 'rgba(8,10,14,0.78)';
      roundRect(g, px, py, pillW, ph, 3);
      g.fill();
      g.lineWidth = info.elite ? 2 : 1;
      g.strokeStyle = info.elite ? '#e8c46a' : col;
      g.stroke();
      g.font = '700 10px Inter, sans-serif';
      g.fillStyle = col;
      g.fillText(badge, px + pillW / 2, py + 10);
      g.font = '600 11px Inter, sans-serif';
    }
    g.fillStyle = '#000';
    g.fillText(label, lx + 1, y + 1);
    g.fillStyle = cbColor(cb, hostile ? '#e0776b' : info.isPlayer ? '#cfe0f2' : faction ? faction.lantern : '#ccc');
    g.fillText(label, lx, y);
    if (col) this.colourFlag(col, lx + g.measureText(label).width / 2 + 5, y - 10);
    // Looking for company (docs/16 #31): her pennant over the name, with the goal and the levels asked.
    const lf = info.isPlayer ? parseLfgTag(info.lfg) : null;
    if (lf) {
      const text = lfgLabel(info.lfg)!;
      g.font = '600 10px Inter, sans-serif';
      const tw = g.measureText(text).width;
      const fx = x - tw / 2 - 6, fy = y - 13;
      g.fillStyle = 'rgba(8,10,14,0.72)';
      roundRect(g, fx - 4, fy - 10, tw + 16, 13, 3);
      g.fill();
      g.fillStyle = '#e8dcc0';
      g.fillRect(fx, fy - 8, 1, 9);
      g.fillStyle = LFG_GOAL_DEFS[lf.goal].color;
      g.fillRect(fx + 1, fy - 8, 6, 4);
      g.fillText(text, x + 4, fy);
      g.font = '600 11px Inter, sans-serif';
    }
    g.font = '10px Inter, sans-serif';
    g.fillStyle = 'rgba(180,180,180,0.8)';
    const marks = info.isPlayer
      ? `${col?.label ? ` · ${col.label}` : ''}${col?.noBoard ? ` · ${LF('mark.noBoard')}` : ''}${s.flags & SF.SHAME ? L('shame') : ''}${s.flags & SF.BOUNTY ? L('bounty') : ''}${s.flags & SF.DUEL ? L('duel') : ''}${s.flags & SF.GUARDED ? L('guarded') : ''}`
      : '';
    if (s.flags & SF.SHAME) g.fillStyle = 'rgba(224,119,107,0.9)';
    g.fillText(tag + marks + (s.flags & SF.SURRENDERED ? L('struck') : ''), x, y + 11);
    // Hull and sails bars.
    const w = 46;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(x - w / 2 - 1, y + 15, w + 2, 7);
    g.fillStyle = s.hull > 0.5 ? '#9b5a44' : s.hull > 0.25 ? '#b0703a' : '#c23d33';
    g.fillRect(x - w / 2, y + 16, w * clamp(s.hull, 0, 1), 2.5);
    g.fillStyle = '#b3ab96';
    g.fillRect(x - w / 2, y + 19, w * clamp(s.sails, 0, 1), 2);
    // Admiral's Eye: what your glass reads of her.
    const eye = state.self?.inspect.find((i) => i.id === s.id);
    if (eye) {
      g.font = '10px Inter, sans-serif';
      g.fillStyle = 'rgba(0,0,0,0.8)';
      const line = L('eye', { hull: eye.hull, crew: eye.crew, morale: eye.morale, port: eye.port ? '●' : '○', stbd: eye.starboard ? '●' : '○' });
      g.fillText(line, x + 1, y + 34);
      g.fillStyle = '#d9c9a0';
      g.fillText(line, x, y + 33);
    }
    // The target (canon D12): a thin ring under her in the colour of the danger she is to you.
    if (isTarget && !boardTarget) {
      const t = info.shipLevel ? levelThreat(state, info.classId, info.shipLevel) : 'even';
      const r = cls.length * this.zoom * 0.62;
      g.strokeStyle = hexA(THREAT_COLOR[t], 0.85);
      // In the close fight's band the ring is drawn whole (her gun captains fire), dashed while she is too far.
      g.lineWidth = this.markRange === 'in' ? 2 : 1.5;
      g.setLineDash(this.markRange === 'in' ? [] : [6, 5]);
      g.beginPath();
      g.ellipse(this.sx(s.x), this.sy(s.y), r, r, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      this.rangeWord(this.sx(s.x), this.sy(s.y) + r);
    }
    if (boardTarget || s.flags & SF.MARKED) {
      // A target ring: four brackets round her, not a dotted circle.
      g.strokeStyle = boardTarget ? 'rgba(224,184,98,0.9)' : 'rgba(208,106,94,0.9)';
      g.lineWidth = 2;
      const rr = cls.length * this.zoom * 0.7, cx0 = this.sx(s.x), cy0 = this.sy(s.y);
      for (let q = 0; q < 4; q++) {
        g.beginPath();
        g.arc(cx0, cy0, rr, q * (Math.PI / 2) - 0.35, q * (Math.PI / 2) + 0.35);
        g.stroke();
      }
    }
  }
}

function hexA(color: string, a: number): string {
  if (color.startsWith('rgba')) return color.replace(/,\s*[\d.]+\)$/, `,${a})`);
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** '#0c141c' → [r, g, b] in 0..1. */
function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * How far a ship heels, −1 (to port) … 1 (to starboard): the wind's push across her (strongest on the beam) times
 * the canvas set, less for heavier hulls; a flooded hold adds a steady list; the swell rocks her a little.
 */
export function shipHeel(heading: number, windDir: number, windStrength: number, sail: number, tier: number, water: number, swell: number): number {
  const across = Math.sin(windDir - heading); // > 0: the wind blows toward her starboard side
  const push = across * clamp(windStrength, 0, 1.5) * sail * (1.2 / (0.6 + tier * 0.4));
  const list = water * 0.35;
  return clamp(push * 0.8 + Math.sign(push || 1) * list + swell * 0.04 * (0.5 + windStrength), -1, 1);
}

/** How far a ship of this class and level stands above your own (canon D12), by the levels both fight at. */
export function levelThreat(state: ClientState, classId: ShipClassId, level: number): Threat {
  const mine = state.self ? combatLevelOf(state.self.loadout.classId, shipLevelOf(state.self.loadout)) : 1;
  return threatOf(mine, combatLevelOf(classId, level));
}

/** A rounded rectangle path (the level's frame). */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The struck part in a few strokes (docs/16 #2), about 14 px across, centred on (x, y). */
export function critIcon(g: CanvasRenderingContext2D, part: CritPart, x: number, y: number, color: string): void {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  switch (part) {
    case 'rudder': {
      // The ship's wheel: a rim, a hub and eight spokes with their handles.
      g.arc(0, 0, 5, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.moveTo(Math.cos(a) * 1.5, Math.sin(a) * 1.5);
        g.lineTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5);
      }
      g.stroke();
      break;
    }
    case 'mast': {
      // A mast snapped: the stump, the broken top leaning away, a yard across.
      g.moveTo(-1, 7);
      g.lineTo(-1, -1);
      g.moveTo(0.5, -2);
      g.lineTo(5, -7);
      g.moveTo(-6, 2);
      g.lineTo(4, 2);
      g.stroke();
      g.beginPath();
      g.moveTo(-5, -1);
      g.lineTo(-1, -7);
      g.lineTo(-1, -1);
      g.closePath();
      g.fill();
      break;
    }
    case 'powder': {
      // A keg with its hoops, and the spark that finds it.
      g.ellipse(-1, 1.5, 4.5, 5.5, 0, 0, Math.PI * 2);
      g.moveTo(-5.2, -1);
      g.lineTo(3.2, -1);
      g.moveTo(-5.2, 4);
      g.lineTo(3.2, 4);
      g.stroke();
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, r = i % 2 ? 1.2 : 3;
        g.lineTo(4 + Math.cos(a) * r, -5 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      break;
    }
    case 'gun': {
      // A barrel off its carriage.
      g.lineWidth = 3.2;
      g.moveTo(-6, 2);
      g.lineTo(5, -3);
      g.stroke();
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(-3, 5, 2.2, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case 'fire': {
      g.moveTo(0, 7);
      g.bezierCurveTo(-6, 5, -5, -1, -1, -7);
      g.bezierCurveTo(0, -2, 5, -1, 4, 3);
      g.bezierCurveTo(4, 5.5, 2, 7, 0, 7);
      g.fill();
      break;
    }
    case 'leak':
    case 'breach': {
      // Water coming in: a drop, and for a breach a jagged split above it.
      g.moveTo(0, -4);
      g.bezierCurveTo(4, 1, 4, 6, 0, 6);
      g.bezierCurveTo(-4, 6, -4, 1, 0, -4);
      g.fill();
      if (part === 'breach') {
        g.beginPath();
        g.moveTo(-6, -6);
        g.lineTo(-3, -4);
        g.lineTo(0, -7);
        g.lineTo(3, -4);
        g.lineTo(6, -6);
        g.stroke();
      }
      break;
    }
  }
  g.restore();
}
