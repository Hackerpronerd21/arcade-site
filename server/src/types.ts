export type Team = 6 | 7;

export interface PlayerInfo {
  id: string;
  name: string;
  team: Team;
  ready: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: PlayerInfo[];
  started: boolean;
}
