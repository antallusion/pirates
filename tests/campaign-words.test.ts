// docs/36: the campaign's words never show in English while they load — an ellipsis till they are in, Russian after;
// the client asks for them at once, and a toast of the campaign waits for them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { campaignWordsReady, cmpText, loadCampaignWords, serverText } from '../client/src/lang/server.ts';
import { goalSheetView, campaignHtml } from '../client/src/ui/goalsheet.ts';

test('before the campaign’s words are in: an ellipsis, never English; after: Russian', async () => {
  setLang('ru');
  applyDataLocale('ru');
  assert.equal(campaignWordsReady(), false);
  assert.equal(cmpText('Salt and Fog'), '…');
  assert.equal(cmpText('Level 12'), 'Уровень 12', 'a static line reads at once');
  const v = goalSheetView({ quests: [{ id: 'c01_01', name: 'Salt and Fog', kind: 'campaign', step: 1, steps: 2, text: 'Find Greypoint Key and see it with your own eyes.', progress: 0, need: 1 }] });
  assert.ok(!/Salt and Fog|Find Greypoint/.test(campaignHtml(v, (id) => id)), 'no English in the campaign block');
  await loadCampaignWords();
  assert.equal(campaignWordsReady(), true);
  assert.equal(cmpText('Salt and Fog').replace(/\s/g, ' '), 'Соль и туман');
  assert.equal(serverText('Salt and Fog').replace(/\s/g, ' '), 'Соль и туман');
  setLang('en');
  assert.equal(cmpText('Salt and Fog'), 'Salt and Fog');
});

test('the client asks for them at once and holds a campaign toast till they come', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.ok(main.includes('void loadCampaignWords().then(() => modal && refreshModal());'), 'loaded at once, not after a delay');
  assert.ok(!/setTimeout\(\(\) => void loadCampaignWords/.test(main));
  assert.ok(main.includes("!campaignWordsReady() && (m.t === 'toast' || m.t === 'quest_done' || m.t === 'campaign_new')"), 'a toast with English waits for the words');
});
