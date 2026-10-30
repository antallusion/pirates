// The Bot API through the server's egress proxy (server in Russia: api.telegram.org is blocked; the owner, 2026-10-30:
// «если один какой-то при обращении не сработал, то сработает другой»): TG_PROXY opts in, the call goes through an
// HTTP CONNECT tunnel, a dead or refusing proxy falls back to direct, a failure after the tunnel is up is not repeated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import { connect, createServer as createTcpServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { proxiedFetch, tgFetchFromEnv, tgProxyFromEnv, ProxyTunnelError } from '../server/src/net/egress.ts';
import type { EgressFetch } from '../server/src/net/egress.ts';

const port = (s: { address(): unknown }): number => (s.address() as AddressInfo).port;
const listen = <T extends { listen(port: number, host: string, cb: () => void): unknown }>(s: T): Promise<T> =>
  new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
/** Closes a server without waiting on its open sockets (a tunnel's far side may linger). */
const close = (s: { close(cb: () => void): unknown; closeAllConnections?: () => void }): Promise<void> =>
  new Promise((r) => {
    s.close(() => r());
    s.closeAllConnections?.();
  });
/** A TCP server that remembers its sockets, so the test can drop them. */
function tcpServer(onConn: (s: Socket) => void = () => {}): ReturnType<typeof createTcpServer> & { closeAllConnections: () => void } {
  const socks = new Set<Socket>();
  const srv = createTcpServer((s) => {
    socks.add(s);
    s.on('close', () => socks.delete(s));
    onConn(s);
  });
  return Object.assign(srv, { closeAllConnections: () => socks.forEach((s) => s.destroy()) });
}

/** A fake "Bot API": answers JSON with what it got. */
async function target(): Promise<{ server: Server; hits: { method: string; url: string; body: string }[] }> {
  const hits: { method: string; url: string; body: string }[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      hits.push({ method: req.method ?? '', url: req.url ?? '', body });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result: { echo: JSON.parse(body || '{}') } }));
    });
  });
  return { server: await listen(server), hits };
}

/** A CONNECT proxy; `deny` answers 503 (all upstreams down). */
async function proxy(deny = false): Promise<{ server: Server; connects: string[] }> {
  const connects: string[] = [];
  const server = createServer((_req, res) => res.writeHead(405).end());
  server.on('connect', (req: IncomingMessage, client: Socket, head: Buffer) => {
    connects.push(req.url ?? '');
    if (deny) {
      client.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      return;
    }
    const [h, p] = (req.url ?? '').split(':');
    const up = connect(Number(p), h, () => {
      client.write('HTTP/1.1 200 Connection established\r\n\r\n');
      if (head.length) up.write(head);
      up.pipe(client);
      client.pipe(up);
    });
    up.on('error', () => client.destroy());
    up.on('close', () => client.destroy());
    client.on('error', () => up.destroy());
    client.on('close', () => up.destroy());
  });
  return { server: await listen(server), connects };
}

test('egress: the Bot API call goes through the CONNECT tunnel, body and answer intact', async () => {
  const t = await target();
  const px = await proxy();
  const directCalls: string[] = [];
  const direct: EgressFetch = async (url) => {
    directCalls.push(url);
    throw new Error('direct must not be used');
  };
  const f = proxiedFetch(`http://127.0.0.1:${port(px.server)}`, { direct });
  const res = await f(`http://127.0.0.1:${port(t.server)}/botTOKEN/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 7, text: 'Ахой' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: { echo: { chat_id: 7, text: 'Ахой' } } });
  assert.deepEqual(px.connects, [`127.0.0.1:${port(t.server)}`]);
  assert.equal(t.hits.length, 1);
  assert.equal(t.hits[0].method, 'POST');
  assert.equal(t.hits[0].url, '/botTOKEN/sendMessage');
  assert.equal(directCalls.length, 0);
  await close(px.server);
  await close(t.server);
});

test('egress: a dead proxy or a refused tunnel falls back to direct (nothing was sent yet)', async () => {
  const dead = await listen(tcpServer());
  const deadPort = port(dead);
  await close(dead); // nothing listens there now
  const refusing = await proxy(true);
  for (const purl of [`http://127.0.0.1:${deadPort}`, `http://127.0.0.1:${port(refusing.server)}`]) {
    const why: string[] = [];
    const direct: EgressFetch = async () => ({ status: 200, ok: true, text: async () => '{"ok":true}', json: async () => ({ ok: true, direct: true }) });
    const res = await proxiedFetch(purl, { direct, onFallback: (w) => why.push(w) })('https://api.telegram.org/botX/getMe', { method: 'POST', body: '{}' });
    assert.deepEqual(await res.json(), { ok: true, direct: true });
    assert.equal(why.length, 1);
  }
  // without a fallback the tunnel error is thrown as such
  await assert.rejects(proxiedFetch(`http://127.0.0.1:${port(refusing.server)}`, { direct: null })('https://api.telegram.org/', {}), ProxyTunnelError);
  await close(refusing.server);
});

test('egress: a failure after the tunnel is up is not repeated directly (no double sendMessage)', async () => {
  // the "target" accepts and hangs up without an answer
  const rude = await listen(tcpServer((s) => s.destroy()));
  const px = await proxy();
  let direct = 0;
  const f = proxiedFetch(`http://127.0.0.1:${port(px.server)}`, { direct: async () => { direct++; throw new Error('no'); } });
  await assert.rejects(f(`http://127.0.0.1:${port(rude)}/botX/sendMessage`, { method: 'POST', body: '{}' }));
  assert.equal(direct, 0);
  await close(px.server);
  await close(rude);
});

test('egress: TG_PROXY opts in (TELEGRAM_PROXY too), unset/direct = the plain fetch, only http:// proxies', () => {
  assert.equal(tgProxyFromEnv({}), null);
  assert.equal(tgProxyFromEnv({ TG_PROXY: 'direct' }), null);
  assert.equal(tgProxyFromEnv({ TG_PROXY: ' http://127.0.0.1:8118 ' }), 'http://127.0.0.1:8118');
  assert.equal(tgProxyFromEnv({ TELEGRAM_PROXY: 'http://127.0.0.1:8118' }), 'http://127.0.0.1:8118');
  assert.throws(() => tgProxyFromEnv({ TG_PROXY: 'socks5://127.0.0.1:1080' }));
  assert.equal(tgFetchFromEnv({}), globalThis.fetch);
  assert.notEqual(tgFetchFromEnv({ TG_PROXY: 'http://127.0.0.1:8118' }), globalThis.fetch);
});
