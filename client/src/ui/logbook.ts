// «Журнал» (docs/23 item 74): one window for the quests, the company, the guild, the letters and the album — five big
// tabs down the rail, each one's own places in the second row. The quests are the journal's page (journal.ts), the
// rest the company's (company.ts); both draw this same frame, and a tap on the other's tab opens the other's page
// (main.ts keeps the two window keys: their redraws differ).

import { dict } from '../i18n.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../lang/ui/win.ts';
import type { ClientState } from '../state.ts';
import { chipRow, railTabs, winHead } from './kit/window.ts';
import type { WinTab } from './kit/window.ts';

const W = dict(WIN_EN, WIN_RU);

/** The rail's five places. */
export type LogTab = 'quests' | 'company' | 'guild' | 'letters' | 'album';

/** The company's pages under each rail tab (the first is where a tap on the tab lands). */
export const LOG_PAGES: Record<Exclude<LogTab, 'quests'>, readonly string[]> = {
  company: ['group', 'law', 'isles', 'empires', 'market'],
  guild: ['guild'],
  letters: ['letters'],
  album: ['album', 'career', 'legends'],
};

/** Which rail tab a company page sits under. */
export function logTabOf(page: string): LogTab {
  for (const [tab, pages] of Object.entries(LOG_PAGES)) if (pages.includes(page)) return tab as LogTab;
  return 'company';
}

export function logRail(active: LogTab, state: ClientState): string {
  const tabs: WinTab[] = [
    { id: 'quests', icon: 'tab_contracts', label: W('jr.quests'), hint: W('jr.questsHint') },
    { id: 'company', icon: 'tab_group', label: W('jr.company'), hint: W('jr.companyHint'), badge: state.self?.pvp.challenges.length ?? 0 },
    { id: 'guild', icon: 'tab_guild', label: W('jr.guild'), hint: W('jr.guildHint'), badge: state.guildInvites.length },
    { id: 'letters', icon: 'tab_letters', label: W('jr.letters'), hint: W('jr.lettersHint'), badge: state.unread },
    { id: 'album', icon: 'tattoo_compass_rose', label: W('jr.album'), hint: W('jr.albumHint') },
  ];
  return railTabs(tabs, active, 'jtab');
}

/** The whole frame: the band (with the second row in it when it is short — three chips at most), the rail, the
 *  page's body. */
export function logFrame(active: LogTab, state: ClientState, chips: WinTab[], chipOn: string, body: string, bodyAttrs = ''): string {
  const row = chips.length ? chipRow(chips, chipOn, 'jchip') : '';
  const inBand = chips.length <= 3;
  return `${winHead(W('jr.title'), { crest: 'tab_letters', chips: inBand ? row : '' })}
    <div class="w-frame">${logRail(active, state)}<div class="w-pane">${inBand ? '' : row}<div class="modal-body w-body log-body" ${bodyAttrs}>${body}</div></div></div>`;
}
