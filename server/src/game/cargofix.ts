// A hold put right once (forum 134, Эдуард, 2026-11-22): a Crown patrol's search in Leviathan Reach took his whole hold
// but the iron, a kraken ink and a shark skin — provisions, planks, tar, sailcloth, medicine, rum — because one marked
// unit of plunder made the old search (director.ts) take every unit of that good, the ship's stores too; with the food
// gone his crew's spirit fell to nothing on the way to port. The search now takes only contraband and the marked units
// (director.ts hotGoods). What it took was never written down good by good (the chronicle kept the count only), so the
// hold is given back as the owner's agent reckoned it from his post — half a Great Xebec's hold of those goods, made
// larger if the chronicle's count says more was taken — into his hold as far as it goes, then his island's store, and
// the rest as silver at the base price, with silver besides for «the rest» he named; his crew's spirit is set back up.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import { storeCapacity } from './holdings.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';

interface CargoFix {
  ref: string;
  account: number;
  /** The window (wall ms) in which the chronicle's lines of the search are read. */
  since: number;
  until: number;
  /** The goods given back (the least: more if the chronicle's count of the search says so). */
  goods: Partial<Record<GoodId, number>>;
  /** Silver besides, for the goods not named. */
  extra: number;
  /** Her crew's spirit set back at least to this. */
  morale: number;
}

export const CARGO_FIXES: CargoFix[] = [{
  ref: 'patrol134:161:2026-11-22',
  account: 161,
  since: Date.UTC(2026, 10, 21),
  until: Date.UTC(2026, 10, 24),
  goods: { provisions: 300, planks: 120, sailcloth: 120, tar: 30, medicine: 12, rum: 25 },
  extra: 1500,
  morale: 70,
}];
const KEY = 'cargofix_done';

const RU: Partial<Record<GoodId, string>> = { provisions: 'провизия', planks: 'доски и смола', sailcloth: 'парусина', tar: 'смола', medicine: 'лекарства', rum: 'ром' };

/** What one fix did: the goods into the hold and into the store, the silver, the spirit, the chronicle's count. */
export interface CargoFixDone {
  hold: Partial<Record<GoodId, number>>;
  store: Partial<Record<GoodId, number>>;
  silver: number;
  morale: number;
  logged: number;
}

/** The units the chronicle says a patrol's search took in the fix's window (its lines keep the count only). */
export function loggedSeized(s: PlayerSession, since: number, until: number): number {
  let n = 0;
  for (const e of s.profile?.log ?? []) {
    if (e.kind !== 'encounter' || e.a[0] !== 'patrol_search' || (e.a[1] !== 'seized' && e.a[1] !== 'refused')) continue;
    if (e.at < since || e.at > until) continue;
    try {
      n += Math.max(0, Number((JSON.parse(e.a[2] ?? '{}') as { n?: number }).n ?? 0) || 0);
    } catch { /* a line without its numbers */ }
  }
  return n;
}

function list(goods: Partial<Record<GoodId, number>>, ru: boolean): string {
  return (Object.entries(goods) as [GoodId, number][]).filter(([, n]) => n > 0).map(([g, n]) => `${ru ? (RU[g] ?? GOODS[g].name.toLowerCase()) : GOODS[g].name.toLowerCase()} — ${n}`).join(', ');
}

/** Applies a fix to a captain aboard: the goods into her hold, her island's store, or silver; her spirit; the letter. */
export function applyCargoFix(game: Game, s: PlayerSession, f: CargoFix): CargoFixDone | null {
  const p = s.profile, ship = s.ship;
  if (!p || !ship) return null;
  const base = Object.values(f.goods).reduce((a, n) => a + (n ?? 0), 0);
  const logged = loggedSeized(s, f.since, f.until);
  const k = base > 0 ? Math.max(1, logged / base) : 1;
  const st = ship.stats;
  let free = st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
  const h = ownIsland(game, f.account);
  let storeFree = h ? storeCapacity(h) - cargoVolume(h.store) : 0;
  const hold: Partial<Record<GoodId, number>> = {}, store: Partial<Record<GoodId, number>> = {};
  let silver = f.extra;
  for (const [g, n0] of Object.entries(f.goods) as [GoodId, number][]) {
    let n = Math.ceil(n0 * k);
    const per = cargoVolume({ [g]: 1 }, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    const a = Math.max(0, Math.min(n, Math.floor((free + 1e-6) / Math.max(1e-6, per))));
    if (a > 0) {
      ship.cargo[g] = (ship.cargo[g] ?? 0) + a;
      hold[g] = a;
      free -= a * per;
      n -= a;
    }
    if (n > 0 && h) {
      const b = Math.max(0, Math.min(n, Math.floor((storeFree + 1e-6) / GOODS[g].volume)));
      if (b > 0) {
        h.store[g] = (h.store[g] ?? 0) + b;
        store[g] = b;
        storeFree -= b * GOODS[g].volume;
        n -= b;
      }
    }
    silver += n * GOODS[g].basePrice;
  }
  if (Object.keys(store).length) game.holdings.touch();
  const morale = Math.max(ship.morale, f.morale);
  ship.morale = morale;
  const all = { ...f.goods };
  for (const g of Object.keys(all) as GoodId[]) all[g] = Math.ceil((all[g] ?? 0) * k);
  const inStore = Object.keys(store).length;
  deliver(game, s.accountId, {
    from: 'Команда GRAVETIDE',
    subject: 'Груз, изъятый патрулём, возвращён',
    body:
      'Капитан, патруль Короны в водах Предела Левиафана забрал у вас почти весь трюм: провизию, доски, парусину, смолу, лекарства и ром. Это была ошибка игры. Досмотр должен был изымать только контрабанду и меченую добычу, а забирал весь товар того же вида, даже судовые припасы. Без провизии команда голодала, поэтому её боевой дух упал до нуля. Ошибку мы исправили: теперь патруль берёт только запрещённое и называет, что именно.\n\n' +
      `Мы не знаем точно, сколько и чего было в трюме, поэтому вернули с запасом: ${list(all, true)}. ` +
      (Object.keys(hold).length ? `В трюм погружено: ${list(hold, true)}. ` : '') +
      (inStore ? `На склад вашего острова: ${list(store, true)}. ` : '') +
      `Остальное, а также прочий груз, которого не было в списке, возмещено серебром: ${silver} серебра вложено в это письмо, заберите его во вкладке «Письма». Боевой дух команды восстановлен. Простите за испорченный рейс и попутного ветра!`,
    gold: silver,
    goods: null,
  });
  game.db.ledger(s.accountId, 'cargo_fix', 0, `${f.ref}:x${Math.round(k * 100) / 100}:hold ${list(hold, false)}:store ${list(store, false)}:silver ${silver}`);
  game.saveSession(s);
  game.pushSelf(s, true);
  return { hold, store, silver, morale, logged };
}

/** Every two seconds: a fix waiting for a captain now aboard is applied, once. */
export function stepCargoFix(game: Game): void {
  const done = game.db.getKv<string[]>(KEY) ?? [];
  for (const f of CARGO_FIXES) {
    if (done.includes(f.ref)) continue;
    const s = game.sessionByAccount(f.account);
    if (!s?.profile || !s.ship) continue;
    const r = applyCargoFix(game, s, f);
    game.db.setKv(KEY, [...done, f.ref]);
    console.log(`[cargofix] ${f.ref}: ${r ? `hold ${list(r.hold, false) || '-'}, store ${list(r.store, false) || '-'}, ${r.silver} silver, morale ${r.morale}, logged ${r.logged}` : 'nothing to do'}`);
  }
}
