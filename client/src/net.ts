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
    localStorage.setItem(TOKEN_KEY, token);
    this.pendingName = null;
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  on(fn: (m: ServerMsg) => void): void {
    this.handlers.push(fn);
  }

  connect(name?: string): void {
    if (name) this.pendingName = name;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
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
        localStorage.setItem(TOKEN_KEY, m.token);
        this.pendingName = null;
      }
      if (m.t === 'pong') this.rtt = performance.now() - m.c;
      for (const h of this.handlers) h(m);
    };
    ws.onclose = (ev) => {
      this.onStatus(false);
      if (ev.code === 4000) return; // replaced by another login
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  forget(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
