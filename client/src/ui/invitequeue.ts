// Invitations to sail together (mid-game QA 2026-10-23): one that comes while a window is open (the daily reward's, the
// harbour's) waits for the window to close and is told then — its toast had run out inside the window, and the
// invitation with it. The Company screen open is where they are answered: none waits for it.

export interface InviteSeen {
  id: number;
  from: string;
  ask?: boolean;
}

export class InviteQueue {
  private seen = new Set<number>();
  private waiting: { id: number; from: string }[] = [];

  /** The invitations as the server sends them, and the window open (null: none) when they came. */
  note(invites: readonly InviteSeen[], modal: string | null): void {
    for (const i of invites) {
      if (i.ask || this.seen.has(i.id)) continue;
      this.seen.add(i.id);
      if (modal && modal !== 'company') this.waiting.push({ id: i.id, from: i.from });
    }
  }

  /** The window closed: the ones that waited and still stand (answered or lapsed meanwhile: dropped). */
  due(invites: readonly InviteSeen[]): { id: number; from: string }[] {
    const live = this.waiting.filter((w) => invites.some((i) => i.id === w.id));
    this.waiting = [];
    return live;
  }
}
