// Outbound through an HTTP CONNECT proxy, for the hosts Russia blocks (api.telegram.org): the server in Russia runs a
// local failover front (egress-proxy: 127.0.0.1:8118 → tunnels to the owner's foreign servers). Opt-in by env:
// TG_PROXY=http://127.0.0.1:8118 (or TELEGRAM_PROXY). Without it the Bot API is called with the plain global fetch.
// Node's fetch has no proxy without the undici package, so this is a small CONNECT tunnel on node:http + node:tls.
//
// If the proxy itself can't be reached or refuses the tunnel (nothing has been sent to the target yet), the call is
// tried once directly — a server outside Russia keeps working with the variable set. Once the tunnel is up, a failure
// is NOT retried (a sendMessage must not go out twice).

import { request as httpRequest } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { connect as tlsConnect } from 'node:tls';
import type { Socket } from 'node:net';

export interface EgressInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface EgressResponse {
  status: number;
  ok: boolean;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type EgressFetch = (url: string, init: EgressInit) => Promise<EgressResponse>;

/** Thrown when the tunnel can't be opened: the request never left, so it is safe to try again elsewhere. */
export class ProxyTunnelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProxyTunnelError';
  }
}

/** The proxy URL from the environment (http:// only), or null: TG_PROXY, else TELEGRAM_PROXY. `direct`/`off` = none. */
export function tgProxyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = (env.TG_PROXY ?? env.TELEGRAM_PROXY ?? '').trim();
  if (!v || v === 'direct' || v === 'off' || v === '0') return null;
  const u = new URL(v);
  if (u.protocol !== 'http:') throw new Error(`TG_PROXY must be an http:// CONNECT proxy, got ${u.protocol}`);
  return v;
}

/** Opens a CONNECT tunnel to host:port through the proxy; resolves with the raw socket. */
function openTunnel(proxy: URL, host: string, port: number, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Host: `${host}:${port}` };
    if (proxy.username) {
      const cred = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
      headers['Proxy-Authorization'] = `Basic ${Buffer.from(cred).toString('base64')}`;
    }
    const req = httpRequest({
      host: proxy.hostname,
      port: Number(proxy.port || 80),
      method: 'CONNECT',
      path: `${host}:${port}`,
      headers,
      agent: false,
    });
    const timer = setTimeout(() => req.destroy(new ProxyTunnelError('proxy CONNECT timeout')), timeoutMs);
    req.once('connect', (res: IncomingMessage, socket: Socket) => {
      clearTimeout(timer);
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new ProxyTunnelError(`proxy CONNECT ${res.statusCode}`));
        return;
      }
      resolve(socket);
    });
    req.once('error', (e) => {
      clearTimeout(timer);
      reject(e instanceof ProxyTunnelError ? e : new ProxyTunnelError(`proxy unreachable: ${(e as NodeJS.ErrnoException).code ?? e.message}`));
    });
    req.end();
  });
}

/** One HTTP/1.1 exchange over an open tunnel (TLS for https:, plain for http: — the tests). */
function exchange(target: URL, socket: Socket, init: EgressInit, timeoutMs: number): Promise<EgressResponse> {
  return new Promise((resolve, reject) => {
    const tls = target.protocol === 'https:';
    const stream = tls ? tlsConnect({ socket, servername: target.hostname }) : socket;
    const body = init.body ?? '';
    const headers: Record<string, string> = { Host: target.host, Connection: 'close', ...(init.headers ?? {}) };
    if (body) headers['Content-Length'] = String(Buffer.byteLength(body));
    const req = httpRequest({
      method: init.method ?? 'GET',
      path: target.pathname + target.search,
      headers,
      // no `agent`: only then does node:http use createConnection (agent:false would dial host:80 itself)
      createConnection: () => stream,
    });
    const timer = setTimeout(() => req.destroy(new Error('request timeout')), timeoutMs);
    req.once('response', (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.once('end', () => {
        clearTimeout(timer);
        stream.destroy(); // one request per tunnel (Connection: close): free it now
        const text = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        resolve({ status, ok: status >= 200 && status < 300, text: async () => text, json: async () => JSON.parse(text) as unknown });
      });
      res.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    req.once('error', (e) => {
      clearTimeout(timer);
      stream.destroy();
      reject(e);
    });
    if (body) req.write(body);
    req.end();
  });
}

/** A fetch-like call through the CONNECT proxy; on a tunnel failure falls back to `direct` (the global fetch). */
export function proxiedFetch(proxyUrl: string, o: { timeoutMs?: number; direct?: EgressFetch | null; onFallback?: (why: string) => void } = {}): EgressFetch {
  const proxy = new URL(proxyUrl);
  const timeoutMs = o.timeoutMs ?? 30_000;
  const direct = o.direct === undefined ? (globalThis.fetch as unknown as EgressFetch) : o.direct;
  return async (url, init) => {
    const target = new URL(url);
    const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80));
    let socket: Socket;
    try {
      socket = await openTunnel(proxy, target.hostname, port, Math.min(timeoutMs, 20_000));
    } catch (e) {
      if (!direct) throw e;
      o.onFallback?.((e as Error).message);
      return direct(url, init);
    }
    return exchange(target, socket, init, timeoutMs);
  };
}

/** The fetch the Telegram Bot API should use: through TG_PROXY when set, else the global fetch. */
export function tgFetchFromEnv(env: NodeJS.ProcessEnv = process.env): EgressFetch {
  const proxy = tgProxyFromEnv(env);
  if (!proxy) return globalThis.fetch as unknown as EgressFetch;
  console.log(`[telegram] Bot API via egress proxy ${new URL(proxy).host}`);
  let warned = 0;
  return proxiedFetch(proxy, {
    onFallback: (why) => {
      const now = Date.now();
      if (now - warned > 60_000) {
        warned = now;
        console.warn(`[telegram] egress proxy failed (${why}); trying direct`);
      }
    },
  });
}
