// A quest step's action in port (owner, 2026-10-23: «все квесты кампании из серии "распросить" и любые другие должны
// прям показывать куда нажать в порту… я все кнопки нажал и нету сдачи нигде»). A step that is done in a harbour —
// «расспросите на причалах», «поговорите», «вернитесь к…», «привезите», «примите груз», a race's finish, a customs
// search — has a button of its own once she lies in the right port (`how: 'here'`: the server's `quest here`), and a
// step done at a port's shop or table opens that page (`how: 'tab'`). Everything else is done at sea or ashore, and
// «Плыть» takes her there. Pure: the server sends it with the quest, the client draws the button, tests walk it.

import type { QuestStep } from './quests.ts';

export type QuestVerb = 'ask' | 'talk' | 'report' | 'deliver' | 'pickup' | 'hand' | 'arrive' | 'customs' | 'buy' | 'sell' | 'recruit' | 'build';

export interface QuestAct {
  verb: QuestVerb;
  /** `here`: done by its own button in port (the server checks the port); `tab`: done on a page of the port window;
   *  `isle`: done on her own island — its screen opened by the button while she lies off it, or in a harbour by it
   *  (mid-game QA 2026-10-23: «Заложите постройки» read «Плыть» with her ship at her island). */
  how: 'here' | 'tab' | 'isle';
  /** The port it must be done in (none: any harbour). */
  port?: string;
  /** `tab`: the port window's page (port.ts Tab ids). */
  tab?: 'market' | 'shipyard' | 'tavern' | 'army';
}

/** The step kinds a harbour does (the audit's list; tests walk every campaign step against it). */
export const PORT_STEPS = ['visit', 'deliver', 'pickup', 'landres', 'race', 'customs', 'buy', 'sell_contraband', 'recruit'] as const;

/** A visit's verb by its words: asking about, reporting back, or a word with someone. */
export function visitVerb(text: string): QuestVerb {
  const t = text.toLowerCase();
  if (/\bask\b|\basking\b|\binquire|\bquestion\b|hear what|\blisten\b|\bfind out\b/.test(t)) return 'ask';
  if (/\breturn\b|\breport\b|\bback to\b|bring the news|bring (?:your|the) log|show (?:your|the) log|\bwaiting\b|\bwaits\b|tell \w+/.test(t)) return 'report';
  return 'talk';
}

/** The action of a step in port, or null (done at sea, ashore or on her island). */
export function questAct(st: QuestStep | undefined): QuestAct | null {
  if (!st) return null;
  switch (st.type) {
    case 'visit':
      return { verb: visitVerb(st.text), how: 'here', port: st.port };
    case 'deliver':
      return { verb: 'deliver', how: 'here', port: st.port };
    case 'landres':
      return { verb: 'hand', how: 'here', port: st.port };
    case 'pickup':
      return { verb: 'pickup', how: 'here', port: st.port };
    case 'race':
      return { verb: 'arrive', how: 'here', port: st.port };
    case 'customs':
      return { verb: 'customs', how: 'here' };
    case 'buy':
      return { verb: 'buy', how: 'tab', ...(st.port ? { port: st.port } : {}), tab: st.shop === 'arms' ? 'tavern' : 'market' };
    case 'sell_contraband':
      return { verb: 'sell', how: 'tab', ...(st.port ? { port: st.port } : {}), tab: 'market' };
    case 'recruit':
      return { verb: 'recruit', how: 'tab', tab: 'army' };
    case 'build':
      return { verb: 'build', how: 'isle' };
    default:
      return null;
  }
}

/** Whether the act can be done where she lies now (`docked`: her port's id, or null at sea). */
export function actHere(act: QuestAct | null | undefined, docked: string | null | undefined): boolean {
  return !!act && act.how !== 'isle' && !!docked && (!act.port || act.port === docked);
}
