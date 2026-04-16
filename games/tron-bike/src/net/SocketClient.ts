import { io, Socket } from 'socket.io-client';
import type { RoomInfo, Direction, GameState } from '../types';

export type SocketEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'queue_joined' }
  | { type: 'queue_left' }
  | { type: 'queue_count'; count: number }
  | { type: 'room_created'; room: RoomInfo }
  | { type: 'room_joined'; room: RoomInfo }
  | { type: 'room_updated'; room: RoomInfo }
  | { type: 'room_error'; message: string }
  | { type: 'game_start'; room: RoomInfo }
  | { type: 'game_state'; state: GameState }
  | { type: 'game_input'; fromId: string; dir: Direction }
  | { type: 'webrtc_offer'; from: string; offer: RTCSessionDescriptionInit }
  | { type: 'webrtc_answer'; from: string; answer: RTCSessionDescriptionInit }
  | { type: 'webrtc_ice'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'player_left'; playerId: string };

export class SocketClient {
  private socket: Socket | null = null;
  private listeners: Array<(e: SocketEvent) => void> = [];

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(url, { transports: ['websocket'], timeout: 5000 });
      this.socket.on('connect', () => {
        this.emit({ type: 'connected' });
        resolve();
      });
      this.socket.on('connect_error', reject);
      this.socket.on('disconnect', () => this.emit({ type: 'disconnected' }));

      this.socket.on('queue:joined',  ()                => this.emit({ type: 'queue_joined' }));
      this.socket.on('queue:left',    ()                => this.emit({ type: 'queue_left' }));
      this.socket.on('queue:count',   (count: number)   => this.emit({ type: 'queue_count', count }));
      this.socket.on('room:created',  (room: RoomInfo)  => this.emit({ type: 'room_created', room }));
      this.socket.on('room:joined',   (room: RoomInfo)  => this.emit({ type: 'room_joined', room }));
      this.socket.on('room:updated',  (room: RoomInfo)  => this.emit({ type: 'room_updated', room }));
      this.socket.on('room:error',    (msg: string)     => this.emit({ type: 'room_error', message: msg }));
      this.socket.on('game:start',    (room: RoomInfo)  => this.emit({ type: 'game_start', room }));
      this.socket.on('game:state',    (s: GameState)    => this.emit({ type: 'game_state', state: s }));
      this.socket.on('game:input',    (d: { fromId: string; dir: Direction }) =>
        this.emit({ type: 'game_input', fromId: d.fromId, dir: d.dir }));
      this.socket.on('webrtc:offer',  (d: { from: string; offer: RTCSessionDescriptionInit }) =>
        this.emit({ type: 'webrtc_offer', from: d.from, offer: d.offer }));
      this.socket.on('webrtc:answer', (d: { from: string; answer: RTCSessionDescriptionInit }) =>
        this.emit({ type: 'webrtc_answer', from: d.from, answer: d.answer }));
      this.socket.on('webrtc:ice',    (d: { from: string; candidate: RTCIceCandidateInit }) =>
        this.emit({ type: 'webrtc_ice', from: d.from, candidate: d.candidate }));
      this.socket.on('player:left',   (id: string)      => this.emit({ type: 'player_left', playerId: id }));
    });
  }

  on(fn: (e: SocketEvent) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  private emit(e: SocketEvent) {
    for (const fn of this.listeners) fn(e);
  }

  get id() { return this.socket?.id ?? ''; }
  get connected() { return this.socket?.connected ?? false; }

  joinQueue(name: string)                { this.socket?.emit('queue:join', { name }); }
  leaveQueue()                           { this.socket?.emit('queue:leave'); }
  createRoom(name: string)               { this.socket?.emit('room:create', { name }); }
  joinRoom(code: string, name: string)   { this.socket?.emit('room:join', { code, name }); }
  setReady()                             { this.socket?.emit('room:ready'); }
  startGame()                            { this.socket?.emit('room:start'); }
  sendInput(dir: Direction)              { this.socket?.emit('game:input', { dir }); }
  sendState(state: GameState)            { this.socket?.emit('game:state', state); }
  sendOffer(to: string, offer: RTCSessionDescriptionInit)   { this.socket?.emit('webrtc:offer',  { to, offer }); }
  sendAnswer(to: string, answer: RTCSessionDescriptionInit) { this.socket?.emit('webrtc:answer', { to, answer }); }
  sendIce(to: string, candidate: RTCIceCandidateInit)       { this.socket?.emit('webrtc:ice',    { to, candidate }); }

  disconnect() { this.socket?.disconnect(); this.socket = null; }
}
