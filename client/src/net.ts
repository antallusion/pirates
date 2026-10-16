// WebSocket connection with token persistence and automatic reconnect.

import { PROTOCOL_VERSION } from '../../shared/src/constants.ts';
import { decodeSnap } from '../../shared/src/codec.ts';
import type { ClientMsg, ServerMsg } from '../../shared/src/protocol.ts';

const TOKEN_KEY = 'gravetide.token';

export class Net {
  private ws: WebSocket | null = null;
  private handlers: ((m: ServerMsg) => void)[] = [];
  private pendingName: string | null = null;
  private retry = 0;
  onStatus: (connected: boolean) => void = () => {};
  rtt = 0;
  bytesIn = 0;

  /** Take a token issued over HTTP (e-mail or OAuth sign-in). */
  adopt(token: string): void {
    store(token);
    this.pendingName = null;
  }

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? memToken;
    } catch {
      return memToken;
    }
  }

  on(fn: (m: ServerMsg) => void): void {
    this.handlers.push(fn);
  }

  /** A socket open or opening (a second one makes the server drop one of the two sessions, docs/23 item 94). */
  get live(): boolean {
    return !!this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING);
  }

  connect(name?: string): void {
    if (name) this.pendingName = name;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    // A socket that never opens (a phone's network changing under it, a turn of the screen in Telegram's view): given
    // up after 10 s, and the usual retry follows (it stayed «connecting» for ever, and the start with it).
    const stuck = setTimeout(() => {
      if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) ws.close();
    }, 10_000);
    ws.onopen = () => {
      clearTimeout(stuck);
      this.retry = 0;
      this.onStatus(true);
      const token = this.token;
      this.send({ t: 'hello', v: PROTOCOL_VERSION, token: token ?? undefined, name: this.pendingName ?? undefined });
    };
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      if (ev.data instanceof ArrayBuffer) {
        this.bytesIn += ev.data.byteLength;
        m = decodeSnap(ev.data);
      } else {
        const text = String(ev.data);
        this.bytesIn += text.length;
        m = JSON.parse(text) as ServerMsg;
      }
      if (m.t === 'welcome') {
        store(m.token);
        this.pendingName = null;
      }
      if (m.t === 'pong') this.rtt = performance.now() - m.c;
      for (const h of this.handlers) h(m);
    };
    ws.onclose = (ev) => {
      clearTimeout(stuck);
      // (an old socket's close, after a newer one took its place, retries nothing)
      if (this.ws !== ws) return;
      this.onStatus(false);
      if (ev.code === 4000) return; // replaced by another login
      // Out of date (a tab kept open across a deploy, docs/23 item 96): the new client is a reload away. Once a minute
      // at most, so a server and a client that disagree for some other reason do not reload each other for ever.
      if (ev.code === 4002) {
        let last = 0;
        try { last = Number(sessionStorage.getItem('gravetide.reloadAt') ?? 0); } catch { /* no storage */ }
        if (Date.now() - last > 60_000) {
          try { sessionStorage.setItem('gravetide.reloadAt', String(Date.now())); } catch { /* no storage */ }
          location.reload();
        }
        return;
      }
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  forget(): void {
    memToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* no storage */
    }
  }
}

/** The token where the page can keep it (a view without storage keeps it for the visit). */
let memToken: string | null = null;
function store(token: string): void {
  memToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* no storage: kept for the visit */
  }
}
