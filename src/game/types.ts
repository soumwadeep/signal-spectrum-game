export type Phase = "lobby" | "clue" | "guess" | "reveal" | "finished";

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  score: number;
  isHost: boolean;
  isBeacon: boolean;
  hasGuessed: boolean;
}

export interface YouView {
  id: string;
  isHost: boolean;
  isBeacon: boolean;
  hasGuessed: boolean;
}

export interface RoundEntry {
  playerId: string;
  name: string;
  color: string;
  guess: number | null;
  distance: number | null;
  points: number;
  isBeacon: boolean;
}

export interface RoundResult {
  target: number;
  clue: string;
  beaconId: string;
  beaconName: string;
  beaconPoints: number;
  bullseye: boolean;
  closeOrBetter: number;
  bands: number[];
  entries: RoundEntry[];
}

export interface GameView {
  room: string;
  revision: number;
  phase: Phase;
  round: number;
  totalRounds: number;
  suddenDeath: boolean;
  hostId: string;
  players: PlayerView[];
  you: YouView;
  beaconId: string | null;
  poles: { left: string; right: string } | null;
  clue: string | null;
  target: number | null;
  bands: number[];
  deadline: string | null;
  serverNow: string;
  lockedCount: number;
  guesserCount: number;
  yourGuess: number | null;
  canStart: boolean;
  canRematch: boolean;
  roundResult: RoundResult | null;
  winners: string[] | null;
  minPlayers: number;
  maxPlayers: number;
}

export interface Session {
  code: string;
  token: string;
  playerId: string;
  name: string;
}

export interface AuthResult {
  ok: true;
  code: string;
  token: string;
  playerId: string;
  view: GameView;
}

export interface ViewResult {
  ok: true;
  view: GameView;
}

export type ConnectionState = "boot" | "live" | "reconnecting" | "idle";

export interface GameApiErrorShape {
  ok: false;
  error: string;
}
