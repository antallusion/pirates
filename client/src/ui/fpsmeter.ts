// The frames a second in the corner (owner, 2026-11-11: graphics settings for the PC client): «Показывать FPS» in the
// options. A frame's time is counted each frame; the number is redrawn twice a second.

export class FpsMeter {
  private el: HTMLElement | null = null;
  private on = false;
  private frames = 0;
  private since = 0;

  show(on: boolean): void {
    this.on = on;
    if (on && !this.el) {
      this.el = document.createElement('div');
      this.el.id = 'fps-meter';
      this.el.setAttribute('aria-hidden', 'true');
      document.body.append(this.el);
    }
    this.el?.classList.toggle('hidden', !on);
    this.frames = 0;
    this.since = 0;
  }

  tick(t: number): void {
    if (!this.on || !this.el) return;
    if (!this.since) this.since = t;
    this.frames++;
    const dt = t - this.since;
    if (dt < 500) return;
    this.el.textContent = `${Math.round((this.frames * 1000) / dt)} FPS`;
    this.frames = 0;
    this.since = t;
  }
}
