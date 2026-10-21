// The movement kind of every battle figure, for tools/art/frame_fit.py (prints JSON on stdout): a flier's frames are
// anchored at the body's middle, everyone else's at its feet (or the foot of its water).
import { UNITS } from '../../shared/src/data/army.ts';
import { FIGURES } from '../../shared/src/data/unitart.ts';

const out: Record<string, { fly: boolean; body: string | null }> = {};
for (const [id, d] of Object.entries(UNITS)) {
  const body = (FIGURES as Record<string, { body: string } | undefined>)[id]?.body ?? null;
  out[id] = { fly: d.specials.includes('flying') || body === 'fly', body };
}
process.stdout.write(JSON.stringify(out));
