// Outgoing mail for account verification and password resets. SMTP without dependencies (plain, STARTTLS or
// implicit TLS; AUTH PLAIN), or — when SMTP_URL is not configured — an outbox that logs and keeps the letters
// (development and tests).

import { connect as netConnect } from 'node:net';
import type { Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

export interface Mail {
  to: string;
  subject: string;
  text: string;
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
  const url = process.env.SMTP_URL;
  return url ? new SmtpMailer(url, process.env.MAIL_FROM ?? 'harbourmaster@gravetide.local') : new OutboxMailer(log);
}
