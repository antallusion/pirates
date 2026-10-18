// docs/37 (owner, 2026-10-18: the creatures' abilities and the ranged kinds): the whole table from the data itself —
// node tools/skills-doc.ts > docs/37_CREATURE_ABILITIES.tables.md (the doc pastes its tables from here).

import { UNITS } from '../shared/src/data/army.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import { MAGIC_SHOTS, RANGED_KINDS, SKILLS, SKILL_IDS, UNIT_SKILL, shotOf, skillVars } from '../shared/src/data/creatureskills.ts';
import type { SkillId } from '../shared/src/data/creatureskills.ts';
import { RU as ARMY_RU } from '../client/src/lang/ui/army.ts';
import { RU as SK } from '../client/src/lang/ui/skills.ts';

const fill = (s: string, v: Record<string, number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? `{${k}}`));
const name = (u: UnitId) => (ARMY_RU as Record<string, string>)[`u.${u}`] ?? u;
const who = (u: UnitId) => {
  const d = UNITS[u];
  return d.roster ?? (d.titan ? 'титан' : d.legend ? 'легенда' : d.premium ? 'магазин' : d.beast ? 'существо' : 'люди');
};
const AIM: Record<string, string> = { enemy: 'враг', own: 'свой отряд', self: 'на себя', hex: 'клетка', none: 'без цели', death: 'при гибели' };
/** What each kind looks like on the field (client/src/ui/tacskillfx.ts). */
const VFX: Record<SkillId, string> = {
  mend: 'нить света к цели, зелёный крест, искры поднимаются', mass_mend: 'нити света ко всем своим, зелёные кольца и искры', raise: 'бледный столб света снизу, пузырьки',
  ward: 'голубой пузырь-купол с бликом', bulwark: 'бронзовый шестигранный щит вокруг', cleanse: 'всплеск воды вверх, капли, светлое кольцо', haste: 'полосы ветра вокруг отряда',
  rally: 'золотые кольца-удары барабана от отряда, кольца на всех своих', toast: 'золотые искорки над всеми своими', fear: 'серая пелена к цели, два бледных глаза, сжимающееся кольцо',
  stun: 'молния к цели, звёздный взрыв, звёздочки кружат над головой', freeze: 'ледяной шар, шестигранник льда смыкается, лучи изморози',
  slow: 'горшок смолы по дуге, чёрная лужа и брызги на цели и соседях', entangle: 'урон и зелёная метка (силки) — общий вид удара способности',
  siren: 'две волны-ленты от сирены к цели, розовые ноты кружат', curse: 'фиолетовый шар порчи, вращающаяся пентаграмма-сигил', mark: 'тёмный шар, чёрная метка над целью, пунктирное кольцо',
  ink: 'чёрный ком по дуге, чернильные кляксы на цели и соседях', taunt: 'красные кольца от отряда, пунктирные линии ко всем вызванным',
  rot: 'бурый шар, гнилое облако и кружащие мухи', miasma: 'зелёный шар, ядовитые облака на цели и соседях', chain: 'ломаная молния от отряда, перескоки по целям друг за другом',
  fireball: 'огненный шар по дуге со следом, вспышка, кольцо взрыва, искры на цели и соседях', firepot: 'огненный горшок по высокой дуге, пламя на цели и соседях, клетка горит',
  cone: 'веер обжигающего пара/огня из отряда в сторону цели', pierce: 'гарпун летит по прямой до борта с верёвкой, щепки на каждом пробитом',
  volley: 'трассеры к трём целям по очереди, вспышки попаданий', aimed: 'яркий трассер и красный прицел, сжимающийся на цели',
  drain: 'фиолетовый шар к цели, красно-фиолетовые бусины текут обратно', devour: 'тёмные челюсти смыкаются на цели, бусины силы текут обратно',
  toll: 'бронзовые кольца звона от отряда, вспышки на задетых', grapple: 'крюк летит с верёвкой и тянет цель назад', tidal: 'гребень волны с пеной прокатывается по цели, брызги',
  blink: 'фиолетовые воронки там, откуда ушёл, и там, куда вышел', frenzy: 'красно-оранжевые языки ауры поднимаются по отряду',
  summon: 'тёмно-бирюзовый портал на клетке, кольца и туман поднимаются', death_blast: 'белая вспышка, огненный шар, кольцо ударной волны, искры, дым',
};
const SHOT_RU: Record<string, string> = Object.fromEntries(Object.entries(SK).filter(([k]) => k.startsWith('sh.')).map(([k, v]) => [k.slice(3), v]));

const out: string[] = [];
out.push('### Виды способностей\n');
out.push('| Способность | EN | Цель | Числа (из данных) | Ценность | Эффект на поле | У кого |');
out.push('|---|---|---|---|---|---|---|');
for (const id of SKILL_IDS) {
  const d = SKILLS[id];
  const holders = (Object.keys(UNIT_SKILL) as UnitId[]).filter((u) => UNIT_SKILL[u] === id).map(name);
  const en = (await import('../client/src/lang/ui/skills.ts')).EN as Record<string, string>;
  out.push(`| **${SK[`n.${id}` as keyof typeof SK]}** | ${en[`n.${id}`]} | ${AIM[d.aim]}${d.range ? `, до ${d.range} кл.` : ''}${d.free ? ', ход продолжается' : ''}${d.shot ? ', тратит выстрел' : ''} | ${fill(SK[`d.${id}` as keyof typeof SK], skillVars(id))} | +${Math.round(d.worth * 100)}% | ${VFX[id]} | ${holders.join(', ')} |`);
}
out.push('\n### Существа со способностями и стрелки\n');
out.push('| Существо | id | Кто | Ур. | Способность | Стрелок: снаряд, выстрелов | Цена (серебро) |');
out.push('|---|---|---|---|---|---|---|');
const ids = (Object.keys(UNITS) as UnitId[]).filter((u) => UNIT_SKILL[u] || UNITS[u].specials.includes('shooter'));
ids.sort((a, b) => who(a).localeCompare(who(b)) || UNITS[a].tier - UNITS[b].tier || a.localeCompare(b));
for (const u of ids) {
  const d = UNITS[u], s = UNIT_SKILL[u];
  const shot = d.specials.includes('shooter') ? `${SHOT_RU[shotOf(u)] ?? shotOf(u)}${MAGIC_SHOTS.has(shotOf(u)) ? '' : ''}, ${d.shots}${d.specials.includes('blast') ? ', по площади' : ''}${RANGED_KINDS[u] ? ' **(новый)**' : ''}` : '—';
  out.push(`| ${name(u)} | \`${u}\` | ${who(u)} | ${d.tier}${d.up ? '+' : ''} | ${s ? SK[`n.${s}` as keyof typeof SK] : '—'} | ${shot} | ${d.cost} |`);
}
const all = Object.keys(UNITS).length;
const held = Object.keys(UNIT_SKILL).length;
const ranged = (Object.keys(UNITS) as UnitId[]).filter((u) => UNITS[u].specials.includes('shooter')).length;
const both = (Object.keys(UNIT_SKILL) as UnitId[]).filter((u) => UNITS[u].specials.includes('shooter')).length;
out.push(`\nИтого: ${all} видов; со способностью ${held} (${Math.round((held / all) * 100)}%), видов способностей ${SKILL_IDS.length}; стрелков ${ranged} (${Math.round((ranged / all) * 100)}%), из них ${both} со способностью.`);
console.log(out.join('\n'));
