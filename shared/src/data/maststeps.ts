// Written by tools/art/ships_nomast.py and tools/art/masts.py (2026-11-16): where each mastless hull's mast steps are
// (fractions of its picture's height from the top, on its centreline), and each mast picture's pivot (its round top).
export const MAST_STEPS: Record<string, number[]> = {"brig":[0.3815,0.5404],"brigantine":[0.3737,0.8333],"cursed_frigate":[0.2852,0.5286,0.7318]};
export const MAST_PIVOT: Record<string, number> = {"square_full":0.2397,"square_reef":0.3503,"square_furl":0.4419,"square_bare":0.4348};
