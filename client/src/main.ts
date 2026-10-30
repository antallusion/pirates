// Client entry: login → captain selection → the ocean. Wires network, state, input, renderer and UI.

import { LB, menAskText } from './ui/berths.ts'; // forum 2026-10-30: «Причал»
import './compat.ts'; // first of all: the calls Safari 15 lacks (iOS 15 is the floor)
import { WayWindow, mountFallen, resRid } from './ui/waystation.ts'; // docs/35
import { setWayFog, wayName } from './render/waystations.ts'; // docs/35
import { fogFarLayer, underFog } from './render/fog.ts'; // the fog of war (owner, 2026-10-17)
import { WAY_SIZE, wayInReach } from '../../shared/src/world/waystations.ts'; // docs/35
import { BOARD_ARC_DEG, BOARD_GAP, BOARD_REL_SPEED, DOCK_SLOW, REACH_DOCK, REACH_MOOR, REACH_OBJ, REACH_HINT, REACH_SHORE, alongsideWhy, boardGap, gapTo, shoreGap } from '../../shared/src/data/reach.ts'; // owner, 2026-10-22
import type { Hull } from '../../shared/src/data/reach.ts';
import { GRAPPLE_REACH } from '../../shared/src/data/gunnery.ts';
import { dockGap } from '../../shared/src/world/dock.ts';
import { onScreen, ownHull, viewHull } from './reachview.ts';
import type { WayData } from '../../shared/src/wayproto.ts'; // docs/35
import { EN as I18_EN, RU as I18_RU } from './lang/ui/isles18.ts';
import { shipLevelOf } from '../../shared/src/data/shiplevel.ts';
import { liveSignals, plateGoal, signalToast } from './ui/social.ts';
import { noteHearsay, repairState } from './ui/dealings.ts';
import { renderHall } from './ui/hall.ts';
import { renderLook, resetLookDraft } from './ui/looks.ts';
import { ask, askHtml, tell } from './ui/confirm.ts';
import { BEASTS, beastOfClass } from '../../shared/src/data/beasts.ts';
import { FishFightPanel } from './ui/fishfight.ts';
import { NetHaulPanel } from './ui/nethaul.ts';
import { departHooks, departOrAsk } from './ui/depart.ts';
import { adviceFor, showAdvice } from './ui/buyadvice.ts';
import { RouteRun } from './ui/goalrun.ts';
import { mountSrcTip } from './ui/srctip.ts'; // «Где взять» (owner, 2026-10-30) // ux2 / route: the run to a goal's nearest place
import { EN as UX2_EN, RU as UX2_RU } from './lang/ui/ux2.ts';
import type { AutosailStop } from '../../shared/src/data/autosail.ts';
import { EncounterCard } from './ui/encounter.ts';
import { SurrenderCard } from './ui/surrender.ts';
import { CeasefireCard } from './ui/ceasefire.ts'; // owner, 2026-10-18: the ceasefire talks
import { HireCard, HireChip } from './ui/seahire.ts'; // owner, 2026-10-25: a ship of the sea hired as a guard
import { EN as HIRE_EN, RU as HIRE_RU } from './lang/ui/seahire.ts';
import { HIRE_ROLES } from '../../shared/src/data/seahire.ts';
import { EN as OUT_EN, RU as OUT_RU } from './lang/ui/outcome.ts';
import { BoardOfferCard } from './ui/boardoffer.ts'; // docs/25 item 64: a group mate's boarding within reach
import { LairChestCard } from './ui/lairchest.ts';
import { MinigameWindow } from './ui/minigame.ts';
import { TrekWindow } from './ui/trek.ts';
import { EN as ISLES_EN, RU as ISLES_RU } from './lang/ui/isles.ts';
import { EN as LAIRS_EN, RU as LAIRS_RU } from './lang/ui/lairs.ts'; // docs/18 II
import { DivePanel } from './ui/dive.ts';
import { giverDialog } from './ui/giver.ts';
import { inspectDialog } from './ui/inspect.ts';
import { BoardFightPanel } from './ui/boardfight.ts';
import { TacticalPanel } from './ui/tactical.ts';
import { CAPTAINS } from '../../shared/src/data/captains.ts';
import { AMMO, AMMO_IDS, CHASER_CONE, GUNS, KEYED_AMMO, MOUNTS, SHIP_CLASSES, isZoneBossClass } from '../../shared/src/data/ships.ts';
import { PORT_DOCK_RADIUS, isNight, nightFactor, timeOfDay } from '../../shared/src/constants.ts';
import { angleDiff, clamp, dist, pointInPolygon, toShipLocal } from '../../shared/src/math.ts';
import type { Aggression, SeaMarkData, ServerMsg, ShipInfo } from '../../shared/src/protocol.ts';
import { SF, STATIONS } from '../../shared/src/protocol.ts';
import { REGIONS } from '../../shared/src/world/regions.ts';
import { assetKinds, assetStats, assetUrl, ensureAssets, loadAssets } from './assets.ts';
import { beginLoad, loadLog } from './ui/loader.ts';
import { artStore, sceneWarm, startWarm } from './scenewarm.ts';
import { tacArtSplit } from './ui/tactical.ts';
import { CURSOR_ART } from './ui/cursor.ts';
import { tideVeil } from './ui/invasion.ts'; // docs/19 E16
import { AudioEngine, turnCreakLoad } from './audio.ts';
import { LP, PassagePill } from './ui/passage.ts';
import { LF } from './ui/ferry.ts'; // owner, 2026-10-30: «Переход» between hub ports
import { VOYAGE_MUL } from '../../shared/src/data/passage.ts';
import { AutosailPill, FirstTips, autosailRequest, autosailStopText, routeLabel, tipForMsg, tipForState } from './ui/ease.ts';
import { claimNear, claimSpot, tapTarget } from './ui/sailto.ts'; // seaux: sail-to on tap
import { toggleCaptainMenu } from './ui/capmenu.ts'; // seaux: the captain's menu on her portrait
import { actBarHtml, attackRelevant, WATCH_RAIDER, buildActs, findInfo, landKeyAct, markInfo, slowWord } from './ui/actbar.ts';
import { FIND_REACH, FIND_SLOW, findGap } from '../../shared/src/data/seafinds.ts';
import type { FindView } from '../../shared/src/findproto.ts';
import { ROAMS, ROAM_REACH, ROAM_SEE, roamHullGap } from '../../shared/src/data/roamers.ts'; // docs/19 D7
import { BOSSES } from '../../shared/src/data/bosses.ts';
import type { BossId } from '../../shared/src/data/bosses.ts';
import { isShoreBoss } from '../../shared/src/data/shorebosses.ts'; // the great ones ashore (2026-10-03)
import type { RoamView } from '../../shared/src/roamproto.ts';
import { UNITS as ROAM_UNITS } from '../../shared/src/data/army.ts';
import { backClock, roamBackLeft, roamName, roamNow } from './render/roamers.ts';
import { openRoamCard } from './ui/roamcard.ts';
import { armyEditing, strengthWord as roamWord } from './ui/army.ts';
import { EN as ROAM_EN, RU as ROAM_RU } from './lang/ui/roamers.ts';
import { EN as REACH_EN, RU as REACH_RU } from './lang/ui/reach.ts';
import type { Act, ActFacts } from './ui/actbar.ts';
import { riskConfirm } from './ui/kit/risk.ts';
import { wireSheetSwipe } from './ui/kit/sheet.ts';
import { holdRedraw, installTapGuard, rescueTaps } from './ui/kit/taps.ts'; // ux2: taps never lost to a redraw
import { wireHints } from './ui/kit/hint.ts';
import { DASH_COOLDOWN, LAY_ARC_DEG, closeRange, suggestAmmo } from '../../shared/src/data/gunnery.ts';
import { EN as SEAF_EN, RU as SEAF_RU } from './lang/ui/seafight.ts';
import { EN as SH_EN, RU as SH_RU } from './lang/ui/seahud.ts';
import type { BoardRisk } from '../../shared/src/protocol.ts';
import { MARK_SLOW, markInReach } from '../../shared/src/data/seamarks.ts';
import { EN as EASE_EN, RU as EASE_RU } from './lang/ui/ease.ts';
import { EN as ROUTE_EN, RU as ROUTE_RU } from './lang/ui/route.ts';
import { objective, setTracked, setWaypoint as setMark, trackedId, trackedQuest, waypoint as markOf } from './ui/track.ts';
import { Net } from './net.ts';
import { Renderer, shipHeel } from './render/renderer.ts';
import { ClientState } from './state.ts';
import { captainBalance, captainShopHeard, showCaptainSelect } from './ui/captain.ts';
import { renderBoarding, renderHelp, renderShip, renderSunk } from './ui/dialogs.ts';
import { renderCrew, renderMutiny } from './ui/crew.ts';
import { CompanyScreen, renderBarter } from './ui/company.ts';
import type { CompanyTab } from './ui/company.ts';
import { LOG_PAGES } from './ui/logbook.ts';
import { InviteQueue } from './ui/invitequeue.ts';
import { BaseWindow } from './ui/base.ts';
import { boostReport, jobEnds } from './ui/isleboost.ts'; // «Ускорить»: what is left (owner, 2026-10-29)
import { IsleScene } from './ui/islescene.ts'; // the island screen (owner, 2026-10-15)
import { EN as LIS_EN, RU as LIS_RU } from './lang/ui/islescene.ts';
import { buttonHtml } from './ui/kit/button.ts';
import { ZOOM_NEAR_MIN, clampZoom } from './render/freecam.ts'; // the far view and the free look (owner, 2026-10-17)
import { EN as FC_EN, RU as FC_RU } from './lang/ui/freecam.ts';
import { askMove } from './ui/isletree.ts'; // docs/29: the island's move, its confirm
import { $, decorateSums, esc, fmt, glyphSvg, icon, keepInputs, knots } from './ui/dom.ts';
import { Hud, TOUCH_FOLDED, releaseModalToasts } from './ui/hud.ts';
import { SeaHud, bestSpecial, pettyOf, seaWord } from './ui/seahud.ts'; // docs/23 phase 2: the sea and five buttons
import { adriftFacts, adriftInfo, askScuttle, juryTapText } from './ui/adrift.ts'; // owner 2026-10-20: torn sails, the jury rig, scuttling home
import type { DeckSlot, SeaKeys } from './ui/seahud.ts';
import { HudMore } from './ui/hudmore.ts'; // owner, 2026-10-29: the rest of the round buttons behind one «⋯»
import { SKILL_IDS, SeaAbil, abilWhy, skillWord } from './ui/seaabil.ts'; // the captain's abilities on a phone: «Приёмы» and its row (owner, 2026-10-26)
import type { AbilView } from './ui/seaabil.ts';
import { goalCount, goalSheetView } from './ui/goalsheet.ts'; // «Цели и вести»: the campaign, the quests taken, the orders
import { attackKind, buildCursors, cursorUrl } from './ui/cursor.ts'; // the attack cursor (owner, 2026-10-07)
import type { AttackKind } from './ui/cursor.ts';
import { TargetMenu } from './ui/targetmenu.ts'; // «Захват цели», «Преследовать», «Бой» beside a target
import type { TmChoice, TmId, TmRect } from './ui/targetmenu.ts';
import type { TargetInfo } from './ui/kit/targetline.ts';
import type { WheelOption } from './ui/kit/radial.ts';
import { WHEEL_MAX } from './ui/kit/radial.ts';
import { threatTo } from './ui/levels.ts';
import { wheel } from './ui/kit/radial.ts'; // docs/23 phase 1: the pad's wheel is the kit's
import { MENU_ITEMS, menuLabel, renderMenu } from './ui/menu.ts';
import type { MenuItem } from './ui/menu.ts';
import { applySkin } from './ui/skin.ts';
import { rudderToward, TouchControls } from './touch.ts';
import { PortScreen } from './ui/port.ts';
import { TalentScreen } from './ui/talents.ts';
import { HeroWindow, closeLevelUp, drawSeaOrders, levelUpOpen, levelUpSheet } from './ui/hero.ts';
import type { CaptainOpen } from './ui/hero.ts';
import { activeTalents } from '../../shared/src/data/talents.ts';
import { WorldMap } from './ui/worldmap.ts';
import { Journal, distWords } from './ui/journal.ts';
import { renderChoice, renderTattoos } from './ui/tattoos.ts';
import { renderDice, tickDice } from './ui/dice.ts';
import { OnboardingUi, playPrologue, renderEdge } from './ui/onboarding.ts';
import { TutorPointer, shotStage } from './ui/pointer.ts';
import { keyActsInWindow, leftClickSea, rightClickAct, seaTapPlan, seaTapWhy, soloModifier, wheelZoom, windowTab } from './ui/deskinput.ts';
import { resumeAfterEnd, resumeOn } from './ui/resumesail.ts';
import { hereAct } from './ui/questact.ts'; // owner, 2026-10-23: a quest step done in this port
import { buzz, guardVibrate } from './haptics.ts';
import { cue, setCuePlayer } from './sfx.ts'; // the sound pass (owner, 2026-10-16): the cues the UI asks for
import { filmDue, loadFilms, playFilm, setFilmGate } from './ui/cutscene.ts';
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
import { campaignWordsReady, loadCampaignWords, serverText } from './lang/server.ts';
import { GOODS } from '../../shared/src/data/goods.ts'; // the opening's good to trade
import { STORY_FROM, campaignLore, campaignNews, chapterOpener, dropWord } from './ui/campaignnews.ts';
import { DROP_CARD } from '../../shared/src/data/paintart.ts'; // docs/36: the campaign's next quest comes by itself
import { FACTIONS } from '../../shared/src/data/factions.ts';
import { placeName } from './ui/maps.ts';
import { initPortCard, openPortCard, portCardData } from './ui/portcard.ts'; // the port card (owner, 2026-10-30)
import { portSplash } from './ui/portsplash.ts';
import type { Key } from './i18n.ts';
import { EN as MAIN_EN, RU as MAIN_RU } from './lang/ui/main.ts';
import { renderDescent } from './ui/descent.ts';
import { renderSaga } from './ui/saga.ts';
import { renderAway } from './ui/renown.ts';
import { RecruitWindow } from './ui/recruit.ts';
import { TameWindow } from './ui/tame.ts'; // docs/18 IV
import { ThroneWindow } from './ui/throne.ts'; // docs/19 E1–E3, E18
import { PremiumWindow } from './ui/premium.ts'; // the premium shop (owner, 2026-10-03)
import { mountQuickEmotes, ownEmotes } from './ui/cosmetics.ts'; // docs/32 §12: the cosmetics
import { heardDoubloons, stashPending } from './ui/price.ts'; // a purchase waiting for its top-up (owner, 2026-10-18)
import { Promos } from './ui/promo.ts'; // her personal offers (owner, 2026-10-15)
import { DailyGift } from './ui/dailygift.ts'; // the daily login gift (owner, 2026-10-16)
import { initTgNotices } from './ui/tgnotices.ts'; // «Уведомления в Телеграме» (owner, 2026-10-16)
import { webCheckouts } from './checkout.ts';
import { vkIdLoginButton, vkIdReturn } from './vkid.ts'; // «Войти через VK ID» on the website (docs/36 §8)
import { tgInvoices, tgLoginButton, tgStart } from './tg.ts'; // Telegram: the Mini App, «Войти через Телеграм», Stars (docs/27)
import { inVk, mayFullscreen, vkStart } from './vk.ts';
import { gateFrames, mediaSleeps, onLifecycle, pauseApp, resumeApp, soundSleeps } from './lifecycle.ts'; // the game asleep out of sight (docs/36) // the VK Mini App: its sign-in, no fullscreen of the game's own (docs/36)
import { ResearchWindow } from './ui/research.ts'; // the yard's tree of hulls (owner, 2026-10-04; docs/20)
import { AdvCard } from './ui/advcard.ts'; // docs/17 H4
import { PuzzleWindow } from './ui/puzzle.ts';
import { crewSayParts, renderLog } from './ui/crewlife.ts';
import { flagLine, flagsCss, lawlessHere, lawlessWords, shipColours } from './ui/flags.ts'; // docs/24 C1, D1–D3
import { EN as FLAGS_EN, RU as FLAGS_RU } from './lang/ui/flags.ts';
import { citiesHostile } from '../../shared/src/data/colours.ts';
import { bootMark, settleViewport, watchViewport } from './viewport.ts'; // a start that always goes on (owner, 2026-10-16)
import { startTelemetry, telemetryBoot } from './telemetry.ts'; // real-device telemetry (docs/33)
import './ui/artaim.ts'; // every banner painting framed on its subject (owner, 2026-10-28)

const L = dict(MAIN_EN, MAIN_RU);
/** The captain last aboard on this device (docs/23 item 88: «Продолжить: …» on the title screen). */
const CAPTAIN_KEY = 'gravetide.captain';
/** A name or sentence that came from the server, in the player's language. */
const sv = (s: string): string => (lang() === 'ru' ? NAME_RU.get(s) ?? serverText(s) : s);

type Modal = 'port' | 'way' | 'talents' | 'map' | 'journal' | 'ship' | 'gear' | 'help' | 'boarding' | 'sunk' | 'crew' | 'mutiny' | 'company' | 'barter' | 'edge' | 'options' | 'menu' | 'tattoos' | 'choice' | 'dice' | 'look' | 'hall' | 'descent' | 'saga' | 'log' | 'base' | 'away' | 'recruit' | 'hero' | 'puzzle' | 'tame' | 'throne' | 'shop' | 'research' | null;

bootMark('main');
watchViewport();
const net = new Net();
const state = new ClientState();
// The waystations under the fog of war are drawn nowhere (the sea, the minimap, the chart, their tooltip).
setWayFog((x, y) => underFog(state.seen, x, y));
const renderer = new Renderer($('world') as HTMLCanvasElement);
renderer.farLayers.push(fogFarLayer(state, () => settings().reduceMotion)); // the fog of war on the far view's chart
const hud = new Hud();
const audio = new AudioEngine();
renderer.onLightning = () => audio.thunder();
for (const ev of ['keydown', 'mousedown', 'touchstart'] as const) addEventListener(ev, () => audio.unlock(), { passive: true });
// The sound pass (owner, 2026-10-16): the UI's cues through the engine; a button's tick; the sound asleep while the page is
// hidden (another tab, the phone locked, the Mini App sent to Telegram's background) and awake on its return.
setCuePlayer((k, d) => audio.cue(k, d));
addEventListener('click', (e) => {
  const b = (e.target as Element | null)?.closest?.('button, .btn, [role="button"], [role="switch"], .w-chip');
  if (b && !(b as HTMLButtonElement).disabled && !b.closest('#world')) cue('click');
}, { capture: true, passive: true });
// Out of sight the whole game sleeps (owner, 2026-10-20 — VK moderation: «если свернуть игру, звук продолжает играть»;
// lifecycle.ts, docs/36): the sound's context suspended, the films and any <audio>/<video> paused, every animation frame
// held, the helm let go with one neutral input — on every platform when the page is hidden or put away; inside VK also
// on VKWebAppViewHide and the window's blur (vk.ts). Awake again as it comes back.
gateFrames(globalThis as unknown as Parameters<typeof gateFrames>[0]);
onLifecycle(soundSleeps(audio));
onLifecycle(mediaSleeps(document));
onLifecycle({
  pause: () => {
    keys.clear();
    touch.course = null;
    state.input.rudder = 0;
    if (inGame && !state.syncSail) net.send({ t: 'input', seq: ++state.input.seq, rudder: 0, sail: state.input.sail });
  },
  resume: () => {
    last = performance.now();
    // a boarding's spoils that waited while she was away: their card again (QA 2026-10-22, boardingCardFrame)
    if (inGame) net.send({ t: 'board_result' });
  },
});
document.addEventListener('visibilitychange', () => (document.hidden ? pauseApp('hidden') : resumeApp('hidden')));
addEventListener('pagehide', () => pauseApp('pagehide'));
addEventListener('pageshow', () => resumeApp('pagehide'));
{
  const hook = (): boolean => {
    const w = (globalThis as { Telegram?: { WebApp?: { onEvent?: (e: string, f: () => void) => void } } }).Telegram?.WebApp;
    if (!w?.onEvent) return false;
    w.onEvent('deactivated', () => audio.setHidden(true));
    w.onEvent('activated', () => audio.setHidden(document.hidden));
    return true;
  };
  if (!hook()) {
    let n = 0;
    const id = setInterval(() => {
      if (hook() || ++n > 30) clearInterval(id);
    }, 1000);
  }
}
const worldMap = new WorldMap();
const journal = new Journal((m) => net.send(m));
// (No film at a window: owner, 2026-10-05 — films only at the sea's own moments, filmMoments.)
journal.openTattoos = () => openModal('tattoos');
journal.openSaga = () => openModal('saga');
journal.openLog = () => openModal('log');
journal.onBook = () => refreshModal(); // docs/36: the journal's «Кампания» page
// docs/23 item 74: «Журнал» — the quests are the journal's page, the company, guild, letters and album the company's.
journal.onTab = (t) => {
  companyScreen.open(LOG_PAGES[t][0] as CompanyTab);
  openModal('company');
};
worldMap.send = (m) => net.send(m);
worldMap.onAutosail = (wp) => autosailTo(wp);
// The port card (owner, 2026-10-30): a port's crest on the chart, its name at sea — what it sells and buys, its
// services; «Плыть сюда» is the run there that puts her in on arrival (the chart shuts onto the course).
worldMap.onPortCard = (id) => openPortCard(state, id);
initPortCard({
  send: (m) => net.send(m),
  sail: (id) => {
    if (modal === 'map') closeModal();
    startGoal(`p:${id}`);
  },
  openPort: () => {
    if (modal === 'map') closeModal();
    openModal('port');
  },
});
/** A course of her own to a point (the chart's, a tap's or a click's): `near`, how near the helmsman brings her. */
function autosailTo(wp: { x: number; y: number }, near?: number): void {
  touch.course = null; // the helm stick lets go, or it would take the wheel straight back
  goalRun = null; // a course of her own: the run to a quest's place lets go
  resumeKey = resumeAfterEnd(resumeKey, 'own');
  net.send({ ...autosailRequest(state, wp), ...(near !== undefined ? { near } : {}) });
  closeModal();
}
// ux2: «Плыть» on a quest of the journal or the chart — the course to its place and on through its steps.
journal.onSail = (key) => startGoal(key);
journal.onPortTab = (tab) => { if (!state.portView) return; portScreen.showTab(tab, null, state); openModal('port'); }; // owner, 2026-10-23: a quest step's shop or table
worldMap.onGoal = (key) => startGoal(key);
// The fog of war's scouts (owner, 2026-10-17): «Выбрать на карте» on the shipyard's card opens the chart to take a tap
// on the fog; the tap sends her and the chart closes back onto the island.
worldMap.onScoutSend = (id, x, y) => {
  net.send({ t: 'scout', action: 'send', id, x: Math.round(x), y: Math.round(y) });
  worldMap.scoutPick = null;
  // (a beat later: the tap's own click must not land on the island under the chart and shut the ships' sheet)
  setTimeout(() => {
    if (modal === 'map') closeModal();
    if (isleScene.isOpen) isleScene.openYard();
  }, 220);
};
// docs/16 #36: the helmsman takes her to her mark; the pill at the top of the stack stops him.
const EL = dict(EASE_EN, EASE_RU);
const LSF = dict(SEAF_EN, SEAF_RU); // the quick sea fight (docs/23 phases 3–4)
const LSH = dict(SH_EN, SH_RU); // the sea HUD's «⋯» tray: «Армия»
const autosailPill = new AutosailPill();
const passagePill = new PassagePill(); // owner, 2026-10-28: «дальний переход» — the tiny timer by the chart
passagePill.onHint = (msg) => hud.toast(msg, 'voyage');
autosailPill.onStop = () => {
  goalRun = null; // the pill's stop ends the run to a quest's place too
  resumeKey = resumeAfterEnd(resumeKey, 'own');
  net.send({ t: 'autosail', stop: true });
};
// docs/16 #37: a line the first time she meets each of the sea's mechanics.
const firstTips = new FirstTips();
firstTips.covered = () => modal !== null;
let modal: Modal = null;
let inGame = false;
let lastSunk: { lost: { cargoValue: number; crew: number; repairFee: number }; port: string; towed: boolean; scuttled?: boolean; boarded?: { by: string; silver: number; repelled: boolean } } | null = null;
/** The prologue plays once, for a captain who has just taken the First Watch. */
let prologuePending = false;
const keys = new Set<string>();
/** The signs on the horizon the lookout has already called. */
const seenSights = new Set<number>();
let lastInputSent = 0;
let lastInputKey = '';
let boardTarget: number | null = null;
/** Why no ship in the grapples' reach may be boarded: boarding off on hers or yours (docs/24 C1). */
let noBoardWhy: string | null = null;
/** Her mark close by but not yet alongside (owner, 2026-10-22): what is left — the water between the hulls, her beam,
 *  her way — for the bar's muted line. */
let boardNear: { name: string; why: 'far' | 'abeam' | 'speed'; gap: number } | null = null;

/** Whether the grapples would fly between her and ship `id` now (reach.ts alongsideWhy, as the server reckons it):
 *  null — alongside; else why not and the water between the hulls. Undefined hulls: not alongside. */
function boardWhy(id: number): { why: 'far' | 'abeam' | 'speed'; gap: number } | null {
  const s = state.ships.get(id), me = ownHull(state), st = state.ownStats, own = state.ownDisplay;
  const her = s ? viewHull(s) : null;
  if (!s || !me || !her || !st || !own) return { why: 'far', gap: Infinity };
  const gap = boardGap(me, her);
  const base = (34 + st.length * 0.5) * GRAPPLE_REACH;
  // (a captain's own way matched within half again the lines' hold — boarding.ts boardGeomWhy)
  const why = alongsideWhy(me, own.speed, her, s.cur.spd, { gapMul: Math.max(1, Math.min(2.5, st.boardingRange / base)), arcDeg: BOARD_ARC_DEG, anySpeed: !!(s.cur.flags & SF.SURRENDERED), relMax: BOARD_REL_SPEED * 1.5 });
  return why ? { why, gap } : null;
}

/** The island a harbour stands on (its quays: dock.ts), as her chart has it. */
let portIsles = new Map<string, { x: number; y: number; r: number; poly: ArrayLike<number> }>();
let portIslesN = -1;
function portIsle(p: { id: string }): { x: number; y: number; r: number; poly: ArrayLike<number> } | null {
  if (portIslesN !== state.islands.size) {
    portIsles = new Map();
    for (const is of state.islands.values()) if (is.portId || is.town) portIsles.set((is.portId ?? is.town)!, is);
    portIslesN = state.islands.size;
  }
  return portIsles.get(p.id) ?? null;
}

/** «Причалить: ещё 12 м» — a thing close by, not yet within reach (owner, 2026-10-22). */
function nearWords(what: string, m: number): string {
  return LR8('near', { what, m: Math.max(1, Math.round(m)) });
}

/** Whether a point (and `r` metres about it) is on her screen and out of her fog (owner, 2026-10-22: no buttons for what
 *  she cannot see). */
function seenOnScreen(x: number, y: number, r = 0): boolean {
  return onScreen(renderer, state.seen, x, y, r);
}
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
  state.roamMark = null;
}

/** docs/19 D7: the creature stack under a point on screen (its token, or a finger's width around it). */
function roamAtScreen(px: number, py: number): number | null {
  if (state.self?.dockedAt) return null;
  const reach = Math.max(30, Math.max(11, Math.min(22, 19 * renderer.zoom)) * 1.7);
  let best: number | null = null, bd = reach;
  for (const v of state.roams) {
    const p = roamNow(state, v);
    const d = Math.hypot(renderer.sx(p.x) - px, renderer.sy(p.y) - py);
    if (d <= bd) [best, bd] = [v.id, d];
  }
  return best;
}

/** When a finger last marked a ship or a stack (the page's clock). */
let markTapAt = -1e9;
/** A tap or a click on the sea marks what lies under it: a ship (the target frame's), else a creature stack — whose
 *  «Атаковать» then leads the action button (owner, 2026-10-07: a stack could not be marked; the button attacked the
 *  nearest ship instead, and a click on the stack fired a broadside into it). */
function markAt(px: number, py: number): 'ship' | 'roam' | null {
  const ship = shipAtScreen(px, py);
  if (ship !== null) {
    pinTarget(ship);
    return 'ship';
  }
  const rm = roamAtScreen(px, py);
  if (rm === null) return null;
  state.roamMark = rm;
  targetPinned = false;
  return 'roam';
}

/** Owner, 2026-10-26 («на пк версии выбрав порт или корабль не дает дополнительного экшена, типа плыть или атаковать»):
 *  the thing she selected by a click or a tap — a harbour, an island, a ship, her wreckage — and its buttons on the bar
 *  wherever it lies (actbar.ts `sel`). Cleared by a click on the open sea, or once she is in port. */
let selPlace: { kind: 'port' | 'isle' | 'wreck' | 'ship'; id: string | number } | null = null;
/** The harbour, the island or the wreckage under a point on screen (ships and stacks are markAt's). */
function placeAtScreen(px: number, py: number): { kind: 'port' | 'isle' | 'wreck'; id: string | number } | null {
  const m = renderer.toWorld(px, py);
  const slack = 34 / Math.max(0.05, renderer.zoom);
  for (const w of state.wrecks) if (Math.hypot(w.x - m.x, w.y - m.y) <= Math.max(30, slack)) return { kind: 'wreck', id: w.id };
  let bp: (typeof state.ports)[number] | null = null, bd = Infinity;
  for (const pt of state.ports) {
    const d = Math.hypot(pt.x - m.x, pt.y - m.y);
    if (d < Math.max(160, slack * 1.5) && d < bd) [bp, bd] = [pt, d];
  }
  if (bp) return { kind: 'port', id: bp.id };
  for (const is of state.islands.values()) {
    if (is.minor || Math.hypot(is.x - m.x, is.y - m.y) > is.r + slack) continue;
    if (is.portId) return { kind: 'port', id: is.portId };
    return { kind: 'isle', id: is.id };
  }
  return null;
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
  // (owner, 2026-10-22: the glass only on a ship she sees on her screen)
  if (!seenOnScreen(s.cur.x, s.cur.y, 20)) return;
  if (id === glassId && now - glassAt < 4000) return;
  glassId = id;
  glassAt = now;
  net.send({ t: 'appraise', id, quiet: true }); // (its «too far for the glass» every four seconds is no news)
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
  // No mark by itself (owner, 2026-10-29: «если я никого не атакую не показывай мне наверху плашки акула там или еще
  // что-то. только если я атакую кого-то и взял в фокус. автофокусов быть не должно»): her mark is the ship she tapped,
  // took with «Цель», chose in its menu or the helmsman closes with on her «Огонь» (pursuit) — never the nearest foe, an
  // aggressor or a quest's ship. A shot at her is a toast and the fight's buttons, not a mark. The one exception is the
  // First Watch's own lesson «Атакуйте»: its raider is the lesson's mark (its finger on «Атаковать»).
  if (state.onboarding?.stage === 'attack') {
    for (const s of state.ships.values()) {
      if (s.info?.name === WATCH_RAIDER && s.cur.flags & SF.HOSTILE && alive(s.id)) return s.id;
    }
  }
  return null;
}

const portScreen = new PortScreen((m) => net.send(m), () => closeModal());
portScreen.openTattoos = journal.openTattoos;
const talentScreen = new TalentScreen((m) => net.send(m));
// The captain as a hero (docs/17 H2): primaries, skills, the order book, a port's guild and artifact merchant.
const heroWindow = new HeroWindow((m) => net.send(m));
heroWindow.onClose = () => closeModal();
function openHero(tab?: CaptainOpen): void {
  heroWindow.open(tab);
  openModal('hero');
}
const companyScreen = new CompanyScreen((m) => net.send(m));
// One's own island as a base (docs/15): from the Company's islands, the captain's cabin, and at sea off the island.
const baseWindow = new BaseWindow((m) => net.send(m));
baseWindow.onScoutPick = (id) => {
  worldMap.scoutPick = id;
  openModal('map');
};
/** The island screen: a scene of its own over the whole screen, the sea stopped under it (ui/islescene.ts). */
const isleScene = new IsleScene((m) => net.send(m), baseWindow);
const LIS = dict(LIS_EN, LIS_RU);
const LFC = dict(FC_EN, FC_RU); // freecam: «К кораблю»
let isleKey = '';
// The recruit window of the Heroes (docs/17 H3): from a port's tavern and from the island's town.
const recruitWindow = new RecruitWindow((m) => net.send(m));
let recruitFrom: 'port' | 'isle' | 'lair' | 'way' = 'port';
function openRecruit(src: 'port' | 'isle' | 'lair' | 'way'): void {
  recruitFrom = src;
  recruitWindow.open(src);
  openModal('recruit');
}
portScreen.openDwell = () => openRecruit('port');
// docs/35: the floating waystation's window (moored), the port's surgeon — one window over her fallen.
const wayWindow = new WayWindow({
  send: (m) => net.send(m),
  close: () => closeModal(),
  hire: () => openRecruit('way'),
  shop: () => openShop(false, SHOP_AT.scrolls),
  instant: () => net.send({ t: 'premium', action: 'shop', offer: 'refill', pid: resRid() }),
});
portScreen.openSurgeon = () => {
  net.send({ t: 'way', action: 'view' });
  openModal('way');
};
portScreen.openIsle = () => openBase();
portScreen.onGoal = (key) => startGoal(key); // «Плыть» on a card of the port's «Задания» (owner, 2026-10-16)
// The adventure map (docs/17 H4): the visit card over the sea, and the Grail's chart.
const advCard = new AdvCard((m) => net.send(m));
advCard.now = () => state.estServerTime(); // the drift's mini-game needle (docs/18 #35)
// The creatures' window (docs/18 IV): from the crew's army card, a port's tamer, the battle's reckoning.
const tameWindow = new TameWindow((m) => net.send(m));
function openTame(): void {
  tameWindow.open();
  openModal('tame');
}
// The Throne of the Sea (docs/19 E18): from the captain's plate, the cabin, the captain's window.
const throneWindow = new ThroneWindow((m) => net.send(m));
throneWindow.onClose = () => closeModal();
function openThrone(tab?: string): void {
  throneWindow.open(tab);
  openModal('throne');
}
heroWindow.onThrone = () => openThrone();
heroWindow.onTalents = () => openModal('talents');
heroWindow.onWardrobe = () => openWardrobe(); // docs/32 §12
// docs/23 item 70: the level's «pick one of two» comes up by itself when a level comes — not over a window, a fight
// or a battle (it waits for them to end); levels that waited before she came aboard stay in the Hero tab.
/** The far seas' news on a novice's screen: her own sea's always, the rest once in WORLD_FEED_GAP ms (docs/30). */
const WORLD_FEED_LEVEL = 15, WORLD_FEED_GAP = 180_000;
let worldFeedAt = -Infinity;
function worldFeedShown(msg: string, region: string | null | undefined, level: number, now: number): boolean {
  const name = region ? REGIONS[region as keyof typeof REGIONS]?.name : undefined;
  if (name && msg.includes(name)) return true;
  if (level >= WORLD_FEED_LEVEL) return true;
  if (now - worldFeedAt < WORLD_FEED_GAP) return false;
  worldFeedAt = now;
  return true;
}
let heroSeen = -1;
/** The helmsman has her on a run (a goal, «Атаковать», a stack's attack): a card that would cover the bar waits. */
function underWay(): boolean {
  return !!state.autosail || !!state.pursuit || state.roamRun !== null || (!!goalRun && !state.self?.dockedAt && (state.ownDisplay?.speed ?? 0) > 1);
}
/** A hostile sail or beast within 1.5 km, or a chase on: the level's card waits (docs/30: it came up over the helm and
 *  «Огонь» with four sharks round her). */
function hostileNear(): boolean {
  const o = state.ownDisplay;
  if (!o || state.self?.dockedAt) return false;
  if (state.pursuit) return true;
  for (const x of state.ships.values()) if (x.id !== state.entityId && x.cur && x.cur.flags & 64 && Math.hypot(x.cur.x - o.x, x.cur.y - o.y) < 1500) return true;
  return false;
}
setInterval(() => {
  const h = state.self?.hero;
  if (!h || !inGame) return;
  // docs/31: a level's primary to choose (every skill at expert) waits as a skill's choice does.
  const waiting = h.pending + (h.focus?.pending ?? 0);
  if (heroSeen < 0 || waiting < heroSeen) heroSeen = waiting;
  // Not in the First Watch either: at its last step «Новый уровень» covered «В порт», the step's finger stepped aside and
  // the pupil stood (e2e, docs/23 item 90); the choice waits for the watch's end.
  // Nor while the helmsman sails her to a thing to do (the opening's tender 90 m off, «Атаковать» under the card — the
  // newcomer's run of 2026-10-23): it comes when she lies still, after the fight.
  if (waiting > heroSeen && (h.offer.length || h.focus) && !modal && !state.boardTac && !state.boardFight && !state.onboarding?.stage && !document.body.classList.contains('sea-target') && !levelUpOpen() && !hostileNear() && !underWay()) {
    heroSeen = waiting;
    levelUpSheet(state, (m) => net.send(m));
  }
}, 600);
// The bottom's line of words on a touch screen («Под защитой — выстрел её снимет», the carpenters' pace) keeps clear of
// the round buttons and the row of actions (2026-10-16: at 480×270 it lay under the row): from its own place it steps up
// (and aside) to the first free spot of the bottom band. Four times a second, moved by \`translate\` only.
// (the row's own buttons, not its box: with every thing to do in sight it wraps upward, its rows of unequal length)
const INFO_OBSTACLES = '#tc-actrow:not(.hidden) > .k-btn, #tc-fire, #tc-cast:not(.hidden), #tc-ammo, #tc-special, #tc-abil:not(.hidden), #tc-skill:not(.hidden), #tc-lock, #tc-stick, #tc-speed, #tc-deck, #tc-act:not(.hidden), #tc-offer:not(.hidden), #tc-sail, #hud-captain .cs, #toasts > .toast, #hud-chat > .chat-toggle, #tc-menu, #tc-news, #tc-isle, #tc-more, #hud-map, #advcard:not(.hidden), #encounter:not(.hidden), #surrender:not(.hidden)';
setInterval(() => {
  const el = document.getElementById('hud-bottom');
  if (!el) return;
  const b = document.body;
  if (!b.classList.contains('touch') || !b.classList.contains('simple') || !el.textContent?.trim()) {
    if (el.style.translate) el.style.translate = '';
    return;
  }
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const [tx, ty] = (el.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
  const bx = r.left - tx, by = r.top - ty, W = innerWidth, H = innerHeight;
  const obs: DOMRect[] = [];
  for (const o of document.querySelectorAll<HTMLElement>(INFO_OBSTACLES)) {
    const q = o.getBoundingClientRect();
    const c = getComputedStyle(o);
    if (q.width > 1 && q.height > 1 && c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0.05) obs.push(q);
  }
  const free = (x: number, y: number) => x >= 4 && x + r.width <= W - 4 && y >= H * 0.45 && y + r.height <= H - 2 && obs.every((q) => q.right <= x + 1 || q.left >= x + r.width - 1 || q.bottom <= y + 1 || q.top >= y + r.height - 1);
  let best: [number, number] | null = null;
  for (let dy = 0; !best && by + dy >= H * 0.45; dy -= 4) {
    for (const dx of [0, -30, 30, -60, 60, -90, 90, -120, 120, -160, 160, -200, 200]) if (free(bx + dx, by + dy)) { best = [dx, dy]; break; }
  }
  const v = best ? `${best[0]}px ${best[1]}px` : '';
  if (el.style.translate !== v) el.style.translate = v;
}, 250);

// The phone in the hand on the captain's own milestones (2026-10-16): a pulse as silver goes on a purchase in port,
// a longer one on a new level (haptics.ts; «Вибрация» off stills both).
let buzzLevel = -1, buzzSilver = -1, pipeDocked: boolean | null = null;
setInterval(() => {
  const s = state.self;
  if (!s || !inGame) return;
  // (and heard: the sound pass, 2026-10-16 — a level's arpeggio, a purchase's coins, the bosun's pipe on leaving port)
  if (buzzLevel >= 0 && s.level > buzzLevel) {
    buzz('level');
    cue('level');
  }
  if (buzzSilver >= 0 && s.dockedAt && s.gold < buzzSilver) {
    buzz('buy');
    cue('buy');
  }
  if (pipeDocked === true && !s.dockedAt) cue('undock');
  pipeDocked = !!s.dockedAt;
  buzzLevel = s.level;
  buzzSilver = s.gold;
}, 400);
let lastDoubloons = -1;
hud.onThrone = () => openThrone();
// An escort's chip under her bars (forum 2026-10-30, Нефигугум: the ships lag behind, hard to watch): the camera looks at
// her for ESCORT_PEEK_MS, then comes home on its own (a drag of the view meanwhile keeps the free look).
const ESCORT_PEEK_MS = 2600;
let escortPeek: { x: number; y: number } | null = null;
let escortPeekTimer: ReturnType<typeof setTimeout> | undefined;
hud.onEscort = (eid) => {
  const r = state.ships.get(eid);
  if (!r || state.self?.dockedAt) return;
  escortPeek = { x: r.cur.x, y: r.cur.y };
  renderer.free = escortPeek;
  clearTimeout(escortPeekTimer);
  escortPeekTimer = setTimeout(() => {
    if (renderer.free === escortPeek) renderer.recentre();
    escortPeek = null;
  }, ESCORT_PEEK_MS);
};
// Owner, 2026-10-28 (armyadvice.ts): the weak army's hint — the hire window where she is (a port, a waystation), or the island.
hud.onAdvice = (to) => {
  if (to === 'hire' && state.self?.dockedAt) return openRecruit('port');
  if (to === 'hire' && state.wayView) return openRecruit('way');
  openBase();
};
// Owner, 2026-10-28 (islefirst.ts): the island's first steps — the building's card on the island (from anywhere: the
// treasury and the yard pay), the hire window where she is, else «В порт» to the nearest harbour.
hud.onIsleFirst = (id) => {
  if (id === 'army') return openModal('crew'); // (owner, 2026-10-29: no room for marines — the army's own hand)
  if (id !== 'hire') {
    openBase();
    isleScene.showTown(id);
    return;
  }
  if (state.self?.dockedAt) return openRecruit('port');
  if (state.wayView) return openRecruit('way');
  if (homeport) return runAct({ id: 'homeport', icon: '', label: '', title: '' });
  hud.toast(L('i1noPort'), 'info');
};
isleScene.onSailHome = () => {
  leaveIsle(false);
  startGoal('own');
};
// «Где взять» (owner, 2026-10-30): a cost's tooltip — «Плыть» to the nearest seller, a building asked first opens its card
mountSrcTip({
  go: (key) => {
    leaveIsle(false);
    startGoal(key);
  },
  open: (id) => {
    if (!isleScene.isOpen) openBase();
    if (isleScene.isOpen) isleScene.openThing(id);
  },
});
// The premium shop (owner, 2026-10-03): from the micro menu and the cabin; `topup` opens it at the packs.
const premiumWindow = new PremiumWindow((m) => net.send(m));
premiumWindow.toast = (msg, kind) => hud.toast(msg, kind);
const researchWindow = new ResearchWindow((m) => net.send(m));
function openShop(topup = false, at?: Parameters<PremiumWindow['open']>[1]): void {
  premiumWindow.open(topup, at);
  openModal('shop');
}
// docs/32 §12: the cosmetics — the quick emotes by the chat's button, the chat picker's own tab, the wardrobe
mountQuickEmotes(state, (m) => net.send(m), () => openShop(false, { tab: 'cos', sec: 'cos_emotes' }));
hud.chatPanel.cosEmotes = () => ownEmotes(state).map((e) => ({ id: e.id, name: e.name[lang() === 'ru' ? 1 : 0] }));
const openWardrobe = (): void => openShop(false, { tab: 'cos', wardrobe: true });
// «Свиток автобоя» (owner, 2026-10-11): «Купить» on the battle bar and in the locker opens the shop at its scrolls;
// the island's scene at its builders, the harbour at the sea's goods (owner, 2026-10-15: the three tabs).
const SHOP_AT: Record<string, Parameters<PremiumWindow['open']>[1]> = { scrolls: { tab: 'board', sec: 'battle' }, isle: { tab: 'isle', sec: 'build' }, sea: { tab: 'sea', sec: 'supply' }, board: { tab: 'board', sec: 'recruit' } };
// Owner, 2026-10-28: a window asked for from inside another (a letter's men with no room: the Crew window).
addEventListener('gravetide:open', (e) => {
  const m = (e as CustomEvent).detail;
  if (m === 'crew') openModal('crew');
});
addEventListener('gravetide:shop', (e) => {
  const d = (e as CustomEvent).detail;
  // (a personal offer's «Подробнее» names its tab and shelf, promo.ts; the top-up: 'topup')
  if (d === 'topup') return openShop(true);
  if (d === 'exchange') return openShop(false, { exchange: true }); // doubloons into silver (owner, 2026-10-30)
  openShop(false, typeof d === 'object' && d ? d : SHOP_AT[String(d ?? '')]);
});
hud.onShop = () => openShop();
hud.onExchange = () => openShop(false, { exchange: true }); // the silver's «+» (owner, 2026-10-30)
// Her personal offers (owner, 2026-10-15): the entry carousel, the sea's chip, the island's card, the harbour's strip.
// The daily login gift (owner, 2026-10-16): its calendar comes first on entry, the offers' carousel after it.
// (both wait out the campaign's opening, its five lessons: «Награда за вход» came up between «Борт о борт» and «Твари на
// отмели» over the bar's «Плыть» — the newcomer's run of 2026-10-23)
const dailyGift = new DailyGift({ send: (m) => net.send(m), on: (f) => net.on(f), state, modal: () => modal, busy: () => hostileNear() || !!state.boardTac || !!state.boardFight || openingFrame() !== null });
initTgNotices((m) => net.send(m), (f) => net.on(f));
const promos = new Promos({ send: (m) => net.send(m), on: (f) => net.on(f), state, modal: () => modal, busy: () => hostileNear() || !!state.boardTac || !!state.boardFight || openingFrame() !== null, held: () => dailyGift.holding() });
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
companyScreen.onGo = () => closeModal();
companyScreen.onQuests = () => openModal('journal');
baseWindow.onSail = () => {
  closeModal();
  leaveIsle(false);
};
baseWindow.onLayout = () => { if (modal === 'base') refreshModal(); };
/** Her island (owner, 2026-10-15: «кнопка входа на остров … отдельное абсолютно новое окно с постройками»): the island
 *  screen over the whole screen; without an island of her own, the old window says how to have one. */
function openBase(): void {
  if (!isleScene.isOpen) haltForIsle();
  if (state.self?.homeIsle === null || state.self?.homeIsle === undefined) {
    baseWindow.tab = 'plots';
    baseWindow.open();
    openModal('base');
    return;
  }
  if (isleScene.isOpen) {
    if (modal) closeModal();
    return;
  }
  // the window she came from goes (the harbour comes back when she leaves the island)
  if (modal) {
    modal = null;
    $('modal').classList.add('hidden');
    releaseModalToasts();
  }
  if (hud.chatPanel.isOpen) hud.chatPanel.close();
  isleKey = selfKeyFor('base');
  isleScene.enter(state);
}
/** Owner, 2026-10-16 («переходя на остров корабль должен останавливаться»): going onto her island stops her at sea —
 *  sails down, no way on, the helmsman's course, a goal's run, «В порт» and a landing's run dropped; the server does it
 *  (Game.halt) and her helm here keeps the sails down. */
function haltForIsle(): void {
  if (!inGame || state.self?.dockedAt || !state.ownDisplay) return;
  touch.course = null;
  goalRun = null;
  homeRun = null;
  claimRun = null;
  pendingDock = null;
  setMark(null);
  state.input.sail = 0;
  net.send({ t: 'halt' });
}
/** The island's first steps' finger (owner, 2026-10-28): on the island at its building's «Построить», in a harbour's
 *  hire window at the marines; the HUD's line itself only for a while after the step comes (then the story's finger). */
let i1Seen = { key: '', at: 0 };
function isleFirstStage(): string | null {
  const v = state.self?.isleFirst;
  if (!v) return null;
  const key = `${v.id}:${v.step}`;
  const now = performance.now();
  if (key !== i1Seen.key) i1Seen = { key, at: now };
  const fresh = now - i1Seen.at < 90_000;
  // (owner, 2026-10-29: no marine to be had — a calm line on the HUD, no finger)
  if (v.id === 'hire') return v.stuck ? null : state.self?.dockedAt || modal === 'recruit' || fresh ? 'i:hire' : null;
  return isleScene.isOpen || (fresh && v.ready) ? `i:${v.open}` : null;
}
/** Back to the sea from the island screen (into the harbour when she lies in one). */
function leaveIsle(harbour = true): void {
  if (!isleScene.isOpen) return;
  isleScene.exit();
  baseWindow.tab = 'plots';
  if (harbour && state.portView && modal === null) {
    portReturn = true;
    openModal('port');
  }
}
isleScene.onExit = () => leaveIsle();
isleScene.onSail = () => {
  if (modal) closeModal();
  leaveIsle(false);
};

/** The terms of the island off the bow (docs/15 item 6), on the Company's islands card. */
function openClaim(): void {
  companyScreen.open('isles');
  net.send({ t: 'estate', action: 'view' });
  openModal('company');
}
// ---- seaux (2026-10-11, owner: «я должен нажать и плыть к цели … Так же у кнопок занять»): sail-to on tap
/** «Занять» far from the island: the helmsman takes her in to its shore and the claim's terms open there. */
let claimRun: { island: number; at: number } | null = null;
function claimIsland(): void {
  const c = state.self?.claimIsle, own = state.ownDisplay;
  const isl = c ? state.islands.get(c.island) : undefined;
  if (!c || !own || !isl || claimNear(isl, own)) return openClaim();
  claimRun = { island: c.island, at: performance.now() };
  sailToSpot(claimSpot(isl, own));
}
function stepClaimRun(): void {
  if (!claimRun) return;
  const own = state.ownDisplay, isl = state.islands.get(claimRun.island);
  if (!own || !isl || state.self?.dockedAt) claimRun = null;
  else if (claimNear(isl, own)) {
    claimRun = null;
    openClaim();
  } else if (performance.now() - claimRun.at > 120_000) claimRun = null; // (the helmsman refused — a sail in sight: she may sail in herself)
}
/** When the server last stopped her for an action, a battle or a card (the page's clock). */
let allStopAt = -1e9;
/** The long passage's word said already (a reconnect mid-passage does not say it twice). */
let voyageSaid = false;
/** Owner, 2026-10-22 (server allstop.ts): «любое действие … должно останавливать корабль». Her sail control comes down to
 *  nothing and the helm stick lets go — the old sail step is never sent again, and she sails on only when she sets sail
 *  or gives a course herself; the runs the page was keeping (home, a claim, a goal, a dock) let go too. */
function allStopHere(): void {
  allStopAt = performance.now();
  state.input.sail = 0;
  state.input.rudder = 0;
  touch.course = null;
  goalRun = null;
  homeRun = null;
  claimRun = null;
  pendingDock = null;
  renderer.goal = null;
  setMark(null);
}
/** A harbour under a finger only on its town (its island) or within a thumb of its crest — not anywhere in 160 m of it
 *  (placeAtScreen's, the mouse's selection): at a phone's zoom the whole screen about a harbour was «the harbour», and a
 *  tap in its roads went nowhere (owner, 2026-10-29, Солтмарроу: «не могу нажать пальцем куда-то куда мне надо»). The
 *  harbour she lies in is never the tap's: the sea about it is. */
const FINGER_PORT_PX = 64;
function fingerPlace(pl: ReturnType<typeof placeAtScreen>, w: { x: number; y: number }): ReturnType<typeof placeAtScreen> {
  if (!pl || pl.kind === 'wreck') return pl;
  // (an island's `r` bounds its shape and the water about it — Солтмарроу's is 1250 m: its land only, by its outline)
  const onLand = (is: { poly: number[] }) => is.poly.length >= 6 && pointInPolygon(w.x, w.y, is.poly);
  if (pl.kind === 'isle') {
    const is = state.islands.get(Number(pl.id));
    return is && onLand(is) ? pl : null;
  }
  if (pl.id === state.self?.dockedAt) return null;
  const pt = state.ports.find((x) => x.id === pl.id);
  const onTown = [...state.islands.values()].some((is) => (is.portId === pl.id || is.town === pl.id) && onLand(is));
  return onTown || (pt && Math.hypot(pt.x - w.x, pt.y - w.y) * renderer.zoom <= FINGER_PORT_PX) ? pl : null;
}
/** The harbour whose name lies under a point of the screen (owner, 2026-10-30: the port card): the label over the town
 *  (renderer.ts drawPorts), a finger's slack about it. A tap on the name opens the card; on the town or the water she
 *  still sails (seaTapPlan). Not under the fog of war (no name drawn there). */
const LABEL_SLACK_PX = 14;
function portLabelAt(px: number, py: number): string | null {
  const z = renderer.zoom;
  const fs = Math.round(Math.max(12, Math.min(22, 14 * z)));
  let best: string | null = null, bd = Infinity;
  for (const p of state.ports) {
    if (underFog(state.seen, p.x, p.y)) continue;
    const cx = renderer.sx(p.x), cy = renderer.sy(p.y) - 40 * z - fs * 0.35; // (the text stands on its baseline)
    const half = (placeName(p.name).length * fs * 0.55) / 2 + LABEL_SLACK_PX;
    if (Math.abs(px - cx) > half || Math.abs(py - cy) > fs * 0.5 + LABEL_SLACK_PX) continue;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bd) [best, bd] = [p.id, d];
  }
  return best;
}
/** A finger's tap on the sea (seaTapPlan, deskinput.ts; owner 2026-10-29: «мне нужно тапнуть куда мне надо и начать
 *  плыть. порт или еще куда-то, куда угодно короче»): any tap sails her — at sea, and in a harbour's roads too (the
 *  «В МОРЕ» state: the course is given, then she casts off, no «В море» first). Another ship or a creature stack is the
 *  target (and its choices); tapped again, she sails to it. */
function seaTap(px: number, py: number): void {
  renderer.mouseX = px;
  renderer.mouseY = py;
  if (!inGame || !state.ownDisplay) return;
  const before = { ship: targetId, roam: state.roamMark };
  const ship = shipAtScreen(px, py), roam = ship === null ? roamAtScreen(px, py) : null;
  const again = (ship !== null && ship === before.ship) || (roam !== null && roam === before.roam);
  const k = markAt(px, py);
  if (k) markTapAt = performance.now();
  openTargetMenu(k === 'ship' && targetId !== null ? `ship:${targetId}` : k === 'roam' && state.roamMark !== null ? `roam:${state.roamMark}` : '');
  const docked = !!state.self?.dockedAt;
  const w = renderer.toWorld(px, py);
  const pl = k ? null : fingerPlace(placeAtScreen(px, py), w);
  const t = k || renderer.goalHit(px, py) ? null : tapTarget(state, w.x, w.y, renderer.zoom);
  const blocked = state.voyage ? 'voyage' : state.boardTac || state.boardFight || state.boarding ? 'battle' : null;
  // a harbour's name: its card, «Плыть сюда» inside (owner, 2026-10-30); its town and its water still sail
  const named = !k && !modal ? portLabelAt(px, py) : null;
  if (named) return openPortCard(state, named);
  const plan = seaTapPlan({ mark: k, again, thing: !!t || renderer.goalHit(px, py), place: pl?.kind ?? null, modal: !!modal, blocked: !!blocked });
  selPlace = k === 'ship' && targetId !== null ? { kind: 'ship', id: targetId } : k ? null : pl; // (owner, 2026-10-26)
  if (plan === 'none' || plan === 'target') return;
  if (plan === 'blocked') return void hud.toast(seaTapWhy(blocked!, lang() === 'ru'), 'info');
  if (plan === 'port') return startGoal(`p:${pl!.id}`); // (the run casts her off in port and puts her in on arrival)
  if (plan === 'thing' && !t) return tapGoal(); // the goal's beacon or rim arrow: the run (cast off by the server in port)
  if (plan === 'chase') {
    const p = ship !== null ? state.ships.get(ship)?.cur : null;
    const r = roam !== null ? state.roams.find((x) => x.id === roam) : undefined;
    const at = p ? { x: p.x, y: p.y } : r ? roamNow(state, r) : null;
    if (at) sailToSpot(at, 80);
  } else if (plan === 'thing') {
    if (docked && t) sailToSpot(t, t.near); // (its own order waits: in port the course is given, she casts off below)
    else if (!sailToTap(px, py)) sailToScreen(px, py);
  } else if (plan === 'place') {
    const sw = selWhere();
    if (sw) sailToSpot({ x: sw.x, y: sw.y }, sw.near);
    else sailToScreen(px, py);
  } else sailToScreen(px, py);
  // in a harbour's roads: the course is kept by the helmsman (autosail.ts queued) and she casts off at once
  if (docked) net.send({ t: 'undock' });
}
/** The helmsman's course to a spot (and how near he should bring her), drawn with its ring. */
function sailToSpot(p: { x: number; y: number }, near?: number): void {
  touch.course = null; // the helm stick lets go, or it would take the wheel straight back
  goalRun = null; // another course: the run to a quest's place lets go
  resumeKey = resumeAfterEnd(resumeKey, 'own');
  const wp = { x: Math.round(p.x), y: Math.round(p.y) };
  setMark(wp);
  net.send({ ...autosailRequest(state, wp), ...(near !== undefined ? { near: Math.round(near) } : {}) });
}
/** A tap on a thing on the sea: its own order (the server sails her there and gives it within reach), or the
 *  helmsman's course to what she takes by passing. True when the tap was about a thing. */
function sailToTap(px: number, py: number): boolean {
  if (!inGame || state.self?.dockedAt || !state.ownDisplay) return false;
  // ux2: the goal's beacon on the sea or its arrow on the screen's edge — the course there (a quest: on through its steps)
  if (renderer.goalHit(px, py)) {
    tapGoal();
    return true;
  }
  const w = renderer.toWorld(px, py);
  const t = tapTarget(state, w.x, w.y, renderer.zoom);
  if (!t) return false;
  if (t.kind === 'find') workFind(Number(t.id));
  else if (t.kind === 'way') net.send({ t: 'way', action: 'moor', id: Number(t.id) }); // (the server sails her in: approach.ts)
  else if (t.kind === 'mark' && !state.markDone.has(Number(t.id))) workMark(Number(t.id));
  else sailToSpot(t, t.near);
  return true;
}
// ---- /seaux
// ---- ux2 (2026-10-11, owner: «после взятия квеста должна быть метка куда плыть, нажатие на эту метку корабль начинает
// плавание до места. вообще нужно максимум автоматизировать все»): the course to a quest's place (goalrun.ts)
const U2 = dict(UX2_EN, UX2_RU);
const RT = dict(ROUTE_EN, ROUTE_RU);
/** The run to a goal (route, 2026-10-15: the nearest place the server chose for any goal of hers), or none. */
let goalRun: RouteRun | null = null;
/** The goal of the last run, for her «Плыть» after a prize (ui/resumesail.ts). */
let resumeKey: string | null = null;
/** Why the helmsman last gave the wheel back, and when (the page's clock). */
let helmStop: { why: AutosailStop; at: number } | null = null;
/** The last «the helmsman has the wheel» said, and for which mark: a course re-set for the same mark (a moving thing
 *  followed, a fight's course taken up) is not said again. */
let asSaid = { x: NaN, y: NaN, at: -1e9 };
function autosailQuiet(m: { x?: number; y?: number }): boolean {
  const now = performance.now();
  const same = m.x !== undefined && m.y !== undefined && Math.hypot(m.x - asSaid.x, m.y - asSaid.y) < 400 && now - asSaid.at < 30_000;
  if (!same) asSaid = { x: m.x ?? NaN, y: m.y ?? NaN, at: now };
  return same;
}
/** The quests she had at the last private state (a new one is followed: its mark shows on the sea). */
let questsKnown: Set<string> | null = null;
/** The last tap of a goal (one request per tap: a bounced finger sends nothing more). */
let goalTap = { key: '', at: -1e9 };
/** A run started without a word (off the quay by itself): its course is not announced. */
let goalQuiet = false;
/** The run to a goal: the server finds its nearest place (goalroute.ts) and the helmsman takes her there (in port: as
 *  soon as she casts off), re-targeted as the sea moves, on through a quest's steps, until the goal is met. */
function startGoal(key: string, quiet = false): void {
  const now = performance.now();
  if (goalTap.key === key && now - goalTap.at < 800) return;
  goalTap = { key, at: now };
  touch.course = null;
  claimRun = null;
  homeRun = null;
  setMark(null); // her own old mark would lead the «Now:» line and the beacon instead of the goal
  if (key.startsWith('q:')) setTracked(key.slice(2));
  goalRun = new RouteRun(key, now, PORT_DOCK_RADIUS);
  resumeKey = key;
  goalQuiet = quiet;
  // (never a window that must be answered: the opening's next run started by itself the moment a boarding's field
  // closed, and shut the prize's card — the ship lay hove to by her prize, the helmsman never went, QA 2026-10-22)
  if (modal && !ANSWER.includes(modal)) closeModal();
  net.send({ t: 'goto', key });
}
/** A tap on the beacon: the run to the goal it shows (a quest, a contract's port), else a plain course to it. */
function tapGoal(): void {
  if (goalRun && state.route?.key === goalRun.key) return; // already on her way there
  const own = state.ownDisplay;
  const o = own ? objective(state, own.x, own.y) : null;
  if (o?.key) return startGoal(o.key);
  if (o && o.x !== undefined && o.y !== undefined) sailToSpot({ x: o.x, y: o.y });
}
/** The server's word on the run: its place (said once, when chosen), or its end. */
function onRoute(m: Extract<ServerMsg, { t: 'route' }>): void {
  if (!m.on) {
    if (goalRun?.key === m.key) goalRun = null;
    if (resumeKey === m.key) resumeKey = resumeAfterEnd(resumeKey, m.why);
    renderer.goal = null;
    return;
  }
  if (!m.view) return;
  if (!goalRun || goalRun.key !== m.key) goalRun = new RouteRun(m.key, performance.now(), PORT_DOCK_RADIUS);
  resumeKey = m.key;
  const fresh = goalTap.key === m.key && performance.now() - goalTap.at < 3000;
  if (fresh && !goalQuiet && !state.self?.dockedAt) hud.toast(RT('set', { name: routeLabel(m.view), d: distWords(m.view.dist) }), m.view.risk === 2 ? 'bad' : 'info');
  if (fresh) goalTap = { key: m.key, at: -1e9 };
}
/** Each frame: what the place asks for on arrival — putting in, a landing, the trade's word — and the beacon on it. */
function stepGoal(): void {
  const rt = state.route;
  renderer.goal = rt && !state.self?.dockedAt ? { x: rt.view.x, y: rt.view.y } : null;
  if (rt && (!goalRun || goalRun.key !== rt.key)) goalRun = new RouteRun(rt.key, performance.now(), PORT_DOCK_RADIUS);
  const run = goalRun;
  if (!run) return;
  const own = state.ownDisplay;
  const l = state.self?.landable;
  const r = run.step({ now: performance.now(), docked: state.self?.dockedAt ?? null, own: own ? { x: own.x, y: own.y } : null, region: state.region, autosail: state.autosail, stop: helmStop, landable: !!l && !l.blocked, place: rt?.key === run.key ? rt.view : null });
  switch (r.do) {
    case 'atport': {
      // Not put in by herself (owner, 2026-10-16): the harbour's «Причалить» is hers to press.
      const p = state.ports.find((x) => x.id === r.port);
      hud.toast(U2('goal.atPort', { port: sv(p?.name ?? '') }), 'good');
      break;
    }
    case 'land':
      sendLand();
      break;
    case 'arrived':
      hud.toast(r.hint ? sv(r.hint) : U2('goal.arrived', { name: rt ? routeLabel(rt.view) : '' }), 'good');
      break;
  }
}
/** Off the quay (ux2, «Курс к заданию»): no run yet and a followed quest with a place elsewhere — the course to it. */
function goalOnCastOff(): void {
  if (!settings().autoGoal || state.onboarding?.stage) return;
  const own = state.ownDisplay;
  const q = trackedQuest(state.self?.quests, own);
  // A run left from the last voyage (a lair's island reached) gives way to the quest she picked since (docs/30: «Весточка
  // другу» followed in the journal, and off the quay the helmsman took her back to the lair, onto its rocks).
  if (state.route || (goalRun && (!q || q.id !== trackedId() || goalRun.key === `q:${q.id}`))) return;
  goalRun = null;
  if (!q?.target || !own || q.target.region === state.region) return;
  if (Math.hypot(q.target.x - own.x, q.target.y - own.y) < PORT_DOCK_RADIUS * 1.5) return;
  startGoal(`q:${q.id}`, true);
  hud.toast(U2('goal.auto', { name: sv(q.name) }), 'info');
}
/** A quest just taken is followed (its mark shows on the sea at once) — said once. */
function noteNewQuests(): void {
  const qs = state.self?.quests;
  if (!qs) return;
  const known = questsKnown;
  questsKnown = new Set(qs.map((q) => q.id));
  const fresh = known ? qs.find((q) => !known.has(q.id)) : undefined;
  if (!fresh) return;
  setTracked(fresh.id);
  // (the campaign's quests have their «Плыть» on the bar: the toast names it, not a mark to find on the sea)
  if (fresh.target) hud.toast(U2(fresh.kind === 'campaign' ? 'goal.trackedSail' : 'goal.tracked', { name: sv(fresh.name) }), 'info');
}
departHooks.told = (msg) => hud.toast(msg, 'gold');
// ---- /ux2
// "Whisper" on a friend: the chat opens over the window, addressed to them.
let whisperPrefill = '';
// A groupmate's frame on the HUD: their card.
hud.onPartyTap = (name) => net.send({ t: 'inspect', name });
hud.onSignal = (kind) => net.send({ t: 'signal', kind }); // docs/16 #35
// docs/16 #32; route (owner 2026-10-15): a tap on the sea's goal — the nearest place it is done (the Choir's ships
// for «Потопить корабли Хора»); with none open, the journal.
hud.onWorldGoal = () => {
  const g = plateGoal(state);
  if (g) startGoal(`w:${g.id}`);
  else openModal('journal');
};
// route: «Промысел» (the fishing plate of «Цели и вести»): a tap off its buttons — the nearest water her tackle works
$('hud-fish').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  startGoal('f');
});
hud.onTargetTap = (name) => net.send({ t: 'inspect', name });
hud.onFishing = (action) => net.send({ t: 'fishing', action });
hud.onHunt = (action, id) => net.send(action === 'flense' ? { t: 'hunt', action, id: id ?? 0 } : { t: 'hunt', action });
hud.onTribute = (id) => net.send({ t: 'tribute', id });
// "Whisper" on a friend: the chat opens over the window on its private tab, addressed to them (docs/28).
companyScreen.onWhisper = (name) => hud.chatPanel.openDm(name);
const divePanel = new DivePanel((m) => net.send(m));
const boardFight = new BoardFightPanel((m) => net.send(m), () => state.estServerTime());
const tactical = new TacticalPanel((m) => net.send(m), () => state.estServerTime());
tactical.onFallenSlot = (root) => mountFallen(root, state, (m) => net.send(m)); // docs/35: the quick «Воскресить» ashore
tactical.purse = () => state.self?.gold ?? 0;
// docs/25 item 16: the boarding under the sea's own weather and hour (rain, fog, a storm's lightning, night).
tactical.sky = () => ({ weather: state.weather, fog: state.fog, wind: state.wind, night: nightFactor(state.estServerTime()) });
const optionsScreen = new OptionsScreen();
optionsScreen.close = () => closeModal();
optionsScreen.toast = (msg, kind) => hud.toast(msg, kind);
// A phone plays sideways only (owner, 2026-10-02). On the first touch the game goes full screen and holds the screen
// sideways where the browser allows it (Android); elsewhere the #rotate-lock veil asks for the phone to be turned.
// Never inside VK (docs/36): VK's own windows — the payment's first — must stay over the game.
if (matchMedia('(pointer: coarse)').matches && mayFullscreen()) {
  const holdSideways = (): void => {
    const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
    else lock();
  };
  addEventListener('pointerup', holdSideways, { once: true });
  // …and again at a tap on the upright veil (the first tap came while she was sideways)
  addEventListener('pointerup', () => {
    if (matchMedia('(orientation: portrait)').matches) holdSideways();
  });
  // (Android turns her sideways at the first tap even with the rotation locked: the upright veil says so — retention,
  // 2026-10-25: a phone held upright with auto-rotate off had no way on from the veil)
  if (/Android/i.test(navigator.userAgent)) document.getElementById('rl-tap')?.classList.remove('hidden');
}
const touch = new TouchControls({
  // docs/23 items 22–23: the stick's pull is the sail (0 when its middle is held), its double tap the dash.
  sail: (step) => {
    state.input.sail = clamp(step, 0, 4);
    helmAt = performance.now(); // her own hand on the sheets: the helmsman lets go a while (docs/23 item 33)
  },
  dash: () => net.send({ t: 'dash' }),
  aim: (px, py) => seaTap(px, py),
  zoom: (f) => {
    renderer.userZoomed = true;
    renderer.targetZoom = clampZoom(renderer.targetZoom * f); // far out (freecam.ts, owner 2026-10-17)
  },
  // a finger dragged over the sea looks about; she sails on as ordered (freecam.ts)
  pan: (dx, dy) => {
    if (!inGame || state.self?.dockedAt) return;
    renderer.panBy(dx, dy, state.ownDisplay);
  },
});
// The sea HUD on a phone (docs/23 phase 2): «Огонь» and its wheel, «Действие» and its wheel, «Особое», the menu's
// sheet, the news counter, the target line.
const seaHud = new SeaHud($('touch'), {
  folded: TOUCH_FOLDED,
  goals: {
    view: () => goalSheetView(state.self ? { ...state.self, nearIsle: isleNear() } : state.self),
    portName: (id) => placeName(state.ports.find((p) => p.id === id)?.name ?? id),
    go: (key) => startGoal(key),
    take: (id) => net.send({ t: 'quest', action: 'accept', id }), // docs/36: the campaign's quest, taken anywhere
    here: (id) => net.send({ t: 'quest', action: 'here', id }), // owner, 2026-10-23: «Расспросить» and the rest, in port
    tab: (tab) => journal.onPortTab(tab),
    isle: () => openBase(), // mid-game QA 2026-10-23: «Заложите постройки» at her island — «Строить», not «Плыть»
  },
  fire: () => seaFire(),
  fireOptions: () => fireWheel(),
  firePick: (id) => pickFireWheel(id),
  act: (id) => padContext(id),
  // (by the button's own act, not its place: the list is laid anew as she sails — «Причалить» tapped ran whatever stood
  // in its place a moment later, or nothing, QA 2026-10-22)
  actAt: (i, id) => {
    const x = liveAct(id) ?? (id === undefined ? curActs[i] : undefined);
    if (x) runAct(x);
  },
  // The wheel keeps the list it opened with while computePrompt() rebuilds curActs every frame: the pick runs that
  // list's own act (by position the slide to «Высадка» ran whatever stood there a moment later, docs/23 item 94).
  actOptions: () => (wheelActs = curActs.slice()).map((a, i) => ({ id: String(i), label: a.label, icon: a.icon, glyph: '•' })),
  actPick: (id) => {
    const a = wheelActs[Number(id)];
    wheelActs = [];
    if (a) runAct(a);
  },
  special: () => seaSpecial(),
  sail: () => {
    if (!state.self?.dockedAt || modal) return;
    departOrAsk(state, (m) => net.send(m), () => net.send({ t: 'undock' }));
  },
  ammoNext: () => cycleAmmo(1),
  // The desk's gun deck: a shot loaded by its slot, an ability used at her mark (the mouse is on the slot, not the sea).
  ammo: (id) => net.send({ t: 'ammo', ammo: id as 'round' }),
  ability: (id) => {
    aimAtMark();
    sendAbility(id);
  },
  // «Цель» (owner, 2026-10-07: «захват цели»): the next ship out from her as the mark; none near, a flash.
  nextTarget: () => {
    const was = targetId;
    cycleTarget();
    if (targetId === was && !state.ships.get(targetId ?? -1)) seaHud.flashLock();
  },
  menu: (id) => (id === 'more' ? openModal('menu') : openMenuItem(id)),
  target: () => {
    // The finger that marked her is still coming up (the line came under it as she was marked: its click opened her
    // card over the action button — «Атаковать» could not be pressed, QA 2026-10-07).
    if (performance.now() - markTapAt < 700) return;
    // The line shows a marked creature stack: its card (docs/19 D7); else the ship's frame.
    const rf = !targetPinned && !state.pursuit ? roamFocus() : null;
    if (rf?.marked) return openRoamLook(rf.v);
    seaHud.lend(['hud-target'], 'target');
  },
});
// «⋯» (owner, 2026-10-29: «все как-то прятать в подменюшки»): first in the row under her plate, the rest slides out of it.
const hudMore = new HudMore($('touch'));
// «Армия» in the tray (owner, 2026-10-29: «и в море я тоже должен управлять армией, разделять на стопки, удалять»): the
// crew window — its army card splits, merges and dismisses — in two taps from the sea.
{
  const t = document.createElement('template');
  t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-crew', icon: 'menu_crew', glyph: '⚔', aria: LSH('crewBtnTip'), cls: 'sea-round' }).trim();
  const b = t.content.firstElementChild as HTMLButtonElement;
  b.insertAdjacentHTML('beforeend', `<span class="tc-crew-l">${LSH('crewBtn')}</span>`);
  b.addEventListener('click', () => openModal('crew'));
  $('touch').append(b);
}
// The captain's abilities on a phone (owner, 2026-10-26: «на мобиле не показаны иконки спецприёмов капитана»): «Приёмы»
// in «Особое»'s place, its row of four — used as the desk's Z X C V are, at her mark.
const seaAbil = new SeaAbil($('touch'), (id) => {
  aimAtMark();
  sendAbility(id);
});
// «Умения» (owner, 2026-10-29: «4 будет с умениями из ядер… люди на мобилках не понимают что помимо ядер есть разные
// активные способности»): the fourth round button by «Огонь» — her active talents and the deck mount, out of the shot's
// wheel; used as the fire wheel's own entries are (pickFireWheel).
const seaSkill = new SeaAbil($('touch'), (id) => {
  if (id !== 'none') pickFireWheel(id);
}, SKILL_IDS);
// The island screen's way in from the sea (owner, 2026-10-15): «Остров» under the captain's plate. Always there (owner,
// 2026-10-19: «под аватаркой кнопка острова, щас я ее не вижу или я еще остров не отрыл»): before she holds an island
// it says how to found a town of her own and sails her to the nearest free island (the route `own`, goalroute.ts).
const isleBtn = (() => {
  const t = document.createElement('template');
  t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-isle', icon: 'ui_lighthouse', glyph: '⚓', aria: LIS('enterTip'), cls: 'sea-round hidden' }).trim();
  const b = t.content.firstElementChild as HTMLButtonElement;
  b.insertAdjacentHTML('beforeend', '<span class="tc-isle-l"></span>');
  b.addEventListener('click', () => (hasIsle() ? openBase() : openFound()));
  $('touch').append(b);
  return b;
})();
// «К кораблю» (owner, 2026-10-17: «вернуть камеру к кораблю»): under the chart's row while the view looks away from her
// — parked by a finger's drag, or drawn out past the old farthest (freecam.ts); a tap brings it home.
const homeBtn = (() => {
  const t = document.createElement('template');
  t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-home', icon: 'map_ship', glyph: '⌖', aria: LFC('homeAria'), cls: 'sea-round hidden' }).trim();
  const b = t.content.firstElementChild as HTMLButtonElement;
  b.insertAdjacentHTML('beforeend', '<span class="tc-home-l"></span>');
  b.addEventListener('click', () => renderer.recentre());
  $('touch').append(b);
  return b;
})();
function homeBtnFrame(): void {
  const show = renderer.looking && !state.self?.dockedAt;
  if (homeBtn.classList.contains('hidden') === show) homeBtn.classList.toggle('hidden', !show);
  const l = homeBtn.querySelector('.tc-home-l')!;
  if (l.textContent !== LFC('home')) {
    l.textContent = LFC('home');
    homeBtn.title = LFC('homeAria');
    homeBtn.setAttribute('aria-label', LFC('homeAria'));
  }
}
const hasIsle = (): boolean => state.self?.homeIsle !== null && state.self?.homeIsle !== undefined;
/** The campaign's opening (owner, 2026-10-19): its step now, for the finger (pointer.ts). Null past the opening, in the
 *  First Watch. (Owner, 2026-10-22: «любое действие … должно останавливать корабль» — its courses are no longer set by
 *  themselves the moment she is at sea or a battle's card is put away: her «Плыть» on the bar, openingSail.) */
function openingFrame(): string | null {
  if (state.onboarding?.stage) return null;
  const q = state.self?.quests.find((x) => x.kind === 'campaign' && x.op);
  return q?.op ?? null;
}
/** The opening's step at sea with no course for it: «Плыть» on the bar (the finger on it when the step's own button is
 *  not there). Not while a battle's account waits for her — the prize's card, a loss — nor under any window that must
 *  be answered, nor while the helmsman has her or «Атаковать» is under way. */
function openingSail(): { key: string; name: string } | null {
  const q = state.self?.quests.find((x) => x.kind === 'campaign' && x.op);
  if (!q?.op) return storySail();
  if (state.onboarding?.stage) return null;
  const sea = q.op === 'sink' || q.op === 'board' || q.op === 'neutral' || q.op === 'found';
  if (!sea || !inGame || state.self?.dockedAt || isleScene.isOpen) return null;
  if (state.boardTac || state.boardFight || state.pursuit || state.boarding || state.roamRun !== null || (modal && ANSWER.includes(modal))) return null;
  const key = `q:${q.id}`;
  if (state.autosail || (goalRun?.key === key && state.route?.key === key)) return null;
  return { key, name: sv(q.name) };
}
/** The story's quest now (the campaign's, after the opening): the one «Плыть» sails for. */
function storyQuest(): NonNullable<typeof state.self>['quests'][number] | null {
  if (state.onboarding?.stage) return null;
  const q = state.self?.quests.find((x) => x.kind === 'campaign' && !x.op);
  return q ?? null;
}
/** After the opening the story's quests have their «Плыть» too (the newcomer's run of 2026-10-23: «Соль и туман» said
 *  «нажмите на золотую метку», nothing lit on the bar, no finger — she stood twelve minutes): at sea, no run of the
 *  helmsman's on, no fight, no window to answer. */
function storySail(): { key: string; name: string } | null {
  const q = storyQuest();
  if (!q || !inGame || state.self?.dockedAt || isleScene.isOpen) return null;
  if (state.boardTac || state.boardFight || state.pursuit || state.boarding || state.roamRun !== null || (modal && ANSWER.includes(modal))) return null;
  const key = `q:${q.id}`;
  // (the run on but the helmsman not sailing her — arrived short, stopped by a fight's end, a card: she lay still and
  // nothing was lit, «Сойдите на берег Солтрок-Ки» and «Войдите в воды…» stood 14–19 min, the run of 2026-10-23)
  if (state.autosail || (goalRun?.key === key && state.route?.key === key && (state.ownDisplay?.speed ?? 0) > 0.5)) return null;
  return { key, name: sv(q.name) };
}
/** The finger on the story's way (the first two chapters, a newcomer's first hour): in port «В море», at sea «Плыть». */
function storyFrame(): string | null {
  const q = storyQuest();
  // a fork of the story waiting for her choice (its card closed, nothing lit — the run of 2026-10-23): the choice
  if (!q && (state.self?.campaign?.ch ?? 99) <= 2 && (state.self?.campaign?.ways?.length ?? 0) > 1 && !state.self?.campaign?.active) return 'fork';
  if ((state.self?.campaign?.ch ?? 99) > 2 || !q) return null;
  // a fight with no men left to send (a lair's beach lost, the newcomer's run of 2026-10-23: «Штурм» pressed 1300 times
  // with «Слишком мало рук для десанта»): the way to men first — into port, the army's dwellings
  const men = (state.self?.company?.army ?? []).reduce((a, x) => a + x.n, 0);
  if (q.does && q.does !== 'sink' && (men < 3 || (state.you?.crew ?? 99) < 3)) return state.self?.dockedAt || !state.autosail ? 'men' : null;
  if (state.self?.dockedAt) return 'go';
  // (the helmsman brings her to the step's harbour and «Причалить» is hers to press — owner, 2026-10-16: it lay lit 27 m
  // off the quay with no finger on it and «Соль и туман» stood half an hour, the newcomer's run of 2026-10-23)
  const t = q.target, own = state.ownDisplay;
  const p = t?.act === 'dock' && t.port && own ? state.ports.find((x) => x.id === t.port) : undefined;
  if (p && own && dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS * 2.5) return 'go:dock';
  // a fight or a landing: its own button on the bar first (lit while the helmsman still closes), else «Плыть»
  if (q.does) return `go:${q.does}`;
  return storySail() ? 'go' : null;
}
/** The quest «Плыть» sails for (owner, 2026-10-29: «подсказки плыть … часто ведут не туда»). It was always the story's
 *  (or the last run's), while the «Now:» line, the gold rim arrow and the journal's tick showed the quest she PICKED:
 *  a side quest followed, «Плыть» went off to the campaign's step, or back to a run she had left. Now: the opening's own
 *  step first (its lessons), then the quest she picked herself (a live one with a place), then the story, then the run
 *  broken off — and a broken-off run of another quest than the one picked is not offered. */
function goalSailPick(): { key: string; name: string; resume?: true } | null {
  const op = state.self?.quests.some((x) => x.kind === 'campaign' && x.op);
  if (op) return openingSail();
  const picked = pickedSail();
  if (picked) return picked;
  const story = storySail();
  if (story) return story;
  const r = resumeSail();
  const id = trackedId();
  if (r && id && r.key.startsWith('q:') && r.key !== `q:${id}` && state.self?.quests.some((x) => x.id === id)) return null;
  return r;
}
/** The quest she picked in the journal or on the chart (not the story's), when it has a place and nothing else is on. */
function pickedSail(): { key: string; name: string } | null {
  const id = trackedId();
  const q = id ? state.self?.quests.find((x) => x.id === id && x.kind !== 'campaign') : undefined;
  if (!q?.target || !inGame || state.self?.dockedAt || isleScene.isOpen) return null;
  if (state.boardTac || state.boardFight || state.pursuit || state.boarding || state.roamRun !== null || (modal && ANSWER.includes(modal))) return null;
  const key = `q:${q.id}`;
  if (state.autosail || (goalRun?.key === key && state.route?.key === key && (state.ownDisplay?.speed ?? 0) > 0.5)) return null;
  return { key, name: sv(q.name) };
}
/** Her «Плыть» for a run broken off by another order (a struck ship's terms, a boarding): gold on the bar until pressed
 *  (ui/resumesail.ts) — never sailed on by itself. */
function resumeSail(): { key: string; name: string; resume: true } | null {
  const key = resumeKey;
  const q = key?.startsWith('q:') ? state.self?.quests.find((x) => x.id === key.slice(2)) : undefined;
  const busy = !inGame || isleScene.isOpen || !!(state.boardTac || state.boardFight || state.pursuit || state.boarding) || state.roamRun !== null || !!(modal && ANSWER.includes(modal));
  const on = resumeOn({ key, live: !key?.startsWith('q:') || !!q, routeOn: !!state.route, docked: !!state.self?.dockedAt, autosail: !!state.autosail, busy });
  if (!on || !key) return null;
  return { key, name: q ? sv(q.name) : '', resume: true };
}
/** A passage due (owner, 2026-10-23): asked for once she is at sea, with no window open, no fight, no boarding, no
 *  island screen — never in the middle of anything. */
let passageAskedAt = -1e9;
function passageFrame(): void {
  if (!state.self?.campaign?.passage || state.self.dockedAt || !inGame || modal || isleScene.isOpen) return;
  if (state.boardTac || state.boardFight || state.pursuit || state.boarding || state.roamRun !== null) return;
  if (performance.now() - passageAskedAt < 3000) return;
  passageAskedAt = performance.now();
  net.send({ t: 'quest', action: 'passage', id: '' });
}
/** A quest step done in this very port (owner, 2026-10-23): the finger's stage `h:<id>:<page>` — the campaign's first,
 *  a step done by its own button before one done on a page. Null at sea or with nothing to do here. */
function hereFrame(): string | null {
  const docked = state.self?.dockedAt;
  if (!docked || state.onboarding?.stage) return null;
  const qs = [...(state.self?.quests ?? [])].filter((q) => hereAct(q, docked)).sort((a, b) => Number(b.kind === 'campaign') - Number(a.kind === 'campaign') || Number(b.act?.how === 'here') - Number(a.act?.how === 'here'));
  const q = qs[0];
  // a cargo to hand over that is not aboard: the market's row of it, if this market has it
  const a = q?.act;
  if (q && a?.verb === 'deliver' && a.good && ((state.self?.cargo as Record<string, number> | undefined)?.[a.good] ?? 0) < (a.qty ?? 1)) {
    const sold = state.portView?.market.some((r) => r.good === a.good && r.stock > 0);
    return sold ? `h:${q.id}:market:${a.good}` : null;
  }
  return q ? `h:${q.id}:${q.act?.how === 'tab' ? q.act.tab ?? '' : ''}` : null;
}
/** A good to trade at this market for the opening's lesson: the first in stock that is not a supply nor contraband. */
function tradeGoodHere(): string | null {
  const v = state.portView;
  if (!v) return null;
  return v.market.find((r) => r.stock > 0 && r.legal && GOODS[r.good]?.category !== 'supply')?.good ?? null;
}
/** «Остров» always under the plate (owner, 2026-10-19), but in the First Watch (its steps show the HUD a block at a time);
 *  before she holds an island a «+» on its corner and «Основать свой город» for its words. */
function isleBtnFrame(): void {
  const show = !!state.self && !state.onboarding?.stage;
  if (isleBtn.classList.contains('hidden') === show) isleBtn.classList.toggle('hidden', !show);
  const own = hasIsle();
  const w = LIS('enter');
  const tip = LIS(own ? 'enterTip' : 'foundTip');
  const l = isleBtn.querySelector('.tc-isle-l')!;
  if (l.textContent !== w || isleBtn.title !== tip) {
    l.textContent = w;
    isleBtn.title = tip;
    isleBtn.setAttribute('aria-label', tip);
  }
  const mark = isleBtn.querySelector('.tc-isle-new');
  if (!own && !mark) isleBtn.insertAdjacentHTML('beforeend', `<b class="k-badge tc-isle-new" aria-hidden="true">${glyphSvg('plus')}</b>`);
  else if (own && mark) mark.remove();
}
/** No island yet: how a town of her own is founded, and the helmsman to the nearest free island (or its claim, when one
 *  lies off her bow). */
function openFound(): void {
  const near = state.self?.claimIsle;
  const isl = near ? state.islands.get(near.island) : undefined;
  const body = `<p id="confirm-text"><b>${esc(LIS('foundH'))}</b></p><p>${esc(LIS('foundBody'))}</p><p class="muted">${esc(isl ? LIS('foundHere', { name: placeName(isl.name) }) : LIS('foundNear'))}</p>`;
  void askHtml(body, LIS(isl ? 'foundClaim' : 'foundGo'), LIS('foundNo'), 'found-panel').then((ok) => {
    if (!ok) return;
    if (isl) claimIsland();
    else startGoal('own');
  });
}
const onboarding = new OnboardingUi(state);
/** The First Watch's finger over the button its step wants (docs/23 item 80). */
const tutorPointer = new TutorPointer();
guardVibrate(); // «Вибрация» off stills every pulse (docs/23 item 84)
const encounterCard = new EncounterCard((m) => net.send(m));
const surrenderCard = new SurrenderCard((m) => net.send(m));
const ceasefireCard = new CeasefireCard((m) => net.send(m));
const hireCard = new HireCard((m) => net.send(m));
const hireChip = new HireChip((m) => net.send(m));
const LHIRE = dict(HIRE_EN, HIRE_RU);
const LOUT = dict(OUT_EN, OUT_RU);
const boardOffer = new BoardOfferCard((m) => net.send(m));
const lairChest = new LairChestCard();
const minigameWindow = new MinigameWindow((m) => net.send(m));
// docs/30: a game's card over the middle of the screen gives way to a fight — a hostile sail or beast near, a chase,
// a battle — so the helm and «Огонь» are hers again (a riddle's card stood there while a pirate boarded her).
setInterval(() => {
  if (minigameWindow.isOpen && (state.boardTac || state.boardFight || state.pursuit || dangerClose())) minigameWindow.close();
}, 700);
/** A hostile sail within 450 m, or a beast at her side (150 m): the shoals of sharks off a harbour are no reason (the
 *  reaches halved, owner 2026-10-22: 900 and 300 m before). */
function dangerClose(): boolean {
  const o = state.ownDisplay;
  if (!o || state.self?.dockedAt) return false;
  for (const x of state.ships.values()) {
    if (x.id === state.entityId || !x.cur || !(x.cur.flags & 64)) continue;
    const d = Math.hypot(x.cur.x - o.x, x.cur.y - o.y);
    if (d < (x.info?.npcRole === 'beast' ? 150 : 450)) return true;
  }
  return false;
}
// The walk across an island (docs/16 #21): its card waits behind an island game's window.
const trekWindow = new TrekWindow((m) => net.send(m), () => minigameWindow.isOpen);
const LI = dict(ISLES_EN, ISLES_RU);
const LLAIR = dict(LAIRS_EN, LAIRS_RU); // docs/18 II
const L18 = dict(I18_EN, I18_RU); // docs/18 III
const LROAM = dict(ROAM_EN, ROAM_RU); // docs/19 D7
const LR8 = dict(REACH_EN, REACH_RU); // owner, 2026-10-22: the reaches' hints
const LFL = dict(FLAGS_EN, FLAGS_RU); // docs/24 C1, D1

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
onboarding.onGoal = (key) => startGoal(key); // route: a captain's goal — its nearest place
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
onSettings(() => {
  if (inGame) sendGunnery();
  else document.body.classList.toggle('expert-guns', settings().expertGuns);
});
document.body.classList.toggle('expert-guns', settings().expertGuns);
let classicSent = settings().classicBoarding, deploySent = settings().tacDeploy;
onSettings((s) => {
  if (s.classicBoarding === classicSent && s.tacDeploy === deploySent) return;
  classicSent = s.classicBoarding;
  deploySent = s.tacDeploy;
  net.send({ t: 'board_pref', classic: s.classicBoarding, deploy: s.tacDeploy });
});
document.documentElement.lang = lang();
applyDataLocale(lang());
// docs/36: the campaign's 720 quests' words, a module of their own, asked for at once (they come while she logs in); till
// then its lines show an ellipsis (cmpText) and its toasts wait for them — never English
void loadCampaignWords().then(() => modal && refreshModal());
flagsCss(); // the colours' stylesheet (docs/24; index.html is the sea HUD's)
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

// Never over a fight's screen: the boarding or the shipwreck come first. The notice waits for a clear deck (edgeFrame),
// and one already open when grapples fly is put away and told after the battle (the hex field is no modal of its own).
let edgeDue = false;
onboarding.onEdge = () => (edgeDue = true);
function edgeFrame(): void {
  if (modal === 'edge' && state.boardTac) {
    closeModal();
    edgeDue = true;
    return;
  }
  if (!edgeDue || state.boardTac || document.querySelector('.film')) return;
  if (modal === null || modal === 'map' || modal === 'help') {
    edgeDue = false;
    openModal('edge');
  }
}

// ------------------------------------------------------------------ boot

// The cursors' few first (assets.ts: nothing else is asked for until a screen draws it; the title's painting and logo come
// with the page itself, index.html), the service worker that keeps the pictures for the next visit (client/sw.js).
artStore();
loadAssets(['ui.helm', 'ui.loader_wheel', ...Object.values(CURSOR_ART)]).then(() => {
  applySkin();
  buildMicroMenu();
  hud.artEpoch++;
  seaHud.dress();
  // «Остров» and «К кораблю» in their painted pictures, not the letters standing in before the art came (a «⌖» or «⚓» set
  // in a phone's own font sat low in the ring — owner, 2026-10-18)
  for (const [b, art] of [[isleBtn, 'ui_lighthouse'], [homeBtn, 'map_ship']] as const) {
    const g = b.querySelector('.k-btn-ico.glyph');
    const t = document.createElement('template');
    t.innerHTML = icon(art, '', 'k-btn-ico');
    if (g && t.content.firstElementChild) g.replaceWith(t.content.firstElementChild);
  }
  buildCursors(); // the attack cursor from the tattoo set's sabres, hook and gun
  hud.chatPanel.art();
  hud.chatPanel.tabs();
});

/** The game's films at their moments (ui/cutscene.ts): the first boarding (a lair's fight ashore), the first win and
 *  loss, the first harbour, the first storm — each shown once. */
const filmWas = { over: false, docked: true, atQuay: false, bosses: '', landing: true };
/** The islands whose landing had its film this session (one island, one film). */
const filmIsles = new Set<number>();
/** A landing's film by what the party goes ashore for: a buried chest, a named pirate's lair, an island; none for a
 *  haul, a dive or the shallows. */
const LANDING_FILM: Record<string, string | null> = { dig: 'cut_treasure', pirate_camp: 'cut_fort', lookout: 'cut_lighthouse', dive: 'cut_wreck_dive', haul: null, tidal: null, turtle: null };
/** The sea's world bosses, each the first time one rises near her. */
const BOSS_FILM: Record<string, string> = { kraken: 'cut_kraken_boss', leviathan: 'cut_leviathan', lantern_maw: 'cut_lantern_maw', black_serpent: 'cut_serpent', abyss_eye: 'cut_abyss',
  drowned_whale: 'cut_drowned_whale', hollow_admiral: 'cut_hollow_admiral', mother_of_wrecks: 'cut_mother_of_wrecks', storm_widow: 'cut_storm_widow', ancient_leviathan: 'cut_ancient_leviathan',
  old_moorings: 'cut_old_moorings', old_tithe: 'cut_old_tithe', fog_changeling: 'cut_fog_changeling', cinder_ray: 'cut_cinder_ray', drowned_prelate: 'cut_drowned_prelate', rime_twins: 'cut_rime_twins' };
/** The great ones ashore (shared/src/data/shorebosses.ts) and the great old lairs, each the first time she wins there. */
const SHORE_DOWN: Record<string, string> = { mire_mother: 'cut_mire_mother_down', cinder_salamander: 'cut_cinder_salamander_down', drowned_abbess: 'cut_drowned_abbess_down', walrus_tyrant: 'cut_walrus_tyrant_down',
  ape_throne: 'cut_ape_throne_down', roc_eyrie: 'cut_roc_eyrie_down', hydra_pool: 'cut_hydra_pool_down', wyrm_gallery: 'cut_wyrm_gallery_down',
  serpent_grotto: 'cut_serpent_grotto_down', maw_pit: 'cut_maw_pit_down', octopus_wreck: 'cut_octopus_wreck_down', turtle_guardian: 'cut_turtle_guardian_down',
  leviathan_shoal: 'cut_leviathan_shoal_down', crab_hollow: 'cut_crab_hollow_down', tentacle_lagoon: 'cut_tentacle_lagoon_down', choir_circle: 'cut_choir_circle_down',
  drowned_surf: 'cut_drowned_surf_down', croc_mangroves: 'cut_croc_mangroves_down', jaguar_den: 'cut_jaguar_den_down', ape_ridge: 'cut_ape_ridge_down',
  serpent_marsh: 'cut_serpent_marsh_down', shark_shallows: 'cut_shark_shallows_down', moray_reef: 'cut_moray_reef_down', bat_cave: 'cut_bat_cave_down',
  albatross_rock: 'cut_albatross_rock_down', crab_beach: 'cut_crab_beach_down', gull_cliffs: 'cut_gull_cliffs_down', seal_rookery: 'cut_seal_rookery_down',
  turtle_rocks: 'cut_turtle_rocks_down', hermit_camp: 'cut_hermit_camp_down' };
/** The world bosses as last seen: their kind, whether in their last tenth, her share. */
const bossSeen = new Map<number, { kind: string; low: boolean; share: number }>();
let sunkAt = -Infinity;
/** When her last fight ended: a ship let go into port after a boarding lost has had the defeat's film already. */
let fightOverAt = -Infinity;
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
    : ['/level 30', '/tp gravewater', '/ship frigate', ...army.slice(1), '/army ancient_turtle 3', '/army young_kraken 1', '/army white_whale 1', '/foe patrol frigate 50', '/board']; // (50 m: /foe's default 140 m is past the grapples' throw)
  orders.forEach((text, i) => setTimeout(() => net.send({ t: 'chat', text }), 800 + i * 700));
}
/** When each refusal was last told (the page's clock), and her last press or key (main.ts refusalAgain). */
const refusedAt = new Map<string, number>();
let pressAt = -1e9;
addEventListener('pointerdown', () => (pressAt = performance.now()), { capture: true, passive: true });
addEventListener('keydown', () => (pressAt = performance.now()), { capture: true, passive: true });
/** The same refusal within REFUSAL_QUIET_MS of the last, with no press of hers in the moment before it: not news. */
const REFUSAL_QUIET_MS = 8000;
/** The words of a refusal the advisor shows already (its toast keeps quiet). */
let adviceToast: { msg: string; at: number } | null = null;
function refusalAgain(msg: string): boolean {
  const now = performance.now();
  const at = refusedAt.get(msg);
  refusedAt.set(msg, now);
  if (refusedAt.size > 64) refusedAt.delete(refusedAt.keys().next().value!);
  return at !== undefined && now - at < REFUSAL_QUIET_MS && now - pressAt > 900;
}
/** The safety of the water she was last told of (null: none yet this page), and a lawless waters' notice waiting. */
let lastSafety: string | null = null;
let lawlessDue = false;
/** The lawless waters' notice (owner, 2026-10-09), once she is at sea with no window, no film and no deck fight over it. */
function lawlessFrame(): void {
  if (!lawlessDue || !state.self || state.self.dockedAt || modal || state.boardTac || document.querySelector('.film') || levelUpOpen()) return;
  // (nor under a question put to her: the risk of a boarding, a surrender's card — it waits for her, as a film does)
  if ([...document.querySelectorAll('[role="alertdialog"][aria-modal="true"]')].some((e) => e.getClientRects().length > 0)) return;
  lawlessDue = false;
  if (!lawlessHere(state)) return;
  const w = lawlessWords();
  hud.lawless(w.title, w.line);
}
/** A boarding's spoils wait for her answer (the ship lies hove to by her prize until then): their card is always up
 *  (QA 2026-10-22: after a won hex boarding the card was gone — the opening's next run had shut it — the ship lay still,
 *  the helmsman never went and «Твари на отмели» hung until `gravetide.open('boarding')`). Brought back over whatever
 *  took its place, but never over another window that must be answered (the wreck's, the mutiny's, a reward's pick:
 *  it comes after them). The server settles it by itself if she never answers (Game.ts BOARD_SETTLE_SECS). */
let boardingAskAt = 0;
function boardingCardFrame(): void {
  if (!inGame || !state.boarding || modal === 'boarding') return;
  if (modal && ANSWER.includes(modal)) return;
  openModal('boarding');
  // (and once in a while the server is asked whether it still waits: a card it already settled goes)
  const now = performance.now();
  if (now - boardingAskAt > 5000) {
    boardingAskAt = now;
    net.send({ t: 'board_result' });
  }
}
/** The sea's news held through a boarding battle (case 'toast'), told once the deck is clear. */
const heldToasts: { msg: string; kind: string }[] = [];
function filmMoments(): void {
  // Films only at the sea's own moments (owner, 2026-10-05: «ролик можно оставить при выходе и заходе в порт или на
  // острова, при успешном абордаже или проигрыше. внутри всяких вкладок … не нужно ниче делать»): into and out of a
  // port, a landing ashore, a fight won or lost — and a great one rising out of the sea (a world boss here, a zone
  // boss's first rising by the server). Nothing at a window or a tab, nothing at a battle's start, so none ever holds
  // the battle's clock. Each plays once (ui/cutscene.ts) and any tap skips it.
  if (heldToasts.length && !state.boardTac) for (const x of heldToasts.splice(0)) hud.toast(x.msg, x.kind);
  // The fight's end as the field shows it, its last blows played (owner, 2026-10-08: the battle plays at a pace to be
  // read — the film waits for the end to be seen, and the end waits under it).
  const tac = tactical.endShown();
  // The end of a fight, won or lost; a great one ashore brought down has its own (the fourteenth reel), the first time.
  if (tac?.over && !filmWas.over) {
    const won = tac.over.winner === tac.you;
    const down = won && tac.land && SHORE_DOWN[tac.land.lair] && filmDue(SHORE_DOWN[tac.land.lair]!) ? SHORE_DOWN[tac.land.lair]! : null;
    playFilm(down ?? (won ? 'cut_victory' : 'cut_defeat'));
  }
  if (tac?.over) fightOverAt = performance.now();
  filmWas.over = !!tac?.over;
  const docked = !!state.self?.dockedAt;
  // Into port: the first harbour; then a town of the twenty that has its own film (tools/art/videos.py, the ninth
  // reel), or the first of each power's (shared/src/data/factions.ts).
  if (docked && !filmWas.docked && state.self && performance.now() - fightOverAt > 15_000 && performance.now() - sunkAt > 15_000) {
    const at = state.self.dockedAt!;
    const faction = state.ports.find((p) => p.id === at)?.faction;
    const own = `cut_port_${at}`;
    playFilm(filmDue('cut_port') || !faction ? 'cut_port' : filmDue(own) ? own : `cut_port_${faction}`);
  }
  // Out of port: her hull putting to sea — the first of her list in its own film (a premium one's, docs/02 §1.A.9, the
  // tenth reel, or an ordinary one's, the seventeenth), else the launch (not on the way back from the bottom).
  if (!docked && filmWas.atQuay && state.self && performance.now() - sunkAt > 60_000) {
    const def = SHIP_CLASSES[state.self.loadout.classId];
    const own = def?.list ? `cut_${def.premium ? 'premium' : 'launch'}_${def.list}` : null;
    playFilm(own && filmDue(own) ? own : 'cut_launch');
  }
  filmWas.docked = docked || !state.self;
  filmWas.atQuay = docked && !!state.self;
  // A world boss rising: its film the first time one is near.
  const bosses = state.bosses.map((b) => b.kind).join();
  if (bosses !== filmWas.bosses) for (const b of state.bosses) if (BOSS_FILM[b.kind] && !filmWas.bosses.split(',').includes(b.kind)) playFilm(BOSS_FILM[b.kind]);
  filmWas.bosses = bosses;
  // A world boss she fought brought down (gone from the list in its last tenth, with her share in it) — a fight won:
  // its own ending the first time (the fifteenth reel).
  for (const [id, b] of bossSeen) if (!state.bosses.some((x) => x.id === id) && b.low && b.share > 0) playFilm(`cut_${b.kind}_down`);
  bossSeen.clear();
  for (const b of state.bosses) bossSeen.set(b.id, { kind: b.kind, low: b.hp <= b.hpMax * 0.1, share: b.you?.share ?? 0 });
  // The boats going ashore: the landing's own film by what the party goes for, then the first landing on each kind of
  // island (reel 19).
  const landing = state.self?.landing;
  if (landing && !filmWas.landing) {
    const film = landing.feature in LANDING_FILM ? LANDING_FILM[landing.feature] : 'cut_landing';
    const y = state.you;
    let isle: string | null = null;
    let at: number | null = null;
    if (y) for (const is of state.islands.values()) if (Math.hypot(is.x - y.x, is.y - y.y) < is.r + 900) {
      at ??= is.id;
      if (filmDue(`cut_isle_${is.biome}`)) isle = `cut_isle_${is.biome}`;
    }
    // One island, one film (owner, 2026-10-23: a lookout's landing, then the same island's scene or a quest's landing,
    // played two different films): an island whose landing had its film this session has no other.
    if (at === null || !filmIsles.has(at)) {
      if (at !== null) filmIsles.add(at);
      if (film && filmDue(film)) playFilm(film);
      else if (isle) playFilm(isle);
    }
  }
  filmWas.landing = !!landing || !state.self;
}
void loadFilms();
// A film never opens over a window she is at or a question put to her (owner, 2026-10-05: one came up over the guild's
// founding form and took her typing): it waits for her (ui/cutscene.ts). The windows of the moment itself are no bar —
// the harbour opening as she docks, a boarding's account, the shipwreck's.
const FILM_OVER = new Set<Modal>(['port', 'boarding', 'sunk']);
// (a question up is one on screen: the «turn the phone» lock stays in the page, unseen, in landscape)
setFilmGate(() => (modal !== null && !FILM_OVER.has(modal)) || [...document.querySelectorAll('[role="alertdialog"][aria-modal="true"]')].some((e) => e.getClientRects().length > 0));

// Links back from letters and OAuth: #token=… (signed in), #reset=… (new password), #verified, #auth-error=….
{
  const hash = new URLSearchParams(location.hash.slice(1));
  const tok = hash.get('token');
  if (tok) net.adopt(tok);
  if (hash.has('verified')) $('login-error').textContent = L('verified');
  if (hash.has('verify-failed')) $('login-error').textContent = L('verifyFailed');
  if (hash.get('auth-error')) $('login-error').textContent = serverText(hash.get('auth-error')!);
  // back from VK ID: a link made, a refusal, the notices' hint (docs/36 §8)
  vkIdReturn(hash, () => net.live || (!tok && $('screen-login').getClientRects().length > 0));
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

// docs/23 item 88: a captain who has been here before goes back to sea in two taps from this screen — «Продолжить»
// with her name (her token is kept: no name to type), then «Поднять паруса» in the harbour (or none, if she was left
// at sea). The page connects by itself as it opens; the button is there while it does, and after the session was taken
// over elsewhere (no reconnecting by itself then).
{
  const btn = $('login-continue') as HTMLButtonElement;
  const name = localStorage.getItem(CAPTAIN_KEY);
  if (net.token && name) {
    btn.textContent = L('continueAs', { name });
    btn.classList.remove('hidden');
  }
  btn.onclick = () => {
    audio.unlock();
    btn.disabled = true;
    setTimeout(() => (btn.disabled = false), 4000);
    // The page connects by itself as it opens: a tap while that socket is still opening must not open a second (the
    // server dropped one of the two — the title came back over a live game, or every input went to the dropped one).
    if (!net.live) net.connect();
  };
}
// Inside VK (docs/36) or Telegram (or on its host, docs/27) the Mini App signs in by itself; else the page's own start.
if (!vkStart(net) && !tgStart(net)) {
  if (net.token) net.connect();
  else $('login-name').focus();
}

/** The forms' guard on every letter-sending ask (owner, 2026-10-11): the honeypot (filled only by bots), the time since
 *  the page came (a bot answers at once) and her tongue for the letter. */
const formGuard = (form: string): Record<string, string> => ({
  website: (document.querySelector<HTMLInputElement>(`#${form} input.hp`)?.value ?? ''),
  t: String(Math.round(performance.now())),
  lang: lang(),
});
async function authPost(path: string, body: Record<string, string>): Promise<{ token?: string; error?: string; ok?: boolean }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as { token?: string; error?: string; ok?: boolean };
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
  await authPost('/auth/forgot', { email, ...formGuard('email-form') });
  $('login-error').textContent = L('letterSent');
};
($('email-form') as HTMLFormElement).onsubmit = async (e) => {
  e.preventDefault();
  const email = ($('login-email') as HTMLInputElement).value.trim();
  const password = ($('login-password') as HTMLInputElement).value;
  const r = registering
    ? await authPost('/auth/register', { email, password, name: ($('register-name') as HTMLInputElement).value.trim(), ...formGuard('email-form') })
    : await authPost('/auth/login', { email, password });
  if (!r.token) {
    $('login-error').textContent = (r.error ? serverText(r.error) : L('signInFailed'));
    return;
  }
  net.adopt(r.token);
  net.connect();
};
// The feedback form (owner, 2026-10-11): a letter to the support desk; the answer comes to her address.
$('support-btn').onclick = () => {
  $('email-form').classList.add('hidden');
  $('support-form').classList.remove('hidden');
  ($('support-email') as HTMLInputElement).value ||= ($('login-email') as HTMLInputElement).value.trim();
};
$('support-back').onclick = () => {
  $('support-form').classList.add('hidden');
  $('email-form').classList.remove('hidden');
};
($('support-form') as HTMLFormElement).onsubmit = async (e) => {
  e.preventDefault();
  const email = ($('support-email') as HTMLInputElement).value.trim();
  const message = ($('support-message') as HTMLTextAreaElement).value.trim();
  if (!email) {
    $('login-error').textContent = L('emailFirst');
    return;
  }
  const r = await authPost('/auth/support', { email, message, token: localStorage.getItem('gravetide.token') ?? '', ...formGuard('support-form') });
  if (r.ok) {
    ($('support-message') as HTMLTextAreaElement).value = '';
    $('support-back').click();
    $('login-error').textContent = L('supportSent');
  } else $('login-error').textContent = r.error ? serverText(r.error) : L('noAnswer');
};
// (inside VK no sign-in leads out of it: docs/36)
if (!inVk()) fetch('/auth/providers').then((r) => r.json()).then((d: { providers: { id: string; name: string }[] }) => {
  $('oauth-buttons').innerHTML = d.providers.map((p) => `<a class="btn btn-small" href="/auth/oauth/${p.id}">${esc(L('signInWith', { name: p.name }))}</a>`).join('');
}).catch(() => undefined);
tgLoginButton(net, onLang);
vkIdLoginButton(onLang, () => (net.token ? localStorage.getItem(CAPTAIN_KEY) : null));
tgInvoices(net, (msg, kind) => hud.toast(msg, kind));
webCheckouts(net, (msg, kind) => hud.toast(msg, kind), stashPending); // the browser's top-up through YooKassa (owner, 2026-10-21)

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
// A tap on «Отчалить гостем» while this script was still on its way (index.html kept it): answered now (QA 2026-10-09:
// the first tap on a fresh page, 0.8 s in, did nothing — the script came in seconds later).
{
  const early = globalThis as { __gtReady?: boolean; __earlySubmit?: string };
  early.__gtReady = true;
  bootMark('ready');
  if (early.__earlySubmit === 'login' && !net.live) {
    delete early.__earlySubmit;
    ($('login-form') as HTMLFormElement).requestSubmit();
  }
}

net.onStatus = (ok) => {
  $('connection').classList.toggle('hidden', ok || !inGame);
  bootMark(ok ? 'ws open' : 'ws closed');
};
net.on(onMessage);

/** The first look at the sea had its loading screen. */
let startLoaded = false;

/** A battle's loading screen waits for its opening frame's pictures only (the sea, the decks, each stack's idle figure,
 *  the faces) and at most BATTLE_SETTLE_MS for what else the field drew; the poses, the missiles, the bursts and the
 *  book stream in behind while it plays, its stand-ins drawn till then. The whole list waited for (BATTLE_LOAD_MS was
 *  7 s) timed out in one battle in five on a Windows desk (tel_load, 2026-10). */
const BATTLE_LOAD_MS = 6000;
const BATTLE_SETTLE_MS = 1200;
function battleLoad(v: Parameters<typeof tacArtSplit>[0]): void {
  const { first, later } = tacArtSplit(v);
  void beginLoad('battle', BATTLE_LOAD_MS).need(first).settle(BATTLE_SETTLE_MS).done().then(() => {
    void ensureAssets(later, { prio: 1 });
  });
}
function onMessage(m: ServerMsg): void {
  // docs/36: a word of the campaign before its words are in waits for them (a moment) rather than show English
  if (lang() === 'ru' && !campaignWordsReady() && (m.t === 'toast' || m.t === 'quest_done' || m.t === 'campaign_new') && /[A-Za-z]/.test(serverText(m.t === 'toast' ? m.msg : m.name))) {
    void loadCampaignWords().then(() => onMessage(m));
    return;
  }
  const hadTac = !!state.boardTac;
  state.apply(m);
  // a boarding opens: its loading screen until the decks, the figures and their poses are in (warmed while she closed in)
  if (m.t === 'board_tac' && m.view && !hadTac) {
    battleLoad(m.view);
    // …and a window she had open (the claim's terms, the journal) shut: it stood over the battle and her turns ran out
    // unseen under it (QA 2026-10-22: boarded with «Занять бесплатно» up, the fight lost by the clock)
    if (modal && !ANSWER.includes(modal)) closeModal();
  }
  // Owner, 2026-10-16 («Повтор»): a kept fight played again over the field.
  if (m.t === 'tac_replay' && m.base) battleLoad(m.base);
  if (m.t === 'tac_replay') tactical.onReplay(m);
  if (inGame) firstTips.offer(tipForMsg(m));
  switch (m.t) {
    case 'pursuit':
      // docs/23 item 33: the wheel back, and why when it is news (a mark lost, slipped away, sunk).
      if (!m.on && (m.why === 'lost' || m.why === 'slipped' || m.why === 'sunk')) hud.toast(LSF(`why.${m.why}`), m.why === 'sunk' ? 'good' : 'info');
      // «Огонь» with no mark (owner, 2026-10-22): the foe the helmsman took is her mark — its ring on it, its line on top.
      if (m.on && m.target !== undefined && (targetId === null || !targetPinned)) pinTarget(m.target);
      break;
    case 'board_risk':
      void askRisk(m.risk);
      break;
    case 'berth_ask':
      // forum 2026-10-30: the new hull has no hammocks for all her men — asked, then sent again with `force`
      void ask(menAskText(m.men), LB('menYes')).then((ok) => ok && net.send({ ...m.again, force: true }));
      break;
    case 'route':
      onRoute(m);
      break;
    case 'allstop':
      allStopHere();
      break;
    case 'voyage':
      // Owner, 2026-10-28: the small word on entering a long passage, and on coming out of it at the mark.
      // (owner, 2026-10-30, ferry.ts: a hub's «Переход» says where to)
      {
        const to = m.ferry ? state.ports.find((p) => p.id === m.ferry) : undefined;
        const name = to ? placeName(to.name) : '';
        // (a ferry's word a moment later: the harbour window closing in the same breath took its toast strip with it)
        if (m.on && !voyageSaid && to) setTimeout(() => hud.toast(LF('on', { to: name, n: VOYAGE_MUL }), 'voyage'), 700);
        else if (m.on && !voyageSaid) hud.toast(LP('on', { n: VOYAGE_MUL }), 'voyage');
        else if (!m.on && m.why === 'arrived') hud.toast(to ? LF('done', { to: name }) : LP('done'), 'voyage');
      }
      voyageSaid = m.on;
      break;
    case 'autosail': {
      // docs/16 #36: the helmsman has the wheel, or has given it back and why (a run to a goal says its own course).
      // (2026-10-19: a course taken on a run to a goal fell through to the «given back» branch — «Автоплавание выключено.»
      // flashed off the quay while the course went on)
      if (m.on) {
        if (!state.route && !autosailQuiet(m)) hud.toast(EL('as_on'), 'info');
      } else {
        helmStop = { why: m.why ?? 'off', at: performance.now() }; // ux2: the run to a goal reads why
        const w = autosailStopText(m.why);
        // (stopped by an action, a battle or a card — allStopHere: his «штурвал ваш» is no news then)
        if (performance.now() - allStopAt > 1500) hud.toast(w.text, w.kind);
        if (m.why === 'arrived') setMark(null);
        if (w.kind === 'bad') audio.bell();
      }
      break;
    }
    case 'err':
      if (m.msg === 'auth_required') {
        net.forget();
        $('login-continue').classList.add('hidden'); // her token is gone: the name is typed again
        $('screen-login').classList.remove('hidden');
      } else if (m.msg === 'Logged in elsewhere.') {
        // Taken over by another tab or phone: the page does not reconnect by itself, so the title screen comes back
        // with «Продолжить» — one tap takes the captain back here (docs/23 item 88; before, a «connection lost» band).
        $('screen-login').classList.remove('hidden');
        $('login-error').textContent = serverText(m.msg);
        const btn = $('login-continue') as HTMLButtonElement;
        if (net.token && localStorage.getItem(CAPTAIN_KEY)) {
          btn.textContent = L('continueAs', { name: localStorage.getItem(CAPTAIN_KEY)! });
          btn.classList.remove('hidden');
        }
      } else if (!inGame && m.msg === 'That captain is sold for doubloons') {
        // (a premium captain refused at the choice: the screen back, the reason under its button)
        $('screen-captain').classList.remove('hidden');
        const why = document.getElementById('captain-why');
        if (why) why.textContent = serverText(m.msg);
      } else if (!inGame) $('login-error').textContent = serverText(m.msg);
      // The glass asks by itself every few seconds (askGlass): its «too far» is no refusal of hers to tell.
      else if (GLASS_QUIET.has(m.msg)) break;
      // A phone's small refusals (reloading, not on the beam) flash the button and buzz instead (docs/23 item 29).
      else if (touch.enabled && ((pettyOf(m.msg) === 'special' && seaAbil.flash()) || seaHud.petty(m.msg))) break;
      else hud.toast(serverText(m.msg), 'bad');
      break;
    case 'welcome':
      bootMark(m.hasCaptain ? 'welcome' : 'welcome: no captain');
      $('screen-login').classList.add('hidden');
      try { localStorage.setItem(CAPTAIN_KEY, m.name); } catch { /* no storage */ }
      $('login-error').textContent = '';
      if (!m.hasCaptain) showCaptainSelect((captain, shipName, tutorial) => {
        prologuePending = tutorial;
        net.send({ t: 'create_captain', captain, shipName, tutorial });
      }, (x) => net.send(x));
      break;
    case 'init':
      bootMark('init');
      inGame = true;
      // The old round-by-round deck fight, for a captain who asked for it in the options (docs/16 P4).
      net.send({ t: 'board_pref', classic: settings().classicBoarding, deploy: settings().tacDeploy });
      sendGunnery(); // docs/23 items 35, 42, 46
      audio.ownId = m.entityId;
      $('screen-captain').classList.add('hidden');
      hud.show(true);
      // the first look at the sea: a loading screen until what the HUD and the sea draw is in (ui/loader.ts), then
      // the rest of the pictures slowly into the cache (assets.ts warmAll)
      if (!startLoaded) {
        startLoaded = true;
        // (the size is looked at again first: an init that came while the phone was upright or turning laid out a size
        // the screen no longer has)
        settleViewport('init');
        requestAnimationFrame(() => beginLoad('start', 12000).imgs($('hud')).imgs(document.getElementById('touch')).settle().done().then(() => {
          bootMark('start loaded');
          telemetryBoot();
          startWarm();
        }));
      }
      if (state.you === null && m.self.dockedAt) openModal('port');
      if (prologuePending) {
        // The First Watch teaches by doing: no handbook up front, the prologue, then the quay.
        prologuePending = false;
        localStorage.setItem('gravetide.helpSeen', '1');
        closeModal();
        // (one line of words, no film first: the owner's films are the six moments of docs §3 — and the film and the
        // words together held a newcomer 15–20 s before the first thing to press; retention, 2026-10-25)
        playPrologue(() => undefined);
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
      if (m.view && modal !== 'port') {
        audio.bell();
        // the harbour's painting full-width on arrival, once a port a session (ui/portsplash.ts)
        const at = state.ports.find((p) => p.id === m.view!.portId);
        if (at) portSplash(at, placeName(at.name), `${FACTIONS[at.faction].name} · ${REGIONS[at.region].name}`);
      }
      // Never steal focus from another open screen (handbook, boarding, shipwreck); they return to port on close.
      if (m.view && modal === null && !isleScene.isOpen) openModal('port');
      else if (!m.view && modal === 'port') closeModal();
      else if (modal === 'port') refreshModal();
      break;
    case 'self':
    case 'self_patch':
      runTestBattle();
      noteNewQuests(); // ux2: a quest just taken is followed, its mark on the sea
      noteHearsay(state.self); // a whisper just bought becomes her mark (docs/16 #14)
      arenaMoments(); // docs/19 E14: the Colosseum's draft opens its tab, its bout closes the window
      if (isleScene.isOpen && selfKeyFor('base') !== isleKey) {
        // her silver over the island screen (only when it changed: a redraw on every beat would lose taps)
        isleKey = selfKeyFor('base');
        isleScene.update(state);
      }
      if (state.self?.company.mutiny && modal !== 'mutiny') openModal('mutiny');
      else if (!state.self?.company.mutiny && modal === 'mutiny') closeModal();
      else if (modal === 'company' || modal === 'base' || modal === 'gear' || modal === 'hero' || modal === 'throne' || modal === 'research') {
        // The Company and island windows redraw only when what they show of her changed (a redraw every second on
        // the private state's beat lost taps).
        const key = selfKeyFor(modal);
        if (key !== lastSelfKey) {
          lastSelfKey = key;
          refreshModal();
        }
      } else if (modal === 'crew' && armyEditing()) {
        // (a stack picked, a split's slider or a drag under way: the redraw waits — owner, 2026-10-28)
      } else if (modal === 'port' || modal === 'talents' || modal === 'ship' || modal === 'crew' || modal === 'mutiny' || modal === 'barter') refreshModal();
      break;
    case 'mutiny':
      if (m.mutineers > 0) {
        audio.bell();
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
      lairChest.open(m.view);
      break;
    case 'film':
      // The server's own moments: a zone boss's first rising in her sea (a sea event, not a window: owner, 2026-10-05).
      if (m.id.startsWith('cut_zboss_')) playFilm(m.id);
      break;
    case 'ceasefire':
      ceasefireCard.show(m.view); // the talks: who asks what, who agreed (owner, 2026-10-18)
      break;
    case 'seahire':
      state.hire = m.view; // her hired guards: the chip, the map (owner, 2026-10-25)
      // her guard is no mark of hers: the reticle and the fire key go back to the sea's
      if (targetId !== null && m.view.escorts.some((e) => e.id === targetId)) {
        targetId = null;
        targetPinned = false;
      }
      break;
    case 'seahire_offer':
      hireCard.show(m.offer);
      break;
    case 'surrender_offer':
      // A ship strikes her colours to you (docs/16 #3): the choice card over the sea.
      surrenderCard.open(m.offer);
      break;
    case 'board_offer':
      // docs/25 item 64: a mate of her group boards within reach — she may come aboard.
      boardOffer.open(m.offer);
      break;
    case 'boarding':
      if (m.result) openModal('boarding');
      else if (modal === 'boarding') closeModal();
      break;
    // docs/35: moored at a floating waystation (its window), cast off (shut); her fallen and their price.
    case 'way':
      if (m.view && modal !== 'way' && modal !== 'recruit') openModal('way');
      else if (!m.view && modal === 'way') closeModal();
      else if (!m.view && modal === 'recruit' && recruitFrom === 'way') closeModal();
      else if (modal === 'way') refreshModal();
      break;
    case 'fallen':
      if (modal === 'way') refreshModal();
      else if (modal === 'boarding') mountFallen($('modal-panel'), state, (x) => net.send(x));
      else if (modal === 'port' && portScreen.tab === 'army') refreshModal();
      {
        const tb = document.querySelector<HTMLElement>('#board-tac .tb-banner.tb-end:not(.hidden)');
        if (tb) mountFallen(tb, state, (x) => net.send(x));
      }
      break;
    case 'sunk_self':
      lastSunk = { lost: m.lost, port: placeName(state.ports.find((p) => p.id === m.respawnPort)?.name ?? '') || L('port'), towed: !!m.towed, scuttled: !!m.scuttled, ...(m.boarded ? { boarded: { by: sv(m.boarded.by), silver: m.boarded.silver, repelled: !!m.boarded.repelled } } : {}) };
      openModal('sunk');
      sunkAt = performance.now();
      // A boarding lost has the defeat's film (the battle's end has it already, once). A ship gone down to the guns has
      // none (owner, 2026-10-09: films only into and out of port, ashore, and a boarding won or lost).
      if (m.boarded) playFilm('cut_defeat', undefined, { over: true });
      break;
    case 'quest_offer':
      // An island's people offer their job on the beach, or a groupmate shares theirs: the giver's window, then the
      // captain's answer.
      void giverDialog(m.offer, m.from).then((pay) => net.send({ t: 'quest', action: pay ? 'accept' : 'decline', id: m.offer.id, ...(pay && pay !== 'silver' ? { pay } : {}) }));
      break;
    case 'passage':
      // a ship of the story took her to the chapter's far place (owner, 2026-10-23): one card — where, and why — and
      // «Плыть» for the next step at once, her head already to it
      hud.banner(L('passageTitle'), L('passageLine', { to: placeName(serverText(m.to)), ch: m.ch }));
      if (m.quest) resumeKey = `q:${m.quest}`;
      break;
    case 'campaign_new':
      // the story begins after the opening (owner, 2026-10-19: «и далее уже основная кампания начинается с каким-то
      // лором»): its prologue, once, before the first quest of the story
      if (m.ch === 1 && m.k === STORY_FROM && !m.choice) campaignLore('prologue', () => !!state.boardTac || !!state.boardFight, () => { if (modal && !ANSWER.includes(modal)) closeModal(); });
      // docs/36: the campaign's next quest came by itself (or a fork's ways) — a toast and a card, held while she fights
      // a chapter's first quest: its opener (painting, name, words) once (the first chapter's after the prologue)
      if (!m.choice && ((m.ch > 1 && m.k === 0) || (m.ch === 1 && m.k === STORY_FROM))) chapterOpener(m.ch, () => !!state.boardTac || !!state.boardFight);
      campaignNews(m, {
        busy: () => !!state.boardTac,
        toast: (text) => hud.toast(text, 'gold'),
        card: (title, text) => hud.banner(title, text),
        choose: (id) => net.send({ t: 'quest', action: 'accept', id }),
      });
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
      // The herald of a job paid.
      // docs/36: a campaign quest — the chapter and its place in it on the herald, its completion line as the crew's word
      hud.banner(m.campaign ? L('campaignDone', { ch: m.campaign.ch, n: m.campaign.k + 1, of: m.campaign.size }) : L('questDone'), `${serverText(m.name)} — ${parts.join(' · ')}`);
      if (m.line) hud.toast(serverText(m.line), 'info');
      audio.bell();
      audio.coins();
      // the campaign's last quest: its epilogue («крутой финал», owner 2026-10-19)
      if (m.campaign && m.campaign.at >= m.campaign.total) campaignLore('epilogue', false);
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
    case 'portInfo':
      portCardData(state, m.view);
      break;
    case 'wgoals':
      // The sea's goals of the week (docs/16 #32).
      if (modal === 'journal') refreshModal();
      break;
    case 'buyfail':
      // A purchase refused for its one real reason (owner, 2026-10-21): the advisor — what to sell to make room, where it
      // is sold, how many there are — instead of a dead-end toast (the toast that follows with the same words keeps quiet).
      if (adviceFor(m.fail) && state.self?.dockedAt) {
        adviceToast = { msg: m.msg, at: performance.now() };
        showAdvice(m.fail, {
          state,
          send: (x) => net.send(x),
          market: () => {
            if (modal !== 'port') openModal('port');
            portScreen.tab = 'market';
            refreshModal();
          },
          sailTo: (port) => {
            if (modal) closeModal();
            startGoal(`p:${port}`);
          },
        });
      }
      break;
    case 'toast':
      // The glass's own «too far» (askGlass asks by itself every few seconds; the server's refusals come as toasts, so
      // the filter on 'err' alone let «Too far for the glass ×5» through at every broadside).
      if (GLASS_QUIET.has(m.msg)) break;
      // A refusal the buy advice already shows in its own window.
      if (adviceToast && adviceToast.msg === m.msg && performance.now() - adviceToast.at < 3000) {
        adviceToast = null;
        break;
      }
      // The harbour turned her away for her speed: take in sail and try again when she slows.
      // Any other refusal of the harbour (a fight, the law): the request is not sent again every 1.5 s for 25 s.
      if (pendingDock && m.kind === 'bad' && m.msg !== 'Take in sail before entering harbour' && performance.now() - dockSentAt < 1500) pendingDock = null;
      if (m.msg === 'Take in sail before entering harbour') {
        requestDock(pendingDock?.bribe ?? false, true);
        break;
      }
      // A phone's small refusals (reloading, not on the beam) flash the button and buzz instead (docs/23 item 29): the
      // server's refusals come as toasts of kind 'bad' (Game.ts err()), so the check on 'err' alone never saw them.
      if (m.kind === 'bad' && touch.enabled && ((pettyOf(m.msg) === 'special' && seaAbil.flash()) || seaHud.petty(m.msg))) break;
      // A refusal is told once (owner, 2026-10-07: «идут ошибки вечные»): the same words again soon after, not asked for by
      // a press of hers just now, are not shown again (the band counted them up ×N for as long as they came).
      if (m.kind === 'bad' && refusalAgain(m.msg)) break;
      // World news goes to the feed (owner, 2026-09-29: the sea's news in a corner), the rest to the toasts.
      if (m.msg.startsWith('WORLD: ')) {
        // docs/30: a captain under 15 sees on the screen only her own sea's news, and the far seas' once in three minutes
        // (a boss «in Dead Man's Expanse», a legend «in the Ashen Isles» came every half minute to a novice of the Black
        // Coast); all of it stays in the chat's world tab.
        if (worldFeedShown(m.msg, state.region, state.self?.level ?? 1, performance.now())) hud.feed(serverText(m.msg));
        hud.chatPanel.system(serverText(m.msg)); // docs/28: the sea's news in the chat's world tab too
      }
      // While her men fight on a deck the sea's news (a fever, a tip) waits for the deck to clear. A refusal and a win
      // are told at once, in the battle's top band (docs/23 item 93: «Не ваш ход», a cut that failed, a ransom she cannot
      // pay — every refusal of the battle comes as a 'bad' toast, and was held to the end of it).
      else if (state.boardTac && m.kind !== 'bad' && m.kind !== 'good') heldToasts.push({ msg: serverText(m.msg), kind: m.kind });
      else hud.toast(serverText(m.msg), m.kind);
      if (m.kind === 'gold') audio.coins();
      if (/a pirate is coming for you/.test(m.msg)) audio.bell(); // the lookout's alarm
      // the island's work finished (base.ts finish): the hammer and the chime
      if (m.kind === 'good' && (/ is finished\.$/.test(m.msg) || / on .+: level \d+\.$/.test(m.msg))) cue('built');
      // the sea's news shown in the feed: a soft two-tone
      if (m.msg.startsWith('WORLD: ')) cue('notice');
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
    case 'chat_hist': // docs/28: the history on coming aboard, or one conversation whole
      hud.chatPanel.history(m);
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
    case 'base': {
      if (modal === 'base') refreshModal();
      if (isleScene.isOpen) isleScene.update(state);
      // «Ускорить» on a work's card: how much is left of it now (owner, 2026-10-29)
      const said = m.view ? boostReport(jobEnds(m.view), m.view.now) : null;
      if (said) hud.toast(said, 'good');
      break;
    }
    case 'isleMove': // docs/29: claiming another island is a move — her leave first
      askMove(m.view, (x) => net.send(x));
      break;
    case 'supply': // docs/18 #32
      if (modal === 'base' && baseWindow.tab === 'supply') refreshModal();
      if (isleScene.isOpen) isleScene.update(state);
      break;
    case 'scouts': // the island's scouts (owner, 2026-10-17)
      if (modal === 'base' && baseWindow.tab === 'yard') refreshModal();
      if (isleScene.isOpen && modal !== 'map') isleScene.update(state);
      if (modal === 'map') worldMap.draw(state);
      break;
    case 'dwell':
      if (modal === 'recruit' && !armyEditing()) refreshModal(); // (a stack picked or a split's slider: owner, 2026-10-29)
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
    case 'captain_shop': // the premium captains on the choice screen (owner, 2026-10-19)
      captainShopHeard(m);
      break;
    case 'pvprank': // her PvP page (owner, 2026-10-30)
      if (modal === 'hero') refreshModal();
      break;
    case 'cos': // docs/32 §12: her wardrobe — the shop's tab, her frame on the HUD
      if (modal === 'shop') refreshModal();
      hud.redrawCaptain();
      break;
    case 'premium_exchange': // the exchange's answer (owner, 2026-10-30)
      premiumWindow.exchangeHeard(m);
      if (modal === 'shop') refreshModal();
      break;
    case 'premium':
    case 'doubloons':
      if (modal === 'shop') refreshModal();
      // a premium purchase heard (the balance down: the doubloons spent)
      if (m.t === 'doubloons') {
        captainBalance(m.n);
        if (lastDoubloons >= 0 && m.n < lastDoubloons) cue('buy');
        lastDoubloons = m.n;
        // the top-up came in: the purchase it was for goes now (price.ts topUpThenBuy)
        heardDoubloons(m.n, (x) => net.send(x), (msg, kind) => hud.toast(msg, kind));
      }
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
      break;
    case 'trophy_hall':
      void tell(L('trophyHall', { owner: m.view.owner, flag: m.view.flag, skull: m.view.skull, fish: m.view.fish }));
      break;
    case 'handin':
      // a job's goods or letter handed over at the spot (a hamlet, a fishers' cove, a waystation): its scene
      if (!state.boardTac) encounterCard.scene([DROP_CARD[m.art]], dropWord('drop.t'), dropWord(`drop.${m.art}` as const));
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
      if (m.t === 'party') noteInvites();
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
        if (e.k === 'emote') renderer.addEmote(e.ship, e.e); // docs/32 §12: over her ship for ~3 s
        // Rumble: a hit on our hull a short knock in both motors; something under the keel a long low hum.
        if (e.k === 'hit' && e.ship === state.entityId && e.dmg > 0) rumble(activePad(), 0.5, 0.5, 120);
        // The phone in the hand (docs/23 item 84): her broadside, a ball on her mark, one on her hull, the grapples.
        if (e.k === 'volley' && e.ship === state.entityId) buzz('fire');
        else if (e.k === 'hit' && e.dmg > 0 && e.ship === state.entityId) buzz('hurt');
        else if (e.k === 'hit' && e.dmg > 0 && (e.ship === state.pursuit?.target || e.ship === targetId)) buzz('hit');
        else if (e.k === 'board_start' && (e.a === state.entityId || e.b === state.entityId)) buzz('board');
        else if (e.k === 'fx' && (e.fx === 'deep_call' || e.fx === 'rise' || e.fx === 'maw') && state.ownDisplay && dist(e.x, e.y, state.ownDisplay.x, state.ownDisplay.y) < 600) rumble(activePad(), 0.7, 0, 1200);
        audio.onEvent(e);
        if (e.k === 'region') {
          const r = REGIONS[e.region];
          const waters = L(r.safety === 'safe' ? 'safeWaters' : r.safety === 'contested' ? 'contestedWaters' : 'lawlessWaters');
          // The sea's name (owner, 2026-10-07: «перегруз сверху графический не нужен»): a slim line in the top band that
          // fades on its own; the older HUD keeps its herald in the toasts' band.
          hud.seaName(r.name, waters, `${waters} — ${r.mood}`);
          // Into lawless water from other water, or in the game there (owner, 2026-10-09: «при входе в них игроку должно
          // быть сказано об этом»): the notice, once she is at sea with no window over it (lawlessFrame).
          if (r.safety === 'lawless' && lastSafety !== 'lawless') lawlessDue = true;
          lastSafety = r.safety;
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
  if (isleScene.isOpen && modal !== 'base') isleScene.tick(state);
  if (modal === 'puzzle' && (state.puzzle?.digging || state.puzzle?.wait)) refreshModal(); // the dig's seconds (docs/17 H4)
}, 1000);

/** Windows that must be answered: no swipe takes them away (docs/23 phase 6). */
const ANSWER: Modal[] = ['boarding', 'sunk', 'mutiny', 'choice'];
/** When the window came up: the tap that opened it must not land on its scrim and close it again. */
let modalAt = 0;
/** A window closing back into the harbour (closeModal): the harbour keeps its place. */
let portReturn = false;

/** A window closing eases out (2026-10-16): 140 ms of fading while nothing under it waits — the game's state has it
 *  shut at once, the element only lingers, deaf to taps; a window opened meanwhile cancels it. None with less motion. */
let modalOutTimer = 0;
function hideModalEl(): void {
  const el = $('modal');
  clearTimeout(modalOutTimer);
  const calm = document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || el.classList.contains('hidden')) {
    el.classList.remove('w-out');
    el.classList.add('hidden');
    return;
  }
  el.classList.add('w-out');
  modalOutTimer = window.setTimeout(() => {
    el.classList.remove('w-out');
    if (modal === null) el.classList.add('hidden');
  }, 140);
}

function openModal(m: Modal): void {
  if (m !== 'look') resetLookDraft();
  // The gear is the captain window's third tab (docs/23 item 70).
  if (m === 'gear') {
    heroWindow.open('gear');
    m = 'hero';
  }
  if (m === null) closeLevelUp();
  const from = modal;
  modal = m;
  if (m === null) hideModalEl();
  else {
    clearTimeout(modalOutTimer);
    $('modal').classList.remove('w-out', 'hidden');
  }
  // The harbour opened from the sea's HUD starts on its market — the one-tap bar (docs/23 item 66); a window closed
  // back into it keeps the place it was on.
  if (m === 'port' && from === null && !portReturn) portScreen.tab = 'market';
  portReturn = false;
  // A window comes up from the bottom edge as a sheet (docs/23 phase 6); a new window over an open one only swaps.
  if (m !== null && from === null) {
    modalAt = performance.now();
    // A swipe that closed the last one left its drag on the panel (an inline translateY beats the slide's class: the
    // harbour reopened 140 px low, its «В море» off the screen — docs/23 item 94).
    $('modal-panel').style.transform = '';
    // Start below the edge, let the style land (a forced layout, not a frame: a busy frame came a second late),
    // then slide up.
    $('modal').classList.add('w-from');
    void $('modal-panel').offsetHeight;
    $('modal').classList.remove('w-from');
  }
  if (m === null) releaseModalToasts();
  refreshModal();
}

/** docs/19 E14: a draft of the Colosseum begun (a captain matched, a legend come to spar) opens the Throne at its tab;
 *  the bout beginning closes it, so the sand is seen. */
let arenaDraftWas = false;
function arenaMoments(): void {
  const d = state.self?.glory?.arena?.draft;
  const drafting = !!d && d.stage !== 'fight';
  if (drafting && !arenaDraftWas && modal !== 'throne' && modal !== 'mutiny' && !state.boardTac && !state.boardFight) openThrone('arena');
  if (d?.stage === 'fight' && modal === 'throne') closeModal();
  arenaDraftWas = drafting;
}

function closeModal(): void {
  const was = modal;
  if (was === 'map') worldMap.scoutPick = null; // a scout's pick left untaken
  // The welcome gift is never lost by closing its window (docs/16 #30).
  if (was === 'away' && state.away?.gift) {
    net.send({ t: 'away', action: 'take' });
    state.away.gift = null;
  }
  modal = null;
  hideModalEl();
  document.querySelectorAll('.gear-tip').forEach((e) => e.remove());
  releaseModalToasts();
  queueMicrotask(() => {
    if (!modal) announceInvites();
  });
  // The recruit window opened from the island's town goes back to it (docs/17 H3).
  if (was === 'recruit' && recruitFrom === 'isle') return openBase();
  // docs/35: the hire at a waystation goes back to its window; the waystation's window shut is «В море».
  if (was === 'recruit' && recruitFrom === 'way' && state.wayView) return openModal('way');
  if (was === 'way' && state.wayView) {
    net.send({ t: 'way', action: 'leave' });
    state.wayView = null;
  }
  // A window over the island screen closes back into it (its card drawn again: the window shared its selection).
  if (isleScene.isOpen) {
    isleScene.update(state);
    return;
  }
  // While docked, closing another screen returns to the harbour (Esc on the harbour itself hides it; P reopens).
  if (was !== 'port' && state.portView) {
    portReturn = true;
    openModal('port');
  }
}

/** Where every scrolled box of a window stands, so a refresh from the server does not throw the reader back
 * to the top (the same window and tab only: a new tab starts at its top). */
function scrollMarks(root: HTMLElement): { view: string; at: Map<string, [number, number]> } {
  // The phase 6 windows mark their place on a rail tab or a chip (data-ptab, -jtab, -ctab, -cchip…), not `.tab.active`:
  // with only that, every place of a window shared one key and a new place opened at the last one's scroll.
  const tabs = [...root.querySelectorAll<HTMLElement>('.tab.active, .w-tab.on, .w-chip.on')].map((e) => Object.entries(e.dataset).find(([k]) => k !== 'hint')?.join('=') ?? '').join(',');
  const view = `${modal}|${tabs}|${root.querySelector<HTMLElement>('.rose-node.active')?.dataset.view ?? ''}`;
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
  if (m === 'hero') return JSON.stringify([m, lang(), s.name, s.level, s.dockedAt, s.gold, s.hero, s.captainGear, s.glory?.open, s.stash, s.loadout, s.cargo, s.facets, s.talents, s.glory?.rank]); // (docs/25: the «Умения» page's facets, talents, mastery)
  if (m === 'research') return JSON.stringify([m, lang(), s.loadout.classId, s.berths.map((b) => b.classId), s.research && { done: s.research.done, free: Math.floor(s.research.free / 50), xp: Object.values(s.research.xp).map((x) => Math.floor((x ?? 0) / 50)) }]);
  if (m === 'throne') return JSON.stringify([m, lang(), s.name, s.level, s.dockedAt, s.gold, s.glory && { ...s.glory, xp: Math.floor(s.glory.xp / Math.max(1, s.glory.need) * 200), trials: s.glory.trials.map((v) => ({ ...v, wait: Math.ceil((v.wait ?? 0) / 60) })) },
    // docs/19 E4–E8, E15: the citadels' and the contracts' tabs; their distances the client reckons from her own place
    // (docs/19 E19), redrawn as she moves half a kilometre (a ship under sail does not redraw them each step).
    s.cit, s.adm, state.ownDisplay && [Math.round(state.ownDisplay.x / 500), Math.round(state.ownDisplay.y / 500)]]);
  return m === 'company' ? JSON.stringify([m, lang(), s.name, s.dockedAt, s.berths, s.pvp, s.maps, s.company, s.cargo, s.builds, s.gold]) : JSON.stringify([m, lang(), s.gold, s.cargo, s.dockedAt, s.homeIsle]);
}

/** The open window drawn anew — held while a finger is down on it (ux2, «журнал иногда подзаедает и не переключает
 *  вкладки»: a redraw between the finger's down and lift took the tab from under it, and the tap did nothing). */
function refreshModal(): void {
  holdRedraw(drawModal);
}

function drawModal(): void {
  lastSelfKey = modal === 'company' || modal === 'base' || modal === 'gear' || modal === 'hero' || modal === 'throne' || modal === 'research' ? selfKeyFor(modal) : '';
  const root = $('modal-panel');
  const marks = root.dataset.modal === (modal ?? '') ? scrollMarks(root) : null;
  // Screens dress by name in the stylesheet (header art, backgrounds).
  root.dataset.modal = modal ?? '';
  renderModal(root);
  if (marks) restoreScroll(root, marks);
}

function renderModal(root: HTMLElement): void {
  // The gear window's card beside a hovered piece goes with its window (QA circle: it stayed over the next window,
  // opened by a key, until the mouse moved).
  if (!(modal === 'hero' && heroWindow.tab === 'gear')) document.querySelectorAll('.gear-tip').forEach((e) => e.remove());
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
      renderShip(root, state, (m) => net.send(m), () => openModal('gear'), () => openModal('look'), () => void askScuttle(state, (m) => net.send(m), (msg) => hud.toast(msg, 'bad')));
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
      // (answered: the card goes at once and is not brought back by boardingCardFrame before the server's word comes)
      if (state.boarding) renderBoarding(root, state.boarding, state, (m) => net.send(m), () => {
        state.boarding = null;
        closeModal();
      });
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
      renderMenu(root, openMenuItem, [...(state.self?.homeIsle !== null && state.self?.homeIsle !== undefined ? ['base' as const] : []), ...(state.self?.glory?.open ? ['throne' as const] : []), 'research' as const]);
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
    case 'way':
      wayWindow.render(root, state);
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
    case 'research':
      researchWindow.render(root, state);
      break;
    case 'sunk':
      if (lastSunk) renderSunk(root, lastSunk.lost, lastSunk.port, () => openModal(state.portView ? 'port' : null), lastSunk.towed, lastSunk.boarded, lastSunk.scuttled);
      break;
  }
  if (touch.enabled) stripKeyHints(root);
  // A title all in Latin letters (a ship's name on a Russian screen) is set as English: its display face's capitals
  // ride high and styles.css lowers them (QA circle, 2026-10-05).
  root.querySelectorAll<HTMLElement>('.modal-head h2, .title-sm').forEach((h) => {
    const t = h.textContent ?? '';
    if (/[A-Za-z]/.test(t) && !/[А-Яа-яЁё]/.test(t)) h.lang = 'en';
    else h.removeAttribute('lang');
  });
  root.querySelectorAll<HTMLElement>('[data-tame]').forEach((b) => (b.onclick = () => openTame())); // docs/18 IV
  root.querySelectorAll<HTMLElement>('[data-throne]').forEach((b) => (b.onclick = () => openThrone())); // docs/19 E18
  root.querySelectorAll<HTMLElement>('[data-research-open]').forEach((b) => (b.onclick = () => openModal('research'))); // docs/20
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

/** Every window can be closed by touch (a fight's result and a shipwreck wait for their own buttons). On a phone it
 *  is a bottom sheet with a grip on top: drag it (or the window's band) down and it goes (docs/23 phase 6). */
function ensureCloseButton(root: HTMLElement): void {
  if (!root.querySelector(':scope > .w-grip')) {
    const g = document.createElement('div');
    g.className = 'w-grip';
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<i></i>';
    root.prepend(g);
  }
  root.classList.toggle('w-answer', !!modal && ANSWER.includes(modal));
  if (!modal || modal === 'boarding' || modal === 'sunk' || modal === 'mutiny') return;
  let x = root.querySelector<HTMLElement>('.x-btn');
  if (!x) {
    x = document.createElement('button');
    x.className = 'x-btn';
    x.setAttribute('aria-label', t('a11y.close'));
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

// Invitations to sail together (ui/invitequeue.ts): one that came while a window was open is told when it closes, a tap
// away from the Company screen to answer it.
const inviteQueue = new InviteQueue();
const noteInvites = (): void => inviteQueue.note(state.invites, modal);
function announceInvites(): void {
  for (const w of inviteQueue.due(state.invites)) hud.tapToast(L('inviteWaits', { from: w.from }), 'info', () => {
    companyScreen.open('group');
    openModal('company');
  });
}

/** A screen from the captain's cabin or the micro menu. */
function openMenuItem(m: MenuItem): void {
  if (m === 'chat') {
    if (modal) closeModal();
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
// ---- docs/28, the chat (client/src/ui/chat.ts): who the reader is and who is near her (the colour of each name, the
// tabs she has), and what it asks of the game.
onLang(() => hud.chatPanel.art());
hud.chatPanel.context = () => ({
  self: state.self?.name ?? null,
  group: (state.party?.members ?? []).map((x) => x.name),
  guild: (state.guild?.members ?? []).map((x) => x.name),
  friends: state.friends.map((f) => f.name),
  ignored: state.ignored,
});
hud.chatPanel.hooks = {
  // (the Abyss's ritual is typed in the chat: /ritual)
  send: (m) => (m.t === 'chat' && !m.ch && /^\/ritual\b/i.test(m.text) ? net.send({ t: 'abyss', action: 'ritual' }) : net.send(m)),
  invite: (name) => net.send({ t: 'group', action: 'invite', name }),
  befriend: (name) => net.send({ t: 'friend', action: 'add', name }),
  block: (name, on) => net.send({ t: 'friend', action: on ? 'ignore' : 'unignore', name }),
  toast: (text) => hud.toast(text, 'info'),
};
// ---- (docs/28 ends)
// (with a mark on a touch screen the chart came down by her tap on its tab: a tap again puts it back up — seahud.ts)
$('hud-map').onclick = () => {
  if (seaHud.mapTap()) return;
  toggle('map');
};
// docs/23 item 30: a long press on the minimap marks the sea there and the helmsman takes her to it.
hud.onMiniMark = (x, y) => {
  if (!inGame || state.self?.dockedAt || !worldMap.onAutosail) return false;
  const wp = { x: Math.round(x), y: Math.round(y) };
  setMark(wp);
  worldMap.onAutosail(wp);
  return true;
};
// The action bar (owner, 2026-10-02): a button does what its key does, every one in sight (2026-10-18). A press never
// takes the focus (Space and Enter stay the ship's).
// (2026-10-19: the bar is laid anew when what is at hand changes — a far find's «≈ 600 м» as she sails — and a press whose
// button was laid anew under it between down and up lost its click: the button pressed is kept from the press)
let promptDown: { id: string; at: number } | null = null;
$('hud-prompt').addEventListener('mousedown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  promptDown = b ? { id: curActs[Number(b.dataset.act)]?.id ?? '', at: performance.now() } : null;
});
$('hud-prompt').addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const b = el.closest<HTMLElement>('[data-act]');
  const down = promptDown;
  promptDown = null;
  const a = b ? curActs[Number(b.dataset.act)] : down && performance.now() - down.at < 800 ? curActs.find((x) => x.id === down.id) : undefined;
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

// The window's grip and band drag it down (the kit's sheet gesture); a window that must be answered stays.
wireSheetSwipe($('modal-panel'), () => { $('modal-panel').style.transform = ''; if (modal === 'barter') net.send({ t: 'barter', action: 'cancel' }); else closeModal(); }, '.w-grip, .modal-head, .w-head', null, () => !!modal && !ANSWER.includes(modal) && matchMedia('(max-height: 520px), (max-width: 699px)').matches);
$('modal').addEventListener('click', (e) => {
  // A tap on the scrim above a phone's sheet closes it, as the kit's sheets do.
  if (e.target === $('modal') && modal && !ANSWER.includes(modal) && performance.now() - modalAt > 450 && matchMedia('(max-height: 520px), (max-width: 699px)').matches) {
    if (modal === 'barter') net.send({ t: 'barter', action: 'cancel' });
    else closeModal();
  }
});
wireHints();
// ux2: a window's redraw waits for the tap on it; a tab drawn away under the finger is found again and pressed.
installTapGuard(() => [$('modal-panel'), ...document.querySelectorAll<HTMLElement>('.k-sheet-root')]);
rescueTaps();
// docs/23, 2026-10-10: the phone pager (kit/fit.ts) — removed by seaux below.
// seaux (2026-10-11, owner: «Никакие из окошек с инфой нельзя вниз пролистнуть»): the phone pager (kit/fit.ts «‹ 1/3 ›»)
// is not installed — on his iPhone it cut the windows off; every window and sheet scrolls with a finger instead (fit.css).

function toggle(m: Modal): void {
  if (modal === m) closeModal();
  else openModal(m);
}

// ------------------------------------------------------------------ input

function typing(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
}

// The chat stays open until its button, its ×, a swipe or Esc folds it away (docs/28).

addEventListener('keydown', (e) => {
  // Autofill, an IME and some gamepad bridges fire keydowns that are no KeyboardEvent and carry no key.
  if (!inGame || typeof e.key !== 'string') return;
  const chatInput = $('chat-input') as HTMLInputElement;
  // (batch-pc: over a window Esc is the window's — the chat lies under its veil; before, the first Esc folded the unseen
  // chat and the window stayed)
  if (e.key === 'Escape' && hud.chatPanel.isOpen && (!modal || document.activeElement === chatInput)) {
    // Esc in the field leaves it (the keys steer the ship again); Esc once more folds the chat away.
    if (document.activeElement === chatInput) chatInput.blur();
    else hud.chatPanel.close();
    e.preventDefault();
    return;
  }
  // A choice open beside a hex or a stack on the deck (owner, 2026-10-15): Enter gives its first order, not the chat.
  if (e.key === 'Enter' && !modal && !typing() && tactical.pickOpen() && tactical.onKey(e)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter') {
    // Enter opens the chat and its field; Enter in the field sends (an empty field gives the keys back).
    if (document.activeElement === chatInput) {
      if (chatInput.value.trim()) hud.chatPanel.send();
      else chatInput.blur();
    } else if (!typing() && !modal) hud.chatPanel.focusInput();
    // (batch-pc: over a window Enter is the window's — its focused button — never the chat hidden under the window's
    // veil: its field took the focus unseen and every key after it went into it, the game's keys dead)
    else return;
    e.preventDefault();
    return;
  }
  // batch-pc: Tab in an open window walks the window's controls (never the sea's «next target» behind it, never out
  // onto the HUD from a field).
  if (e.key === 'Tab' && modal && !(modal === 'options' && optionsScreen.capturing)) {
    e.preventDefault();
    windowTab($('modal-panel'), e.shiftKey);
    return;
  }
  // Esc leaves the options even with a slider or a list still in focus.
  if (e.key === 'Escape' && modal === 'options' && !optionsScreen.capturing) {
    (document.activeElement as HTMLElement | null)?.blur();
    closeModal();
    return;
  }
  // batch-pc: Esc in a window's field (a price, a name, a search) closes the window as Esc anywhere in it does — it did
  // nothing at all there (the field kept the key).
  if (e.key === 'Escape' && modal && typing()) (document.activeElement as HTMLElement | null)?.blur();
  if (typing()) return;
  // A deck fight takes the digits for its orders and Space for the duel's blade.
  if (!modal && (tactical.onKey(e) || boardFight.onKey(e))) {
    e.preventDefault();
    return;
  }
  const k = keyOf(e);
  if (k === 'escape') {
    if (!modal && isleScene.isOpen) return leaveIsle();
    if (modal === 'barter') net.send({ t: 'barter', action: 'cancel' });
    else if (modal && modal !== 'boarding' && modal !== 'sunk') closeModal();
    else if (!modal) openModal('options');
    return;
  }
  if (modal === 'options' && optionsScreen.capturing) return;
  // The diving bell: Shift+arrows steer it through the drowned streets.
  if (state.dive?.leader && e.shiftKey && typeof e.key === 'string' && e.key.startsWith('Arrow')) {
    const d = ({ ArrowUp: 'n', ArrowRight: 'e', ArrowDown: 's', ArrowLeft: 'w' } as const)[e.key as 'ArrowUp'];
    if (d) net.send({ t: 'dive_move', dir: d });
    e.preventDefault();
    return;
  }
  // A key bound alone to a modifier (Shift: the dash) acts on its own tap, when it goes up with nothing pressed while it
  // was down — Shift+B and Shift+F are the careful boarding and the bribe, not a dash.
  if (MODS.has(k) && e.isTrusted) {
    if (!e.repeat) modTap = soloModifier(k, e) ? { k, at: performance.now() } : null; // (batch-pc: Alt+Shift, a layout's switch, is no dash)
    return;
  }
  if (e.isTrusted) modTap = null;
  const act = actionFor(settings().keys, k);
  if (!act) return;
  // (batch-pc: with a window open only the windows' own keys act — F, the guns, the helm wait until it is shut)
  if (modal && !keyActsInWindow(act)) return;
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
    case 'fire':
      // «Огонь» by its key (Space): the volley at her mark, or the broadside laid on her first (seaFire).
      seaFire();
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
      } else hud.toast(noBoardWhy ?? L('noCrippled'), 'bad');
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
    case 'dock': {
      // docs/35: off a floating waystation the same key moors her there.
      const own = state.ownDisplay;
      const way = !docked && own && !state.wayView && !state.ports.some((p) => dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS) ? wayAtHand(own) : null;
      if (way) net.send({ t: 'way', action: 'moor', id: way.id });
      else if (docked) departOrAsk(state, (m) => net.send(m), () => net.send({ t: 'undock' }));
      else if (selPlace?.kind === 'port' && own && !state.ports.some((p) => dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS)) selGo(); // (owner, 2026-10-26)
      else requestDock(e.shiftKey);
      break;
    }
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
  if (!k) return;
  keys.delete(k);
  if (modTap?.k === k && performance.now() - modTap.at < 400 && !typing() && soloModifier(k, e)) {
    dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code }));
    keys.delete(k);
  }
  modTap = null;
  // A held broadside fires when its key comes up.
  const act = actionFor(settings().keys, k);
  if (act === 'firePort') releaseFire('port');
  else if (act === 'fireStarboard') releaseFire('starboard');
});
addEventListener('blur', () => {
  keys.clear();
  charge = null;
});

/** The modifiers a key map may bind alone, and the one pressed down with nothing after it yet. */
const MODS = new Set(['shift', 'control', 'alt']);
let modTap: { k: string; at: number } | null = null;

const canvas = $('world');
canvas.addEventListener('mousemove', (e) => {
  renderer.mouseX = e.clientX;
  renderer.mouseY = e.clientY;
  if (!fromFinger(e)) hoverCursor(e.clientX, e.clientY, true);
});
canvas.addEventListener('mouseleave', () => {
  delete canvas.dataset.cur;
  hoverTargetMenu('');
});
canvas.addEventListener('wheel', (e) => {
  // (Ctrl + the wheel, a touchpad's pinch, zooms the sea too — never the browser's page under the game)
  e.preventDefault();
  renderer.userZoomed = true;
  // (a far view steps out quicker: from the old farthest to the chart's in a dozen notches, freecam.ts)
  const step = renderer.targetZoom < ZOOM_NEAR_MIN ? 1.25 : 1.12;
  // (batch-pc: by the distance the wheel moved — a touchpad's stroke of tiny deltas was a whole step each)
  renderer.targetZoom = clampZoom(renderer.targetZoom * wheelZoom(e.deltaY, e.deltaMode, step));
}, { passive: false });
// batch-pc: Ctrl + the wheel (and a laptop touchpad's pinch, which Chrome sends as it) zoomed the browser's page — the
// whole HUD and every window grew or shrank under the game. In the game it is never the page's zoom.
addEventListener('wheel', (e) => {
  if (inGame && e.ctrlKey) e.preventDefault();
}, { passive: false });
// (the view home from the far look by a key too: Home — the button is the simple HUD's)
addEventListener('keydown', (e) => {
  if (e.key === 'Home' && inGame && !typing() && renderer.looking) renderer.recentre();
});
/** A finger's tap brings the browser's mouse events after it: on a phone every tap on the sea came down here too and
 *  fired the broadside under the finger — at a ship it marked, at a creature stack, at the open sea — and her own volley
 *  left her «under fire» for 20 s, so the stack, the lair, the drift said «Не под огнём» at every tap (owner,
 *  2026-10-07: «не работает никакие кнопки, идут ошибки вечные»). The click-to-fire is the mouse's only. */
let fingerAt = -1e9;
addEventListener('touchstart', () => (fingerAt = performance.now()), { capture: true, passive: true });
addEventListener('touchend', () => (fingerAt = performance.now()), { capture: true, passive: true });
function fromFinger(e: MouseEvent): boolean {
  return !!(e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities?.firesTouchEvents || performance.now() - fingerAt < 1000;
}
canvas.addEventListener('mousedown', (e) => {
  if (!inGame || e.button !== 0 || fromFinger(e)) return;
  // A click on a ship makes her the target; on a creature stack, marks the stack and fires nothing.
  const mk = markAt(e.clientX, e.clientY);
  if (mk === 'roam') {
    selPlace = null;
    return;
  }
  if (mk === 'ship' && targetId !== null) selPlace = { kind: 'ship', id: targetId };
  // (owner, 2026-10-26) a harbour, an island, her wreckage: selected — its buttons on the bar («К порту», «Плыть сюда»)
  const pl = mk ? null : placeAtScreen(e.clientX, e.clientY);
  // a harbour's name: its card (owner, 2026-10-30), the harbour selected as ever
  const named = mk ? null : portLabelAt(e.clientX, e.clientY);
  if (named) {
    selPlace = { kind: 'port', id: named };
    return openPortCard(state, named);
  }
  if (pl) {
    selPlace = pl;
    if (pl.kind !== 'wreck') return; // (no broadside into a harbour clicked)
  } else if (!mk) selPlace = null;
  if (shipAtScreen(e.clientX, e.clientY) === null && sailToTap(e.clientX, e.clientY)) return; // seaux: a click on a thing on the sea sails her to it
  // The simple HUD fires by its keys (Space, Q, E): a click on the open sea sails her there — on the button's lift, so
  // a drag (the view panned, touch.ts) is not a course (batch-pc, owner 2026-10-26). The detailed one fires the side
  // the cursor lies off, as it always did.
  if (simpleHud()) {
    seaPress = !mk && !pl ? { x: e.clientX, y: e.clientY } : null;
    return;
  }
  const side = sideUnderCursor();
  if (side) fire(side);
});
/** The left press on the open sea, waiting for its lift (the simple HUD's click-to-sail). */
let seaPress: { x: number; y: number } | null = null;
/** The helmsman to a point on screen, with a small ring where the click fell. */
/** How near the helmsman brings her to a point tapped or clicked on the sea (the server's least: 20 m). */
const SCREEN_ARRIVE = 30;
function sailToScreen(px: number, py: number): void {
  if (!worldMap.onAutosail) return;
  const m = renderer.toWorld(px, py);
  const wp = { x: Math.round(m.x), y: Math.round(m.y) };
  renderer.fx.add({ kind: 'ring', x: wp.x, y: wp.y, life: 0.6, size: 3, grow: 26, color: '#e8d9a8' });
  setMark(wp);
  // (the chart's course with the point itself as the arrival, not «near enough»: the helmsman's own is 150 m —
  // AUTOSAIL_ARRIVE — and on a phone at the usual zoom most of the sea in sight lies nearer than that, so a tap was
  // «You are at your mark already» and nothing moved: owner, 2026-10-29 «поставить просто пальцем точку на карту и
  // начать движение не получается»)
  autosailTo(wp, SCREEN_ARRIVE);
}
// (on the window: the lift may come over the HUD after a drag — no course then; a lift on a window is not the sea's)
addEventListener('mouseup', (e) => {
  const p = seaPress;
  seaPress = null;
  if (!p || e.button !== 0 || !inGame || e.target !== canvas) return;
  const act = leftClickSea({ docked: !!state.self?.dockedAt, simple: simpleHud(), modal: !!modal, moved: Math.hypot(e.clientX - p.x, e.clientY - p.y) });
  if (act === 'sail') sailToScreen(e.clientX, e.clientY);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!inGame || e.button !== 2 || fromFinger(e)) return;
  const m = mouseWorld();
  const act = rightClickAct({ docked: !!state.self?.dockedAt, mount: !!state.self?.loadout.mount });
  if (act === 'mount') net.send({ t: 'mount', x: Math.round(m.x), y: Math.round(m.y) });
  else if (act === 'sail') sailToScreen(renderer.mouseX, renderer.mouseY); // (batch-pc: no mount — the right button is the helm's «туда»)
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
// seaux (2026-10-11, owner: «Нажимая на иконку капитана должны быть какие-то окошки настроек … щас ничего не происходит»):
// her portrait, on a phone and on a desk, opens the captain's menu — her sheet, «Умения», the talents, the journal, the
// settings, the account — with what its gold bead was about first.
hud.onCaptain = () => {
  const self = state.self;
  if (!self) return;
  if (modal) closeModal();
  toggleCaptainMenu({ name: self.name, level: self.level, pts: self.talentPoints }, {
    open: (id) => (id === 'hero' || id === 'skills' ? openHero(id) : id === 'replays' ? tactical.openReplays() : openModal(id)),
    support: (email, message) => authPost('/auth/support', { email, message, token: localStorage.getItem('gravetide.token') ?? '', website: '', t: String(Math.round(performance.now())), lang: lang() }),
    logout: () => {
      net.forget();
      location.reload();
    },
    confirm: (q) => ask(q),
    text: (s) => serverText(s),
  });
  hud.redrawCaptain(); // the bead seen: out
};
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
  // Under «Атаковать» (docs/23 item 33) her own hand — the stick held, a helm key, the pad, the sheets — takes the
  // wheel; let go, the helmsman has it back 1.5 s later (by the server's clock). The stick's course goes with her hand.
  const steering = touch.held() || (!typing() && (rudder !== 0 || padRudder !== 0));
  if (steering) helmAt = now;
  const hand = steering || now - helmAt < 400;
  const run = !!state.pursuit || state.roamRun !== null;
  if (run && !touch.held() && touch.course !== null) touch.course = null;
  state.helm = run && hand;
  const key = `${state.input.rudder}|${state.input.sail}|${hand ? 1 : 0}`;
  if (key !== lastInputKey || now - lastInputSent > 250) {
    lastInputKey = key;
    lastInputSent = now;
    net.send({ t: 'input', seq: ++state.input.seq, rudder: state.input.rudder, sail: state.input.sail, ...(hand ? { helm: true } : {}) });
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
/** The «Действие» wheel's list as it was when the wheel opened. */
let wheelActs: Act[] = [];
let actTipOffered = false;
let pendingMark: { id: number; until: number } | null = null;
/** docs/19 D5: the small thing her boats will go to once she has slowed. */
let pendingFind: { id: number; until: number } | null = null;

/** docs/19 D5: the sea's small thing within reach of her (the flying fish: aboard while they last) — her hull within
 *  thirty metres of it (owner, 2026-10-22, reach.ts); or the nearest close by on her screen, with the metres left (the
 *  bar's hint, not a button). */
function findAtHand(): FindView | null {
  const own = state.ownDisplay, h = ownHull(state);
  if (!own || !h || state.self?.dockedAt) return null;
  let best: FindView | null = null, bd = Infinity;
  for (const f of state.finds) {
    const d = findGap(h, f);
    if (d <= FIND_REACH[f.kind] && d < bd) [best, bd] = [f, d];
  }
  return best;
}
/** The nearest of her small things close by (on her screen, within REACH_HINT of its reach), and the metres left. */
function findNearby(): { f: FindView; left: number } | null {
  const h = ownHull(state);
  if (!h || state.self?.dockedAt) return null;
  let best: { f: FindView; left: number } | null = null;
  for (const f of state.finds) {
    if (f.kind === 'flyfish') continue;
    const left = findGap(h, f) - FIND_REACH[f.kind];
    if (left > 0 && left < REACH_HINT && (!best || left < best.left) && seenOnScreen(f.x, f.y)) best = { f, left };
  }
  return best;
}
/** Metres to a find beyond its reach (0: within it). */
function findFar(f: FindView): number {
  const h = ownHull(state);
  if (!h || f.kind === 'flyfish') return 0;
  const left = findGap(h, f) - FIND_REACH[f.kind];
  return left > 0 ? left : 0;
}

/** docs/19 D7: the roaming stack within the fight's reach of her hull (owner, 2026-10-22: thirty metres, reach.ts). */
function roamAtHand(): RoamView | null {
  const own = state.ownDisplay, h = ownHull(state);
  if (!own || !h || state.self?.dockedAt) return null;
  let best: RoamView | null = null, bd = ROAM_REACH;
  for (const v of state.roams) {
    if (Math.abs(v.x - own.x) > 400 || Math.abs(v.y - own.y) > 400) continue;
    const d = roamHullGap(h, roamNow(state, v));
    if (d <= bd) [best, bd] = [v, d];
  }
  return best;
}

/** docs/19 D7: the stack «Атаковать» is about — the one she marked (in sight, standing, nobody else's fight), else the
 *  one within a cable of her; `marked` when she chose it. */
function roamFocus(): { v: RoamView; marked: boolean; far: boolean } | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) {
    state.roamMark = null;
    return null;
  }
  if (state.roamMark !== null) {
    const v = state.roams.find((x) => x.id === state.roamMark);
    const p = v ? roamNow(state, v) : null;
    const h = ownHull(state);
    // (owner, 2026-10-22: her mark on her screen — out of it, or under the fog, it is let go)
    if (v && p && h && v.fight !== 'other' && dist(p.x, p.y, own.x, own.y) <= ROAM_SEE && seenOnScreen(p.x, p.y, 20)) return { v, marked: true, far: roamHullGap(h, p) > ROAM_REACH };
    state.roamMark = null;
  }
  // The opening's «Твари на отмели»: the stack on her screen is marked for her — «Плыть» stopped her 60 m off it (the
  // stack drifts; its boats go from 30 m) and nothing lit for two and a half minutes (the newcomer's run, 2026-10-23)
  const near = (openingFrame() ?? storyQuest()?.does) === 'neutral' && !state.autosail && state.roamRun === null ? openingStack(own) : null;
  const nv = near !== null ? state.roams.find((x) => x.id === near) : undefined;
  const nh = ownHull(state);
  if (nv && nh) {
    state.roamMark = nv.id;
    return { v: nv, marked: true, far: roamHullGap(nh, roamNow(state, nv)) > ROAM_REACH };
  }
  const v = roamAtHand();
  return v ? { v, marked: false, far: false } : null;
}
/** The nearest stack of the sea on her screen, standing and nobody's fight, within 1.5 km (the opening's lesson). */
function openingStack(own: { x: number; y: number }): number | null {
  let best: number | null = null, bd = 1500;
  for (const v of state.roams) {
    if (v.fight) continue;
    const p = roamNow(state, v);
    const d = dist(p.x, p.y, own.x, own.y);
    if (d < bd && seenOnScreen(p.x, p.y, 20)) [best, bd] = [v.id, d];
  }
  return best;
}

/** docs/35: the nearest floating waystation within mooring reach of her hull (owner, 2026-10-22: 30 m, reach.ts). */
function wayAtHand(own: { x: number; y: number }): WayData | null {
  const h = ownHull(state);
  if (!h) return null;
  let best: WayData | null = null, bd = Infinity;
  for (const w of state.ways.values()) {
    if (Math.abs(w.x - own.x) > 300 || Math.abs(w.y - own.y) > 300 || !wayInReach(h, w)) continue;
    const d = gapTo(h, w.x, w.y, WAY_SIZE / 2);
    if (d <= bd) {
      bd = d;
      best = w;
    }
  }
  return best;
}

/** docs/35: the nearest waystation close by but not yet within mooring reach, and the metres left (the bar's hint). */
function wayNearby(): { w: WayData; left: number } | null {
  const h = ownHull(state);
  if (!h) return null;
  let best: { w: WayData; left: number } | null = null;
  for (const w of state.ways.values()) {
    if (Math.abs(w.x - h.x) > 400 || Math.abs(w.y - h.y) > 400) continue;
    const left = gapTo(h, w.x, w.y, WAY_SIZE / 2) - REACH_OBJ;
    if (left > 0 && left < REACH_HINT && (!best || left < best.left) && seenOnScreen(w.x, w.y)) best = { w, left };
  }
  return best;
}

/** The nearest of the dense sea's marks close by on her screen but not yet within the boats' reach, and the metres left. */
function markNearby(): { m: SeaMarkData; left: number } | null {
  const h = ownHull(state);
  if (!h || state.self?.dockedAt) return null;
  let best: { m: SeaMarkData; left: number } | null = null;
  for (const m of state.seaMarks.values()) {
    if (Math.abs(m.x - h.x) > 500 || Math.abs(m.y - h.y) > 500 || state.markDone.has(m.id)) continue;
    const left = gapTo(h, m.x, m.y, m.r) - REACH_OBJ;
    if (left > 0 && left < REACH_HINT && (!best || left < best.left) && seenOnScreen(m.x, m.y, m.r)) best = { m, left };
  }
  return best;
}

/** The nearest of the dense sea's marks within the boats' reach of her. */
function markAtHand(): SeaMarkData | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) return null;
  let best: SeaMarkData | null = null, bd = Infinity;
  for (const m of state.seaMarks.values()) {
    const h = ownHull(state);
    if (!h || Math.abs(m.x - own.x) > 600 || Math.abs(m.y - own.y) > 600 || !markInReach(m, h)) continue;
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
  noBoardWhy = null;
  boardNear = null;
  if (!own || !self || !you) return { acts: [], info: [] };
  if (self.dockedAt) return { acts: buildActs({ grabbed: grabbed(), docked: true, harbourOpen: modal === 'port' }), info: [] };
  const st = state.ownStats!;
  let best: number | null = null, bd = Infinity;
  const held = grabbed();
  for (const s of state.ships.values()) {
    if (!s.info) continue;
    const c = s.cur;
    if (c.flags & (SF.SINKING | SF.DOCKED | SF.PROTECTED | SF.IN_BATTLE | SF.VOYAGE)) continue;
    const cls = SHIP_CLASSES[s.info.classId];
    if (beastOfClass(s.info.classId)) continue; // no decks on a beast of the sea
    if (isZoneBossClass(s.info.classId)) continue; // nor on a zone boss: guns only (docs/21)
    // Nor on a great one's body or limbs (the server refuses them); held by one, she has «Axes!» on the same key and
    // no second button for it (QA, 2026-10-04).
    if (held || state.bosses.some((b) => b.noBoard?.includes(s.id))) continue;
    // Boarding off on her ship or on yours (docs/24 C1): guns only, no «На абордаж» (the key says why, once a press).
    // (Her own switch keeps her off captains only: the sea's own she boards at once, owner 2026-10-18.)
    if (c.flags & SF.NO_BOARD || ((you.flags ?? 0) & SF.NO_BOARD && captainSide(s.info))) {
      noBoardWhy = LFL(!(c.flags & SF.NO_BOARD) ? 'fl.offYou' : 'fl.offHer');
      continue;
    }
    // (her own guard, hired at sea or an escort, is nobody's deck to grapple: not even the hint — QA 2026-10-25)
    if (s.info.npcRole === 'escort' && !(c.flags & SF.HOSTILE)) continue;
    const d = dist(own.x, own.y, c.x, c.y);
    if (d > st.boardingRange + st.length + cls.length) continue;
    // Alongside only (owner, 2026-10-22): the hulls within the grapples' few metres, side by side, the way matched —
    // the server's own rule (reach.ts); close but not yet, the bar says what is left (her mark's).
    const bw = boardWhy(s.id);
    if (bw !== null) {
      if (s.id === (state.pursuit?.target ?? targetId) && bw.why) boardNear = { name: placeName(s.info.name), ...bw };
      continue;
    }
    void cls;
    // Boarding at once (docs/17 H1): any ship in the grapples' reach, whole or wrecked; the server says why not.
    if ((s.info.isPlayer || s.info.npcRole === 'escort') && !(c.flags & SF.HOSTILE)) continue;
    // Her mark first (the pursuit's, or the one she tapped), whatever lies nearer: «На абордаж» took the nearest ship
    // in reach — a Crown cutter beside the pirate she was running down (docs/23 item 93).
    const mark = state.pursuit?.target ?? targetId;
    if (s.id === mark) {
      bd = -1;
      best = s.id;
      continue;
    }
    // With a mark of hers, the law alongside by chance is not offered (a Crown cutter beside the pirate she ran down) —
    // unless it is at her throat.
    if (mark !== null && s.info.npcRole === 'patrol' && !(c.flags & SF.HOSTILE)) continue;
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  }
  boardTarget = best;
  const info: string[] = [];
  const facts: ActFacts = { grabbed: grabbed() };
  if (best !== null) facts.board = { name: placeName(state.ships.get(best)?.info?.name ?? L('her')) };
  else if (boardNear && boardNear.gap < REACH_HINT) info.push(esc(boardNear.why === 'far' ? nearWords(LR8('board'), boardNear.gap - BOARD_GAP) : LR8(boardNear.why === 'abeam' ? 'abeam' : 'speed', { name: boardNear.name })));
  // A harbour's waters, and her hull within its approach (owner, 2026-10-22: 40 m of its anchorage or quays — dock.ts);
  // in its waters short of it, the bar says how far is left.
  const me = ownHull(state);
  const waters = state.ports.find((p) => dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS);
  const dockLeft = waters && me ? dockGap(me, waters, portIsle(waters)) - REACH_DOCK : Infinity;
  const port = dockLeft <= 0 ? waters : undefined;
  if (waters && !port && dockLeft < REACH_HINT) info.push(esc(nearWords(LR8('dock'), dockLeft)));
  // Just out of the harbour, «В порт» is not the gold button for half a minute (unless she is hurt): the 2026-10-06
  // newcomer's run cast off, saw «В порт» as the one thing to press and put straight back in — 190 times in 15 minutes.
  const watchHome = state.onboarding?.stage === 'port';
  if (port && (watchHome || !(performance.now() - castOffAt < CAST_OFF_QUIET && you.hull >= you.hullMax * 0.5))) facts.port = { name: sv(port.name) };
  // docs/35: a floating waystation within mooring reach (not while moored there already).
  // Moored with her window shut (another window over it): the same button brings it back.
  const way = !port ? (state.wayView ? (modal === 'way' ? null : state.ways.get(state.wayView.id) ?? null) : wayAtHand(own)) : null;
  if (way) facts.way = { id: way.id, name: wayName(way.kind) };
  else if (!port) {
    const wn = wayNearby();
    if (wn) info.push(esc(nearWords(LR8('moor'), wn.left)));
  }
  if (watchHome) facts.watchHome = true;
  const ab = self.abyss;
  facts.ritual = !!ab && ab.shards >= 3 && dist(own.x, own.y, ab.eye.x, ab.eye.y) < 1500;
  const l = self.landable;
  if (self.landing) {
    const now = state.estServerTime();
    const frac = Math.max(0, Math.min(1, (now - self.landing.started) / (self.landing.until - self.landing.started)));
    info.push(`${esc(L('ashore', { feature: sv(self.landing.name ?? self.landing.feature.replace(/_/g, ' ')), pct: Math.round(frac * 100) }))} ${esc(L('recall'))}`);
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
  facts.homeOpen = modal === 'base' || isleScene.isOpen;
  const wild = self.claimIsle;
  if (wild) facts.claim = { name: placeName(wild.name), price: fmt(wild.price) };
  facts.claimOpen = modal === 'company';
  const mk = markAtHand();
  if (!mk) {
    const mn = markNearby();
    if (mn) info.push(esc(nearWords(LR8('mark'), mn.left)));
  }
  if (mk) {
    const busy = state.markBusy?.id === mk.id ? state.markBusy : null;
    facts.mark = { id: mk.id, kind: mk.kind, done: state.markDone.has(mk.id), busy: !!busy };
    if (busy) info.push(esc(markInfo(mk.kind, 'busy', busy.until - state.estServerTime())));
    else if (state.markDone.has(mk.id)) info.push(esc(markInfo(mk.kind, 'done')));
    else if (pendingMark?.id === mk.id) info.push(esc(slowWord()));
  }
  // (the boats at one: hers to see through, whatever the drift since)
  const fd = findAtHand() ?? (state.findBusy ? state.finds.find((f) => f.id === state.findBusy!.id) ?? null : null);
  if (!fd) {
    const fn = findNearby();
    if (fn) info.push(esc(nearWords(LR8('find'), fn.left)));
  }
  if (fd) {
    const busy = state.findBusy?.id === fd.id ? state.findBusy : null;
    const far = findFar(fd);
    facts.find = { id: fd.id, kind: fd.kind, busy: !!busy, ...(fd.n ? { n: fd.n } : {}), ...(far ? { far: Math.round(far) } : {}) };
    if (busy) info.push(esc(findInfo(fd.kind, busy.until - state.estServerTime())));
    else if (pendingFind?.id === fd.id) info.push(esc(slowWord()));
  }
  const focus = roamFocus();
  const rm = focus?.v;
  // (a stack close by, not yet within the boats' thirty metres: how far is left — owner, 2026-10-22)
  if (!focus) {
    const hh = ownHull(state);
    let left = Infinity;
    if (hh) for (const v of state.roams) {
      if (v.fight || Math.abs(v.x - hh.x) > 400 || Math.abs(v.y - hh.y) > 400) continue;
      const p = roamNow(state, v);
      const l = roamHullGap(hh, p) - ROAM_REACH;
      if (l > 0 && l < left && seenOnScreen(p.x, p.y, 20) && !roamBackLeft(state, v)) left = l;
    }
    if (left < REACH_HINT) info.push(esc(nearWords(LR8('stack'), left)));
  }
  // A stack in focus (marked, or a cable off) with no ship of her own choosing: its «Атаковать» leads, and the nearest
  // hostile ship the target frame picked by itself is not offered (one «Атаковать», the stack's — owner, 2026-10-07).
  const roamLead = !!focus && !targetPinned && !state.pursuit;
  if (rm) {
    const name = roamName(rm.kind);
    const back = roamBackLeft(state, rm);
    facts.roam = { id: rm.id, icon: ROAM_UNITS[ROAMS[rm.kind].u as keyof typeof ROAM_UNITS].art, name, word: roamWord(rm.n).word, lv: rm.level, ...(rm.fight ? { fight: rm.fight } : {}), ...(back ? { back } : {}), ...(rm.offer ? { offer: rm.offer } : {}), ...(rm.joinN ? { joinN: rm.joinN } : {}), ...(roamLead ? { lead: true } : {}), ...(focus.far ? { far: true } : {}), ...(state.roamRun === rm.id ? { running: true } : {}), ...(focus.marked && focus.far && (openingFrame() ?? storyQuest()?.does) === 'neutral' ? { quest: true } : {}), ...(focus.marked ? { marked: true } : {}) };
    if (rm.fight) info.push(esc(LROAM(rm.fight === 'mate' ? 'i.mate' : 'i.fight', { what: name })));
    else if (back) info.push(esc(LROAM('i.back', { what: name, t: backClock(back) })));
    else if (rm.offer === 'flee' && rm.ratio !== undefined) info.push(esc(LROAM('i.flee', { r: rm.ratio })));
    // (owner, 2026-10-22: her mark a little off — the boats go from thirty metres; the bar says how far is left)
    const hh = ownHull(state);
    const left = focus.far && hh ? roamHullGap(hh, roamNow(state, rm)) - ROAM_REACH : 0;
    if (left > 0 && left < REACH_HINT && !rm.fight && !back && state.roamRun !== rm.id) info.push(esc(nearWords(LR8('stack'), left)));
  }
  // «Атаковать» (docs/23 item 33): the target frame's ship, or the pursuit under way — only a ship of her choosing (a
  // tap, the lock, the target key) or one the frame picked that is within her guns' reach (owner, 2026-10-19: «Кнопка
  // атаковать горит всегда даже когда у меня нет цели. Пусть внизу выпрыгивают кнопки только когда я рядом с чем-то
  // проплываю или беру кого-то в прицел»).
  // (owner, 2026-10-22: and only within her guns' real reach of a ship on her screen — «я не вижу ниче на карте, а уже
  // могу брать абордаж, атаку»; her mark a little beyond it: how far is left)
  const tgt = targetId !== null ? state.ships.get(targetId) : undefined;
  const tgtSeen = !!tgt && seenOnScreen(tgt.cur.x, tgt.cur.y, 20);
  const gunLeft = tgt ? dist(own.x, own.y, tgt.cur.x, tgt.cur.y) - gunReach() : Infinity;
  attackMark = attackable(targetId) && !roamLead && attackRelevant(gunLeft <= 0, tgtSeen, state.onboarding?.stage === 'attack' && tgt?.info?.name === WATCH_RAIDER, targetPinned) ? targetId : null;
  if (attackMark === null && targetPinned && tgtSeen && !state.pursuit && attackable(targetId) && gunLeft > 0 && gunLeft < REACH_HINT * 2) info.push(esc(LR8('attackFar', { m: Math.round(gunLeft) })));
  const pursued = state.pursuit ? state.ships.get(state.pursuit.target) : undefined;
  if (state.pursuit) facts.attack = { name: placeName(pursued?.info?.name ?? L('her')), pursuing: true, mode: state.pursuit.mode, ...(unboardableMark(state.pursuit.target) ? { gunsOnly: true } : {}) };
  else if (attackMark !== null) facts.attack = { name: placeName(state.ships.get(attackMark)?.info?.name ?? L('her')), pursuing: false, mode: 'board' };
  // The First Watch's last step (docs/23 item 79): «В порт» far from any harbour sails her to the nearest.
  homeport = null;
  if (!port && !state.pursuit && state.onboarding?.stage === 'port') {
    homeport = state.ports.reduce<(typeof state.ports)[number] | null>((b, p) => (!b || dist(p.x, p.y, own.x, own.y) < dist(b.x, b.y, own.x, own.y) ? p : b), null);
    if (homeport) facts.homeport = { name: sv(homeport.name) };
  }
  // Torn sails with no sailcloth (owner, 2026-10-20): «Корабль без парусов», the jury sail as it goes up; stranded,
  // «В порт» to the nearest harbour that will have her (the helmsman sails her in at the limping pace) and «Затопить».
  const ad = adriftFacts(state.adrift, (performance.now() - state.adriftAt) / 1000);
  facts.adrift = ad;
  if (ad) {
    info.unshift(esc(adriftInfo(ad)));
    const near = ad.stranded && !port && !state.pursuit && !homeport ? state.ports.find((p) => p.id === state.adrift?.port) ?? null : null;
    if (near) {
      homeport = near;
      facts.homeport = { name: sv(near.name) };
    }
  }
  facts.goalSail = goalSailPick(); // owner, 2026-10-22 (2026-10-29: the quest she picked, goalSailPick): the opening's next place — sailed for only at her word
  facts.sel = selFacts(port?.id ?? null, !!l && !l.blocked);
  facts.looks = advCard.closedLooks();
  // A struck ship's terms put off by «Later»: her card back with «Look…».
  const struck = surrenderCard.laterName();
  if (struck) facts.looks.unshift({ kind: 'struck', name: struck });
  if (you.flags & SF.PROTECTED) info.push(esc(L('protected')));
  // Mending at sea (docs/16 #15): the carpenters' pace and what it takes, or what they lack.
  const repairing = !!(you.flags & SF.REPAIRING);
  const rep = repairState(self, { ...you, combat: !!you.underFire }, repairing);
  facts.repair = rep ? { repairing, combat: !!you.underFire, hurt: rep.hurt, short: rep.short } : repairing ? { repairing, combat: !!you.underFire, hurt: true } : null;
  if (rep?.line) info.push(rep.line);
  if (you.combat && !repairing && you.hull < you.hullMax * 0.5 && !touch.enabled) info.push(esc(L('repairLull', { key: '\u0000' })).replace('\u0000', `<kbd>${esc(keyOfAction('repair'))}</kbd>`));
  return { acts: buildActs(facts), info };
}

/** Where the thing she selected lies now, its name, and her quest's key when it is that quest's place. */
function selWhere(): { x: number; y: number; name: string; quest?: string; near?: number } | null {
  const sp = selPlace;
  if (!sp) return null;
  const tracked = state.route?.view;
  const q = storyQuest() ?? trackedQuest(state.self?.quests, state.ownDisplay);
  if (sp.kind === 'port') {
    const pt = state.ports.find((x) => x.id === sp.id);
    if (!pt) return null;
    const key = q && q.target?.port === pt.id ? `q:${q.id}` : tracked?.port === pt.id && state.route ? state.route.key : undefined;
    return { x: pt.x, y: pt.y, name: sv(pt.name), ...(key ? { quest: key } : {}) };
  }
  if (sp.kind === 'isle') {
    const is = state.islands.get(Number(sp.id)), own = state.ownDisplay;
    if (!is || !own) return null;
    const c = claimSpot(is, own);
    return { x: c.x, y: c.y, name: placeName(is.name), near: 60 };
  }
  if (sp.kind === 'wreck') {
    const w = state.wrecks.find((x) => x.id === sp.id);
    return w ? { x: w.x, y: w.y, name: L('her'), near: 30 } : null;
  }
  const sh = state.ships.get(Number(sp.id));
  if (!sh?.info || sh.cur.flags & (SF.SINKING | SF.DOCKED)) return null;
  return { x: sh.cur.x, y: sh.cur.y, name: sh.info.isPlayer ? sh.info.captainName : placeName(sh.info.name), near: 60 };
}
/** The bar's facts of the selection (owner, 2026-10-26): what it offers from wherever she lies. */
function selFacts(dockHere: string | null, landHere: boolean): ActFacts['sel'] {
  const sp = selPlace, own = state.ownDisplay;
  if (!sp || !own || state.self?.dockedAt) {
    if (state.self?.dockedAt) selPlace = null;
    return null;
  }
  const w = selWhere();
  if (!w) {
    selPlace = null;
    return null;
  }
  const far = Math.round(dist(w.x, w.y, own.x, own.y));
  if (sp.kind === 'ship') {
    const sh = state.ships.get(Number(sp.id))!;
    // a foe: «Атаковать» / «На абордаж» are hers already (attackRelevant: pinned); the rest — the course, the hire, the look
    const foe = attackable(Number(sp.id)) && !(sh.cur.flags & SF.SURRENDERED);
    const hire = !sh.info!.isPlayer && !!sh.info!.npcRole && (HIRE_ROLES as readonly string[]).includes(sh.info!.npcRole) && !sh.info!.named && !sh.info!.elite && sh.info!.shipLevel !== undefined && !(sh.cur.flags & (SF.HOSTILE | SF.SURRENDERED | SF.SINKING | SF.BOARDING));
    return { kind: 'ship', name: w.name, far, go: !foe && far > 120, hire, look: !!sh.info!.isPlayer };
  }
  if (sp.kind === 'port') return { kind: 'port', name: w.name, far, go: dockHere !== sp.id, ...(w.quest ? { quest: true } : {}) };
  return { kind: sp.kind, name: w.name, far, go: !landHere && far > (w.near ?? 60) };
}
/** «К порту» / «Плыть сюда» / «Плыть» of the selection: a harbour by the route (it puts her in on arrival, goalroute.ts),
 *  her quest's place by its run, the rest by the helmsman's course. */
function selGo(): void {
  const sp = selPlace, w = selWhere();
  if (!sp || !w) return;
  if (w.quest) return startGoal(w.quest);
  if (sp.kind === 'port') return startGoal(`p:${sp.id}`);
  sailToSpot({ x: w.x, y: w.y }, w.near);
}

/** The island's level and its warning in words (the tooltip of the land button). */
function landTagText(l: NonNullable<NonNullable<typeof state.self>['landable']>): string {
  if (!l.lv) return '';
  return ` · ⚓${l.lv}${l.danger === 'deadly' ? ` · ${L18('prompt.deadly')}` : l.danger === 'warn' ? ` · ${L18('prompt.warn')}` : ''}`;
}

function computePrompt(): string {
  const { acts, info } = gatherActs();
  curActs = acts;
  const t = performance.now();
  for (const a of acts) actsShown.set(a.id, { a, at: t });
  // Every thing to do at once (owner, 2026-10-18: «нельзя скрывать ничего»): no «⋯ N more».
  if (acts.length && !actTipOffered) {
    actTipOffered = true;
    firstTips.offer('actions', true);
  }
  return actBarHtml(acts, info, touch.enabled ? null : keyOfAction);
}

/** A button of the bar (or its key, or the pad's A) does its thing. */
function runAct(a: Act): void {
  switch (a.id) {
    case 'axes':
      return void net.send({ t: 'board', target: state.entityId ?? 0, aggression: 'standard' });
    case 'harbour':
      return openModal('port');
    case 'board':
      return void (boardTarget !== null ? net.send({ t: 'board', target: boardTarget, aggression: 'standard' }) : hud.toast(noBoardWhy ?? L('noCrippled'), 'bad'));
    case 'dock':
      return requestDock(false);
    case 'moor_way':
      if (state.wayView?.id === Number(a.arg)) return openModal('way');
      return void net.send({ t: 'way', action: 'moor', id: Number(a.arg) });
    case 'jury': {
      const ad = adriftFacts(state.adrift, (performance.now() - state.adriftAt) / 1000);
      if (ad) hud.toast(juryTapText(ad), 'info');
      return;
    }
    case 'scuttle':
      return void askScuttle(state, (m) => net.send(m), (msg) => hud.toast(msg, 'bad'));
    case 'homeport':
      if (!homeport) return;
      // Already on her way there: a second tap sends nothing (each one said «Автоплавание: штурвал у рулевого…» again,
      // ×37 under a finger that kept tapping the gold button, QA 2026-10-09).
      if (homeRun === homeport.id && state.autosail) return;
      homeRun = homeport.id;
      homeRunAt = performance.now();
      goalRun = null;
      return void net.send({ t: 'autosail', x: homeport.x, y: homeport.y });
    case 'land':
      return sendLand();
    case 'cut_mast':
      return void net.send({ t: 'cut_mast' });
    case 'cast':
      return void net.send({ t: 'fishing', action: 'cast' });
    case 'base':
      return openBase();
    case 'claim':
      return claimIsland();
    case 'ritual':
      return void net.send({ t: 'abyss', action: 'ritual' });
    case 'mark':
      return workMark(Number(a.arg));
    case 'find':
      return workFind(Number(a.arg));
    case 'roam':
      // «Атаковать» on a stack (docs/19 D7): a cable off the boats go at once, farther the helmsman sails her in first.
      return void net.send({ t: 'attack', roam: Number(a.arg) });
    case 'roam_join':
      return void net.send({ t: 'roam', action: 'join', id: Number(a.arg) });
    case 'roam_look': {
      const v = state.roams.find((x) => x.id === Number(a.arg));
      if (v) openRoamLook(v);
      return;
    }
    case 'look':
      return a.arg === 'struck' ? surrenderCard.reopen() : advCard.reopen();
    case 'repair':
      return void net.send({ t: 'repair', on: !(state.you && state.you.flags & SF.REPAIRING) });
    case 'attack': {
      if (attackMark === null) return;
      // A beast, a monster, a zone boss: no grapple takes her — the guns' fight (the server says the same).
      return void net.send({ t: 'attack', target: attackMark, mode: unboardableMark(attackMark) ? 'guns' : 'board' });
    }
    case 'attack_mode':
      return void (state.pursuit && net.send({ t: 'attack', target: state.pursuit.target, mode: state.pursuit.mode === 'board' ? 'guns' : 'board' }));
    case 'attack_stop':
      return void net.send({ t: 'attack', stop: true });
    case 'goal_sail': {
      const o = goalSailPick();
      if (o) startGoal(o.key);
      return;
    }
    case 'sel_go':
      return selGo();
    case 'sel_hire':
      return void (selPlace?.kind === 'ship' && hireCard.ask(Number(selPlace.id)));
    case 'sel_look': {
      const sh = selPlace?.kind === 'ship' ? state.ships.get(Number(selPlace.id)) : undefined;
      if (sh?.info?.isPlayer) net.send({ t: 'inspect', name: sh.info.captainName });
      return;
    }
  }
}

// ------------------------------------------------------------------ the quick sea fight (docs/23 phases 3–4)

/** The ship «Атаковать» would take for her mark: the target frame's, if she may be fought. */
let attackMark: number | null = null;
/** When the captain's hand was last on the helm or the sheets (her own steering under «Атаковать»). */
let helmAt = -1e9;

/** A ship that may be attacked: one of the sea's or a hostile captain's, afloat, in sight, not one of hers. */
function attackable(id: number | null): boolean {
  const s = id !== null ? state.ships.get(id) : undefined;
  const own = state.ownDisplay;
  if (!s?.info || !own || state.self?.dockedAt || s.cur.flags & (SF.SINKING | SF.DOCKED | SF.PROTECTED | SF.IN_BATTLE | SF.VOYAGE)) return false;
  if (dist(own.x, own.y, s.cur.x, s.cur.y) > 2500) return false;
  if ((s.info.isPlayer || s.info.npcRole === 'escort') && !(s.cur.flags & SF.HOSTILE) && !fairCaptain(s.cur.flags, s.info)) return false;
  return true;
}

/** A captain her colours let her come for before a shot is fired (docs/24 D1): the pirate flag either side, or two
 *  cities at enmity; never under neutral colours. The server's rule (colours.ts) has the last word. */
function fairCaptain(flags: number, info: ShipInfo): boolean {
  const me = state.self?.pvp;
  if (!me) return false;
  // Lawless water (owner, 2026-10-09: «правил вообще нет»): any captain or her escort, whatever either flies — but her
  // own group and guild (a crew, not a rule).
  if (lawlessHere(state)) return !state.party?.members.some((m) => m.name === info.name) && !(me.guild && info.guild === me.guild);
  const them = shipColours(flags, info);
  if (!them || me.flag === 'neutral' || them.kind === 'neutral' || them.pennant) return false;
  if (me.flag === 'pirate' || them.kind === 'pirate') return true;
  return !!them.city && citiesHostile(me.city, them.city);
}

/** A captain's ship or one sailing with a captain (an escort): «Абордаж: выкл» on hers keeps her grapples off these only. */
function captainSide(info: { isPlayer?: boolean; npcRole?: string }): boolean {
  return !!info.isPlayer || info.npcRole === 'escort';
}

/** A ship no grapple takes (a beast of the sea, a monster, a zone boss, a great one's body or limb): «Атаковать» on her
 *  is the guns' fight, and «Сблизиться» is not offered (the server makes it so: pursuit.ts unboardable). */
function unboardableMark(id: number): boolean {
  const info = state.ships.get(id)?.info;
  if (!info) return false;
  // …nor one with boarding off, or from hers (docs/24 C1).
  const nb = ((state.ships.get(id)?.cur.flags ?? 0) & SF.NO_BOARD) || ((state.you?.flags ?? 0) & SF.NO_BOARD && captainSide(info));
  return !!nb || info.npcRole === 'beast' || !!beastOfClass(info.classId) || !!SHIP_CLASSES[info.classId]?.monster || isZoneBossClass(info.classId) || state.bosses.some((b) => b.noBoard?.includes(id));
}

/** docs/19 D7: a stack's card («Осмотреть»): its «Атаковать» is the same run as the action button's, «Отпустить» the
 *  HoMM3 flight. */
function openRoamLook(v: RoamView): void {
  void openRoamCard(state, v, (action, id) => net.send(action === 'attack' ? { t: 'attack', roam: id } : { t: 'roam', action, id }));
}

/** Her guns' real reach as loaded (the farther broadside): «Атаковать» on a ship is offered within it (owner,
 *  2026-10-22). */
function gunReach(): number {
  const self = state.self, you = state.you;
  if (!self || !you) return 0;
  return Math.max(GUNS[self.loadout.guns.port].range, GUNS[self.loadout.guns.starboard].range) * (state.ownStats?.rangeMul ?? 1) * (AMMO[you.ammoSel]?.rangeMul ?? 1);
}

/** The close fight's «в дальности» (owner, 2026-10-07): her mark within the band her gun captains fire in
 *  (gunnery.ts closeRange — the server's own rule), or «далеко»; null with no ship marked. */
function markRange(): 'in' | 'far' | null {
  const id = state.pursuit?.target ?? targetId;
  const s = id !== null ? state.ships.get(id) : undefined, own = state.ownDisplay, self = state.self, you = state.you;
  if (!s?.info || !own || !self || !you || self.dockedAt || s.cur.flags & (SF.SINKING | SF.DOCKED)) return null;
  if (!(s.cur.flags & SF.HOSTILE) && !state.pursuit) return null;
  const reach = Math.max(GUNS[self.loadout.guns.port].range, GUNS[self.loadout.guns.starboard].range) * (state.ownStats?.rangeMul ?? 1) * (AMMO[you.ammoSel]?.rangeMul ?? 1);
  return dist(own.x, own.y, s.cur.x, s.cur.y) <= closeRange(reach).far ? 'in' : 'far';
}

/** The best shot for her mark now (docs/23 item 39): grape to board a full deck, chain for one running faster, round
 *  for the rest. Null with no mark. */
function bestShot(): 'round' | 'chain' | 'grape' | null {
  const id = state.pursuit?.target ?? targetId;
  const s = id !== null ? state.ships.get(id) : undefined;
  const own = state.ownDisplay, self = state.self;
  if (!s?.info || !own || !self || self.dockedAt || !(s.cur.flags & SF.HOSTILE || state.pursuit)) return null;
  const range = GUNS[self.loadout.guns.port].range * (state.ownStats?.rangeMul ?? 1);
  return suggestAmmo({
    board: state.pursuit?.mode !== 'guns', d: dist(own.x, own.y, s.cur.x, s.cur.y), grapeRange: range * AMMO.grape.rangeMul, chainRange: range * AMMO.chain.rangeMul,
    crewShare: s.cur.crew, sailShare: s.cur.sails, faster: s.cur.spd > own.speed + 1,
  });
}

/** «Огонь»: a broadside out of turn (docs/23 item 35). */
function fireVolley(): void {
  if (state.self?.dockedAt || modal) return;
  net.send({ t: 'volley' });
}

// ------------------------------------------------------------------ the sea HUD on a phone (docs/23 phase 2)

/** Whether her mark lies on a beam, inside the guns' reach (the aimed volley would answer «not on your beam»). */
function targetBears(id: number): boolean {
  const s = state.ships.get(id), own = state.ownDisplay, self = state.self, you = state.you;
  if (!s || !own || !self || !you) return false;
  const range = GUNS[self.loadout.guns.port].range * (state.ownStats?.rangeMul ?? 1) * (AMMO[you.ammoSel]?.rangeMul ?? 1);
  if (dist(own.x, own.y, s.cur.x, s.cur.y) > range) return false;
  const bearing = Math.atan2(s.cur.x - own.x, -(s.cur.y - own.y));
  return Math.abs(Math.abs(angleDiff(bearing, own.heading)) - Math.PI / 2) <= (LAY_ARC_DEG * Math.PI) / 180;
}

/** «Огонь» on a phone: the volley when she bears; when she does not, the helmsman lays a broadside on her (the
 *  pursuit «Бортами») and the gun crews fire as she bears — so «Атаковать» and «Огонь» are a fight in two taps. The
 *  expert's hand fires the side she lies on. */
function seaFire(): void {
  if (state.self?.dockedAt || modal) return;
  const id = state.pursuit?.target ?? targetId;
  if (settings().expertGuns) {
    const s = id !== null ? state.ships.get(id) : undefined, own = state.ownDisplay, r = state.you?.reload;
    let side: 'port' | 'starboard' = (r?.port ?? 0) >= (r?.starboard ?? 0) ? 'port' : 'starboard';
    if (s && own) side = angleDiff(Math.atan2(s.cur.x - own.x, -(s.cur.y - own.y)), own.heading) < 0 ? 'port' : 'starboard';
    return touchFire(side);
  }
  // A creature stack marked (docs/19 D7): «Огонь» is the volley at whatever ship is in reach, not a pursuit of the ship
  // the target frame picked by itself.
  if (state.roamMark !== null && !targetPinned && !state.pursuit) return fireVolley();
  if (id !== null && attackable(id) && !targetBears(id)) {
    if (state.pursuit?.target !== id || state.pursuit.mode !== 'guns') net.send({ t: 'attack', target: id, mode: 'guns' });
    seaHud.flashFire(false);
    return;
  }
  fireVolley();
}

/** The ship the captain's abilities and the mount aim at: her mark. */
function aimAtMark(): void {
  const id = state.pursuit?.target ?? targetId;
  const s = id !== null ? state.ships.get(id) : undefined;
  if (s) aimAt(s.cur.x, s.cur.y);
}

/** «Особое» (docs/23 item 20): the captain's best ability ready now. */
function specialNow(): { id: string; icon: string; name: string } | null {
  const self = state.self, you = state.you;
  if (!self || !you || self.dockedAt) return null;
  const now = state.estServerTime();
  const cap = CAPTAINS[self.captain];
  const id = bestSpecial(cap.abilities.map((a) => ({
    id: a.id, kind: a.kind, cooldown: a.cooldown,
    ready: !(a.kind === 'ultimate' && (self.level < 6 || you.resolve < 100)) && (a.dreadCost ?? 0) <= you.dread && (self.cooldowns[a.id] ?? 0) <= now && !(a.goldCost && self.gold < a.goldCost),
  })));
  const a = id ? cap.abilities.find((x) => x.id === id) : undefined;
  return a ? { id: a.id, icon: `ab_${a.id}`, name: a.name } : null;
}

function seaSpecial(): void {
  const sp = specialNow();
  if (!sp) return;
  aimAtMark();
  sendAbility(sp.id);
}

/** The wheel under «Огонь» (docs/23 items 19–21): the shots she carries, the captain's abilities, the active
 *  talents, the deck mount. */
function fireWheel(): WheelOption[] {
  const self = state.self, you = state.you;
  if (!self || !you) return [];
  const now = state.estServerTime();
  const out: WheelOption[] = [];
  const shot = (a: (typeof AMMO_IDS)[number]): WheelOption => ({ id: `a:${a}`, label: AMMO[a].name, icon: `ammo_${a}`, glyph: '•', count: you.ammo[a], active: you.ammoSel === a, disabled: you.ammo[a] <= 0 });
  // The three shots by role first (and the one loaded), the rarer ones she carries last.
  const main = AMMO_IDS.filter((a) => a === 'round' || a === 'chain' || a === 'grape' || a === you.ammoSel);
  for (const a of main) out.push(shot(a));
  for (const a of CAPTAINS[self.captain].abilities) {
    const left = (self.cooldowns[a.id] ?? 0) - now;
    out.push({ id: `b:${a.id}`, label: left > 0 ? `${a.name} · ${Math.ceil(left)}` : a.name, icon: `ab_${a.id}`, glyph: a.key, disabled: left > 0 || (a.kind === 'ultimate' && (self.level < 6 || you.resolve < 100)) });
  }
  for (const tl of activeTalents(self.talents).slice(0, 5)) out.push({ id: `t:${tl.id}`, label: tl.name, icon: `tree_${tl.tree}`, glyph: '✦', disabled: (self.talentCooldowns[tl.id] ?? 0) > now });
  const m = self.loadout.mount;
  if (m) out.push({ id: 'm:', label: MOUNTS[m].name, icon: `mount_${m}`, glyph: '✺', disabled: you.reload.mount < 1 });
  for (const a of AMMO_IDS) if (!main.includes(a) && you.ammo[a] > 0) out.push(shot(a));
  return out.slice(0, WHEEL_MAX);
}

function pickFireWheel(id: string): void {
  const k = id.slice(0, 1), v = id.slice(2);
  if (k === 'a') net.send({ t: 'ammo', ammo: v as 'round' });
  else if (k === 'b') {
    aimAtMark();
    sendAbility(v);
  } else if (k === 't') {
    aimAtMark();
    sendTalent(v);
  } else if (k === 'm') {
    const own = state.ownDisplay;
    const tid = state.pursuit?.target ?? targetId;
    const s = tid !== null ? state.ships.get(tid) : undefined;
    const p = s ? s.cur : own ? { x: own.x + Math.sin(own.heading) * 300, y: own.y - Math.cos(own.heading) * 300 } : null;
    if (p) net.send({ t: 'mount', x: Math.round(p.x), y: Math.round(p.y) });
  }
}

/** docs/23 item 24: the deck mount fires by itself at her mark in a fight, in its reach, with what it needs aboard
 *  (the mounts that lie where she is — smoke, kegs — and those that burn the hold's oil or deepen a curse stay the
 *  wheel's). */
const MOUNT_SHOT: Partial<Record<string, 'round' | 'chain' | 'grape'>> = { long_tom: 'round', chain_gun: 'chain', swivel_gun: 'grape' };
/** …and how many of it a blast takes (mounts.ts): with fewer aboard the mount was refused every two seconds. */
const MOUNT_SHOTS: Partial<Record<string, number>> = { long_tom: 1, chain_gun: 3, swivel_gun: 2 };
const MOUNT_AUTO = new Set(['mortar', 'harpoon', 'chain_gun', 'swivel_gun', 'long_tom', 'rocket_frame', 'net_thrower']);
let mountAt = 0;
function autoMount(): void {
  const self = state.self, you = state.you, own = state.ownDisplay;
  const m = self?.loadout.mount;
  if (!m || !self || !you || !own || self.dockedAt || !MOUNT_AUTO.has(m) || settings().expertGuns || !settings().autoFire) return;
  if (you.reload.mount < 1 || performance.now() - mountAt < 2000 || !you.combat) return;
  const shot = MOUNT_SHOT[m];
  if (shot && you.ammo[shot] < (MOUNT_SHOTS[m] ?? 1)) return;
  const id = state.pursuit?.target ?? targetId;
  const s = id !== null ? state.ships.get(id) : undefined;
  if (!s || !(s.cur.flags & SF.HOSTILE || state.pursuit) || s.cur.flags & (SF.SINKING | SF.SURRENDERED)) return;
  const d = dist(own.x, own.y, s.cur.x, s.cur.y), def = MOUNTS[m];
  if (d < def.minRange || d > def.range) return;
  mountAt = performance.now();
  net.send({ t: 'mount', x: Math.round(s.cur.x), y: Math.round(s.cur.y) });
}

/** Her mark on one line (docs/23 items 28, 31): name, level, hull and crew, the boarding chance. */
function seaTarget(): TargetInfo | null {
  // A creature stack marked (docs/19 D7): its name and level on the line (a tap opens its card).
  const rf = !targetPinned && !state.pursuit ? roamFocus() : null;
  if (rf?.marked) return { name: roamName(rf.v.kind), level: rf.v.level, icon: ROAM_UNITS[ROAMS[rf.v.kind].u as keyof typeof ROAM_UNITS].art };
  const id = state.pursuit?.target ?? targetId;
  const s = id !== null ? state.ships.get(id) : undefined;
  if (!s?.info || id === null) return null;
  const od = state.boardOdds.get(id);
  const odds = od && performance.now() / 1000 - od.at < 15 ? od : null;
  const beast = beastOfClass(s.info.classId);
  const name = beast ? BEASTS[beast].name[lang() === 'ru' ? 1 : 0] : s.info.isPlayer ? s.info.captainName : placeName(s.info.name);
  const colours = flagLine(shipColours(s.cur.flags, s.info)); // docs/24 D2: her flag on the line
  return {
    name, hull: s.cur.hull,
    ...(colours ? { colours } : {}),
    ...(beast ? {} : { crew: s.cur.crew }),
    ...(s.info.shipLevel ? { level: s.info.shipLevel, threat: threatTo(s.info.shipLevel, s.info.classId) } : {}),
    ...(odds ? { chance: odds.chance } : {}),
    ...(markRange() ? { range: markRange()! } : {}),
  };
}

function seaFrame(): void {
  const self = state.self, you = state.you;
  if (!self || !you) return;
  advCard.autoFold = true; // the adventure map's card waits on «Действие» (its «Осмотреть»)
  const a = curActs[0];
  // (owner, 2026-10-17) the counter counts her quests, contracts and the orders not yet done too: the sheet lists them
  const news = TOUCH_FOLDED.filter((id) => {
    const e = document.getElementById(id);
    return !!e && !e.classList.contains('hidden');
  }).length + goalCount(goalSheetView(self));
  // her letters only (owner, 2026-10-29: «чат все равно показывает 1, я захожу в чат и там ниче нету» — a letter's count
  // stood on the menu's chat tile): the chat's count is on its own button (chat.ts)
  const unread = Number(($('unread').textContent ?? '').replace(/\D/g, '')) || 0;
  // A fight on or near: her mark (picked by her: no auto-mark, owner 2026-10-29), her guns busy, the helmsman after one.
  const fight = !self.dockedAt && (targetId !== null || !!state.pursuit || !!you.combat);
  // A world boss as her mark: its slim line steps aside for her mark's (owner, 2026-10-07: «OLD MOORINGS» twice).
  document.body.classList.toggle('sea-boss-target', targetId !== null && (state.bosses.some((b) => b.id === targetId) || state.ships.get(targetId)?.info?.npcRole === 'boss'));
  tideVeil(state); // docs/19 E16: the black tide's veil over its region's sea
  seaHud.frame({
    docked: !!self.dockedAt,
    touch: touch.enabled,
    deck: touch.enabled ? null : deckView(),
    keys: touch.enabled ? null : deskKeys(),
    fight,
    // (every other thing to do small beside it, none behind a «+N»: owner, 2026-10-18 — «должны быть видны все действия сразу»)
    act: a ? { id: a.id, icon: a.icon, label: a.label, ...(a.sub ? { sub: a.sub } : {}), extra: curActs.slice(1).map((x, j) => ({ i: j + 1, id: x.id, icon: x.icon, label: x.label, ...(x.sub ? { sub: x.sub } : {}) })) } : null,
    special: specialNow(),
    target: self.dockedAt ? null : seaTarget(),
    ammo: you.ammoSel,
    ammoN: you.ammo[you.ammoSel] ?? 0,
    reload: Math.max(you.reload.port, you.reload.starboard),
    news,
    unread,
    markId: targetId,
    mmShow: settings().mmTarget === 'show',
  });
  hudMore.frame(simpleHud() && !state.onboarding?.stage);
  seaAbil.frame(touch.enabled && simpleHud() && !self.dockedAt ? abilView() : null);
  seaSkill.frame(touch.enabled && simpleHud() && !self.dockedAt ? skillView() : null);
}

/** One simple sea HUD for every input (owner, 2026-10-07), unless the detailed interface is asked for. */
function simpleHud(): boolean {
  return document.body.classList.contains('simple');
}

/** The desk's keys as the chips on the controls read them (owner, 2026-10-07: «на пк чисто через wasd и другие
 *  клавиши» — and the controls drawn, the keys on their rims instead of a line of words). */
function deskKeys(): SeaKeys {
  return {
    fire: keyOfAction('fire'), target: keyOfAction('target'), menu: 'Esc', map: keyOfAction('map'),
    up: keyOfAction('sailUp'), down: keyOfAction('sailDown'), left: keyOfAction('rudderLeft'), right: keyOfAction('rudderRight'),
    dash: keyOfAction('dash'), cast: keyOfAction('dock'),
  };
}

/** The captain's abilities as the phone's «Приёмы» shows them (the desk's deckView, with what the card says). */
function abilView(): AbilView[] | null {
  const self = state.self, you = state.you;
  if (!self || !you || self.dockedAt) return null;
  const now = state.estServerTime();
  return CAPTAINS[self.captain].abilities.map((a) => {
    const locked = a.kind === 'ultimate' && self.level < 6;
    const charging = a.kind === 'ultimate' && !locked && you.resolve < 100;
    const dread = (a.dreadCost ?? 0) > you.dread;
    const gold = !!a.goldCost && self.gold < a.goldCost;
    return {
      id: a.id, art: `ab_${a.id}`, name: a.name, description: a.description, ult: a.kind === 'ultimate',
      cooldown: a.cooldown * (state.ownStats?.cooldownMul ?? 1), left: Math.max(0, (self.cooldowns[a.id] ?? 0) - now),
      ...(locked ? { locked: seaWord('lv6') } : {}), dim: locked || charging || dread || gold,
      charge: charging ? you.resolve / 100 : null,
      ...(charging ? { why: abilWhy('resolve', Math.round(you.resolve)) } : dread ? { why: abilWhy('dread', a.dreadCost ?? 0) } : gold ? { why: abilWhy('gold', a.goldCost ?? 0) } : {}),
    };
  });
}

/** «Умения» on a phone (owner, 2026-10-29): her active talents and the deck mount, their cooldowns; none yet — one dim
 *  entry that says where they come from (the button stays: it is how a newcomer learns there is more than the shot). */
function skillView(): AbilView[] | null {
  const self = state.self, you = state.you;
  if (!self || !you || self.dockedAt) return null;
  const now = state.estServerTime();
  const out: AbilView[] = activeTalents(self.talents).slice(0, 5).map((tl) => {
    const cd = (tl.active?.cooldown ?? 0) * (state.ownStats?.cooldownMul ?? 1);
    return { id: `t:${tl.id}`, art: `tree_${tl.tree}`, name: tl.name, description: tl.description, ult: false, cooldown: cd, left: Math.max(0, (self.talentCooldowns[tl.id] ?? 0) - now), dim: false, charge: null };
  });
  const m = self.loadout.mount;
  if (m) {
    const def = MOUNTS[m];
    const r = Math.max(0, Math.min(1, you.reload.mount));
    out.push({ id: 'm:', art: `mount_${m}`, name: def.name, description: def.description, ult: false, cooldown: def.reload, left: r >= 1 ? 0 : (1 - r) * def.reload, dim: false, charge: null });
  }
  if (!out.length) out.push({ id: 'none', art: 'tree_command', name: skillWord('skNone'), description: skillWord('skNoneD'), ult: false, cooldown: 0, left: 0, dim: true, charge: null, why: skillWord('skNoneWhy') });
  return out;
}

/** The desk's gun deck (owner, 2026-10-07: «возвращай иконки, обводки графические»): the captain's four abilities
 *  (their cooldowns, an ultimate's lock and resolve) over the shots of the number keys (and the loaded one if it is a
 *  rarer kind), each with its key. */
function deckView(): DeckSlot[] | null {
  const self = state.self, you = state.you;
  if (!self || !you || self.dockedAt) return null;
  const now = state.estServerTime();
  const out: DeckSlot[] = [];
  for (const a of CAPTAINS[self.captain].abilities) {
    const locked = a.kind === 'ultimate' && self.level < 6;
    const charging = a.kind === 'ultimate' && !locked && you.resolve < 100;
    const starved = (a.dreadCost ?? 0) > you.dread || (!!a.goldCost && self.gold < a.goldCost);
    const left = Math.max(0, (self.cooldowns[a.id] ?? 0) - now);
    out.push({
      kind: 'abil', id: a.id, art: `ab_${a.id}`, key: keyOfAction(`ability${a.key}` as Action), name: a.name, title: `${a.name} — ${a.description}`,
      ult: a.kind === 'ultimate', ...(locked ? { locked: seaWord('lv6') } : {}), dim: locked || charging || starved,
      charge: charging ? you.resolve / 100 : null, cd: left > 0 ? Math.min(1, left / Math.max(1, a.cooldown * (state.ownStats?.cooldownMul ?? 1))) : 0, left,
    });
  }
  AMMO_IDS.forEach((a, i) => {
    if (i >= KEYED_AMMO && you.ammoSel !== a) return;
    const key = i < KEYED_AMMO ? keyOfAction(`ammo${i + 1}` as Action) : a === 'cursed' ? keyOfAction('cursedShot') : '';
    const role = a === 'round' || a === 'chain' || a === 'grape' ? ` (${LSF(`ammo.${a}`)})` : '';
    out.push({
      kind: 'shot', id: a, art: `ammo_${a}`, key, name: AMMO[a].name, n: you.ammo[a] ?? 0, sel: you.ammoSel === a, best: hud.bestAmmo === a, dim: (you.ammo[a] ?? 0) <= 0,
      title: `${AMMO[a].name}${role}${hud.bestAmmo === a ? ` · ${LSF('ammo.best')}` : ''} — ${AMMO[a].description}`,
    });
  });
  return out;
}

/** A ship as the attack cursor needs her: may she be fought, may a grapple take her, is she in the grapples' reach. */
function shipFight(id: number): { attackable: boolean; boardable: boolean; inReach: boolean } | null {
  const s = state.ships.get(id);
  if (!s?.info) return null;
  const inReach = boardWhy(id) === null; // alongside (owner, 2026-10-22)
  return { attackable: attackable(id) && !(s.cur.flags & SF.SURRENDERED), boardable: !unboardableMark(id) && !grabbed(), inReach };
}

/** The attack cursor (owner, 2026-10-07: «при наведении на цель показывать иконку атаки»): what she may fight under the
 *  mouse — a ship (the grapples' reach: the hook; no grapple takes her: the gun; else the sabres), a creature stack, a
 *  lair or a pirate fort — the mark of how the fight would go (ui/cursor.ts, seahud.css). */
function attackUnder(px: number, py: number): AttackKind | null {
  const id = shipAtScreen(px, py);
  if (id !== null) {
    const ship = shipFight(id);
    return ship ? attackKind({ ship }) : null;
  }
  const rm = roamAtScreen(px, py);
  if (rm !== null) {
    const v = state.roams.find((x) => x.id === rm);
    return attackKind({ stack: v?.fight !== 'other' && !(v && roamBackLeft(state, v)) });
  }
  // a lair of the land's creatures, standing and not hers; a pirate fort (its battery still firing: the guns)
  for (const m of state.lairs?.list ?? []) {
    if (m.down || m.flag === 'own' || m.turtle !== undefined) continue;
    const R = Math.max(9, Math.min(26, (m.role === 'guardian' ? 34 : m.role === 'grotto' ? 28 : 24) * renderer.zoom));
    if (Math.hypot(renderer.sx(m.x) - px, renderer.sy(m.y) - py) <= R * 1.3 + 4) return attackKind({ lair: { battery: false } });
  }
  for (const l of state.wanted?.lairs ?? []) {
    if (Math.hypot(renderer.sx(l.x) - px, renderer.sy(l.y) - py) <= Math.max(18, 62 * renderer.zoom)) return attackKind({ lair: { battery: l.hp > 0 && !l.open } });
  }
  return null;
}

/** The target's choices beside her (owner, 2026-10-07: «наводя на кого-то пальцем или на десктопе мышкой, надо
 *  предлагать захват цели и преследование и бой»): ui/targetmenu.ts. Only what the server would take now is offered. */
const targetMenu = new TargetMenu();
targetMenu.onPick = (id, about) => pickTargetChoice(id, about);
/** The mouse resting this long on a target opens its choices (a desk). */
const TM_DWELL = 140;
/** A finger's choices go by themselves after this long untouched (a phone). */
const TM_IDLE = 6000;

/** «Она в бою» once a tap (not once a frame), when she would be touched. */
let inBattleSaidAt = -1e9, inBattleSaidOf = -1;
function inBattleSaid(id: number): void {
  const now = performance.now();
  if (id === inBattleSaidOf && now - inBattleSaidAt < 4000) return;
  inBattleSaidAt = now;
  inBattleSaidOf = id;
  hud.toast(seaWord('tm.inBattle'), 'info');
}

/** The grapples may take her now: in their reach, a ship a grapple takes, one «На абордаж» offers (gatherActs). */
function canBoardNow(id: number): boolean {
  const s = state.ships.get(id), own = state.ownDisplay, st = state.ownStats, you = state.you;
  if (!s?.info || !own || !st || !you || grabbed() || you.flags & SF.BOARDING) return false;
  const c = s.cur;
  if (c.flags & (SF.SINKING | SF.DOCKED | SF.PROTECTED | SF.IN_BATTLE | SF.VOYAGE | SF.SURRENDERED) || unboardableMark(id)) return false;
  if ((s.info.isPlayer || s.info.npcRole === 'escort') && !(c.flags & SF.HOSTILE) && !fairCaptain(c.flags, s.info)) return false;
  return boardWhy(id) === null; // alongside only (owner, 2026-10-22: reach.ts)
}

/** The choices about a target (`ship:id`, `roam:id`) and where she stands on the screen, or null: nothing to offer. */
function targetChoices(about: string): { choices: TmChoice[]; name: string; x: number; y: number; r: number } | null {
  const [kind, sid] = about.split(':');
  const id = Number(sid);
  const own = state.ownDisplay, you = state.you, self = state.self;
  if (!own || !you || !self || self.dockedAt || !Number.isFinite(id)) return null;
  if (kind === 'ship') {
    const s = state.ships.get(id), f = shipFight(id);
    // Owner, 2026-10-22: a captain in a battle (or just out of one) is out of everyone's reach — said, not silently refused.
    if (s?.info && id !== state.entityId && s.cur.flags & SF.IN_BATTLE) {
      inBattleSaid(id);
      return null;
    }
    // Owner, 2026-10-28 (passage.ts): a captain on a long passage is out of everyone's reach too.
    if (s?.info && id !== state.entityId && s.cur.flags & SF.VOYAGE) {
      hud.toast(LP('other'), 'info');
      return null;
    }
    // …and her own passage leaves her nothing to do with another ship until she arrives
    if (state.voyage && id !== state.entityId) {
      hud.toast(LP('hint'), 'info');
      return null;
    }
    if (!s?.info || !f?.attackable) return null;
    const board = canBoardNow(id);
    const beast = beastOfClass(s.info.classId);
    return {
      name: beast ? BEASTS[beast].name[lang() === 'ru' ? 1 : 0] : s.info.isPlayer ? s.info.captainName : placeName(s.info.name),
      x: renderer.sx(s.cur.x), y: renderer.sy(s.cur.y), r: Math.max(18, SHIP_CLASSES[s.info.classId].length * 0.5 * renderer.zoom),
      choices: [
        { id: 'lock', art: 'item_ranging_glass', label: seaWord('tm.lock'), title: seaWord('tm.lockT'), on: targetPinned && targetId === id },
        { id: 'pursue', art: 'talent_nav_wake_rider', label: seaWord('tm.pursue'), title: seaWord(f.boardable ? 'tm.pursueT' : 'tm.pursueGuns'), on: state.pursuit?.target === id },
        { id: 'fight', art: board ? 'ab_red_hook_boarding' : 'talent_gun_rolling_broadside', label: seaWord('tm.fight'), title: seaWord(board ? 'tm.fightBoard' : 'tm.fightGuns') },
        // A ship of the sea firing on her: the talks (owner, 2026-10-18; the server says who will not bargain).
        ...(!s.info.isPlayer && s.info.npcRole && s.info.npcRole !== 'beast' && s.cur.flags & SF.HOSTILE ? [{ id: 'talk' as const, art: 'faction_free', label: LOUT('cf.tm'), title: LOUT('cf.tmT') }] : []),
        // A peaceful ship of the sea: hire her as a guard (owner, 2026-10-25; the card says why not, the server decides).
        ...(!s.info.isPlayer && s.info.npcRole && (HIRE_ROLES as readonly string[]).includes(s.info.npcRole) && !s.info.named && !s.info.elite && s.info.shipLevel !== undefined && !(s.cur.flags & (SF.HOSTILE | SF.SURRENDERED | SF.SINKING | SF.BOARDING)) ? [{ id: 'hire' as const, art: 'ab_call_escort', label: LHIRE('hr.tm'), title: LHIRE('hr.tmT') }] : []),
      ],
    };
  }
  if (kind === 'roam') {
    const v = state.roams.find((x) => x.id === id);
    if (!v || v.fight === 'other') return null;
    const p = roamNow(state, v);
    const d = dist(p.x, p.y, own.x, own.y);
    if (d > ROAM_SEE) return null;
    const hh = ownHull(state);
    const gap = hh ? roamHullGap(hh, p) : d;
    const choices: TmChoice[] = [{ id: 'lock', art: 'item_ranging_glass', label: seaWord('tm.lock'), title: seaWord('tm.lockT'), on: state.roamMark === id && !targetPinned }];
    // sailing to them: the helmsman's course (no pursuit of a stack but the fight's own run)
    if (gap > ROAM_REACH && worldMap.onAutosail) choices.push({ id: 'pursue', art: 'talent_nav_wake_rider', label: seaWord('tm.pursue'), title: seaWord('tm.pursueStack') });
    // the boats go (or the helmsman runs her in first): not under fire, nor with too few hands, nor while another
    // fight holds her (roamers.ts fightWhy — the server's «Не под огнём» never answers a choice offered here)
    if (!v.fight && !roamBackLeft(state, v) && !you.combat && you.crew >= 3 && !(you.flags & SF.BOARDING) && !self.landing) choices.push({ id: 'fight', art: 'bt_charge', label: seaWord('tm.fight'), title: seaWord('tm.fightStack') });
    return { name: roamName(v.kind), x: renderer.sx(p.x), y: renderer.sy(p.y), r: Math.max(14, Math.min(22, 19 * renderer.zoom)) * 1.3, choices };
  }
  return null;
}

/** A choice taken: the mark, the pursuit, the fight — by the messages the action button sends. */
function pickTargetChoice(id: TmId, about: string): void {
  const [kind, sid] = about.split(':');
  const n = Number(sid);
  if (kind === 'ship') {
    if (id === 'talk') return ceasefireCard.ask(n);
    if (id === 'hire') return hireCard.ask(n);
    pinTarget(n); // the pursuit and the fight are about her: she is the mark too
    if (id === 'pursue') net.send({ t: 'attack', target: n, mode: unboardableMark(n) ? 'guns' : 'board' });
    else if (id === 'fight') {
      if (canBoardNow(n)) net.send({ t: 'board', target: n, aggression: 'standard' });
      else net.send({ t: 'attack', target: n, mode: 'guns' });
    }
    return;
  }
  state.roamMark = n;
  targetPinned = false;
  if (id === 'fight') net.send({ t: 'attack', roam: n });
  else if (id === 'pursue') {
    const v = state.roams.find((x) => x.id === n);
    const p = v ? roamNow(state, v) : null;
    if (p && worldMap.onAutosail) {
      const wp = { x: Math.round(p.x), y: Math.round(p.y) };
      setMark(wp);
      worldMap.onAutosail(wp);
    }
  }
}

/** What lies under a point as the choices' subject: `ship:id`, `roam:id` or ''. */
function aboutAt(px: number, py: number): string {
  const ship = shipAtScreen(px, py);
  if (ship !== null) return `ship:${ship}`;
  const rm = roamAtScreen(px, py);
  return rm !== null ? `roam:${rm}` : '';
}

/** The HUD's own controls on the screen now, that the choices keep off (measured a few times a second). */
let hudBoxes: TmRect[] = [], hudBoxesAt = 0;
function hudKeepOut(): TmRect[] {
  const now = performance.now();
  if (now - hudBoxesAt < 250) return hudBoxes;
  hudBoxesAt = now;
  hudBoxes = [];
  for (const el of document.querySelectorAll<HTMLElement>('#hud-captain .cs, #hud-map, #tc-menu, #tc-news, #tc-isle, #tc-more, #tc-offer, #hud-chat > .chat-toggle, #tc-target, #hud-boss, #hud-watch, #tc-stick, #tc-sail, #tc-speed, #tc-fire, #tc-cast, #tc-ammo, #tc-lock, #tc-special, #tc-abil:not(.hidden), #tc-skill:not(.hidden), #tc-act, #tc-deck, #hud-bottom > *, #toasts > .toast')) {
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2 && el.getClientRects().length) hudBoxes.push({ left: r.left - 6, top: r.top - 6, right: r.right + 6, bottom: r.bottom + 6 });
  }
  return hudBoxes;
}

/** Open the choices about a target if there is anything to offer; else put them away. A target under the HUD's own
 *  controls (the mouse cannot be on her there) offers none. */
function openTargetMenu(about: string): void {
  const t = about ? targetChoices(about) : null;
  if (!t || hudKeepOut().some((b) => t.x > b.left && t.x < b.right && t.y > b.top && t.y < b.bottom)) return targetMenu.hide();
  targetMenu.show(about, t.choices, t.name);
  targetMenu.place(t.x, t.y, t.r, hudKeepOut());
}

let hoverAbout = '', hoverSince = 0;
/** Where the mouse is on the page (over the sea or over the HUD). */
const mouseAt = { x: -1, y: -1 };
addEventListener('mousemove', (e) => {
  mouseAt.x = e.clientX;
  mouseAt.y = e.clientY;
}, { capture: true, passive: true });
/** A desk: the mouse resting on a target opens its choices; off it (and off them) they go a moment later. */
function hoverTargetMenu(about: string): void {
  if (touch.enabled) return;
  const now = performance.now();
  if (about !== hoverAbout) {
    hoverAbout = about;
    hoverSince = now;
  }
  if (!about) return targetMenu.leave();
  if (targetMenu.isOpen && targetMenu.about === about) return targetMenu.keep();
  if (now - hoverSince >= TM_DWELL) openTargetMenu(about);
}

/** Every frame: the choices follow their target, change as she comes in reach, and go with her (sunk, gone, a window
 *  over the sea, the hex battle, port; a finger's after a while untouched). */
function targetMenuFrame(): void {
  if (!targetMenu.isOpen) return;
  const ok = inGame && !state.boardTac && !state.boardFight && !state.self?.dockedAt && modal === null && !seaHud.menuOpen && !(touch.enabled && targetMenu.age > TM_IDLE && !targetMenu.hovered);
  const t = ok ? targetChoices(targetMenu.about) : null;
  if (!t) return targetMenu.hide();
  // A desk: the mouse near her (a sailing ship slips from under a still mouse: a little room round her) or on the
  // choices keeps them; on the choices they stand still for the click instead of following her.
  if (!touch.enabled) targetMenu.hoverAt(mouseAt.x, mouseAt.y, Math.hypot(mouseAt.x - t.x, mouseAt.y - t.y) <= t.r + 34);
  targetMenu.show(targetMenu.about, t.choices, t.name);
  if (!targetMenu.hovered) targetMenu.place(t.x, t.y, t.r, hudKeepOut());
}

let hoverAt = 0;
/** The mouse's mark over the sea, measured again as the pointer moves and a few times a second as the sea moves under
 *  it; none on a touch screen, in port, in the hex battle (its own: tactical.ts) or under a window. */
function hoverCursor(px: number, py: number, force = false): void {
  const now = performance.now();
  if (!force && now - hoverAt < 120) return;
  hoverAt = now;
  const live = inGame && !touch.enabled && !state.boardTac && !state.self?.dockedAt && modal === null;
  const kind = live ? attackUnder(px, py) : null;
  hoverTargetMenu(live && kind ? aboutAt(px, py) : '');
  if ((canvas.dataset.cur ?? '') === (kind ?? '')) return;
  if (kind) canvas.dataset.cur = kind;
  else delete canvas.dataset.cur;
}

/** A touch screen has no hover: the same mark stands over the target she marked (a ship or a creature stack), above it
 *  so the ship and her ring stay seen. */
function touchAttackMark(): void {
  const el = document.getElementById('atk-mark');
  if (!el) return;
  // (a ship's name and bars are drawn over her: the mark stands under her hull — over her name when the HUD's own
  // controls lie under her, a ship behind «Атаковать»; a stack's word over it and its name under it: at its left)
  let kind: AttackKind | null = null, box: TmRect | null = null, alt: TmRect | null = null;
  if (touch.enabled && !state.boardTac && !state.self?.dockedAt && modal === null) {
    const rf = !targetPinned && !state.pursuit ? roamFocus() : null;
    const id = state.pursuit?.target ?? (targetPinned ? targetId : null);
    const s = id !== null ? state.ships.get(id) : undefined;
    if (rf?.marked) {
      const p = roamNow(state, rf.v);
      kind = attackKind({ stack: rf.v.fight !== 'other' });
      const r = Math.max(9, Math.min(22, 19 * renderer.zoom)) * 1.2, x = renderer.sx(p.x) - r - 4, y = renderer.sy(p.y);
      box = { left: x - 40, top: y - 20, right: x, bottom: y + 20 };
    } else if (s?.info && id !== null) {
      const ship = shipFight(id);
      kind = ship ? attackKind({ ship }) : null;
      const r = Math.max(14, SHIP_CLASSES[s.info.classId].length * 0.42 * renderer.zoom), x = renderer.sx(s.cur.x), y = renderer.sy(s.cur.y);
      box = { left: x - 20, top: y + r + 2, right: x + 20, bottom: y + r + 42 };
      alt = { left: x - 20, top: y - r - 84, right: x + 20, bottom: y - r - 44 };
    }
  }
  const hits = (b: TmRect) => b.left < 2 || b.top < 2 || b.right > innerWidth - 2 || b.bottom > innerHeight - 2 || hudKeepOut().some((h) => b.left < h.right && b.right > h.left && b.top < h.bottom && b.bottom > h.top);
  if (box && hits(box)) box = alt && !hits(alt) ? alt : null;
  const url = kind && box ? cursorUrl(kind) : null;
  el.classList.toggle('hidden', !url);
  if (!url || !box) return;
  if (el.dataset.kind !== kind) {
    el.dataset.kind = kind!;
    el.style.backgroundImage = `url('${url}')`;
  }
  el.style.transform = `translate(${Math.round(box.left)}px, ${Math.round(box.top)}px)`;
}

/** The captain's gunnery settings to the server (auto-fire, auto-battle against the weak, the expert's hand). */
function sendGunnery(): void {
  const o = settings();
  net.send({ t: 'gunnery', auto: o.autoFire, weak: o.autoWeak, expert: o.expertGuns });
  document.body.classList.toggle('expert-guns', o.expertGuns);
}

/** The boarding chance is asked for a mark this near her at most (metres). */
const ODDS_REACH = 750;
/** The target frame's boarding chance, asked every few seconds (docs/23 item 49). */
let oddsId: number | null = null, oddsAt = 0;
function askOdds(id: number | null): void {
  const now = performance.now();
  if (id === null || !attackable(id)) return;
  const s = state.ships.get(id)!;
  if (s.info!.npcRole === 'beast' || SHIP_CLASSES[s.info!.classId]?.monster || isZoneBossClass(s.info!.classId)) return;
  if (id === oddsId && now - oddsAt < 4000) return;
  // Only within reach of a fight (the server plays the battle out every time it is asked: not for a sail 2.5 km off).
  const own = state.ownDisplay;
  if (!own || dist(own.x, own.y, s.cur.x, s.cur.y) > ODDS_REACH) return;
  oddsId = id;
  oddsAt = now;
  net.send({ t: 'board_odds', id });
}

/** The window before a risky boarding (docs/23 items 49–52): «Рискнуть» throws the grapples, «Отступить» backs off. */
let riskOpen = false;
async function askRisk(r: BoardRisk): Promise<void> {
  if (riskOpen) return;
  riskOpen = true;
  // The UI kit's risk sheet (docs/23 items 13, 49–52): the chance, what a loss costs, what a win brings.
  const go = await riskConfirm({
    target: placeName(state.ships.get(r.target)?.info?.name ?? ''),
    chance: r.chance,
    levelGap: r.theirLevel - r.myLevel,
    lose: { silver: r.silver > 0 ? r.silver : undefined, cargo: r.cargo > 0, men: r.men > 0 ? r.men : undefined, port: true },
    gainXpMul: r.xpMul,
  }).finally(() => (riskOpen = false));
  if (go) net.send({ t: 'board', target: r.target, aggression: 'standard', risk: true });
  else if (state.pursuit?.target === r.target) net.send({ t: 'attack', stop: true });
}

/** Boats away to a sea mark: at speed the crew takes in sail first and they go as soon as she has slowed. */
function workMark(id: number): void {
  const own = state.ownDisplay;
  // (seaux: out of reach the order goes at once — the helmsman sails her there and the server gives it alongside)
  const m = state.seaMarks.get(id);
  const h = ownHull(state);
  if (own && m && h && !markInReach(m, h)) {
    pendingMark = null;
    return void net.send({ t: 'seamark', action: 'work', id });
  }
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
  if (f && findFar(f)) {
    pendingFind = null;
    return void net.send({ t: 'seafind', action: 'work', id }); // seaux: the helmsman sails her there (approach.ts)
  }
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
/** The pad's wheel (a held shoulder or the d-pad): the kit's wheel (ui/kit/radial.ts) in the screen's middle, its
 *  choice lit by the stick and taken on release. */
type RadialItem = { label: string; run: () => void; icon?: string; count?: number };
let radial: { items: RadialItem[]; opener: number } | null = null;

function activePad(): Gamepad | null {
  for (const g of navigator.getGamepads?.() ?? []) if (g && g.connected) return g;
  return null;
}

function openRadial(items: RadialItem[], opener: number): void {
  radial = { items: items.slice(0, 8), opener };
  wheel.open(innerWidth / 2, innerHeight / 2, radial.items.map((it, i) => ({ id: String(i), label: it.label, icon: it.icon, glyph: '•', count: it.count })));
}

function closeRadial(choose: boolean): void {
  if (!radial) return;
  const items = radial.items;
  radial = null;
  const o = wheel.close(choose);
  if (o) items[Number(o.id)].run();
}

function ammoRadial(): RadialItem[] {
  return AMMO_IDS.filter((a) => (state.self?.ammo[a] ?? 0) > 0 || a === 'round').map((a) => ({ label: AMMO[a].name, icon: `ammo_${a}`, count: state.self?.ammo[a] ?? 0, run: () => net.send({ t: 'ammo', ammo: a }) }));
}

function actionsRadial(): RadialItem[] {
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
function padContext(id?: string): void {
  if (state.self?.dockedAt && !grabbed()) return void (touch.enabled && modal !== 'port' ? openModal('port') : departOrAsk(state, (m) => net.send(m), () => net.send({ t: 'undock' })));
  const first = liveAct(id) ?? gatherActs().acts[0];
  if (first) runAct(first);
}
/** The acts shown on the bar a moment ago, by id: a button still on the screen as the list changed under the finger
 *  (it fades out over ACT_OUT_MS) does what it says — and the server tells why if it cannot. */
const actsShown = new Map<string, { a: Act; at: number }>();
function liveAct(id: string | undefined): Act | undefined {
  if (!id) return undefined;
  const now = curActs.find((x) => x.id === id);
  if (now) return now;
  const was = actsShown.get(id);
  return was && performance.now() - was.at < 3000 ? was.a : undefined;
}

/** Off her own island or in a harbour by it (within reach of the quay, LOCAL_R): a step done on the island opens its
 *  screen there (mid-game QA 2026-10-23: «Заложите постройки» read «Плыть» with her ship at her island). */
function isleNear(): boolean {
  if (nearHome() || isleScene.isOpen) return true;
  const id = state.self?.homeIsle, docked = state.self?.dockedAt;
  if (id === null || id === undefined || !docked) return false;
  const isl = state.islands.get(id), port = state.ports.find((p) => p.id === docked);
  return !!isl && !!port && Math.hypot(port.x - isl.x, port.y - isl.y) - isl.r <= ISLE_NEAR_PORT;
}
const ISLE_NEAR_PORT = 1500;

/** Lying off one's own island (docs/15): the way into its base. */
function nearHome(): { name: string } | null {
  const id = state.self?.homeIsle;
  const own = state.ownDisplay;
  if (id === null || id === undefined || !own || state.self?.dockedAt) return null;
  const isl = state.islands.get(id), h = ownHull(state);
  // (owner, 2026-10-22: her hull lying off its coast, REACH_MOOR — reach.ts — not 900 m off its rim)
  if (!isl || !h || shoreGap(h, isl, isl.r, REACH_MOOR) > REACH_MOOR) return null;
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
/** When the renewed request last went (a refusal right after it is the harbour's answer). */
let dockSentAt = -1e9;
function requestDock(bribe: boolean, refused = false): void {
  if (refused) {
    state.input.sail = 0;
    if (!pendingDock) hud.toast(L('reefToDock'), 'info');
    pendingDock = { bribe, until: performance.now() + 25000, next: performance.now() + 1500 };
    return;
  }
  // Always the harbour's own answer (QA 2026-10-22, «Причалить» did nothing): under way she is hove to by the server
  // and put in as soon as she slows (underfire.ts WAY_WORDS) — the helmsman's course dropped with it; any other
  // refusal comes back with its reason. (The page's own wait for her to slow never told the helmsman, who kept her
  // under sail: 25 s of nothing.)
  state.input.sail = 0;
  dockSentAt = performance.now();
  net.send({ t: 'dock', bribe });
}
/** The nearest harbour «В порт» would sail to (the First Watch's last step), and the one the helmsman is sailing to:
 *  in the harbour's reach she puts in by herself — one tap from the open sea to the quay. */
let homeport: ClientState['ports'][number] | null = null;
/** When she last cast off (the page's clock), and how long «В порт» keeps quiet after it (ms). */
let castOffAt = -1e9, wasDocked = false;
/** The open sea drawn once in this page (its pictures are in: a cast-off after it needs no loading screen). */
let seaSeen = false;
const CAST_OFF_QUIET = 30_000;
let homeRun: string | null = null, homeRunAt = 0;
function stepPendingDock(): void {
  if (homeRun) {
    const own = state.ownDisplay, p = state.ports.find((x) => x.id === homeRun);
    // In the harbour's reach she puts in (the helmsman's «arrived» comes at the open water off the quay); the helmsman
    // gave the wheel back short of it (a sail in sight, a shot): the run is off, and «В порт» shows again.
    if (state.self?.dockedAt || !p || !own) homeRun = null;
    else if (dist(p.x, p.y, own.x, own.y) < PORT_DOCK_RADIUS) {
      homeRun = null;
      requestDock(false);
    } else if (!state.autosail && performance.now() - homeRunAt > 2500) homeRun = null;
  }
  if (!pendingDock) return;
  const own = state.ownDisplay;
  if (state.self?.dockedAt || performance.now() > pendingDock.until || state.input.sail > 0) {
    // Run out of time still at sea (she never slowed: a current, the wind, a pull of the stick): said, not dropped
    // (docs/23 item 93: «убираем паруса», then nothing) — and so is her own hand on the sails calling it off.
    if (!state.self?.dockedAt && (performance.now() > pendingDock.until || state.input.sail > 0)) hud.toast(L('dockGaveUp'), 'bad');
    pendingDock = null;
    return;
  }
  if (own && own.speed <= DOCK_SLOW - 0.5 && performance.now() >= pendingDock.next) {
    // Keep the request until the harbour answers: a refusal (still too fast) renews it.
    pendingDock.next = performance.now() + 1500;
    dockSentAt = performance.now();
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
    wheel.select(radialSector(sx, sy, radial.items.length));
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
        padAim = { side: e.b === BTN.LT ? 'port' : 'starboard', range: padAim?.range ?? 150, lead: 0 };
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
    padAim.range = clamp(padAim.range - ry * 225 * dt, 30, 450); // (to the mortar's 450 m, the longest reach afloat)
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

/** The nearest ship toward the right stick (or simply the nearest) within 750 m. */
function lockTarget(rx: number, ry: number): number | null {
  const own = state.ownDisplay;
  if (!own) return null;
  let best: number | null = null, score = Infinity;
  const aim = Math.hypot(rx, ry) > 0.3 ? Math.atan2(rx, -ry) : null;
  for (const s of state.ships.values()) {
    if (s.id === state.entityId) continue;
    const d = dist(s.cur.x, s.cur.y, own.x, own.y);
    if (d > 750) continue;
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
  const sticky = under?.closest('button, a, input, select, .captain-card, [data-tab], [data-id], [role="tab"]') ? 0.45 : 1;
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
      // The phase 6 windows' rail tabs (.w-tab, marked .on) as well as the older windows' tabs.
      const tabs = [...$('modal-panel').querySelectorAll<HTMLElement>('.w-tab:not(.w-tab--go), .tab, [data-tab]')];
      const i = tabs.findIndex((x) => x.classList.contains('active') || x.classList.contains('on'));
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
    const docked = !!state.self?.dockedAt;
    if (wasDocked && !docked) {
      // out of the harbour: what the open sea shows now (ships, islands, flags) in before it is seen — the first time in
      // this page only (owner, 2026-10-16: «есть лаги когда я захожу в порт и пытаюсь отплыть»: every «В море» put the
      // loading screen up for 0.6–6 s over a sea whose pictures were all in already)
      if (!seaSeen) beginLoad('sea', 6000).settle().done();
      castOffAt = performance.now();
      goalOnCastOff(); // ux2: «Курс к заданию»
    }
    wasDocked = docked;
    if (!docked && state.ownDisplay) seaSeen = true;
    stepPendingDock();
    stepGoal(); // ux2: the run to a quest's place
    stepClaimRun();
    stepPendingMark();
    stepPendingFind();
    state.updateRemote();
    const own = state.updateOwn();
    // The island screen (owner, 2026-10-15): the sea is not drawn under it, nor its HUD — the phone's battery and CPU.
    // A boarding or a deck fight takes her back to the sea.
    if (isleScene.isOpen) {
      if (state.boardTac || state.boardFight || state.self?.company.mutiny) leaveIsle(false);
      else {
        if (own) audio.listener = { x: own.x, y: own.y };
        // the island's first steps (owner, 2026-10-28): the finger on the building's «Построить» over the island too
        tutorPointer.set({ stage: isleFirstStage(), touch: touch.enabled, docked: !!state.self?.dockedAt, battle: false });
        tutorPointer.frame();
        return;
      }
    }
    // Touch has no hovering cursor: no aim arcs follow it (the broadside buttons aim themselves).
    const held = chargeHeld();
    if (held && touch.enabled) touchAim(held.side);
    aimSide = held ? held.side : touch.enabled ? null : sideUnderCursor();
    const prompt = computePrompt();
    const range = markRange();
    sceneWarm(state, t);
    renderer.render(state, own, dt, { side: aimSide, dist: aimDistance(), boardTarget, chaser: touch.enabled || held ? null : chaserEndUnderCursor(), charge: held, target: state.pursuit?.target ?? targetId, range });
    if (($('hud-target').dataset.range ?? '') !== (range ?? '')) {
      if (range) $('hud-target').dataset.range = range;
      else delete $('hud-target').dataset.range;
    }
    if (own) audio.listener = { x: own.x, y: own.y };
    audio.ambience(state.wind[1], state.weather, dt);
    if (own) {
      // The score follows the scene (docs/07 §10.4); the rigging creaks with the load; the bells keep the watch.
      const hostileNear = [...state.ships.values()].some((x) => x.cur.flags & SF.HOSTILE && dist(x.cur.x, x.cur.y, own.x, own.y) < 600);
      audio.frame(dt, {
        docked: !!state.self?.dockedAt,
        combat: !!state.you?.combat,
        chased: hostileNear,
        weather: state.weather,
        region: state.region,
        anomaly: state.bosses.some((b) => dist(b.x, b.y, own.x, own.y) < 3000),
        isle: !document.getElementById('isle')?.classList.contains('hidden') && !!document.getElementById('isle'),
        tactical: !!state.boardTac,
      }, state.wind[1], own.sail, Math.abs(shipHeel(own.heading, state.wind[0], state.wind[1], own.sail, SHIP_CLASSES[state.self!.loadout.classId].tier, state.you?.water ?? 0, 0)), timeOfDay(state.estServerTime()), !state.self?.dockedAt);
    }
    hud.castKey = touch.enabled ? '' : ` (${keyOfAction('land')})`; // a phone has its button, not a key
    isleBtnFrame();
    homeBtnFrame();
    hud.hauling = netHaul.active;
    hud.update(state, prompt);
    autosailPill.draw(state);
    passagePill.draw(state);
    drawSeaOrders($('hud-orders'), state, (m) => net.send(m), () => openHero('book'));
    easeSecond(t, own);
    firstTips.frame(t);
    targetId = resolveTarget();
    // The glass is turned on her mark at sea, not while her men fight on a deck.
    askGlass(state.boardTac ? null : targetId);
    if (!state.boardTac) askOdds(targetId); // the boarding chance on the target line (docs/23 item 49)
    hud.bestAmmo = bestShot(); // docs/23 item 39
    hud.drawTarget(state, targetId);
    // The sea HUD (docs/23 phase 2): on a touch screen, and on a desk unless the detailed interface is asked for
    // (owner, 2026-10-07: one simple interface everywhere — the desk had only the old bar, and in the First Watch nothing).
    if ((touch.enabled || simpleHud()) && state.self) {
      const dashLeft = Math.max(0, (state.self.dashReadyAt ?? 0) - state.estServerTime());
      touch.frame(own?.heading ?? null, state.input.sail, dashLeft / DASH_COOLDOWN, state.you && !state.self.dockedAt ? knots(state.you.spd) : '');
      seaFrame();
      autoMount();
    }
    hoverCursor(renderer.mouseX, renderer.mouseY);
    lawlessFrame();
    edgeFrame();
    touchAttackMark();
    targetMenuFrame();
    divePanel.render(state.dive);
    boardFight.render(state.boardFight);
    tactical.render(state.boardTac);
    boardingCardFrame();
    filmMoments();
    passageFrame();
    const op = openingFrame();
    const here = op ? null : hereFrame() ?? storyFrame();
    // (the guns empty on a ship's step: the finger to «Припасы» first — a newcomer's run of 2026-10-24)
    const shot = shotStage(op ?? storyQuest()?.does, state.self?.ammo);
    tutorPointer.set({ stage: state.onboarding?.stage ?? shot ?? isleFirstStage() ?? (op ? `c:${op}` : here), touch: touch.enabled, docked: !!state.self?.dockedAt, battle: !!state.boardTac || !!state.boardFight, helmsman: !!state.autosail || homeRun !== null || !!pendingDock, pursuit: state.pursuit?.mode ?? null, tradeGood: op === 'buy:trade' ? tradeGoodHere() : null, crewFull: !!state.you && state.you.crew >= state.you.crewMax, markBeast: attackMark !== null && state.ships.get(attackMark)?.info?.npcRole === 'beast', crewShort: !!state.you && state.you.crew < 3, noHire: !!state.self?.noHire });
    tutorPointer.frame();
    encounterCard.frame();
    surrenderCard.frame(state);
    ceasefireCard.frame(state);
    hireCard.frame(state);
    hireChip.frame(state);
    fishFight.frame();
    netHaul.frame();
    // The chart once a second; four times while a signal flag pulses on it (docs/16 #35).
    const tick = state.signals.length && liveSignals(state).length ? 250 : 1000;
    if (modal === 'map' && Math.floor(t / tick) !== Math.floor((t - dt * 1000) / tick)) worldMap.draw(state);
  }
}
requestAnimationFrame(frame);
// Real-device telemetry (docs/33): what the player looks at, for the frame rate's histogram.
startTelemetry(() => (!inGame ? 'menu' : tactical.open ? 'battle' : isleScene.isOpen ? 'isle' : state.self?.dockedAt ? 'port' : 'sea'));
setInterval(() => net.send({ t: 'ping', c: performance.now() }), 5000);

// Debug handle for the console.
(globalThis as unknown as { gravetide: unknown }).gravetide = { state, renderer, net, isle: isleScene, assets: () => ({ ...assetStats(), loads: loadLog.slice(), kinds: assetKinds() }), open: (m: Modal) => (m === 'company' ? openMenuItem('company') : m === 'base' ? openBase() : m === 'hero' ? openHero() : m === 'throne' ? openThrone() : m === 'shop' ? openShop() : openModal(m)), throne: (tab?: string) => openThrone(tab), shop: (topup?: boolean) => openShop(topup), cos: { shop: (sec?: string) => openShop(false, { tab: 'cos', sec: sec as 'cos_titles' | undefined }), wardrobe: () => openWardrobe() }, promos, dailyGift, hero: (tab?: CaptainOpen) => openHero(tab), prologue: () => playPrologue(() => {}), hud, onboarding, fight: boardFight, tactical, chart: worldMap, land: sendLand, riskOpen: () => riskOpen, target: (id: number) => pinTarget(id), seaHud, aim: { under: attackUnder, about: aboutAt, choices: targetChoices, menu: targetMenu }, roamNow: (id: number) => { const v = state.roams.find((x) => x.id === id); return v ? roamNow(state, v) : null; }, goal: (key: string) => startGoal(key), goalRun: () => goalRun?.key ?? null, modal: () => modal, tapGoal: (x: number, y: number) => sailToTap(x, y), portCard: (id: string) => openPortCard(state, id), portLabelAt: (x: number, y: number) => portLabelAt(x, y) };
