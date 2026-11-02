// «Лоцманская книга»: the windows it can open and the windows its «?» stands in (pure, for the tests; main.ts does the
// opening). A window id (shared/src/data/guide/triggers.ts GUIDE_WINDOWS) → a route main.ts knows how to take; a window
// shown now → its id, and the article (or the section) its «?» opens.

import type { GuideArticle, GuideSection } from '../../../shared/src/data/guide/types.ts';

export type GuideRoute =
  | { k: 'port'; tab: string | null }
  | { k: 'modal'; m: 'map' | 'journal' | 'crew' | 'ship' | 'talents' | 'research' | 'help' }
  | { k: 'hero'; tab: 'hero' | 'skills' | 'book' | 'gear' | 'pvp' }
  | { k: 'isle' }
  | { k: 'hire' }
  | { k: 'flag' }
  | { k: 'settings'; promo: boolean }
  | { k: 'pass' }
  | { k: 'company' }
  | { k: 'throne' }
  | { k: 'shop' }
  | { k: 'tame' };

const PORT_TABS = new Set(['market', 'shipyard', 'tavern', 'quests', 'harbour', 'ferry', 'berths', 'colours', 'holdings', 'exchange', 'auction', 'dice', 'rumours', 'charts', 'army', 'pets']);

/** A window id → how to open it (null: an id nothing opens). */
export function guideRoute(id: string): GuideRoute | null {
  if (id === 'port') return { k: 'port', tab: null };
  if (id.startsWith('port:')) {
    const tab = id.slice(5) === 'flag' ? 'colours' : id.slice(5);
    return PORT_TABS.has(tab) ? { k: 'port', tab } : null;
  }
  switch (id) {
    case 'shipyard': return { k: 'port', tab: 'shipyard' };
    case 'isle': return { k: 'isle' };
    case 'hire': return { k: 'hire' };
    case 'flag': return { k: 'flag' };
    case 'crew': case 'army': return { k: 'modal', m: 'crew' };
    case 'ship': return { k: 'modal', m: 'ship' };
    case 'map': return { k: 'modal', m: 'map' };
    case 'journal': return { k: 'modal', m: 'journal' };
    case 'talents': return { k: 'modal', m: 'talents' };
    case 'research': return { k: 'modal', m: 'research' };
    case 'keys': return { k: 'modal', m: 'help' };
    case 'settings': return { k: 'settings', promo: false };
    case 'settings:promo': return { k: 'settings', promo: true };
    case 'pass': return { k: 'pass' };
    case 'pvp': return { k: 'hero', tab: 'pvp' };
    case 'hero': case 'skills': case 'book': case 'gear': return { k: 'hero', tab: id };
    case 'company': return { k: 'company' };
    case 'throne': return { k: 'throne' };
    case 'shop': return { k: 'shop' };
    case 'tame': return { k: 'tame' };
    default: return null;
  }
}

/** The window shown in #modal-panel as a guide's window id (null: none of the book's — an answer, a fight). */
export function modalWindowId(modal: string | null, o: { portTab?: string; heroTab?: string; heroPage?: string; optionsTab?: string } = {}): string | null {
  switch (modal) {
    case 'port': return o.portTab ? `port:${o.portTab === 'colours' ? 'flag' : o.portTab}` : 'port';
    case 'recruit': return 'hire';
    case 'hero': return o.heroTab === 'hero' && o.heroPage === 'pvp' ? 'pvp' : o.heroTab && o.heroTab !== 'hero' ? o.heroTab : 'hero';
    case 'options': return 'settings';
    case 'base': return 'isle';
    case 'map': case 'journal': case 'crew': case 'ship': case 'talents': case 'research': case 'company': case 'throne': case 'shop': case 'tame':
      return modal;
    default: return null;
  }
}

/** The section a window's «?» opens when no article names it. */
const WIN_SECTION: Record<string, GuideSection> = {
  port: 'trade', 'port:market': 'trade', 'port:exchange': 'trade', 'port:auction': 'trade', 'port:holdings': 'trade', 'port:rumours': 'explore', 'port:charts': 'explore',
  'port:shipyard': 'sea', 'port:berths': 'sea', 'port:harbour': 'sea', 'port:ferry': 'travel', 'port:tavern': 'army', 'port:army': 'army', 'port:pets': 'army',
  'port:quests': 'progress', 'port:flag': 'flags', 'port:dice': 'faq',
  isle: 'island', hire: 'army', shipyard: 'sea', flag: 'flags', crew: 'army', army: 'army', ship: 'sea', map: 'travel', journal: 'progress', settings: 'faq', 'settings:promo': 'faq',
  pass: 'progress', pvp: 'combat', hero: 'progress', skills: 'progress', book: 'progress', gear: 'progress', talents: 'progress', company: 'army', throne: 'progress', shop: 'faq', research: 'sea', tame: 'army',
};

/** What a window's «?» opens: the article that explains it (its own id, then its parent's: `port:tavern` → `port`),
 *  else the section about it. */
export function helpTarget(list: readonly GuideArticle[], win: string): { article: string } | { section: GuideSection } {
  const chain = [win];
  if (win === 'port:colours') chain.push('port:flag');
  if (win === 'port:flag') chain.push('flag');
  if (win === 'flag') chain.push('port:flag');
  if (win === 'port:shipyard') chain.push('shipyard');
  if (win === 'shipyard') chain.push('port:shipyard');
  if (win === 'army') chain.push('crew');
  if (win === 'crew') chain.push('army');
  if (win.includes(':')) chain.push(win.split(':')[0]);
  for (const w of chain) {
    const a = list.find((x) => x.window === w);
    if (a) return { article: a.id };
  }
  return { section: WIN_SECTION[win] ?? 'faq' };
}
