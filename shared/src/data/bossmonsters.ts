// The monsters of the six new world bosses at sea (owner, 2026-10-03: «еще больше всяких там боссов»; docs/02
// §11.A.4, the second table). Each is a ship class as the old ones are — never sold, never sailed by a captain, moved
// by server/src/game/bosses10.ts rather than by sail physics — kept here apart from the yards' hulls so the fleet's own
// table (ships.ts) takes them in with one line. A class's id is its boss's where the boss is one beast (the Rime
// Twins are two of one class, the Drowned Prelate's bell spires a class of their own), so the painting
// `monster.<id>` serves both the class and the boss.
//
// Until its own painting is in the manifest a new monster is drawn as a monster of a like shape, tinted
// (BOSS_STAND_IN, client/src/render/monsters.ts): the conger as the black serpent gone brown, the shark as the shark
// grown to a frigate's length, and so on. When `monster.<id>` is registered the client draws it instead, with no
// change to any code.

import type { ShipClassDef, ShipClassId } from './ships.ts';

export type BossClassId = 'old_moorings' | 'old_tithe' | 'fog_changeling' | 'cinder_ray' | 'drowned_prelate' | 'bell_spire' | 'rime_narwhal';

function beast(id: BossClassId, name: string, role: string, length: number, beam: number, hull: number, armor: number, maxSpeed: number, passive: string): ShipClassDef {
  return {
    id, name, tier: 6, rig: 'mixed', role, length, beam, hull, armor, maxSpeed, accel: 3, turnRate: 20, draft: 0,
    holdVolume: 0, holdWeight: 0, crewMin: 0, crewMax: 400, gunPortsPerSide: 0, bowChasers: 0, sternChasers: 0,
    sailHp: 1, repairRate: 0, detection: 2500, price: 0, purchasable: false, monster: true, sprite: `monster.${id}`,
    passive: { id: 'monster', name: 'Monster', description: passive },
  };
}

export const BOSS_MONSTERS: Record<BossClassId, ShipClassDef> = {
  old_moorings: beast('old_moorings', 'Old Moorings', 'A conger as thick as a mainmast, out of the silt under the breakwaters.', 72, 7, 16000, 0.15, 14, 'Buried, nothing touches it; it rears where a ship lies still.'),
  old_tithe: beast('old_tithe', 'The Tithe-Taker', 'A barnacled grey shark as long as a frigate that has followed the convoys for a century.', 46, 12, 24000, 0.15, 15, 'It hunts the fullest hold and takes its tithe of it.'),
  fog_changeling: beast('fog_changeling', 'The Fog Changeling', 'A cuttlefish the size of a brig that throws its own shape onto the fog.', 40, 22, 22000, 0.1, 10, 'Only one of its shapes casts a wake.'),
  cinder_ray: beast('cinder_ray', 'The Cinder Ray', 'A manta as broad as a frigate is long, black glassy hide seamed with ember-light.', 44, 70, 32000, 0.25, 13, 'Guns fired in its ash set their own powder alight.'),
  drowned_prelate: beast('drowned_prelate', 'The Drowned Prelate', 'A vast mitred thing of weed and pale coral that once wore the Crown’s high pulpit.', 64, 40, 50000, 0.3, 2, 'While its three bells toll, shot barely marks it.'),
  bell_spire: beast('bell_spire', 'Bell Spire', 'The drowned spire of a sunken church, its bell still tolling over the water.', 18, 18, 1000, 0.9, 0, 'Shot does not silence it: a ship must hold beside it.'),
  rime_narwhal: beast('rime_narwhal', 'Rime Narwhal', 'A white narwhal as long as a frigate, its tusk a spiral of old ice.', 50, 10, 24000, 0.2, 17, 'Its twin sings it back from the sea unless both fall together.'),
};

/** Until `monster.<id>` is painted: the monster that stands in for it and the canvas filter laid over the stand-in. */
export const BOSS_STAND_IN: Record<BossClassId, { cls: ShipClassId; tint: string }> = {
  old_moorings: { cls: 'black_serpent', tint: 'sepia(0.7) saturate(0.8) brightness(1.15)' },
  old_tithe: { cls: 'shark', tint: 'grayscale(0.6) brightness(1.15) contrast(1.1)' },
  fog_changeling: { cls: 'kraken', tint: 'hue-rotate(150deg) saturate(0.45) brightness(1.3)' },
  cinder_ray: { cls: 'lantern_maw', tint: 'sepia(1) saturate(2.6) hue-rotate(-25deg) brightness(0.8)' },
  drowned_prelate: { cls: 'storm_widow', tint: 'hue-rotate(80deg) saturate(0.7) brightness(1.2)' },
  bell_spire: { cls: 'wreck_core', tint: 'hue-rotate(-140deg) saturate(0.5) brightness(1.1)' },
  rime_narwhal: { cls: 'narwhal', tint: 'grayscale(1) brightness(1.65) contrast(0.9)' },
};

export const isBossClass = (id: string): id is BossClassId => id in BOSS_MONSTERS;
