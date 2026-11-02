// «Лоцманская книга»: the keys the engine knows — the first-time tips' triggers (GuideArticle.firstTime) the client
// fires, and the windows (GuideArticle.window, GuideSlide.show.open) its `openWindow` can open. tests/guide.test.ts
// holds every article to these lists, so a content file never names a key nothing fires or a window nothing opens.

/** First-time triggers the client fires (client/src/ui/guidetip.ts), each once an account. */
export const GUIDE_TRIGGERS = [
  'first-sea', // at sea for the first time (out of the First Watch)
  'first-port', // the first harbour's window
  'wreck-near', // a wreck of the dense sea within reach
  'first-isle', // her own island
  'struck-pirate', // a ship struck her colours to her (the choice card)
  'first-boarding', // after her first boarding battle
  'treasure-map', // her first treasure map
  'overload', // the hold overloaded
  'skull', // her first skull (Wanted)
  'storm', // the first storm
  'lighthouse', // a lighthouse in sight
  'fishing', // a shoal in sight
  'dive', // the first dive
  'first-trade', // the first barter
  'first-hire', // the hire window opened
  'level-2', // the second level
  'first-quest', // a quest taken
  'season-pass', // the season card opened
] as const;
export type GuideTrigger = (typeof GUIDE_TRIGGERS)[number];

/** Windows `openWindow(id)` opens (client/src/ui/guidewin.ts). 'port:<tab>' needs a harbour, 'isle' an island of hers
 *  (else its terms); 'keys' is the old list of the keys and the controls. */
export const GUIDE_WINDOWS = [
  'port', 'port:market', 'port:shipyard', 'port:tavern', 'port:quests', 'port:harbour', 'port:ferry', 'port:berths', 'port:flag', 'port:colours',
  'port:holdings', 'port:exchange', 'port:auction', 'port:dice', 'port:rumours', 'port:charts', 'port:army', 'port:pets',
  'isle', 'hire', 'shipyard', 'flag', 'crew', 'army', 'ship', 'map', 'journal', 'settings', 'settings:promo', 'pass', 'pvp',
  'hero', 'skills', 'book', 'gear', 'talents', 'company', 'throne', 'shop', 'research', 'tame', 'keys',
] as const;
export type GuideWindow = (typeof GUIDE_WINDOWS)[number];
