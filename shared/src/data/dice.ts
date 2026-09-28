// Dead Man's Dice (docs/12 P10 #4): liar's dice at a tavern table. Every player shakes three dice under a cup. In turn
// each bids how many dice at the table show a face ("four fives") — ones are wild — raising the one before, or calls
// the bid a lie. Then the cups come up: if the bid was short, the bidder loses a die; if it stood, the caller does.
// Out of dice, out of the game; the last with dice takes the pot. A round is a couple of minutes.

type Tr = [string, string];

export const DICE_START = 3;
export const DICE_STAKES = [50, 200, 1000];
export const DICE_MAX_SEATS = 4;
export const DICE_TURN_S = 20;
export const DICE_OPEN_S = 15;
export const DICE_HOUSE_CUT = 0.05;
export const DAVY_STAKE = 2000;

export interface Bid {
  q: number;
  f: number;
}

/** A raise must say more dice, or as many of a higher face; ones are wild and are not bid. */
export function validRaise(prev: Bid | null, next: Bid, totalDice: number): boolean {
  if (next.f < 2 || next.f > 6 || next.q < 1 || next.q > totalDice) return false;
  if (!prev) return true;
  return next.q > prev.q || (next.q === prev.q && next.f > prev.f);
}

/** How many dice at the table stand for a face (the face itself and the wild ones). */
export function countFace(all: number[][], f: number): number {
  let n = 0;
  for (const cup of all) for (const d of cup) if (d === f || d === 1) n++;
  return n;
}

/** A regular's move: call the lie when the bid is well past what its own cup and the odds say; else raise on its
 *  best face, now and then a bluff. `nerve` is the table's temper: 0 cautious, 1 bold. */
export function npcMove(own: number[], totalDice: number, bid: Bid | null, nerve: number, roll: () => number): { liar: true } | { bid: Bid } {
  const others = totalDice - own.length;
  const expect = (f: number) => own.filter((d) => d === f || d === 1).length + others / 3;
  if (bid) {
    const margin = bid.q - expect(bid.f);
    if (margin > 1.4 - nerve * 0.8 + roll() * 0.6) return { liar: true };
  }
  // Its best face (the one most of its cup stands for), or a bluff on another.
  let best = 2, bestN = -1;
  for (let f = 2; f <= 6; f++) {
    const n = own.filter((d) => d === f || d === 1).length + roll() * 0.3;
    if (n > bestN) {
      bestN = n;
      best = f;
    }
  }
  if (roll() < 0.15 * nerve) best = 2 + Math.floor(roll() * 5);
  let q = bid ? bid.q : Math.max(1, Math.round(expect(best) - 0.5));
  if (bid && !(best > bid.f)) q = bid.q + 1;
  const next = { q: Math.min(totalDice, Math.max(1, q)), f: best };
  if (!validRaise(bid, next, totalDice)) {
    // Cornered: a lie called, as good as anything.
    if (bid) return { liar: true };
    return { bid: { q: 1, f: 2 } };
  }
  return { bid: next };
}

/** The regulars who sit at a tavern table. */
export const DICE_REGULARS: Tr[] = [
  ['One-Eyed Mags', 'Одноглазая Мэгс'], ['Old Tobias', 'Старый Тобиас'], ['Salt Hettie', 'Солёная Хетти'], ['Crabber Jonah', 'Краболов Иона'],
  ['Deacon Wick', 'Дьякон Уик'], ['Fat Bartholomew', 'Толстый Варфоломей'], ['Widow Crane', 'Вдова Крейн'], ['Lucky Fenn', 'Везунчик Фенн'],
];
export const DAVY: Tr = ['Davy Jones', 'Дэйви Джонс'];

export function dicePatterns(): [string, string][] {
  const out: [string, string][] = [...DICE_REGULARS, DAVY];
  const faces: Tr[] = [['twos', 'двоек'], ['threes', 'троек'], ['fours', 'четвёрок'], ['fives', 'пятёрок'], ['sixes', 'шестёрок']];
  faces.forEach(([en, ru], i) => out.push([`{0} bids {1} ${en}.`, `{0}: ${ru} — {1}.`]));
  out.push(
    ['{0} calls it a lie!', '{0}: «Враньё!»'],
    ['The cups come up: {0} of them. {1} loses a die.', 'Кружки подняты: таких {0}. {1} теряет кость.'],
    ['{0} is out of dice.', '{0} выбывает — костей не осталось.'],
    ['{0} takes the pot: {1} silver.', '{0} забирает банк: {1} серебра.'],
    ['{0} sits down at the table.', '{0} садится за стол.'],
    ['{0} gets up from the table.', '{0} встаёт из-за стола.'],
    ['The table breaks up: the stakes are returned.', 'Стол расходится: ставки возвращены.'],
    ['{0} dawdles: the table bids for them.', '{0} медлит — ход делает стол.'],
    ['Dead Man’s Dice: you won {0} silver.', 'Кости мертвеца: вы выиграли {0} серебра.'],
    ['Dead Man’s Dice: you lost your stake.', 'Кости мертвеца: ставка проиграна.'],
    ['Davy Jones pushes a cursed thing across the table: it is yours.', 'Дэйви Джонс двигает через стол проклятую вещь: она ваша.'],
    ['Davy Jones laughs, and the sea takes its due from your ship.', 'Дэйви Джонс смеётся — и море берёт своё с вашего корабля.'],
    ['Davy Jones plays only at midnight, and only in the Abyss.', 'Дэйви Джонс играет только в полночь и только в Бездне.'],
    ['Dice are played in a tavern.', 'В кости играют в таверне.'],
    ['You are at a table already.', 'Вы уже сидите за столом.'],
    ['That table is full or already playing.', 'Этот стол полон или игра уже идёт.'],
    ['Not your turn.', 'Сейчас не ваш ход.'],
    ['That bid does not raise the last one.', 'Эта ставка не выше прежней.'],
    ['There is no bid to call.', 'Нечего называть враньём.'],
    ['Master of Dice', 'Мастер костей'],
    ['The week’s dice tournament is won by {0}: {1} wins.', 'Турнир недели по костям: победитель — {0}, побед {1}.'],
  );
  return out;
}
