// Seasons, the Legends of the Ocean and the Pantheon (docs/02 §14.A.6–7). A season lasts three months of the wall
// clock; each has a theme that changes the world, a free season path of cosmetic rewards, season tables, and at
// its end the best of the three halls of glory enter the Pantheon for good.

export const SEASON_DAYS = 90;
export const SEASON_EPOCH = Date.UTC(2026, 0, 1);

export type SeasonTheme = 'migration' | 'war' | 'storm' | 'dead_tide';

export const THEMES: Record<SeasonTheme, { name: string; text: string }> = {
  migration: { name: 'The Great Migration', text: 'The Leviathans move through Gravewater: they rise twice as often and in the trade artery itself.' },
  war: { name: 'The War of Crown and Code', text: 'The Crown and the Confederacy fight a season-long campaign. Every ship sunk counts; the winner holds the contested seas next season.' },
  storm: { name: 'The Season of Storms', text: 'Weather gone wrong across the whole map: storm fronts gather two and a half times as often.' },
  dead_tide: { name: 'The Tide of the Dead', text: 'The drowned rise everywhere: ghost ships sail every region, four times as many as in a quiet season.' },
};

export const THEME_ORDER: SeasonTheme[] = ['migration', 'war', 'storm', 'dead_tide'];

/** What the season tables count. */
export type SeasonStat = 'sunk' | 'monsters' | 'trade' | 'treasure' | 'distance' | 'lawful' | 'plunder' | 'abyss' | 'quests';

export const STAT_NAMES: Record<SeasonStat, string> = {
  sunk: 'Ships sunk', monsters: 'Monster hunters', trade: 'Trade empires', treasure: 'Treasure hunters', distance: 'Longest logs (km)',
  lawful: 'Lawful exploits', plunder: 'Pirate glory', abyss: 'Deeds of the Abyss', quests: 'Quests done',
};

/** The three halls of the Pantheon, and the table each draws its three from. */
export type HallId = 'gravesend' | 'cinderhold' | 'saint_maw';

export const HALLS: Record<HallId, { name: string; stat: SeasonStat; title: string }> = {
  gravesend: { name: 'The Hall of the Admiralty (Gravesend)', stat: 'lawful', title: 'of the Admiralty Hall' },
  cinderhold: { name: 'The Hall of the Code (Cinderhold)', stat: 'plunder', title: 'of the Code Hall' },
  saint_maw: { name: 'The Hall of the Deep (Saint Maw)', stat: 'abyss', title: 'of the Hall of the Deep' },
};

export const TRACK_LEVELS = 40;
export const TRACK_XP = 1000; // season points per level
export const SEASON_XP_SHARE = 0.1; // of ordinary experience

/** The free season path: titles and pennant colours. Nothing that makes a ship stronger. */
export function trackReward(level: number, theme: SeasonTheme): { title?: string; pennant?: string } | null {
  const t = THEMES[theme].name.replace(/^The /, '');
  switch (level) {
    case 5: return { title: `Sea-Dog of ${t}` };
    case 10: return { pennant: '#8e2a2a' };
    case 20: return { title: `Veteran of ${t}` };
    case 30: return { pennant: '#c9a25a' };
    case 40: return { title: `Legend of ${t}`, pennant: '#e8e2d0' };
  }
  return null;
}
