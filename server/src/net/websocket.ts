// Minimal, dependency-free RFC 6455 WebSocket server endpoint (text frames, ping/pong, close,
// fragmentation). The game protocol is JSON text; a binary codec can replace it later without
// touching this layer (see docs/04_TECHNICAL_ARCHITECTURE.md, "Network").

import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { GameConn } from './conn.ts';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 64 * 1024;

export class WsConnection implements GameConn {
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  readonly remote: string;
  closed = false;
  private socket: Duplex;
  private buf: Buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private fragmentOpcode = 0;
  bytesOut = 0;

  constructor(socket: Duplex, remote: string) {
    this.socket = socket;
    this.remote = remote;
    socket.on('data', (d: Buffer) => this.onData(d));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  send(text: string): void {
    if (this.closed) return;
    const payload = Buffer.from(text, 'utf8');
    this.writeFrame(0x1, payload);
  }

  sendBinary(bytes: Uint8Array): void {
    if (this.closed) return;
    this.writeFrame(0x2, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  }

  close(code = 1000, reason = ''): void {
    if (this.closed) return;
    const r = Buffer.from(reason, 'utf8');
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0);
    r.copy(p, 2);
    this.writeFrame(0x8, p);
    this.socket.end();
    this.finish();
  }

  cork(): void {
    (this.socket as unknown as { cork?: () => void }).cork?.();
  }

  uncork(): void {
    (this.socket as unknown as { uncork?: () => void }).uncork?.();
  }

  get buffered(): number {
    return (this.socket as unknown as { writableLength?: number }).writableLength ?? 0;
  }

  private writeFrame(opcode: number, payload: Buffer): void {
    const len = payload.length;
    let header: Buffer;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x80 | opcode;
    this.bytesOut += header.length + len;
    this.socket.write(Buffer.concat([header, payload]));
  }

  private onData(chunk: Buffer): void {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 2) {
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return this.close(1009, 'too big');
        len = Number(big);
        off = 10;
      }
      if (!masked) return this.close(1002, 'client frames must be masked');
      if (len > MAX_MESSAGE) return this.close(1009, 'too big');
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) payload[i] = this.buf[off + 4 + i] ^ mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.handleFrame(fin, opcode, payload);
      if (this.closed) return;
    }
  }

  private handleFrame(fin: boolean, opcode: number, payload: Buffer): void {
    switch (opcode) {
      case 0x0: // continuation
        this.fragments.push(payload);
        if (this.fragments.reduce((n, f) => n + f.length, 0) > MAX_MESSAGE) return this.close(1009, 'too big');
        if (fin) {
          const all = Buffer.concat(this.fragments);
          this.fragments = [];
          if (this.fragmentOpcode === 0x1) this.onMessage(all.toString('utf8'));
        }
        return;
      case 0x1:
      case 0x2:
        if (!fin) {
          this.fragmentOpcode = opcode;
          this.fragments = [payload];
          return;
        }
        if (opcode === 0x1) this.onMessage(payload.toString('utf8'));
        return;
      case 0x8:
        this.close(1000);
        return;
      case 0x9:
        this.writeFrame(0xa, payload);
        return;
      case 0xa:
        return;
      default:
        this.close(1002, 'bad opcode');
    }
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    this.onClose();
  }
}

export function acceptUpgrade(req: IncomingMessage, socket: Duplex): WsConnection | null {
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  (socket as unknown as { setNoDelay?: (b: boolean) => void }).setNoDelay?.(true);
  const remote = (req.socket.remoteAddress ?? '?') + ':' + (req.socket.remotePort ?? 0);
  return new WsConnection(socket, remote);
}
