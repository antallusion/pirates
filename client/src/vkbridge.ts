// The VK Mini App's bridge (docs/36_VK.md), written here instead of @vkontakte/vk-bridge (the game takes no runtime
// dependencies). A call goes out by the channel the VK client gives the page:
//  - Android: window.AndroidBridge.<Method>(JSON string);
//  - iOS: window.webkit.messageHandlers.<Method>.postMessage(params);
//  - VK's React Native shell: window.ReactNativeWebView.postMessage(JSON.stringify({handler, params}));
//  - the web (vk.com, m.vk.com: the game in an iframe): parent.postMessage({handler, params, type: 'vk-connect'}, '*').
// VKWebAppInit goes out by ALL of them at once (owner, 2026-10-20: a VK moderator's phone saw the game never start —
// the splash waits for the init, and which channel a client listens on is not certain until it answers). Every other
// call takes the first channel there is, with its own request_id. The answers come back as window 'message' events
// ({type: 'vk-connect', data: {type: '<Method>Result' | '<Method>Failed', data: {…, request_id}}}) on the web and as
// window 'VKWebAppEvent' CustomEvents ({detail: {type, data}}) in the phones' clients; each is matched to its call by the
// request_id (an answer without one, to the oldest call of its method). No answer within the timeout: the call fails.
// No DOM imports (lifecycle.ts only): the node tests drive it with a fake window (tests/vkbridge.test.ts).

import { pauseApp, resumeApp } from './lifecycle.ts';

type Fn = (...a: unknown[]) => unknown;

/** What the bridge uses of the window (every part optional: a test's fake window, a client that has none of them). */
export interface BridgeWin {
  AndroidBridge?: Record<string, unknown> | null;
  webkit?: { messageHandlers?: Record<string, { postMessage?: Fn } | undefined> } | null;
  ReactNativeWebView?: { postMessage?: Fn } | null;
  parent?: { postMessage?: Fn } | null;
  addEventListener?: (type: string, fn: (e: { data?: unknown; detail?: unknown }) => void) => void;
  /** Set once VKWebAppInit went out (index.html's early script sends it before the game's code comes in). */
  __vkInit?: number;
}

export type Channel = 'android' | 'ios' | 'rn' | 'web';

/** A call VK refused (its *Failed answer, or no answer in time): error_type and error_data as VK gave them. */
export class VkFail extends Error {
  type: string;
  data: Record<string, unknown>;
  constructor(type: string, data: Record<string, unknown>) {
    super(`${type}: ${JSON.stringify(data).slice(0, 200)}`);
    this.type = type;
    this.data = data;
  }
  /** The user closed VK's window herself (error_code 4, «User denied» / «cancelled»). */
  get cancelled(): boolean {
    const e = (this.data.error_data ?? this.data) as Record<string, unknown>;
    return Number(e?.error_code) === 4 || /cancel|denied/i.test(String(e?.error_reason ?? e?.error_msg ?? ''));
  }
}

interface Pending {
  method: string;
  resolve: (d: Record<string, unknown>) => void;
  reject: (e: VkFail) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface Bridge {
  /** VKWebAppInit by every channel (once: `force` sends it again); the channels it went by. */
  init(force?: boolean): Channel[];
  /** A call by the first channel there is; its answer's data, or a VkFail. */
  send(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>>;
  /** Every answer and event VK sends (VKWebAppUpdateConfig, VKWebAppViewHide …). */
  on(fn: (type: string, data: Record<string, unknown>) => void): void;
  /** An answer handed in by hand (the listeners do it; the tests too). */
  receive(msg: unknown): void;
  /** The calls still waiting for their answers. */
  readonly waiting: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

export function createBridge(w: BridgeWin, o: { timeout?: number } = {}): Bridge {
  const pending = new Map<string, Pending>();
  const listeners: ((type: string, data: Record<string, unknown>) => void)[] = [];
  let seq = 0;

  /** Out by the channels: all of them, or the first there is. Each one tried on its own (one that throws stops none). */
  function out(method: string, params: Record<string, unknown>, all: boolean): Channel[] {
    const used: Channel[] = [];
    const ab = w.AndroidBridge;
    if (ab && typeof ab[method] === 'function') {
      try {
        (ab[method] as Fn).call(ab, JSON.stringify(params));
        used.push('android');
      } catch {
        /* the next channel */
      }
      if (!all && used.length) return used;
    }
    const ios = w.webkit?.messageHandlers?.[method];
    if (ios && typeof ios.postMessage === 'function') {
      try {
        ios.postMessage(params);
        used.push('ios');
      } catch {
        /* the next channel */
      }
      if (!all && used.length) return used;
    }
    const rn = w.ReactNativeWebView;
    if (rn && typeof rn.postMessage === 'function') {
      try {
        rn.postMessage(JSON.stringify({ handler: method, params }));
        used.push('rn');
      } catch {
        /* the next channel */
      }
      if (!all && used.length) return used;
    }
    const p = w.parent;
    if (p && typeof p.postMessage === 'function') {
      try {
        p.postMessage({ handler: method, params, type: 'vk-connect' }, '*');
        used.push('web');
      } catch {
        /* none left */
      }
    }
    return used;
  }

  function receive(msg: unknown): void {
    let d = msg;
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch {
        return;
      }
    }
    if (!isObj(d)) return;
    // the web's envelope (our own outgoing calls carry `handler` and no `data`: not answers)
    if (d.type === 'vk-connect') {
      if (isObj(d.data)) receive(d.data);
      return;
    }
    const type = typeof d.type === 'string' ? d.type : '';
    if (!type) return;
    const data = isObj(d.data) ? d.data : {};
    const m = /^(VKWebApp\w+?)(Result|Failed)$/.exec(type);
    if (m) {
      const rid = data.request_id;
      let id = rid !== undefined && rid !== null ? String(rid) : '';
      if (!id) for (const [k, p] of pending) if (p.method === m[1]) { id = k; break; }
      const p = pending.get(id);
      if (p) {
        pending.delete(id);
        clearTimeout(p.timer);
        if (m[2] === 'Result') p.resolve(data);
        else p.reject(new VkFail(type, data));
      }
    }
    for (const l of listeners) {
      try {
        l(type, data);
      } catch {
        /* a listener's own fault */
      }
    }
  }

  w.addEventListener?.('message', (e) => receive(e?.data));
  w.addEventListener?.('VKWebAppEvent', (e) => receive(e?.detail));

  return {
    init(force = false) {
      if (w.__vkInit && !force) return [];
      w.__vkInit = Date.now();
      return out('VKWebAppInit', {}, true);
    },
    send(method, params = {}, timeoutMs = o.timeout ?? 15_000) {
      const id = `gt${Date.now().toString(36)}${(++seq).toString(36)}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new VkFail(`${method}Failed`, { error_type: 'client_error', error_data: { error_code: 0, error_reason: 'timeout' } }));
        }, timeoutMs);
        pending.set(id, { method, resolve, reject, timer });
        const used = out(method, { ...params, request_id: id }, false);
        if (!used.length) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new VkFail(`${method}Failed`, { error_type: 'client_error', error_data: { error_code: 0, error_reason: 'no bridge' } }));
        }
      });
    },
    on(fn) {
      listeners.push(fn);
    },
    receive,
    get waiting() {
      return pending.size;
    },
  };
}

/** VK's own «the app is out of sight» and «back» (owner, 2026-10-20 — VK moderation: the sound went on and the game
 *  ran with the app minimised): VKWebAppViewHide puts the game to sleep, VKWebAppViewRestore wakes it (lifecycle.ts). */
export function bindViewEvents(b: Bridge): void {
  b.on((type) => {
    if (type === 'VKWebAppViewHide') pauseApp('vk');
    else if (type === 'VKWebAppViewRestore') resumeApp('vk');
  });
}

/** VKWebAppShowOrderBox's answer read without trusting its shape (owner, 2026-10-20: a game crashed on an answer with no
 *  array of items): paid unless VK says otherwise — the doubloons themselves come by the server's callback either way. */
export function orderOutcome(r: unknown): 'paid' | 'cancelled' | 'failed' {
  if (r instanceof VkFail) return r.cancelled ? 'cancelled' : 'failed';
  if (!isObj(r)) return 'paid';
  if (r.success === false) return 'failed';
  const st = typeof r.status === 'string' ? r.status.toLowerCase() : '';
  if (/cancel/.test(st)) return 'cancelled';
  if (/fail|error/.test(st)) return 'failed';
  return 'paid';
}
