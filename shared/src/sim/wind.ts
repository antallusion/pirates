// Global wind field. A slowly veering prevailing wind with regional perturbations.
// The server evaluates it authoritatively; clients receive the local sample in snapshots.

import { fbm } from '../rng.ts';

export interface WindSample {
  dir: number; // heading the wind blows TOWARD (0 = north, clockwise)
  strength: number; // 0..1.3 (storms exceed 1)
}

export function windAt(seed: number, t: number, x: number, y: number, weatherStrength = 1): WindSample {
  // Prevailing westerlies that veer over ~40 minutes, with short gusty variation.
  const base = Math.PI * 0.55 + 0.9 * Math.sin(t / 1400 + seed * 1e-9) + 0.45 * Math.sin(t / 530 + 1.3);
  const n = fbm(x / 22000 + t / 6000, y / 22000 - t / 7000, seed + 77, 3);
  const dir = base + (n - 0.5) * 1.1;
  const gust = 0.08 * Math.sin(t / 7.3 + x / 900) * Math.sin(t / 11.1 + y / 1100);
  const s = (0.5 + 0.25 * Math.sin(t / 800 + 0.4) + (fbm(x / 15000, y / 15000 + t / 5000, seed + 91, 3) - 0.5) * 0.5 + gust) * weatherStrength;
  return { dir, strength: Math.max(0.05, Math.min(1.3, s)) };
}
