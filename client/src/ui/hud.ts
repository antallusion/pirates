// In-game HUD: captain, ship condition, combat (ammo, reloads, abilities), navigation (wind, sails),
// minimap, prompts, toasts, banners and chat.

import { regattaPanel } from './regatta.ts';
import { stormPanel } from './storms.ts';
import { orderPanel } from './marque.ts';
import { descentPanel } from './descent.ts';
import { nemesisLabel } from './nemesis.ts';
import { pirateById } from '../../../shared/src/data/pirates.ts';
import { BEASTS, beastOfClass, hullNoise, noiseBand } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';
import { placeName } from './maps.ts';
import { THREAT_COLOR } from '../../../shared/src/data/shiplevel.ts';
import { levelChip, threatTo } from './levels.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { DASH_COOLDOWN } from '../../../shared/src/data/gunnery.ts';
import { dict, lang, plural, t } from '../i18n.ts';
import type { Key } from '../i18n.ts';
import { term } from './terms.ts';
import { drawRelation, relationOf, RELATION_COLOR } from '../render/relation.ts';
import { cbColor, keyLabel, settings } from '../settings.ts';
import type { Action } from '../settings.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { AMMO, AMMO_IDS, MOUNTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { isNight, nightFactor, timeOfDay } from '../../../shared/src/constants.ts';
import { clamp, headingVec } from '../../../shared/src/math.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { activeTalents } from '../../../shared/src/data/talents.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { cargoVolume, tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { seasonName } from '../../../shared/src/world/worldgen.ts';
import { assetUrl } from '../assets.ts';
import type { ClientState } from '../state.ts';
import { $, bar, decorateSums, esc, fmt, icon, knots, pct } from './dom.ts';
import { questPointer, trackedQuest } from './track.ts';
import { EN, RU } from '../lang/ui/hud.ts';
import { NAME_RU } from '../lang/data.ts';
import { serverText } from '../lang/server.ts';

const L = dict(EN, RU);
const RL = dict(REN, RRU);
/** A name or sentence that came from the server, in the player's language. */
const sv = (s: string): string => (lang() === 'ru' ? NAME_RU.get(s) ?? serverText(s) : s);
const wantedTitle = (n: number): string => L(`wanted.${Math.max(0, Math.min(5, n))}` as keyof typeof EN & string);

export class Hud {
  private lastCaptainKey = '';
  private lastShipKey = '';
  private lastCombatKey = '';
  private lastBossKey = '';
  private lastPartyKey = '';
  /** Tapping a groupmate's frame (main.ts): inspect them. */
  onPartyTap: (name: string) => void = () => {};
  /** Tapping the target frame of a captain's ship (main.ts): inspect them. */
  onTargetTap: (name: string) => void = () => {};
  /** A fishing order from the panel (main.ts). */
  onFishing: (action: 'trap' | 'haul' | 'deep' | 'salt') => void = () => {};
  onHunt: (action: 'slack' | 'cut' | 'flense', id?: number) => void = () => {};
  onTribute: (id: number) => void = () => {};
  private lastHuntKey = '';
  private lastRegattaKey = '';
  private lastStormKey = '';
  private lastOrderKey = '';
  private lastDescentKey = '';
  private lastFishKey = '';
  private lastTargetKey = '';
  private toastsEl = $('toasts');
  private bannerTimer = 0;
  private minimap = $('minimap') as HTMLCanvasElement;
  onAbility: (id: string) => void = () => {};
  onAmmo: (id: string) => void = () => {};
  onTalent: (id: string) => void = () => {};
  /** Phones show only the loaded shot: tapping it loads the next kind. */
  onAmmoCycle: () => void = () => {};
  private lastPrompt = '\u0000';
  private lastRegion = '';
  private lastMinimap = 0;
  private lastNav = 0;
  private gaugeEls = new Map<string, { el: HTMLElement; fill: HTMLElement }>();
  private cdEls = new Map<string, { cd: HTMLElement; cdt: HTMLElement; charge: HTMLElement | null }>();
  /** Bumped when art finishes loading so slots rebuild with their icons. */
  artEpoch = 0;

  constructor() {
    // The unit frame opens the ship's full condition on screens too small to keep it out.
    // It drops open under the frame's lowest edge (portrait, bars and the line under them), measured as it opens.
    $('hud-captain').onclick = () => {
      if (document.body.classList.toggle('ship-open')) placeShipPanel();
    };
    // A tap on the open panel folds it away again.
    $('hud-ship').onclick = () => document.body.classList.contains('touch') && document.body.classList.remove('ship-open');
    // The toast column stands on top of the bottom block, whatever its height (a prompt, a two-row action bar).
    const bottom = $('hud-bottom');
    const place = () => {
      const r = bottom.getBoundingClientRect();
      document.body.style.setProperty('--hb-top', `${r.height > 0 ? Math.max(0, innerHeight - r.top) : 0}px`);
    };
    new ResizeObserver(place).observe(bottom);
    addEventListener('resize', place);
  }

  show(on: boolean): void {
    for (const id of ['hud', 'hud-toasts', 'hud-chat']) $(id).classList.toggle('hidden', !on);
  }

  update(state: ClientState, prompt: string): void {
    const self = state.self, you = state.you;
    if (!self || !you) return;
    this.drawBoss(state);
    this.drawParty(state);
    this.drawFishing(state);
    this.drawHunt(state);
    this.drawRegatta(state);
    this.drawStorm(state);
    this.drawOrder(state);
    this.drawDescent(state);
    const cap = CAPTAINS[self.captain];

    // Unit frame: portrait in its ring, name, silver, and the ship's hull, sails and crew (re-rendered on change).
    const url = assetUrl(cap.portrait);
    const ckey = `${lang()}|${self.level}|${Math.round((self.xp / Math.max(1, self.xpNext)) * 200)}|${Math.round((self.rested / Math.max(1, self.xpNext)) * 200)}|${self.gold}|${self.wanted}|${self.talentPoints}|${you.hull}|${you.hullMax}|${you.sails}|${you.sailsMax}|${you.crew}|${you.crewMax}|${url ? 1 : 0}`;
    if (ckey !== this.lastCaptainKey) {
      this.lastCaptainKey = ckey;
      $('hud-captain').innerHTML = `
        <div class="uf-portrait" style="background-image:${url ? `url('${url}')` : 'none'}"><b class="uf-level" title="${esc(L('lv', { n: self.level }))}">${self.level}</b></div>
        <div class="uf-body">
          <div class="uf-top"><span class="uf-name">${esc(self.name)}</span><span class="gold val uf-silver">${icon('coin', '⛁', 'ico-sm')}${fmt(self.gold)}</span></div>
          ${fbar('hull', you.hull, you.hullMax, L('hull'), 'stat_hull')}${fbar('sails', you.sails, you.sailsMax, L('sails'), 'stat_sails')}${fbar('crew', you.crew, you.crewMax, L('crew'), 'stat_crew')}
          <div class="fbar xp"${self.rested > 0 ? ` title="${esc(L('rested', { n: fmt(self.rested) }))}"` : ''}><i style="width:${pct(self.xp / Math.max(1, self.xpNext))}"></i>${self.rested > 0 ? `<b class="xp-rest" style="left:${pct(self.xp / Math.max(1, self.xpNext))};width:${pct(Math.min(self.rested, Math.max(0, self.xpNext - self.xp)) / Math.max(1, self.xpNext))}"></b>` : ''}</div>
          <div class="uf-sub"><span class="wanted" title="${esc(wantedTitle(self.wanted))}">${self.wanted ? icon('wanted', '☠', 'ico-sm') + '☠'.repeat(self.wanted) + ' ' + esc(wantedTitle(self.wanted)) : `<span class="muted">${esc(L('unknownToLaw'))}</span>`}</span>${self.talentPoints > 0 ? `<span class="gold uf-pts" title="${esc(keyless(L('talentPts', { n: self.talentPoints })))}">${keyChip('talents')}${icon('xp', '', 'ico-sm')}${self.talentPoints}</span>` : ''}</div>
        </div>`;
    }

    // Ship condition.
    const cls = SHIP_CLASSES[self.loadout.classId];
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1, state.ownStats?.materialVolumeMul ?? 1, state.ownStats?.provisionVolumeMul ?? 1, state.ownStats?.cursedVolumeMul ?? 1);
    const holdMax = state.ownStats?.holdVolume ?? cls.holdVolume;
    const lvl = shipLevelOf(self.loadout);
    const skey = `${lang()}|${lvl}|${self.abyss?.pressure ?? -1}|${self.abyss?.shards ?? 0}|${Math.round(you.water * 50)}|${you.leaks}|${you.station}|${self.curse}|${you.hull}|${you.sails}|${you.crew}|${you.morale}|${Math.round(you.spd * 10)}|${you.sailT}|${Math.round(you.sail * 4)}|${vol.toFixed(1)}|${you.rudderHp}|${you.flags}|${Math.round(you.sanity)}|${Math.round(you.dread)}|${self.company.unrest}`;
    if (skey !== this.lastShipKey) {
      this.lastShipKey = skey;
      const steps = [0, 0.25, 0.5, 0.75, 1].slice(1).map((v) => `<span class="${you.sail >= v - 0.01 ? 'on' : ''} ${Math.abs(you.sailT - v) < 0.01 ? 'target' : ''}"></span>`).join('');
      if (document.body.classList.contains('ship-open')) placeShipPanel();
      $('hud-ship').innerHTML = `
        <div class="row sp-head"><b>${icon('menu_ship', '', 'ico-sm')}${esc(self.loadout.name)}</b><span class="lbl"><b class="ship-lvl">⚓${lvl}</b> ${esc(cls.name)}</span></div>
        <div class="row"><span class="lbl">${icon('stat_hull', '', 'ico-xs')}${esc(L('hull'))}</span><span class="val">${fmt(you.hull)} / ${fmt(you.hullMax)}</span></div>${bar('hull', you.hull / you.hullMax)}
        <div class="row"><span class="lbl">${icon('stat_sails', '', 'ico-xs')}${esc(L('sails'))}</span><span class="val">${fmt(you.sails)} / ${fmt(you.sailsMax)}${you.rudderHp < 0.99 ? ` · ${esc(L('rudder', { n: Math.round(you.rudderHp * 100) }))}` : ''}</span></div>${bar('sails', you.sails / you.sailsMax)}
        <div class="row"><span class="lbl">${icon('stat_crew', '', 'ico-xs')}${esc(L('crew'))}</span><span class="val">${you.crew} / ${you.crewMax}</span></div>${bar('crew', you.crew / you.crewMax)}
        ${you.water > 0.01 || you.leaks ? `<div class="row"><span class="lbl" style="color:var(--xp)">${esc(L('water'))}</span><span class="val">${Math.round(you.water * 100)}%${you.leaks ? ` · ${you.leaks} ${esc(plural(you.leaks, L('leak.one'), L('leak.few'), L('leak.many')))}` : ''}${you.water > 0.4 ? ` · ${esc(L('listing'))}` : ''}</span></div>${bar('crew', you.water)}` : ''}
        <div class="row"><span class="lbl">${icon('menu_crew', '', 'ico-xs')}${esc(keyless(L('orders')))}</span><span class="val">${esc(L(`station.${you.station}`))}</span></div>
        <div class="row"><span class="lbl">${icon('tree_command', '', 'ico-xs')}${esc(L('morale'))}</span><span class="val">${you.morale}</span></div>${bar('morale', you.morale / 100)}
        ${self.abyss && (self.abyss.inside || self.abyss.pressure > 0) ? `<div class="row" title="${esc(L('pressureTip'))}"><span class="lbl" style="color:${self.abyss.pressure < 60 ? 'var(--fog)' : 'var(--bad)'}">${esc(L('pressure'))}</span><span class="val">${self.abyss.pressure}${self.abyss.shards ? ` · ${esc(L('shards', { n: self.abyss.shards }))}` : ''}</span></div>${bar('sanity', self.abyss.pressure / 100)}` : ''}${you.sanity < 99.5 ? `<div class="row" title="${esc(L('sanityTip'))}"><span class="lbl" style="color:${you.sanity > 50 ? 'var(--fog)' : 'var(--bad)'}">${esc(L('sanity'))}</span><span class="val">${Math.round(you.sanity)} · ${esc(sanityWord(you.sanity))}</span></div>${bar('sanity', you.sanity / 100)}` : ''}
        ${self.company.unrest ? `<div class="row" title="${esc(L('unrestTip'))}"><span class="lbl" style="color:var(--bad)">${esc(L('crew'))}</span><span class="val" style="color:var(--bad)">${esc(sv(self.company.unrest))}</span></div>` : ''}
        ${self.captain === 'drowned' ? `<div class="row" title="${esc(L('dreadTip'))}"><span class="lbl" style="color:var(--turq)">${esc(L('dread'))}</span><span class="val" style="color:var(--turq)">${Math.round(you.dread)}${you.dread >= 80 ? ` · ${esc(L('theCall'))}` : ''}</span></div>${bar('dread', you.dread / 100)}` : ''}
        <div class="row"><span class="lbl">${icon('tab_market', '', 'ico-xs')}${esc(L('hold'))}</span><span class="val">${vol.toFixed(0)} / ${holdMax.toFixed(0)}${self.cargo.provisions ? ` · ${esc(L('food', { n: Math.floor(self.cargo.provisions) }))}` : ` · <span style="color:var(--bad)">${esc(L('noFood'))}</span>`}</span></div>
        ${self.curse >= 25 ? `<div class="row"><span class="lbl" style="color:var(--turq)">${esc(L('curse'))}</span><span class="val" style="color:var(--turq)">${esc(L('curseStage', { n: self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1 }))} · ${self.curse}</span></div>` : ''}
        <div class="row" style="margin-top:4px"><span class="lbl">${icon('wind', '', 'ico-xs')}${esc(keyless(L('sail')))}</span><span class="val">${knots(you.spd)} ${esc(L('kn'))}${you.flags & SF.REPAIRING ? ` · ${esc(L('repairing'))}` : ''}</span></div>
        <div class="sail-steps">${steps}</div>`;
    }

    // Combat block: rebuilt each frame (cheap, few nodes).
    const now = state.estServerTime();
    // Cursed shot shows only when you carry it (key U).
    // The action bar is rebuilt only when its make-up changes (shots and counts, abilities and their locks, talents,
    // gauges, fire mode); reloads and cooldowns move in place every frame without touching the markup.
    const shots = AMMO_IDS.filter((a) => a !== 'cursed' || you.ammo.cursed > 0 || you.ammoSel === 'cursed');
    const shipCls = cls;
    const gauges: { id: string; label: string; key?: Action; art: string; v: number; ready: boolean }[] = [
      { id: 'port', label: L('port'), key: 'firePort', art: 'fire', v: you.reload.port, ready: you.reload.port >= 1 },
      { id: 'starboard', label: L('starboard'), key: 'fireStarboard', art: 'fire', v: you.reload.starboard, ready: you.reload.starboard >= 1 },
    ];
    // The dash (dynamic combat): its readiness fills like a reload.
    const dashLeft = Math.max(0, (self.dashReadyAt ?? 0) - now);
    gauges.push({ id: 'dash', label: L('dash'), key: 'dash', art: assetUrl('icon.dash') ? 'dash' : 'ab_hard_over', v: 1 - Math.min(1, dashLeft / DASH_COOLDOWN), ready: dashLeft <= 0 });
    const tcDash = document.getElementById('tc-dash');
    if (tcDash) {
      tcDash.style.setProperty('--cd', (Math.min(1, dashLeft / DASH_COOLDOWN)).toFixed(3));
      tcDash.classList.toggle('cooling', dashLeft > 0);
    }
    if (shipCls.bowChasers + shipCls.sternChasers > 0) gauges.push({ id: 'chasers', label: L('chasers'), key: 'chasers', art: 'chasers', v: Math.max(you.reload.bow, you.reload.stern), ready: Math.min(you.reload.bow || 1, you.reload.stern || 1) >= 1 });
    if (self.loadout.mount) gauges.push({ id: 'mount', label: MOUNTS[self.loadout.mount].name, art: `mount_${self.loadout.mount}`, v: you.reload.mount, ready: you.reload.mount >= 1 });
    const abil = cap.abilities.map((a) => {
      const locked = a.kind === 'ultimate' && self.level < 6;
      // Ultimates need full resolve; the Drowned Captain's miracles need Dread.
      const charging = a.kind === 'ultimate' && !locked && you.resolve < 100;
      const starved = (a.dreadCost ?? 0) > you.dread;
      return { a, locked, charging, dim: locked || charging || starved, left: Math.max(0, (self.cooldowns[a.id] ?? 0) - now) };
    });
    const tals = activeTalents(self.talents).slice(0, 5).map((t) => ({ t, left: Math.max(0, (self.talentCooldowns[t.id] ?? 0) - now) }));
    const heat = self.heat.port || self.heat.starboard
      ? `<div class="row" style="font-size:11px"><span class="lbl" style="color:var(--bad)">${esc(L('heat'))}</span><span class="val">${esc(L('heatSides', { p: self.heat.port, s: self.heat.starboard }))}</span></div>` : '';
    // Storm Gunner: the crest of the swell (the same seven-second cycle as the server).
    const crest = (self.talents.brg_storm_gunner ?? 0) > 0 && state.wind[1] >= 0.9 && Math.sin((now * Math.PI * 2) / 7 + (state.entityId ?? 0)) > 0.75;
    const mode = `<div class="ab-mode">${keyChip('fireMode')}${esc(L('fireMode'))}: ${esc(L(self.rollingFire ? 'rolling' : 'broadside'))}${crest ? ` · <span style="color:var(--gold)">${esc(L('crest'))}</span>` : ''}</div>`;
    const combat = $('hud-combat');
    const key = [lang(), document.body.classList.contains('touch'), you.ammoSel, shots.map((a) => `${a}${you.ammo[a]}`).join(','), gauges.map((g) => g.id).join(','),
      abil.map((x) => `${x.a.id}${x.dim ? 1 : 0}${x.locked ? 1 : 0}`).join(','), tals.map((x) => x.t.id).join(','), heat, mode, this.artEpoch].join('|');
    if (key !== this.lastCombatKey) {
      this.lastCombatKey = key;
      const ammo = shots.map((a, i) => slot({
        data: `data-ammo="${a}"`, cls: you.ammoSel === a ? 'sel' : '', art: `ammo_${a}`, glyph: AMMO[a].name.slice(0, 1), name: AMMO[a].name,
        key: a === 'cursed' ? 'U' : String(i + 1), qty: String(you.ammo[a]), title: AMMO[a].name,
      })).join('');
      const reload = gauges.map((g) => `<div class="rl ${g.id === 'port' ? 'flip' : ''}" data-g="${g.id}">${icon(g.art, '', 'ico-rl')}<span>${g.key ? keyChip(g.key) : ''}${esc(g.label)}</span><div class="fbar"><i></i></div></div>`).join('');
      const abilities = abil.map((x) => slot({
        data: `data-ab="${x.a.id}"`, cls: `${x.a.kind === 'ultimate' ? 'ult' : ''} ${x.dim ? 'locked' : ''}`, art: `ab_${x.a.id}`, glyph: x.a.key, name: x.a.name, key: x.a.key,
        title: `${x.a.name} — ${x.a.description}`,
        extra: `${x.charging ? '<div class="charge"></div>' : ''}<div class="cd"></div><div class="cdt">${x.locked ? esc(L('lv6')) : ''}</div>`,
      })).join('');
      const talentBar = tals.map((x, i) => slot({
        data: `data-talent="${x.t.id}"`, cls: 'talent', art: `tree_${x.t.tree}`, glyph: '✦', name: x.t.name, key: '67890'[i], title: `${x.t.name} — ${x.t.description}`,
        extra: '<div class="cd"></div><div class="cdt"></div>',
      })).join('');
      combat.innerHTML = `<div class="ab-reload">${reload}</div>${mode}${heat}
        <div class="ab-row"><div class="ab-group ab-ammo">${ammo}</div><i class="ab-sep"></i><div class="ab-group ab-abil">${abilities}</div>${talentBar ? `<i class="ab-sep"></i><div class="ab-group">${talentBar}</div>` : ''}</div>`;
      combat.querySelectorAll<HTMLElement>('[data-ab]').forEach((el) => (el.onclick = () => this.onAbility(el.dataset.ab!)));
      combat.querySelectorAll<HTMLElement>('[data-talent]').forEach((el) => (el.onclick = () => this.onTalent(el.dataset.talent!)));
      combat.querySelectorAll<HTMLElement>('[data-ammo]').forEach((el) => (el.onclick = () => (el.classList.contains('sel') && document.body.classList.contains('touch') ? this.onAmmoCycle() : this.onAmmo(el.dataset.ammo!))));
      this.gaugeEls = new Map([...combat.querySelectorAll<HTMLElement>('.rl')].map((el) => [el.dataset.g!, { el, fill: el.querySelector<HTMLElement>('i')! }]));
      this.cdEls = new Map([...combat.querySelectorAll<HTMLElement>('[data-ab], [data-talent]')].map((el) => [el.dataset.ab ?? `t:${el.dataset.talent}`, { cd: el.querySelector<HTMLElement>('.cd')!, cdt: el.querySelector<HTMLElement>('.cdt')!, charge: el.querySelector<HTMLElement>('.charge') }]));
    }
    // Gauges and cooldowns, in place.
    for (const g of gauges) {
      const e = this.gaugeEls.get(g.id);
      if (!e) continue;
      e.el.classList.toggle('ready', g.ready);
      e.fill.style.width = pct(Math.round(g.v * 50) / 50);
    }
    const setCd = (id: string, left: number, total: number, locked: boolean) => {
      const e = this.cdEls.get(id);
      if (!e) return;
      const frac = left > 0 ? Math.min(1, left / total) : 0;
      e.cd.style.height = `${Math.round(frac * 100)}%`;
      if (!locked) {
        const txt = frac > 0 ? String(Math.ceil(left)) : '';
        if (e.cdt.textContent !== txt) e.cdt.textContent = txt;
      }
    };
    for (const x of abil) {
      setCd(x.a.id, x.left, x.a.cooldown, x.locked);
      const ch = this.cdEls.get(x.a.id)?.charge;
      if (ch) ch.style.width = `${Math.round(you.resolve)}%`;
    }
    for (const x of tals) setCd(`t:${x.t.id}`, x.left, x.t.active?.cooldown ?? 1, false);
    // The prompt, region line, minimap and compass: rewritten only when they change, drawn at their own pace.
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      $('hud-prompt').innerHTML = prompt;
    }
    const tnow = performance.now();
    if (tnow - this.lastNav > 66) {
      this.lastNav = tnow;
      if ($('hud-nav').offsetParent) this.drawNav(state);
    }
    if (tnow - this.lastMinimap > 120) {
      this.lastMinimap = tnow;
      this.drawMinimap(state);
      this.updateRegion(state, now);
    }
  }

  /** The world boss panel: name, phase, strength, parts, what to do, and your part in it. */
  private drawBoss(state: ClientState): void {
    const el = $('hud-boss');
    const b = state.bosses[0];
    if (!b) {
      if (this.lastBossKey) {
        el.classList.add('hidden');
        this.lastBossKey = '';
      }
      return;
    }
    const key = JSON.stringify([lang(), b.id, b.phase, Math.round((b.hp / b.hpMax) * 200), b.parts.map((p) => Math.round((p.hp / p.hpMax) * 20)), b.hint, b.you, Math.floor(b.endsIn / 60)]);
    if (key === this.lastBossKey) return;
    this.lastBossKey = key;
    el.classList.remove('hidden');
    // The beast's painting behind its name.
    const card = assetUrl(`card.${b.kind}`);
    el.style.setProperty('--card', card ? `url('${card}')` : 'none');
    const pct = Math.max(0, Math.min(100, (b.hp / b.hpMax) * 100));
    // Each part a cell of one grid: its name, what is left of it, and a thread of its strength under both.
    const parts = b.parts.length ? `<div class="bparts">${b.parts.map((p) => {
      const left = Math.max(0, Math.round((p.hp / p.hpMax) * 100));
      return `<span class="bpart ${p.hp <= 0 ? 'dead' : ''}" style="--hp:${left}%"><b>${esc(sv(p.label))}</b><em>${p.hp > 0 ? left + '%' : '✕'}</em></span>`;
    }).join('')}</div>` : '';
    const alert = b.you.swallowed > 0 ? `<div class="balert">${esc(L('swallowed', { n: b.you.swallowed }))}</div>` : b.you.grabbed ? `<div class="balert">${esc(keyless(L('grabbed')))}</div>` : '';
    el.innerHTML = `<div class="bname">${esc(sv(b.name))}</div><div class="bphase">${esc(sv(b.phaseName))} · ${esc(L('bossLeaves', { n: Math.ceil(b.endsIn / 60) }))}</div>
      <div class="bbar"><i style="width:${pct.toFixed(1)}%"></i></div>${parts}
      <div class="bhint">${esc(sv(b.hint))}</div><div class="byou">${esc(L('bossShare', { n: Math.round(b.you.share * 100) }))}</div>${alert}`;
  }

  private updateRegion(state: ClientState, now: number): void {
    const tod = timeOfDay(now);
    const hours = Math.floor(tod * 24), mins = Math.floor((tod * 24 - hours) * 60);
    const r = REGIONS[state.region];
    const tq = trackedQuest(state.self?.quests);
    const html = `<div><span class="rg-name">${esc(r.name.charAt(0).toUpperCase() + r.name.slice(1))}</span><span class="rg-dot"> · </span><span class="rg-safe" style="color:${r.safety === 'safe' ? 'var(--good)' : r.safety === 'contested' ? 'var(--gold)' : 'var(--bad)'}">${esc(L(`safety.${r.safety}`))}</span></div><div>${icon(weatherArt(state.weather), '', 'ico-sm')}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · ${esc(weatherWord(state.weather))}<span class="rg-season"> · ${esc(seasonWord(seasonName(now)))}</span></div><div class="rg-extra">${tq ? `<span style="color:var(--gold)">${esc(sv(tq.name))}:</span> <span class="muted">${esc(sv(tq.text))}${tq.need > 1 ? ` ${tq.progress}/${tq.need}` : ''}</span><br>` : ''}${state.self?.forecast ? `<span class="muted">${esc(L('forecast', { kind: weatherWord(state.self.forecast.kind), n: Math.max(1, Math.round(state.self.forecast.in / 60)) }))}</span>` : ''}${this.eventLines(state)}</div>`;
    if (html !== this.lastRegion) {
      this.lastRegion = html;
      $('hud-region').innerHTML = html;
    }
  }

  /** World events in these waters, with the time they have left. */
  private eventLines(state: ClientState): string {
    const left = (secs: number) => {
      const s = Math.max(0, secs - (performance.now() - state.eventsAt) / 1000);
      return s >= 86400 ? L('days', { n: Math.round(s / 86400) }) : s >= 3600 ? L('hours', { n: Math.round(s / 3600) }) : L('mins', { n: Math.max(1, Math.round(s / 60)) });
    };
    return state.events.filter((e) => e.region === state.region).map((e) => `<br><span style="color:var(--bad)">⚑ ${esc(sv(e.title))}</span> <span class="muted">· ${left(e.endsIn)}</span>`).join('');
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
    // A frightened crew reads a wandering compass (±15°); in the Abyss the stars themselves lie (±30°).
    if ((state.you?.sanity ?? 100) <= 50) g.rotate(Math.sin(performance.now() / 2300) * 0.26);
    if (state.self?.abyss?.skew) g.rotate(state.self.abyss.skew);
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
    for (const [t, a] of [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]] as const) g.fillText(L(`compass.${t}`), Math.sin(a) * (R - 14), -Math.cos(a) * (R - 14));
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
    const pt = rel < (state.ownStats?.noGoDeg ?? 50) ? 'irons' : rel < 80 ? 'close' : rel < 110 ? 'beam' : rel < 160 ? 'broad' : 'running';
    const point = term(`sail.${pt}` as Key, pt === 'irons' ? 'bad' : '');
    $('nav-text').innerHTML = `${esc(t('hud.wind', { kn: Math.round(state.wind[1] * 30) }))} · ${point} (${rel}°)`;
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
    // A round chart: everything is clipped to the dial the compass ring sits on.
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath();
    g.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    g.clip();
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
    // Night navigation by lights: in the dark a shoal shows only within reach of a light — a lighthouse (3 km),
    // a port (2.5 km) or your own lanterns (600 m).
    const dark = nightFactor(state.estServerTime()) > 0.6;
    const lights: [number, number, number][] = dark ? [[own.x, own.y, 600]] : [];
    if (dark) {
      for (const p of state.ports) if (Math.abs(p.x - own.x) < range + 2500 && Math.abs(p.y - own.y) < range + 2500) lights.push([p.x, p.y, 2500]);
      for (const is of state.islands.values()) if (is.features.includes('lighthouse') && Math.abs(is.x - own.x) < range + 3000 && Math.abs(is.y - own.y) < range + 3000) lights.push([is.x, is.y, 3000]);
    }
    for (const rf of state.reefs.values()) {
      if (Math.abs(rf.x - own.x) > range + rf.r || Math.abs(rf.y - own.y) > range + rf.r) continue;
      if (dark && !lights.some(([lx, ly, lr]) => Math.hypot(rf.x - lx, rf.y - ly) < lr + rf.r)) continue;
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
    // Lighthouses are landmarks: a warm star on the chart.
    for (const is of state.islands.values()) {
      if (!is.features.includes('lighthouse') || Math.abs(is.x - own.x) > range || Math.abs(is.y - own.y) > range) continue;
      g.fillStyle = dark ? '#f5c77a' : 'rgba(245,199,122,0.6)';
      g.beginPath();
      g.arc(tx(is.x), ty(is.y), dark ? 3.2 : 2.2, 0, Math.PI * 2);
      g.fill();
    }
    for (const p of state.ports) {
      if (Math.abs(p.x - own.x) > range || Math.abs(p.y - own.y) > range) continue;
      g.fillStyle = '#e0b862';
      g.fillRect(tx(p.x) - 3, ty(p.y) - 3, 6, 6);
    }
    // Ships by shape (§11.2): circle a friend, square a neutral, diamond an enemy, notched diamond a bounty.
    const cb = settings().colorblind;
    for (const s of state.ships.values()) {
      if (s.id === state.entityId) continue;
      const rel = relationOf(state, s);
      drawRelation(g, rel, tx(s.cur.x), ty(s.cur.y), rel === 'enemy' || rel === 'target' ? 3 : 2.4, cbColor(cb, RELATION_COLOR[rel]));
    }
    drawRelation(g, 'me', W / 2, H / 2, 2.6, RELATION_COLOR.me);
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
      if (m.r < 0) continue;
      g.beginPath();
      g.arc(tx(m.x), ty(m.y), Math.max(3, m.r * k), 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    // Holders of the legendary chart you can hear, and where a cursed map pulls: ticks at the rim.
    const rim = (a: number, color: string) => {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(W / 2 + Math.sin(a) * (W / 2 - 12), H / 2 - Math.cos(a) * (H / 2 - 12));
      g.lineTo(W / 2 + Math.sin(a) * (W / 2 - 3), H / 2 - Math.cos(a) * (H / 2 - 3));
      g.stroke();
      g.lineWidth = 1;
    };
    for (const a of self?.legendEcho ?? []) rim(a, '#e8c65a');
    for (const m of self?.maps ?? []) if (m.bearing !== undefined) rim(m.bearing, '#2ee6c8');
    // Tasks of the sea (docs/11 P6): a nest in view as an orange ring with its mark; the nearest unfinished one
    // beyond it as an orange tick on the rim.
    let near: { x: number; y: number; d: number } | null = null;
    for (const t of state.tasks) {
      const d = Math.hypot(t.x - own.x, t.y - own.y);
      if (Math.max(Math.abs(tx(t.x) - W / 2), Math.abs(ty(t.y) - H / 2)) < W / 2 - 4) {
        g.strokeStyle = t.done ? 'rgba(160,160,160,0.6)' : t.kind === 'wreck' ? 'rgba(80,200,190,0.95)' : t.kind === 'haunt' ? 'rgba(170,130,230,0.95)' : 'rgba(232,140,64,0.95)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(tx(t.x), ty(t.y), Math.max(4, t.r * k), 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 1;
      } else if (!t.done && d < 20000 && (!near || d < near.d)) near = { x: t.x, y: t.y, d };
    }
    if (near) rim(Math.atan2(near.x - own.x, -(near.y - own.y)), '#e88c40');
    // Signs on the horizon (docs/12 P2): a gold "?" where something is happening.
    g.font = '700 11px Inter, sans-serif';
    g.textAlign = 'center';
    for (const sg of state.sights) {
      if (Math.max(Math.abs(tx(sg.x) - W / 2), Math.abs(ty(sg.y) - H / 2)) > W / 2 - 6) continue;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.strokeText('?', tx(sg.x), ty(sg.y) + 4);
      g.fillStyle = '#e8c46a';
      g.fillText('?', tx(sg.x), ty(sg.y) + 4);
    }
    g.lineWidth = 1;
    // The wanted (docs/12 P5): the informant's mark (at the rim when beyond the dial), the pirates a ranked hunter
    // sees, the circles about wanted captains for a licensed hunter, and the lairs with their batteries.
    const wantedV = state.wanted;
    if (wantedV) {
      const skull = (x: number, y: number, col: string, size: number) => {
        g.font = `700 ${size}px Inter, sans-serif`;
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.strokeText('☠', x, y + size / 3);
        g.fillStyle = col;
        g.fillText('☠', x, y + size / 3);
      };
      g.setLineDash([4, 3]);
      g.strokeStyle = 'rgba(224,90,70,0.8)';
      g.lineWidth = 1.2;
      for (const r of wantedV.rogues) {
        g.beginPath();
        g.arc(tx(r.x), ty(r.y), Math.max(6, r.r * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.setLineDash([]);
      for (const l of wantedV.lairs) {
        const lx = tx(l.x), ly = ty(l.y);
        if (Math.max(Math.abs(lx - W / 2), Math.abs(ly - H / 2)) > W / 2 - 6) continue;
        g.fillStyle = l.open ? '#e8c46a' : l.hp > 0 ? '#b0302a' : '#777';
        g.fillRect(lx - 3, ly - 3, 6, 6);
      }
      for (const sp of wantedV.sight) {
        const sx = tx(sp.x), sy = ty(sp.y);
        if (Math.max(Math.abs(sx - W / 2), Math.abs(sy - H / 2)) > W / 2 - 6) continue;
        skull(sx, sy, '#e05a46', 11);
      }
      // One's own caravans (docs/12 P8): green squares, red while pirates are on them; at the rim when far.
      for (const cv of state.caravans) {
        const dx = cv.x - own.x, dy = cv.y - own.y;
        const col = cv.attack !== null ? '#e05a46' : '#6fd46f';
        if (Math.hypot(dx, dy) * k < W / 2 - 8) {
          g.fillStyle = col;
          g.fillRect(tx(cv.x) - 3, ty(cv.y) - 3, 6, 6);
        } else if (cv.attack !== null) rim(Math.atan2(dx, -dy), col);
      }
      // The tipped merchants at sea (docs/12 P6): gold diamonds, or at the rim.
      for (const mk of state.raid?.marks ?? []) {
        const dx = mk.x - own.x, dy = mk.y - own.y;
        if (Math.hypot(dx, dy) * k < W / 2 - 8) {
          g.fillStyle = '#f2c14e';
          g.strokeStyle = 'rgba(0,0,0,0.8)';
          g.beginPath();
          g.moveTo(tx(mk.x), ty(mk.y) - 5);
          g.lineTo(tx(mk.x) + 4, ty(mk.y));
          g.lineTo(tx(mk.x), ty(mk.y) + 5);
          g.lineTo(tx(mk.x) - 4, ty(mk.y));
          g.closePath();
          g.fill();
          g.stroke();
        } else rim(Math.atan2(dx, -dy), '#f2c14e');
      }
      if (wantedV.informed) {
        const dx = wantedV.informed.x - own.x, dy = wantedV.informed.y - own.y;
        if (Math.hypot(dx, dy) * k < W / 2 - 8) skull(tx(wantedV.informed.x), ty(wantedV.informed.y), '#ff6a4a', 14);
        else rim(Math.atan2(dx, -dy), '#ff6a4a');
      }
      g.lineWidth = 1;
      g.font = '700 11px Inter, sans-serif';
    }
    // The followed quest's goal (docs/11 P6): a gold diamond on the chart, or at the rim toward it.
    const qp = questPointer(trackedQuest(self?.quests), own.x, own.y, state.region);
    if (qp) {
      const dx = qp.x - own.x, dy = qp.y - own.y;
      const inside = Math.hypot(dx, dy) * k < W / 2 - 8;
      const a = Math.atan2(dx, -dy);
      const qx = inside ? tx(qp.x) : W / 2 + Math.sin(a) * (W / 2 - 8), qy = inside ? ty(qp.y) : H / 2 - Math.cos(a) * (H / 2 - 8);
      g.fillStyle = '#d9b25a';
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.beginPath();
      g.moveTo(qx, qy - 5);
      g.lineTo(qx + 4, qy);
      g.lineTo(qx, qy + 5);
      g.lineTo(qx - 4, qy);
      g.closePath();
      g.fill();
      g.stroke();
    }
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
    // Sieges you are part of: the landing point as a red ring.
    g.strokeStyle = '#e0655a';
    for (const x of state.holdings.sieges) {
      g.beginPath();
      g.arc(tx(x.landing.x), ty(x.landing.y), 5, 0, Math.PI * 2);
      g.stroke();
    }
    // Your group: green squares; they stay on the chart however far they sail.
    g.fillStyle = '#7fd08a';
    for (const m of state.party?.members ?? []) {
      if (m.name === state.self?.name || m.docked || !m.online) continue;
      const mx = clamp(tx(m.x), 3, c.width - 3), my = clamp(ty(m.y), 3, c.height - 3);
      g.fillRect(mx - 2.5, my - 2.5, 5, 5);
    }
    // World bosses within reach: a large violet ring.
    g.strokeStyle = '#b07ae0';
    g.lineWidth = 2;
    for (const b of state.bosses) {
      g.beginPath();
      g.arc(clamp(tx(b.x), 6, c.width - 6), clamp(ty(b.y), 6, c.height - 6), 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = 1;
    // The Abyss: Islands of Light, dead-wind zones, the Eye, and the sails your lookouts only think they see.
    const ab = self?.abyss;
    if (ab) {
      g.fillStyle = 'rgba(255,245,210,0.9)';
      for (const l of ab.lights) {
        g.beginPath();
        g.arc(tx(l.x), ty(l.y), 3, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(160,160,170,0.5)';
      for (const z of ab.deadWinds) {
        g.beginPath();
        g.arc(tx(z.x), ty(z.y), Math.max(3, z.r * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = '#7a4bd0';
      g.beginPath();
      g.arc(tx(ab.eye.x), ty(ab.eye.y), 5, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#e0655a';
      for (const [px, py] of ab.phantoms) {
        g.beginPath();
        g.arc(tx(px), ty(py), 3, 0, Math.PI * 2);
        g.fill();
      }
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
    // The wind on the rim: where it blows from, an arrow pointing where it goes (phones have no compass).
    const wv = headingVec(state.wind[0]);
    const r0 = W / 2 - 22;
    g.strokeStyle = 'rgba(143,179,217,0.9)';
    g.fillStyle = 'rgba(143,179,217,0.9)';
    g.lineWidth = 2 + state.wind[1] * 2;
    g.beginPath();
    g.moveTo(W / 2 - wv.x * r0, H / 2 - wv.y * r0);
    g.lineTo(W / 2 - wv.x * (r0 - 26), H / 2 - wv.y * (r0 - 26));
    g.stroke();
    g.beginPath();
    g.moveTo(W / 2 - wv.x * (r0 - 34), H / 2 - wv.y * (r0 - 34));
    g.lineTo(W / 2 - wv.x * (r0 - 22) - wv.y * 6, H / 2 - wv.y * (r0 - 22) + wv.x * 6);
    g.lineTo(W / 2 - wv.x * (r0 - 22) + wv.y * 6, H / 2 - wv.y * (r0 - 22) - wv.x * 6);
    g.fill();
    g.lineWidth = 1;
    g.restore();
  }

  private recentToasts = new Map<string, number>();

  toast(msg: string, kind: string): void {
    // Collapse repeats (e.g. mashing fire while reloading).
    const now = performance.now();
    if ((this.recentToasts.get(msg) ?? 0) > now - 2500) return;
    this.recentToasts.set(msg, now);
    if (this.recentToasts.size > 50) this.recentToasts.clear();
    // The same words still on screen: that toast comes back to the top with a count, it is not stacked twice.
    const same = [...this.toastsEl.children].find((c) => (c as HTMLElement).dataset.msg === msg) as HTMLElement | undefined;
    if (same) {
      const n = Number(same.dataset.n ?? 1) + 1;
      same.dataset.n = String(n);
      let badge = same.querySelector<HTMLElement>('.t-count');
      if (!badge) {
        badge = document.createElement('b');
        badge.className = 't-count';
        same.append(badge);
      }
      badge.textContent = `×${n}`;
      this.toastsEl.prepend(same);
      clearTimeout(Number(same.dataset.timer));
      same.dataset.timer = String(setTimeout(() => same.remove(), kind === 'xp' ? 3500 : 7000));
      return;
    }
    const el = document.createElement('div');
    el.dataset.msg = msg;
    el.className = `toast ${kind}`;
    const art = kind === 'gold' ? 'coin' : kind === 'xp' ? 'xp' : kind === 'bad' ? 'danger' : kind === 'good' ? 'anchor' : '';
    el.innerHTML = `${art ? icon(art, '', 'ico-toast') : ''}<span>${esc(keyless(msg))}</span>`;
    decorateSums(el);
    this.toastsEl.prepend(el);
    while (this.toastsEl.children.length > 7) this.toastsEl.lastChild!.remove();
    el.dataset.timer = String(setTimeout(() => el.remove(), kind === 'xp' ? 3500 : 7000));
  }

  /** A sound caption at the edge of the screen it came from (docs/07 §11.5). */
  caption(text: string, dir: 'ahead' | 'astern' | 'port' | 'starboard' | 'near'): void {
    const el = document.createElement('div');
    el.className = `caption cap-${dir}`;
    el.textContent = text;
    $('captions').append(el);
    while ($('captions').children.length > 4) $('captions').firstChild!.remove();
    setTimeout(() => el.remove(), 3500);
  }

  /** Letters waiting: a small seal by the minimap. */
  setUnread(n: number): void {
    const el = $('unread');
    el.textContent = n ? `✉ ${n}` : '';
    el.classList.toggle('hidden', !n);
  }

  banner(title: string, sub: string): void {
    // A heading starts with a capital even when the name reads lower-case inside a sentence ("море Грейвуотер").
    title = title.charAt(0).toUpperCase() + title.slice(1);
    // A phone has no free middle of the screen: the herald joins the toast column, where nothing covers it.
    if (matchMedia('(max-width: 699px), (max-height: 520px)').matches) {
      const el = document.createElement('div');
      el.className = 'toast herald';
      el.innerHTML = `<b>${esc(title)}</b><small>${esc(sub)}</small>`;
      this.toastsEl.prepend(el);
      while (this.toastsEl.children.length > 7) this.toastsEl.lastChild!.remove();
      setTimeout(() => el.remove(), 5000);
      return;
    }
    const b = $('banner');
    b.innerHTML = `${esc(title)}<small>${esc(sub)}</small>`;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), 3500);
  }

  /** Party frames (docs/11 P6), as WoW's: each groupmate's name, level and hull, and where they are — a bearing
   *  and the distance, in port, or ashore. Four at most, then "+N". */
  /**
   * The target frame (canon D12), as WoW's: her level in the colour of the danger, her name, class and role, how she
   * holds (hull, crew, sails), what ails her, how far she lies, and in a word what a fight with her would be.
   */
  drawTarget(state: ClientState, id: number | null): void {
    const el = $('hud-target');
    const s = id !== null ? state.ships.get(id) : undefined;
    const own = state.ownDisplay;
    if (!s?.info || !own || state.self?.dockedAt) {
      if (this.lastTargetKey) {
        this.lastTargetKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const info = s.info, c = s.cur;
    const cls = SHIP_CLASSES[info.classId];
    const d = Math.hypot(c.x - own.x, c.y - own.y);
    const dist = d < 1000 ? `${Math.round(d / 10) * 10} ${L('m')}` : `${(d / 1000).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${L('km')}`;
    const threat = info.shipLevel ? threatTo(info.shipLevel, info.classId) : null;
    const fx = [
      c.flags & SF.FIRE ? L('tg.fire') : '',
      c.flags & SF.SURRENDERED ? L('tg.struck') : '',
      c.flags & SF.BOARDING ? L('tg.boarding') : '',
      c.flags & (SF.SLOWED | SF.TANGLED) ? L('tg.slowed') : '',
      c.flags & SF.REPAIRING ? L('tg.repairing') : '',
    ].filter(Boolean);
    const ap = state.appraisal?.id === id ? state.appraisal : null;
    const struck = !info.isPlayer && info.npcRole === 'merchant' && (c.flags & SF.SURRENDERED) !== 0 && d < 400;
    const key = `${lang()}|${id}|${info.shipLevel}|${threat}|${Math.round(c.hull * 50)}|${Math.round(c.crew * 50)}|${Math.round(c.sails * 50)}|${fx.join(',')}|${dist}|${ap ? `${ap.value}|${ap.fill}|${ap.escorts}|${ap.dest}` : ''}|${struck}`;
    if (key === this.lastTargetKey) return;
    this.lastTargetKey = key;
    el.classList.remove('hidden');
    const beast = beastOfClass(info.classId);
    const named = info.named ? namedLabel(info.named) : null;
    const name = beast ? BEASTS[beast].name[lang() === 'ru' ? 1 : 0] : named ? named.name : info.isPlayer ? `${info.captainName} · ${placeName(info.name)}` : placeName(info.name);
    const role = info.isPlayer ? L('tg.lv', { n: info.level ?? 1 }) : info.npcRole && `role.${info.npcRole}` in REN ? RL(`role.${info.npcRole}` as 'role.merchant') : '';
    const bar = (k: string, v: number) => `<span class="tg-bar tg-${k}"><i style="width:${pct(clamp(v, 0, 1))}"></i></span>`;
    if (beast) {
      // A beast of the sea (docs/12 P4): its nature instead of a class and a role, and only its hide for a bar.
      const temper = BEASTS[beast].temper;
      const nature = temper === 'shy' || temper === 'tusk' ? L('tg.shy') : temper === 'ram' ? L('tg.ram') : L('tg.predator');
      el.className = `hud-block tg${info.elite ? ' tg-elite' : ''}${threat ? ` tg-${threat}` : ''}`;
      el.innerHTML = `<div class="tg-head">${info.shipLevel ? levelChip(info.shipLevel, info.classId) : ''}<b class="tg-name">${esc(name)}</b><span class="tg-dist">${esc(dist)}</span></div>
      <div class="tg-sub muted">${esc(nature)}${info.elite ? ` · <span class="tg-el">${esc(L('tg.elite'))}</span>` : ''}</div>
      ${bar('hull', c.hull)}
      <div class="tg-foot">${threat ? `<span class="tg-threat" style="color:${THREAT_COLOR[threat]}">${esc(L(`tg.${threat}`))}</span>` : ''}</div>`;
      el.onclick = null;
      return;
    }
    el.className = `hud-block tg${info.elite ? ' tg-elite' : ''}${threat ? ` tg-${threat}` : ''}`;
    el.innerHTML = `<div class="tg-head">${info.shipLevel ? levelChip(info.shipLevel, info.classId) : ''}<b class="tg-name">${esc(name)}</b><span class="tg-dist">${esc(dist)}</span></div>
      <div class="tg-sub muted">${named ? `<span class="tg-wanted">${esc(named.tag)}</span> · ` : ''}${esc([cls?.name ?? info.classId, role].filter(Boolean).join(' · '))}${info.elite ? ` · <span class="tg-el">${esc(L('tg.elite'))}</span>` : ''}</div>
      ${bar('hull', c.hull)}${bar('crew', c.crew)}${bar('sails', c.sails)}
      ${ap ? `<div class="tg-glass">${esc(L(ap.exact ? 'tg.glassExact' : 'tg.glass', { v: ap.value.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB'), fill: Math.round(ap.fill * 100), esc: ap.escorts, crew: ap.crew }))}${ap.dest ? ` · ${esc(L('tg.glassDest', { port: placeName(ap.dest) }))}` : ''}</div>` : ''}
      <div class="tg-foot">${threat ? `<span class="tg-threat" style="color:${THREAT_COLOR[threat]}">${esc(L(`tg.${threat}`))}</span>` : ''}${fx.length ? `<span class="tg-fx">${esc(fx.join(' · '))}</span>` : ''}${struck ? `<button class="btn btn-small tg-tribute" data-tribute="${id}">${esc(L('tg.tribute'))}</button>` : ''}</div>`;
    el.querySelector<HTMLElement>('[data-tribute]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onTribute(id!);
    });
    el.onclick = info.isPlayer ? () => this.onTargetTap(info.captainName) : null;
  }

  /**
   * The hunt (docs/12 P4): the beast on the line — the tension against its band, its strength and hide — the carcass
   * being flensed, one alongside to flense, or, with a shy beast near, the noise of her way.
   */
  /** The regatta's panel (docs/12 P10 #5): the buoy she sails for, where, and her time. */
  private drawRegatta(state: ClientState): void {
    const el = $('hud-regatta');
    const html = regattaPanel(state);
    const key = html ?? '';
    if (key === this.lastRegattaKey) return;
    this.lastRegattaKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  /** The Descent (docs/12 P10 #17): the tier, its creatures, current and darkness, and the clock. */
  private drawDescent(state: ClientState): void {
    const el = $('hud-descent');
    const html = descentPanel(state);
    const key = html ?? '';
    if (key === this.lastDescentKey) return;
    this.lastDescentKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  /** A letter of marque's fleet order (docs/12 P10 #15): what, how far along, which way, the sunset. */
  private drawOrder(state: ClientState): void {
    const el = $('hud-order');
    const html = orderPanel(state);
    const key = html ?? '';
    if (key === this.lastOrderKey) return;
    this.lastOrderKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  /** The heart of the storm (docs/12 P10 #14): where it is, her charge, her hearts. */
  private drawStorm(state: ClientState): void {
    const el = $('hud-storm');
    const html = stormPanel(state);
    const key = html ?? '';
    if (key === this.lastStormKey) return;
    this.lastStormKey = key;
    el.classList.toggle('hidden', !html);
    el.innerHTML = html ?? '';
  }

  private drawHunt(state: ClientState): void {
    const el = $('hud-hunt');
    const v = state.hunt, own = state.ownDisplay, you = state.you;
    const ru = lang() === 'ru' ? 1 : 0;
    const bname = (id: BeastId) => BEASTS[id].name[ru];
    let shy: BeastId | null = null;
    if (!v && own && you && !state.self?.dockedAt) {
      let bd = 1500;
      for (const r of state.ships.values()) {
        const id = r.info ? beastOfClass(r.info.classId) : undefined;
        if (!id || !BEASTS[id].spookRange) continue;
        const d = Math.hypot(r.cur.x - own.x, r.cur.y - own.y);
        if (d < bd) {
          bd = d;
          shy = id;
        }
      }
    }
    if (!v && !shy) {
      if (this.lastHuntKey) {
        this.lastHuntKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const line = v?.line;
    const mode = line ? (line.spent ? 'spent' : 'line') : v?.flense ? 'flense' : v?.carcass ? 'carcass' : 'noise';
    const noise = you ? hullNoise(you.spd, state.ownStats?.maxSpeed ?? 10, you.combat ? 5 : 999) : 0;
    const band = noiseBand(noise);
    const key = `${lang()}|${mode}|${line?.beast ?? v?.flense?.beast ?? v?.carcass?.beast ?? shy}|${line?.payIn ?? ''}|${v?.carcass?.id ?? ''}|${mode === 'noise' ? band : ''}`;
    if (key !== this.lastHuntKey) {
      this.lastHuntKey = key;
      el.classList.remove('hidden');
      el.classList.toggle('hp-active', mode !== 'noise');
      if (line) {
        const b = bname(line.beast);
        const top = Math.max(120, line.snap * 1.1);
        el.innerHTML = `<div class="fp-head"><b>${esc(L(line.spent ? 'hunt.spent' : 'hunt.line', { beast: b }))}</b><span class="hp-lvl">⚓${line.level}</span></div>
          <div class="hp-row"><span>${esc(L('hunt.tension'))}</span><div class="hp-bar hp-t"><em class="hp-good" style="left:${(line.good[0] / top) * 100}%;width:${((line.good[1] - line.good[0]) / top) * 100}%"></em><em class="hp-snap" style="left:${(line.snap / top) * 100}%"></em><em class="hp-slack" style="width:${(line.slack / top) * 100}%"></em><i></i></div></div>
          <div class="hp-row"><span>${esc(L('hunt.stamina'))}</span><div class="hp-bar hp-s"><i></i></div></div>
          <div class="hp-row"><span>${esc(L('hunt.hull'))}</span><div class="hp-bar hp-h"><i></i></div></div>
          <div class="fp-line muted hp-hint">${esc(L(line.spent ? 'hunt.hintSpent' : 'hunt.hint'))}</div>
          <div class="fp-acts">${line.spent ? '' : `<button class="btn btn-small" data-hunt="slack"${line.payIn ? ' disabled' : ''}>${esc(line.payIn ? L('hunt.slackIn', { n: line.payIn }) : L('hunt.slack'))}</button>`}<button class="btn btn-small" data-hunt="cut">${esc(L('hunt.cut'))}</button></div>`;
      } else if (v?.flense) {
        el.innerHTML = `<div class="fp-head"><b>${esc(L('hunt.flense', { beast: bname(v.flense.beast) }))}</b></div>
          <div class="hp-row"><div class="hp-bar hp-f"><i></i></div></div>
          <div class="fp-line muted hp-hint">${esc(L('hunt.flenseHint'))}</div>`;
      } else if (v?.carcass) {
        el.innerHTML = `<div class="fp-head"><b>${esc(L('hunt.carcass', { beast: bname(v.carcass.beast) }))}</b></div>
          <div class="fp-line muted">${esc(L('hunt.carcassHint'))}</div>
          <div class="fp-acts"><button class="btn btn-small btn-primary" data-hunt="flense" data-id="${v.carcass.id}">${esc(L('hunt.flenseGo'))}</button></div>`;
      } else {
        el.innerHTML = `<div class="fp-head"><b class="hp-noise hp-${band}">${esc(L('hunt.noise', { band: L(`hunt.${band}` as 'hunt.quiet') }))}</b></div>
          <div class="fp-line muted">${esc(L('hunt.noiseHint', { beast: bname(shy!) }))}</div>`;
      }
      el.querySelectorAll<HTMLElement>('[data-hunt]').forEach((b) => (b.onclick = () => this.onHunt(b.dataset.hunt as 'slack', b.dataset.id ? Number(b.dataset.id) : undefined)));
    }
    // The bars move every frame without rebuilding the block.
    if (line) {
      const t = el.querySelector<HTMLElement>('.hp-t > i');
      if (t) {
        t.style.width = `${Math.min(100, (line.tension / Math.max(120, line.snap * 1.1)) * 100)}%`;
        t.style.background = line.tension > line.snap * 0.92 || line.tension < line.slack ? '#e0473a' : line.tension >= line.good[0] && line.tension <= line.good[1] ? '#6fd46f' : '#e8a14a';
      }
      const s = el.querySelector<HTMLElement>('.hp-s > i');
      if (s) s.style.width = `${line.stamina * 100}%`;
      const h = el.querySelector<HTMLElement>('.hp-h > i');
      if (h) h.style.width = `${line.hull * 100}%`;
    } else if (v?.flense) {
      const f = el.querySelector<HTMLElement>('.hp-f > i');
      if (f) f.style.width = `${v.flense.progress * 100}%`;
    }
  }

  /** The fishing panel (docs/12 P3): the tackle, what it wants now, and the orders at hand. */
  private drawFishing(state: ClientState): void {
    const el = $('hud-fish');
    const self = state.self, own = state.ownDisplay, you = state.you;
    const f = self?.fishing;
    const fishAboard = (self?.cargo.fish ?? 0) > 0 && (self?.cargo.salt ?? 0) > 0;
    if (!self || !own || !you || !f || self.dockedAt || (!f.method && !fishAboard)) {
      if (this.lastFishKey) {
        this.lastFishKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const max = state.ownStats?.maxSpeed ?? 10;
    const spd = you.spd;
    const inShoal = state.shoals.some((s) => Math.hypot(s.x - own.x, s.y - own.y) <= s.r);
    const night = isNight(state.estServerTime());
    const need: Record<string, number> = { net: 1, rod: 1, trap: 15, lamp: 30 };
    let line = '';
    if (f.method && f.skill < need[f.method]) line = L('fish.low', { n: f.skill, need: need[f.method] });
    else if (f.method === 'net') line = inShoal ? (spd > max * 0.4 || spd < 0.5 ? L('fish.slow') : L('fish.inShoal')) : L('fish.findShoal');
    else if (f.method === 'rod') line = spd >= 2.5 && spd <= max * 0.8 ? L('fish.rodOk') : L('fish.rodPace');
    else if (f.method === 'lamp') line = night && spd <= 1.5 ? L('fish.lampOk') : L('fish.lampNight');
    else if (f.method === 'trap') line = L('fish.traps', { n: f.traps.length, max: 3 + Math.floor(f.skill / 25) });
    const nearTrap = f.traps.some((t) => Math.hypot(t.x - own.x, t.y - own.y) < 90);
    const acts: [string, string][] = [];
    if (f.method === 'trap') acts.push(nearTrap ? ['haul', L('fish.haul')] : ['trap', L('fish.setTrap')]);
    if (f.method === 'rod' && f.skill >= 60) acts.push(['deep', L('fish.deep')]);
    if (fishAboard) acts.push(['salt', L('fish.salt')]);
    const key = `${lang()}|${f.skill}|${Math.round((f.xp / Math.max(1, f.next)) * 20)}|${f.method}|${line}|${acts.map((a) => a[0]).join(',')}`;
    if (key === this.lastFishKey) return;
    this.lastFishKey = key;
    el.classList.remove('hidden');
    el.innerHTML = `<div class="fp-head"><b>${esc(L('fish.title', { n: f.skill }))}</b><span class="muted">${esc(f.method ? L(`fish.${f.method}` as 'fish.net') : L('fish.none'))}</span></div>
      <span class="fp-xp"><i style="width:${pct(f.xp / Math.max(1, f.next))}"></i></span>
      <div class="fp-line muted">${esc(line)}</div>
      ${acts.length ? `<div class="fp-acts">${acts.map(([a, n]) => `<button class="btn btn-small" data-fish="${a}">${esc(n)}</button>`).join('')}</div>` : ''}`;
    el.querySelectorAll<HTMLElement>('[data-fish]').forEach((b) => (b.onclick = () => this.onFishing(b.dataset.fish as 'trap')));
  }

  private drawParty(state: ClientState): void {
    const el = $('hud-party');
    const g = state.party;
    const own = state.ownDisplay;
    const mates = (g?.members ?? []).filter((m) => m.name !== state.self?.name);
    if (!g || !mates.length || !own) {
      if (this.lastPartyKey) {
        this.lastPartyKey = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const rows = mates.slice(0, 4).map((m) => {
      const d = Math.hypot(m.x - own.x, m.y - own.y);
      const where = !m.online ? L('partyAshore') : m.docked ? L('partyInPort') : d < 150 ? L('partyNear') : `${d < 1000 ? `${Math.round(d / 10) * 10} ${L('m')}` : `${(d / 1000).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${L('km')}`}`;
      const deg = Math.round((Math.atan2(m.x - own.x, -(m.y - own.y)) * 180) / Math.PI / 15) * 15;
      return { m, where, deg: m.online && !m.docked && d >= 150 ? deg : null };
    });
    const key = `${lang()}|${g.leader}|${rows.map((r) => `${r.m.name}:${r.m.level}:${Math.round(r.m.hull * 20)}:${r.where}:${r.deg}:${r.m.inConvoy ? 1 : 0}`).join('|')}|${mates.length}`;
    if (key === this.lastPartyKey) return;
    this.lastPartyKey = key;
    el.classList.remove('hidden');
    el.innerHTML = rows.map(({ m, where, deg }) => `<button class="pf${m.online ? '' : ' off'}" data-pf="${esc(m.name)}"><span class="pf-top"><b>${m.accountId === g.leader ? '⚑ ' : ''}${esc(m.name)}</b><span class="pf-lv">${m.level}</span></span><span class="fbar pf-hull"><i style="width:${pct(m.hull)}"></i></span><span class="pf-where">${deg !== null ? `<i class="pf-arrow" style="transform:rotate(${deg}deg)">▲</i>` : ''}${esc(where)}${m.inConvoy ? ` · ${esc(L('partyConvoy'))}` : ''}</span></button>`).join('') + (mates.length > 4 ? `<span class="pf-more">+${mates.length - 4}</span>` : '');
    el.querySelectorAll<HTMLElement>('[data-pf]').forEach((b) => (b.onclick = () => this.onPartyTap(b.dataset.pf!)));
  }

  chat(from: string, text: string, ch?: 'group' | 'guild' | 'whisper', to?: string): void {
    const log = $('chat-log');
    const d = document.createElement('div');
    if (ch) d.className = `chat-${ch}`;
    // A whisper: from someone, or one's own words to someone (echoed back).
    const tag = ch === 'group' ? L('chatGroup') : ch === 'guild' ? L('chatGuild') : ch === 'whisper' ? (to ? L('chatWhisperTo', { name: to }) : L('chatWhisper')) : '';
    d.innerHTML = `${tag ? `<i>${esc(tag)}</i> ` : ''}${to ? '' : `<b>${esc(from)}:</b> `}${esc(text)}`;
    log.append(d);
    // Sixty lines kept (the channels filter them); closed, the chat shows its last eight.
    while (log.children.length > 60) log.firstChild!.remove();
    log.scrollTop = log.scrollHeight;
  }

  /** The chat's channels (docs/11 P6): all, the group, the guild, whispers — a filter on the lines, and where
   *  words without a prefix go. */
  chatTabs(onPick: (ch: ChatChannel) => void): void {
    const el = $('chat-tabs');
    const chat = $('chat');
    const cur = (chat.dataset.filter as ChatChannel | undefined) ?? 'all';
    el.innerHTML = CHAT_CHANNELS.map((ch) => `<button class="ct${ch === cur ? ' on' : ''}" data-ct="${ch}">${esc(L(`ct_${ch}`))}</button>`).join('');
    el.querySelectorAll<HTMLElement>('[data-ct]').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // the field keeps its focus (and a phone its keyboard)
      const ch = b.dataset.ct as ChatChannel;
      chat.dataset.filter = ch;
      el.querySelectorAll('.ct').forEach((x) => x.classList.toggle('on', x === b));
      const log = $('chat-log');
      log.scrollTop = log.scrollHeight;
      onPick(ch);
    }));
  }
}

export type ChatChannel = 'all' | 'group' | 'guild' | 'whisper';
const CHAT_CHANNELS: ChatChannel[] = ['all', 'group', 'guild', 'whisper'];

function sanityWord(v: number): string {
  return L(v > 75 ? 'sanity.clear' : v > 50 ? 'sanity.uneasy' : v > 25 ? 'sanity.afraid' : v > 10 ? 'sanity.terror' : 'sanity.madness');
}

function weatherWord(w: string): string {
  const k = `weather.${w}`;
  return k in EN ? L(k as keyof typeof EN & string) : w.replace('_', ' ');
}

function seasonWord(s: string): string {
  const k = `season.${s}`;
  return k in EN ? L(k as keyof typeof EN & string) : s;
}

/** A frame bar: label left, value right, the fill under both. */
function fbar(cls: string, v: number, max: number, label: string, art = ''): string {
  return `<div class="fbar ${cls}"><i style="width:${pct(v / Math.max(1, max))}"></i><span><b>${art ? icon(art, '', 'ico-bar') : ''}<em>${esc(label)}</em></b><b>${fmt(v)} / ${fmt(max)}</b></span></div>`;
}

/** The weather's picture for the region line. */
function weatherArt(w: string): string {
  return w === 'fog' ? 'weather_fog' : w === 'storm' || w === 'black_storm' || w === 'rain' ? 'weather_storm' : w === 'wind' ? 'wind' : 'weather_clear';
}

/** An action-bar slot: the icon (or a glyph and the name while the art loads), key, count and overlays. */
function slot(o: { data: string; cls: string; art: string; glyph: string; name: string; key: string; title: string; qty?: string; extra?: string }): string {
  const img = icon(o.art);
  return `<div class="slot ${o.cls} ${img ? 'has-art' : ''}" ${o.data} title="${esc(o.title)}">${img || `<span class="glyph">${esc(o.glyph)}</span>`}<span class="nm">${esc(o.name)}</span><span class="k">${esc(o.key)}</span>${o.qty !== undefined ? `<span class="q">${esc(o.qty)}</span>` : ''}${o.extra ?? ''}</div>`;
}

/** A label without its keyboard hint ("[Q] Port" → "Port") on touch screens. */
/** Where the ship panel drops from: the unit frame's lowest drawn edge (kept until the frame has been drawn). */
function placeShipPanel(): void {
  const low = Math.max(0, ...[...$('hud-captain').querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0).map((r) => r.bottom));
  if (low > 40) document.body.style.setProperty('--uf-bottom', `${Math.round(low)}px`);
}

/** The key an action is bound to (the player may have rebound it), as a small chip; none on a touch screen. */
function keyChip(a: Action): string {
  if (document.body.classList.contains('touch')) return '';
  const [k1, k2] = settings().keys[a];
  return `<kbd class="kchip">${esc(keyLabel(k1 || k2))}</kbd>`;
}

function keyless(s: string): string {
  // "[T]", "(T)", "(Y → Company)": a touch screen has no keys to name.
  return document.body.classList.contains('touch') ? s.replace(/\[[^\]]*\]\s*/g, '').replace(/\s*\((?:[A-Z0-9]{1,3}|[^()]*→[^()]*)\)/g, '').trim() : s;
}

/** A named pirate (docs/12 P5) or one of her lieutenants ("id#n"): the name in the player's tongue and the tag. */
export function namedLabel(named: string): { name: string; tag: string } | null {
  const [id, mate] = named.split('#');
  const np = pirateById(id);
  if (!np) return null;
  const ru = lang() === 'ru' ? 1 : 0;
  if (mate !== undefined) return { name: np.lieutenants[Number(mate)]?.name[ru] ?? np.name[ru], tag: L('tg.wantedMate') };
  const nem = nemesisLabel(id); // her own nemesis: his new name and the grudge's rank (docs/12 P10 #1)
  if (nem) return nem;
  const n = np.bounty.toLocaleString(ru ? 'ru-RU' : 'en-GB');
  return { name: np.name[ru], tag: np.baron ? L('tg.baron', { n }) : L('tg.wanted', { n }) };
}
