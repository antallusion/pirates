// The server's lines of a hull striking a coast or a solid thing (owner, 2026-10-08: «врезаясь в объекты корабль должен
// получать урон»: one short line, «Удар о скалы −N»), English → Russian. The words alone (server/src/game/strike.ts
// STRIKE_WORDS) and the line as it is sent, with the hull lost.

export const SERVER_RU_ISLE: Record<string, string> = {
  'Struck the rocks': 'Удар о скалы',
  'Struck the wreckage': 'Удар об обломки',
  'Struck the ice': 'Удар о лёд',
  'Struck a buoy': 'Удар о буй',
  'Struck the moored hulks': 'Удар о пришвартованные остовы',
  'Struck the pier': 'Удар о причал',
  'Ran onto a sandbank': 'Удар о мель',
  "Struck the turtle's shell": 'Удар о панцирь черепахи',
  'Struck the rocks −{0}': 'Удар о скалы −{0}',
  'Struck the wreckage −{0}': 'Удар об обломки −{0}',
  'Struck the ice −{0}': 'Удар о лёд −{0}',
  'Struck a buoy −{0}': 'Удар о буй −{0}',
  'Struck the moored hulks −{0}': 'Удар о пришвартованные остовы −{0}',
  'Struck the pier −{0}': 'Удар о причал −{0}',
  'Ran onto a sandbank −{0}': 'Удар о мель −{0}',
  "Struck the turtle's shell −{0}": 'Удар о панцирь черепахи −{0}',
};
