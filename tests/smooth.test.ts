// docs/23 item 86: the other ships move smoothly on a phone — at 60 and at 30 frames a second, a tenth of the frames
// late, the packets of a phone's network late by 30–90 ms and now and then by 200 ms. A ship sailing a gentle arc is
// sent ten times a second (the server's rate for a near ship); every frame her drawn place's step is set against the
// step her way makes in that frame's time. No jump (a step off by a third of itself and a pixel), no step back.
// tools/mobile/smooth.mjs measures the same in the game itself (docs/23a).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPEED_SCALE } from '../shared/src/constants.ts';
import { Rng } from '../shared/src/rng.ts';

/** px per metre on a phone's sea (renderer.zoom there). */
const ZOOM = 1.44;

for (const hz of [60, 30]) {
  test(`another ship's drawn place has no jump and no step back at ${hz} frames a second on a phone's network`, async () => {
    const { ClientState } = await import('../client/src/state.ts');
    const st = new ClientState();
    const rng = new Rng(hz * 7 + 1);
    let now = 100;
    const realNow = performance.now.bind(performance);
    performance.now = () => now * 1000;
    try {
      // The server's sea: she sails 6 «knots» of hers on a slow arc, sampled every 0.1 s of its clock.
      const spd = 6, way = spd * SPEED_SCALE, turn = 0.05; // rad/s
      const at = (t: number) => {
        // heading clockwise from north, turning at `turn`: dx/dt = way·sin h, dy/dt = −way·cos h
        const h = Math.PI / 2 + turn * t;
        return { x: 1000 + (way / turn) * Math.sin(turn * t), y: 500 - (way / turn) * (Math.cos(turn * t) - 1), h };
      };
      const t0 = 50;
      // Packets: sent at server time t0 + k/10, arriving (in order) late by 30–90 ms, 3 % by 200 ms more.
      const packets: { arrive: number; t: number }[] = [];
      let chain = 0;
      for (let k = 0; k < 10 * 25; k++) {
        const t = t0 + k / 10;
        const arrive = Math.max(chain, now + (t - t0) + 0.03 + rng.float() * 0.06 + (rng.float() < 0.03 ? 0.2 : 0));
        chain = arrive;
        packets.push({ arrive, t });
      }
      const msg = (t: number) => {
        const p = at(t - t0);
        return { t: 'snap', tick: 0, time: t, ack: 0, you: null, ships: [[7, p.x, p.y, p.h, spd, 1, 1, 1, 0, 1]], loot: [], wind: [0, 1], weather: 'clear', region: 'saltmarrow_reach', fog: 0 } as never;
      };
      const frames: { t: number; x: number; y: number }[] = [];
      let next = 0;
      const start = now;
      while (now - start < 20) {
        // a frame at the rate, a tenth of them one or two frames late
        now += (rng.float() < 0.1 ? 2 + Math.floor(rng.float() * 2) : 1) / hz;
        while (next < packets.length && packets[next].arrive <= now) st.apply(msg(packets[next++].t));
        st.updateRemote();
        const s = st.ships.get(7);
        if (s && now - start > 2) frames.push({ t: now, x: s.cur.x, y: s.cur.y });
      }
      let jumps = 0, back = 0, worst = 0;
      for (let i = 1; i < frames.length; i++) {
        const dt = frames[i].t - frames[i - 1].t;
        const dx = frames[i].x - frames[i - 1].x, dy = frames[i].y - frames[i - 1].y;
        const step = Math.hypot(dx, dy), want = way * dt;
        const err = Math.abs(step - want);
        worst = Math.max(worst, err * ZOOM);
        if (err * ZOOM > 1 && err > want / 3) jumps++;
        // along her course (she turns slowly: the course of the frame's chord is hers within a few degrees)
        const p = at(frames[i].t - start);
        if (dx * Math.sin(p.h) - dy * Math.cos(p.h) < -0.01) back++;
      }
      assert.ok(frames.length > hz * 15, `${frames.length} frames`);
      assert.equal(jumps, 0, `jumps (worst ${worst.toFixed(2)} px)`);
      assert.equal(back, 0, 'steps back');
      assert.ok(worst < 1, `a frame's error ${worst.toFixed(2)} px`);
    } finally {
      performance.now = realNow;
    }
  });
}
