// VK Mini App (owner, 2026-10-20: «надо сделать версию для вк»; docs/36_VK.md). The doubloon packs are sold for VK
// votes («голоса»): a vote is 7 roubles to a buyer, so a pack's price in votes is its roubles over seven, rounded.

import { DOUBLOON_PACKS } from './premium.ts';
import type { DoubloonPack } from './premium.ts';

/** What a vote costs a buyer, in roubles. */
export const VOTE_RUB = 7;

/** A pack's price in VK votes. */
export function packVotes(p: DoubloonPack): number {
  return Math.max(1, Math.round(p.n / VOTE_RUB));
}

/** Doubloons' worth in votes (a price shown in the shop inside VK). */
export function votesOf(doubloons: number): number {
  return Math.max(1, Math.round(doubloons / VOTE_RUB));
}

/** The pack sold under this VK item id (the item id is the pack's own id: d290 …). */
export function vkPack(item: string): DoubloonPack | undefined {
  return DOUBLOON_PACKS.find((p) => p.id === item);
}

/** «1 голос», «2 голоса», «5 голосов»; «1 vote», «2 votes». */
export function votesWord(n: number, lang: 'ru' | 'en'): string {
  if (lang === 'en') return n === 1 ? 'vote' : 'votes';
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return 'голосов';
  if (b === 1) return 'голос';
  if (b >= 2 && b <= 4) return 'голоса';
  return 'голосов';
}

export const votesText = (n: number, lang: 'ru' | 'en'): string => `${n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')} ${votesWord(n, lang)}`;
