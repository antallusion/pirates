// Client entry: login → captain selection → the ocean. Wires network, state, input, renderer and UI.

import { EN as I18_EN, RU as I18_RU } from './lang/ui/isles18.ts';
import { shipLevelOf } from '../../shared/src/data/shiplevel.ts';
import { liveSignals, signalToast } from './ui/social.ts';
import { noteHearsay, repairState } from './ui/dealings.ts';
import { renderHall } from './ui/hall.ts';
import { renderLook, resetLookDraft } from './ui/looks.ts';
import { ask, tell } from './ui/confirm.ts';
import { beastOfClass } from '../../shared/src/data/beasts.ts';
import { FishFightPanel } from './ui/fishfight.ts';
import { NetHaulPanel } from './ui/nethaul.ts';
import { departOrAsk } from './ui/depart.ts';
import { EncounterCard } from './ui/encounter.ts';
import { SurrenderCard } from './ui/surrender.ts';
import { LairChestCard } from './ui/lairchest.ts';
import { MinigameWindow } from './ui/minigame.ts';
import { TrekWindow } from './ui/trek.ts';
import { EN as ISLES_EN, RU as ISLES_RU } from './lang/ui/isles.ts';
import { EN as LAIRS_EN, RU as LAIRS_RU } from './lang/ui/lairs.ts'; // docs/18 II
import { renderGear } from './ui/gear.ts';
import { DivePanel } from './ui/dive.ts';
import { giverDialog } from './ui/giver.ts';
import { inspectDialog } from './ui/inspect.ts';
import { BoardFightPanel } from './ui/boardfight.ts';
import { TacticalPanel } from './ui/tactical.ts';
import { CAPTAINS } from '../../shared/src/data/captains.ts';
import { AMMO, AMMO_IDS, CHASER_CONE, GUNS, SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { PORT_DOCK_RADIUS, isNight, timeOfDay } from '../../shared/src/constants.ts';
import { angleDiff, clamp, dist, toShipLocal } from '../../shared/src/math.ts';
import type { Aggression, SeaMarkData, ServerMsg } from '../../shared/src/protocol.ts';
import { SF, STATIONS } from '../../shared/src/protocol.ts';
import { REGIONS } from '../../shared/src/world/regions.ts';
import { assetUrl, loadAssets } from './assets.ts';
import { AudioEngine, turnCreakLoad } from './audio.ts';
import { AutosailPill, FirstTips, autosailRequest, autosailStopText, tipForMsg, tipForState } from './ui/ease.ts';
import { ACT_SHOW, actBarHtml, buildActs, findInfo, landKeyAct, markInfo, slowWord } from './ui/actbar.ts';
import { FIND_REACH, FIND_SLOW } from '../../shared/src/data/seafinds.ts';
import type { FindView } from '../../shared/src/findproto.ts';
import { ROAMS, ROAM_REACH } from '../../shared/src/data/roamers.ts'; // docs/19 D7
import { BOSSES } from '../../shared/src/data/bosses.ts';
import type { BossId } from '../../shared/src/data/bosses.ts';
import { isShoreBoss } from '../../shared/src/data/shorebosses.ts'; // the great ones ashore (2026-10-03)
import type { RoamView } from '../../shared/src/roamproto.ts';
import { UNITS as ROAM_UNITS } from '../../shared/src/data/army.ts';
import { roamName, roamNow } from './render/roamers.ts';
import { openRoamCard } from './ui/roamcard.ts';
import { strengthWord as roamWord } from './ui/army.ts';
import { EN as ROAM_EN, RU as ROAM_RU } from './lang/ui/roamers.ts';
import type { Act, ActFacts } from './ui/actbar.ts';
import { MARK_SLOW, markInReach } from '../../shared/src/data/seamarks.ts';
import { EN as EASE_EN, RU as EASE_RU } from './lang/ui/ease.ts';
import { setWaypoint as setMark, waypoint as markOf } from './ui/track.ts';
import { Net } from './net.ts';
import { Renderer, shipHeel } from './render/renderer.ts';
import { ClientState } from './state.ts';
import { showCaptainSelect } from './ui/captain.ts';
import { renderBoarding, renderHelp, renderShip, renderSunk } from './ui/dialogs.ts';
import { renderCrew, renderMutiny } from './ui/crew.ts';
import { CompanyScreen, renderBarter } from './ui/company.ts';
import { BaseWindow } from './ui/base.ts';
import { $, decorateSums, esc, fmt, icon, keepInputs } from './ui/dom.ts';
import { Hud, releaseModalToasts } from './ui/hud.ts';
import { MENU_ITEMS, menuLabel, renderMenu } from './ui/menu.ts';
import type { MenuItem } from './ui/menu.ts';
import { applySkin } from './ui/skin.ts';
import { rudderToward, TouchControls } from './touch.ts';
import { PortScreen } from './ui/port.ts';
import { TalentScreen } from './ui/talents.ts';
import { HeroWindow, drawSeaOrders } from './ui/hero.ts';
import { activeTalents } from '../../shared/src/data/talents.ts';
import { WorldMap } from './ui/worldmap.ts';
import { Journal } from './ui/journal.ts';
import { renderChoice, renderTattoos } from './ui/tattoos.ts';
import { renderDice, tickDice } from './ui/dice.ts';
import { OnboardingUi, playPrologue, renderEdge } from './ui/onboarding.ts';
import { filmDue, filmExists, loadFilms, playFilm } from './ui/cutscene.ts';
import { OptionsScreen } from './ui/options.ts';
import { actionFor, applyToDocument, keyLabel, keyOf, onSettings, settings, update } from './settings.ts';
import { BTN, dead, HOLD, padAimPoint, PadInput, radialSector, rumble } from './gamepad.ts';
import type { PadEvent } from './gamepad.ts';
import type { Action, Settings } from './settings.ts';
import { dict, lang, onLang, plural, setLang, t, translateDom } from './i18n.ts';
import { EN as HUD_EN, RU as HUD_RU } from './lang/ui/hud.ts';
const HUD_L = dict(HUD_EN, HUD_RU);
import { applyDataLocale, NAME_RU } from './lang/data.ts';
import { personName } from './lang/names.ts';
import { serverText } from './lang/server.ts';
import { FACTIONS } from '../../shared/src/data/factions.ts';
import { placeName } from './ui/maps.ts';
import type { Key } from './i18n.ts';
import { EN as MAIN_EN, RU as MAIN_RU } from './lang/ui/main.ts';
import { renderDescent } from './ui/descent.ts';
import { renderSaga } from './ui/saga.ts';
import { renderAway } from './ui/renown.ts';
import { RecruitWindow } from './ui/recruit.ts';
import { TameWindow } from './ui/tame.ts'; // docs/18 IV
import { ThroneWindow } from './ui/throne.ts'; // docs/19 E1–E3, E18
import { PremiumWindow } from './ui/premium.ts'; // the premium shop (owner, 2026-10-03)
import { AdvCard } from './ui/advcard.ts'; // docs/17 H4
import { PuzzleWindow } from './ui/puzzle.ts';
import { crewSayParts, renderLog } from './ui/crewlife.ts';

const L = dict(MAIN_EN, MAIN_RU);
/** A name or sentence that came from the server, in the player's language. */
const sv = (s: string): string => (lang() === 'ru' ? NAME_RU.get(s) ?? serverText(s) : s);

type Modal = 'port' | 'talents' | 'map' | 'journal' | 'ship' | 'gear' | 'help' | 'boarding' | 'sunk' | 'crew' | 'mutiny' | 'company' | 'barter' | 'edge' | 'options' | 'menu' | 'tattoos' | 'choice' | 'dice' | 'look' | 'hall' | 'descent' | 'saga' | 'log' | 'base' | 'away' | 'recruit' | 'hero' | 'puzzle' | 'tame' | 'throne' | 'shop' | null;

const net = new Net();
const state = new ClientState();
const renderer = new Renderer($('world') as HTMLCanvasElement);
const hud = new Hud();
const audio = new AudioEngine();
renderer.onLightning = () => audio.thunder();
for (const ev of ['keydown', 'mousedown', 'touchstart'] as const) addEventListener(ev, () => audio.unlock(), { passive: true });
const worldMap = new WorldMap();
const journal = new Journal((m) => net.send(m));
// The tattooist's and the ship's log each have a film the first time they open.
journal.openTattoos = () => {
  openModal('tattoos');
  playFilm('cut_tattoo');
};
journal.openSaga = () => {
  openModal('saga');
  playFilm('cut_saga');
};
journal.openLog = () => openModal('log');
worldMap.send = (m) => net.send(m);
worldMap.onAutosail = (wp) => {
  touch.course = null; // the helm stick lets go, or it would take the wheel straight back
  net.send(autosailRequest(state, wp));
  closeModal();
};
// docs/16 #36: the helmsman takes her to her mark; the pill at the top of the stack stops him.
const EL = dict(EASE_EN, EASE_RU);
const autosailPill = new AutosailPill();
autosailPill.onStop = () => net.send({ t: 'autosail', stop: true });
// docs/16 #37: a line the first time she meets each of the sea's mechanics.
const firstTips = new FirstTips();
firstTips.covered = () => modal !== null;
let modal: Modal = null;
let inGame = false;
let lastSunk: { lost: { cargoValue: number; crew: number; repairFee: number }; port: string; towed: boolean } | null = null;
/** The prologue plays once, for a captain who has just taken the First Watch. */
let prologuePending = false;
const keys = new Set<string>();
/** The signs on the horizon the lookout has already called. */
const seenSights = new Set<number>();
let lastInputSent = 0;
let lastInputKey = '';
let boardTarget: number | null = null;
let aimSide: 'port' | 'starboard' | null = null;
/** The target frame's ship (canon D12): chosen by a tap, a click on her or the target key; else the nearest hostile. */
let targetId: number | null = null;
let targetPinned = false;

/** The ship under a point on screen, if any (her hull, or a finger's width around it). */
function shipAtScreen(px: number, py: number): number | null {
  const m = renderer.toWorld(px, py);
  let best: number | null = null, bd = Infinity;
  for (const s of state.ships.values()) {
    if (!s.info || s.id === state.entityId || s.cur.flags & (SF.SINKING | SF.DOCKED)) continue;
    const cls = SHIP_CLASSES[s.info.classId];
    const d = dist(m.x, m.y, s.cur.x, s.cur.y);
    const reach = Math.max(cls.length * 0.6, 26 / Math.max(0.2, renderer.zoom));
    if (d < reach && d < bd) {
      bd = d;
      best = s.id;
    }
  }
  return best;
}

function pinTarget(id: number | null): void {
  if (id === null) return;
  targetId = id;
  targetPinned = true;
}

/** The target key: the next ship out from you, round and round. */
function cycleTarget(): void {
  const own = state.ownDisplay;
  if (!own) return;
  const near = [...state.ships.values()]
    .filter((s) => s.info && s.id !== state.entityId && !(s.cur.flags & (SF.SINKING | SF.DOCKED)) && dist(own.x, own.y, s.cur.x, s.cur.y) < 2500)
    .sort((a, b) => dist(own.x, own.y, a.cur.x, a.cur.y) - dist(own.x, own.y, b.cur.x, b.cur.y));
  if (!near.length) return;
  const i = near.findIndex((s) => s.id === targetId);
  pinTarget(near[(i + 1) % near.length].id);
}

/** The glass on the frame's ship (docs/12 P6): her hold weighed, asked again every few seconds. */
let glassId: number | null = null, glassAt = 0;
/** What the glass answers when it cannot see (server/src/game/raiding.ts appraise): kept off the toasts. */
const GLASS_QUIET = new Set(['Too far for the glass.', 'Nothing to appraise there.']);
function askGlass(id: number | null): void {
  const now = performance.now();
  if (id === null) {
    glassId = null;
    return;
  }
  const s = state.ships.get(id);
  if (!s?.info || s.info.npcRole === 'beast' || SHIP_CLASSES[s.info.classId]?.monster) return;
  if (id === glassId && now - glassAt < 4000) return;
  glassId = id;
  glassAt = now;
  net.send({ t: 'appraise', id });
}

/** The frame's ship this frame: the pinned one while she is in sight, else the nearest hostile within a mile. */
function resolveTarget(): number | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) return null;
  const alive = (id: number | null) => {
    const s = id !== null ? state.ships.get(id) : undefined;
    return !!s?.info && !(s.cur.flags & (SF.SINKING | SF.DOCKED)) && dist(own.x, own.y, s.cur.x, s.cur.y) < 3000;
  };
  if (targetPinned && alive(targetId)) return targetId;
  targetPinned = false;
  let best: number | null = null, bd = 1600;
  for (const s of state.ships.values()) {
    if (!s.info || !(s.cur.flags & SF.HOSTILE) || s.cur.flags & (SF.SINKING | SF.DOCKED)) continue;
    const d = dist(own.x, own.y, s.cur.x, s.cur.y);
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  }
  return best;
}

const portScreen = new PortScreen((m) => net.send(m), () => closeModal());
portScreen.openTattoos = journal.openTattoos;
const talentScreen = new TalentScreen((m) => net.send(m));
// The captain as a hero (docs/17 H2): primaries, skills, the order book, a port's guild and artifact merchant.
const heroWindow = new HeroWindow((m) => net.send(m));
heroWindow.onClose = () => closeModal();
function openHero(tab?: 'hero' | 'path' | 'book' | 'port'): void {
  heroWindow.open(tab);
  openModal('hero');
}
const companyScreen = new CompanyScreen((m) => net.send(m));
// One's own island as a base (docs/15): from the Company's islands, the captain's cabin, and at sea off the island.
const baseWindow = new BaseWindow((m) => net.send(m));
// The recruit window of the Heroes (docs/17 H3): from a port's tavern and from the island's town.
const recruitWindow = new RecruitWindow((m) => net.send(m));
let recruitFrom: 'port' | 'isle' | 'lair' = 'port';
function openRecruit(src: 'port' | 'isle' | 'lair'): void {
  recruitFrom = src;
  recruitWindow.open(src);
  openModal('recruit');
}
portScreen.openDwell = () => openRecruit('port');
// The adventure map (docs/17 H4): the visit card over the sea, and the Grail's chart.
const advCard = new AdvCard((m) => net.send(m));
advCard.now = () => state.estServerTime(); // the drift's mini-game needle (docs/18 #35)
// The creatures' window (docs/18 IV): from the crew's army card, a port's tamer, the battle's reckoning.
const tameWindow = new TameWindow((m) => net.send(m));
function openTame(): void {
  tameWindow.open();
  openModal('tame');
  playFilm('cut_tame');
}
// The Throne of the Sea (docs/19 E18): from the captain's plate, the cabin, the captain's window.
const throneWindow = new ThroneWindow((m) => net.send(m));
throneWindow.onClose = () => closeModal();
function openThrone(tab?: string): void {
  throneWindow.open(tab);
  openModal('throne');
  playFilm('cut_throne');
}
heroWindow.onThrone = () => openThrone();
hud.onThrone = () => openThrone();
// The premium shop (owner, 2026-10-03): from the micro menu and the cabin; `topup` opens it at the packs.
const premiumWindow = new PremiumWindow((m) => net.send(m));
function openShop(topup = false): void {
  premiumWindow.open(topup);
  openModal('shop');
}
const puzzleWindow = new PuzzleWindow((m) => net.send(m));
function openPuzzle(): void {
  puzzleWindow.open();
  openModal('puzzle');
}
advCard.onPuzzle = openPuzzle;
advCard.onHire = () => openRecruit('lair'); // a creature dwelling of hers (docs/18 #19)
// docs/18 #50: where the card's subjects stand on the screen, so it never covers them on a phone.
advCard.where = (ids) => {
  const pts: { x: number; y: number }[] = [];
  const at = (x: number, y: number) => pts.push({ x: renderer.sx(x), y: renderer.sy(y) });
  const o = ids.obj ? state.adv?.objs.find((x) => x.id === ids.obj) : undefined;
  if (o) at(o.x, o.y);
  const g = ids.guard ? state.adv?.guards.find((x) => x.id === ids.guard) : undefined;
  if (g) at(g.x, g.y);
  const l = ids.lair ? state.lairs?.list.find((x) => x.id === ids.lair) : undefined;
  if (l) at(l.x, l.y);
  const d = ids.drift !== undefined ? state.drifts.find((x) => x.id === ids.drift) : undefined;
  if (d) at(d.x, d.y);
  return pts;
};
worldMap.onPuzzle = openPuzzle;
baseWindow.onRecruit = () => openRecruit('isle');
companyScreen.onBase = () => openBase();
baseWindow.onSail = () => closeModal();
baseWindow.onLayout = () => { if (modal === 'base') refreshModal(); };
function openBase(): void {
  baseWindow.open();
  openModal('base');
}
/** The terms of the island off the bow (docs/15 item 6), on the Company's islands card. */
function openClaim(): void {
  companyScreen.open('isles');
  net.send({ t: 'estate', action: 'view' });
  openModal('company');
}
// "Whisper" on a friend: the chat opens over the window, addressed to them.
let whisperPrefill = '';
// A groupmate's frame on the HUD: their card.
hud.onPartyTap = (name) => net.send({ t: 'inspect', name });
hud.onSignal = (kind) => net.send({ t: 'signal', kind }); // docs/16 #35
hud.onWorldGoal = () => openModal('journal'); // docs/16 #32
hud.onTargetTap = (name) => net.send({ t: 'inspect', name });
hud.onFishing = (action) => net.send({ t: 'fishing', action });
hud.onHunt = (action, id) => net.send(action === 'flense' ? { t: 'hunt', action, id: id ?? 0 } : { t: 'hunt', action });
hud.onTribute = (id) => net.send({ t: 'tribute', id });
companyScreen.onWhisper = (name) => {
  const input = $('chat-input') as HTMLInputElement;
  hud.chatPanel.open(false);
  input.value = whisperPrefill = `${lang() === 'ru' ? '/ш' : '/w'} ${name} `;
  input.focus();
};
const divePanel = new DivePanel((m) => net.send(m));
const boardFight = new BoardFightPanel((m) => net.send(m), () => state.estServerTime());
const tactical = new TacticalPanel((m) => net.send(m), () => state.estServerTime());
const optionsScreen = new OptionsScreen();
optionsScreen.close = () => closeModal();
// A phone plays sideways only (owner, 2026-10-02). On the first touch the game goes full screen and holds the screen
// sideways where the browser allows it (Android); elsewhere the #rotate-lock veil asks for the phone to be turned.
if (matchMedia('(pointer: coarse)').matches) {
  const holdSideways = (): void => {
    const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
    else lock();
  };
  addEventListener('pointerup', holdSideways, { once: true });
}
const touch = new TouchControls({
  sail: (d) => (state.input.sail = clamp(state.input.sail + d, 0, 4)),
  fire: (side) => releaseFire(side),
  hold: (side) => holdFire(side),
  dash: () => net.send({ t: 'dash' }),
  chasers: () => touchChasers(),
  mount: () => touchMount(),
  context: () => padContext(),
  context2: () => (nearHome() ? openBase() : openClaim()),
  aim: (px, py) => {
    renderer.mouseX = px;
    renderer.mouseY = py;
    pinTarget(shipAtScreen(px, py)); // a tap on a ship makes her the target
  },
  zoom: (f) => {
    renderer.userZoomed = true;
    renderer.targetZoom = clamp(renderer.targetZoom * f, 0.35, 4);
  },
  menu: () => toggle('menu'),
});
const onboarding = new OnboardingUi(state);
const encounterCard = new EncounterCard((m) => net.send(m));
const surrenderCard = new SurrenderCard((m) => net.send(m));
const lairChest = new LairChestCard();
const minigameWindow = new MinigameWindow((m) => net.send(m));
// The walk across an island (docs/16 #21): its card waits behind an island game's window.
const trekWindow = new TrekWindow((m) => net.send(m), () => minigameWindow.isOpen);
const LI = dict(ISLES_EN, ISLES_RU);
const LLAIR = dict(LAIRS_EN, LAIRS_RU); // docs/18 II
const L18 = dict(I18_EN, I18_RU); // docs/18 III
const LROAM = dict(ROAM_EN, ROAM_RU); // docs/19 D7

/** docs/18 #28: the land key on an island two levels or more above her ship asks first (once an island). */
let landOk = '';
function sendLand(): void {
  const l = state.self?.landable;
  if (l?.danger && l.lv && landOk !== l.island) {
    const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
    void ask(L18(l.danger === 'deadly' ? 'land.deadly' : 'land.warn', { island: placeName(sv(l.island)), lv: l.lv, mine, n: l.lv - mine }), L18('land.go')).then((ok) => {
      if (!ok) return;
      landOk = l.island;
      net.send({ t: 'land' });
    });
    return;
  }
  net.send({ t: 'land' });
}

const fishFight = new FishFightPanel((m) => net.send(m));
const netHaul = new NetHaulPanel((m) => net.send(m));
onboarding.send = (action) => net.send({ t: 'onboarding', action });
// Options: applied now and on every change (docs/07 §11).
let lastZoomKey = '';
function applySettings(o: Settings): void {
  applyToDocument(o);
  // A new scale or density: what the HUD measures of itself is measured again (docs/16 #40).
  const zk = `${o.uiScale}|${o.density}`;
  if (zk !== lastZoomKey) {
    const first = !lastZoomKey;
    lastZoomKey = zk;
    if (!first) requestAnimationFrame(() => dispatchEvent(new Event('resize')));
  }
  audio.configure(o.volume.master, { sea: o.volume.sea, combat: o.volume.combat, ui: o.volume.ui, music: o.volume.music }, o.mono);
  audio.voices = o.shipVoices;
  renderer.fx.forceLod = o.effects === 'low' ? 2 : null;
  audio.onCaption = o.captions
    ? (kind, dir, far) => hud.caption(t(`cap.${kind}` as Key, { dir: t(`dir.${dir}` as Key), far: far ? t('cap.far') : '' }), dir)
    : null;
}
applySettings(settings());
onSettings(applySettings);
// The boarding battle's form follows the option at once (docs/16 P4).
let classicSent = settings().classicBoarding;
onSettings((s) => {
  if (s.classicBoarding === classicSent) return;
  classicSent = s.classicBoarding;
  net.send({ t: 'board_pref', classic: s.classicBoarding });
});
document.documentElement.lang = lang();
applyDataLocale(lang());
translateDom();
markLang();
onLang(() => {
  applyDataLocale(lang());
  state.relocalize();
  translateDom();
  markLang();
  if (modal) refreshModal();
});

/** The EN / RU switch on the title screen. */
function markLang(): void {
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.classList.toggle('btn-primary', b.dataset.lang === lang()));
}
document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => (b.onclick = () => setLang(b.dataset.lang === 'ru' ? 'ru' : 'en')));

/** Reads the open screen aloud (or stops reading). */
function readAloud(): void {
  const synth = globalThis.speechSynthesis;
  if (!synth) return hud.toast(L('noReadAloud'), 'bad');
  if (synth.speaking) return synth.cancel();
  const text = (modal ? $('modal-panel').innerText : [$('hud-watch').innerText, $('hud-ship').innerText, $('nav-text').innerText].join('. ')).replace(/\s+/g, ' ').trim().slice(0, 4000);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang() === 'ru' ? 'ru-RU' : 'en-GB';
  synth.speak(u);
}

onboarding.onEdge = () => {
  // Never over a fight's screen: the boarding or the shipwreck come first.
  if (modal === null || modal === 'map' || modal === 'help') openModal('edge');
};

// ------------------------------------------------------------------ boot

loadAssets(null).then(() => {
  applySkin();
  buildMicroMenu();
  hud.artEpoch++;
  touch.dress();
  hud.chatPanel.art();
  hud.chatPanel.tabs();
  const url = assetUrl('art.keyart');
  const ka = document.querySelector<HTMLElement>('.keyart');
  if (ka && url) ka.style.backgroundImage = `url('${url}')`;
  if (ka) titleFilm(ka, url);
});

/** The game's films at their moments (ui/cutscene.ts): the first boarding (a lair's fight ashore), the first win and
 *  loss, the first harbour, the first storm — each shown once. */
const filmWas = { tac: false, over: false, docked: true, storm: false, bosses: '', landing: true, abyss: true };
/** A landing's film by what the party goes ashore for: a buried chest, a named pirate's lair, an island; none for a
 *  haul, a dive or the shallows. */
const LANDING_FILM: Record<string, string | null> = { dig: 'cut_treasure', pirate_camp: 'cut_fort', lookout: 'cut_lighthouse', dive: 'cut_wreck_dive', haul: null, tidal: null, turtle: null };
/** The sea's world bosses, each the first time one rises near her. */
const BOSS_FILM: Record<string, string> = { kraken: 'cut_kraken_boss', leviathan: 'cut_leviathan', lantern_maw: 'cut_lantern_maw', black_serpent: 'cut_serpent', abyss_eye: 'cut_abyss',
  drowned_whale: 'cut_drowned_whale', hollow_admiral: 'cut_hollow_admiral', mother_of_wrecks: 'cut_mother_of_wrecks', storm_widow: 'cut_storm_widow', ancient_leviathan: 'cut_ancient_leviathan',
  old_moorings: 'cut_old_moorings', old_tithe: 'cut_old_tithe', fog_changeling: 'cut_fog_changeling', cinder_ray: 'cut_cinder_ray', drowned_prelate: 'cut_drowned_prelate', rime_twins: 'cut_rime_twins' };
/** The land's creatures, each lair's kind the first time she fights at one (a legend's lair takes the legend's film). */
const LAIR_FILM: Record<string, string> = { crab_beach: 'cut_crab_beach', gull_cliffs: 'cut_gull_cliffs', seal_rookery: 'cut_seal_rookery', shark_shallows: 'cut_shark_shallows',
  turtle_rocks: 'cut_turtle_rocks', serpent_marsh: 'cut_serpent_marsh', hermit_camp: 'cut_hermit_camp', tentacle_lagoon: 'cut_tentacle_lagoon', drowned_surf: 'cut_drowned_surf',
  choir_circle: 'cut_choir', serpent_grotto: 'cut_serpent', maw_pit: 'cut_lantern_maw', turtle_guardian: 'cut_ancient_turtle', leviathan_shoal: 'cut_leviathan',
  jaguar_den: 'cut_jaguar_den', ape_ridge: 'cut_ape_ridge', croc_mangroves: 'cut_croc_mangroves', bat_cave: 'cut_bat_cave', moray_reef: 'cut_moray_reef',
  albatross_rock: 'cut_albatross_rock', octopus_wreck: 'cut_octopus_wreck', crab_hollow: 'cut_crab_hollow', wyrm_gallery: 'cut_wyrm_gallery', hydra_pool: 'cut_hydra_pool',
  ape_throne: 'cut_ape_throne', roc_eyrie: 'cut_roc_eyrie',
  mire_mother: 'cut_mire_mother', cinder_salamander: 'cut_cinder_salamander', drowned_abbess: 'cut_drowned_abbess', walrus_tyrant: 'cut_walrus_tyrant' };
/** The first fight with each of the world's armies has its own film (shared/src/data/factionunits.ts). */
const ROSTER_FILM: Record<string, string> = { crown: 'cut_crown_chase', choir: 'cut_choir', harpoon: 'cut_harpoon', brokers: 'cut_smugglers', dutchman: 'cut_dutchman_bell', league: 'cut_league', free: 'cut_free' };
/** The sea's legends each rise in their own film the first time she fights one. */
const LEGEND_FILM: [string, string][] = [['white_whale', 'cut_white_whale'], ['young_kraken', 'cut_kraken_boss'], ['ancient_turtle', 'cut_ancient_turtle'], ['shoal_leviathan', 'cut_leviathan'], ['lantern_maw', 'cut_lantern_maw'], ['young_serpent', 'cut_serpent'], ['marsh_serpent', 'cut_serpent']];
/** The things whose change is a moment, as last seen; nothing plays for what she already had when she came in (the
 *  first ten seconds after her ship arrives only take note). */
const filmLast = new Map<string, unknown>();
let filmSince = 0;
let sunkAt = -Infinity;
function turned(key: string, now: unknown): boolean {
  const had = filmLast.has(key);
  const before = filmLast.get(key);
  filmLast.set(key, now);
  return had && before !== now && filmSince > 0 && performance.now() - filmSince > 10_000;
}
/** A test battle from a link (owner, 2026-10-03: «дай мне ссылку где можно потестить бой на палубе с существами»):
 *  /?battle — her frigate's marines and creatures (mermaids, lantern maws, the ancient turtle, a young kraken, the White
 *  Whale) board a Crown frigate; /?battle=land — her marines and mermaids ashore at a crabs' beach (an island's painted
 *  field); /?battle=<lair kind> — at that lair. The orders are the admin server's (localhost:58530); any other server
 *  refuses them. */
let testBattle: string | null = new URLSearchParams(location.search).get('battle');
/** A world boss at sea from a link (owner, 2026-10-03): /?boss=<id> — a captain of level 30 in a whole frigate, in the
 *  boss's waters, the boss raised 600 m off her bow (the admin server's /boss). */
let testBoss: string | null = new URLSearchParams(location.search).get('boss');
function runTestBattle(): void {
  if (testBoss && state.self) {
    const id = testBoss as BossId;
    testBoss = null;
    const orders = ['/level 30', '/ship frigate', '/heal', ...(BOSSES[id] ? [`/tp ${BOSSES[id].regions[0]}`] : []), `/boss ${id}`];
    orders.forEach((text, i) => setTimeout(() => net.send({ t: 'chat', text }), 800 + i * 700));
  }
  if (testBattle === null || !state.self) return;
  const kind = testBattle === 'land' ? 'crab_beach' : testBattle;
  testBattle = null;
  const army = ['/level 30', '/heal', '/army clear', '/army marine 30', '/army mermaid 14', '/army lantern_maw 6'];
  // A great one ashore (/?battle=walrus_tyrant …) comes ashore on the nearest island of its kind and is fought at once.
  const orders = kind && kind !== 'deck'
    ? [...army, isShoreBoss(kind) ? `/shoreboss ${kind} fight` : `/lair ${kind} fight`]
    : ['/level 30', '/tp gravewater', '/ship frigate', ...army.slice(1), '/army ancient_turtle 3', '/army young_kraken 1', '/army white_whale 1', '/foe patrol frigate', '/board'];
  orders.forEach((text, i) => setTimeout(() => net.send({ t: 'chat', text }), 800 + i * 700));
}
/** The sea's news held through a boarding battle (case 'toast'), told once the deck is clear. */
const heldToasts: { msg: string; kind: string }[] = [];
function filmMoments(): void {
  if (state.self && !filmSince) filmSince = performance.now();
  if (heldToasts.length && !state.boardTac) for (const x of heldToasts.splice(0)) hud.toast(x.msg, x.kind);
  const tac = state.boardTac;
  if (tac && !filmWas.tac) {
    // A legend's film first, then the foe's army's, then the boarding's (or the lair's ashore) — one at the start.
    const units = tac.stacks.map((x) => x.unit as string);
    const roster = tac.stacks.filter((x) => x.side !== tac.you).map((x) => ROAM_UNITS[x.unit]?.roster).find(Boolean);
    const lair = tac.land ? LAIR_FILM[tac.land.lair] : undefined;
    const pick = LEGEND_FILM.find(([u, f]) => units.includes(u) && filmDue(f))?.[1] ?? (lair && filmDue(lair) ? lair : undefined) ?? (roster ? ROSTER_FILM[roster] : undefined);
    // The first boarding has its film; the next, the night raid's.
    if (!(pick && filmDue(pick) && playFilm(pick))) playFilm(tac.land ? 'cut_lair' : filmDue('cut_boarding') ? 'cut_boarding' : 'cut_raid');
  }
  if (tac?.over && !filmWas.over) playFilm(tac.over.winner === tac.you ? 'cut_victory' : 'cut_defeat');
  filmWas.tac = !!tac;
  filmWas.over = !!tac?.over;
  const docked = !!state.self?.dockedAt;
  // The first harbour; then a town of the twenty that has its own film (tools/art/videos.py, the ninth reel), or the
  // first of each power's (shared/src/data/factions.ts).
  if (docked && !filmWas.docked && state.self) {
    const at = state.self.dockedAt!;
    const faction = state.ports.find((p) => p.id === at)?.faction;
    const own = `cut_port_${at}`;
    playFilm(filmDue('cut_port') || !faction ? 'cut_port' : filmDue(own) ? own : `cut_port_${faction}`);
  }
  filmWas.docked = docked || !state.self;
  if (state.storm && !filmWas.storm) playFilm('cut_storm');
  filmWas.storm = !!state.storm;
  // A world boss rising: the kraken's film the first time one is near.
  const bosses = state.bosses.map((b) => b.kind).join();
  if (bosses !== filmWas.bosses) for (const b of state.bosses) if (BOSS_FILM[b.kind] && !filmWas.bosses.split(',').includes(b.kind)) playFilm(BOSS_FILM[b.kind]);
  filmWas.bosses = bosses;
  // The boats going ashore; the first time down into the Abyss.
  const landing = state.self?.landing;
  if (landing && !filmWas.landing) {
    const film = landing.feature in LANDING_FILM ? LANDING_FILM[landing.feature] : 'cut_landing';
    if (film) playFilm(film);
  }
  filmWas.landing = !!landing || !state.self;
  const abyss = !!state.self?.abyss?.inside;
  if (abyss && !filmWas.abyss) playFilm('cut_abyss');
  filmWas.abyss = abyss || !state.self;
  // A black storm's own film; a new ship off the slipway; the orca calf; a Grail dug up; her own harbour; the sea's
  // holidays, each the first time it comes round.
  // The first black storm and the first fog; the first night watch at sea.
  if (turned('weather', state.weather)) {
    if (state.weather === 'black_storm') playFilm('cut_black_storm');
    else if (state.weather === 'fog') playFilm('cut_fog');
    else if (state.weather === 'calm') playFilm('cut_calm');
    else if (state.weather === 'rain') playFilm('cut_rain');
  }
  // The night watch; the dawn that ends it, still at sea.
  const watch = !!state.self && !state.self.dockedAt && isNight(state.estServerTime());
  if (turned('night', watch)) {
    if (watch) playFilm('cut_night_watch');
    else if (state.self && !state.self.dockedAt) playFilm('cut_dawn');
  }
  const cls = state.self?.loadout.classId ?? null;
  // A new hull launched; a premium one (docs/02 §1.A.9) the first time of her list in its own film (the tenth reel).
  const newHull = turned('cls', cls) && !!cls;
  if (newHull && state.self?.dockedAt && performance.now() - sunkAt > 60_000) {
    const def = SHIP_CLASSES[cls!];
    const own = def?.premium && def.list ? `cut_premium_${def.list}` : null;
    playFilm(own && filmDue(own) ? own : 'cut_launch');
  }
  // Doubloons spent and no new hull: the shop's creatures come aboard (docs/18 VII), the first time in their own film.
  const coin = filmLast.get('doubloons');
  if (turned('doubloons', state.doubloons) && !newHull && typeof coin === 'number' && state.doubloons < coin) playFilm('cut_premium_beast');
  if (turned('pet', !!state.companion) && state.companion) playFilm('cut_orca');
  if (turned('grail', state.adv?.grail ?? null) && state.adv?.grail === 'held') playFilm('cut_grail');
  if (turned('base', !!state.base) && state.base) playFilm('cut_base');
  // A race begun with her in it; a beast on her harpoon line.
  const racing = state.regatta?.phase === 'running' && !!state.regatta.signedUp;
  if (turned('regatta', racing) && racing) playFilm('cut_regatta');
  if (turned('line', !!state.hunt?.line) && state.hunt?.line) playFilm('cut_hunt');
  // Each pet the first time she has one; sailing in company; the first hunters on her wake; the first careening; her
  // name known (the tenth level).
  // (her pets are known only once the ship's window has asked for them: a pet is new beside a list already known)
  const hadPets = filmLast.get('pets');
  const pets = state.petsOwn?.owned ?? null;
  if (turned('pets', pets?.join() ?? null) && pets && typeof hadPets === 'string') for (const p of pets) if (!hadPets.split(',').includes(p)) playFilm(`cut_pet_${p}`);
  if (turned('party', (state.party?.members.length ?? 0) > 1) && (state.party?.members.length ?? 0) > 1) playFilm('cut_party');
  if (turned('wanted', (state.self?.wanted ?? 0) > 0) && (state.self?.wanted ?? 0) > 0) playFilm('cut_wanted');
  const repairing = !!(state.you && state.you.flags & SF.REPAIRING);
  if (turned('repair', repairing) && repairing) playFilm('cut_repair');
  const famed = (state.self?.level ?? 0) >= 10;
  if (turned('rank', famed) && famed) playFilm('cut_rank');
  const hol = state.holiday?.id ?? null;
  if (hol && filmLast.get('hol') !== hol) playFilm(`cut_${hol}`);
  filmLast.set('hol', hol);
}
void loadFilms();

/** The title screen: the trailer, silent and looping, over the key art (owner, 2026-10-03) — not for one who asks for
 *  less motion or saves data; it rests while the title screen is hidden. */
function titleFilm(ka: HTMLElement, poster: string | null): void {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || saveData) return;
  const v = document.createElement('video');
  v.className = 'keyart-film';
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.setAttribute('aria-hidden', 'true');
  if (poster) v.poster = poster;
  // The trailer and, once it is cut, the raids' trailer in turn (tools/art/cut_trailer.py).
  let reel = 0;
  v.src = '/assets/video/trailer.mp4';
  v.addEventListener('ended', () => {
    const reels = ['trailer', ...(filmExists('trailer_raids') ? ['trailer_raids'] : [])];
    reel = (reel + 1) % reels.length;
    v.src = `/assets/video/${reels[reel]}.mp4`;
    void v.play().catch(() => {});
  });
  v.addEventListener('playing', () => v.classList.add('on'));
  ka.appendChild(v);
  // Autoplay is a request, not a promise: ask again once it can play, on the title screen only.
  const go = () => { if (!$('screen-login').classList.contains('hidden')) void v.play().catch(() => {}); };
  v.addEventListener('canplay', go, { once: true });
  go();
  const login = $('screen-login');
  new MutationObserver(() => (login.classList.contains('hidden') ? v.pause() : void v.play().catch(() => {}))).observe(login, { attributes: true, attributeFilter: ['class'] });
}

// Links back from letters and OAuth: #token=… (signed in), #reset=… (new password), #verified, #auth-error=….
{
  const hash = new URLSearchParams(location.hash.slice(1));
  const tok = hash.get('token');
  if (tok) net.adopt(tok);
  if (hash.has('verified')) $('login-error').textContent = L('verified');
  if (hash.has('verify-failed')) $('login-error').textContent = L('verifyFailed');
  if (hash.get('auth-error')) $('login-error').textContent = serverText(hash.get('auth-error')!);
  const reset = hash.get('reset');
  if (reset) {
    $('reset-form').classList.remove('hidden');
    ($('reset-form') as HTMLFormElement).onsubmit = async (e) => {
      e.preventDefault();
      const r = await authPost('/auth/reset', { token: reset, password: ($('reset-password') as HTMLInputElement).value });
      if (r.token) {
        net.adopt(r.token);
        net.connect();
      } else $('login-error').textContent = (r.error ? serverText(r.error) : L('resetFailed'));
    };
  }
  if (location.hash) history.replaceState(null, '', location.pathname);
}

if (net.token) net.connect();
else $('login-name').focus();

async function authPost(path: string, body: Record<string, string>): Promise<{ token?: string; error?: string }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as { token?: string; error?: string };
  } catch {
    return { error: L('noAnswer') };
  }
}

let registering = false;
$('register-toggle').onclick = () => {
  registering = !registering;
  $('register-name-wrap').classList.toggle('hidden', !registering);
  const btn = $('email-form').querySelector('[data-mode]') as HTMLElement;
  btn.dataset.i18n = registering ? 'login.create' : 'login.signIn';
  btn.textContent = t(registering ? 'login.create' : 'login.signIn');
};
$('forgot-btn').onclick = async () => {
  const email = ($('login-email') as HTMLInputElement).value.trim();
  if (!email) {
    $('login-error').textContent = L('emailFirst');
    return;
  }
  await authPost('/auth/forgot', { email });
  $('login-error').textContent = L('letterSent');
};
($('email-form') as HTMLFormElement).onsubmit = async (e) => {
  e.preventDefault();
  const email = ($('login-email') as HTMLInputElement).value.trim();
  const password = ($('login-password') as HTMLInputElement).value;
  const r = registering
    ? await authPost('/auth/register', { email, password, name: ($('register-name') as HTMLInputElement).value.trim() })
    : await authPost('/auth/login', { email, password });
  if (!r.token) {
    $('login-error').textContent = (r.error ? serverText(r.error) : L('signInFailed'));
    return;
  }
  net.adopt(r.token);
  net.connect();
};
fetch('/auth/providers').then((r) => r.json()).then((d: { providers: { id: string; name: string }[] }) => {
  $('oauth-buttons').innerHTML = d.providers.map((p) => `<a class="btn btn-small" href="/auth/oauth/${p.id}">${esc(L('signInWith', { name: p.name }))}</a>`).join('');
}).catch(() => undefined);

($('login-form') as HTMLFormElement).onsubmit = (e) => {
  e.preventDefault();
  const name = ($('login-name') as HTMLInputElement).value.trim();
  if (name.length < 3) {
    $('login-error').textContent = L('nameShort');
    return;
  }
  net.forget();
  net.connect(name);
};

net.onStatus = (ok) => $('connection').classList.toggle('hidden', ok || !inGame);
net.on(onMessage);

function onMessage(m: ServerMsg): void {
  state.apply(m);
  if (inGame) firstTips.offer(tipForMsg(m));
  switch (m.t) {
    case 'autosail': {
      // docs/16 #36: the helmsman has the wheel, or has given it back and why.
      if (m.on) hud.toast(EL('as_on'), 'info');
      else {
        const w = autosailStopText(m.why);
        hud.toast(w.text, w.kind);
        if (m.why === 'arrived') setMark(null);
        if (w.kind === 'bad') audio.bell();
      }
      break;
    }
    case 'err':
      if (m.msg === 'auth_required') {
        net.forget();
        $('screen-login').classList.remove('hidden');
      } else if (!inGame) $('login-error').textContent = serverText(m.msg);
      // The glass asks by itself every few seconds (askGlass): its «too far» is no refusal of hers to tell.
      else if (!GLASS_QUIET.has(m.msg)) hud.toast(serverText(m.msg), 'bad');
      break;
    case 'welcome':
      $('screen-login').classList.add('hidden');
      if (!m.hasCaptain) showCaptainSelect((captain, shipName, tutorial) => {
        prologuePending = tutorial;
        net.send({ t: 'create_captain', captain, shipName, tutorial });
      });
      break;
    case 'init':
      inGame = true;
      // The old round-by-round deck fight, for a captain who asked for it in the options (docs/16 P4).
      net.send({ t: 'board_pref', classic: settings().classicBoarding });
      audio.ownId = m.entityId;
      $('screen-captain').classList.add('hidden');
      hud.show(true);
      if (state.you === null && m.self.dockedAt) openModal('port');
      if (prologuePending) {
        // The First Watch teaches by doing: no handbook up front, the prologue, then the quay.
        prologuePending = false;
        localStorage.setItem('gravetide.helpSeen', '1');
        closeModal();
        playFilm('cut_prologue', () => playPrologue(() => undefined));
      } else if (!localStorage.getItem('gravetide.helpSeen')) {
        localStorage.setItem('gravetide.helpSeen', '1');
        openModal('help');
      }
      break;
    case 'onboarding':
      onboarding.apply(m.view);
      if (modal === 'help') refreshModal();
      break;
    case 'onb':
      onboarding.moment(m.kind, m.id, (msg, kind) => hud.toast(msg, kind));
      if (m.kind === 'goal' || m.kind === 'stage') audio.coins();
      break;
    case 'port':
      if (m.view && modal !== 'port') audio.bell();
      // Never steal focus from another open screen (handbook, boarding, shipwreck); they return to port on close.
      if (m.view && modal === null) openModal('port');
      else if (!m.view && modal === 'port') closeModal();
      else if (modal === 'port') refreshModal();
      break;
    case 'self':
    case 'self_patch':
      runTestBattle();
      noteHearsay(state.self); // a whisper just bought becomes her mark (docs/16 #14)
      if (state.self?.company.mutiny && modal !== 'mutiny') openModal('mutiny');
      else if (!state.self?.company.mutiny && modal === 'mutiny') closeModal();
      else if (modal === 'company' || modal === 'base' || modal === 'gear' || modal === 'hero' || modal === 'throne') {
        // The Company and island windows redraw only when what they show of her changed (a redraw every second on
        // the private state's beat lost taps).
        const key = selfKeyFor(modal);
        if (key !== lastSelfKey) {
          lastSelfKey = key;
          refreshModal();
        }
      } else if (modal === 'port' || modal === 'talents' || modal === 'ship' || modal === 'crew' || modal === 'mutiny' || modal === 'barter') refreshModal();
      break;
    case 'mutiny':
      if (m.mutineers > 0) {
        audio.bell();
        playFilm('cut_mutiny');
        hud.banner(L('mutiny'), L('mutinySub', { name: personName(m.ringleader), n: m.mutineers, men: plural(m.mutineers, L('men.one'), L('men.few'), L('men.many')) }));
      }
      break;
    case 'hero_port':
      heroWindow.port = m.view;
      if (modal === 'hero') refreshModal();
      break;
    case 'lairchest':
      // A stormed lair's chest (docs/16 #7).
      audio.bell();
      playFilm('cut_treasure', () => lairChest.open(m.view));
      break;
    case 'surrender_offer':
      // A ship strikes her colours to you (docs/16 #3): the choice card over the sea.
      surrenderCard.open(m.offer);
      playFilm('cut_strike_colours');
      break;
    case 'boarding':
      if (m.result) openModal('boarding');
      else if (modal === 'boarding') closeModal();
      break;
    case 'sunk_self':
      lastSunk = { lost: m.lost, port: placeName(state.ports.find((p) => p.id === m.respawnPort)?.name ?? '') || L('port'), towed: !!m.towed };
      openModal('sunk');
      sunkAt = performance.now();
      playFilm('cut_sunk');
      break;
    case 'quest_offer':
      // An island's people offer their job on the beach, or a groupmate shares theirs: the giver's window, then the
      // captain's answer.
      void giverDialog(m.offer, m.from).then((pay) => net.send({ t: 'quest', action: pay ? 'accept' : 'decline', id: m.offer.id, ...(pay && pay !== 'silver' ? { pay } : {}) }));
      break;
    case 'quest_done': {
      // The herald: the quest's name and all it paid.
      const parts = [L('questPaid', { silver: fmt(m.silver), xp: fmt(m.xp) })];
      if (m.company) parts.push(L('questCompany', { n: m.company * 10 }));
      if (m.fast) parts.push(L('questFast'));
      if (m.rep) parts.push(L('questRep', { faction: serverText(FACTIONS[m.rep.faction].name), n: m.rep.n }));
      if (m.extra) parts.push(L(m.extra === 'map' ? 'questMap' : 'questSupplies'));
      if (m.stores) parts.push(L('questStores', { h: m.stores.heavy, f: m.stores.incendiary }));
      if (m.mentor) parts.push(L('questMentor', { name: m.mentor }));
      // The first job paid has its film; the herald after it.
      playFilm('cut_quest', () => {
        hud.banner(L('questDone'), `${serverText(m.name)} — ${parts.join(' · ')}`);
        audio.bell();
        audio.coins();
      });
      break;
    }
    case 'crew_say': {
      // The crew speaks (docs/16 #16–17): an officer's line with his face, the men's grumble, the shanty and its tune.
      const t = crewSayParts(m);
      if (t.line) hud.talk(t.face, t.who, t.line, t.kind);
      if (m.ev === 'shanty') audio.shanty();
      break;
    }
    case 'signal':
      // A groupmate's signal flag (docs/16 #35): a toast, and the flag on the charts.
      hud.toast(signalToast(state, m), m.kind === 'help' || m.kind === 'attack' ? 'bad' : 'info');
      if (m.kind === 'help') audio.bell();
      if (modal === 'map') worldMap.draw(state);
      break;
    case 'wgoals':
      // The sea's goals of the week (docs/16 #32).
      if (modal === 'journal') refreshModal();
      break;
    case 'toast':
      // The harbour turned her away for her speed: take in sail and try again when she slows.
      if (m.msg === 'Take in sail before entering harbour') {
        requestDock(pendingDock?.bribe ?? false, true);
        break;
      }
      // World news goes to the feed (owner, 2026-09-29: the sea's news in a corner), the rest to the toasts.
      if (m.msg.startsWith('WORLD: ')) hud.feed(serverText(m.msg));
      // While her men fight on a deck the sea's news (a fever, a tip) waits for the deck to clear; what the battle
      // refuses comes as 'err'.
      else if (state.boardTac) heldToasts.push({ msg: serverText(m.msg), kind: m.kind });
      else hud.toast(serverText(m.msg), m.kind);
      if (m.kind === 'gold') audio.coins();
      if (/a pirate is coming for you/.test(m.msg)) audio.bell(); // the lookout's alarm
      // A reward floats up over her: the experience and the silver of it.
      {
        const own = state.ownDisplay;
        const xp = /^\+(\d+) XP/.exec(m.msg), sil = m.kind === 'gold' || m.kind === 'good' ? /(\d[\d,]*) silver/.exec(m.msg) : null;
        if (own && (xp || sil)) renderer.fx.text(own.x, own.y - 14, xp ? `+${xp[1]} ✦` : `+${sil![1].replace(/,/g, '')} ⛁`, xp ? '#a9c8e8' : '#e8c46a');
      }
      break;
    case 'sights': {
      // A new sign on the horizon: the lookout calls where (owner, 2026-09-29).
      const own = state.ownDisplay;
      for (const sg of m.list) {
        if (seenSights.has(sg.id)) continue;
        seenSights.add(sg.id);
        if (own) hud.lookout(sg.x - own.x, sg.y - own.y);
      }
      break;
    }
    case 'chat':
      hud.chat(m);
      break;
    case 'duel':
      if (m.view && m.view.startsIn === 5) hud.banner(L('duel'), m.view.sides.map((side) => side.map((x) => x.name).join(', ')).join(`  ${L('against')}  `));
      if (modal === 'company') refreshModal();
      break;
    case 'tasks':
      if (modal === 'map') refreshModal();
      break;
    case 'encounter':
      encounterCard.open(m.view);
      break;
    case 'minigame':
      // An island scene or mini-game (2026-09-30): its window opens, follows the game, and shows what came of it.
      minigameWindow.open(m.view);
      break;
    case 'trek':
      trekWindow.open(m.view);
      if (m.view) playFilm('cut_trek');
      break;
    case 'mapoffer':
      // A captain alongside offers a map (docs/16 #22): yes or no.
      if (m.offer) {
        const o = m.offer;
        void ask(LI('offer.ask', { from: o.from, name: sv(o.name), price: `${o.price}`, riddle: o.riddle ? LI('offer.riddle', { riddle: o.riddle }) : '' })).then((yes) => net.send({ t: 'mapdeal', id: o.id, accept: yes }));
      }
      break;
    case 'tattoos':
      if (modal === 'tattoos') refreshModal();
      break;
    case 'dice':
      // The table opens its window; the window follows the table; it closes when she is up.
      if (m.view) {
        if (modal === 'dice') refreshModal();
        else {
          openModal('dice');
          playFilm('cut_dice');
        }
      } else if (modal === 'dice') closeModal();
      break;
    case 'away':
      // Back after a long time ashore (docs/16 #30): what happened, and the gift.
      if (modal !== 'boarding' && modal !== 'mutiny') openModal('away');
      break;
    case 'hall':
      if (m.view) {
        if (modal === 'hall') refreshModal();
        else openModal('hall');
      }
      break;
    case 'base':
      if (modal === 'base') refreshModal();
      break;
    case 'supply': // docs/18 #32
      if (modal === 'base' && baseWindow.tab === 'supply') refreshModal();
      break;
    case 'dwell':
      if (modal === 'recruit') refreshModal();
      break;
    case 'adv_card':
      advCard.show(m.view);
      break;
    case 'lair_card': // docs/18 II
      advCard.lair(m.card);
      break;
    case 'drift_card': // docs/18 IV
      advCard.drift(m.card);
      break;
    case 'tame':
      if (modal === 'tame') refreshModal();
      break;
    case 'premium':
    case 'doubloons':
      if (modal === 'shop') refreshModal();
      break;
    case 'lairs':
      if (modal === 'map') worldMap.draw(state);
      if (modal === 'base') refreshModal();
      break;
    case 'adv':
      if (modal === 'map') worldMap.draw(state);
      break;
    case 'puzzle':
      if (modal === 'puzzle') refreshModal();
      break;
    case 'descent': {
      // The choice between tiers opens its window for the leader; the window follows the descent.
      const run = m.view?.run;
      if (run) playFilm('cut_descent');
      if (run?.phase === 'choice' && run.leader && modal !== 'descent' && lastDescentTier !== run.tier) {
        lastDescentTier = run.tier;
        openModal('descent');
      } else if (modal === 'descent') {
        if (!run || run.phase === 'fight') closeModal();
        else refreshModal();
      }
      break;
    }
    case 'companion':
    case 'petsown':
      if (modal === 'ship') refreshModal();
      break;
    case 'choice':
      // A chain's reward (docs/12 P9): the three pieces open at once; taken, the window closes.
      if (m.view) openModal('choice');
      else if (modal === 'choice') closeModal();
      break;
    case 'fishfight':
      fishFight.open(m.view);
      break;
    case 'nethaul':
      netHaul.open(m.view, m.got);
      // The first full net: its film once she has seen what came up.
      if (m.got && m.got.n > 0 && filmDue('cut_nethaul')) setTimeout(() => playFilm('cut_nethaul'), 1800);
      break;
    case 'trophy_hall':
      playFilm('cut_trophy_hall', () => void tell(L('trophyHall', { owner: m.view.owner, flag: m.view.flag, skull: m.view.skull, fish: m.view.fish })));
      break;
    case 'encounter_result':
      encounterCard.result(m);
      if (modal === 'journal') refreshModal();
      break;
    case 'inspect': {
      // A captain's card (docs/11 P6): a whisper opens the chat to them; a call aboard or a friend's name at once.
      const g = state.party;
      const me = g?.members.find((x) => x.name === state.self?.name)?.accountId;
      const canInvite = (!g || g.leader === me) && !g?.members.some((x) => x.name === m.view.name);
      inspectDialog(m.view, {
        whisper: (n) => companyScreen.onWhisper(n),
        invite: (n) => net.send({ t: 'group', action: 'invite', name: n }),
        befriend: (n) => net.send({ t: 'friend', action: 'add', name: n }),
      }, { friend: state.friends.some((f) => f.name === m.view.name), canInvite });
      break;
    }
    case 'party':
    case 'friends':
    case 'who':
    case 'mail':
    case 'market':
    case 'bounties':
    case 'holdings':
    case 'guild':
    case 'legends':
    case 'empire':
    case 'renown':
      if (modal === 'company') refreshModal();
      if (m.t === 'renown' && modal === 'journal') refreshModal();
      hud.setUnread(state.unread);
      break;
    case 'barter':
      if (m.view && modal !== 'barter') openModal('barter');
      else if (!m.view && modal === 'barter') closeModal();
      else if (modal === 'barter') refreshModal();
      break;
    case 'ev':
      for (const e of m.list) {
        renderer.fx.onEvent(e, state.entityId);
        // Rumble: a hit on our hull a short knock in both motors; something under the keel a long low hum.
        if (e.k === 'hit' && e.ship === state.entityId && e.dmg > 0) rumble(activePad(), 0.5, 0.5, 120);
        else if (e.k === 'fx' && (e.fx === 'deep_call' || e.fx === 'rise' || e.fx === 'maw') && state.ownDisplay && dist(e.x, e.y, state.ownDisplay.x, state.ownDisplay.y) < 600) rumble(activePad(), 0.7, 0, 1200);
        audio.onEvent(e);
        if (e.k === 'region') {
          const r = REGIONS[e.region];
          hud.banner(r.name, `${L(r.safety === 'safe' ? 'safeWaters' : r.safety === 'contested' ? 'contestedWaters' : 'lawlessWaters')} — ${r.mood}`);
        } else if (e.k === 'discover' && !e.quiet) hud.toast(L('charted', { name: sv(e.name) }), 'xp');
        else if (e.k === 'board_start' && (e.a === state.entityId || e.b === state.entityId)) hud.toast(L('grapples'), 'info');
      }
      if (modal === 'map') worldMap.draw(state);
      break;
  }
}

// ------------------------------------------------------------------ modals

// The dice table's clock ticks between the server's words.
setInterval(() => {
  if (modal === 'dice') tickDice($('modal-panel'), state);
  if (modal === 'base') baseWindow.tick($('modal-panel'), state);
  if (modal === 'puzzle' && (state.puzzle?.digging || state.puzzle?.wait)) refreshModal(); // the dig's seconds (docs/17 H4)
}, 1000);

function openModal(m: Modal): void {
  if (m !== 'look') resetLookDraft();
  modal = m;
  $('modal').classList.toggle('hidden', m === null);
  if (m === null) releaseModalToasts();
  refreshModal();
}

function closeModal(): void {
  const was = modal;
  // The welcome gift is never lost by closing its window (docs/16 #30).
  if (was === 'away' && state.away?.gift) {
    net.send({ t: 'away', action: 'take' });
    state.away.gift = null;
  }
  modal = null;
  $('modal').classList.add('hidden');
  releaseModalToasts();
  // The recruit window opened from the island's town goes back to it (docs/17 H3).
  if (was === 'recruit' && recruitFrom === 'isle') return openBase();
  // While docked, closing another screen returns to the harbour (Esc on the harbour itself hides it; P reopens).
  if (was !== 'port' && state.portView) openModal('port');
}

/** Where every scrolled box of a window stands, so a refresh from the server does not throw the reader back
 * to the top (the same window and tab only: a new tab starts at its top). */
function scrollMarks(root: HTMLElement): { view: string; at: Map<string, [number, number]> } {
  const view = `${modal}|${root.querySelector<HTMLElement>('.tab.active')?.dataset.tab ?? ''}|${root.querySelector<HTMLElement>('.tree-tab.active, .rose-node.active')?.dataset.view ?? ''}`;
  const at = new Map<string, [number, number]>();
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.scrollTop || el.scrollLeft) at.set(pathOf(root, el), [el.scrollTop, el.scrollLeft]);
  });
  return { view, at };
}
function pathOf(root: HTMLElement, el: HTMLElement): string {
  const parts: string[] = [];
  for (let e: HTMLElement | null = el; e && e !== root; e = e.parentElement) {
    const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
    parts.push(`${e.tagName}.${e.classList[0] ?? ''}#${i}`);
  }
  return parts.reverse().join('/');
}
function restoreScroll(root: HTMLElement, marks: { view: string; at: Map<string, [number, number]> }): void {
  if (!marks.at.size || scrollMarks(root).view !== marks.view) return;
  for (const [path, [top, left]] of marks.at) {
    const el = [...root.querySelectorAll<HTMLElement>('*')].find((e) => pathOf(root, e) === path);
    if (el) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  }
}

/** What the Company, island and gear windows show of her private state (they redraw when it changes). */
let lastSelfKey = '';
function selfKeyFor(m: Modal): string {
  const s = state.self;
  if (!s) return '';
  if (m === 'gear') return JSON.stringify([m, lang(), s.name, s.level, s.dockedAt, s.gold, s.stash, s.loadout, s.captainGear, s.cargo]);
  if (m === 'hero') return JSON.stringify([m, lang(), s.name, s.level, s.dockedAt, s.gold, s.hero, s.captainGear, s.glory?.open]);
  if (m === 'throne') return JSON.stringify([m, lang(), s.name, s.level, s.dockedAt, s.gold, s.glory && { ...s.glory, xp: Math.floor(s.glory.xp / Math.max(1, s.glory.need) * 200), trials: s.glory.trials.map((v) => ({ ...v, wait: Math.ceil((v.wait ?? 0) / 60) })) }]);
  return m === 'company' ? JSON.stringify([m, lang(), s.name, s.dockedAt, s.berths, s.pvp, s.maps, s.company, s.cargo, s.builds, s.gold]) : JSON.stringify([m, lang(), s.gold, s.cargo, s.dockedAt, s.homeIsle]);
}

function refreshModal(): void {
  lastSelfKey = modal === 'company' || modal === 'base' || modal === 'gear' || modal === 'hero' || modal === 'throne' ? selfKeyFor(modal) : '';
  const root = $('modal-panel');
  const marks = root.dataset.modal === (modal ?? '') ? scrollMarks(root) : null;
  // Screens dress by name in the stylesheet (header art, backgrounds).
  root.dataset.modal = modal ?? '';
  renderModal(root);
  if (marks) restoreScroll(root, marks);
}

function renderModal(root: HTMLElement): void {
  switch (modal) {
    case 'port':
      if (state.portView) portScreen.render(root, state);
      else closeModal();
      break;
    case 'talents':
      talentScreen.render(root, state);
      break;
    case 'hero':
      heroWindow.render(root, state);
      break;
    case 'map':
      worldMap.open(root, state);
      break;
    case 'journal':
      journal.render(root, state);
      break;
    case 'ship':
      renderShip(root, state, (m) => net.send(m), () => openModal('gear'), () => openModal('look'));
      break;
    case 'gear':
      renderGear(root, state, (m) => net.send(m), () => openModal('ship'));
      break;
    case 'help':
      renderHelp(root, state.onboarding);
      break;
    case 'edge':
      renderEdge(root, () => closeModal());
      break;
    case 'options':
      optionsScreen.render(root);
      break;
    case 'boarding':
      if (state.boarding) renderBoarding(root, state.boarding, state, (m) => net.send(m), () => closeModal());
      break;
    case 'crew':
      renderCrew(root, state, (m) => net.send(m));
      break;
    case 'mutiny':
      renderMutiny(root, state, (m) => net.send(m));
      break;
    case 'company':
      keepInputs(root, () => companyScreen.render(root, state));
      break;
    case 'barter':
      if (state.barter) keepInputs(root, () => renderBarter(root, state, (m) => net.send(m)));
      break;
    case 'menu':
      renderMenu(root, openMenuItem, [...(state.self?.homeIsle !== null && state.self?.homeIsle !== undefined ? ['base' as const] : []), ...(state.self?.glory?.open ? ['throne' as const] : [])]);
      break;
    case 'tattoos':
      renderTattoos(root, state, (m) => net.send(m));
      break;
    case 'choice':
      if (state.choice) renderChoice(root, state.choice, (m) => net.send(m));
      else closeModal();
      break;
    case 'dice':
      if (state.dice) renderDice(root, state, (m) => net.send(m));
      else closeModal();
      break;
    case 'look':
      renderLook(root, state, (m) => net.send(m));
      break;
    case 'hall':
      if (state.hall) renderHall(root, state, (m) => net.send(m));
      else closeModal();
      break;
    case 'descent':
      if (state.descent) renderDescent(root, state, (m) => net.send(m));
      else closeModal();
      break;
    case 'saga':
      renderSaga(root, state, (m) => net.send(m));
      break;
    case 'away':
      if (state.away) renderAway(root, state.away, (m) => net.send(m), () => closeModal());
      else closeModal();
      break;
    case 'log':
      renderLog(root, state);
      break;
    case 'base':
      baseWindow.render(root, state);
      break;
    case 'recruit':
      recruitWindow.render(root, state);
      break;
    case 'puzzle':
      puzzleWindow.render(root, state);
      break;
    case 'tame':
      tameWindow.render(root, state);
      break;
    case 'throne':
      throneWindow.render(root, state);
      break;
    case 'shop':
      premiumWindow.render(root, state);
      break;
    case 'sunk':
      if (lastSunk) renderSunk(root, lastSunk.lost, lastSunk.port, () => openModal(state.portView ? 'port' : null), lastSunk.towed);
      break;
  }
  if (touch.enabled) stripKeyHints(root);
  root.querySelectorAll<HTMLElement>('[data-tame]').forEach((b) => (b.onclick = () => openTame())); // docs/18 IV
  root.querySelectorAll<HTMLElement>('[data-throne]').forEach((b) => (b.onclick = () => openThrone())); // docs/19 E18
  ensureCloseButton(root);
}

/** Ledgers with a header row: each cell learns its column's name, so a phone can lay the rows out as cards. */
function labelLedgers(root: HTMLElement): void {
  root.querySelectorAll<HTMLTableElement>('table.grid:not(.market):not([data-ledger])').forEach((t) => {
    const head = t.querySelector('tr');
    if (!head || !head.querySelector('th')) return;
    t.dataset.ledger = '1';
    const names = [...head.children].map((c) => (c.textContent ?? '').trim());
    t.querySelectorAll('tr').forEach((tr, i) => {
      if (i === 0) return;
      [...tr.children].forEach((td, k) => {
        if (names[k] && !(td as HTMLElement).dataset.l) (td as HTMLElement).dataset.l = names[k];
      });
    });
  });
}

/** Every window can be closed by touch (a fight's result and a shipwreck wait for their own buttons). */
function ensureCloseButton(root: HTMLElement): void {
  if (!modal || modal === 'boarding' || modal === 'sunk' || modal === 'mutiny') return;
  let x = root.querySelector<HTMLElement>('.x-btn');
  if (!x) {
    x = document.createElement('button');
    x.className = 'x-btn';
    x.setAttribute('aria-label', 'Close');
    x.onclick = () => (modal === 'barter' ? net.send({ t: 'barter', action: 'cancel' }) : closeModal());
    root.append(x);
  }
  alignCloseButton(root, x);
}

/** The cross sits on the title plate's middle line, whatever the plate holds (an icon, a crest) — a fixed top left it
 *  8px off in some windows. The panel is zoomed by the UI scale, so screen pixels are turned back into its own. */
function alignCloseButton(root: HTMLElement, x: HTMLElement): void {
  const h = root.querySelector<HTMLElement>('.modal-head h2');
  if (!h || x.parentElement !== root || !x.offsetHeight) return;
  const pr = root.getBoundingClientRect(), hr = h.getBoundingClientRect();
  const k = pr.width / (root.offsetWidth || pr.width) || 1;
  // An absolute child's top counts from inside the panel's frame (its border), not from its outer edge.
  const top = `${Math.max(4, Math.round(((hr.top + hr.bottom) / 2 - pr.top) / k - root.clientTop - x.offsetHeight / 2))}px`;
  if (x.style.top !== top) x.style.top = top;
}
addEventListener('resize', () => {
  const root = $('modal-panel');
  const x = root.querySelector<HTMLElement>('.x-btn');
  if (modal && x) alignCloseButton(root, x);
});

/** Touch screens have no keys: "[F]"-style hints come off buttons and tabs. */
function stripKeyHints(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('button, .tab, .btn').forEach((el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE && /\[[^\]]{1,8}\]/.test(n.textContent ?? '')) n.textContent = (n.textContent ?? '').replace(/\s*\[[^\]]{1,8}\]\s*/g, ' ').trim();
    }
  });
}

/** A screen from the captain's cabin or the micro menu. */
function openMenuItem(m: MenuItem): void {
  if (m === 'chat') {
    if (modal) closeModal();
    const input = $('chat-input') as HTMLInputElement;
    // A touch keyboard has no Enter to name: the hint says what to do.
    if (touch.enabled && hud.chatPanel.filter === 'all') input.placeholder = t('hud.chatPhTouch');
    hud.chatPanel.open(!touch.enabled);
  } else if (m === 'company') {
    companyScreen.open();
    openModal('company');
  } else if (m === 'base') openBase();
  else if (m === 'hero') openHero();
  else if (m === 'throne') openThrone();
  else if (m === 'shop') openShop();
  else openModal(m);
}

/** The desktop micro menu: every screen one click away, in icons (glyphs until the art loads). */
function buildMicroMenu(): void {
  $('hud-menu').innerHTML = MENU_ITEMS.map((m) => `<button data-menu="${m.id}" title="${esc(menuLabel(m.id))}">${icon(m.art ?? `menu_${m.id}`, m.glyph)}</button>`).join('');
  $('hud-menu').querySelectorAll<HTMLElement>('[data-menu]').forEach((b) => (b.onclick = () => openMenuItem(b.dataset.menu as MenuItem)));
}
buildMicroMenu();
// The chat's channels: a filter on the lines, and the field says where plain words go.
const chatChannels = () => hud.chatTabs((ch) => {
  const input = $('chat-input') as HTMLInputElement;
  input.placeholder = ch === 'all' ? t(touch.enabled ? 'hud.chatPhTouch' : 'hud.chatPh') : HUD_L(`ph_${ch}`);
});
chatChannels();
onLang(chatChannels);
onLang(() => hud.chatPanel.art());
// Who the reader is and who is near her: the colour of each name in the chat.
hud.chatPanel.context = () => ({
  self: state.self?.name ?? null,
  group: (state.party?.members ?? []).map((x) => x.name),
  guild: (state.guild?.members ?? []).map((x) => x.name),
  friends: state.friends.map((f) => f.name),
});
hud.chatPanel.onSend = () => sendChat();

/** What is in the chat's field goes where it is addressed: a command, the channel picked, or everyone. */
function sendChat(): void {
  const chatInput = $('chat-input') as HTMLInputElement;
  const filter = hud.chatPanel.filter;
  const said = chatInput.value.trim();
  if (said === whisperPrefill.trim()) {
    chatInput.value = '';
    return;
  }
  // "/g …" speaks to your group only.
  if (/^\/ritual\b/i.test(said)) net.send({ t: 'abyss', action: 'ritual' });
  else if (/^\/gc\s/i.test(said)) net.send({ t: 'guild', action: 'say', text: said.slice(4) });
  else if (/^\/g\s/i.test(said)) net.send({ t: 'group', action: 'say', text: said.slice(3) });
  // Words with no command go to the chosen channel: the group, the guild, the last whisperer, or all.
  else if (said && !said.startsWith('/') && filter === 'group') net.send({ t: 'group', action: 'say', text: said });
  else if (said && !said.startsWith('/') && filter === 'guild') net.send({ t: 'guild', action: 'say', text: said });
  else if (said && !said.startsWith('/') && filter === 'whisper') net.send({ t: 'chat', text: `/r ${said}` });
  else if (said) net.send({ t: 'chat', text: said });
  chatInput.value = '';
  whisperPrefill = '';
}
$('hud-map').onclick = () => toggle('map');
// The action bar (owner, 2026-10-02): a button does what its key does; «⋯ more» opens the rest. A press never takes
// the focus (Space and Enter stay the ship's).
$('hud-prompt').addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).closest('button')) e.preventDefault();
});
$('hud-prompt').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.closest('[data-act-more]')) {
    actsMore = !actsMore;
    return;
  }
  const b = el.closest<HTMLElement>('[data-act]');
  const a = b ? curActs[Number(b.dataset.act)] : undefined;
  if (a) runAct(a);
});
// Screens redraw themselves (a tab click, a trade): on touch their keyboard hints come off every time.
new MutationObserver(() => {
  if (touch.enabled) stripKeyHints($('modal-panel'));
  decorateSums($('modal-panel'));
  // A screen that redraws itself (a tab clicked) must not lose its close button.
  ensureCloseButton($('modal-panel'));
  labelLedgers($('modal-panel'));
}).observe($('modal-panel'), { childList: true, subtree: true });

function toggle(m: Modal): void {
  if (modal === m) closeModal();
  else openModal(m);
}

// ------------------------------------------------------------------ input

function typing(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
}

// The chat stays open until its button, its × or Esc folds it away; a whisper's address left alone is cleared.
($('chat-input') as HTMLInputElement).addEventListener('blur', () => {
  const input = $('chat-input') as HTMLInputElement;
  setTimeout(() => {
    if (document.activeElement !== input && whisperPrefill && input.value === whisperPrefill) input.value = '';
  }, 150);
});

addEventListener('keydown', (e) => {
  if (!inGame) return;
  const chatInput = $('chat-input') as HTMLInputElement;
  if (e.key === 'Escape' && hud.chatPanel.isOpen) {
    // Esc in the field leaves it (the keys steer the ship again); Esc once more folds the chat away.
    if (document.activeElement === chatInput) {
      if (chatInput.value === whisperPrefill) chatInput.value = '';
      chatInput.blur();
    } else hud.chatPanel.close();
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter') {
    // Enter opens the chat and its field; Enter in the field sends (an empty field gives the keys back).
    if (document.activeElement === chatInput) {
      if (chatInput.value.trim()) sendChat();
      else chatInput.blur();
    } else if (!typing()) hud.chatPanel.open(true);
    else return;
    e.preventDefault();
    return;
  }
  // Esc leaves the options even with a slider or a list still in focus.
  if (e.key === 'Escape' && modal === 'options' && !optionsScreen.capturing) {
    (document.activeElement as HTMLElement | null)?.blur();
    closeModal();
    return;
  }
  if (typing()) return;
  // A deck fight takes the digits for its orders and Space for the duel's blade.
  if (!modal && (tactical.onKey(e) || boardFight.onKey(e))) {
    e.preventDefault();
    return;
  }
  const k = keyOf(e);
  if (k === 'escape') {
    if (modal === 'barter') net.send({ t: 'barter', action: 'cancel' });
    else if (modal && modal !== 'boarding' && modal !== 'sunk') closeModal();
    else if (!modal) openModal('options');
    return;
  }
  if (modal === 'options' && optionsScreen.capturing) return;
  // The diving bell: Shift+arrows steer it through the drowned streets.
  if (state.dive?.leader && e.shiftKey && e.key.startsWith('Arrow')) {
    const d = ({ ArrowUp: 'n', ArrowRight: 'e', ArrowDown: 's', ArrowLeft: 'w' } as const)[e.key as 'ArrowUp'];
    if (d) net.send({ t: 'dive_move', dir: d });
    e.preventDefault();
    return;
  }
  const act = actionFor(settings().keys, k);
  if (!act) return;
  // Arrows and Space must not scroll the page.
  if (k === ' ' || k.startsWith('arrow') || /^f\d+$/.test(k)) e.preventDefault();
  if (e.repeat && act !== 'rudderLeft' && act !== 'rudderRight') return;
  keys.add(k);
  const docked = !!state.self?.dockedAt;
  switch (act) {
    case 'sailUp':
      state.input.sail = clamp(state.input.sail + 1, 0, 4);
      break;
    case 'sailDown':
      state.input.sail = clamp(state.input.sail - 1, 0, 4);
      break;
    case 'firePort':
      holdFire('port');
      break;
    case 'fireStarboard':
      holdFire('starboard');
      break;
    case 'dash':
      e.preventDefault();
      net.send({ t: 'dash' });
      break;
    case 'target':
      e.preventDefault();
      cycleTarget();
      break;
    case 'ammo1':
    case 'ammo2':
    case 'ammo3':
    case 'ammo4':
    case 'ammo5':
      net.send({ t: 'ammo', ammo: AMMO_IDS[Number(act.slice(4)) - 1] });
      break;
    case 'talent1':
    case 'talent2':
    case 'talent3':
    case 'talent4':
    case 'talent5': {
      const list = state.self ? activeTalents(state.self.talents) : [];
      const tal = list[Number(act.slice(6)) - 1];
      if (tal) sendTalent(tal.id);
      else hud.toast(L('noTalent'), 'bad');
      break;
    }
    case 'fireMode':
      net.send({ t: 'fire_mode', rolling: !state.self?.rollingFire });
      break;
    case 'chasers':
      fireChasers();
      break;
    case 'abilityZ':
    case 'abilityX':
    case 'abilityC':
    case 'abilityV':
      useAbilityKey(act.slice(7) as 'Z');
      break;
    case 'board':
      // Held by a kraken's arm: the board key is the axes (the server takes any ship as the order's target).
      if (grabbed()) {
        net.send({ t: 'board', target: state.entityId ?? 0, aggression: 'standard' });
        break;
      }
      if (state.you && state.you.flags & SF.BOARDING) {
        net.send(e.shiftKey ? { t: 'scuttle' } : { t: 'board_cut' });
        break;
      }
      if (boardTarget !== null) {
        const aggression: Aggression = e.shiftKey ? 'careful' : e.ctrlKey ? 'brutal' : 'standard';
        net.send({ t: 'board', target: boardTarget, aggression });
      } else hud.toast(L('noCrippled'), 'bad');
      break;
    case 'land': {
      // With nothing ashore to land at, the same key cuts the mast wreckage, casts the net into a shoal (owner,
      // 2026-09-30) or works the sea mark at hand — whichever the action bar shows first.
      const a = state.self?.landable ? null : landKeyAct(gatherActs().acts);
      if (a) runAct(a);
      else sendLand();
      break;
    }
    case 'orders': {
      const cur = state.you?.station ?? 'balanced';
      net.send({ t: 'station', station: STATIONS[(STATIONS.indexOf(cur) + 1) % STATIONS.length] });
      break;
    }
    case 'repair':
      net.send({ t: 'repair', on: !(state.you && state.you.flags & SF.REPAIRING) });
      break;
    case 'dock':
      if (docked) departOrAsk(state, (m) => net.send(m), () => net.send({ t: 'undock' }));
      else requestDock(e.shiftKey);
      break;
    case 'map':
      toggle('map');
      break;
    case 'journal':
      toggle('journal');
      break;
    case 'talents':
      toggle('talents');
      break;
    case 'ship':
      toggle('ship');
      break;
    case 'crew':
      toggle('crew');
      break;
    case 'company':
      if (modal !== 'company') companyScreen.open();
      toggle('company');
      break;
    case 'cursedShot':
      net.send({ t: 'ammo', ammo: 'cursed' });
      break;
    case 'formation': {
      const order = ['line', 'wedge', 'ring'] as const;
      const cur = state.self?.fleet.formation ?? 'line';
      net.send({ t: 'formation', formation: order[(order.indexOf(cur) + 1) % 3] });
      break;
    }
    case 'help':
      toggle('help');
      break;
    case 'mute':
      hud.toast(L(audio.toggleMute() ? 'soundOff' : 'soundOn'), 'info');
      break;
    case 'harbour':
      if (docked) openModal('port');
      break;
    case 'readAloud':
      readAloud();
      break;
  }
});
addEventListener('keyup', (e) => {
  const k = keyOf(e);
  keys.delete(k);
  // A held broadside fires when its key comes up.
  const act = actionFor(settings().keys, k);
  if (act === 'firePort') releaseFire('port');
  else if (act === 'fireStarboard') releaseFire('starboard');
});
addEventListener('blur', () => {
  keys.clear();
  charge = null;
});

const canvas = $('world');
canvas.addEventListener('mousemove', (e) => {
  renderer.mouseX = e.clientX;
  renderer.mouseY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  renderer.userZoomed = true;
  renderer.targetZoom = clamp(renderer.targetZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.35, 4);
});
canvas.addEventListener('mousedown', (e) => {
  if (!inGame || e.button !== 0) return;
  pinTarget(shipAtScreen(e.clientX, e.clientY)); // a click on a ship makes her the target (and fires at her)
  const side = sideUnderCursor();
  if (side) fire(side);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!inGame || e.button !== 2 || state.self?.dockedAt) return;
  const m = mouseWorld();
  net.send({ t: 'mount', x: Math.round(m.x), y: Math.round(m.y) });
});

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

/** A broadside's order being held (dynamic combat): the charge runs from when the guns are loaded; the release
 *  fires it. `start` is set once the side is loaded. */
let charge: { side: 'port' | 'starboard'; start: number | null } | null = null;

function holdFire(side: 'port' | 'starboard'): void {
  if (state.self?.dockedAt || modal) return;
  net.send({ t: 'aim', side });
  charge = { side, start: null };
}

function releaseFire(side: 'port' | 'starboard'): void {
  if (charge?.side !== side) return;
  charge = null;
  if (touch.enabled) touchFire(side);
  else fire(side);
}

/** Seconds the broadside has been held loaded (for the aim's drawing). */
function chargeHeld(): { side: 'port' | 'starboard'; held: number } | null {
  if (!charge || !state.you) return null;
  const now = performance.now();
  if (charge.start === null && state.you.reload[charge.side] >= 1) charge.start = now;
  return { side: charge.side, held: charge.start === null ? 0 : (now - charge.start) / 1000 };
}

function fire(side: 'port' | 'starboard'): void {
  if (state.self?.dockedAt) return;
  const m = mouseWorld();
  net.send({ t: 'fire', side, dist: Math.round(aimDistance()), x: Math.round(m.x), y: Math.round(m.y) });
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
  if (!end) return hud.toast(L('chasersKeel'), 'bad');
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
hud.onTalent = (id) => sendTalent(id);
hud.onAmmoCycle = () => cycleAmmo(1);

function sendTalent(id: string): void {
  const m = mouseWorld();
  net.send({ t: 'talent_active', id, x: Math.round(m.x), y: Math.round(m.y) });
}

function sendInput(now: number): void {
  // Until the first snapshot tells us how she is rigged, the helm sends nothing (no default sail on a reconnect).
  if (state.syncSail) return;
  const km = settings().keys;
  const held = (a: 'rudderLeft' | 'rudderRight') => km[a].some((k) => k && keys.has(k));
  const rudder = (held('rudderRight') ? 1 : 0) - (held('rudderLeft') ? 1 : 0);
  // The helm stick sets a course and she holds it; keys or the pad take the helm back.
  if (rudder || padRudder) touch.course = null;
  const own = state.ownDisplay;
  const touchRudder = touch.course !== null && own ? rudderToward(touch.course, own.heading) : 0;
  state.input.rudder = typing() ? 0 : rudder || Math.round(padRudder * 100) / 100 || Math.round(touchRudder * 100) / 100;
  const key = `${state.input.rudder}|${state.input.sail}`;
  if (key !== lastInputKey || now - lastInputSent > 250) {
    lastInputKey = key;
    lastInputSent = now;
    net.send({ t: 'input', seq: ++state.input.seq, rudder: state.input.rudder, sail: state.input.sail });
  }
}

// ------------------------------------------------------------------ context prompt & board target

/** The key an action is bound to, as the prompt shows it (the player may have rebound it). */
function keyOfAction(a: Action): string {
  const [k1, k2] = settings().keys[a];
  return keyLabel(k1 || k2);
}

/** The descent's tier whose choice window was opened (once a tier). */
let lastDescentTier = -1;

/** The action bar's buttons as last drawn (a click names one by its place), whether «⋯ more» is open, and a mark
 *  waiting for her to shorten sail. */
let curActs: Act[] = [];
let actsMore = false;
let actTipOffered = false;
let pendingMark: { id: number; until: number } | null = null;
/** docs/19 D5: the small thing her boats will go to once she has slowed. */
let pendingFind: { id: number; until: number } | null = null;

/** docs/19 D5: the sea's small thing within reach of her (the flying fish: aboard while they last). */
function findAtHand(): FindView | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) return null;
  let best: FindView | null = null, bd = Infinity;
  for (const f of state.finds) {
    const d = f.kind === 'flyfish' ? 0 : dist(f.x, f.y, own.x, own.y);
    if (d <= FIND_REACH[f.kind] && d < bd) [best, bd] = [f, d];
  }
  return best;
}

/** docs/19 D7: the roaming stack within a cable of her (the nearest). */
function roamAtHand(): RoamView | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) return null;
  let best: RoamView | null = null, bd = ROAM_REACH;
  for (const v of state.roams) {
    if (Math.abs(v.x - own.x) > ROAM_REACH + 200 || Math.abs(v.y - own.y) > ROAM_REACH + 200) continue;
    const p = roamNow(state, v);
    const d = dist(p.x, p.y, own.x, own.y);
    if (d <= bd) [best, bd] = [v, d];
  }
  return best;
}

/** The nearest of the dense sea's marks within the boats' reach of her. */
function markAtHand(): SeaMarkData | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) return null;
  let best: SeaMarkData | null = null, bd = Infinity;
  for (const m of state.seaMarks.values()) {
    if (Math.abs(m.x - own.x) > 600 || Math.abs(m.y - own.y) > 600 || !markInReach(m, own.x, own.y)) continue;
    const d = dist(m.x, m.y, own.x, own.y) - m.r;
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

/** Everything to do at hand (the bar's buttons, the pad's A) and the muted line of what stops her. Picks the ship
 *  in the grapples' reach on the way (the renderer marks her). */
function gatherActs(): { acts: Act[]; info: string[] } {
  const own = state.ownDisplay;
  const self = state.self;
  const you = state.you;
  boardTarget = null;
  if (!own || !self || !you) return { acts: [], info: [] };
  if (self.dockedAt) return { acts: buildActs({ grabbed: grabbed(), docked: true, harbourOpen: modal === 'port' }), info: [] };
  const st = state.ownStats!;
  let best: number | null = null, bd = Infinity;
  for (const s of state.ships.values()) {
    if (!s.info) continue;
    const c = s.cur;
    if (c.flags & (SF.SINKING | SF.DOCKED | SF.PROTECTED)) continue;
    const cls = SHIP_CLASSES[s.info.classId];
    if (beastOfClass(s.info.classId)) continue; // no decks on a beast of the sea
    const d = dist(own.x, own.y, c.x, c.y);
    const range = st.boardingRange + (st.beam + cls.beam) / 2;
    if (d > range) continue;
    // Boarding at once (docs/17 H1): any ship in the grapples' reach, whole or wrecked; the server says why not.
    if ((s.info.isPlayer || s.info.npcRole === 'escort') && !(c.flags & SF.HOSTILE)) continue;
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  }
  boardTarget = best;
  const info: string[] = [];
  const facts: ActFacts = { grabbed: grabbed() };
  if (best !== null) facts.board = { name: placeName(state.ships.get(best)?.info?.name ?? L('her')) };
  const port = state.ports.find((p) => dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS);
  if (port) facts.port = { name: sv(port.name) };
  const ab = self.abyss;
  facts.ritual = !!ab && ab.shards >= 3 && dist(own.x, own.y, ab.eye.x, ab.eye.y) < 1500;
  const l = self.landable;
  if (self.landing) {
    const now = state.estServerTime();
    const frac = Math.max(0, Math.min(1, (now - self.landing.started) / (self.landing.until - self.landing.started)));
    info.push(`${esc(L('ashore', { feature: sv(self.landing.feature.replace('_', ' ')), pct: Math.round(frac * 100) }))} ${esc(L('recall'))}`);
  } else if (l?.blocked) {
    // What stops you, after the place it is about (with a capital: it opens the line) unless it names the place itself.
    const why = sv(l.blocked), where = sv(l.feature);
    info.push(esc(why.includes(sv(l.island)) ? why : `${where.charAt(0).toUpperCase()}${where.slice(1)} — ${why}`));
  }
  if (l) {
    const feature = sv(l.feature), island = sv(l.island);
    const action = (['dig', 'raise', 'expedition', 'descent', 'keeper', 'escort', 'dive', 'lair'] as const).find((x) => x === l.action) ?? 'land';
    const wreck = sv(l.feature.replace(/^wreck of the /, ''));
    const title = action === 'dig' ? L('dig', { feature, island }) : action === 'raise' ? L('raise', { feature: wreck }) : action === 'expedition' ? L('expedition', { island })
      : action === 'descent' ? L('descent') : action === 'keeper' ? LI('keeper.prompt', { island, price: l.feature }) : action === 'escort' ? L('escortSign', { feature, island })
      : action === 'dive' ? L('dive', { feature }) : action === 'lair' ? LLAIR('prompt', { feature, island }) : L('landParty', { feature, island });
    facts.landable = { action, feature: action === 'keeper' ? island : action === 'raise' ? wreck : feature, island, blocked: !!l.blocked || !!self.landing, title: `${title}${landTagText(l)}` };
  }
  facts.mastWreck = !l && mastWreck();
  facts.cast = !l && !mastWreck() ? castable() : null;
  const home = nearHome();
  if (home) facts.home = { name: placeName(home.name) };
  facts.homeOpen = modal === 'base';
  const wild = self.claimIsle;
  if (wild) facts.claim = { name: placeName(wild.name), price: fmt(wild.price) };
  facts.claimOpen = modal === 'company';
  const mk = markAtHand();
  if (mk) {
    const busy = state.markBusy?.id === mk.id ? state.markBusy : null;
    facts.mark = { id: mk.id, kind: mk.kind, done: state.markDone.has(mk.id), busy: !!busy };
    if (busy) info.push(esc(markInfo(mk.kind, 'busy', busy.until - state.estServerTime())));
    else if (state.markDone.has(mk.id)) info.push(esc(markInfo(mk.kind, 'done')));
    else if (pendingMark?.id === mk.id) info.push(esc(slowWord()));
  }
  const fd = findAtHand();
  if (fd) {
    const busy = state.findBusy?.id === fd.id ? state.findBusy : null;
    facts.find = { id: fd.id, kind: fd.kind, busy: !!busy, ...(fd.n ? { n: fd.n } : {}) };
    if (busy) info.push(esc(findInfo(fd.kind, busy.until - state.estServerTime())));
    else if (pendingFind?.id === fd.id) info.push(esc(slowWord()));
  }
  const rm = roamAtHand();
  if (rm) {
    const name = roamName(rm.kind);
    facts.roam = { id: rm.id, icon: ROAM_UNITS[ROAMS[rm.kind].u as keyof typeof ROAM_UNITS].art, name, word: roamWord(rm.n).word, lv: rm.level, ...(rm.fight ? { fight: rm.fight } : {}), ...(rm.offer ? { offer: rm.offer } : {}), ...(rm.joinN ? { joinN: rm.joinN } : {}) };
    if (rm.fight) info.push(esc(LROAM(rm.fight === 'mate' ? 'i.mate' : 'i.fight', { what: name })));
    else if (rm.offer === 'flee' && rm.ratio !== undefined) info.push(esc(LROAM('i.flee', { r: rm.ratio })));
  }
  facts.looks = advCard.closedLooks();
  // A struck ship's terms put off by «Later»: her card back with «Look…».
  const struck = surrenderCard.laterName();
  if (struck) facts.looks.unshift({ kind: 'struck', name: struck });
  if (you.flags & SF.PROTECTED) info.push(esc(L('protected')));
  // Mending at sea (docs/16 #15): the carpenters' pace and what it takes, or what they lack.
  const repairing = !!(you.flags & SF.REPAIRING);
  const rep = repairState(self, you, repairing);
  facts.repair = rep ? { repairing, combat: !!you.combat, hurt: rep.hurt, short: rep.short } : repairing ? { repairing, combat: !!you.combat, hurt: true } : null;
  if (rep?.line) info.push(rep.line);
  if (you.combat && !repairing && you.hull < you.hullMax * 0.5 && !touch.enabled) info.push(esc(L('repairLull', { key: '\u0000' })).replace('\u0000', `<kbd>${esc(keyOfAction('repair'))}</kbd>`));
  return { acts: buildActs(facts), info };
}

/** The island's level and its warning in words (the tooltip of the land button). */
function landTagText(l: NonNullable<NonNullable<typeof state.self>['landable']>): string {
  if (!l.lv) return '';
  return ` · ⚓${l.lv}${l.danger === 'deadly' ? ` · ${L18('prompt.deadly')}` : l.danger === 'warn' ? ` · ${L18('prompt.warn')}` : ''}`;
}

function computePrompt(): string {
  const { acts, info } = gatherActs();
  curActs = acts;
  if (acts.length <= ACT_SHOW) actsMore = false;
  if (acts.length && !actTipOffered) {
    actTipOffered = true;
    firstTips.offer('actions', true);
  }
  return actBarHtml(acts, info, touch.enabled ? null : keyOfAction, actsMore);
}

/** A button of the bar (or its key, or the pad's A) does its thing. */
function runAct(a: Act): void {
  switch (a.id) {
    case 'axes':
      return void net.send({ t: 'board', target: state.entityId ?? 0, aggression: 'standard' });
    case 'harbour':
      return openModal('port');
    case 'board':
      return void (boardTarget !== null ? net.send({ t: 'board', target: boardTarget, aggression: 'standard' }) : hud.toast(L('noCrippled'), 'bad'));
    case 'dock':
      return requestDock(false);
    case 'land':
      return sendLand();
    case 'cut_mast':
      return void net.send({ t: 'cut_mast' });
    case 'cast':
      return void net.send({ t: 'fishing', action: 'cast' });
    case 'base':
      return openBase();
    case 'claim':
      return openClaim();
    case 'ritual':
      return void net.send({ t: 'abyss', action: 'ritual' });
    case 'mark':
      return workMark(Number(a.arg));
    case 'find':
      return workFind(Number(a.arg));
    case 'roam':
      return void net.send({ t: 'roam', action: 'attack', id: Number(a.arg) });
    case 'roam_join':
      return void net.send({ t: 'roam', action: 'join', id: Number(a.arg) });
    case 'roam_look': {
      const v = state.roams.find((x) => x.id === Number(a.arg));
      if (v) void openRoamCard(state, v, (action, id) => net.send({ t: 'roam', action, id }));
      return;
    }
    case 'look':
      return a.arg === 'struck' ? surrenderCard.reopen() : advCard.reopen();
    case 'repair':
      return void net.send({ t: 'repair', on: !(state.you && state.you.flags & SF.REPAIRING) });
  }
}

/** Boats away to a sea mark: at speed the crew takes in sail first and they go as soon as she has slowed. */
function workMark(id: number): void {
  const own = state.ownDisplay;
  if (own && own.speed > MARK_SLOW) {
    state.input.sail = 0;
    pendingMark = { id, until: performance.now() + 25000 };
    return;
  }
  pendingMark = null;
  net.send({ t: 'seamark', action: 'work', id });
}
/** docs/19 D5: boats away to a small thing (the crew takes in sail first where the boats must be lowered). */
function workFind(id: number): void {
  const own = state.ownDisplay;
  const f = state.finds.find((x) => x.id === id);
  if (f && own && own.speed > FIND_SLOW[f.kind]) {
    state.input.sail = 0;
    pendingFind = { id, until: performance.now() + 25000 };
    return;
  }
  pendingFind = null;
  net.send({ t: 'seafind', action: 'work', id });
}
function stepPendingFind(): void {
  if (!pendingFind) return;
  const own = state.ownDisplay;
  const f = state.finds.find((x) => x.id === pendingFind!.id);
  if (!f || state.self?.dockedAt || performance.now() > pendingFind.until || state.input.sail > 0) {
    pendingFind = null;
    return;
  }
  if (own && own.speed <= FIND_SLOW[f.kind]) workFind(pendingFind.id);
}

function stepPendingMark(): void {
  if (!pendingMark) return;
  const own = state.ownDisplay;
  if (state.self?.dockedAt || performance.now() > pendingMark.until || state.input.sail > 0) {
    pendingMark = null;
    return;
  }
  if (own && own.speed <= MARK_SLOW) workMark(pendingMark.id);
}

// ------------------------------------------------------------------ gamepad (docs/07 §12)

const pad = new PadInput();
let padRudder = 0;
let padHoldHeading: number | null = null;
let padAim: { side: 'port' | 'starboard'; range: number; lead: number } | null = null;
let padTarget: number | null = null;
let padCursor: { x: number; y: number } | null = null;
let padSeen = false;
let radial: { items: { label: string; run: () => void }[]; sel: number; opener: number } | null = null;

function activePad(): Gamepad | null {
  for (const g of navigator.getGamepads?.() ?? []) if (g && g.connected) return g;
  return null;
}

function openRadial(items: { label: string; run: () => void }[], opener: number): void {
  radial = { items: items.slice(0, 8), sel: -1, opener };
  const el = $('radial');
  el.innerHTML = radial.items.map((it, i) => {
    const a = (i / radial!.items.length) * Math.PI * 2;
    return `<div class="r-item" data-i="${i}" style="left:${50 + Math.sin(a) * 38}%;top:${50 - Math.cos(a) * 38}%">${esc(it.label)}</div>`;
  }).join('');
  el.classList.remove('hidden');
}

function closeRadial(choose: boolean): void {
  if (!radial) return;
  const it = radial.sel >= 0 ? radial.items[radial.sel] : null;
  radial = null;
  $('radial').classList.add('hidden');
  if (choose && it) it.run();
}

function ammoRadial(): { label: string; run: () => void }[] {
  return AMMO_IDS.filter((a) => (state.self?.ammo[a] ?? 0) > 0 || a === 'round').map((a) => ({ label: AMMO[a].name, run: () => net.send({ t: 'ammo', ammo: a }) }));
}

function actionsRadial(): { label: string; run: () => void }[] {
  return [
    { label: t('act.repair'), run: () => net.send({ t: 'repair', on: !(state.you && state.you.flags & SF.REPAIRING) }) },
    { label: t('act.board'), run: () => (boardTarget !== null ? net.send({ t: 'board', target: boardTarget, aggression: 'standard' }) : hud.toast(L('noCrippled'), 'bad')) },
    { label: t('act.orders'), run: () => net.send({ t: 'station', station: STATIONS[(STATIONS.indexOf(state.you?.station ?? 'balanced') + 1) % STATIONS.length] }) },
    { label: t('act.land'), run: () => sendLand() },
    { label: t('act.fireMode'), run: () => net.send({ t: 'fire_mode', rolling: !state.self?.rollingFire }) },
    { label: t('act.formation'), run: () => net.send({ t: 'formation', formation: (['line', 'wedge', 'ring'] as const)[((['line', 'wedge', 'ring'] as const).indexOf(state.self?.fleet.formation ?? 'line') + 1) % 3] }) },
    { label: t('act.crew'), run: () => toggle('crew') },
    { label: t('act.company'), run: () => (companyScreen.open(), toggle('company')) },
  ];
}

/** The pad's context action (and the touch bar's gold button): the first of the action bar's — board, dock, land,
 *  cut the mast, cast, her island, a sea mark, a card closed by hand, repair. In port: the harbour's screen on touch,
 *  casting off otherwise (the bar itself shows nothing over the harbour's screen). */
function padContext(): void {
  if (state.self?.dockedAt && !grabbed()) return void (touch.enabled && modal !== 'port' ? openModal('port') : departOrAsk(state, (m) => net.send(m), () => net.send({ t: 'undock' })));
  const first = gatherActs().acts[0];
  if (first) runAct(first);
}

/** Lying off one's own island (docs/15): the way into its base. */
function nearHome(): { name: string } | null {
  const id = state.self?.homeIsle;
  const own = state.ownDisplay;
  if (id === null || id === undefined || !own || state.self?.dockedAt) return null;
  const isl = state.islands.get(id);
  if (!isl || dist(isl.x, isl.y, own.x, own.y) - isl.r > 900) return null;
  return { name: isl.name };
}

/** Whether the net (or the lamp) can be cast here and now, as the server will judge it (fishing.ts castCheck). */
function castable(): 'net' | 'lamp' | null {
  const self = state.self, own = state.ownDisplay, you = state.you;
  const f = self?.fishing;
  if (!self || !own || !you || !f || self.dockedAt || netHaul.active || fishFight.active) return null;
  const spd = you.spd, max = state.ownStats?.maxSpeed ?? 10;
  if (f.method === 'net' && spd <= max * 0.4 && state.shoals.some((s) => Math.hypot(s.x - own.x, s.y - own.y) <= s.r)) return 'net';
  if (f.method === 'lamp' && f.skill >= 30 && spd <= 1.5 && isNight(state.estServerTime())) return 'lamp';
  return null;
}

/** A fallen mast's wreckage drags alongside (it can be cut away). */
function mastWreck(): boolean {
  return !!state.self?.effects.some((e) => e.id === 'mast_wreck');
}

/** Docking at speed: the crew takes in sail and she enters harbour as soon as she has slowed (the server wants
 * her under 7 m/s), instead of a refusal the captain must puzzle out. */
let pendingDock: { bribe: boolean; until: number; next: number } | null = null;
function requestDock(bribe: boolean, refused = false): void {
  const own = state.ownDisplay;
  if (refused || (own && own.speed > 6)) {
    state.input.sail = 0;
    if (!pendingDock) hud.toast(L('reefToDock'), 'info');
    pendingDock = { bribe, until: performance.now() + 25000, next: performance.now() + 1500 };
    return;
  }
  net.send({ t: 'dock', bribe });
}
function stepPendingDock(): void {
  if (!pendingDock) return;
  const own = state.ownDisplay;
  if (state.self?.dockedAt || performance.now() > pendingDock.until || state.input.sail > 0) {
    pendingDock = null;
    return;
  }
  if (own && own.speed <= 6 && performance.now() >= pendingDock.next) {
    // Keep the request until the harbour answers: a refusal (still too fast) renews it.
    pendingDock.next = performance.now() + 1500;
    net.send({ t: 'dock', bribe: pendingDock.bribe });
  }
}

function cycleAmmo(dir: number): void {
  const have = AMMO_IDS.filter((a) => (state.self?.ammo[a] ?? 0) > 0);
  if (!have.length) return;
  const i = have.indexOf(state.self?.ammoSel ?? 'round');
  net.send({ t: 'ammo', ammo: have[(i + dir + have.length) % have.length] });
}

/** Held by a kraken's arm (the board key is the axes then). */
function grabbed(): boolean {
  return !!(state.you && state.you.flags & SF.GRABBED) || !!state.bosses.some((b) => b.you.grabbed);
}

/** The nearest ship within reach that a touch aims at: hostile ones count double, `accept` narrows the arc. */
function touchTarget(reach: number, accept: (local: { x: number; y: number }) => boolean): { x: number; y: number } | null {
  const own = state.ownDisplay;
  if (!own) return null;
  let best: { x: number; y: number } | null = null, score = Infinity;
  for (const s of state.ships.values()) {
    if (s.id === state.entityId || s.cur.flags & (SF.SINKING | SF.DOCKED | SF.HIDDEN)) continue;
    const d = dist(s.cur.x, s.cur.y, own.x, own.y);
    if (d > reach || !accept(toShipLocal(s.cur.x, s.cur.y, own.x, own.y, own.heading))) continue;
    const sc = d * (s.cur.flags & SF.HOSTILE ? 0.5 : 1);
    if (sc < score) {
      score = sc;
      best = { x: s.cur.x, y: s.cur.y };
    }
  }
  return best;
}

/** A touch broadside: laid on the best ship abeam on that side, or at two-thirds range when the sea is empty. */
function touchFire(side: 'port' | 'starboard'): void {
  if (!touchAim(side)) return;
  fire(side);
}

/** A broadside button aims itself: at the nearest ship on that beam, else two thirds of the range out. */
function touchAim(side: 'port' | 'starboard'): boolean {
  const own = state.ownDisplay;
  if (!own || !state.self) return false;
  const range = GUNS[state.self.loadout.guns[side]].range * (state.ownStats?.rangeMul ?? 1);
  const tgt = touchTarget(range * 1.05, (l) => (l.x < 0) === (side === 'port') && Math.abs(l.x) > Math.abs(l.y) * 0.5);
  const p = tgt ?? padAimPoint(own.x, own.y, own.heading, side, range * 0.66, 0);
  aimAt(p.x, p.y);
  return true;
}

/** Chasers by touch: at a ship in the bow or stern arc, else dead ahead. */
function touchChasers(): void {
  const own = state.ownDisplay;
  if (!own) return;
  const tgt = touchTarget(GUNS.long_9.range, (l) => Math.abs(l.x) < Math.abs(l.y) * Math.tan(CHASER_CONE));
  if (tgt) aimAt(tgt.x, tgt.y);
  else aimAt(own.x + Math.sin(own.heading) * 400, own.y - Math.cos(own.heading) * 400);
  fireChasers();
}

/** The deck mount by touch: at the nearest ship in reach, else where the sea was last touched. */
function touchMount(): void {
  if (state.self?.dockedAt) return;
  const tgt = touchTarget(700, () => true);
  const m = tgt ?? mouseWorld();
  net.send({ t: 'mount', x: Math.round(m.x), y: Math.round(m.y) });
}

/** Aim the "cursor" at a world point: everything that aims by the mouse aims by the pad too. */
function aimAt(x: number, y: number): void {
  renderer.mouseX = renderer.sx(x);
  renderer.mouseY = renderer.sy(y);
}

function pollPad(dt: number): void {
  const gp = activePad();
  if (!gp) {
    padRudder = 0;
    return;
  }
  if (!padSeen) {
    padSeen = true;
    hud.toast(L('padReady'), 'info');
    // Steam Deck and other small screens: 125% interface, once.
    if (innerWidth <= 1280 && innerHeight <= 800 && settings().uiScale === 1) update({ uiScale: 1.25 });
  }
  const snap = { buttons: gp.buttons.map((b) => ({ pressed: b.pressed, value: b.value })), axes: [...gp.axes] };
  const evs = pad.poll(snap, dt);
  const lx = dead(snap.axes[0] ?? 0), ly = dead(snap.axes[1] ?? 0), rx = dead(snap.axes[2] ?? 0), ry = dead(snap.axes[3] ?? 0);
  if (modal) {
    padRudder = 0;
    padMenus(evs, lx, ly, ry, dt);
    return;
  }
  $('pad-cursor').classList.add('hidden');
  padCursor = null;
  const own = state.ownDisplay;
  // The helm: the stick, or the course held by L3.
  if (lx) padHoldHeading = null;
  if (padHoldHeading !== null && own) {
    const diff = Math.atan2(Math.sin(padHoldHeading - own.heading), Math.cos(padHoldHeading - own.heading));
    padRudder = clamp(diff * 3, -1, 1);
  } else padRudder = lx;
  if (radial) {
    const sx = rx || lx, sy = ry || ly;
    const sel = radialSector(sx, sy, radial.items.length);
    if (sel !== radial.sel) {
      radial.sel = sel;
      document.querySelectorAll<HTMLElement>('#radial .r-item').forEach((el) => el.classList.toggle('sel', Number(el.dataset.i) === sel));
    }
  }
  for (const e of evs) {
    if (e.k === 'chord') {
      // LB + RB: the ultimate (sail steps land on release, and a chord never makes one).
      useAbilityKey('V');
      continue;
    }
    if (e.k === 'hold') {
      if (e.b === BTN.LEFT || e.b === BTN.RIGHT) openRadial(ammoRadial(), e.b);
      else if (e.b === BTN.DOWN) openRadial(actionsRadial(), e.b);
      continue;
    }
    if (e.k === 'release') {
      if (radial && radial.opener === e.b) {
        closeRadial(true);
        continue;
      }
      if ((e.b === BTN.LT || e.b === BTN.RT) && padAim) {
        const side = e.b === BTN.LT ? 'port' : 'starboard';
        if (padAim.side === side) {
          fire(side);
          rumble(gp, side === 'port' ? 0.8 : 0.1, side === 'port' ? 0.1 : 0.8, 180);
          padAim = null;
        }
      } else if (e.b === BTN.LEFT && e.held < HOLD) cycleAmmo(-1);
      else if (e.b === BTN.RIGHT && e.held < HOLD) cycleAmmo(1);
      else if (e.b === BTN.DOWN && e.held < HOLD) openRadial(actionsRadial(), -1);
      else if (e.b === BTN.LB || e.b === BTN.RB) {
        // A sail step lands on release, so a chord never moves the sails.
        if (!pad.chord) state.input.sail = clamp(state.input.sail + (e.b === BTN.RB ? 1 : -1), 0, 4);
      }
      continue;
    }
    // Presses.
    if (radial && radial.opener === -1) {
      if (e.b === BTN.A) closeRadial(true);
      else if (e.b === BTN.B) closeRadial(false);
      continue;
    }
    switch (e.b) {
      case BTN.A:
        padContext();
        break;
      case BTN.X:
        useAbilityKey('Z');
        break;
      case BTN.Y:
        useAbilityKey('X');
        break;
      case BTN.B:
        useAbilityKey('C');
        break;
      case BTN.LT:
      case BTN.RT:
        padAim = { side: e.b === BTN.LT ? 'port' : 'starboard', range: padAim?.range ?? 320, lead: 0 };
        break;
      case BTN.UP:
        if (own) {
          // Chasers: along the keel, astern if the right stick points back.
          const back = ry > 0.5 ? -1 : 1;
          aimAt(own.x + Math.sin(own.heading) * 400 * back, own.y - Math.cos(own.heading) * 400 * back);
          fireChasers();
        }
        break;
      case BTN.VIEW:
        toggle('map');
        break;
      case BTN.MENU:
        openModal('options');
        break;
      case BTN.L3:
        padHoldHeading = padHoldHeading === null && own ? own.heading : null;
        hud.toast(L(padHoldHeading !== null ? 'holdCourse' : 'helmYours'), 'info');
        break;
      case BTN.R3:
        padTarget = lockTarget(rx, ry);
        break;
    }
  }
  // Aim: the right stick sets range (up = further) and lead; a locked ship draws the aim onto her.
  if (padAim && own) {
    padAim.range = clamp(padAim.range - ry * 450 * dt, 60, 900);
    padAim.lead = clamp(padAim.lead + rx * 250 * dt, -250, 250);
    const tgt = padTarget !== null ? state.ships.get(padTarget) : undefined;
    if (tgt) aimAt(tgt.cur.x, tgt.cur.y);
    else {
      const p = padAimPoint(own.x, own.y, own.heading, padAim.side, padAim.range, padAim.lead);
      aimAt(p.x, p.y);
    }
    renderer.look = { x: 0, y: 0 };
  } else renderer.look = { x: rx * 350, y: ry * 350 };
}

/** The nearest ship toward the right stick (or simply the nearest) within 1.5 km. */
function lockTarget(rx: number, ry: number): number | null {
  const own = state.ownDisplay;
  if (!own) return null;
  let best: number | null = null, score = Infinity;
  const aim = Math.hypot(rx, ry) > 0.3 ? Math.atan2(rx, -ry) : null;
  for (const s of state.ships.values()) {
    if (s.id === state.entityId) continue;
    const d = dist(s.cur.x, s.cur.y, own.x, own.y);
    if (d > 1500) continue;
    const off = aim === null ? 0 : Math.abs(Math.atan2(Math.sin(Math.atan2(s.cur.x - own.x, -(s.cur.y - own.y)) - aim), Math.cos(Math.atan2(s.cur.x - own.x, -(s.cur.y - own.y)) - aim)));
    const sc = d * (1 + off * 2);
    if (sc < score) {
      score = sc;
      best = s.id;
    }
  }
  if (best !== null) hud.toast(L('target', { name: state.ships.get(best)?.info?.name ?? L('aShip') }), 'info');
  return best;
}

/** Menus by pad: a virtual cursor that slows over buttons, A clicks, B backs out, LB/RB tabs, the right stick scrolls. */
function padMenus(evs: PadEvent[], lx: number, ly: number, ry: number, dt: number): void {
  const cur = (padCursor ??= { x: innerWidth / 2, y: innerHeight / 2 });
  const under = document.elementFromPoint(cur.x, cur.y) as HTMLElement | null;
  const sticky = under?.closest('button, a, input, select, .captain-card, [data-tab], [data-id]') ? 0.45 : 1;
  cur.x = clamp(cur.x + lx * 900 * dt * sticky, 0, innerWidth - 1);
  cur.y = clamp(cur.y + ly * 900 * dt * sticky, 0, innerHeight - 1);
  const el = $('pad-cursor');
  el.classList.remove('hidden');
  el.style.left = `${cur.x}px`;
  el.style.top = `${cur.y}px`;
  if (ry) $('modal-panel').querySelector('.modal-body')?.scrollBy(0, ry * 900 * dt);
  for (const e of evs) {
    if (e.k !== 'press') continue;
    if (e.b === BTN.A) {
      const target = (document.elementFromPoint(cur.x, cur.y) as HTMLElement | null)?.closest<HTMLElement>('button, a, input, select, .captain-card, [data-tab], [data-id], td, .card') ?? null;
      if (target instanceof HTMLInputElement && target.type === 'checkbox') target.click();
      else if (target) target.click();
    } else if (e.b === BTN.B || e.b === BTN.MENU) {
      if (modal !== 'boarding' && modal !== 'sunk') closeModal();
    } else if (e.b === BTN.VIEW && modal === 'map') closeModal();
    else if (e.b === BTN.LB || e.b === BTN.RB) {
      const tabs = [...$('modal-panel').querySelectorAll<HTMLElement>('.tab, [data-tab]')];
      const i = tabs.findIndex((x) => x.classList.contains('active'));
      const next = tabs[(i + (e.b === BTN.RB ? 1 : -1) + tabs.length) % tabs.length];
      next?.click();
    }
  }
}

addEventListener('gamepadconnected', () => {
  padSeen = false;
});

// ------------------------------------------------------------------ docs/16 Batch H: the ship's voice, the first hints

let easeAt = 0;
let lastHeading: { h: number; t: number } | null = null;
const heardShips = new Set<number>();
let heardIslands = -1;
let heardSince = 0;
function easeSecond(t: number, own: ClientState['ownDisplay']): void {
  // The timbers on a hard turn (docs/16 #39), every frame.
  if (own && !state.self?.dockedAt) {
    if (lastHeading && t > lastHeading.t) {
      const rate = angleDiff(lastHeading.h, own.heading) / ((t - lastHeading.t) / 1000);
      const load = turnCreakLoad(rate, own.speed);
      if (load > 0) audio.turnCreak(load);
    }
    lastHeading = { h: own.heading, t };
  } else lastHeading = null;
  if (t - easeAt < 1000) return;
  easeAt = t;
  firstTips.offer(tipForState(state, !!markOf()));
  // The lookout's cry (docs/16 #39): a sail that comes into sight, an island seen for the first time. Not in the
  // first seconds at sea (everything is new then), nor for her own groupmates.
  if (!own || state.self?.dockedAt) {
    heardSince = t;
    return;
  }
  const settled = t - heardSince > 8000;
  let sail: { x: number } | null = null;
  for (const [id, sh] of state.ships) {
    if (heardShips.has(id) || id === state.entityId) continue;
    heardShips.add(id);
    if (settled && Math.hypot(sh.cur.x - own.x, sh.cur.y - own.y) > 900) sail = { x: sh.cur.x - own.x };
  }
  if (heardShips.size > 4000) heardShips.clear();
  if (sail) audio.lookoutCry('sail', sail.x / 1500);
  if (heardIslands >= 0 && state.discovered.size > heardIslands && settled) audio.lookoutCry('land');
  heardIslands = state.discovered.size;
}

// ------------------------------------------------------------------ main loop

let last = performance.now();
let frameErrors = 0;
function frame(t: number): void {
  // The next frame is booked first: one bad frame must never stop the game (it did — the sea froze after casting off).
  requestAnimationFrame(frame);
  try {
    step(t);
  } catch (e) {
    if (frameErrors++ < 5) console.error('[frame]', e);
  }
}

function step(t: number): void {
  const raw = Math.min(1, (t - last) / 1000); // the pad's holds run on the wall clock, not the capped frame step
  const dt = Math.min(0.1, raw);
  last = t;
  if (inGame) {
    pollPad(raw);
    sendInput(t);
    stepPendingDock();
    stepPendingMark();
    stepPendingFind();
    state.updateRemote();
    const own = state.updateOwn();
    // Touch has no hovering cursor: no aim arcs follow it (the broadside buttons aim themselves).
    const held = chargeHeld();
    if (held && touch.enabled) touchAim(held.side);
    aimSide = held ? held.side : touch.enabled ? null : sideUnderCursor();
    const prompt = computePrompt();
    renderer.render(state, own, dt, { side: aimSide, dist: aimDistance(), boardTarget, chaser: touch.enabled || held ? null : chaserEndUnderCursor(), charge: held, target: targetId });
    if (own) audio.listener = { x: own.x, y: own.y };
    audio.ambience(state.wind[1], state.weather, dt);
    if (own) {
      // The score follows the scene (docs/07 §10.4); the rigging creaks with the load; the bells keep the watch.
      const hostileNear = [...state.ships.values()].some((x) => x.cur.flags & SF.HOSTILE && dist(x.cur.x, x.cur.y, own.x, own.y) < 1200);
      audio.frame(dt, {
        docked: !!state.self?.dockedAt,
        combat: !!state.you?.combat,
        chased: hostileNear,
        weather: state.weather,
        region: state.region,
        anomaly: state.bosses.some((b) => dist(b.x, b.y, own.x, own.y) < 3000),
      }, state.wind[1], own.sail, Math.abs(shipHeel(own.heading, state.wind[0], state.wind[1], own.sail, SHIP_CLASSES[state.self!.loadout.classId].tier, state.you?.water ?? 0, 0)), timeOfDay(state.estServerTime()), !state.self?.dockedAt);
    }
    hud.castKey = touch.enabled ? '' : ` (${keyOfAction('land')})`; // a phone has its button, not a key
    hud.hauling = netHaul.active;
    hud.update(state, prompt);
    autosailPill.draw(state);
    drawSeaOrders($('hud-orders'), state, (m) => net.send(m), () => openHero('book'));
    easeSecond(t, own);
    firstTips.frame(t);
    targetId = resolveTarget();
    // The glass is turned on her mark at sea, not while her men fight on a deck.
    askGlass(state.boardTac ? null : targetId);
    hud.drawTarget(state, targetId);
    if (touch.enabled && state.self) {
      const cls = SHIP_CLASSES[state.self.loadout.classId];
      // The action bar over the guns has every button now (owner, 2026-10-02); the old single context buttons stay hidden.
      touch.setContext(null);
      touch.setContext(null, 'tc-context2');
      touch.frame(own?.heading ?? null, state.input.sail, cls.bowChasers + cls.sternChasers > 0, state.self.loadout.mount ?? null);
    }
    divePanel.render(state.dive);
    boardFight.render(state.boardFight);
    tactical.render(state.boardTac);
    filmMoments();
    encounterCard.frame();
    surrenderCard.frame(state);
    fishFight.frame();
    netHaul.frame();
    // The chart once a second; four times while a signal flag pulses on it (docs/16 #35).
    const tick = state.signals.length && liveSignals(state).length ? 250 : 1000;
    if (modal === 'map' && Math.floor(t / tick) !== Math.floor((t - dt * 1000) / tick)) worldMap.draw(state);
  }
}
requestAnimationFrame(frame);
setInterval(() => net.send({ t: 'ping', c: performance.now() }), 5000);

// Debug handle for the console.
(globalThis as unknown as { gravetide: unknown }).gravetide = { state, renderer, net, open: (m: Modal) => (m === 'company' ? openMenuItem('company') : m === 'base' ? openBase() : m === 'hero' ? openHero() : m === 'throne' ? openThrone() : m === 'shop' ? openShop() : openModal(m)), throne: (tab?: string) => openThrone(tab), shop: (topup?: boolean) => openShop(topup), hero: (tab?: 'hero' | 'path' | 'book' | 'port') => openHero(tab), prologue: () => playPrologue(() => {}), hud, onboarding, fight: boardFight, tactical, chart: worldMap, land: sendLand };
