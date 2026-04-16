import type { Server, Socket } from 'socket.io';
import type { RoomManager } from './RoomManager.js';

const MATCH_SIZE = 2; // players per match (1v1 by default; raise for team play)

interface QueueEntry {
  socket: Socket;
  name: string;
  joinedAt: number;
}

export class Matchmaker {
  private queue: QueueEntry[] = [];
  private io: Server;
  private rooms: RoomManager;
  private interval: ReturnType<typeof setInterval>;

  constructor(io: Server, rooms: RoomManager) {
    this.io = io;
    this.rooms = rooms;
    // Run matchmaking every 1.5s
    this.interval = setInterval(() => this.tryMatch(), 1500);
  }

  join(socket: Socket, name: string): void {
    if (this.queue.find(e => e.socket.id === socket.id)) return;
    this.queue.push({ socket, name, joinedAt: Date.now() });
    socket.emit('queue:joined');
    this.broadcastCount();
    this.tryMatch();
  }

  leave(socket: Socket): void {
    const before = this.queue.length;
    this.queue = this.queue.filter(e => e.socket.id !== socket.id);
    if (this.queue.length !== before) {
      socket.emit('queue:left');
      this.broadcastCount();
    }
  }

  private tryMatch(): void {
    while (this.queue.length >= MATCH_SIZE) {
      const group = this.queue.splice(0, MATCH_SIZE);
      const names = new Map(group.map(e => [e.socket.id, e.name]));
      const sockets = group.map(e => e.socket);
      const room = this.rooms.createForMatchmaking(sockets, names);
      const pub = {
        id: room.id, code: room.code,
        hostId: room.hostId, players: room.players,
      };
      this.io.to(room.code).emit('game:start', pub);
    }
    this.broadcastCount();
  }

  private broadcastCount(): void {
    for (const e of this.queue) {
      e.socket.emit('queue:count', this.queue.length);
    }
  }

  destroy(): void {
    clearInterval(this.interval);
  }
}
