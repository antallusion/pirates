// «Наставники» (owner, 2026-11-13): three captains of the game's own who sail, fight and talk in the chat (mentors.ts).
// The model is stubbed: what goes to it, what comes back into the chat, the cap and the cost kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { MENTORS, Mentors } from '../server/src/game/mentors.ts';
import type { EgressFetch } from '../server/src/net/egress.ts';
import { FakeConn, makeGame, steps } from './helpers.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stub(reply: (ask: string) => string) {
  const asks: { system: string; ask: string }[] = [];
  const http: EgressFetch = async (_url, init) => {
    const b = JSON.parse(init.body!) as { system: { text: string }[]; messages: { content: string }[]; model: string };
    asks.push({ system: b.system.map((x) => x.text).join('\n'), ask: b.messages[0].content });
    const text = reply(b.messages[0].content);
    const body = { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 300, output_tokens: 40, cache_read_input_tokens: 4000 } };
    return { status: 200, ok: true, text: async () => JSON.stringify(body), json: async () => body };
  };
  return { http, asks };
}

test('mentors: three captains under their plain names come aboard, a ship each, and put to sea on the campaign', () => {
  const { game } = makeGame();
  const { http } = stub(() => 'Привет!');
  const mt = new Mentors(game, 'k', http);
  mt.start(0);
  steps(game, 5);
  assert.equal(mt.list.length, 3);
  for (const m of mt.list) {
    assert.ok(['Сильвер', 'Мэй', 'Гром'].includes(m.s.name));
    assert.ok(m.s.profile && m.s.ship, `${m.def.name} has a captain and a ship`);
  }
  for (let i = 0; i < 12; i++) {
    steps(game, 100); // (five seconds of the sea)
    mt.tick();
  }
  assert.ok(mt.list.some((m) => !m.s.ship!.docked), 'they put to sea');
  assert.equal(mt.playersOnline(), 0, 'the mentors are not counted as players');
  assert.ok(MENTORS.every((m) => m.name.length <= 20));
});

test('mentors: a captain\'s line in the world gets one mentor\'s answer, a whisper a whisper; never pretends to be a person', async () => {
  const { game } = makeGame();
  const { http, asks } = stub((ask) => (ask.includes('личные') ? 'Ага, держи курс на юг.' : 'Анна, логово — гнездо тварей на острове. [ГРУППА]'));
  const mt = new Mentors(game, 'k', http);
  mt.start(0);
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Анна' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'Ласточка', tutorial: false });
  steps(game, 3);
  assert.equal(mt.playersOnline(), 1);
  c.push({ t: 'chat', text: 'а что такое логово?' });
  mt.tick();
  await sleep(50);
  // (the typing pause: 4–10 s)
  await sleep(10_500);
  const said = c.all('chat').filter((l) => MENTORS.some((m) => m.name === l.from));
  assert.equal(said.length, 1, 'one mentor answered');
  assert.match(said[0].text, /логово/);
  assert.ok(!said[0].text.includes('[ГРУППА]'), 'the mark is never shown');
  assert.match(asks[0].system, /Не притворяйся человеком/);
  assert.match(asks[0].ask, /Анна: а что такое логово\?/);
  // a whisper to one of them
  steps(game, 40); // (the chat's gap between her lines, in the game's time)
  c.push({ t: 'chat', text: 'куда плыть?', ch: 'dm', to: MENTORS[1].name });
  for (const m of mt.list) m.saidAt = 0;
  mt.tick();
  await sleep(10_500);
  const dm = c.all('chat').filter((l) => l.ch === 'whisper' && l.from === MENTORS[1].name);
  assert.equal(dm.length, 1);
  const u = mt.usage();
  assert.equal(u.calls, 2);
  assert.ok(u.usd > 0 && u.usd < 0.01, `cost kept: $${u.usd}`);
});

test('mentors: the day\'s cap stops the calls; the primer is the Pilot\'s Book', async () => {
  const { game } = makeGame();
  const { http, asks } = stub(() => 'ok');
  const mt = new Mentors(game, 'k', http, 1);
  mt.start(0);
  const m = mt.list[0];
  assert.equal(await mt.words(m, 'раз'), 'ok');
  assert.equal(await mt.words(m, 'два'), null, 'capped');
  assert.equal(asks.length, 1);
  assert.ok(Mentors.primerText().length > 3000 && Mentors.primerText().includes('Лоцманская книга'));
});

test('mentors with no model: aboard all the same, the chat alive with their own talk, a question answered from the Pilot\'s Book', async () => {
  const { game } = makeGame();
  const { http, asks } = stub(() => 'never');
  const mt = new Mentors(game, '', http);
  mt.start(0);
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Борис' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'Чиж', tutorial: false });
  steps(game, 3);
  // seen among the captains aboard
  c.push({ t: 'who', q: '', here: false });
  steps(game, 1);
  assert.equal(c.all('who').at(-1)!.list.filter((w) => MENTORS.some((m) => m.name === w.name)).length, 3, 'the three in the list of who is aboard');
  // their own talk: a tip, then an exchange
  mt.rnd = () => 0.5;
  mt.nextChat = 0;
  mt.tick();
  await sleep(50);
  steps(game, 40);
  const tips = c.all('chat').filter((l) => MENTORS.some((m) => m.name === l.from));
  assert.equal(tips.length, 1, 'a tip of the Pilot\'s Book');
  // a line between captains is left alone; a question is answered, and honestly who they are
  c.push({ t: 'chat', text: 'ну и погодка сегодня' });
  steps(game, 40);
  c.push({ t: 'chat', text: 'Сильвер, как чинить корабль в порту?' });
  mt.tick();
  await sleep(10_500);
  const ans = c.all('chat').filter((l) => MENTORS.some((m) => m.name === l.from)).slice(1);
  assert.equal(ans.length, 1);
  assert.match(ans[0].text, /^Борис, .*Лоцманск/); // (the book's article when sure, else the way to it)
  steps(game, 40);
  c.push({ t: 'chat', text: 'ты бот?', ch: 'dm', to: MENTORS[0].name });
  for (const m of mt.list) m.saidAt = 0;
  mt.tick();
  await sleep(10_500);
  const dm = c.all('chat').filter((l) => l.ch === 'whisper' && l.from === MENTORS[0].name);
  assert.match(dm[0].text, /на основе ИИ, не человек/);
  assert.equal(asks.length, 0, 'the model never asked');
  assert.equal(mt.usage().calls, 0);
});

test('mentors: an account made as «Наставник …» comes aboard under the plain name, its token kept', () => {
  const { game } = makeGame();
  const { http } = stub(() => 'ok');
  // the old account, as the first release made it
  const old = new FakeConn();
  game.attach(old as unknown as WsConnection);
  old.push({ t: 'hello', v: PROTOCOL_VERSION, name: MENTORS[0].was });
  old.push({ t: 'create_captain', captain: 'corsair', shipName: 'Старая Чайка', tutorial: false });
  steps(game, 3);
  const token = old.last('welcome')!.token;
  old.close();
  steps(game, 3);
  game.db.setKv('mentors:tokens', { [MENTORS[0].was]: token });
  const mt = new Mentors(game, '', http);
  mt.start(0);
  steps(game, 5);
  assert.equal(mt.list[0].s.name, 'Сильвер');
  assert.equal(mt.list[0].s.ship!.name, 'Старая Чайка', 'the same captain, not a new one');
  assert.deepEqual(Object.keys(game.db.getKv<Record<string, string>>('mentors:tokens')!).sort(), ['Гром', 'Мэй', 'Сильвер']);
});

test('mentors play the campaign (owner, 2026-11-15: «они должны качаться… проходить кампанию»): quests done, ships sunk and boarded, levels made', async () => {
  const { game } = makeGame();
  game.directorOn = true;
  game.tacticalBoarding = true;
  const { http } = stub(() => 'ok');
  const mt = new Mentors(game, '', http);
  mt.start(0);
  mt.nextChat = Infinity;
  const m = mt.list[0];
  for (let sec = 0; sec < 40 * 60; sec += 5) {
    steps(game, 100);
    mt.tick();
  }
  const p = m.s.profile!;
  assert.ok(p.campaign!.at >= 4, `campaign quests done: ${p.campaign!.at}`);
  assert.ok(p.level >= 2, `level ${p.level}`);
  assert.ok(p.stats.sunk + p.stats.boarded >= 2, `ships fought: ${p.stats.sunk} sunk, ${p.stats.boarded} boarded`);
  assert.ok(m.credited <= p.campaign!.at, `most steps her own: ${m.credited} credited of ${p.campaign!.at} quests`);
});

test('mentors never flood the chat (owner, 2026-11-16: «спамят и прям бесят игроков»): a line of their own at most once an hour and never two running; an answer always', async () => {
  const { game } = makeGame();
  const { http } = stub(() => 'never');
  const mt = new Mentors(game, '', http);
  mt.start(0);
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name: 'Борис' });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'Чиж', tutorial: false });
  steps(game, 3);
  mt.rnd = () => 0.9; // (a tip each time)
  const own = () => c.all('chat').filter((l) => MENTORS.some((m) => m.name === l.from)).length;
  mt.nextChat = 0;
  mt.tick();
  await sleep(50);
  steps(game, 5);
  assert.equal(own(), 1);
  // again at once, and again after the hour: the last line is theirs — silence
  mt.nextChat = 0;
  mt.tick();
  (mt as unknown as { ownAt: number }).ownAt = 0;
  mt.nextChat = 0;
  mt.tick();
  await sleep(50);
  steps(game, 5);
  assert.equal(own(), 1, 'never two of their own running');
  // a captain speaks (not to them): after the hour they may say one more
  (mt as unknown as { ownAt: number }).ownAt = Date.now(); // (their last line of their own: just now)
  c.push({ t: 'chat', text: 'ну и погодка сегодня' });
  steps(game, 40);
  mt.nextChat = 0;
  mt.tick();
  await sleep(50);
  steps(game, 5);
  assert.equal(own(), 1, 'not within the hour');
  (mt as unknown as { ownAt: number }).ownAt = 0;
  steps(game, 40); // (the chat's own gap between one captain's lines)
  mt.nextChat = 0;
  mt.tick();
  await sleep(50);
  steps(game, 5);
  assert.equal(own(), 2);
  // a question is answered though their line was the last
  steps(game, 40);
  c.push({ t: 'chat', text: 'Сильвер, как чинить корабль в порту?' });
  steps(game, 2);
  (mt as unknown as { lastWasMentor: boolean }).lastWasMentor = true;
  mt.tick();
  await sleep(10_500);
  steps(game, 5);
  assert.equal(own(), 3, 'the answer goes');
});

test('mentors grow in might with their level (owner, 2026-11-19: «каждые 10 уровней новый корабль, новая команда… экипированы их командиры»)', () => {
  const { game } = makeGame();
  const { http } = stub(() => 'ok');
  const mt = new Mentors(game, '', http);
  mt.start(0);
  mt.nextChat = Infinity;
  steps(game, 5);
  mt.tick();
  const [silver, may, grom] = mt.list;
  for (const m of mt.list) assert.equal(m.s.ship!.shipLevel, 1, `${m.def.name} starts at ⚓1`);
  // a few levels more change nothing; ten levels a new ship, her crew full, her captain in the kit of her ⚓
  silver.s.profile!.level = 9;
  mt.tick();
  assert.equal(silver.s.ship!.shipLevel, 1);
  silver.s.profile!.level = 31;
  may.s.profile!.level = 31;
  grom.s.profile!.level = 24;
  for (const m of mt.list) m.s.profile!.gold = 0;
  mt.tick();
  assert.equal(silver.s.ship!.loadout.classId, 'brig');
  assert.equal(silver.s.ship!.shipLevel, 6);
  assert.equal(may.s.ship!.loadout.classId, 'corvette');
  assert.equal(grom.s.ship!.loadout.classId, 'bomb_ketch');
  assert.equal(grom.s.ship!.shipLevel, 5);
  for (const m of mt.list) {
    const ship = m.s.ship!, p = m.s.profile!;
    assert.equal(ship.crew, ship.stats.crewMax, `${m.def.name}: a full crew`);
    assert.ok(Object.keys(p.captainGear).length >= 3, `${m.def.name}: the captain is kitted (${Object.keys(p.captainGear).join(',')})`);
    assert.ok(Object.keys(ship.loadout.gear ?? {}).length >= 3, `${m.def.name}: the ship is kitted`);
    assert.ok(p.gold >= 20_000, `${m.def.name}: a purse for the yard`);
    assert.ok((ship.cargo.provisions ?? 0) >= Math.ceil(ship.crew / 10) * 4, `${m.def.name}: stores for the crew`);
  }
  // once per step: the kit is not handed again within the same ten levels
  const hull = silver.s.ship!.loadout;
  silver.s.profile!.level = 39;
  mt.tick();
  assert.equal(silver.s.ship!.loadout, hull);
  silver.s.profile!.level = 40;
  mt.tick();
  assert.equal(silver.s.ship!.loadout.classId, 'frigate');
});
