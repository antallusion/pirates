import { extract } from './tools/i18n-server.ts';
import { serverTable } from './client/src/lang/server.ts';
const t = serverTable();
const all = extract();
const mine = all.filter((p) => /stack|roaming|Roaming|Gulls on|Seals at|Sharks of the Open|Sea Turtles|Sea Snakes|Tentacles from|Mermaids|Drowned Adrift|Young Serpents|Lantern Maws|A Leviathan|Ancient Turtles|falls on|follow your ship|see your strength and scatter|throw your party back into the sea|fighting them|at them already|within a cable of them|hauled back from the water|Your share of/.test(p));
for (const p of mine) console.log(t[p] === undefined ? 'MISSING' : 'ok     ', JSON.stringify(p));
