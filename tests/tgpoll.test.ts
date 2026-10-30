// The bot's updates when Telegram can't reach the server (the server in Russia, 2026-10-30): TG_UPDATES=poll takes
// them by getUpdates (outbound, through TG_PROXY), TG_UPDATES=auto keeps the webhook and switches to polling once
// getWebhookInfo shows delivery failing (or setWebhook fails). A pre-checkout is answered first in its batch
// (Telegram gives it 10 s); the offset moves past each batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelegramService, tgUpdatesMode } from '../server/src/telegram.ts';
import type { FetchFn, TgUpdate } from '../server/src/telegram.ts';
import { makeGame } from './helpers.ts';

const TOKEN = '123456:TEST-token_for-the-fake-bot';
const NOW = 1_800_000_000_000;

type Call = { method: string; params: Record<string, unknown>; at: number };

/** A scripted Bot API: getUpdates hands out the queued batches (then empty ones), the rest answer per `answers`. */
function botApi(o: { batches?: TgUpdate[][]; answers?: Record<string, unknown>; fail?: string[] } = {}): { fetch: FetchFn; calls: Call[] } {
  const calls: Call[] = [];
  const batches = [...(o.batches ?? [])];
  let seq = 0;
  const fetch: FetchFn = async (url, init) => {
    const method = url.slice(url.lastIndexOf('/') + 1);
    const params = JSON.parse(init.body || '{}') as Record<string, unknown>;
    calls.push({ method, params, at: seq++ });
    if (o.fail?.includes(method)) return { json: async () => ({ ok: false, error_code: 502, description: 'Bad Gateway' }) };
    if (method === 'getUpdates') {
      const b = batches.shift();
      if (!b) await new Promise((r) => setTimeout(r, 5));
      return { json: async () => ({ ok: true, result: b ?? [] }) };
    }
    const result = o.answers && method in o.answers ? o.answers[method] : true;
    return { json: async () => ({ ok: true, result }) };
  };
  return { fetch, calls };
}

function service(fetch: FetchFn, updates: 'webhook' | 'poll' | 'auto', log: string[] = []) {
  const { game, db } = makeGame();
  return new TelegramService({
    db, auth: game.auth, game, token: TOKEN, fetch, publicUrl: 'https://gravetidegame.com', webappUrl: 'https://tg.gravetidegame.com',
    now: () => NOW, log: (l) => log.push(l), updates, sleep: async () => {}, watchMs: 3_600_000,
  });
}

const until = async (cond: () => boolean, ms = 2000): Promise<void> => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 2));
  }
};

const anne = { id: 4242, first_name: 'Anne', language_code: 'ru' };
const startMsg = (id: number): TgUpdate => ({ update_id: id, message: { message_id: id, from: anne, chat: { id: anne.id, type: 'private' }, text: '/start' } });
const preCheckout = (id: number): TgUpdate => ({ update_id: id, pre_checkout_query: { id: `pcq${id}`, from: anne, currency: 'XTR', total_amount: 50, invoice_payload: 'nope' } });

test('TG_UPDATES: poll | auto | webhook (anything else = webhook)', () => {
  assert.equal(tgUpdatesMode('poll'), 'poll');
  assert.equal(tgUpdatesMode(' AUTO '), 'auto');
  assert.equal(tgUpdatesMode(undefined), 'webhook');
  assert.equal(tgUpdatesMode('weird'), 'webhook');
});

test('poll: no webhook (deleteWebhook keeping the queue), getUpdates through the batches, the pre-checkout answered first, the offset moves on', async () => {
  const api = botApi({ batches: [[startMsg(10), preCheckout(11)], [startMsg(12)]] });
  const tg = service(api.fetch, 'poll');
  await tg.setup();
  assert.ok(tg.polling);
  assert.ok(!api.calls.some((c) => c.method === 'setWebhook'));
  assert.deepEqual(api.calls.find((c) => c.method === 'deleteWebhook')?.params, { drop_pending_updates: false });
  await until(() => api.calls.filter((c) => c.method === 'getUpdates').length >= 3);
  await tg.stop();
  const ups = api.calls.filter((c) => c.method === 'getUpdates');
  assert.equal(ups[0].params.offset, 0);
  assert.equal(ups[1].params.offset, 12, 'past the first batch');
  assert.equal(ups[2].params.offset, 13);
  assert.deepEqual(ups[0].params.allowed_updates, ['message', 'callback_query', 'pre_checkout_query']);
  assert.ok(Number(ups[0].params.timeout) > 0 && Number(ups[0].params.timeout) < 30, 'a long poll under the proxy\'s 30 s');
  const answer = api.calls.find((c) => c.method === 'answerPreCheckoutQuery')!;
  assert.equal(answer.params.pre_checkout_query_id, 'pcq11');
  const firstReply = api.calls.find((c) => c.method === 'sendMessage')!;
  assert.ok(answer.at < firstReply.at, 'the pre-checkout before the /start that came ahead of it');
  assert.ok(api.calls.filter((c) => c.method === 'sendMessage').length >= 2, 'both /start answered');
});

test('poll: a failing getUpdates (proxy down) backs off and keeps going', async () => {
  let n = 0;
  const inner = botApi({ batches: [[preCheckout(5)]] });
  const fetch: FetchFn = async (url, init) => {
    if (url.endsWith('/getUpdates') && n++ < 3) throw new Error('unreachable');
    return inner.fetch(url, init);
  };
  const log: string[] = [];
  const tg = service(fetch, 'poll', log);
  await tg.setup();
  await until(() => inner.calls.some((c) => c.method === 'answerPreCheckoutQuery'));
  await tg.stop();
  assert.ok(log.some((l) => l.includes('getUpdates failed')));
});

test('auto: the webhook stays while Telegram delivers; a fresh delivery error with updates waiting → long polling', async () => {
  const healthy = botApi({ answers: { getWebhookInfo: { url: 'https://gravetidegame.com/tg/webhook', pending_update_count: 0, last_error_date: NOW / 1000 - 30 } } });
  const a = service(healthy.fetch, 'auto');
  await a.setup();
  assert.ok(healthy.calls.some((c) => c.method === 'setWebhook'));
  assert.equal(await a.checkWebhook(), false, 'an error but nothing waiting');
  assert.equal(a.polling, false);
  await a.stop();

  const old = botApi({ answers: { getWebhookInfo: { url: 'https://gravetidegame.com/tg/webhook', pending_update_count: 4, last_error_date: NOW / 1000 - 3600 } } });
  const b = service(old.fetch, 'auto');
  await b.setup();
  assert.equal(await b.checkWebhook(), false, 'an old error');
  await b.stop();

  const failing = botApi({ answers: { getWebhookInfo: { url: 'https://gravetidegame.com/tg/webhook', pending_update_count: 7, last_error_date: NOW / 1000 - 40, last_error_message: 'Connection timed out' } } });
  const log: string[] = [];
  const c = service(failing.fetch, 'auto', log);
  await c.setup();
  assert.equal(await c.checkWebhook(), true);
  assert.ok(c.polling);
  assert.ok(failing.calls.some((x) => x.method === 'deleteWebhook' && x.params.drop_pending_updates === false), 'the waiting updates kept');
  await until(() => failing.calls.some((x) => x.method === 'getUpdates'));
  await c.stop();
  assert.ok(log.some((l) => l.includes('long polling') && l.includes('Connection timed out')));
});

test('auto: setWebhook refused → long polling at once; webhook mode never polls', async () => {
  const api = botApi({ fail: ['setWebhook'] });
  const tg = service(api.fetch, 'auto');
  await tg.setup();
  assert.ok(tg.polling);
  await until(() => api.calls.some((c) => c.method === 'getUpdates'));
  await tg.stop();

  const plain = botApi({ fail: ['setWebhook'] });
  const w = service(plain.fetch, 'webhook');
  await w.setup();
  assert.equal(w.polling, false);
  assert.ok(!plain.calls.some((c) => c.method === 'getUpdates' || c.method === 'getWebhookInfo'));
  await w.stop();
});
