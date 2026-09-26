// What the world needs from a player's connection. A browser socket (WsConnection, single-process mode)
// and a session relayed by the Gateway over the internal link (RemoteConnection, net/link.ts) both fit.

import type { IncomingMessage } from 'node:http';

export interface GameConn {
  onMessage: (text: string) => void;
  onClose: () => void;
  /** The player's address (as the Gateway saw it). */
  readonly remote: string;
  readonly closed: boolean;
  send(text: string): void;
  sendBinary(bytes: Uint8Array): void;
  close(code?: number, reason?: string): void;
}

/** The player's address; behind a TLS terminator set TRUST_PROXY=1 to read X-Forwarded-For. */
export function clientIp(req: IncomingMessage, trustProxy = process.env.TRUST_PROXY === '1'): string {
  if (trustProxy) {
    const xf = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xf) ? xf[0] : xf)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? '?';
}
