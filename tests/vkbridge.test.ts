// The VK bridge on the client (docs/36_VK.md; owner, 2026-10-20 — VK moderation: «игра не запускается на телефонах»)
// against a fake window: VKWebAppInit goes out by all four channels at once (Android, iOS, React Native, the web's
// parent frame) and only once; every other call by the first channel there is, with its request_id; the answers routed
// back by request_id from the web's 'message' envelope and the phones' 'VKWebAppEvent'; a *Failed answer and a timeout
// reject; VKWebAppShowOrderBox's answer without its fields (no items, no status, nothing) does not crash the game.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VkFail, createBridge, orderOutcome } from '../client/src/vkbridge.ts';
import type { BridgeWin } from '../client/src/vkbridge.ts';

type Ev = { data?: unknown; detail?: unknown };

/** A fake window: each channel records what it was given; listeners kept to be fired by the test. */
function fakeWin(o: { android?: boolean; ios?: boolean; rn?: boolean; web?: boolean } = { android: true, ios: true, rn: true, web: true }) {
  const log: { ch: string; method: string; params: Record<string, unknown> }[] = [];
  const listeners: Record<string, ((e: Ev) => void)[]> = {};
  const methods = ['VKWebAppInit', 'VKWebAppGetUserInfo', 'VKWebAppShowOrderBox', 'VKWebAppShare'];
  const w: BridgeWin = {
    addEventListener: (t, fn) => void (listeners[t] ??= []).push(fn),
  };
  if (o.android) w.AndroidBridge = Object.fromEntries(methods.map((m) => [m, (json: unknown) => log.push({ ch: 'android', method: m, params: JSON.parse(String(json)) })]));
  if (o.ios) w.webkit = { messageHandlers: Object.fromEntries(methods.map((m) => [m, { postMessage: (p: unknown) => void log.push({ ch: 'ios', method: m, params: p as Record<string, unknown> }) }])) };
  if (o.rn) w.ReactNativeWebView = { postMessage: (s: unknown) => { const j = JSON.parse(String(s)) as { handler: string; params: Record<string, unknown> }; log.push({ ch: 'rn', method: j.handler, params: j.params }); } };
  if (o.web) w.parent = { postMessage: (m: unknown, origin: unknown) => { const j = m as { handler: string; params: Record<string, unknown>; type: string }; assert.equal(j.type, 'vk-connect'); assert.equal(origin, '*'); log.push({ ch: 'web', method: j.handler, params: j.params }); } };
  const fire = (type: string, e: Ev) => (listeners[type] ?? []).forEach((f) => f(e));
  return { w, log, fire, listeners };
}

test('VKWebAppInit goes out by all four channels at once, and once', () => {
  const f = fakeWin();
  const b = createBridge(f.w);
  assert.deepEqual(b.init(), ['android', 'ios', 'rn', 'web']);
  assert.deepEqual(f.log.map((x) => `${x.ch}:${x.method}`), ['android:VKWebAppInit', 'ios:VKWebAppInit', 'rn:VKWebAppInit', 'web:VKWebAppInit']);
  // the Android bridge takes a JSON string, iOS the object, React Native {handler, params} as JSON, the web the envelope
  assert.deepEqual(f.log[0].params, {});
  assert.ok(typeof f.w.__vkInit === 'number');
  assert.deepEqual(b.init(), [], 'not twice');
  assert.deepEqual(b.init(true), ['android', 'ios', 'rn', 'web'], 'unless forced');
  // index.html's early script sent it already: the bridge does not send it again
  const g = fakeWin();
  g.w.__vkInit = 1;
  assert.deepEqual(createBridge(g.w).init(), []);
  assert.equal(g.log.length, 0);
  // a channel that throws stops none of the others
  const h = fakeWin();
  (h.w.AndroidBridge as Record<string, unknown>).VKWebAppInit = () => { throw new Error('boom'); };
  assert.deepEqual(createBridge(h.w).init(), ['ios', 'rn', 'web']);
  // a window with none of them (a desktop browser, top level): nothing thrown
  assert.deepEqual(createBridge({}).init(), []);
});

test('a call goes by the first channel there is, with a request_id; its answer is routed back by that id', async () => {
  // Android first
  const a = fakeWin();
  const ba = createBridge(a.w);
  const pa = ba.send('VKWebAppGetUserInfo');
  assert.equal(a.log.length, 1);
  assert.equal(a.log[0].ch, 'android');
  const rid = a.log[0].params.request_id;
  assert.ok(typeof rid === 'string' && rid.length > 2);
  // the phones answer with a VKWebAppEvent
  a.fire('VKWebAppEvent', { detail: { type: 'VKWebAppGetUserInfoResult', data: { id: 1, first_name: 'Аня', request_id: rid } } });
  assert.equal((await pa).first_name, 'Аня');
  assert.equal(ba.waiting, 0);
  // the web (an iframe on vk.com): parent.postMessage, answered by a 'message' envelope
  const w = fakeWin({ web: true });
  const bw = createBridge(w.w);
  const p1 = bw.send('VKWebAppGetUserInfo');
  const p2 = bw.send('VKWebAppShare', { link: 'https://vk.com/app1' });
  assert.deepEqual(w.log.map((x) => x.ch), ['web', 'web']);
  assert.equal(w.log[1].params.link, 'https://vk.com/app1');
  const [r1, r2] = w.log.map((x) => x.params.request_id);
  assert.notEqual(r1, r2);
  // answered out of order, each to its own call; another app's answer and junk are ignored
  w.fire('message', { data: { type: 'vk-connect', data: { type: 'VKWebAppShareResult', data: { result: [], request_id: r2 } } } });
  w.fire('message', { data: { type: 'vk-connect', data: { type: 'VKWebAppGetUserInfoResult', data: { first_name: 'X', request_id: 'other' } } } });
  w.fire('message', { data: 'not json' });
  w.fire('message', { data: null });
  w.fire('message', { data: { handler: 'VKWebAppInit', params: {}, type: 'vk-connect' } }); // our own call, echoed (a top-level page)
  assert.deepEqual(await p2, { result: [], request_id: r2 });
  assert.equal(bw.waiting, 1);
  w.fire('message', { data: JSON.stringify({ type: 'vk-connect', data: { type: 'VKWebAppGetUserInfoResult', data: { first_name: 'Мэри', request_id: r1 } } }) });
  assert.equal((await p1).first_name, 'Мэри');
  // an answer without a request_id goes to the oldest call of its method
  const p3 = bw.send('VKWebAppGetUserInfo');
  w.fire('message', { data: { type: 'vk-connect', data: { type: 'VKWebAppGetUserInfoResult', data: { first_name: 'Без' } } } });
  assert.equal((await p3).first_name, 'Без');
  // iOS when there is no Android, React Native when neither
  const i = fakeWin({ ios: true, rn: true, web: true });
  void createBridge(i.w).send('VKWebAppShare', {}).catch(() => {});
  assert.equal(i.log[0].ch, 'ios');
  const r = fakeWin({ rn: true, web: true });
  void createBridge(r.w).send('VKWebAppShare', {}).catch(() => {});
  assert.equal(r.log[0].ch, 'rn');
});

test('a Failed answer rejects with VK\'s error; a cancel is told apart; no answer in time, or no bridge at all, rejects', async () => {
  const f = fakeWin({ web: true });
  const b = createBridge(f.w, { timeout: 40 });
  const p = b.send('VKWebAppShowOrderBox', { type: 'item', item: 'd290' });
  assert.deepEqual(f.log[0].params, { type: 'item', item: 'd290', request_id: f.log[0].params.request_id });
  f.fire('message', { data: { type: 'vk-connect', data: { type: 'VKWebAppShowOrderBoxFailed', data: { error_type: 'client_error', error_data: { error_code: 4, error_reason: 'User denied' }, request_id: f.log[0].params.request_id } } } });
  const e = await p.then(() => null, (x: unknown) => x);
  assert.ok(e instanceof VkFail);
  assert.equal(e.cancelled, true);
  assert.equal(orderOutcome(e), 'cancelled');
  const t = await b.send('VKWebAppGetUserInfo').then(() => null, (x: unknown) => x);
  assert.ok(t instanceof VkFail);
  assert.equal(t.cancelled, false);
  assert.equal(orderOutcome(t), 'failed');
  assert.equal(b.waiting, 0);
  const none = await createBridge({}).send('VKWebAppShare').then(() => null, (x: unknown) => x);
  assert.ok(none instanceof VkFail);
});

test('VKWebAppShowOrderBox: an answer missing its fields does not crash — read as paid, or as VK says', async () => {
  // (the doubloons themselves come by the server's callback either way: the answer only picks the toast)
  assert.equal(orderOutcome({}), 'paid');
  assert.equal(orderOutcome(undefined), 'paid');
  assert.equal(orderOutcome(null), 'paid');
  assert.equal(orderOutcome('ok'), 'paid');
  assert.equal(orderOutcome({ success: true, order_id: 5 }), 'paid');
  assert.equal(orderOutcome({ status: 'success' }), 'paid');
  assert.equal(orderOutcome({ items: null, status: undefined }), 'paid');
  assert.equal(orderOutcome({ success: false }), 'failed');
  assert.equal(orderOutcome({ status: 'cancel' }), 'cancelled');
  assert.equal(orderOutcome({ status: 'fail' }), 'failed');
  // through the bridge: a Result whose data is missing entirely
  const f = fakeWin({ android: true });
  const b = createBridge(f.w);
  const p = b.send('VKWebAppShowOrderBox', { type: 'item', item: 'd590' });
  f.fire('VKWebAppEvent', { detail: { type: 'VKWebAppShowOrderBoxResult' } });
  assert.equal(orderOutcome(await p), 'paid');
  // and a detail that is not an object at all
  f.fire('VKWebAppEvent', { detail: undefined });
  f.fire('VKWebAppEvent', {});
  // the other events reach the listeners (VKWebAppUpdateConfig's insets)
  const seen: string[] = [];
  b.on((type) => seen.push(type));
  f.fire('VKWebAppEvent', { detail: { type: 'VKWebAppUpdateConfig', data: { insets: { top: 24, bottom: 0, left: 0, right: 0 } } } });
  assert.deepEqual(seen, ['VKWebAppUpdateConfig']);
});
