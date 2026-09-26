// A zone process (docs/04 §4.4). The world is split by regions (shared/src/world/zones.ts); this process
// simulates only the ships in its regions and talks to the other zones over a mesh of internal links:
//  - ghosts: ships within the border band are mirrored, read-only, into the zone across the line, so captains
//    see and fight across it;
//  - hits on a ghost are forwarded to the zone that owns the ship; a kill is credited in the killer's zone;
//  - events near a border (volleys, hits, sinkings) are forwarded to the neighbour's captains;
//  - handoff: a ship that crosses is frozen, its captain's profile and ship state go to the neighbour with
//    any escorts, and the Gateway moves the player's session there (the client just receives a fresh init);
//  - shared records (guilds, islands, market boards, bounties) live in the database: a zone that writes one
//    tells the others, which drop their cached copy.
// Zones need a shared SQLite database file (DB_PATH) and players connected through the Gateway.

import { createServer, connect } from 'node:net';
import type { AddressInfo, Server, Socket } from 'node:net';
import { SHIP_CLASSES, defaultGunFor } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { GameEvent } from '../../../shared/src/protocol.ts';
import { SF } from '../../../shared/src/protocol.ts';
import { zoneAt, zonesNear } from '../../../shared/src/world/zones.ts';
import type { ZoneLayout } from '../../../shared/src/world/zones.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { DamagePacket } from '../game/combat.ts';
import type { Game } from '../game/Game.ts';
import type { PlayerSession, Profile } from '../game/player.ts';
import { ShipEntity } from '../game/ship.ts';
import { FrameReader, frame, secretsMatch } from '../net/link.ts';
import { RemoteConnection } from '../net/link.ts';

const Z_HELLO = 20;
const Z_MSG = 22;
const ID_SPACE = 100_000_000;

export interface ZonePeer {
  id: string;
  host: string;
  port: number;
}

export interface GhostRow {
  id: number;
  name: string;
  captainName: string;
  captain: CaptainId;
  faction: FactionId | 'player';
  classId: ShipClassId;
  accountId: number | null;
  npcRole: string | null;
  level: number;
  wanted: number;
  guild: string | null;
  ownerId: number | null;
  x: number;
  y: number;
  h: number;
  spd: number;
  sail: number;
  hull: number; // fraction
  sails: number;
  crew: number;
  flags: number;
}

interface OwnedShip {
  id: number;
  role: string;
  classId: ShipClassId;
  faction: FactionId;
  name: string;
  captainName: string;
  x: number;
  y: number;
  heading: number;
  hull: number;
  crew: number;
  cargo: Record<string, number>;
  fleetId: string | null;
  prize: boolean;
  until: number; // escort time left (s)
}

export interface Handoff {
  account: number;
  profile: Profile;
  ship: { id: number; x: number; y: number; heading: number; speed: number; sail: number; sailTarget: number; rudder: number };
  owned: OwnedShip[];
  until: number;
}

type Msg =
  | { k: 'ghosts'; rows: GhostRow[]; gone: number[] }
  | { k: 'handoff'; h: Handoff }
  | { k: 'hit'; target: number; d: DamagePacket; source: number | null }
  | { k: 'kill'; killer: number; victim: GhostRow; how: 'sunk' | 'boarded' }
  | { k: 'events'; list: { ev: GameEvent; x: number; y: number }[] }
  | { k: 'kv'; key: string };

class PeerLink {
  socket: Socket | null = null;
  up = false;
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
  send(m: Msg): void {
    if (this.up && this.socket) this.socket.write(frame(Z_MSG, 0, JSON.stringify(m)));
  }
}

export class ZoneRuntime {
  readonly id: string;
  readonly index: number;
  readonly layout: ZoneLayout;
  readonly regions: Set<RegionId>;
  private game: Game;
  private secret: string;
  private peers = new Map<string, PeerLink>();
  private specs: ZonePeer[];
  private server: Server | null = null;
  /** Ghost ids by the zone that owns them; what we mirrored to each peer last time. */
  private ghostsFrom = new Map<string, Set<number>>();
  private sentTo = new Map<string, Set<number>>();
  private borderCache = new Map<number, { x: number; y: number; zones: string[] }>();
  private outEvents = new Map<string, { ev: GameEvent; x: number; y: number }[]>();
  private pending = new Map<number, Handoff>();
  private outside = new Map<number, number>(); // NPC id -> world time first seen outside the zone
  private stopped = false;
  log: (s: string) => void;

  constructor(game: Game, o: { id: string; layout: ZoneLayout; secret: string; peers: ZonePeer[]; log?: (s: string) => void }) {
    this.game = game;
    this.id = o.id;
    this.layout = o.layout;
    this.index = o.layout.findIndex((z) => z.id === o.id);
    if (this.index < 0) throw new Error(`zone ${o.id} is not in the layout`);
    this.regions = new Set(o.layout[this.index].regions);
    this.secret = o.secret;
    this.specs = o.peers;
    this.log = o.log ?? ((s) => console.log(s));
    for (const p of o.peers) this.peers.set(p.id, new PeerLink(p.id));
    game.zone = this;
    // Shared records: tell the others when we write one.
    const setKv = game.db.setKv.bind(game.db);
    game.db.setKv = (key: string, value: unknown) => {
      setKv(key, value);
      for (const p of this.peers.values()) p.send({ k: 'kv', key });
    };
  }

  /** Ids made here never collide with another zone's. */
  idBase(): number {
    return this.index * ID_SPACE;
  }

  inZone(x: number, y: number): boolean {
    return zoneAt(this.layout, this.game.world, x, y) === this.id;
  }

  get lead(): boolean {
    return this.index === 0;
  }

  // ---------------------------------------------------------------------------------------- the mesh

  async listen(port: number, host = '127.0.0.1'): Promise<number> {
    this.server = createServer((sock) => this.accept(sock));
    await new Promise<void>((r, j) => {
      this.server!.once('error', j);
      this.server!.listen(port, host, () => r());
    });
    // We dial the zones after us in the layout; those before us dial us.
    for (const p of this.specs) if (this.layout.findIndex((z) => z.id === p.id) > this.index) this.dial(p);
    return (this.server.address() as AddressInfo).port;
  }

  private accept(sock: Socket): void {
    let link: PeerLink | null = null;
    const reader = new FrameReader();
    sock.setNoDelay(true);
    sock.on('data', (d: Buffer) => {
      try {
        reader.push(d, (type, _id, p) => {
          if (type === Z_HELLO) {
            const h = JSON.parse(p.toString('utf8')) as { secret: string; zone: string };
            const peer = this.peers.get(h.zone);
            if (!peer || !secretsMatch(h.secret, this.secret)) return sock.destroy();
            link = peer;
            this.adopt(peer, sock);
            sock.write(frame(Z_HELLO, 0, JSON.stringify({ secret: this.secret, zone: this.id })));
          } else if (type === Z_MSG && link) this.onMsg(link, JSON.parse(p.toString('utf8')) as Msg);
        });
      } catch {
        sock.destroy();
      }
    });
    sock.on('error', () => {});
    sock.on('close', () => link && this.lost(link, sock));
  }

  private dial(spec: ZonePeer): void {
    if (this.stopped) return;
    const peer = this.peers.get(spec.id)!;
    const sock = connect(spec.port, spec.host);
    const reader = new FrameReader();
    sock.setNoDelay(true);
    sock.on('connect', () => sock.write(frame(Z_HELLO, 0, JSON.stringify({ secret: this.secret, zone: this.id }))));
    sock.on('data', (d: Buffer) => {
      try {
        reader.push(d, (type, _id, p) => {
          if (type === Z_HELLO) this.adopt(peer, sock);
          else if (type === Z_MSG) this.onMsg(peer, JSON.parse(p.toString('utf8')) as Msg);
        });
      } catch {
        sock.destroy();
      }
    });
    sock.on('error', () => {});
    sock.on('close', () => {
      this.lost(peer, sock);
      if (!this.stopped) setTimeout(() => this.dial(spec), 500);
    });
  }

  private adopt(peer: PeerLink, sock: Socket): void {
    peer.socket = sock;
    peer.up = true;
    this.sentTo.set(peer.id, new Set());
    this.log(`[zone ${this.id}] linked with ${peer.id}`);
  }

  private lost(peer: PeerLink, sock: Socket): void {
    if (peer.socket !== sock) return;
    peer.up = false;
    peer.socket = null;
    // Its ghosts vanish.
    for (const id of this.ghostsFrom.get(peer.id) ?? []) this.dropGhost(id);
    this.ghostsFrom.delete(peer.id);
  }

  up(id: string): boolean {
    return !!this.peers.get(id)?.up;
  }

  stop(): void {
    this.stopped = true;
    for (const p of this.peers.values()) p.socket?.destroy();
    this.server?.close();
  }

  // ---------------------------------------------------------------------------------------- each tick

  afterStep(): void {
    const g = this.game;
    // Border ghosts (every other tick) and crossings (every fifth).
    if (g.tick % 2 === 0) this.sendGhosts();
    if (g.tick % 5 === 0) this.sweep();
    // Border events.
    for (const [zone, list] of this.outEvents) {
      if (list.length) this.peers.get(zone)?.send({ k: 'events', list });
    }
    this.outEvents.clear();
    // Shared records are written as soon as they change, so the other zones see them.
    g.holdings.save(g);
    g.guilds.save(g);
    for (const [acct, h] of this.pending) if (h.until < g.now) this.pending.delete(acct);
  }

  private border(ship: ShipEntity): string[] {
    const c = this.borderCache.get(ship.id);
    if (c && Math.abs(c.x - ship.state.x) < 150 && Math.abs(c.y - ship.state.y) < 150) return c.zones;
    const zones = zonesNear(this.layout, this.game.world, ship.state.x, ship.state.y, this.id);
    this.borderCache.set(ship.id, { x: ship.state.x, y: ship.state.y, zones });
    return zones;
  }

  private sendGhosts(): void {
    const g = this.game;
    const rows = new Map<string, GhostRow[]>();
    for (const ship of g.ships.values()) {
      if (ship.ghost || !ship.alive || ship.docked) continue;
      for (const z of this.border(ship)) {
        if (!this.up(z)) continue;
        let list = rows.get(z);
        if (!list) rows.set(z, (list = []));
        list.push(this.row(ship));
      }
    }
    for (const [z, peer] of this.peers) {
      if (!peer.up) continue;
      const now = rows.get(z) ?? [];
      const was = this.sentTo.get(z) ?? new Set<number>();
      const ids = new Set(now.map((r) => r.id));
      const gone = [...was].filter((id) => !ids.has(id));
      this.sentTo.set(z, ids);
      if (now.length || gone.length) peer.send({ k: 'ghosts', rows: now, gone });
    }
  }

  row(ship: ShipEntity): GhostRow {
    const g = this.game;
    const flags = ship.flagsFor(null, false, g.now) & ~SF.HOSTILE;
    return {
      id: ship.id, name: ship.name, captainName: ship.captainName, captain: ship.captain, faction: ship.faction, classId: ship.loadout.classId,
      accountId: ship.accountId, npcRole: ship.npcRole, level: ship.level, wanted: ship.wantedCache, guild: ship.guildTag, ownerId: ship.ownerId,
      x: Math.round(ship.state.x * 10) / 10, y: Math.round(ship.state.y * 10) / 10, h: Math.round(ship.state.heading * 1000) / 1000, spd: Math.round(ship.state.speed * 10) / 10,
      sail: Math.round(ship.state.sail * 100) / 100, hull: Math.round((ship.hull / ship.stats.hullMax) * 1000) / 1000, sails: Math.round((ship.sails / ship.stats.sailHpMax) * 100) / 100,
      crew: Math.round((ship.crew / Math.max(1, ship.stats.crewMax)) * 100) / 100, flags,
    };
  }

  private upsertGhost(from: string, r: GhostRow): void {
    const g = this.game;
    let ship = g.ships.get(r.id);
    if (ship && !ship.ghost) return; // ours already (a handoff crossed with the update)
    if (!ship) {
      ship = new ShipEntity({ id: r.id, name: r.name, captainName: r.captainName, captain: r.captain, faction: r.faction, accountId: r.accountId, loadout: { classId: r.classId, name: r.name, guns: { port: defaultGunFor(SHIP_CLASSES[r.classId]), starboard: defaultGunFor(SHIP_CLASSES[r.classId]) }, modules: {} }, talents: {}, x: r.x, y: r.y, heading: r.h });
      ship.ghost = true;
      ship.ghostZone = from;
      g.ships.set(ship.id, ship);
      let set = this.ghostsFrom.get(from);
      if (!set) this.ghostsFrom.set(from, (set = new Set()));
      set.add(ship.id);
    }
    ship.npcRole = (r.npcRole as ShipEntity['npcRole']) ?? null;
    ship.level = r.level;
    ship.wantedCache = r.wanted;
    ship.guildTag = r.guild;
    ship.ownerId = r.ownerId;
    ship.state.x = r.x;
    ship.state.y = r.y;
    ship.state.heading = r.h;
    ship.state.speed = r.spd;
    ship.state.sail = r.sail;
    ship.hull = r.hull * ship.stats.hullMax;
    ship.sails = r.sails * ship.stats.sailHpMax;
    ship.crew = Math.round(r.crew * ship.stats.crewMax);
    ship.ghostFlags = r.flags;
    ship.sinkingUntil = r.flags & SF.SINKING ? g.now + 6 : 0;
    g.grid.upsert(ship.id, r.x, r.y);
  }

  private dropGhost(id: number): void {
    const ship = this.game.ships.get(id);
    if (!ship?.ghost) return;
    this.game.ships.delete(id);
    this.game.grid.remove(id);
  }

  /** Ships out of our waters: captains are handed over, strays sail off the chart. */
  private sweep(): void {
    const g = this.game;
    for (const s of [...g.sessions]) {
      const ship = s.ship;
      if (!ship || !s.authed || !s.profile || s.disconnectedAt !== null) continue;
      if (ship.ghost || this.inZone(ship.state.x, ship.state.y)) continue;
      this.handOut(s);
    }
    for (const ship of [...g.ships.values()]) {
      if (ship.ghost || ship.isPlayer || ship.ownerId !== null) continue;
      if (this.inZone(ship.state.x, ship.state.y)) {
        this.outside.delete(ship.id);
        continue;
      }
      const since = this.outside.get(ship.id) ?? g.now;
      this.outside.set(ship.id, since);
      if (g.now - since > 30) {
        this.outside.delete(ship.id);
        g.removeShip(ship.id);
      }
    }
  }

  // ---------------------------------------------------------------------------------------- handoff

  /** A captain sails over the line: to the zone across it, with their escorts. */
  handOut(s: PlayerSession): void {
    const g = this.game;
    const ship = s.ship!;
    const target = zoneAt(this.layout, g.world, ship.state.x, ship.state.y);
    const conn = s.conn;
    if (!(conn instanceof RemoteConnection) || !this.up(target)) {
      // No gateway to move the session, or the zone is down: the chart ends here — turn her back.
      ship.state.heading += Math.PI;
      ship.state.x -= Math.sin(ship.state.heading - Math.PI) * 60;
      ship.state.y += Math.cos(ship.state.heading - Math.PI) * 60;
      g.grid.upsert(ship.id, ship.state.x, ship.state.y);
      g.sendTo(s, { t: 'toast', msg: this.up(target) ? 'Beyond here the sea is kept by another harbour: sail through the gateway to cross.' : 'The waters beyond are closed for now.', kind: 'bad' });
      return;
    }
    g.prepareHandoff(s); // barter, duels, groups
    g.saveSession(s);
    const owned: OwnedShip[] = [];
    for (const o of [...g.ships.values()]) {
      if (o.ownerId !== ship.id || o.ghost || !o.alive) continue;
      owned.push({ id: o.id, role: o.npcRole ?? 'escort', classId: o.loadout.classId, faction: o.faction as FactionId, name: o.name, captainName: o.captainName, x: o.state.x, y: o.state.y, heading: o.state.heading, hull: o.hull / o.stats.hullMax, crew: o.crew, cargo: o.cargo as Record<string, number>, fleetId: o.fleetId, prize: !!o.prize, until: o.removeAt ? o.removeAt - g.now : 0 });
      g.removeShip(o.id);
    }
    const h: Handoff = {
      account: s.accountId,
      profile: s.profile!,
      ship: { id: ship.id, x: ship.state.x, y: ship.state.y, heading: ship.state.heading, speed: ship.state.speed, sail: ship.state.sail, sailTarget: ship.input.sailTarget, rudder: ship.input.rudder },
      owned,
      until: 0,
    };
    this.peers.get(target)!.send({ k: 'handoff', h });
    g.dropSession(s);
    conn.moveTo(target);
    this.log(`[zone ${this.id}] ${s.name} crosses into ${target}`);
  }

  /** On the replayed hello: the captain as they left the other zone. */
  takePending(account: number): Handoff | null {
    const h = this.pending.get(account);
    if (!h) return null;
    this.pending.delete(account);
    return h;
  }

  /** Escorts and prizes arrive with their captain. */
  landOwned(h: Handoff, shipId: number): void {
    const g = this.game;
    for (const o of h.owned) {
      const e = g.spawnNpcShip(o.role as 'escort', o.classId, o.faction, o.x, o.y, o.heading, { ship: o.name, captain: o.captainName }, o.id);
      e.ownerId = shipId;
      e.hull = o.hull * e.stats.hullMax;
      e.crew = o.crew;
      e.cargo = o.cargo;
      e.fleetId = o.fleetId;
      e.prize = o.prize;
      if (o.until > 0) e.removeAt = g.now + o.until;
      const brain = g.npcs.get(e.id);
      if (brain) brain.active = true;
      g.grid.upsert(e.id, e.state.x, e.state.y);
    }
  }

  // ---------------------------------------------------------------------------------------- forwarding

  forwardHit(target: ShipEntity, d: DamagePacket, source: ShipEntity | null): void {
    this.peers.get(target.ghostZone)?.send({ k: 'hit', target: target.id, d, source: source?.id ?? null });
  }

  forwardKill(killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
    this.peers.get(killer.ghostZone)?.send({ k: 'kill', killer: killer.id, victim: this.row(victim), how });
  }

  onEvent(ev: GameEvent, x: number, y: number): void {
    for (const z of zonesNear(this.layout, this.game.world, x, y, this.id)) {
      let list = this.outEvents.get(z);
      if (!list) this.outEvents.set(z, (list = []));
      list.push({ ev, x, y });
    }
  }

  private onMsg(from: PeerLink, m: Msg): void {
    const g = this.game;
    switch (m.k) {
      case 'ghosts':
        for (const r of m.rows) this.upsertGhost(from.id, r);
        for (const id of m.gone) {
          this.dropGhost(id);
          this.ghostsFrom.get(from.id)?.delete(id);
        }
        return;
      case 'handoff':
        this.pending.set(m.h.account, { ...m.h, until: g.now + 30 });
        this.dropGhost(m.h.ship.id);
        for (const o of m.h.owned) this.dropGhost(o.id);
        return;
      case 'hit': {
        const t = g.ships.get(m.target);
        if (!t || t.ghost) return;
        g.applyForeignDamage(t, m.d, m.source !== null ? g.ships.get(m.source) ?? null : null);
        return;
      }
      case 'kill': {
        const killer = g.ships.get(m.killer);
        if (!killer || killer.ghost) return;
        let victim = g.ships.get(m.victim.id);
        if (!victim) {
          this.upsertGhost(from.id, m.victim);
          victim = g.ships.get(m.victim.id);
        }
        if (victim) g.creditForeignKill(killer, victim, m.how);
        return;
      }
      case 'events':
        for (const e of m.list) g.pushForeignEvent(e.ev, e.x, e.y);
        return;
      case 'kv':
        g.invalidateKv(m.key);
        return;
    }
  }
}

export function sessionIsMovable(s: PlayerSession): boolean {
  return s.conn instanceof RemoteConnection;
}
