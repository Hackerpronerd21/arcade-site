export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Team = 6 | 7;
export type GameMode = 'local' | 'matchmaking' | 'private_host' | 'private_join';
export type NetRole = 'offline' | 'host' | 'client';

export interface BikeState {
  id: string;
  x: number;
  y: number;
  dir: Direction;
  team: Team;
  alive: boolean;
}

export interface GameState {
  tick: number;
  bikes: BikeState[];
  trails: number[];
  phase: 'countdown' | 'playing' | 'round_end' | 'match_end';
  scores: [number, number];
  countdown: number;
  winner?: Team | 0;
}

export interface PlayerInfo {
  id: string;
  name: string;
  team: Team;
  ready: boolean;
}

export interface RoomInfo {
  id: string;
  code: string;
  players: PlayerInfo[];
  hostId: string;
}

export interface LobbyConfig {
  mode: GameMode;
  code?: string;
  name: string;
  serverUrl: string;
}

export interface SceneData {
  mode: NetRole;
  playerCount: number;
  myId?: string;
  myTeam?: Team;
  mySlot?: number;
  roomCode?: string;
  scores?: [number, number];
}
