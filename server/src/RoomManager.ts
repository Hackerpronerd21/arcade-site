import type { Server, Socket } from 'socket.io';
import type { Room, Team, PlayerInfo } from './types.js';

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function assignTeam(room: Room): Team {
  const t6 = room.players.filter(p => p.team === 6).length;
  const t7 = room.players.filter(p => p.team === 7).length;
  return t6 <= t7 ? 6 : 7;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private socketRoom: Map<string, string> = new Map(); // socketId → roomId
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  create(socket: Socket, name: string): Room {
    const code = this.uniqueCode();
    const player: PlayerInfo = { id: socket.id, name, team: 6, ready: false };
    const room: Room = {
      id: code,
      code,
      hostId: socket.id,
      players: [player],
      started: false,
    };
    this.rooms.set(code, room);
    this.socketRoom.set(socket.id, code);
    socket.join(code);
    socket.emit('room:created', this.publicRoom(room));
    return room;
  }

  join(socket: Socket, code: string, name: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) { socket.emit('room:error', 'ROOM NOT FOUND'); return; }
    if (room.started) { socket.emit('room:error', 'GAME ALREADY STARTED'); return; }
    if (room.players.length >= 6) { socket.emit('room:error', 'ROOM FULL'); return; }
    if (room.players.find(p => p.id === socket.id)) { return; }

    const team = assignTeam(room);
    const player: PlayerInfo = { id: socket.id, name, team, ready: false };
    room.players.push(player);
    this.socketRoom.set(socket.id, code);
    socket.join(code);

    const pub = this.publicRoom(room);
    socket.emit('room:joined', pub);
    this.io.to(code).emit('room:updated', pub);
  }

  setReady(socket: Socket): void {
    const room = this.getSocketRoom(socket.id);
    if (!room) return;
    const p = room.players.find(p => p.id === socket.id);
    if (p) { p.ready = true; }
    this.io.to(room.code).emit('room:updated', this.publicRoom(room));
  }

  startGame(socket: Socket): void {
    const room = this.getSocketRoom(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) { socket.emit('room:error', 'ONLY HOST CAN START'); return; }
    if (!room.players.every(p => p.ready)) { socket.emit('room:error', 'NOT ALL PLAYERS READY'); return; }
    room.started = true;
    this.io.to(room.code).emit('game:start', this.publicRoom(room));
  }

  relayInput(socket: Socket, data: { dir: string }): void {
    const room = this.getSocketRoom(socket.id);
    if (!room || !room.started) return;
    // Relay to host only
    this.io.to(room.hostId).emit('game:input', { fromId: socket.id, dir: data.dir });
  }

  relayState(socket: Socket, state: unknown): void {
    const room = this.getSocketRoom(socket.id);
    if (!room || socket.id !== room.hostId) return;
    // Host broadcasts state to all other players
    socket.to(room.code).emit('game:state', state);
  }

  leave(socket: Socket): void {
    const roomId = this.socketRoom.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    this.socketRoom.delete(socket.id);
    socket.leave(roomId);

    this.io.to(roomId).emit('player:left', socket.id);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    } else if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      this.io.to(roomId).emit('room:updated', this.publicRoom(room));
    } else {
      this.io.to(roomId).emit('room:updated', this.publicRoom(room));
    }
  }

  createForMatchmaking(sockets: Socket[], names: Map<string, string>): Room {
    const code = this.uniqueCode();
    const players: PlayerInfo[] = sockets.map((s, i) => ({
      id: s.id,
      name: names.get(s.id) ?? 'RIDER',
      team: (i % 2 === 0 ? 6 : 7) as Team,
      ready: true,
    }));
    const room: Room = {
      id: code,
      code,
      hostId: sockets[0].id,
      players,
      started: false,
    };
    this.rooms.set(code, room);
    for (const s of sockets) {
      this.socketRoom.set(s.id, code);
      s.join(code);
    }
    return room;
  }

  private getSocketRoom(socketId: string): Room | undefined {
    const id = this.socketRoom.get(socketId);
    return id ? this.rooms.get(id) : undefined;
  }

  private publicRoom(room: Room) {
    return {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      players: room.players,
    };
  }

  private uniqueCode(): string {
    let code: string;
    do { code = genCode(); } while (this.rooms.has(code));
    return code;
  }
}
