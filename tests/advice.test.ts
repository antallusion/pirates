// The advice mailer's rules (shared/src/data/advice.ts) and its e-mail (server/src/game/advice.ts adviceMail).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVICE_DAY_GAP, ADVICE_FAR, ADVICE_KIND_GAP, adviceHints, captainFromSave, isleFromHolding, advicePatterns, adviceUnsubscribe, letterWords, markSent, newAdviceState, notACaptain, outsideWords, pickHint } from '../shared/src/data/advice.ts';
import type { HintCaptain } from '../shared/src/data/advice.ts';
import type { AdviceCaptain } from '../shared/src/data/armyadvice.ts';
import { armyAdvice } from '../shared/src/data/armyadvice.ts';
import { adviceMail } from '../server/src/game/advice.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';

type Opt = Partial<Omit<HintCaptain, 'cap'>> & Partial<AdviceCaptain> & { town?: AdviceCaptain['isle'] };
const cap = (o: Opt = {}): HintCaptain => {
  const { acc = 1, name = 'Николай', online = true, awayMs = 0, campaign = { ch: 3, k: 1, size: 8 }, town, ...a } = o;
  const isle = 'town' in o ? (town ?? null) : { hall: 1 };
  return { acc, name, online, awayMs, campaign, cap: { level: 14, shipLevel: 6, army: [{ u: 'deckhand', n: 60 }], crewMax: 60, slots: 5, gold: 5000, isle, ...a } };
};
const kinds = (c: HintCaptain) => adviceHints(c).map((h) => h.kind);

test('a top captain with deckhands and a raw island: island first, then army', () => {
  assert.deepEqual(kinds(cap()), ['island', 'army']);
  const h = adviceHints(cap())[0];
  assert.equal(h.building, 'dw1');
  assert.equal(adviceHints(cap({ town: { hall: 1, dw1: 1 } }))[0].building, 'dw2');
  assert.equal(adviceHints(cap({ town: null }))[0].building, '');
});

test('no island hint below level 5; a raised island is not raw', () => {
  assert.ok(!kinds(cap({ level: 4 })).includes('island'));
  assert.ok(!kinds(cap({ town: { hall: 1, dw1: 1, dw2: 1, keep: 1 } })).includes('island'));
});

test('a tier opened and never hired; hired — no hint', () => {
  const t = adviceHints(cap({ town: { hall: 1, dw1: 1, dw2: 1, keep: 1 } })).find((h) => h.kind === 'tier');
  assert.equal(t?.tier, 2);
  assert.ok(!kinds(cap({ town: { hall: 1, dw1: 1, dw2: 1 }, army: [{ u: 'marine', n: 20 }, { u: 'deckhand', n: 40 }] })).includes('tier'));
  // a tier her ship does not berth yet is not told
  assert.ok(!kinds(cap({ town: { hall: 3, dw1: 1, dw2: 0, dw6: 1 }, shipLevel: 3 })).includes('tier'));
});

test('return: away a day with the campaign unfinished, never by letter', () => {
  const c = cap({ online: false, awayMs: 2 * 86_400_000 });
  assert.ok(kinds(c).includes('return'));
  assert.ok(!kinds(cap({ online: false, awayMs: 3_600_000 })).includes('return'));
  assert.ok(!kinds(cap({ online: false, awayMs: 2 * 86_400_000, campaign: null })).includes('return'));
  const only = adviceHints(c).filter((h) => h.kind === 'return');
  assert.equal(pickHint(only, newAdviceState(), 'letter', 1e12, c), null);
  assert.equal(pickHint(only, newAdviceState(), 'email', 1e12, c)?.kind, 'return');
});

test('bots and QA accounts get nothing', () => {
  assert.ok(notACaptain('Bot k3j2h1'));
  assert.ok(notACaptain('qa_7'));
  assert.ok(!notACaptain('Николай'));
  assert.ok(!notACaptain('Botanik'));
  assert.deepEqual(adviceHints(cap({ name: 'Bot abc' })), []);
});

test('limits: a kind once in three days per channel, a letter a day, one outside a day for all', () => {
  const c = cap({ online: false, awayMs: 2 * 86_400_000 });
  const hints = adviceHints(c);
  const st = newAdviceState();
  const t0 = 1_800_000_000_000;
  assert.equal(pickHint(hints, st, 'letter', t0, c)?.kind, 'island');
  markSent(st, 'letter', 'island', t0);
  assert.equal(pickHint(hints, st, 'letter', t0 + ADVICE_DAY_GAP - 1, c), null);
  assert.equal(pickHint(hints, st, 'letter', t0 + ADVICE_DAY_GAP, c)?.kind, 'army');
  assert.equal(pickHint(hints, st, 'letter', t0 + ADVICE_KIND_GAP, c)?.kind, 'island');
  markSent(st, 'email', 'island', t0);
  assert.equal(pickHint(hints, st, 'push', t0 + 1000, c), null); // the e-mail took the day's one
  assert.equal(pickHint(hints, st, 'push', t0 + ADVICE_DAY_GAP, c)?.kind, 'island'); // the push's own kinds are its own
  assert.equal(pickHint(hints, st, 'email', t0 + ADVICE_DAY_GAP, c)?.kind, 'army');
  // nothing outside to one aboard, or away two weeks
  assert.equal(pickHint(hints, newAdviceState(), 'email', t0, cap()), null);
  assert.equal(pickHint(hints, newAdviceState(), 'email', t0, cap({ online: false, awayMs: ADVICE_FAR })), null);
  // unsubscribed: no e-mail, the rest go on
  assert.equal(pickHint(hints, { ...newAdviceState(), emailOff: true }, 'email', t0, c), null);
});

test('every letter has its Russian twin in the client table', () => {
  const table = new Map(advicePatterns());
  const c = cap({ town: { hall: 1, dw1: 1, dw2: 1, dw3: 1 } });
  for (const h of [...adviceHints(cap()), ...adviceHints(cap({ town: null })), ...adviceHints(c)]) {
    const w = letterWords(h, 'en');
    if (!w) continue;
    assert.ok(table.has(w.subject), w.subject);
    assert.ok(table.has(w.body), w.body);
    assert.match(table.get(w.body)!, /[а-я]/);
  }
});

test('the outside words: her language, her name, a notice line within VK’s 254', () => {
  for (const h of adviceHints(cap({ online: false, awayMs: 2 * 86_400_000 }))) {
    const ru = outsideWords(h, 'ru', 'Николай');
    assert.match(ru.paras[0], /Капитан Николай/);
    assert.ok(ru.line.length <= 254, ru.line);
    assert.match(outsideWords(h, 'en', 'Nick').paras[0], /Captain Nick/);
  }
});

test('the e-mail: the play link, the one-click unsubscribe, escaped', () => {
  const h = adviceHints(cap())[0];
  const m = adviceMail(h, 'ru', '<b>', 'https://gravetidegame.com/', 'https://gravetidegame.com/auth/unsub?a=1&t=x');
  assert.match(m.html, /href="https:\/\/gravetidegame\.com\/play"/);
  assert.match(m.html, /auth\/unsub\?a=1&amp;t=x/);
  assert.ok(!m.html.includes('<b>'));
  assert.match(m.text, /https:\/\/gravetidegame\.com\/auth\/unsub/);
  assert.match(m.subject, /^GRAVETIDE — /);
});

test('the unsubscribe: only her token turns her e-mails off', () => {
  const kv = new Map<string, unknown>();
  const db = { getKv: <T,>(k: string) => kv.get(k) as T | undefined, setKv: (k: string, v: unknown) => void kv.set(k, v) };
  db.setKv('advice:5', { ...newAdviceState(), unsub: 'abc123' });
  assert.equal(adviceUnsubscribe(db, 5, 'nope00'), false);
  assert.equal(adviceUnsubscribe(db, 6, 'abc123'), false);
  assert.equal(adviceUnsubscribe(db, 5, 'abc123'), true);
  assert.equal((kv.get('advice:5') as { emailOff?: boolean }).emailOff, true);
});

test('the real armyAdvice: deckhands at ⚓14 are weak; its step becomes the army letter; a null step — no army hint', () => {
  const a = armyAdvice({ level: 14, shipLevel: 6, army: [{ u: 'deckhand', n: 90 }], crewMax: 90, slots: 5, gold: 9000, isle: { hall: 1, dw1: 1, dw2: 1 } });
  assert.ok(a && a.weak && a.step);
  assert.equal(a!.step!.kind, 'hire');
  const h = adviceHints(cap({ army: [{ u: 'deckhand', n: 90 }], crewMax: 90, town: { hall: 1, dw1: 1, dw2: 1 } })).find((x) => x.kind === 'army');
  assert.ok(h);
  assert.match(outsideWords(h!, 'ru', 'Ник').line, /Наймите/);
  // strong: no step, no army hint
  assert.ok(!kinds(cap({ army: [{ u: 'boarder', n: 60 }], town: { hall: 1, dw1: 1, dw2: 1 } })).includes('army'));
});

test('every army step kind has its letter (claim, upgrade, silver, fill, build, hire)', () => {
  const table = new Map(advicePatterns());
  const step = (k: string, x: Record<string, unknown> = {}) => ({ kind: 'army' as const, army: { weak: true, ratio: 0.3, power: 1, norm: 3, best: null, step: { kind: k as 'hire', textRu: 'т', textEn: 't', ...x } } });
  for (const h of [step('claim'), step('fill'), step('silver', { unit: 'marine' }), step('hire', { unit: 'sea_guard' }), step('build', { building: 'dw3', level: 1 }), step('upgrade', { building: 'keep', level: 2 })]) {
    const w = letterWords(h, 'en')!;
    assert.ok(table.has(w.body), w.body);
  }
});

test('a saved captain reads as captainAdvice would: hammocks from the hull, the island from the holding', () => {
  const isle = isleFromHolding({ buildings: [{ id: 'warehouse', level: 2 }], yard: { town: { b: { hall: 1, dw1: 1 } } } });
  assert.equal(isle!.hall, 1);
  assert.equal(isle!.dw2, 0);
  assert.equal(isle!.warehouse, 2);
  const c = captainFromSave({ level: 12, gold: 300, army: [{ u: 'deckhand', n: 40 }], loadout: { classId: 'sloop' }, captain: 'corsair', talents: {} }, isle);
  assert.ok(c && c.crewMax > 0 && c.slots >= 3 && c.shipLevel >= 1);
  assert.equal(captainFromSave({ level: 3, loadout: { classId: 'nope' } }, null), null);
});

test('the client shows the letter in Russian', () => {
  setLang('ru');
  try {
    for (const h of adviceHints(cap({ town: { hall: 1, dw1: 1, dw2: 1 } }))) {
      const w = letterWords(h, 'en')!;
      const want = letterWords(h, 'ru')!;
      const sp = (x: string) => x.replace(/\s/g, ' ');
      assert.equal(sp(serverText(w.subject)), sp(want.subject));
      assert.equal(sp(serverText(w.body)), sp(want.body));
    }
    assert.equal(serverText('The Harbour Master'), 'Начальник порта');
  } finally {
    setLang('en');
  }
});
