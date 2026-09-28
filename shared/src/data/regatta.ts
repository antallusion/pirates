// Regattas of Equal Waters (docs/12 P10 #5): every three hours a course of buoys off one of four ports. Whoever sails
// it sails the same: the race lends every ship the same handling (a fair cutter's), so only the sail and the wind
// decide — a newcomer may beat a veteran. The course keeps its records; the podium wins silver, pennants, a title.

import type { SailParams } from '../sim/sailing.ts';

type Tr = [string, string];

export const REGATTA_EVERY_MS = 3 * 3600_000;
/** Sign-up opens with the slot; the start comes this long after. */
export const REGATTA_SIGNUP_MS = 20 * 60_000;
export const REGATTA_START_R = 2000;
export const BUOY_R = 140;
export const REGATTA_LIMIT_S = 20 * 60;
export const REGATTA_BUOYS = 6;
/** The ports the courses are laid off, one each slot in turn. */
export const REGATTA_PORTS = ['saltmarrow', 'blackwater', 'hollowmere', 'cinderhold'];

/** The handling every racer is lent. */
export const REGATTA_SAIL: Omit<SailParams, 'currentMul'> = {
  rig: 'fore_aft', maxSpeed: 13, accel: 2.6, turnRate: 0.45, noGoDeg: 42, sailChangeRate: 0.5,
  sailHealth: 1, rudderHealth: 1, crewFactor: 1, loadFactor: 1, speedMul: 1, personalWind: false, weatherly: false, sweeps: false,
};

/** A racing ship's sailing: the lent handling (the sea's currents still hers to read). */
export function regattaSail(base: SailParams): SailParams {
  return { ...REGATTA_SAIL, currentMul: base.currentMul };
}

export const PRIZES: { silver: number; pennant?: string; title?: string }[] = [
  { silver: 3000, pennant: '#2f86b0', title: 'Wind-Catcher' },
  { silver: 1500, pennant: '#8fb7c9' },
  { silver: 750 },
];

export function regattaPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 1; i <= REGATTA_BUOYS; i++) out.push([`Buoy ${i} of ${REGATTA_BUOYS}.`, `Буй ${i} из ${REGATTA_BUOYS}.`]);
  out.push(
    ['Wind-Catcher', 'Ветролов'],
    ['Regatta of Equal Waters', 'Регата «Равные воды»'],
    ['You are signed up for the regatta off {0}. Be within two kilometres of the start buoy when it begins.', 'Вы записаны на регату у {0}. К началу будьте в двух километрах от стартового буя.'],
    ['The regatta off {0} starts in a minute: to the start buoy!', 'Регата у {0} начнётся через минуту — к стартовому бую!'],
    ['The regatta starts! Every ship sails the same now: sail and wind decide.', 'Регата началась! Теперь все корабли равны — решают парус и ветер.'],
    ['You are not at the start: the regatta goes without you.', 'Вас нет на старте — регата уходит без вас.'],
    ['You finish {0}: {1}.', 'Вы финишируете {0}-м: {1}.'],
    ['A course record: {0}!', 'Рекорд трассы: {0}!'],
    ['The regatta off {0} is over. First: {1}.', 'Регата у {0} окончена. Первое место: {1}.'],
    ['The regatta’s time is up: you did not finish.', 'Время регаты вышло — вы не финишировали.'],
    ['You left the race.', 'Вы сошли с дистанции.'],
    ['No firing in a regatta.', 'На регате стрелять нельзя.'],
    ['Sign-up is at the harbour of {0}.', 'Запись — в гавани порта {0}.'],
    ['The sign-up is closed: the regatta is under way.', 'Запись закрыта — регата уже идёт.'],
    ['You are signed up already.', 'Вы уже записаны.'],
    ['Prize: {0} silver.', 'Приз: {0} серебра.'],
    ['A new pennant colour: the regatta’s.', 'Новый цвет вымпела — регатный.'],
  );
  return out;
}

export const REGATTA_NAME: Tr = ['Regatta of Equal Waters', 'Регата «Равные воды»'];
