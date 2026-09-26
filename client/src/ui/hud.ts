// In-game HUD: captain, ship condition, combat (ammo, reloads, abilities), navigation (wind, sails),
// minimap, prompts, toasts, banners and chat.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { WANTED_TITLES } from '../../../shared/src/data/factions.ts';
import { AMMO, AMMO_IDS, MOUNTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { isNight, timeOfDay } from '../../../shared/src/constants.ts';
import { clamp, headingVec } from '../../../shared/src/math.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { activeTalents } from '../../../shared/src/data/talents.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { cargoVolume, tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { seasonName } from '../../../shared/src/world/worldgen.ts';
import { assetUrl } from '../assets.ts';
import type { ClientState } from '../state.ts';
import { $, bar, esc, fmt, knots } from './dom.ts';

export class Hud {
  private lastCaptainKey = '';
  private lastShipKey = '';
  private lastCombatKey = '';
  private toastsEl = $('toasts');
  private bannerTimer = 0;
  private minimap = $('minimap') as HTMLCanvasElement;
  onAbility: (id: string) => void = () => {};
  onAmmo: (id: string) => void = () => {};
  onTalent: (id: string) => void = () => {};

  show(on: boolean): void {
    $('hud').classList.toggle('hidden', !on);
  }

  update(state: ClientState, prompt: string): void {
    const self = state.self, you = state.you;
    if (!self || !you) return;
    const cap = CAPTAINS[self.captain];

    // Captain block (only re-rendered when something changes).
    const ckey = `${self.level}|${self.xp}|${self.gold}|${self.wanted}|${self.talentPoints}`;
    if (ckey !== this.lastCaptainKey) {
      this.lastCaptainKey = ckey;
      const url = assetUrl(cap.portrait);
      $('hud-captain').innerHTML = `
        <div class="hud-portrait" style="background-image:${url ? `url('${url}')` : 'none'}"></div>
        <div style="flex:1">
          <div class="hud-name">${esc(self.name)}</div>
          <div class="row"><span class="lbl">${esc(cap.archetype)} · Lv ${self.level}</span><span class="gold val">${fmt(self.gold)} ⛁</span></div>
          ${bar('xp', self.xp / Math.max(1, self.xpNext))}
          <div class="row"><span class="wanted" title="${esc(WANTED_TITLES[self.wanted])}">${self.wanted ? '☠'.repeat(self.wanted) + ' ' + esc(WANTED_TITLES[self.wanted]) : '<span class="muted">Unknown to the law</span>'}</span>
          ${self.talentPoints > 0 ? `<span class="gold">[T] ${self.talentPoints} talent pt</span>` : ''}</div>
        </div>`;
    }

    // Ship condition.
    const cls = SHIP_CLASSES[self.loadout.classId];
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1, state.ownStats?.materialVolumeMul ?? 1, state.ownStats?.provisionVolumeMul ?? 1, state.ownStats?.cursedVolumeMul ?? 1);
    const holdMax = state.ownStats?.holdVolume ?? cls.holdVolume;
    const skey = `${Math.round(you.water * 50)}|${you.leaks}|${you.station}|${self.curse}|${you.hull}|${you.sails}|${you.crew}|${you.morale}|${Math.round(you.spd * 10)}|${you.sailT}|${Math.round(you.sail * 4)}|${vol.toFixed(1)}|${you.rudderHp}|${you.flags}|${Math.round(you.sanity)}|${Math.round(you.dread)}|${self.company.unrest}`;
    if (skey !== this.lastShipKey) {
      this.lastShipKey = skey;
      const steps = [0, 0.25, 0.5, 0.75, 1].slice(1).map((v) => `<span class="${you.sail >= v - 0.01 ? 'on' : ''} ${Math.abs(you.sailT - v) < 0.01 ? 'target' : ''}"></span>`).join('');
      $('hud-ship').innerHTML = `
        <div class="row"><b style="font-family:var(--serif);font-size:16px">${esc(self.loadout.name)}</b><span class="lbl">${esc(cls.name)}</span></div>
        <div class="row"><span class="lbl">Hull</span><span class="val">${fmt(you.hull)} / ${fmt(you.hullMax)}</span></div>${bar('hull', you.hull / you.hullMax)}
        <div class="row"><span class="lbl">Sails</span><span class="val">${fmt(you.sails)} / ${fmt(you.sailsMax)}${you.rudderHp < 0.99 ? ` · rudder ${Math.round(you.rudderHp * 100)}%` : ''}</span></div>${bar('sails', you.sails / you.sailsMax)}
        <div class="row"><span class="lbl">Crew</span><span class="val">${you.crew} / ${you.crewMax}</span></div>${bar('crew', you.crew / you.crewMax)}
        ${you.water > 0.01 || you.leaks ? `<div class="row"><span class="lbl" style="color:var(--xp)">Water</span><span class="val">${Math.round(you.water * 100)}%${you.leaks ? ` · ${you.leaks} leak${you.leaks > 1 ? 's' : ''}` : ''}${you.water > 0.4 ? ' · listing' : ''}</span></div>${bar('crew', you.water)}` : ''}
        <div class="row"><span class="lbl">Orders [G]</span><span class="val">${esc({ balanced: 'Balanced', gunnery: 'Guns', sailing: 'Braces', damage_control: 'Damage control' }[you.station])}</span></div>
        <div class="row"><span class="lbl">Morale</span><span class="val">${you.morale}</span></div>${bar('morale', you.morale / 100)}
        ${you.sanity < 99.5 ? `<div class="row" title="The crew's nerve. The deep, the dark, cursed cargo and dead shipmates wear it down; rum, dreamleaf and a port restore it."><span class="lbl" style="color:${you.sanity > 50 ? 'var(--fog)' : 'var(--bad)'}">Sanity</span><span class="val">${Math.round(you.sanity)} · ${esc(sanityWord(you.sanity))}</span></div>${bar('sanity', you.sanity / 100)}` : ''}
        ${self.company.unrest ? `<div class="row" title="Low loyalty and low morale breed mutiny. Pay, rum, a fair share or a port will calm them. [O] crew"><span class="lbl" style="color:var(--bad)">Crew</span><span class="val" style="color:var(--bad)">${esc(self.company.unrest)}</span></div>` : ''}
        ${self.captain === 'drowned' ? `<div class="row" title="Dread: paid for miracles. Grows as you bleed, kill and sail in the dark. At 80 the Call: +20% power, but the crew hears it."><span class="lbl" style="color:var(--turq)">Dread</span><span class="val" style="color:var(--turq)">${Math.round(you.dread)}${you.dread >= 80 ? ' · THE CALL' : ''}</span></div>${bar('dread', you.dread / 100)}` : ''}
        <div class="row"><span class="lbl">Hold</span><span class="val">${vol.toFixed(0)} / ${holdMax.toFixed(0)}${self.cargo.provisions ? ` · food ${Math.floor(self.cargo.provisions)}` : ' · <span style="color:var(--bad)">no food</span>'}</span></div>
        ${self.curse >= 25 ? `<div class="row"><span class="lbl" style="color:var(--turq)">Curse</span><span class="val" style="color:var(--turq)">stage ${self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1} · ${self.curse}</span></div>` : ''}
        <div class="row" style="margin-top:4px"><span class="lbl">Sail [W/S]</span><span class="val">${knots(you.spd)} kn${you.flags & SF.REPAIRING ? ' · repairing' : ''}</span></div>
        <div class="sail-steps">${steps}</div>`;
    }

    // Combat block: rebuilt each frame (cheap, few nodes).
    const now = state.estServerTime();
    // Cursed shot shows only when you carry it (key U).
    const ammo = AMMO_IDS.filter((a) => a !== 'cursed' || you.ammo.cursed > 0 || you.ammoSel === 'cursed').map((a, i) => `<div class="ammo ${you.ammoSel === a ? 'sel' : ''}" data-ammo="${a}"><b>[${a === 'cursed' ? 'U' : i + 1}]</b>${esc(AMMO[a].name)}<br>${you.ammo[a]}</div>`).join('');
    const reload = (['port', 'starboard'] as const).map((side) => {
      const r = you.reload[side];
      return `<div class="reload-side ${r >= 1 ? 'ready' : ''}">${side === 'port' ? '[Q] Port' : 'Starboard [E]'}${bar('', Math.round(r * 50) / 50)}</div>`;
    }).join('') + (SHIP_CLASSES[self.loadout.classId].bowChasers + SHIP_CLASSES[self.loadout.classId].sternChasers > 0
      ? `<div class="reload-side ${Math.min(you.reload.bow || 1, you.reload.stern || 1) >= 1 ? 'ready' : ''}">[Space] Chasers${bar('', Math.round(Math.max(you.reload.bow, you.reload.stern) * 50) / 50)}</div>` : '')
      + (self.loadout.mount ? `<div class="reload-side ${you.reload.mount >= 1 ? 'ready' : ''}">[RMB] ${esc(MOUNTS[self.loadout.mount].name)}${bar('', Math.round(you.reload.mount * 50) / 50)}</div>` : '');
    const abilities = cap.abilities.map((a) => {
      const ready = self.cooldowns[a.id] ?? 0;
      const left = Math.max(0, ready - now);
      const locked = a.kind === 'ultimate' && self.level < 6;
      const frac = left > 0 ? left / a.cooldown : 0;
      // Ultimates need full resolve; the Drowned Captain's miracles need Dread.
      const charge = a.kind === 'ultimate' && !locked && you.resolve < 100 ? `<div class="charge" style="width:${Math.round(you.resolve)}%"></div>` : '';
      const starved = (a.dreadCost ?? 0) > you.dread;
      return `<div class="ab ${a.kind === 'ultimate' ? 'ult' : ''} ${locked || charge || starved ? 'locked' : ''}" data-ab="${a.id}" title="${esc(a.name)} — ${esc(a.description)}">
        <span class="k">${a.key}</span><span class="n">${esc(a.name)}</span>${charge}
        ${frac > 0 ? `<div class="cd" style="height:${Math.round(frac * 100)}%"></div><div class="cdt">${Math.ceil(left)}</div>` : ''}${locked ? '<div class="cdt">Lv6</div>' : ''}</div>`;
    }).join('');
    const talentBar = activeTalents(self.talents).slice(0, 5).map((t, i) => {
      const left = Math.max(0, (self.talentCooldowns[t.id] ?? 0) - now);
      const frac = left > 0 && t.active ? left / t.active.cooldown : 0;
      return `<div class="ab talent" data-talent="${t.id}" title="${esc(t.name)} — ${esc(t.description)}"><span class="k">${'67890'[i]}</span><span class="n">${esc(t.name)}</span>
        ${frac > 0 ? `<div class="cd" style="height:${Math.round(Math.min(1, frac) * 100)}%"></div><div class="cdt">${Math.ceil(left)}</div>` : ''}</div>`;
    }).join('');
    const heat = self.heat.port || self.heat.starboard
      ? `<div class="row" style="font-size:11px"><span class="lbl" style="color:var(--bad)">Heat</span><span class="val">P ${self.heat.port} · S ${self.heat.starboard}</span></div>` : '';
    // Storm Gunner: the crest of the swell (the same seven-second cycle as the server).
    const crest = (self.talents.brg_storm_gunner ?? 0) > 0 && state.wind[1] >= 0.9 && Math.sin((now * Math.PI * 2) / 7 + (state.entityId ?? 0)) > 0.75;
    const mode = `<div class="row" style="font-size:11px"><span class="lbl">[K] Fire</span><span class="val">${self.rollingFire ? 'rolling' : 'broadside'}${crest ? ' · <span style="color:var(--gold)">CREST +15%</span>' : ''}</span></div>`;
    const combat = $('hud-combat');
    const key = ammo + reload + abilities + talentBar + heat + mode;
    if (key === this.lastCombatKey) {
      this.drawNav(state);
      $('hud-prompt').innerHTML = prompt;
      this.drawMinimap(state);
      return this.updateRegion(state, now);
    }
    this.lastCombatKey = key;
    combat.innerHTML = `<div><div class="ammo-box">${ammo}</div><div class="reload" style="margin-top:6px">${reload}</div>${mode}${heat}</div><div class="abilities">${abilities}${talentBar}</div>`;
    combat.querySelectorAll<HTMLElement>('[data-ab]').forEach((el) => (el.onclick = () => this.onAbility(el.dataset.ab!)));
    combat.querySelectorAll<HTMLElement>('[data-talent]').forEach((el) => (el.onclick = () => this.onTalent(el.dataset.talent!)));
    combat.querySelectorAll<HTMLElement>('[data-ammo]').forEach((el) => (el.onclick = () => this.onAmmo(el.dataset.ammo!)));

    // Navigation block: compass with wind.
    this.drawNav(state);
    $('hud-prompt').innerHTML = prompt;
    this.drawMinimap(state);
    this.updateRegion(state, now);
  }

  private updateRegion(state: ClientState, now: number): void {
    const tod = timeOfDay(now);
    const hours = Math.floor(tod * 24), mins = Math.floor((tod * 24 - hours) * 60);
    const r = REGIONS[state.region];
    $('hud-region').innerHTML = `${esc(r.name)} · <span style="color:${r.safety === 'safe' ? 'var(--good)' : r.safety === 'contested' ? 'var(--gold)' : 'var(--bad)'}">${r.safety}</span><br>${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · ${esc(state.weather.replace('_', ' '))} · ${esc(seasonName(now))}${state.self?.quests[0] ? `<br><span style="color:var(--gold)">${esc(state.self.quests[0].name)}:</span> <span class="muted">${esc(state.self.quests[0].text)}${state.self.quests[0].need > 1 ? ` ${state.self.quests[0].progress}/${state.self.quests[0].need}` : ''}</span>` : ''}${state.self?.forecast ? `<br><span class="muted">Weather Eye: ${esc(state.self.forecast.kind.replace('_', ' '))} in ${Math.max(1, Math.round(state.self.forecast.in / 60))} min</span>` : ''}`;
  }

  private drawNav(state: ClientState): void {
    const el = $('hud-nav');
    let c = el.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) {
      el.innerHTML = '<canvas class="compass" width="220" height="220"></canvas><div id="nav-text" style="font-size:11px;color:var(--fog);text-align:center"></div>';
      c = el.querySelector('canvas')!;
    }
    const g = c.getContext('2d')!;
    const W = 220, R = 92;
    g.clearRect(0, 0, W, W);
    g.save();
    g.translate(W / 2, W / 2);
    // A frightened crew reads a wandering compass (±15°).
    if ((state.you?.sanity ?? 100) <= 50) g.rotate(Math.sin(performance.now() / 2300) * 0.26);
    // Ring.
    g.strokeStyle = 'rgba(176,141,87,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(216,210,196,0.8)';
    g.font = '16px "IM Fell English SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [t, a] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]] as const) g.fillText(t, Math.sin(a) * (R - 14), -Math.cos(a) * (R - 14));
    const you = state.you!;
    // No-go wedge (relative to wind source).
    const from = state.wind[0] + Math.PI;
    const nogo = ((state.ownStats?.noGoDeg ?? 50) * Math.PI) / 180;
    g.fillStyle = 'rgba(208,106,94,0.18)';
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, R - 2, from - nogo - Math.PI / 2, from + nogo - Math.PI / 2);
    g.closePath();
    g.fill();
    // Wind arrow (blowing toward).
    const wv = headingVec(state.wind[0]);
    g.strokeStyle = 'rgba(143,179,217,0.95)';
    g.lineWidth = 3 + state.wind[1] * 3;
    g.beginPath();
    g.moveTo(-wv.x * R * 0.8, -wv.y * R * 0.8);
    g.lineTo(wv.x * R * 0.5, wv.y * R * 0.5);
    g.stroke();
    g.fillStyle = 'rgba(143,179,217,0.95)';
    g.beginPath();
    g.moveTo(wv.x * R * 0.7, wv.y * R * 0.7);
    g.lineTo(wv.x * R * 0.45 - wv.y * 10, wv.y * R * 0.45 + wv.x * 10);
    g.lineTo(wv.x * R * 0.45 + wv.y * 10, wv.y * R * 0.45 - wv.x * 10);
    g.fill();
    // Ship heading.
    g.rotate(you.h);
    g.fillStyle = '#e0b862';
    g.beginPath();
    g.moveTo(0, -R * 0.6);
    g.lineTo(9, 10);
    g.lineTo(0, 4);
    g.lineTo(-9, 10);
    g.closePath();
    g.fill();
    g.restore();
    const rel = Math.round(relWindDeg(you.h, { dir: state.wind[0], strength: state.wind[1] }));
    const point = rel < (state.ownStats?.noGoDeg ?? 50) ? '<span style="color:var(--bad)">in irons</span>' : rel < 80 ? 'close-hauled' : rel < 110 ? 'beam reach' : rel < 160 ? 'broad reach' : 'running';
    $('nav-text').innerHTML = `Wind ${Math.round(state.wind[1] * 30)} kn · ${point} (${rel}°)`;
  }

  private drawMinimap(state: ClientState): void {
    const c = this.minimap;
    const g = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const own = state.ownDisplay;
    if (!own) return;
    // Star Reader: at night the stars show islands and ports twice as far.
    const stars = (state.self?.talents.exp_star_reader ?? 0) > 0 && isNight(state.estServerTime());
    const range = stars ? 9000 : 4500;
    const k = W / (range * 2);
    g.fillStyle = '#060a0e';
    g.fillRect(0, 0, W, H);
    const tx = (x: number) => (x - own.x) * k + W / 2;
    const ty = (y: number) => (y - own.y) * k + H / 2;
    g.fillStyle = '#3a3d36';
    g.strokeStyle = '#6a624f';
    for (const is of state.islands.values()) {
      if (Math.abs(is.x - own.x) > range + is.r || Math.abs(is.y - own.y) > range + is.r) continue;
      g.beginPath();
      for (let i = 0; i < is.poly.length; i += 4) {
        if (i === 0) g.moveTo(tx(is.poly[i]), ty(is.poly[i + 1]));
        else g.lineTo(tx(is.poly[i]), ty(is.poly[i + 1]));
      }
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(90,160,150,0.7)';
    for (const rf of state.reefs.values()) {
      if (Math.abs(rf.x - own.x) > range + rf.r || Math.abs(rf.y - own.y) > range + rf.r) continue;
      g.beginPath();
      g.arc(tx(rf.x), ty(rf.y), Math.max(1.5, rf.r * k * 0.8), 0, Math.PI * 2);
      g.stroke();
    }
    // Weather fronts on the horizon.
    for (const f of state.fronts) {
      g.fillStyle = f.kind === 'black_storm' ? 'rgba(46,230,200,0.10)' : f.kind === 'storm' ? 'rgba(160,170,190,0.16)' : f.kind === 'fog' ? 'rgba(170,180,185,0.10)' : 'rgba(120,150,190,0.10)';
      g.beginPath();
      g.arc(tx(f.x), ty(f.y), f.r * k, 0, Math.PI * 2);
      g.fill();
    }
    // Whirlpools are felt, not charted: 2.5 km, further with Anomaly Sense.
    const sense = 2500 * (1 + (state.ownStats ? tval(state.ownStats, 'anomalySight') : 0) + ((state.self?.talents.abs_drowned_eyes ?? 0) >= 2 ? 0.3 : 0));
    for (const w of state.whirlpools) {
      if (Math.hypot(w.x - own.x, w.y - own.y) > sense + w.radius) continue;
      g.strokeStyle = 'rgba(208,106,94,0.6)';
      g.beginPath();
      g.arc(tx(w.x), ty(w.y), w.radius * k, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of state.ports) {
      if (Math.abs(p.x - own.x) > range || Math.abs(p.y - own.y) > range) continue;
      g.fillStyle = '#e0b862';
      g.fillRect(tx(p.x) - 3, ty(p.y) - 3, 6, 6);
    }
    for (const s of state.ships.values()) {
      const hostile = s.cur.flags & SF.HOSTILE;
      g.fillStyle = hostile ? '#e0655a' : s.info?.isPlayer ? '#8fb3d9' : '#a9a9a0';
      g.beginPath();
      g.arc(tx(s.cur.x), ty(s.cur.y), hostile ? 3 : 2.2, 0, Math.PI * 2);
      g.fill();
    }
    for (const l of state.loot.values()) {
      g.fillStyle = '#b08d57';
      g.fillRect(tx(l.x) - 1.5, ty(l.y) - 1.5, 3, 3);
    }
    // Explorer's marks: soundings (shallows), wakes of passing ships, gold trails, treasure circles, known wrecks.
    const self = state.self;
    g.fillStyle = 'rgba(200,170,90,0.55)';
    for (const [sx, sy] of self?.soundings ?? []) g.fillRect(tx(sx) - 1, ty(sy) - 1, 2, 2);
    g.strokeStyle = 'rgba(180,200,210,0.45)';
    g.lineWidth = 1;
    for (const tr of self?.trails ?? []) {
      g.beginPath();
      tr.pts.forEach(([px, py], i) => (i ? g.lineTo(tx(px), ty(py)) : g.moveTo(tx(px), ty(py))));
      g.stroke();
    }
    g.fillStyle = 'rgba(230,190,80,0.8)';
    for (const [gx, gy] of self?.goldTrails ?? []) {
      g.beginPath();
      g.arc(tx(gx), ty(gy), 2, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(217,180,90,0.8)';
    g.setLineDash([3, 3]);
    for (const m of self?.maps ?? []) {
      g.beginPath();
      g.arc(tx(m.x), ty(m.y), Math.max(3, m.r * k), 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = 'rgba(120,190,200,0.8)';
    for (const w of self?.wrecks ?? []) {
      g.beginPath();
      g.moveTo(tx(w.x) - 3, ty(w.y) - 3);
      g.lineTo(tx(w.x) + 3, ty(w.y) + 3);
      g.moveTo(tx(w.x) + 3, ty(w.y) - 3);
      g.lineTo(tx(w.x) - 3, ty(w.y) + 3);
      g.stroke();
    }
    // Insider: Crown patrols as hollow red diamonds; hidden coves as green hooks.
    g.strokeStyle = 'rgba(224,101,90,0.8)';
    for (const [px, py] of state.self?.patrols ?? []) {
      if (Math.abs(px - own.x) > range || Math.abs(py - own.y) > range) continue;
      g.beginPath();
      g.moveTo(tx(px), ty(py) - 4);
      g.lineTo(tx(px) + 4, ty(py));
      g.lineTo(tx(px), ty(py) + 4);
      g.lineTo(tx(px) - 4, ty(py));
      g.closePath();
      g.stroke();
    }
    g.fillStyle = '#6fbf8f';
    for (const c of state.self?.coves ?? []) {
      if (Math.abs(c.x - own.x) > range || Math.abs(c.y - own.y) > range) continue;
      g.beginPath();
      g.arc(tx(c.x), ty(c.y), 3, 0, Math.PI * 2);
      g.fill();
    }
    // Right of revenge: who sank you, in red. The duel ring.
    g.strokeStyle = '#e0655a';
    g.lineWidth = 2;
    for (const m of state.marks) {
      const mx = clamp(tx(m.x), 4, c.width - 4), my = clamp(ty(m.y), 4, c.height - 4);
      g.beginPath();
      g.moveTo(mx - 4, my - 4);
      g.lineTo(mx + 4, my + 4);
      g.moveTo(mx + 4, my - 4);
      g.lineTo(mx - 4, my + 4);
      g.stroke();
    }
    g.lineWidth = 1;
    if (state.duel) {
      g.setLineDash([4, 3]);
      g.beginPath();
      g.arc(tx(state.duel.cx), ty(state.duel.cy), state.duel.r * k, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    // Your group: green squares; they stay on the chart however far they sail.
    g.fillStyle = '#7fd08a';
    for (const m of state.party?.members ?? []) {
      if (m.name === state.self?.name || m.docked || !m.online) continue;
      const mx = clamp(tx(m.x), 3, c.width - 3), my = clamp(ty(m.y), 3, c.height - 3);
      g.fillRect(mx - 2.5, my - 2.5, 5, 5);
    }
    // Monsters the Choir shows you (Eyes of the Choir).
    g.fillStyle = '#9b6bd0';
    for (const [mx, my] of state.self?.monsters ?? []) {
      g.beginPath();
      g.arc(tx(mx), ty(my), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Afraid lookouts call sails that are not there (Drowned Eyes 2 sees through them).
    if ((state.you?.sanity ?? 100) <= 50 && (state.self?.talents.abs_drowned_eyes ?? 0) < 2) {
      const epoch = Math.floor(performance.now() / 8000);
      g.fillStyle = '#e0655a';
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(epoch * 12.9898 + i * 78.233) * 43758.5453, b = Math.sin(epoch * 39.3468 + i * 11.135) * 24634.6345;
        const fx = (a - Math.floor(a)) * W, fy = (b - Math.floor(b)) * H;
        g.beginPath();
        g.arc(fx, fy, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Own ship.
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(own.heading);
    g.fillStyle = '#f0e6c8';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(176,141,87,0.35)';
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  private recentToasts = new Map<string, number>();

  toast(msg: string, kind: string): void {
    // Collapse repeats (e.g. mashing fire while reloading).
    const now = performance.now();
    if ((this.recentToasts.get(msg) ?? 0) > now - 2500) return;
    this.recentToasts.set(msg, now);
    if (this.recentToasts.size > 50) this.recentToasts.clear();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    this.toastsEl.prepend(el);
    while (this.toastsEl.children.length > 7) this.toastsEl.lastChild!.remove();
    setTimeout(() => el.remove(), kind === 'xp' ? 3500 : 7000);
  }

  /** Letters waiting: a small seal by the minimap. */
  setUnread(n: number): void {
    const el = $('unread');
    el.textContent = n ? `✉ ${n}` : '';
    el.classList.toggle('hidden', !n);
  }

  banner(title: string, sub: string): void {
    const b = $('banner');
    b.innerHTML = `${esc(title)}<small>${esc(sub)}</small>`;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), 3500);
  }

  chat(from: string, text: string, ch?: 'group'): void {
    const log = $('chat-log');
    const d = document.createElement('div');
    if (ch === 'group') d.className = 'chat-group';
    d.innerHTML = `${ch === 'group' ? '<i>[group]</i> ' : ''}<b>${esc(from)}:</b> ${esc(text)}`;
    log.append(d);
    while (log.children.length > 8) log.firstChild!.remove();
  }
}

function sanityWord(v: number): string {
  return v > 75 ? 'clear' : v > 50 ? 'uneasy' : v > 25 ? 'afraid' : v > 10 ? 'terror' : 'madness';
}
