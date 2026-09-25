// Uniform spatial hash for dynamic entities. Used for interest management, projectile hit tests,
// NPC perception and collisions. Rebuilt incrementally: entities move between cells only when they cross.

export class SpatialGrid {
  private cells = new Map<number, Set<number>>();
  private where = new Map<number, number>();
  readonly cell: number;
  private readonly side: number;

  constructor(cellSize: number, worldSize: number) {
    this.cell = cellSize;
    this.side = Math.ceil(worldSize / cellSize) + 2;
  }

  private key(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.side - 1, Math.floor(x / this.cell) + 1));
    const cy = Math.max(0, Math.min(this.side - 1, Math.floor(y / this.cell) + 1));
    return cy * this.side + cx;
  }

  upsert(id: number, x: number, y: number): void {
    const k = this.key(x, y);
    const prev = this.where.get(id);
    if (prev === k) return;
    if (prev !== undefined) this.cells.get(prev)?.delete(id);
    let set = this.cells.get(k);
    if (!set) this.cells.set(k, (set = new Set()));
    set.add(id);
    this.where.set(id, k);
  }

  remove(id: number): void {
    const prev = this.where.get(id);
    if (prev === undefined) return;
    this.cells.get(prev)?.delete(id);
    this.where.delete(id);
  }

  /** Calls fn for every id in cells overlapping the circle's bounding box (caller does exact test). */
  query(x: number, y: number, r: number, fn: (id: number) => void): void {
    const x0 = Math.floor((x - r) / this.cell) + 1, x1 = Math.floor((x + r) / this.cell) + 1;
    const y0 = Math.floor((y - r) / this.cell) + 1, y1 = Math.floor((y + r) / this.cell) + 1;
    for (let cy = Math.max(0, y0); cy <= Math.min(this.side - 1, y1); cy++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(this.side - 1, x1); cx++) {
        const set = this.cells.get(cy * this.side + cx);
        if (set) for (const id of set) fn(id);
      }
    }
  }
}
