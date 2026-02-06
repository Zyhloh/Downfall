export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ConnectionState {
  status: ConnectionStatus;
  playerInfo: PlayerInfo | null;
  region: string | null;
  shard: string | null;
}

export interface PlayerInfo {
  puuid: string;
  gameName: string;
  tagLine: string;
  playerCardId: string | null;
}

export interface AccountXP {
  level: number;
  xp: number;
}

export interface PlayerMMR {
  rank: number;
  rr: number;
  leaderboardRank: number;
  peakRank: number;
  peakRankAct: string;
  wins: number;
  games: number;
}

export interface CompUpdate {
  matchId: string;
  mapId: string;
  rankBefore: number;
  rankAfter: number;
  rrBefore: number;
  rrAfter: number;
  rrChange: number;
  timestamp: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  roundsWon: number;
  roundsLost: number;
}

export interface PlayerProfile {
  info: PlayerInfo;
  accountXp: AccountXP | null;
  mmr: PlayerMMR | null;
  compUpdates: CompUpdate[];
}

export interface AgentInfo {
  uuid: string;
  name: string;
  icon: string;
  role: string;
  roleIcon: string;
  unlocked: boolean;
}

export interface PregameState {
  matchId: string;
  mapId: string;
  mapName: string;
  locked: boolean;
  lockedAgent: string | null;
}

export interface MatchPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  characterId: string;
  competitiveTier: number;
}

export interface CurrentMatch {
  matchId: string;
  players: MatchPlayer[];
  mapId: string;
  queueId: string;
  isRanked: boolean;
}

export interface LiveMatchPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  rank: number;
  rr: number;
  peakRank: number;
  accountLevel: number;
  incognito: boolean;
  isSelf: boolean;
}

export interface Friend {
  puuid: string;
  gameName: string;
  tagLine: string;
  isOnline: boolean;
  status: string;
  playerCardId: string;
}

export interface PartyInvite {
  requestId: string;
  partyId: string;
  fromPuuid: string;
  fromName: string;
  fromTag: string;
}

export interface PartyMember {
  puuid: string;
  gameName: string;
  tagLine: string;
  rank: number;
  accountLevel: number;
  playerCardId: string;
  isOwner: boolean;
  isReady: boolean;
  isModerator: boolean;
  ping: number;
}

export interface PartyState {
  partyId: string;
  members: PartyMember[];
  state: string;
  accessibility: string;
  queueId: string;
  inviteCode: string;
  isOwner: boolean;
  eligibleQueues: string[];
  invites: PartyInvite[];
}

export interface LiveMatch {
  matchId: string;
  mapId: string;
  mapName: string;
  queueId: string;
  phase: string;
  isTeamMode: boolean;
  allyTeam: LiveMatchPlayer[];
  enemyTeam: LiveMatchPlayer[];
}
