// In-game HUD: captain, ship condition, combat (ammo, reloads, abilities), navigation (wind, sails),
// minimap, prompts, toasts, banners and chat.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { WANTED_TITLES } from '../../../shared/src/data/factions.ts';
import { AMMO, AMMO_IDS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { timeOfDay } from '../../../shared/src/constants.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
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
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1);
    const holdMax = state.ownStats?.holdVolume ?? cls.holdVolume;
    const skey = `${you.hull}|${you.sails}|${you.crew}|${you.morale}|${Math.round(you.spd * 10)}|${you.sailT}|${Math.round(you.sail * 4)}|${vol.toFixed(1)}|${you.rudderHp}|${you.flags}`;
    if (skey !== this.lastShipKey) {
      this.lastShipKey = skey;
      const steps = [0, 0.25, 0.5, 0.75, 1].slice(1).map((v) => `<span class="${you.sail >= v - 0.01 ? 'on' : ''} ${Math.abs(you.sailT - v) < 0.01 ? 'target' : ''}"></span>`).join('');
      $('hud-ship').innerHTML = `
        <div class="row"><b style="font-family:var(--serif);font-size:16px">${esc(self.loadout.name)}</b><span class="lbl">${esc(cls.name)}</span></div>
        <div class="row"><span class="lbl">Hull</span><span class="val">${fmt(you.hull)} / ${fmt(you.hullMax)}</span></div>${bar('hull', you.hull / you.hullMax)}
        <div class="row"><span class="lbl">Sails</span><span class="val">${fmt(you.sails)} / ${fmt(you.sailsMax)}${you.rudderHp < 0.99 ? ` · rudder ${Math.round(you.rudderHp * 100)}%` : ''}</span></div>${bar('sails', you.sails / you.sailsMax)}
        <div class="row"><span class="lbl">Crew</span><span class="val">${you.crew} / ${you.crewMax}</span></div>${bar('crew', you.crew / you.crewMax)}
        <div class="row"><span class="lbl">Morale</span><span class="val">${you.morale}</span></div>${bar('morale', you.morale / 100)}
        <div class="row"><span class="lbl">Hold</span><span class="val">${vol.toFixed(0)} / ${holdMax.toFixed(0)}${self.cargo.provisions ? ` · food ${Math.floor(self.cargo.provisions)}` : ' · <span style="color:var(--bad)">no food</span>'}</span></div>
        <div class="row" style="margin-top:4px"><span class="lbl">Sail [W/S]</span><span class="val">${knots(you.spd)} kn${you.flags & SF.REPAIRING ? ' · repairing' : ''}</span></div>
        <div class="sail-steps">${steps}</div>`;
    }

    // Combat block: rebuilt each frame (cheap, few nodes).
    const now = state.estServerTime();
    const ammo = AMMO_IDS.map((a, i) => `<div class="ammo ${you.ammoSel === a ? 'sel' : ''}" data-ammo="${a}"><b>[${i + 1}]</b>${esc(AMMO[a].name)}<br>${you.ammo[a]}</div>`).join('');
    const reload = (['port', 'starboard'] as const).map((side) => {
      const r = you.reload[side];
      return `<div class="reload-side ${r >= 1 ? 'ready' : ''}">${side === 'port' ? '[Q] Port' : 'Starboard [E]'}${bar('', Math.round(r * 50) / 50)}</div>`;
    }).join('');
    const abilities = cap.abilities.map((a) => {
      const ready = self.cooldowns[a.id] ?? 0;
      const left = Math.max(0, ready - now);
      const locked = a.kind === 'ultimate' && self.level < 6;
      const frac = left > 0 ? left / a.cooldown : 0;
      return `<div class="ab ${a.kind === 'ultimate' ? 'ult' : ''} ${locked ? 'locked' : ''}" data-ab="${a.id}" title="${esc(a.name)} — ${esc(a.description)}">
        <span class="k">${a.key}</span><span class="n">${esc(a.name)}</span>
        ${frac > 0 ? `<div class="cd" style="height:${Math.round(frac * 100)}%"></div><div class="cdt">${Math.ceil(left)}</div>` : ''}${locked ? '<div class="cdt">Lv6</div>' : ''}</div>`;
    }).join('');
    const combat = $('hud-combat');
    const key = ammo + reload + abilities;
    if (key === this.lastCombatKey) {
      this.drawNav(state);
      $('hud-prompt').innerHTML = prompt;
      this.drawMinimap(state);
      return this.updateRegion(state, now);
    }
    this.lastCombatKey = key;
    combat.innerHTML = `<div><div class="ammo-box">${ammo}</div><div class="reload" style="margin-top:6px">${reload}</div></div><div class="abilities">${abilities}</div>`;
    combat.querySelectorAll<HTMLElement>('[data-ab]').forEach((el) => (el.onclick = () => this.onAbility(el.dataset.ab!)));
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
    $('hud-region').innerHTML = `${esc(r.name)} · <span style="color:${r.safety === 'safe' ? 'var(--good)' : r.safety === 'contested' ? 'var(--gold)' : 'var(--bad)'}">${r.safety}</span><br>${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · ${esc(state.weather.replace('_', ' '))}`;
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
    const range = 4500;
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

  toast(msg: string, kind: string): void {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    this.toastsEl.prepend(el);
    while (this.toastsEl.children.length > 7) this.toastsEl.lastChild!.remove();
    setTimeout(() => el.remove(), kind === 'xp' ? 3500 : 7000);
  }

  banner(title: string, sub: string): void {
    const b = $('banner');
    b.innerHTML = `${esc(title)}<small>${esc(sub)}</small>`;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), 3500);
  }

  chat(from: string, text: string): void {
    const log = $('chat-log');
    const d = document.createElement('div');
    d.innerHTML = `<b>${esc(from)}:</b> ${esc(text)}`;
    log.append(d);
    while (log.children.length > 8) log.firstChild!.remove();
  }
}
