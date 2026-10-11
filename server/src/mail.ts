// Outgoing mail for account verification, password resets and the support desk: Sendersy's HTTP API when
// SENDERSY_API_KEY is set (production), else SMTP without dependencies (plain, STARTTLS or implicit TLS; AUTH PLAIN),
// or — with neither — an outbox that logs and keeps the letters (development and tests).

import { connect as netConnect } from 'node:net';
import type { Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Where a reply goes (the support desk by default with Sendersy). */
  replyTo?: string;
  /** A Sendersy ready-made letter instead of our own words (e.g. 'sendersy/email-verify--gaming'), its tongue and
   *  its fields; the subject and text stay as the fallback for the other mailers. */
  template?: string;
  locale?: 'ru' | 'en';
  variables?: Record<string, string>;
}

/** The address cannot take the letter (Sendersy 422: unknown, mistyped or throwaway) or the sender is over its
 *  rate (429 after the retries): told to the captain, never retried in a loop. */
export class MailRejected extends Error {
  readonly kind: 'invalid' | 'limited';
  constructor(kind: 'invalid' | 'limited') {
    super(kind === 'invalid' ? 'address rejected' : 'rate limited');
    this.kind = kind;
  }
}

/** An address for the log: its first letter and its domain (never the whole of it). */
export const maskAddress = (a: string): string => {
  const [u, d] = String(a).split('@');
  return d ? `${(u ?? '').slice(0, 1)}***@${d}` : '***';
};

/** Sendersy's HTTP API (owner, 2026-10-11): POST https://api.sendersy.com/v1/emails with the send-only key, from
 *  noreply@gravetidegame.com, replies to the support desk. A 422 is the address's fault (MailRejected 'invalid'); a 429
 *  waits and tries twice more, then gives up (MailRejected 'limited'). The key and the API's answers are never logged
 *  whole — the status and a masked address only. */
export class SendersyMailer implements Mailer {
  private key: string;
  private from: string;
  private replyTo: string;
  private endpoint: string;
  private fetchImpl: typeof fetch;
  private wait: (ms: number) => Promise<void>;
  private log: (m: string) => void;
  constructor(key: string, opts: { from?: string; replyTo?: string; endpoint?: string; fetchImpl?: typeof fetch; wait?: (ms: number) => Promise<void>; log?: (m: string) => void } = {}) {
    this.key = key;
    this.from = opts.from ?? 'Gravetide <noreply@gravetidegame.com>';
    this.replyTo = opts.replyTo ?? 'support@gravetidegame.com';
    this.endpoint = opts.endpoint ?? 'https://api.sendersy.com/v1/emails';
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.wait = opts.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.log = opts.log ?? ((m) => console.log(m));
  }
  async send(mail: Mail): Promise<void> {
    const body: Record<string, unknown> = { from: this.from, to: mail.to, reply_to: mail.replyTo ?? this.replyTo, subject: mail.subject };
    if (mail.template) {
      body.template = mail.template;
      body.locale = mail.locale ?? 'en';
      body.variables = mail.variables ?? {};
    } else {
      body.text = mail.text;
      if (mail.html) body.html = mail.html;
    }
    const pauses = [2000, 5000];
    for (let attempt = 0; ; attempt++) {
      let status = 0;
      let retryAfter = 0;
      try {
        const res = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
        status = res.status;
        retryAfter = Number(res.headers.get('retry-after') ?? 0) * 1000;
        await res.text().catch(() => ''); // drained, never logged
      } catch (e) {
        this.log(`[mail] sendersy unreachable for ${maskAddress(mail.to)}: ${(e as Error).name}`);
        throw new Error('mail service unreachable');
      }
      if (status >= 200 && status < 300) {
        this.log(`[mail] sendersy ${status} to ${maskAddress(mail.to)}${mail.template ? ` (${mail.template})` : ''}`);
        return;
      }
      if (status === 422) {
        this.log(`[mail] sendersy 422 to ${maskAddress(mail.to)}: the address is refused`);
        throw new MailRejected('invalid');
      }
      if (status === 429 && attempt < pauses.length) {
        this.log(`[mail] sendersy 429, waiting before attempt ${attempt + 2}`);
        await this.wait(Math.min(30_000, Math.max(pauses[attempt], retryAfter)));
        continue;
      }
      this.log(`[mail] sendersy ${status} to ${maskAddress(mail.to)}`);
      if (status === 429) throw new MailRejected('limited');
      throw new Error(`mail service answered ${status}`);
    }
  }
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class OutboxMailer implements Mailer {
  readonly sent: Mail[] = [];
  private log: (m: string) => void;
  constructor(log: (m: string) => void = (m) => console.log(m)) {
    this.log = log;
  }
  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    if (this.sent.length > 100) this.sent.shift();
    this.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
  }
}

/** SMTP_URL: smtp://user:pass@host:587 (STARTTLS when offered) or smtps://user:pass@host:465 (implicit TLS). */
export class SmtpMailer implements Mailer {
  private url: URL;
  private from: string;
  constructor(url: string, from: string) {
    this.url = new URL(url);
    this.from = from;
  }

  async send(mail: Mail): Promise<void> {
    const u = this.url;
    const secure = u.protocol === 'smtps:';
    const host = u.hostname;
    const port = Number(u.port || (secure ? 465 : 587));
    let sock: Socket = secure ? tlsConnect({ host, port, servername: host }) : netConnect({ host, port });
    const conv = new SmtpConversation(sock);
    await conv.expect(220);
    let ehlo = await conv.cmd(`EHLO gravetide`, 250);
    if (!secure && /STARTTLS/i.test(ehlo)) {
      await conv.cmd('STARTTLS', 220);
      sock = tlsConnect({ socket: sock, servername: host });
      conv.rebind(sock);
      ehlo = await conv.cmd('EHLO gravetide', 250);
    }
    if (u.username) {
      const auth = Buffer.from(`\0${decodeURIComponent(u.username)}\0${decodeURIComponent(u.password)}`).toString('base64');
      await conv.cmd(`AUTH PLAIN ${auth}`, 235);
    }
    await conv.cmd(`MAIL FROM:<${this.from}>`, 250);
    await conv.cmd(`RCPT TO:<${mail.to}>`, 250);
    await conv.cmd('DATA', 354);
    const body = [
      `From: GRAVETIDE <${this.from}>`,
      `To: <${mail.to}>`,
      `Subject: ${mail.subject}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      ...mail.text.split(/\r?\n/).map((l) => (l.startsWith('.') ? '.' + l : l)),
      '.',
    ].join('\r\n');
    await conv.cmd(body, 250);
    await conv.cmd('QUIT', 221).catch(() => undefined);
    sock.destroy();
  }
}

class SmtpConversation {
  private sock: Socket;
  private buf = '';
  private waiter: ((line: string) => void) | null = null;
  private failed: Error | null = null;
  private onFail: ((e: Error) => void) | null = null;

  constructor(sock: Socket) {
    this.sock = sock;
    this.bind();
  }

  rebind(sock: Socket): void {
    this.sock = sock;
    this.buf = '';
    this.bind();
  }

  private bind(): void {
    this.sock.setEncoding('utf8');
    this.sock.on('data', (d: string) => {
      this.buf += d;
      // A reply ends with a line "NNN text" (a space, not a dash, after the code).
      const lines = this.buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const reply = lines.slice(0, i + 1).join('\n');
          this.buf = lines.slice(i + 1).join('\r\n');
          const w = this.waiter;
          this.waiter = null;
          w?.(reply);
          return;
        }
      }
    });
    this.sock.on('error', (e) => {
      this.failed = e;
      this.onFail?.(e);
    });
  }

  expect(code: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.failed) return reject(this.failed);
      this.onFail = reject;
      const timer = setTimeout(() => reject(new Error('SMTP timeout')), 15_000);
      this.waiter = (reply) => {
        clearTimeout(timer);
        if (Number(reply.slice(0, 3)) !== code) reject(new Error(`SMTP: expected ${code}, got ${reply}`));
        else resolve(reply);
      };
    });
  }

  cmd(line: string, code: number): Promise<string> {
    const p = this.expect(code);
    this.sock.write(line + '\r\n');
    return p;
  }
}

export function mailerFromEnv(log?: (m: string) => void): Mailer {
  const key = process.env.SENDERSY_API_KEY;
  if (key) return new SendersyMailer(key, { from: process.env.MAIL_FROM, replyTo: process.env.MAIL_REPLY_TO, log });
  const url = process.env.SMTP_URL;
  return url ? new SmtpMailer(url, process.env.MAIL_FROM ?? 'harbourmaster@gravetide.local') : new OutboxMailer(log);
}
