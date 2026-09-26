// Client entry: login → captain selection → the ocean. Wires network, state, input, renderer and UI.

import { CAPTAINS } from '../../shared/src/data/captains.ts';
import { AMMO_IDS, CHASER_CONE, SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { PORT_DOCK_RADIUS } from '../../shared/src/constants.ts';
import { clamp, dist, toShipLocal } from '../../shared/src/math.ts';
import type { Aggression, ServerMsg } from '../../shared/src/protocol.ts';
import { SF, STATIONS } from '../../shared/src/protocol.ts';
import { REGIONS } from '../../shared/src/world/regions.ts';
import { assetUrl, loadAssets } from './assets.ts';
import { AudioEngine } from './audio.ts';
import { Net } from './net.ts';
import { Renderer } from './render/renderer.ts';
import { ClientState } from './state.ts';
import { showCaptainSelect } from './ui/captain.ts';
import { renderBoarding, renderHelp, renderShip, renderSunk } from './ui/dialogs.ts';
import { $, esc } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';
import { PortScreen } from './ui/port.ts';
import { renderTalents } from './ui/talents.ts';
import { WorldMap } from './ui/worldmap.ts';

type Modal = 'port' | 'talents' | 'map' | 'ship' | 'help' | 'boarding' | 'sunk' | null;

const net = new Net();
const state = new ClientState();
const renderer = new Renderer($('world') as HTMLCanvasElement);
const hud = new Hud();
const audio = new AudioEngine();
renderer.onLightning = () => audio.thunder();
for (const ev of ['keydown', 'mousedown', 'touchstart'] as const) addEventListener(ev, () => audio.unlock(), { passive: true });
const worldMap = new WorldMap();
let modal: Modal = null;
let inGame = false;
let lastSunk: { lost: { cargoValue: number; crew: number; repairFee: number }; port: string } | null = null;
const keys = new Set<string>();
let lastInputSent = 0;
let lastInputKey = '';
let boardTarget: number | null = null;
let aimSide: 'port' | 'starboard' | null = null;

const portScreen = new PortScreen((m) => net.send(m), () => closeModal());

// ------------------------------------------------------------------ boot

loadAssets(null).then(() => {
  const url = assetUrl('art.keyart');
  const ka = document.querySelector<HTMLElement>('.keyart');
  if (ka && url) ka.style.backgroundImage = `url('${url}')`;
});

if (net.token) net.connect();
else $('login-name').focus();

($('login-form') as HTMLFormElement).onsubmit = (e) => {
  e.preventDefault();
  const name = ($('login-name') as HTMLInputElement).value.trim();
  if (name.length < 3) {
    $('login-error').textContent = 'A captain needs a name of at least three letters.';
    return;
  }
  net.forget();
  net.connect(name);
};

net.onStatus = (ok) => $('connection').classList.toggle('hidden', ok || !inGame);
net.on(onMessage);

function onMessage(m: ServerMsg): void {
  state.apply(m);
  switch (m.t) {
    case 'err':
      if (m.msg === 'auth_required') {
        net.forget();
        $('screen-login').classList.remove('hidden');
      } else if (!inGame) $('login-error').textContent = m.msg;
      else hud.toast(m.msg, 'bad');
      break;
    case 'welcome':
      $('screen-login').classList.add('hidden');
      if (!m.hasCaptain) showCaptainSelect((captain, shipName) => net.send({ t: 'create_captain', captain, shipName }));
      break;
    case 'init':
      inGame = true;
      $('screen-captain').classList.add('hidden');
      hud.show(true);
      if (state.you === null && m.self.dockedAt) openModal('port');
      if (!localStorage.getItem('gravetide.helpSeen')) {
        localStorage.setItem('gravetide.helpSeen', '1');
        openModal('help');
      }
      break;
    case 'port':
      if (m.view && modal !== 'port') audio.bell();
      // Never steal focus from another open screen (handbook, boarding, shipwreck); they return to port on close.
      if (m.view && modal === null) openModal('port');
      else if (!m.view && modal === 'port') closeModal();
      else if (modal === 'port') refreshModal();
      break;
    case 'self':
      if (modal === 'port' || modal === 'talents' || modal === 'ship') refreshModal();
      break;
    case 'boarding':
      if (m.result) openModal('boarding');
      else if (modal === 'boarding') closeModal();
      break;
    case 'sunk_self':
      lastSunk = { lost: m.lost, port: state.ports.find((p) => p.id === m.respawnPort)?.name ?? 'port' };
      openModal('sunk');
      break;
    case 'toast':
      hud.toast(m.msg, m.kind);
      if (m.kind === 'gold') audio.coins();
      break;
    case 'chat':
      hud.chat(m.from, m.text);
      break;
    case 'ev':
      for (const e of m.list) {
        renderer.fx.onEvent(e, state.entityId);
        audio.onEvent(e);
        if (e.k === 'region') {
          const r = REGIONS[e.region];
          hud.banner(r.name, `${r.safety === 'safe' ? 'Safe waters' : r.safety === 'contested' ? 'Contested waters' : 'Lawless waters'} — ${r.mood}`);
        } else if (e.k === 'discover' && !e.quiet) hud.toast(`Charted: ${e.name}`, 'xp');
        else if (e.k === 'board_start' && (e.a === state.entityId || e.b === state.entityId)) hud.toast('Grapples away! Boarding action!', 'info');
      }
      if (modal === 'map') worldMap.draw(state);
      break;
  }
}

// ------------------------------------------------------------------ modals

function openModal(m: Modal): void {
  modal = m;
  $('modal').classList.toggle('hidden', m === null);
  refreshModal();
}

function closeModal(): void {
  const was = modal;
  modal = null;
  $('modal').classList.add('hidden');
  // While docked, closing another screen returns to the harbour (Esc on the harbour itself hides it; P reopens).
  if (was !== 'port' && state.portView) openModal('port');
}

function refreshModal(): void {
  const root = $('modal-panel');
  switch (modal) {
    case 'port':
      if (state.portView) portScreen.render(root, state);
      else closeModal();
      break;
    case 'talents':
      renderTalents(root, state, (id) => net.send({ t: 'learn_talent', id }));
      break;
    case 'map':
      worldMap.open(root, state);
      break;
    case 'ship':
      renderShip(root, state);
      break;
    case 'help':
      renderHelp(root);
      break;
    case 'boarding':
      if (state.boarding) renderBoarding(root, state.boarding, state, (m) => net.send(m), () => closeModal());
      break;
    case 'sunk':
      if (lastSunk) renderSunk(root, lastSunk.lost, lastSunk.port, () => openModal(state.portView ? 'port' : null));
      break;
  }
}

function toggle(m: Modal): void {
  if (modal === m) closeModal();
  else openModal(m);
}

// ------------------------------------------------------------------ input

function typing(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
}

addEventListener('keydown', (e) => {
  if (!inGame) return;
  const chatInput = $('chat-input') as HTMLInputElement;
  if (e.key === 'Enter') {
    const chat = $('chat');
    if (chat.classList.contains('open')) {
      if (chatInput.value.trim()) net.send({ t: 'chat', text: chatInput.value });
      chatInput.value = '';
      chat.classList.remove('open');
      chatInput.blur();
    } else {
      chat.classList.add('open');
      chatInput.focus();
    }
    e.preventDefault();
    return;
  }
  if (typing()) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (modal && modal !== 'boarding' && modal !== 'sunk') closeModal();
    return;
  }
  if (e.repeat && k !== 'a' && k !== 'd') return;
  keys.add(k);
  const docked = !!state.self?.dockedAt;
  switch (k) {
    case 'w':
      state.input.sail = clamp(state.input.sail + 1, 0, 4);
      break;
    case 's':
      state.input.sail = clamp(state.input.sail - 1, 0, 4);
      break;
    case 'q':
      fire('port');
      break;
    case 'e':
      fire('starboard');
      break;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
      net.send({ t: 'ammo', ammo: AMMO_IDS[Number(k) - 1] });
      break;
    case ' ':
      fireChasers();
      e.preventDefault();
      break;
    case 'z':
    case 'x':
    case 'c':
    case 'v':
      useAbilityKey(k.toUpperCase() as 'Z');
      break;
    case 'b':
      if (boardTarget !== null) {
        const aggression: Aggression = e.shiftKey ? 'careful' : e.ctrlKey ? 'brutal' : 'standard';
        net.send({ t: 'board', target: boardTarget, aggression });
      } else hud.toast('No crippled ship within grappling range.', 'bad');
      break;
    case 'l':
      net.send({ t: 'land' });
      break;
    case 'g': {
      const cur = state.you?.station ?? 'balanced';
      net.send({ t: 'station', station: STATIONS[(STATIONS.indexOf(cur) + 1) % STATIONS.length] });
      break;
    }
    case 'r':
      net.send({ t: 'repair', on: !(state.you && state.you.flags & SF.REPAIRING) });
      break;
    case 'f':
      if (docked) net.send({ t: 'undock' });
      else net.send({ t: 'dock' });
      break;
    case 'm':
      toggle('map');
      break;
    case 't':
      toggle('talents');
      break;
    case 'i':
      toggle('ship');
      break;
    case 'h':
      toggle('help');
      break;
    case 'n':
      hud.toast(audio.toggleMute() ? 'Sound off' : 'Sound on', 'info');
      break;
    case 'p':
      if (docked) openModal('port');
      break;
  }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const canvas = $('world');
canvas.addEventListener('mousemove', (e) => {
  renderer.mouseX = e.clientX;
  renderer.mouseY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  renderer.targetZoom = clamp(renderer.targetZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.35, 4);
});
canvas.addEventListener('mousedown', (e) => {
  if (!inGame || e.button !== 0) return;
  const side = sideUnderCursor();
  if (side) fire(side);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function mouseWorld(): { x: number; y: number } {
  return renderer.toWorld(renderer.mouseX, renderer.mouseY);
}

function sideUnderCursor(): 'port' | 'starboard' | null {
  const own = state.ownDisplay;
  if (!own) return null;
  const m = mouseWorld();
  const local = toShipLocal(m.x, m.y, own.x, own.y, own.heading);
  if (Math.abs(local.x) < 4) return null;
  return local.x < 0 ? 'port' : 'starboard';
}

function aimDistance(): number {
  const own = state.ownDisplay;
  if (!own) return 300;
  const m = mouseWorld();
  return dist(own.x, own.y, m.x, m.y);
}

function fire(side: 'port' | 'starboard'): void {
  if (state.self?.dockedAt) return;
  net.send({ t: 'fire', side, dist: Math.round(aimDistance()) });
}

/** Bow or stern chasers, whichever end the cursor lies off. */
export function chaserEndUnderCursor(): 'bow' | 'stern' | null {
  const own = state.ownDisplay;
  if (!own) return null;
  const m = mouseWorld();
  const want = Math.atan2(m.x - own.x, -(m.y - own.y));
  const off = Math.abs(((want - own.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  if (off < CHASER_CONE) return 'bow';
  if (Math.PI - off < CHASER_CONE) return 'stern';
  return null;
}

function fireChasers(): void {
  if (state.self?.dockedAt) return;
  const end = chaserEndUnderCursor();
  if (!end) return hud.toast('Chasers only bear along the keel — aim ahead or astern.', 'bad');
  const m = mouseWorld();
  net.send({ t: 'chase', end, x: Math.round(m.x), y: Math.round(m.y) });
}

function useAbilityKey(key: 'Z' | 'X' | 'C' | 'V'): void {
  const self = state.self;
  if (!self) return;
  const ab = CAPTAINS[self.captain].abilities.find((a) => a.key === key);
  if (ab) sendAbility(ab.id);
}

function sendAbility(id: string): void {
  const m = mouseWorld();
  net.send({ t: 'ability', id, x: Math.round(m.x), y: Math.round(m.y) });
}

hud.onAbility = (id) => sendAbility(id);
hud.onAmmo = (id) => net.send({ t: 'ammo', ammo: id as 'round' });

function sendInput(now: number): void {
  const rudder = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  state.input.rudder = typing() ? 0 : rudder;
  const key = `${state.input.rudder}|${state.input.sail}`;
  if (key !== lastInputKey || now - lastInputSent > 250) {
    lastInputKey = key;
    lastInputSent = now;
    net.send({ t: 'input', seq: ++state.input.seq, rudder: state.input.rudder, sail: state.input.sail });
  }
}

// ------------------------------------------------------------------ context prompt & board target

function computePrompt(): string {
  const own = state.ownDisplay;
  const self = state.self;
  const you = state.you;
  boardTarget = null;
  if (!own || !self || !you || self.dockedAt) return '';
  const st = state.ownStats!;
  let best: number | null = null, bd = Infinity;
  for (const s of state.ships.values()) {
    if (!s.info) continue;
    const c = s.cur;
    if (c.flags & (SF.SINKING | SF.DOCKED | SF.PROTECTED)) continue;
    const cls = SHIP_CLASSES[s.info.classId];
    const d = dist(own.x, own.y, c.x, c.y);
    const range = st.boardingRange + (st.beam + cls.beam) / 2;
    if (d > range) continue;
    const weak = c.flags & SF.SURRENDERED || c.hull <= 0.6 || c.sails <= 0.35 || c.crew <= 0.5 || c.spd < 2;
    if (!weak) continue;
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  }
  boardTarget = best;
  const parts: string[] = [];
  if (best !== null) {
    const name = state.ships.get(best)?.info?.name ?? 'her';
    parts.push(`<kbd>B</kbd> Board the ${esc(name)} <span class="muted">(Shift careful · Ctrl brutal)</span>`);
  }
  if (self.landing) {
    const now = state.estServerTime();
    const frac = Math.max(0, Math.min(1, (now - self.landing.started) / (self.landing.until - self.landing.started)));
    parts.push(`Boats ashore at the ${esc(self.landing.feature.replace('_', ' '))} — ${Math.round(frac * 100)}% <span class="muted">(raise sail to recall)</span>`);
  } else if (self.landable) parts.push(`<kbd>L</kbd> Send a landing party to the ${esc(self.landable.feature)} on ${esc(self.landable.island)}`);
  const port = state.ports.find((p) => dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS);
  if (port) parts.push(`<kbd>F</kbd> Enter ${esc(port.name)}`);
  if (you.flags & SF.PROTECTED) parts.push('<span class="muted">Protected — firing ends it</span>');
  if (you.combat && !(you.flags & SF.REPAIRING) && you.hull < you.hullMax * 0.5) parts.push('<span class="muted"><kbd>R</kbd> repairs need a lull in the fighting</span>');
  return parts.join('<br>');
}

// ------------------------------------------------------------------ main loop

let last = performance.now();
function frame(t: number): void {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  if (inGame) {
    sendInput(t);
    state.updateRemote();
    const own = state.updateOwn();
    aimSide = sideUnderCursor();
    const prompt = computePrompt();
    renderer.render(state, own, dt, { side: aimSide, dist: aimDistance(), boardTarget, chaser: chaserEndUnderCursor() });
    if (own) audio.listener = { x: own.x, y: own.y };
    audio.ambience(state.wind[1], state.weather, dt);
    hud.update(state, prompt);
    if (modal === 'map' && Math.floor(t / 1000) !== Math.floor((t - dt * 1000) / 1000)) worldMap.draw(state);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => net.send({ t: 'ping', c: performance.now() }), 5000);

// Debug handle for the console.
(globalThis as unknown as { gravetide: unknown }).gravetide = { state, renderer, net };
