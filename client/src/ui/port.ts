// The port (docs/23 phase 6, item 65): a bottom sheet on a phone with five big places down its rail — Market,
// Shipyard, Tavern, Quests and the gold «В море» — and a second row for the rest (the harbour master, holdings, the
// exchange, the auction, dice, rumours, charts, the army, pets, tattoos). Each place leads with what it is opened
// for, in one tap: «Продать всё», «Припасы», «Починить», the upgrade «было → стало», the hire slider, the three best
// quests; the full lists stay below for those who trade by hand.

import { EN as ISLES_EN, RU as ISLES_RU } from '../lang/ui/isles.ts';
import { omenLog } from './journal.ts';
import { regattaCard } from './regatta.ts';
import { diceCard } from './dice.ts';
import { PETS } from '../../../shared/src/data/companions.ts';
import { petIcon } from './companion.ts';
import { nemesisPoster } from './nemesis.ts';
import type { TipView } from '../../../shared/src/protocol.ts';
import { namedPirates } from '../../../shared/src/data/pirates.ts';
import type { WantedPoster } from '../../../shared/src/protocol.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { levelRange, shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { isResearched, researchQuote } from '../../../shared/src/data/research.ts';
import { EN as REN, RU as RRU } from '../lang/ui/research.ts';
import { ask, tell } from './confirm.ts';
import { mapCard, placeName } from './maps.ts';
import { trophyLine, trophyTag } from './surrender.ts';
import { personName } from '../lang/names.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { AMMO, AMMO_IDS, GUNS, MODULES, MOUNTS, SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { MountId, ShipClassId } from '../../../shared/src/data/ships.ts';
import type { ClientMsg, PortView, RefitView } from '../../../shared/src/protocol.ts';
import { ownLevelChip } from './levels.ts';
import { cargoVolume, computeShipStats } from '../../../shared/src/sim/shipstats.ts';
import { BUILD_TIME, FIGUREHEADS, RARES, VARIANTS, WOODS, buildMaterials } from '../../../shared/src/data/shipbuild.ts';
import type { FigureheadId, RareSlot, ShipBuild, WoodId } from '../../../shared/src/data/shipbuild.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { ClientState } from '../state.ts';
import { assetUrl } from '../assets.ts';
import { dec1, esc, fishIcon, fmt, icon, money, officerIcon, quote, xpBadge } from './dom.ts';
import { keyLabel, settings } from '../settings.ts';
import { OFFICER_DEFS, PROFESSIONS, PROFESSION_DEFS } from '../../../shared/src/data/crew.ts';
import type { Profession } from '../../../shared/src/data/crew.ts';
import { traitChips } from './crew.ts';
import { dict, lang, plural } from '../i18n.ts';
import { commonCard, dailyCard } from './daily.ts';
import { invasionCard } from './invasion.ts'; // docs/19 E16
import { giverDialog } from './giver.ts';
import { EN, RU } from '../lang/ui/port.ts';
import { serverText } from '../lang/server.ts';
import { sendService, serviceCard } from './marque.ts';
import { captivesCard } from './turncoats.ts';
import { holidayCard } from './holidays.ts';
import { bazaarAct, bazaarCard, bindBazaar } from './bazaar.ts';
import { departOrAsk, voyageOrder, voyageShip } from './depart.ts';
import { VOYAGE_MINUTES, voyageCrew, voyageNeeds } from '../../../shared/src/data/voyage.ts';
import { chipRow, figure, keepFolds, more, quickBar, quickBtn, railTabs, rangeHtml, sec, wasBecomes, winHead } from './kit/window.ts';
import type { QuickBtn, WinTab } from './kit/window.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../lang/ui/win.ts';
import { auctionCard, bindDealings, dealingsAct, hearsayCard, repairCompare, runsCard } from './dealings.ts';
import { dwellCard, tamerCard } from './recruit.ts';
import { FLAGS_TAB, bindColours, coloursCard } from './flags.ts';
import { admiraltyBoard, bindContracts } from './contracts.ts'; // docs/19 E15

/** A generated job's picture by its kind (docs/11 P4). */
const JOB_ICON: Record<string, string> = {
  delivery: 'good_provisions', hunt: 'fire', rescue: 'map_cove', scouting: 'menu_map', smuggling: 'good_dreamleaf', treasure: 'map_treasure',
  diplomacy: 'map_contract', revenge: 'danger', investigation: 'ab_spotters_eye', elite: 'danger',
};
const L = dict(EN, RU);
const RL = dict(REN, RRU); // the yard's tree of hulls (docs/20)
const LI = dict(ISLES_EN, ISLES_RU);
const W = dict(WIN_EN, WIN_RU);

function licenceLeft(n: number): string {
  return L('licence.left', { n, minutes: plural(n, L('licence.min1'), L('licence.min2'), L('licence.min5')) });
}

type Tab = 'market' | 'shipyard' | 'tavern' | 'quests' | 'harbour' | 'colours' | 'holdings' | 'exchange' | 'auction' | 'dice' | 'rumours' | 'charts' | 'army' | 'pets';

/** The harbour's places by their icons. */
const TAB_ICON = {
  market: 'tab_market', shipyard: 'menu_ship', tavern: 'tab_tavern', quests: 'tab_contracts', harbour: 'anchor', holdings: 'tab_holdings', exchange: 'tab_exchange',
} as const;

/** The biggest single order the harbour takes (server/src/game/ports.ts refuses |qty| > 500). */
const SELL_LOT = 500;
/** Goods that stay aboard when «Продать всё» sells the rest: the crew's food, the carpenters' stores. */
const KEEP_ABOARD = new Set<GoodId>(['provisions', 'planks', 'sailcloth']);

/** What «Продать всё» sells (docs/23 item 66): every trade good in the hold the market takes — not her provisions and
 *  repair stores, not rare shipbuilding stuff, not the cargo a contract of hers carries, not contraband in a lawful
 *  port — and about what it brings. */
export function sellableGoods(state: ClientState): { good: GoodId; n: number; est: number }[] {
  const view = state.portView, self = state.self;
  if (!view || !self) return [];
  const black = !!state.ports.find((p) => p.id === view.portId)?.blackMarket;
  const keep = new Set<GoodId>(KEEP_ABOARD);
  for (const c of self.contracts) if (c.good) keep.add(c.good);
  // …nor what a quest of hers still has to carry somewhere (a «deliver» step now or ahead: 20 barrels of powder for
  // Blackwater went with the rum at one tap, docs/23 item 94).
  for (const q of self.quests ?? []) {
    const steps = QUESTS_BY_ID[q.id]?.steps ?? [];
    for (let i = Math.max(0, q.step - 1); i < steps.length; i++) {
      const st = steps[i];
      if (st.type === 'deliver') keep.add(st.good);
    }
  }
  const out: { good: GoodId; n: number; est: number }[] = [];
  for (const r of view.market) {
    const n = Math.floor(self.cargo[r.good] ?? 0);
    if (n < 1 || keep.has(r.good) || GOODS[r.good].category === 'rare' || r.sell <= 0 || (!r.legal && !black)) continue;
    out.push({ good: r.good, n, est: Math.round(r.sell * n) });
  }
  return out;
}

/** «Продать всё»'s orders: in lots of SELL_LOT at most — the harbour takes no bigger order (ports.ts), and a merchant
 *  hull's 600 rum came back with «Неверное количество» (docs/23 item 93). */
export function sellAllOrders(state: ClientState): ClientMsg[] {
  const out: ClientMsg[] = [];
  for (const x of sellableGoods(state)) for (let left = x.n; left > 0; left -= SELL_LOT) out.push({ t: 'trade', good: x.good, qty: -Math.min(SELL_LOT, left) });
  return out;
}

/** A contract or a quest on the board, as the Quests place shows it. */
interface Offer { kind: 'contract' | 'quest'; id: string; title: string; text: string; art: string; silver: number; xp: number; to?: string; ship?: number; urgent?: boolean; blocked?: string | null; score: number }

/** The board's offers, best for her first (docs/23 item 69): pay and experience, a quest for her ship's level over
 *  one above it, the urgent and the easy (letters to carry) a little ahead, one she cannot take yet last. */
export function bestOffers(view: PortView, state: ClientState): Offer[] {
  const lvl = state.self ? shipLevelOf(state.self.loadout) : 1;
  const fit = (ship?: number) => (!ship || ship <= lvl ? 1 : ship - lvl === 1 ? 0.6 : 0.25);
  const out: Offer[] = [];
  for (const c of view.contracts) {
    const ease = c.kind === 'courier' ? 1.15 : c.kind === 'bounty' ? 0.9 : 1;
    out.push({ kind: 'contract', id: c.id, title: serverText(c.title), text: serverText(c.description), art: contractArt(c), silver: c.reward, xp: c.xp, to: c.toPort, score: (c.reward + c.xp * 3) * ease });
  }
  for (const q of view.questOffers) {
    const art = q.portrait ? `portrait.${q.portrait}` : q.kind === 'legend' ? 'tab_legends' : q.kind === 'path' ? 'menu_crew' : q.kind === 'job' ? JOB_ICON[q.category ?? ''] ?? 'goal' : q.category === 'arc' ? 'tab_legends' : 'goal';
    out.push({ kind: 'quest', id: q.id, title: serverText(q.name), text: `${serverText(q.summary)} ${q.steps.map((t, i) => `${i + 1}. ${serverText(t)}`).join(' ')}`, art, silver: q.silver, xp: q.xp, ship: q.ship, urgent: q.urgent, blocked: q.blocked,
      score: (q.silver + q.xp * 3) * fit(q.ship) * (q.urgent ? 1.4 : 1) * (q.blocked ? 0.05 : 1) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export class PortScreen {
  tab: Tab = 'market';
  qty = 5;
  /** The tavern's slider: how many hands, and the most it could take when it was last drawn (docs/23 item 68). */
  hire: number | null = null;
  hireMax = -1;
  private holding = false;
  private lastPort = '';
  /** The build order being drawn up at the yard. */
  build: { classId: ShipClassId; name: string; frame: WoodId; plank: WoodId; rares: Partial<Record<RareSlot, GoodId>>; figurehead?: FigureheadId; planId?: string; master: boolean } = { classId: 'sloop', name: '', frame: 'pine', plank: 'pine', rares: {}, master: false };
  private send: (m: ClientMsg) => void;
  private onClose: () => void;
  /** Opens the tattoos window (docs/12 P9). */
  openTattoos: (() => void) | null = null;
  /** Opens the recruit window of the port's dwellings (docs/17 H3). */
  openDwell: (() => void) | null = null;
  constructor(send: (m: ClientMsg) => void, onClose: () => void) {
    this.send = send;
    this.onClose = onClose;
  }

  private lastHtml = '';

  render(root: HTMLElement, state: ClientState): void {
    const view = state.portView;
    const self = state.self;
    if (!view || !self) return;
    // A finger on the hire slider: the page waits for it (a redraw would pull the slider from under it).
    if (this.holding && root.querySelector('#tv-hire')) return;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const faction = FACTIONS[port.faction];
    const vol = cargoVolume(self.cargo, state.ownStats?.contrabandVolumeMul ?? 1, state.ownStats?.materialVolumeMul ?? 1, state.ownStats?.provisionVolumeMul ?? 1, state.ownStats?.cursedVolumeMul ?? 1);
    const holdMax = state.ownStats?.holdVolume ?? 0;
    // docs/23 item 65: five big places down the rail (the fifth, gold, casts off), the rest in a second row.
    const yardBadge = view.shipyard.repairCost > 0 ? 1 : 0;
    const crewShort = (state.ownStats ? voyageCrew(state.ownStats) : 0) > self.crew && view.crewAvailable > 0 ? 1 : 0;
    const main: WinTab[] = [
      { id: 'market', icon: TAB_ICON.market, label: W('port.market'), hint: W('port.marketHint') },
      { id: 'shipyard', icon: TAB_ICON.shipyard, label: W('port.yard'), hint: W('port.yardHint'), badge: yardBadge },
      { id: 'tavern', icon: TAB_ICON.tavern, label: W('port.tavern'), hint: W('port.tavernHint'), badge: crewShort },
      { id: 'quests', icon: TAB_ICON.quests, label: W('port.quests'), hint: W('port.questsHint') },
      { id: 'sea', icon: 'stat_sails', label: W('port.sea'), hint: W('port.seaHint'), primary: true },
    ];
    const tv = view.tavern;
    const second: WinTab[] = [
      { id: 'harbour', icon: TAB_ICON.harbour, label: W('port.harbour'), hint: W('port.harbourHint') },
      // docs/24 C1, D1–D2: the colours and «Абордаж: выкл», hoisted only in port.
      { id: 'colours', icon: 'tab_law', glyph: '⚑', label: FLAGS_TAB.label(), hint: FLAGS_TAB.hint() },
      { id: 'holdings', icon: TAB_ICON.holdings, label: W('port.holdings'), hint: W('port.holdingsHint') },
      { id: 'exchange', icon: TAB_ICON.exchange, label: W('port.exchange'), hint: W('port.exchangeHint') },
      { id: 'auction', icon: 'coin', label: W('port.auction'), hint: W('port.auctionHint') },
      ...(tv.dice ? [{ id: 'dice', icon: 'st_luck_up', glyph: '⚂', label: W('port.dice'), hint: W('port.diceHint') }] : []),
      { id: 'rumours', icon: 'tab_letters', label: W('port.rumours'), hint: W('port.rumoursHint') },
      { id: 'charts', icon: 'map_treasure', label: W('port.charts'), hint: W('port.chartsHint') },
      ...(dwellCard(port) || tamerCard(port) ? [{ id: 'army', icon: 'build_barracks', glyph: '⚔', label: W('port.army'), hint: W('port.armyHint') }] : []),
      ...(tv.pets?.length ? [{ id: 'pets', icon: 'menu_crew', label: W('port.pets'), hint: W('port.petsHint') }] : []),
      { id: 'tattoo', icon: 'tattoo_needle', glyph: '✒', label: W('port.tattoo'), hint: W('port.tattooHint'), badge: state.tattoos?.pending.length ?? 0 },
    ];
    // A new harbour opens on its market (the one-tap bar); the same harbour keeps the place she left it on.
    if (view.portId !== this.lastPort) {
      this.lastPort = view.portId;
      this.tab = 'market';
    }
    if (!main.some((t) => t.id === this.tab) && !second.some((t) => t.id === this.tab)) this.tab = 'market';
    // The harbour's own painting behind the band (a town's own where the manifest has it, else her flag's).
    const bg = assetUrl(`bg.port_${port.id}`) ?? assetUrl(`bg.port_${port.faction}`);
    root.style.setProperty('--bg-port', bg ? `url('${bg}')` : 'none');
    const events = state.events.filter((e) => e.port === port.id).map((e) => `${serverText(e.title)}${e.kind === 'blockade' || e.kind === 'armada' ? L('head.blockade') : e.kind === 'epidemic' ? L('head.epidemic') : ''}`);
    const figures = `${events.length ? `<span class="w-fig bad" data-hint="${esc(W('port.event', { what: events.join(' · ') }))}" title="${esc(events.join(' · '))}">⚑</span>` : ''}${figure('coin', fmt(self.gold), W('port.purse'), 'gold')}${figure('tab_market', `${vol.toFixed(0)}/${holdMax.toFixed(0)}`, W('port.hold', { vol: vol.toFixed(0), max: holdMax.toFixed(0) }))}${figure('stat_crew', String(self.crew), W('port.crew', { n: self.crew }))}`;
    const html = `${winHead(placeName(port.name), { crest: `faction_${port.faction}`, sub: `${faction.name} · ${REGIONS[port.region].name}`, figures })}
      <div class="w-frame">${railTabs(main, this.tab, 'ptab')}<div class="w-pane">${chipRow(second, this.tab, 'ptab')}
      <div class="modal-body w-body port-body" data-page="${this.tab}">${this.body(view, state)}</div></div></div>`;
    // The harbour pushes its view every second: an unchanged page is not redrawn (no flicker, no button pulled
    // from under a finger, no lost hover or selection).
    if (html === this.lastHtml && root.querySelector('.port-body')) return;
    this.lastHtml = html;
    keepFolds(root, () => (root.innerHTML = html));
    root.querySelectorAll<HTMLElement>('[data-ptab]').forEach((el) => (el.onclick = () => {
      const id = el.dataset.ptab!;
      if (id === 'sea') return this.act({ act: 'undock' } as DOMStringMap, root, state);
      if (id === 'tattoo') return this.openTattoos?.();
      this.tab = id as Tab;
      this.render(root, state);
      root.querySelector<HTMLElement>('.port-body')?.scrollTo({ top: 0 });
    }));
    root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => (el.onclick = () => this.act(el.dataset, root, state)));
    bindColours(root, this.send);
    bindContracts(root, this.send, () => {}); // docs/19 E15: the Admiralty's board
    bindBazaar(root);
    bindDealings(root);
    root.querySelector<HTMLElement>('[data-dwell]')?.addEventListener('click', () => this.openDwell?.());
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-build]').forEach((el) => (el.onchange = () => {
      const k = el.dataset.build!;
      const v = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
      if (k.startsWith('rare:')) {
        const slot = k.slice(5) as RareSlot;
        if (v) this.build.rares[slot] = v as GoodId;
        else delete this.build.rares[slot];
      } else (this.build as Record<string, unknown>)[k] = v === '' ? undefined : v;
      this.render(root, state);
    }));
    root.querySelectorAll<HTMLElement>('[data-qty]').forEach((el) => (el.onclick = () => {
      this.qty = Number(el.dataset.qty);
      this.render(root, state);
    }));
    // The tavern's hire slider (docs/23 item 68): the number and the button follow the finger.
    const range = root.querySelector<HTMLInputElement>('#tv-hire');
    if (range) {
      const let_go = () => {
        removeEventListener('pointerup', let_go, true);
        removeEventListener('pointercancel', let_go, true);
        if (!this.holding) return;
        this.holding = false;
        this.render(root, state);
      };
      // Let go anywhere: a drag released off the slider with its value unchanged left `holding` set and the harbour
      // drew no more — its places' tabs dead (docs/23 item 94).
      range.onpointerdown = () => {
        this.holding = true;
        addEventListener('pointerup', let_go, true);
        addEventListener('pointercancel', let_go, true);
      };
      range.onpointerup = range.onpointercancel = range.onchange = let_go;
    }
    if (range) range.oninput = () => {
      this.hire = Number(range.value);
      const out = root.querySelector('output[for="tv-hire"]');
      if (out) out.textContent = String(this.hire);
      const b = root.querySelector<HTMLButtonElement>('[data-act="hire_n"]');
      if (b) {
        b.dataset.n = String(this.hire);
        b.disabled = this.hire <= 0;
        b.querySelector('.k-btn-l')!.textContent = W('tv.hireN', { n: this.hire });
        const sub = b.querySelector('.w-qsub');
        if (sub) sub.innerHTML = money(Math.ceil(this.hire * view.crewHireCost));
      }
    };
  }
  private act(d: DOMStringMap, root: HTMLElement, state: ClientState): void {
    switch (d.act) {
      case 'undock':
        // What is short for the voyage is asked first (depart.ts).
        departOrAsk(state, this.send, () => {
          this.send({ t: 'undock' });
          this.onClose();
        });
        return;
      case 'buyn':
        return this.send({ t: 'trade', good: d.good as never, qty: Number(d.n) });
      case 'sell_useful':
        // docs/23 item 66: everything worth selling, in one tap.
        for (const m of sellAllOrders(state)) this.send(m);
        return;
      case 'supplies':
        for (const m of voyageOrder(state, ['food', 'ammo']).msgs) this.send(m);
        return;
      case 'hire_short':
        for (const m of voyageOrder(state, ['crew']).msgs) this.send(m);
        return;
      case 'hire_n':
        if (Number(d.n) > 0) this.send({ t: 'hire_crew', qty: Number(d.n), prof: 'sailor' });
        this.hire = null;
        return;
      case 'buy':
        return this.send({ t: 'trade', good: d.good as never, qty: this.qty });
      case 'sell':
        return this.send({ t: 'trade', good: d.good as never, qty: -Math.min(this.qty, Math.floor(state.self?.cargo[d.good as never] ?? 0)) || -1 });
      case 'dice_open':
        return this.send({ t: 'dice', action: 'open', stake: Number(d.stake) });
      case 'dice_join':
        return this.send({ t: 'dice', action: 'join', id: Number(d.id) });
      case 'dice_davy':
        return this.send({ t: 'dice', action: 'open', stake: 0, davy: true });
      case 'omen_coin':
        return this.send({ t: 'omen', action: 'coin' });
      case 'mb_buy':
        return this.send({ t: 'mapboard', action: 'buy', id: d.id! });
      case 'mb_unpost':
        return this.send({ t: 'mapboard', action: 'unpost', id: d.id! });
      case 'mb_post':
        return this.send({ t: 'mapboard', action: 'post', id: d.id!, price: Number(root.querySelector<HTMLInputElement>(`[data-mbprice="${d.id}"]`)?.value ?? 0), copy: !!root.querySelector<HTMLInputElement>(`[data-mbcopy="${d.id}"]`)?.checked });
      case 'regatta':
        return this.send({ t: 'regatta', action: 'signup' });
      case 'pet_buy':
        return this.send({ t: 'pet', action: 'buy', pet: d.pet as never });
      case 'sellall':
        return this.send({ t: 'trade', good: d.good as never, qty: -Math.floor(state.self?.cargo[d.good as never] ?? 0) });
      case 'ammo':
        return this.send({ t: 'buy_ammo', ammo: d.ammo as never, qty: Number(d.n) });
      case 'crew':
        return this.send({ t: 'hire_crew', qty: Number(d.n), prof: (d.prof as Profession | undefined) ?? 'sailor' });
      case 'press':
        return this.send({ t: 'press_gang', qty: 10 });
      case 'quest_accept': {
        // The giver speaks first: their words, the steps and the pay; the captain takes it or leaves it.
        const q = state.portView?.questOffers.find((x) => x.id === d.id);
        if (!q) return this.send({ t: 'quest', action: 'accept', id: d.id! });
        void giverDialog(q).then((pay) => pay && this.send({ t: 'quest', action: 'accept', id: d.id!, ...(pay !== 'silver' ? { pay } : {}) }));
        return;
      }
      case 'quest_abandon':
        void ask(L('confirm.questAbandon')).then((ok) => ok && this.send({ t: 'quest', action: 'abandon', id: d.id! }));
        return;
      case 'path':
        void ask(L('confirm.path')).then((ok) => ok && this.send({ t: 'path', to: d.to as never }));
        return;
      case 'oath':
        void ask(L('confirm.oath')).then((ok) => ok && this.send({ t: 'oath', oath: d.oath as 'code' }));
        return;
      case 'dl':
        // Runs, the auction, whispers (docs/16 Batch C).
        return dealingsAct(d, root, this.send);
      case 'bz':
        // The Floating Bazaar (docs/12 P10 #19).
        return bazaarAct(d, root, this.send);
      case 'service':
        // Letters of marque (docs/12 P10 #15): leaving the service is asked first.
        if (d.sact === 'resign') void ask(L('confirm.resign')).then((ok) => ok && sendService(this.send, 'resign'));
        else sendService(this.send, d.sact!, Number(d.i));
        return;
      case 'build_order':
        return this.send({ t: 'build', req: { ...this.build, name: this.build.name || SHIP_CLASSES[this.build.classId].name } });
      case 'launch':
        return this.send({ t: 'build_launch', id: d.id! });
      case 'berth_swap':
        return this.send({ t: 'berth', action: 'swap', index: Number(d.i) });
      case 'berth_sell':
        void ask(L('confirm.berthSell')).then((ok) => ok && this.send({ t: 'berth', action: 'sell', index: Number(d.i) }));
        return;
      case 'plan_buy':
        return this.send({ t: 'plan_buy', classId: this.build.classId });
      case 'figurehead_buy':
        return this.send({ t: 'figurehead_buy', id: d.fh as FigureheadId });
      case 'claim': {
        const email = (root.querySelector('#claim-email') as HTMLInputElement).value.trim();
        const password = (root.querySelector('#claim-password') as HTMLInputElement).value;
        const token = localStorage.getItem('gravetide.token') ?? '';
        // (the form's guard: honeypot and time since shown, mailguard.ts; her tongue for the letter)
        fetch('/auth/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, email, password, website: '', t: String(Math.round(performance.now())), lang: lang() }) })
          .then((r) => r.json())
          .then((r: { error?: string }) => tell(r.error ? serverText(r.error) : L('alert.claimSaved')))
          .catch(() => tell(L('alert.claimFail')));
        return;
      }
      case 'escort_hire':
        return this.send({ t: 'escort', action: 'hire', classId: d.cls as ShipClassId });
      case 'escort_dismiss':
        void ask(L('confirm.escortDismiss')).then((ok) => ok && this.send({ t: 'escort', action: 'dismiss', id: d.id! }));
        return;
      case 'dregs':
        return this.send({ t: 'hire_crew', qty: 10, prof: 'sailor', dregs: true });
      case 'officer_hire':
        return this.send({ t: 'officer', action: 'hire', id: d.id! });
      case 'repair':
        return this.send({ t: 'shipyard', action: 'repair' });
      case 'refit':
        return this.send({ t: 'shipyard', action: 'refit' });
      case 'module':
        return this.send({ t: 'shipyard', action: 'module', module: d.module as never });
      case 'unfit':
        return this.send({ t: 'shipyard', action: 'unfit', module: d.module as never });
      case 'keel':
        return this.send({ t: 'shipyard', action: 'keel' });
      case 'gun':
        return this.send({ t: 'shipyard', action: 'guns', side: d.side as never, gun: d.gun as never });
      case 'mount':
        return this.send({ t: 'shipyard', action: 'mount', mount: d.mount as MountId });
      case 'research':
        return this.send({ t: 'research', classId: d.cls as ShipClassId });
      case 'ship':
        void ask(L('confirm.shipTrade', { ship: SHIP_CLASSES[d.cls as ShipClassId].name })).then((ok) => ok && this.send({ t: 'shipyard', action: 'buy_ship', classId: d.cls as ShipClassId }));
        return;
      case 'contract':
        return this.send({ t: 'contract', action: d.mode as never, id: d.id! });
      case 'pardon':
        return this.send({ t: 'pardon' });
      case 'chart_sell':
        return this.send({ t: 'chart', action: 'sell' });
      case 'chart_buy':
        return this.send({ t: 'chart', action: 'buy', region: d.region as RegionId });
      case 'treasure':
        return this.send({ t: 'treasure', action: d.mode as never, tier: Number(d.tier ?? 0) });
      case 'map': {
        const to = (root.querySelector<HTMLInputElement>(`input[data-for="${d.id}"]`)?.value ?? '').trim();
        const go = () => this.send({ t: 'map', action: d.mode as never, id: d.id, to: to || undefined });
        if (d.mode === 'burn') return void ask(L('confirm.mapBurn')).then((ok) => ok && go());
        return go();
      }
      case 'insure':
        return this.send({ t: 'insure', tier: d.tier as never });
      case 'forward':
        return this.send({ t: 'forward', id: d.id! });
      case 'option_buy': {
        const good = root.querySelector<HTMLSelectElement>('#opt-good')!.value;
        const qty = Number(root.querySelector<HTMLInputElement>('#opt-qty')!.value);
        return this.send({ t: 'option', good: good as never, qty });
      }
      case 'fence':
        return this.send({ t: 'fence_sell', good: d.good as never, qty: Math.floor(state.self?.cargo[d.good as never] ?? 0) });
      case 'option_ex':
        return this.send({ t: 'option_exercise', index: Number(d.i) });
      case 'order_fill':
        return this.send({ t: 'order', action: 'fill', id: d.id!, qty: Number(d.n) });
      case 'order_cancel':
        return this.send({ t: 'order', action: 'cancel', id: d.id! });
      case 'order_post': {
        const good = root.querySelector<HTMLSelectElement>('#ord-good')!.value;
        const qty = Number(root.querySelector<HTMLInputElement>('#ord-qty')!.value);
        const price = Number(root.querySelector<HTMLInputElement>('#ord-price')!.value);
        return this.send({ t: 'order', action: 'post', good: good as never, qty, price });
      }
      case 'bank': {
        const amount = Math.floor(Number(root.querySelector<HTMLInputElement>('#bank-amt')!.value));
        return this.send({ t: 'bank', action: d.mode as never, amount });
      }
      case 'licence':
        return this.send({ t: 'licence' });
      case 'informant':
        return this.send({ t: 'wanted', action: 'informant', id: d.id! });
      case 'tip':
        return this.send({ t: 'tip', action: 'buy', id: d.id! });
      case 'clerk':
        return this.send({ t: 'tip', action: 'clerk' });
      case 'captive':
        return this.send({ t: 'captive', index: Number(d.i), mode: d.mode as 'ransom' | 'hand_over' | 'officer' | 'skipper' });
      case 'rights':
        return this.send({ t: 'rights', site: d.site! });
      case 'store':
        return this.send({ t: 'warehouse', good: d.good as never, qty: Number(d.n) });
      case 'cleanse':
        return this.send({ t: 'cleanse' });
      case 'respec':
        void ask(L('confirm.respec')).then((ok) => ok && this.send({ t: 'respec' }));
        return;
    }
    void root;
  }

  private body(view: PortView, state: ClientState): string {
    switch (this.tab) {
      case 'market':
        return this.market(view, state);
      case 'shipyard':
        return this.shipyard(view, state);
      case 'tavern':
        return this.tavern(view, state);
      case 'quests':
        return this.quests(view, state);
      case 'harbour':
        return this.harbour(view, state);
      case 'colours':
        return coloursCard(state, { head: false });
      case 'holdings':
        return this.holdings(view, state);
      case 'exchange':
        return this.exchange(view, state);
      case 'auction':
        return `${auctionCard(view, state)}${bazaarCard(state, view)}` || `<p class="muted">—</p>`;
      case 'dice':
        return view.tavern.dice ? diceCard(view.tavern.dice, state.self!.gold) : '';
      case 'rumours':
        return this.rumours(view, state);
      case 'charts':
        return this.charts(view, state);
      case 'army': {
        const port = state.ports.find((p) => p.id === view.portId)!;
        return `${dwellCard(port)}${tamerCard(port)}`;
      }
      case 'pets':
        return this.pets(view, state);
    }
  }

  /** The port's one-tap actions (docs/23 item 66): sell what is worth selling, buy the voyage's stores, and — when the
   *  ship wants them — repair and hands. The market leads with them; the yard and the tavern have their own. */
  private quick(view: PortView, state: ClientState, what: ('sell' | 'supplies' | 'repair' | 'hire')[]): string {
    const btns: QuickBtn[] = [];
    for (const w of what) {
      if (w === 'sell') {
        const list = sellableGoods(state);
        const est = list.reduce((a, x) => a + x.est, 0);
        btns.push({ label: W('mk.sellAll'), sub: list.length ? `≈ ${money(est)}` : esc(W('mk.sellNone')), icon: 'coin', hint: W('mk.sellAllHint'), disabled: !list.length, primary: list.length > 0, data: { act: 'sell_useful' } });
      } else if (w === 'supplies') {
        const o = voyageOrder(state, ['food', 'ammo']);
        // Short but nothing to buy here is not «всё есть» (docs/23 item 93): the hold is full, or the harbour sells none.
        const ship = voyageShip(state);
        const short = ship ? voyageNeeds(ship).filter((n) => n.kind === 'food' || n.kind === 'ammo') : [];
        const none = !short.length ? W('mk.suppliesOk') : short.some((n) => n.kind === 'food' && n.buy <= 0) ? W('mk.suppliesFull') : W('mk.suppliesNone');
        btns.push({ label: W('mk.supplies'), sub: o.msgs.length ? money(o.cost) : esc(none), icon: 'good_provisions', hint: W('mk.suppliesHint', { min: VOYAGE_MINUTES }), disabled: !o.msgs.length, data: { act: 'supplies' } });
      } else if (w === 'repair') {
        const cost = view.shipyard.repairCost;
        if (cost > 0) btns.push({ label: W('mk.repair'), sub: money(cost), icon: 'good_planks', hint: W('mk.repairHint'), data: { act: 'repair' } });
      } else if (w === 'hire') {
        const o = voyageOrder(state, ['crew']);
        if (o.n > 0) btns.push({ label: W('mk.hire', { n: o.n }), sub: money(o.cost), icon: 'stat_crew', hint: W('mk.hireHint'), data: { act: 'hire_short' } });
      }
    }
    return quickBar(btns);
  }

  private market(view: PortView, state: ClientState): string {
    const self = state.self!;
    const portDef = state.ports.find((p) => p.id === view.portId)!;
    const qtys = [1, 5, 10, 25];
    // The manual list: a finger-wide row a good — its picture, what is aboard, its two prices, «Купить» and «Продать».
    const rows = view.market.map((r) => {
      const g = GOODS[r.good];
      const have = Math.floor(self.cargo[r.good] ?? 0);
      const stolen = Math.min(have, self.stolen[r.good] ?? 0);
      const trend = r.trend > 0.03 ? `<span class="up">▲</span>` : r.trend < -0.03 ? `<span class="down">▼</span>` : '';
      const tags = [view.dealOfDay === r.good ? L('market.dealOfDay') : '', r.legal ? '' : L('market.contraband'), g.spoilPerHour ? L('market.perishable') : '', g.danger > 0.3 ? L('market.dangerous') : '', stolen ? L('market.stolen', { n: stolen }) : ''].filter(Boolean).join(' · ');
      return `<div class="w-row mk-row${have ? ' have' : ''}" data-good="${r.good}" data-hint="${esc(`${g.name}. ${g.description}`)}">${icon(`good_${r.good}`, '', 'w-row-ico')}
        <span class="w-row-t"><b class="${r.legal ? '' : 'contra'}">${esc(g.name)}</b><small>${esc(have ? W('mk.have', { n: have }) : W('mk.stock', { n: r.stock }))}${tags ? ` · ${esc(tags)}` : ''}</small></span>
        <span class="w-row-n" title="${esc(W('mk.priceHint', { buy: r.buy, sell: r.sell }))}">${money(r.buy)}<small>${money(r.sell)}${trend}</small></span>
        <span class="w-row-b"><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="buy" data-good="${r.good}" ${r.stock > 0 ? '' : 'disabled'}>${esc(L('btn.buy'))}</button><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="sell" data-good="${r.good}" ${have ? '' : 'disabled'}>${esc(L('btn.sell'))}</button></span></div>`;
    }).join('');
    // How many a «Купить» moves: one chip that steps 1 → 5 → 10 → 25 (one target, not four).
    const next = qtys[(qtys.indexOf(this.qty) + 1) % qtys.length] ?? 1;
    const by = `<button type="button" class="w-chip on mk-by" data-qty="${next}" data-hint="${esc(W('mk.byHint'))}" aria-label="${esc(`${W('mk.by')} ${this.qty}`)}"><span class="muted">${esc(W('mk.by'))}</span> <b>${this.qty}</b></button>`;
    // A rarer shot neither sold here nor in the hold is not listed (the common kinds always are).
    const ammo = AMMO_IDS.filter((a, i) => i <= AMMO_IDS.indexOf('cursed') || view.ammoPrices[a] > 0 || self.ammo[a] > 0).map((a) => `<div class="w-row" data-hint="${esc(`${AMMO[a].name}. ${AMMO[a].description}`)}">${icon(`ammo_${a}`, '', 'w-row-ico')}
      <span class="w-row-t"><b>${esc(AMMO[a].name)}</b><small>${esc(view.ammoPrices[a] > 0 ? L('market.inHold', { n: self.ammo[a], price: view.ammoPrices[a] }) : L('market.inHoldOnly', { n: self.ammo[a] }))}</small></span>
      ${view.ammoPrices[a] > 0 ? `<span class="w-row-b">${[20, 50].map((n) => `<button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="ammo" data-ammo="${a}" data-n="${n}">+${n}</button>`).join('')}</span>` : ''}</div>`).join('');
    const intel = view.priceIntel?.length
      ? `<table class="grid"><tr><th>${esc(L('th.good'))}</th><th>${esc(L('th.port'))}</th><th>${esc(L('th.sellsFor'))}</th><th>${esc(L('th.age'))}</th></tr>${view.priceIntel.slice(0, 12).map((i) => `<tr><td>${icon(`good_${i.good}`)}${esc(GOODS[i.good].name)}</td><td>${esc(placeName(i.name))}</td><td>${money(i.sell)}</td><td class="muted">${esc(L('unit.min', { n: Math.round(i.ageSec / 60) }))}</td></tr>`).join('')}</table>`
      : '';
    const fence = view.fence !== null ? `<div class="card"><h4>${esc(L('fence.title'))}</h4><p class="muted">${esc(L('fence.text', { pct: Math.round(view.fence * 100) }))}</p>
        ${(Object.keys(self.cargo) as (keyof typeof GOODS)[]).filter((g) => GOODS[g].contraband && (self.cargo[g] ?? 0) >= 1).map((g) => `<button class="btn btn-small" data-act="fence" data-good="${g}">${esc(L('fence.sell', { n: Math.floor(self.cargo[g] ?? 0), good: GOODS[g].name }))}</button>`).join(' ') || `<span class="muted">${esc(L('fence.nothing'))}</span>`}</div>` : '';
    const note = view.duty || portDef.blackMarket ? `<p class="muted mk-note">${view.duty ? L('market.duty', { pct: Math.round(view.duty * 100) }) : ''} ${portDef.blackMarket ? esc(L('market.blackMarket')) : ''}</p>` : '';
    return `${this.quick(view, state, ['sell', 'supplies', 'repair', 'hire'])}
      <div class="mk-head">${sec(W('mk.goods'))}${by}</div>${note}
      <div class="mk-list">${rows}</div>
      ${sec(W('mk.shot'))}<div class="mk-list">${ammo}</div>
      ${more(W('mk.extra'), `${fence}${intel}`, 'mk-extra')}`;
  }

  private shipyard(view: PortView, state: ClientState): string {
    const self = state.self!;
    const sy = view.shipyard;
    const cur = SHIP_CLASSES[self.loadout.classId];
    const you = state.you;
    const broken = self.gunsDisabled.port + self.gunsDisabled.starboard;
    // docs/23 item 67: the repair in one tap, the one upgrade worth having as «было → стало», the rest folded.
    const repair = `<div class="card yd-repair"><div class="yd-repair-t">${icon('good_planks', '', 'ico-md')}<span><b>${esc(W('yd.repair'))}</b><small class="muted">${esc(W('yd.state', { h: you?.hull ?? 0, hm: you?.hullMax ?? 0, s: you?.sails ?? 0, sm: you?.sailsMax ?? 0 }))}${broken ? ` · ${esc(W('yd.gunsDown', { n: broken }))}` : ''}</small></span></div>
      ${quickBtn({ label: sy.repairCost ? W('yd.repair') : W('yd.sound'), sub: sy.repairCost ? money(sy.repairCost) : undefined, primary: sy.repairCost > 0, disabled: !sy.repairCost, data: { act: 'repair' } })}${repairCompare(view)}</div>`;
    const modules = sy.modules.map((m) => {
      const def = MODULES[m.module];
      const maxed = m.level >= m.max;
      const mat = view.materialDiscount[m.module];
      const matNote = mat && !maxed ? `<p class="muted">${esc(L('yard.matNote', { n: mat.units, good: GOODS[mat.good].name.toLowerCase() }))}</p>` : '';
      return `<div class="card"><h4>${icon(`mod_${m.module}`, '', 'ico-md')}${esc(def.name)} <span class="muted">${m.level}/${m.max}</span>${m.excellent ? ` <span class="gold">${esc(L('yard.excellent'))}</span>` : ''}</h4><p>${esc(def.description)}</p>${matNote}
        <button class="btn btn-small" data-act="module" data-module="${m.module}" ${maxed ? 'disabled' : ''}>${esc(maxed ? L('yard.fullyFitted') : L('yard.fitLevel', { n: m.level + 1, cost: fmt(m.cost) }))}</button>
        ${m.level > 0 ? `<button class="btn btn-small" data-act="unfit" data-module="${m.module}" title="${esc(self.talents.shp_modular_refit ? L('yard.unfitFree') : L('yard.unfitFee'))}">${esc(L('yard.takeOut'))}</button>` : ''}</div>`;
    }).join('');
    const guns = (['port', 'starboard'] as const).map((side) => `<div class="card"><h4 class="card-h">${icon(`gun_${self.loadout.guns[side]}`, '', side === 'port' ? 'ico-md flip' : 'ico-md')}${esc(L(side === 'port' ? 'yard.portBattery' : 'yard.starboardBattery', { n: cur.gunPortsPerSide, gun: GUNS[self.loadout.guns[side]].name }))}</h4>
      ${sy.guns.map((gdef) => {
        const g = GUNS[gdef.gun];
        const mounted = self.loadout.guns[side] === gdef.gun;
        return `<div class="item-row" title="${esc(g.description)}">${icon(`gun_${gdef.gun}`, '', 'item-ico')}<div class="item-text"><b>${esc(g.name)}</b><span class="muted">${esc(L('yard.gunStats', { dmg: g.damage, range: g.range, reload: g.reload }))}</span><span class="muted">${esc(g.description)}</span></div><button class="btn btn-small item-btn" data-act="gun" data-side="${side}" data-gun="${gdef.gun}" ${mounted ? 'disabled' : ''}>${mounted ? esc(L('yard.mounted')) : money(gdef.cost)}</button></div>`;
      }).join('')}</div>`).join('');
    const mounts = `<div class="card"><h4 class="card-h">${icon('mount_mortar', '', 'ico-md')}${esc(L('mount.title'))}</h4>${sy.mounts.map((m) => {
      const def = MOUNTS[m.mount];
      const fitted = self.loadout.mount === m.mount;
      return `<div class="item-row">${icon(`mount_${m.mount}`, '', 'item-ico')}<div class="item-text"><b>${esc(def.name)}</b><span class="muted">${esc(def.description)}</span></div><button class="btn btn-small item-btn" data-act="mount" data-mount="${m.mount}" ${fitted ? 'disabled' : ''}>${fitted ? esc(L('mount.fitted')) : money(m.cost)}</button></div>`;
    }).join('') || `<p class="muted">${esc(L('mount.none'))}</p>`}</div>`;
    // The yard's tree of hulls (docs/20): a hull not yet researched shows what it waits for, and its research.
    const research = self.research ?? { xp: {}, free: 0, done: [] };
    const owned = [self.loadout.classId, ...self.berths.map((b) => b.classId)];
    const ships = sy.ships.map((s) => {
      const c = SHIP_CLASSES[s.classId];
      const net = Math.max(0, s.price - s.tradeIn);
      const art = assetUrl(c.sprite);
      const known = isResearched(research, s.classId, owned);
      const q = known ? null : researchQuote(research, s.classId, owned);
      const buy = s.classId === self.loadout.classId
        ? `<button class="btn btn-small item-btn" disabled>${esc(L('yard.yours'))}</button>`
        : known ? `<button class="btn btn-small item-btn" data-act="ship" data-cls="${s.classId}">${money(net)}</button>`
        : q?.ready ? `<button class="btn btn-small btn-primary item-btn" data-act="research" data-cls="${s.classId}">${esc(RL('research', { n: fmt(q.cost) }))}</button>`
        : `<button class="btn btn-small item-btn" data-research-open title="${esc(RL('openTip'))}">${icon('tab_board', '', 'ico-sm')}${esc(RL('yardLocked'))}</button>`;
      const lock = q ? `<span class="hull-lock muted">${esc(q.known.length ? RL('cost', { have: fmt(Math.min(q.cost, q.pool)), cost: fmt(q.cost) }) : RL('st.lockedBy', { names: q.parents.map((p) => SHIP_CLASSES[p].name).join(', ') }))}</span>` : '';
      return `<div class="card hull-card"><div class="hull-art">${art ? `<img src="${art}" alt="" draggable="false" />` : ''}</div>
        <div class="hull-text"><b>${esc(c.name)}</b> <span class="muted">${esc(levelSpan(c.id))} · ${esc(c.role)}</span>
          <div class="hull-stats"><span>${icon('stat_hull', '', 'ico-sm')}${c.hull}</span><span>${icon('stat_sails', '', 'ico-sm')}${c.maxSpeed}</span><span>${icon('fire', '', 'ico-sm')}${c.gunPortsPerSide}×2</span><span>${icon('tab_market', '', 'ico-sm')}${c.holdVolume}</span><span>${icon('stat_crew', '', 'ico-sm')}${c.crewMin}–${c.crewMax}</span></div>${lock}</div>
        ${buy}</div>`;
    }).join('');
    const keel = self.talents.shp_legendary_keel ? `<div class="card"><h4 class="card-h">${icon('good_timber', '', 'ico-md')}${esc(L('keel.title'))}</h4><p class="muted">${esc(L('keel.text'))}</p><button class="btn btn-small" data-act="keel" ${self.loadout.keel ? 'disabled' : ''}>${esc(self.loadout.keel ? L('keel.has') : L('keel.lay'))}</button></div>` : '';
    return `${repair}${this.upgradeCard(view, state)}
      ${more(W('yd.moreGuns'), `${refitCard(sy.refit, self.loadout.name)}${keel}${guns}${mounts}${modules}`, 'yd-guns')}
      ${more(W('yd.moreShips'), `<div class="hulls-head"><p class="muted" style="margin:0 0 8px">${esc(L('hulls.note'))}</p><button class="btn btn-small" data-research-open title="${esc(RL('openTip'))}">${icon('tab_board', '', 'ico-sm')}${esc(RL('open'))}</button></div><div class="hull-list">${ships}</div><p class="muted">${esc(L('yard.note', { tier: sy.tier }))}</p>`, 'yd-ships')}
      ${more(W('yd.moreBuild'), this.buildCard(view, state), 'yd-build')}`;
  }

  /** The one upgrade the yard has for her (docs/23 item 67): the next hull she knows and could take — her own traded
   *  in — as «было → стало», else the cheapest fitting she has not maxed; one button. */
  private upgradeCard(view: PortView, state: ClientState): string {
    const self = state.self!;
    const sy = view.shipyard;
    const cur = SHIP_CLASSES[self.loadout.classId];
    const research = self.research ?? { xp: {}, free: 0, done: [] };
    const owned = [self.loadout.classId, ...self.berths.map((b) => b.classId)];
    const better = sy.ships
      .filter((s) => s.classId !== self.loadout.classId && isResearched(research, s.classId, owned) && SHIP_CLASSES[s.classId].hull > cur.hull)
      .sort((a, b) => (a.price - a.tradeIn) - (b.price - b.tradeIn))[0];
    if (better) {
      const c = SHIP_CLASSES[better.classId];
      const net = Math.max(0, better.price - better.tradeIn);
      const art = assetUrl(c.sprite);
      const [lo] = levelRange(c.id);
      const [clo] = levelRange(cur.id);
      return `${sec(W('yd.upgrade'))}${wasBecomes({
        title: c.name, sub: `${W('yd.newShip')} · ${c.role}`, art: art ? `<img src="${art}" alt="" draggable="false" />` : icon('menu_ship', '', 'ico'),
        rows: [
          { label: W('yd.level'), icon: 'anchor', was: `⚓${clo}`, becomes: `⚓${lo}`, better: lo > clo },
          { label: W('yd.hull'), icon: 'stat_hull', was: cur.hull, becomes: c.hull, better: c.hull > cur.hull },
          { label: W('yd.guns'), icon: 'fire', was: cur.gunPortsPerSide * 2, becomes: c.gunPortsPerSide * 2, better: c.gunPortsPerSide >= cur.gunPortsPerSide },
          { label: W('yd.speed'), icon: 'stat_sails', was: cur.maxSpeed, becomes: c.maxSpeed, better: c.maxSpeed >= cur.maxSpeed },
          { label: W('yd.hold'), icon: 'tab_market', was: cur.holdVolume, becomes: c.holdVolume, better: c.holdVolume >= cur.holdVolume },
          { label: W('yd.crew'), icon: 'stat_crew', was: cur.crewMax, becomes: c.crewMax, better: c.crewMax >= cur.crewMax },
        ],
        button: { label: W('yd.buyShip'), sub: money(net), hint: W('yd.buyShipHint'), primary: true, disabled: self.gold < net, data: { act: 'ship', cls: better.classId } },
      })}`;
    }
    const mod = sy.modules.filter((m) => m.level < m.max).sort((a, b) => a.cost - b.cost)[0];
    if (mod) {
      const def = MODULES[mod.module];
      return `${sec(W('yd.upgrade'))}${wasBecomes({
        title: def.name, sub: def.description, art: icon(`mod_${mod.module}`, '', 'ico'),
        rows: [{ label: W('yd.level'), was: `${mod.level}/${mod.max}`, becomes: `${mod.level + 1}/${mod.max}`, better: true }],
        button: { label: W('yd.fit'), sub: money(mod.cost), primary: true, disabled: self.gold < mod.cost, data: { act: 'module', module: mod.module } },
      })}`;
    }
    return `${sec(W('yd.upgrade'))}<p class="muted">${esc(W('yd.top'))}</p>`;
  }

  private buildCard(view: PortView, state: ClientState): string {
    const self = state.self!;
    const b = this.build;
    const yard = view.yard;
    const classes = view.shipyard.ships.map((x) => x.classId);
    if (!classes.includes(b.classId)) b.classId = classes[0] ?? 'sloop';
    if (!yard.woods.includes(b.frame)) b.frame = yard.woods[0] ?? 'pine';
    if (!yard.woods.includes(b.plank)) b.plank = yard.woods[0] ?? 'pine';
    const cls = SHIP_CLASSES[b.classId];
    const frame = WOODS[b.frame], plank = WOODS[b.plank];
    const plan = self.plans.find((x) => x.id === b.planId);
    const build: ShipBuild = { frame: b.frame, plank: b.plank, rares: Object.entries(b.rares).map(([slot, good]) => ({ slot: slot as RareSlot, good: good as GoodId })), figurehead: b.figurehead, quality: plan?.quality ?? 'common', variants: plan?.variants ?? [], builder: view.portId };
    const gun = defaultGunFor(cls);
    const preview = computeShipStats({ classId: b.classId, name: 'x', guns: { port: gun, starboard: gun }, modules: {}, build }, self.captain, self.talents);
    const plain = computeShipStats({ classId: b.classId, name: 'x', guns: { port: gun, starboard: gun }, modules: {} }, self.captain, self.talents);
    const master = b.master && yard.master;
    const cost = Math.round(cls.price * ((frame.cost + plank.cost) / 2) * (master ? 1.25 : 1) + (b.figurehead ? FIGUREHEADS[b.figurehead].price : 0));
    const skill = Math.min(0.35, 0.01 * Object.entries(self.talents).filter(([id]) => id.startsWith('shp_')).reduce((a, [, r]) => a + (r ?? 0), 0));
    const time = Math.round(BUILD_TIME[cls.tier] * Math.max(frame.time, plank.time) * (1 - skill) * (master ? 0.75 : 1));
    const mats = buildMaterials(cls.tier);
    for (const [slot, good] of Object.entries(b.rares)) {
      const def = RARES[slot as RareSlot].find((x) => x.good === good);
      if (def) mats[def.good] = (mats[def.good] ?? 0) + def.units;
    }
    const wh = self.warehouses[view.portId] ?? {};
    const matText = Object.entries(mats).map(([g, n]) => {
      const got = Math.floor(self.cargo[g as GoodId] ?? 0) + Math.floor(wh[g as GoodId] ?? 0);
      return `<span class="mat ${got >= (n ?? 0) ? '' : 'short'}" title="${esc(L('build.matTitle'))}">${icon(`good_${g}`)}${esc(GOODS[g as GoodId].name)} <b>${got}/${n}</b></span>`;
    }).join('');
    const pct = (a: number, z: number) => { const d = Math.round((a / z - 1) * 100); return `${d >= 0 ? '+' : '−'}${Math.abs(d)}%`; };
    const figs = [...yard.figureheads, ...self.figureheads].filter((f, i, a) => a.indexOf(f) === i);
    const orders = self.builds.map((o) => {
      const left = Math.max(0, o.done - state.estServerTime());
      const here = o.port === view.portId;
      return `<div class="row order-row"><span><b>${esc(o.name)}</b> <span class="muted">${o.name === SHIP_CLASSES[o.classId].name ? '' : `${esc(SHIP_CLASSES[o.classId].name)} · `}${esc(WOODS[o.frame].name)}/${esc(WOODS[o.plank].name)} · ${esc(L('build.orderInfo', { quality: L(`quality.${o.quality}`), port: state.ports.find((p) => p.id === o.port)?.name ?? o.port }))}</span></span>
        ${left > 0 ? `<span class="muted nowrap">${esc(L('unit.min', { n: Math.ceil(left / 60) }))}</span>` : here ? `<button class="btn btn-small btn-primary" data-act="launch" data-id="${o.id}">${esc(L('build.launch'))}</button>` : `<span class="gold">${esc(L('build.ready'))}</span>`}</div>`;
    }).join('');
    const berths = self.berths.map((x, i) => `<div class="row" style="padding:3px 0"><span>${esc(placeName(x.name))}${trophyTag(x.trophy)} <span class="muted">${esc(SHIP_CLASSES[x.classId].name)} · ${esc(L('berth.info', { hull: x.hull, port: state.ports.find((p) => p.id === x.port)?.name ?? (x.port.startsWith('isle:') ? state.islands.get(Number(x.port.slice(5)))?.name ?? L('berth.yourIsland') : x.port) }))}</span>${x.trophy ? `<span class="trophy-line">${esc(trophyLine(x.trophy))}</span>` : ''}</span>
      ${x.port === view.portId ? `<span><button class="btn btn-small" data-act="berth_swap" data-i="${i}">${esc(L('berth.takeOut'))}</button> <button class="btn btn-small btn-danger" data-act="berth_sell" data-i="${i}">${esc(L('btn.sell'))}</button></span>` : ''}</div>`).join('');
    return `<h3 class="title-sm" style="font-size:20px;margin-top:10px">${esc(L('build.title'))}</h3>
      <div class="cols"><div class="card"><div class="form-grid build-form">
        <label class="fg-wide">${esc(L('build.hull'))}<select data-build="classId">${classes.map((c) => `<option value="${c}" ${c === b.classId ? 'selected' : ''}>${esc(SHIP_CLASSES[c].name)} (${esc(levelSpan(c))})</option>`).join('')}</select></label>
        <label class="fg-wide">${esc(L('build.name'))}<input data-build="name" value="${esc(b.name)}" maxlength="28" placeholder="${esc(cls.name)}"></label>
        <label>${esc(L('build.frame'))}<select data-build="frame">${yard.woods.map((w) => `<option value="${w}" ${w === b.frame ? 'selected' : ''}>${esc(WOODS[w].name)}</option>`).join('')}</select></label>
        <label>${esc(L('build.plank'))}<select data-build="plank">${yard.woods.map((w) => `<option value="${w}" ${w === b.plank ? 'selected' : ''}>${esc(WOODS[w].name)}</option>`).join('')}</select></label>
        <p class="muted fg-wide">${esc(frame.description)} ${b.plank !== b.frame ? esc(plank.description) : ''}</p>
        ${(Object.keys(RARES) as RareSlot[]).map((slot, i, all) => `<label class="${all.length % 2 && i === all.length - 1 ? 'fg-wide' : ''}">${esc(slot === 'keel' ? L('rare.keel') : slot === 'belt' ? L('rare.belt') : slot === 'sails' ? L('rare.sails') : slot === 'guns' ? L('rare.guns') : L('rare.paint'))}<select data-build="rare:${slot}"><option value="">${esc(L('build.standard'))}</option>${RARES[slot].map((r) => `<option value="${r.good}" ${b.rares[slot] === r.good ? 'selected' : ''} title="${esc(r.description)}">${esc(r.name)} (${r.units} ${esc(GOODS[r.good].name.toLowerCase())})</option>`).join('')}</select></label>`).join('')}
        <label class="fg-wide">${esc(L('build.figurehead'))}<select data-build="figurehead"><option value="">${esc(L('build.none'))}</option>${figs.map((f) => `<option value="${f}" ${b.figurehead === f ? 'selected' : ''}>${esc(FIGUREHEADS[f].name)} — ${esc(FIGUREHEADS[f].description)}</option>`).join('')}</select></label>
        <label class="fg-wide">${esc(L('build.plan'))}<select data-build="planId"><option value="">${esc(L('build.planCommon'))}</option>${self.plans.filter((x) => x.classId === null || x.classId === b.classId).map((x) => `<option value="${x.id}" ${b.planId === x.id ? 'selected' : ''}>${esc(L(`quality.${x.quality}`))}: ${x.variants.map((v) => esc(VARIANTS[v].name)).join('; ')} ${esc(L('build.uses', { n: x.uses > 1000 ? '∞' : x.uses, word: x.uses > 1000 ? L('build.use5') : plural(x.uses, L('build.use1'), L('build.use2'), L('build.use5')) }))}</option>`).join('')}</select></label>
        ${yard.master ? `<label class="check fg-wide"><input type="checkbox" data-build="master" ${b.master ? 'checked' : ''}> ${esc(L('build.master'))}</label>` : ''}
      </div></div><div class="card">
        <h4>${esc(b.name || cls.name)}</h4>
        <table class="grid"><tr><td>${esc(L('th.hull'))}</td><td>${preview.hullMax} (${pct(preview.hullMax, plain.hullMax)})</td></tr><tr><td>${esc(L('th.armour'))}</td><td>${Math.round(preview.armor * 100)}% (${pct(preview.armor || 0.01, plain.armor || 0.01)})</td></tr>
          <tr><td>${esc(L('th.speed'))}</td><td>${dec1(preview.maxSpeed)} (${pct(preview.maxSpeed, plain.maxSpeed)})</td></tr><tr><td>${esc(L('th.holdCap'))}</td><td>${preview.holdVolume.toFixed(0)}</td></tr><tr><td>${esc(L('th.crew'))}</td><td>${preview.crewMax}</td></tr></table>
        <p>${esc(L('build.costTime', { cost: fmt(cost), min: Math.ceil(time / 60) }))}</p><div class="mats">${matText}</div>
        <button class="btn btn-primary btn-block" data-act="build_order" ${self.builds.length ? 'disabled' : ''}>${esc(self.builds.length ? L('build.busy') : L('build.lay'))}</button>
        ${yard.plans ? `<p style="margin-top:8px"><button class="btn btn-small btn-block" data-act="plan_buy">${esc(L('build.planBuy', { ship: cls.name, cost: fmt(Math.round(cls.price * 0.3)) }))}</button></p>` : ''}
        ${yard.figureheads.map((f) => `<p><button class="btn btn-small btn-block" data-act="figurehead_buy" data-fh="${f}" title="${esc(FIGUREHEADS[f].description)}">${icon(f, '', 'ico-sm')}${esc(L('build.figureheadBuy', { fig: FIGUREHEADS[f].name, cost: fmt(FIGUREHEADS[f].price) }))}</button></p>`).join('')}
      </div></div>
      ${orders || berths ? `<div class="card"><h4 class="card-h">${icon('build_shipyard', '', 'ico-md')}${esc(L('build.orders'))}</h4>
${orders}${berths}</div>` : ''}`;
  }

  private tavern(view: PortView, state: ClientState): string {
    const self = state.self!;
    const room = Math.max(0, (state.you?.crewMax ?? 0) - self.crew);
    const tv = view.tavern;
    const co = self.company;
    // docs/23 item 68: a slider and «Нанять» — as many as there are berths, hands ashore and silver for; it starts
    // at the most (fill her up), a finger takes it down.
    const max = Math.max(0, Math.min(room, view.crewAvailable, view.crewHireCost > 0 ? Math.floor(self.gold / view.crewHireCost) : room));
    if (this.hire === null || this.hire > max || this.hireMax !== max) this.hire = max;
    this.hireMax = max;
    const why = room <= 0 ? W('tv.full') : view.crewAvailable <= 0 ? W('tv.none') : max <= 0 ? W('tv.poor') : '';
    const hire = `<div class="card tv-hire"><div class="tv-hire-h">${icon('stat_crew', '', 'ico-md')}<span><b>${esc(W('tv.men'))}</b><small class="muted">${esc(W('tv.room', { n: room, cost: fmt(view.crewHireCost) }))} · ${'★'.repeat(Math.round(tv.stars))}</small></span></div>
      ${why ? `<p class="muted tv-why">${esc(why)}</p>` : rangeHtml({ id: 'tv-hire', min: 0, max, value: this.hire, label: W('tv.men') })}
      ${quickBtn({ label: W('tv.hireN', { n: why ? 0 : this.hire }), sub: money(Math.ceil((why ? 0 : this.hire) * view.crewHireCost)), primary: !why, disabled: !!why || this.hire <= 0, hint: L('tavern.bounty', { cost: view.crewHireCost, stars: '★'.repeat(Math.round(tv.stars)), n: tv.stars, room }), data: { act: 'hire_n', n: this.hire } })}</div>`;
    const officers = tv.officers.map((o) => `<div class="w-row" data-hint="${esc(`${OFFICER_DEFS[o.role].description}${o.story ? ` ${serverText(o.story)}` : ''}`)}">${officerIcon(o)}
        <span class="w-row-t"><b>${esc(personName(o.name))}</b><small>${esc(L('officer.level', { role: lang() === 'ru' ? OFFICER_DEFS[o.role].name.toLowerCase() : OFFICER_DEFS[o.role].name, n: o.level }))} · ${esc(L('officer.loyalty', { n: o.loyalty }))}${o.rep ? esc(L('officer.needs', { n: o.rep })) : ''}</small><span class="tv-traits">${traitChips(o.traits)}</span></span>
        <span class="w-row-b"><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="officer_hire" data-id="${esc(o.id)}" ${o.taken || co.officers.length >= co.slots || self.gold < o.price ? 'disabled' : ''}>${o.taken ? esc(L('officer.taken')) : money(o.price)}</button></span></div>`).join('') || `<p class="muted">${esc(L('officer.none'))}</p>`;
    const trades = PROFESSIONS.filter((k) => k !== 'sailor').map((k) => `<div class="w-row" data-hint="${esc(PROFESSION_DEFS[k].description)}">${icon(`prof_${k}`, '', 'w-row-ico')}
        <span class="w-row-t"><b>${esc(PROFESSION_DEFS[k].name)}</b><small>${icon('menu_ship', '', 'ico-xs')}${co.pools[k]} · ${icon('anchor', '', 'ico-xs')}${tv.stock[k] ?? 0}</small></span>
        <span class="w-row-n">${money(tv.costs[k])}</span>
        <span class="w-row-b"><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="crew" data-prof="${k}" data-n="1" ${(tv.stock[k] ?? 0) > 0 && room > 0 ? '' : 'disabled'}>${esc(L('btn.hire'))}</button><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="crew" data-prof="${k}" data-n="-1" aria-label="${esc(L('tavern.discharge'))}" ${co.pools[k] > 0 ? '' : 'disabled'}>−</button></span></div>`).join('');
    const rough = `<div class="w-quick">${quickBtn({ label: W('tv.discharge'), data: { act: 'crew', n: -5 } })}${tv.dregs ? quickBtn({ label: L('tavern.dregs'), hint: L('tavern.dregsTitle'), data: { act: 'dregs' } }) : ''}${tv.pressGang ? quickBtn({ label: L('tavern.press'), hint: L('tavern.pressTitle'), data: { act: 'press' } }) : ''}</div>`;
    return `${hire}${sec(W('tv.officers', { n: co.officers.length, max: co.slots }))}<div class="mk-list">${officers}</div>
      ${more(W('tv.more'), `${sec(L('tavern.tradesmen'))}<div class="mk-list">${trades}</div>${rough}`, 'tv-more')}`;
  }

  /** docs/23 item 69: three «best for you» on top — the board's contracts and quests, weighed by their pay against
   *  her level, a quest for her ship's level and an urgent one first — then the rest, then what is underway. */
  private quests(view: PortView, state: ClientState): string {
    const self = state.self!;
    const portName = (id?: string) => placeName(state.ports.find((p) => p.id === id)?.name ?? '');
    const best = bestOffers(view, state);
    const top = best.slice(0, 3), rest = best.slice(3);
    const card = (o: Offer) => {
      const btn = o.kind === 'contract'
        ? quickBtn({ label: W('q.take'), primary: true, data: { act: 'contract', mode: 'accept', id: o.id } })
        : o.blocked ? `<span class="muted q-blocked">${esc(L('quest.needs', { x: serverText(o.blocked) }))}</span>` : quickBtn({ label: W('q.take'), primary: true, data: { act: 'quest_accept', id: o.id } });
      return `<div class="card q-card" data-hint="${esc(o.text)}">${icon(o.art, '', 'q-ico')}<div class="q-t"><b>${esc(o.title)}</b><small class="muted">${esc([o.kind === 'contract' ? W('q.contract') : W('q.quest'), o.to ? W('q.to', { port: portName(o.to) }) : '', o.ship ? W('q.level', { n: o.ship }) : ''].filter(Boolean).join(' · '))}${o.urgent ? ` <span class="q-urgent">${esc(L('quest.urgent'))}</span>` : ''}</small><span class="reward">${money(o.silver)}${xpBadge(o.xp)}</span></div>${btn}</div>`;
    };
    const row = (o: Offer) => `<div class="w-row" data-hint="${esc(o.text)}">${icon(o.art, '', 'w-row-ico')}<span class="w-row-t"><b>${esc(o.title)}</b><small>${esc([o.kind === 'contract' ? W('q.contract') : W('q.quest'), o.to ? W('q.to', { port: portName(o.to) }) : ''].filter(Boolean).join(' · '))}</small></span><span class="w-row-n">${money(o.silver)}</span>
      <span class="w-row-b">${o.blocked ? '' : `<button type="button" class="k-btn k-btn--secondary k-btn--md" ${o.kind === 'contract' ? `data-act="contract" data-mode="accept" data-id="${esc(o.id)}"` : `data-act="quest_accept" data-id="${esc(o.id)}"`}>${esc(W('q.take'))}</button>`}</span></div>`;
    const mine = [
      ...self.contracts.map((c) => `<div class="w-row" data-hint="${esc(serverText(c.description))}">${icon(contractArt(c), '', 'w-row-ico')}<span class="w-row-t"><b>${esc(serverText(c.title))}</b><small>${esc(c.kind === 'bounty' ? `${c.progress ?? 0}/${c.kills}` : W('q.to', { port: portName(c.toPort) }))}</small></span><span class="w-row-n">${money(c.reward)}</span><span class="w-row-b"><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="contract" data-mode="abandon" data-id="${c.id}">${esc(L('btn.abandon'))}</button></span></div>`),
      ...self.quests.map((q) => `<div class="w-row">${icon('goal', '', 'w-row-ico')}<span class="w-row-t"><b>${esc(serverText(q.name))}</b><small>${q.step}/${q.steps}: ${esc(serverText(q.text))}${q.need > 1 ? ` (${q.progress}/${q.need})` : ''}</small></span><span class="w-row-b"><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="quest_abandon" data-id="${q.id}">${esc(L('quest.setAside'))}</button></span></div>`),
    ].join('');
    // docs/19 E15: a great harbour's Admiralty board heads the quests for a captain of the cap.
    return `${admiraltyBoard(state, view.portId)}${sec(W('q.best'))}${top.length ? `<div class="q-best">${top.map(card).join('')}</div>` : `<p class="muted">${esc(W('q.none'))}</p>`}
      ${rest.length ? `${sec(W('q.rest'))}<div class="mk-list">${rest.map(row).join('')}</div>` : ''}
      ${mine ? `${sec(W('q.mine'), `${self.contracts.length}/${3 + ((self.talents.trd_contract_broker ?? 0) > 0 ? 1 : 0)}`)}<div class="mk-list">${mine}</div>` : ''}
      ${more(W('more'), `${runsCard(view, state)}${dailyCard(self.daily)}${commonCard(self.common)}${invasionCard(self.invasion)}`, 'q-more')}`;
  }

  /** The tavern's talk (the second row's «Слухи»): omens, rumours and whispers, the wanted and the tips, the bard. */
  private rumours(view: PortView, state: ClientState): string {
    const tv = view.tavern;
    const board = (view.raid ? tipsHtml(view.raid) : '') + (view.wanted ? wantedBoardHtml(view.wanted) : '');
    const recs = view.fishRecords?.length ? `<div class="card fish-records"><h4 class="card-h">${icon('build_fishing_village', '', 'ico-md')}${esc(L('fish.records'))}</h4>${view.fishRecords.map((r) => `<p class="fish-rec">${fishIcon(r.fish)}${esc(L('fish.recordRow', { fish: FISH[r.fish].name[lang() === 'ru' ? 1 : 0], kg: r.kg.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB'), name: r.name }))}</p>`).join('')}</div>` : '';
    return `<div class="card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${esc(L('tavern.rumours'))}</h4>${[...new Set(view.rumors)].map((r) => `<p>${quote(serverText(r))}</p>`).join('')}</div>${hearsayCard(view, state)}${omenLog(state.omen, true)}${board}${recs}${tv.shanty ? `<div class="card"><h4 class="card-h">${icon('opt_sound', '', 'ico-md')}${esc(L('tavern.bard'))}</h4><p><i>${esc(serverText(tv.shanty))}</i></p></div>` : ''}`;
  }

  /** Charts (the second row's «Карты»): the cartographer, her treasure maps, the captains' map board. */
  private charts(view: PortView, state: ClientState): string {
    const self = state.self!;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const mb = view.tavern.maps ?? [];
    const mapBoard = `<div class="card cmp-card"><h4 class="card-h">${icon('map_treasure', '', 'ico-md')}${esc(L('mb.title'))}</h4><p class="muted">${esc(L('mb.text'))}</p>
      ${mb.map((x) => `<div class="cmp-h"><div class="cmp-h-t"><b>${esc(serverText(x.name))}${x.chest ? `<span class="mb-tag">${esc(LI('mb.chest'))}</span>` : ''}${x.copy ? `<span class="mb-tag">${esc(LI('mb.copyTag'))}</span>` : ''}</b><span class="muted">${esc(x.seller)} · ${money(x.price)}</span>${x.riddle ? `<span class="muted"><i>«${esc(x.riddle)}»</i></span>` : ''}</div>${x.mine ? `<button class="btn btn-small" data-act="mb_unpost" data-id="${x.id}">${esc(L('mb.take'))}</button>` : `<button class="btn btn-small btn-primary" data-act="mb_buy" data-id="${x.id}" ${self.gold < x.price ? 'disabled' : ''}>${esc(L('mb.buy'))}</button>`}</div>`).join('') || `<p class="muted">${esc(L('mb.none'))}</p>`}
      ${self.maps.length ? `<div class="giver-h">${esc(L('mb.post'))}</div>${self.maps.map((m) => `<div class="cmp-h"><div class="cmp-h-t"><b>${esc(serverText(m.name))}</b></div><input class="field" type="number" min="10" value="500" data-mbprice="${esc(m.id)}" style="width:80px" aria-label="${esc(L('mb.price'))}">${m.kind === 'player' ? `<label class="muted mb-copy"><input type="checkbox" data-mbcopy="${esc(m.id)}"> ${esc(LI('mb.copy'))}</label>` : ''}<button class="btn btn-small" data-act="mb_post" data-id="${esc(m.id)}">${esc(L('mb.postBtn'))}</button></div>`).join('')}` : ''}</div>`;
    return `<div class="card"><h4 class="card-h">${icon('map_port', '', 'ico-md')}${esc(L('carto.title'))}</h4>
        <p>${esc(L('carto.text', { brokers: port.faction === 'brokers' ? L('carto.brokers') : '' }))}</p>
        <div class="row"><span>${esc(L('carto.sellable', { n: view.charts.sellable, islands: plural(view.charts.sellable, L('carto.island1'), L('carto.island2'), L('carto.island5')) }))}</span>
          <button class="btn btn-small btn-primary" data-act="chart_sell" ${view.charts.sellable ? '' : 'disabled'}>${esc(L('carto.sell', { cost: fmt(view.charts.sellValue) }))}</button></div>
        ${view.charts.offers.map((o) => `<div class="row" style="padding:3px 0"><span>${esc(serverText(o.name))} <span class="muted">${esc(L('carto.uncharted', { n: o.islands, islands: plural(o.islands, L('carto.uncharted1'), L('carto.uncharted2'), L('carto.uncharted5')) }))}</span></span>
          <button class="btn btn-small" data-act="chart_buy" data-region="${o.region}">${esc(L('carto.buy', { cost: fmt(o.price) }))}</button></div>`).join('') || `<p class="muted">${esc(L('carto.none'))}</p>`}
      </div>
      <div class="card"><h4 class="card-h">${icon('map_treasure', '', 'ico-md')}${esc(L('maps.title', { n: self.maps.filter((m) => m.kind !== 'fragment').length }))}</h4>
        <p>${esc(L('maps.text', { how: landHow() }))}</p>
        ${self.maps.map((m) => `${mapCard(m)}<div class="row" style="gap:4px;padding-bottom:4px"><button class="btn btn-small" data-act="map" data-mode="appraise" data-id="${esc(m.id)}">${esc(L('maps.appraise'))}</button>${port.faction === 'brokers' ? `<button class="btn btn-small" data-act="map" data-mode="seal" data-id="${esc(m.id)}">${esc(L('maps.seal'))}</button>` : ''}<input class="map-to" data-for="${esc(m.id)}" placeholder="${esc(L('maps.captainPh'))}" style="width:90px"><button class="btn btn-small" data-act="map" data-mode="give" data-id="${esc(m.id)}">${esc(L('btn.handOver'))}</button><button class="btn btn-small btn-danger" data-act="map" data-mode="burn" data-id="${esc(m.id)}">${esc(L('maps.burn'))}</button></div>`).join('')}
        ${port.blackMarket ? `<div class="row"><span class="muted">${esc(L('maps.forger'))}</span><button class="btn btn-small" data-act="map" data-mode="forge">${esc(L('maps.forge'))}</button></div>` : ''}
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn btn-small" data-act="treasure" data-mode="buy">${esc(L('maps.buy'))}</button>
          <button class="btn btn-small" data-act="treasure" data-mode="assemble" ${self.fragments >= 3 ? '' : 'disabled'}>${esc(L('maps.assemble', { n: self.fragments }))}</button>
          ${(self.talents.exp_map_of_the_dead ?? 0) > 0 ? [1, 2].map((t) => `<button class="btn btn-small" data-act="treasure" data-mode="merge" data-tier="${t}" ${self.maps.filter((m) => m.tier === t).length >= 3 ? '' : 'disabled'}>${esc(t === 1 ? L('maps.mergeStained') : L('maps.mergeCaptain'))}</button>`).join(' ') : ''}</div>
      </div>${mapBoard}`;
  }

  /** The pet seller (docs/12 P10 #3): two of four, new each day. */
  private pets(view: PortView, state: ClientState): string {
    const self = state.self!;
    const owned = state.petsOwn?.owned ?? [];
    return (view.tavern.pets ?? []).map((x) => `<div class="w-row" data-hint="${esc(PETS[x.pet].gives[lang() === 'ru' ? 1 : 0])}">${petIcon(x.pet, 'w-row-ico')}<span class="w-row-t"><b>${esc(PETS[x.pet].name[lang() === 'ru' ? 1 : 0])}</b><small>${esc(PETS[x.pet].gives[lang() === 'ru' ? 1 : 0])}</small></span>
      <span class="w-row-b"><button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="pet_buy" data-pet="${x.pet}" ${owned.includes(x.pet) || self.gold < x.price ? 'disabled' : ''}>${owned.includes(x.pet) ? esc(L('pet.have')) : money(x.price)}</button></span></div>`).join('');
  }

  private harbour(view: PortView, state: ClientState): string {
    const regatta = regattaCard(state, state.regatta, state.self?.dockedAt ?? null) + holidayCard(state);
    const self = state.self!;
    const port = state.ports.find((p) => p.id === view.portId)!;
    const reps = Object.entries(self.reputation).map(([f, v]) => `<tr><td>${icon(`faction_${f}`)}${esc(FACTIONS[f as never as keyof typeof FACTIONS].name)}</td><td class="${(v ?? 0) < 0 ? 'up' : 'down'}">${v}</td></tr>`).join('');
    return `${regatta}<div class="cols"><div>
        <div class="card"><h4 class="card-h">${icon('wanted', '', 'ico-md')}${esc(L('pardon.title'))}</h4>${view.pardonCost !== null ? `<p>${esc(L('pardon.text', { n: self.infamy }))}</p><button class="btn" data-act="pardon" ${self.infamy >= 20 ? '' : 'disabled'}>${esc(L('pardon.buy', { cost: fmt(view.pardonCost) }))}</button>` : `<p class="muted">${esc(L('pardon.none'))}</p>`}</div>
        ${view.licence ? `<div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('licence.title'))}</h4><p>${esc(view.licence.until > state.estServerTime() ? L('licence.textActive', { faction: FACTIONS[port.faction].short }) : L('licence.textDuty', { pct: Math.round(view.duty * 100) || '', faction: FACTIONS[port.faction].short }))}</p>
          ${port.faction === 'harpoon' ? `<p class="muted">${esc(L('licence.whaling'))}</p>` : ''}
          ${view.licence.until > state.estServerTime() ? `<p class="good">${esc(licenceLeft(Math.round((view.licence.until - state.estServerTime()) / 60)))}</p>` : ''}
          <button class="btn" data-act="licence">${esc(L('licence.buy', { cost: fmt(view.licence.cost) }))}</button></div>` : ''}
        ${captivesCard(state)}
        <div class="card"><h4 class="card-h">${icon('insurance', '', 'ico-md')}${esc(L('ins.title'))}</h4>${view.insurance.length ? `<p>${esc(L('ins.text'))}</p>
          ${self.policy ? `<p class="good">${esc(L('ins.insured', { tier: L(`ins.${self.policy}`) }))}</p>` : view.insurance.map((q) => `<div class="row ins-row"><span><b>${esc(q.tier === 'hull' ? L('ins.hull') : q.tier === 'cargo' ? L('ins.cargo') : L('ins.full'))}</b> <span class="muted">${q.hull ? esc(L('ins.salvage')) : ''}${q.hull && q.cover ? ' · ' : ''}${q.cover ? esc(L('ins.cover', { pct: Math.round(q.cover * 100), declared: fmt(q.declared), deductible: fmt(q.deductible) })) : ''}</span></span>
            <button class="btn btn-small" data-act="insure" data-tier="${q.tier}" ${q.cover && q.declared < 50 ? 'disabled' : ''}>${money(q.premium)}</button></div>`).join('')}` : `<p class="muted">${esc(L('ins.none'))}</p>`}</div>
        <div class="card"><h4 class="card-h">${icon('ammo_cursed', '', 'ico-md')}${esc(L('curse.title'))}</h4><p>${esc(L('curse.state', { n: self.curse }))}${self.curse >= 25 ? esc(L('curse.stage', { n: self.curse >= 80 ? 3 : self.curse >= 50 ? 2 : 1 })) : ''}. ${esc(['harpoon', 'crown', 'league'].includes(port.faction) ? L('curse.yes') : L('curse.no'))}</p>
          <button class="btn" data-act="cleanse" ${self.curse >= 2 && ['harpoon', 'crown', 'league'].includes(port.faction) ? '' : 'disabled'}>${esc(L('curse.cleanse', { cost: fmt(Math.round(self.curse * 8 * (0.6 + SHIP_CLASSES[self.loadout.classId].tier * 0.4))) }))}</button></div>
        ${view.captainsHouse ? `<div class="card"><h4 class="card-h">${icon('menu_crew', '', 'ico-md')}${esc(L('house.title'))}</h4><p>${esc(L('house.text'))}</p>
          <div class="row" style="gap:6px;flex-wrap:wrap">${self.paths.map((c) => `<button class="btn btn-small ${c === self.captain ? 'btn-primary' : ''}" data-act="path" data-to="${c}" ${c === self.captain ? 'disabled' : ''}>${esc(CAPTAINS[c].archetype)}</button>`).join('')}</div>
          <p class="muted">${esc(L('house.other'))}</p></div>` : ''}
        ${serviceCard(state, view.service)}
        ${view.oathOffer ? `<div class="card"><h4>${esc(view.oathOffer === 'code' ? L('oath.code') : L('oath.marque'))}</h4><p>${esc(view.oathOffer === 'code' ? L('oath.codeText') : L('oath.marqueText'))} ${esc(L('oath.one'))}</p>
          <button class="btn" data-act="oath" data-oath="${view.oathOffer}">${esc(L('oath.swear'))}</button></div>` : ''}
        <div class="card"><h4 class="card-h">${icon('ab_call_escort', '', 'ico-md')}${esc(L('escort.title', { n: self.fleet.escorts.length, max: self.fleet.slots }))}</h4>${self.fleet.slots ? `<p>${esc(L('escort.text', { cost: fmt(self.fleet.upkeep) }))}</p>
          ${self.fleet.escorts.map((e) => `<div class="row" style="padding:2px 0"><span>${esc(e.name)} <span class="muted">${esc(SHIP_CLASSES[e.classId].name)} · ${esc(L('escort.hull', { n: e.hull }))}</span></span>${e.own ? `<span class="muted">${esc(L('escort.own'))}</span>` : `<button class="btn btn-small btn-danger" data-act="escort_dismiss" data-id="${esc(e.id)}">${esc(L('escort.payOff'))}</button>`}</div>`).join('')}
          ${view.escorts.map((o) => `<button class="btn btn-small" data-act="escort_hire" data-cls="${o.classId}" ${o.available && self.fleet.escorts.length < self.fleet.slots ? '' : 'disabled'} title="${esc(L('escort.upkeep', { n: o.upkeep }))}">${esc(SHIP_CLASSES[o.classId].name)} — ${money(o.price)}</button>`).join(' ')}` : `<p class="muted">${esc(L('escort.none'))}</p>`}</div>
        <div class="card"><h4 class="card-h">${icon('map_wreck', '', 'ico-md')}${esc(L('claim.title'))}</h4><p class="muted">${esc(L('claim.text'))}</p>
          <div class="row" style="gap:6px"><input id="claim-email" type="email" placeholder="${esc(L('claim.emailPh'))}" style="flex:1"><input id="claim-password" type="password" placeholder="${esc(L('claim.passwordPh'))}" style="flex:1"><button class="btn btn-small" data-act="claim">${esc(L('btn.save'))}</button></div></div>
        <div class="card"><h4 class="card-h">${icon('menu_talents', '', 'ico-md')}${esc(L('respec.title'))}</h4><p>${esc(L('respec.text', { cost: fmt(60 * self.level) }))}</p><button class="btn btn-danger" data-act="respec">${esc(L('respec.btn'))}</button></div>
      </div><div class="card"><h4 class="card-h">${icon('faction_league', '', 'ico-md')}${esc(L('standing.title'))}</h4><table class="grid">${reps}</table>
      <p class="muted" style="margin-top:8px">${esc(L('standing.stats', { sunk: self.stats.sunk, taken: self.stats.boarded, profit: fmt(self.stats.tradeProfit), km: fmt(self.stats.distance / 1000), islands: self.discoveredCount }))}</p></div></div>`;

  }

  private holdings(view: PortView, state: ClientState): string {
    const self = state.self!;
    const now = state.estServerTime();
    const sites = view.sites.map((x) => {
      const left = x.until > now ? Math.round((x.until - now) / 60) : 0;
      const status = x.mine ? `<span class="good">${esc(L('site.yours', { n: left, stock: x.stock, cap: x.capacity }))}</span>` : x.holder ? `<span class="bad">${esc(L('site.held', { who: x.holder, n: left }))}</span>` : `<span class="muted">${esc(L('site.unclaimed'))}</span>`;
      const can = !x.holder || x.mine;
      return `<tr><td><b>${esc(placeName(x.island))}</b></td><td>${icon(`good_${x.good}`)}${esc(GOODS[x.good].name)}</td><td>${esc(L('site.rate', { n: x.rate }))}</td><td>${status}</td>
        <td><button class="btn btn-small" data-act="rights" data-site="${esc(x.id)}" ${can ? '' : 'disabled'}>${esc(x.mine ? L('site.extend') : L('site.buy'))} ${money(x.cost)}</button></td></tr>`;
    }).join('');
    const wh = view.warehouse;
    const goods = new Set([...Object.keys(wh.goods), ...Object.keys(self.cargo)]);
    const rows = [...goods].filter((g) => (wh.goods[g as never] ?? 0) > 0 || (self.cargo[g as never] ?? 0) >= 1).map((g) => {
      const stored = Math.floor(wh.goods[g as never] ?? 0);
      const held = Math.floor(self.cargo[g as never] ?? 0);
      return `<tr><td>${icon(`good_${g}`)}${esc(GOODS[g as never as keyof typeof GOODS].name)}</td><td>${held}</td><td>${stored}</td>
        <td><button class="btn btn-small" data-act="store" data-good="${g}" data-n="${held}" ${held ? '' : 'disabled'}>${esc(L('wh.storeAll'))}</button>
        <button class="btn btn-small" data-act="store" data-good="${g}" data-n="${-stored}" ${stored ? '' : 'disabled'}>${esc(L('wh.takeAll'))}</button></td></tr>`;
    }).join('');
    return `<div class="cols"><div><div class="card"><h4 class="card-h">${icon('tab_law', '', 'ico-md')}${esc(L('rights.title'))}</h4>
        <p class="muted">${esc(L('rights.text', { how: landHow() }))}</p>
        ${sites ? `<table class="grid"><tr><th>${esc(L('th.island'))}</th><th>${esc(L('th.yield'))}</th><th>${esc(L('th.rate'))}</th><th>${esc(L('th.status'))}</th><th></th></tr>${sites}</table>` : `<p class="muted">${esc(L('rights.none'))}</p>`}</div></div>
      <div><div class="card"><h4 class="card-h">${icon('tab_holdings', '', 'ico-md')}${esc(L('wh.title'))} ${wh.rented ? `<span class="muted">${Math.round(wh.volume)}/${wh.capacity}</span>` : ''}</h4>
        <p class="muted">${esc(wh.rented ? L('wh.rented') : L('wh.rent', { cost: fmt(wh.rent) }))}</p>
        ${rows ? `<table class="grid"><tr><th>${esc(L('th.good'))}</th><th>${esc(L('th.hold'))}</th><th>${esc(L('th.stored'))}</th><th></th></tr>${rows}</table>` : `<p class="muted">${esc(L('wh.empty'))}</p>`}</div></div></div>`;
  }


  private exchange(view: PortView, state: ClientState): string {
    const self = state.self!;
    const now = state.estServerTime();
    const portName = (id: string) => state.ports.find((p) => p.id === id)?.name ?? id;
    const mins = (t: number) => L('unit.min', { n: Math.max(0, Math.round((t - now) / 60)) });
    const ex = view.exchange;
    const forwards = ex?.forwards.map((f) => `<tr><td>${goodQty(f.good, f.qty)}</td><td class="lg-wide">${esc(placeName(f.toName))}</td><td class="gold">${esc(L('unit.perU', { n: f.price }))}</td><td>${money(f.collateral)}</td><td>${esc(mins(f.expiresAt))}</td>
      <td><button class="btn btn-small" data-act="forward" data-id="${esc(f.id)}">${esc(L('btn.sign'))}</button></td></tr>`).join('') ?? '';
    const mine = self.forwards.map((f) => `<tr><td>${goodQty(f.good, f.qty)} <span class="muted">${f.delivered}/${f.qty}</span></td><td class="lg-wide">${esc(portName(f.toPort))}</td><td class="gold">${esc(L('unit.perU', { n: f.price }))}</td><td>${money(f.collateral)}</td><td>${esc(mins(f.expiresAt))}</td></tr>`).join('');
    const orders = ex?.orders.map((o) => {
      const have = Math.floor(self.cargo[o.good] ?? 0);
      const n = Math.min(have, o.qty - o.filled);
      return `<tr><td>${esc(o.name)}</td><td>${goodQty(o.good, o.qty - o.filled)}</td><td class="gold">${esc(L('unit.perU', { n: o.price }))}</td><td>${esc(mins(o.expiresAt))}</td>
        <td>${o.mine ? `<button class="btn btn-small" data-act="order_cancel" data-id="${esc(o.id)}">${esc(L('btn.cancel'))}</button>` : `<button class="btn btn-small" data-act="order_fill" data-id="${esc(o.id)}" data-n="${n}" ${n ? '' : 'disabled'}>${esc(L('order.sell', { n: n || '' }).trim())}</button>`}</td></tr>`;
    }).join('') ?? '';
    const goodsOpts = view.market.map((r) => `<option value="${r.good}">${esc(GOODS[r.good].name)} (~${r.sell})</option>`).join('');
    const b = view.bank;
    const loan = b.loan ? `<p class="${b.loan.defaulted ? 'bad' : ''}">${esc(L('loan.owed', { owed: fmt(b.loan.owed), status: b.loan.defaulted ? L('loan.default') : L('loan.due', { t: mins(b.loan.due) }) }))}</p>` : '';
    return `<div class="cols"><div>
        <div class="card"><h4 class="card-h">${icon('tab_exchange', '', 'ico-md')}${esc(L('fwd.title'))}</h4>${ex ? `<p class="muted">${esc(L('fwd.text'))}</p>
          ${forwards ? `<table class="grid"><tr><th>${esc(L('th.goods'))}</th><th>${esc(L('th.to'))}</th><th>${esc(L('th.price'))}</th><th>${esc(L('th.collateral'))}</th><th>${esc(L('th.deadline'))}</th><th></th></tr>${forwards}</table>` : `<p class="muted">${esc(L('fwd.none'))}</p>`}` : `<p class="muted">${esc(L('fwd.noExchange'))}</p>`}
          ${mine ? `<h4 style="margin-top:10px">${esc(L('fwd.mine'))}</h4><table class="grid">${mine}</table>` : ''}</div>
        ${ex ? `<div class="card"><h4 class="card-h">${icon('tab_board', '', 'ico-md')}${esc(L('orders.title'))}</h4><p class="muted">${esc(L('orders.text'))}</p>
          ${orders ? `<table class="grid"><tr><th>${esc(L('th.buyer'))}</th><th>${esc(L('th.wants'))}</th><th>${esc(L('th.pays'))}</th><th>${esc(L('th.lapses'))}</th><th></th></tr>${orders}</table>` : `<p class="muted">${esc(L('orders.none'))}</p>`}
          <div class="form-grid"><label class="fg-wide">${esc(L('th.goods'))}<select id="ord-good">${goodsOpts}</select></label><label>${esc(L('orders.qty'))}<input id="ord-qty" type="number" min="1" max="200" value="20"></label><label>${esc(L('orders.price'))}<input id="ord-price" type="number" min="1" value="20"></label><button class="btn btn-primary fg-wide" data-act="order_post">${esc(L('orders.post'))}</button></div></div>` : ''}
      </div><div>
        ${self.talents.trd_speculator ? `<div class="card"><h4 class="card-h">${icon('tab_exchange', '', 'ico-md')}${esc(L('opt.title'))}</h4><p class="muted">${esc(L('opt.text'))}</p>
          ${self.options.map((o, i) => `<div class="row" style="padding:3px 0"><span>${o.qty} ${icon(`good_${o.good}`)}${esc(GOODS[o.good].name)} @ ${esc(state.ports.find((p) => p.id === o.port)?.name ?? o.port)} · ${fmt(o.price)} · ${esc(mins(o.until))}</span>${o.port === view.portId ? `<button class="btn btn-small" data-act="option_ex" data-i="${i}">${esc(L('opt.exercise', { cost: fmt(o.price - o.deposit) }))}</button>` : ''}</div>`).join('')}
          <div class="row" style="gap:6px;margin-top:6px"><select id="opt-good">${view.market.filter((r) => r.stock > 3).map((r) => `<option value="${r.good}">${esc(GOODS[r.good].name)} ${esc(L('opt.stock', { buy: r.buy, stock: r.stock }))}</option>`).join('')}</select><input id="opt-qty" type="number" min="1" value="10" style="width:60px"><button class="btn btn-small" data-act="option_buy">${esc(L('opt.reserve'))}</button></div></div>` : ''}
        <div class="card"><h4 class="card-h">${icon('coin', '', 'ico-md')}${esc(L('bank.title'))}</h4>${b.available ? `<p>${L('bank.text', { balance: fmt(b.balance), pct: Math.round(b.withdrawFee * 100) })}</p>
          <p>${L('bank.credit', { limit: fmt(b.limit), pct: Math.round(b.interest * 100), h: Math.round(b.term / 3600) })}</p>${loan}
          <div class="form-grid"><label class="fg-wide">${esc(L('bank.amount'))}<input id="bank-amt" type="number" min="1" value="500"></label>
          ${(['deposit', 'withdraw', 'borrow', 'repay'] as const).map((m) => `<button class="btn" data-act="bank" data-mode="${m}">${esc(L(`bank.${m}`))}</button>`).join('')}</div>`
          : `<p class="muted">${esc(L('bank.none', { balance: fmt(self.bank) }))}</p>${loan}`}</div>

      </div></div>`;
  }

}

/** A good and how much of it, the way a ledger reads: the picture, the name, × 30. */
function goodQty(good: GoodId, n: number): string {
  return `<span class="good-qty">${icon(`good_${good}`)}<span>${esc(GOODS[good].name)}&nbsp;×&nbsp;${n}</span></span>`;
}

/** How a landing is ordered here: the key it is bound to, or the button a touch screen shows. */
function landHow(): string {
  if (document.body.classList.contains('touch')) return L('rights.tap');
  const [k1, k2] = settings().keys.land;
  return L('rights.key', { key: keyLabel(k1 || k2) });
}

/** A contract's picture: sealed letters, a bounty poster, or the good to deliver. */
function contractArt(c: { kind: string; good?: string }): string {
  return c.kind === 'bounty' ? 'wanted' : c.kind === 'delivery' && c.good ? `good_${c.good}` : 'map_contract';
}

/** A hull's levels (canon D12): ⚓3–5, the first she comes at and the last a refit takes her to. */
function levelSpan(classId: ShipClassId): string {
  const [lo, hi] = levelRange(classId);
  return lo === hi ? `⚓${lo}` : `⚓${lo}–${hi}`;
}

/** The yard's refit card (canon D12): her level, the next one's gain and price, the materials had and wanted. */
function refitCard(r: RefitView, name: string): string {
  const head = `<h4 class="card-h">${icon('good_timber', '', 'ico-md')}${esc(L('refit.title'))} ${ownLevelChip(r.level)}</h4><p class="muted refit-level">${esc(L('refit.level', { name: placeName(name), n: r.level, max: r.max }))}</p>`;
  if (r.busy) {
    return `<div class="card refit">${head}<p class="refit-busy">${esc(L('refit.busy', { n: r.busy.to, m: Math.max(1, Math.ceil(r.busy.left / 60)) }))}</p></div>`;
  }
  if (!r.next) return `<div class="card refit">${head}<p class="muted">${esc(L('refit.top'))}</p></div>`;
  const n = r.next;
  const goods = n.goods.map((g) => `<span class="refit-good${g.have < g.qty ? ' short' : ''}">${icon(`good_${g.good}`, '', 'ico-sm')}${esc(GOODS[g.good].name)} <b>${Math.min(g.have, g.qty)}/${g.qty}</b></span>`).join('')
    + (n.hearts ? `<span class="refit-good${n.hearts.have < n.hearts.qty ? ' short' : ''}">${icon('storm_heart', '', 'ico-sm')}${esc(L('refit.heart'))} <b>${Math.min(n.hearts.have, n.hearts.qty)}/${n.hearts.qty}</b></span>` : '');
  return `<div class="card refit">${head}
    <p>${esc(L('refit.gain', { n: n.to }))}</p>
    <div class="refit-goods">${goods}</div>
    <p class="muted refit-note">${esc(L('refit.captain', { n: n.captain }))} · ${esc(L('refit.time', { m: Math.max(1, Math.ceil(n.sec / 60)) }))}</p>
    <p class="muted refit-note">${esc(L('refit.hint'))}</p>
    ${r.blocked ? `<p class="refit-why">${esc(serverText(r.blocked))}</p>` : ''}
    <button class="btn btn-primary" data-act="refit" ${r.blocked ? 'disabled' : ''}>${esc(L('refit.go', { n: n.to }))} — ${money(n.silver)}</button></div>`;
}

/** The board of the wanted (docs/12 P5): a poster for each named pirate of these waters, the baron on top. */
function wantedBoardHtml(list: WantedPoster[]): string {
  if (!list.length) return `<div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('wanted.board'))}</h4><p class="muted">${esc(L('wanted.none'))}</p></div>`;
  const ru = lang() === 'ru' ? 1 : 0;
  const roster = new Map(namedPirates().map((p) => [p.id, p]));
  const posters = list.map((w) => {
    const np = roster.get(w.id);
    const nem = nemesisPoster(w.id); // her nemesis: stamped, under his new name (docs/12 P10 #1)
    const name = nem ? nem.name : np ? np.name[ru] : w.name;
    const ship = np ? np.ship[ru] : w.ship;
    const where = w.seen ? (w.atSea && w.seen.ago <= 1 ? L('wanted.seenNow', { region: REGIONS[w.seen.region].name }) : L('wanted.seen', { ago: w.seen.ago, region: REGIONS[w.seen.region].name })) : L('wanted.unseen');
    const habits = [L(`wanted.time.${w.time}` as 'wanted.time.any'), L(`wanted.weather.${w.weather}` as 'wanted.weather.any'), L(`wanted.trick.${w.trick}` as 'wanted.trick.fog'), L(`wanted.temper.${w.temper}` as 'wanted.temper.coward')].filter(Boolean).join(' · ');
    return `<div class="poster${w.down ? ' po-down' : ''}${w.baron ? ' po-baron' : ''}${nem ? ' po-nemesis' : ''}">
      <div class="po-head">${esc(w.baron ? L('wanted.baron') : L('wanted.head'))}</div>${nem ? `<div class="po-stamp">${esc(nem.stamp)}</div>` : ''}
      <div class="po-face" style="filter: sepia(0.5) hue-rotate(${(w.hue % 41) - 20}deg) saturate(0.85)">${(np && icon(`portrait.${np.art}`, '', 'po-img')) || icon(`portrait.${w.portrait}`, '', 'po-img')}</div>
      <b class="po-name">${esc(name)}</b>
      <div class="po-ship">«${esc(ship)}» · ⚓${w.level}</div>
      <div class="po-bounty">${esc(L('wanted.bounty', { n: w.bounty.toLocaleString(ru ? 'ru-RU' : 'en-GB') }))}</div>
      <div class="po-seen muted">${esc(w.down ? L('wanted.down') : where)}</div>
      <div class="po-habits muted">${esc(habits)}</div>
      ${w.lair ? `<div class="po-lair muted">${esc(L('wanted.lair', { island: placeName(w.lair) }))}</div>` : ''}
      <button class="btn btn-small" data-act="informant" data-id="${esc(w.id)}" ${w.atSea && !w.down ? '' : 'disabled'}>${esc(L('wanted.informant', { cost: w.informant }))}</button>
    </div>`;
  }).join('');
  return `<div class="card wanted-card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('wanted.board'))}</h4><p class="muted">${esc(L('wanted.hint'))}</p><div class="wanted-grid">${posters}</div></div>`;
}

/** The tavern's tips and the clerk (docs/12 P6). */
function tipsHtml(r: { tips: TipView[]; clerk: { cost: number; until: number } }): string {
  const ru = lang() === 'ru';
  const rows = r.tips.map((t) => `<div class="tip-row"><span>${esc(L('tips.row', { cls: SHIP_CLASSES[t.cls].name, lvl: t.level, good: GOODS[t.good].name.toLowerCase(), value: t.value.toLocaleString(ru ? 'ru-RU' : 'en-GB'), from: placeName(t.from), to: placeName(t.to), min: Math.max(1, Math.round(t.departIn / 60)) }))}</span>
    ${t.bought ? `<span class="good">${esc(L('tips.bought'))}</span>` : `<button class="btn btn-small" data-act="tip" data-id="${esc(t.id)}">${esc(L('tips.buy', { cost: t.cost }))}</button>`}</div>`).join('') || `<p class="muted">${esc(L('tips.none'))}</p>`;
  const clerk = r.clerk.until > 0 ? `<p class="good">${esc(L('tips.clerkOn', { min: Math.ceil(r.clerk.until / 60) }))}</p>` : `<button class="btn btn-small" data-act="clerk">${esc(L('tips.clerk', { cost: r.clerk.cost }))}</button>`;
  return `<div class="card tips-card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${esc(L('tips.title'))}</h4><p class="muted">${esc(L('tips.hint'))}</p>${rows}<div class="row">${clerk}</div></div>`;
}
