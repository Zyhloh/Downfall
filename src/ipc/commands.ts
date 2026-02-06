import { invoke } from "@tauri-apps/api/core";
import type { ConnectionState, PlayerProfile, AgentInfo, PregameState, CurrentMatch, LiveMatch, PartyState, Friend } from "../types/valorant";

export async function getConnectionState(): Promise<ConnectionState> {
  return invoke<ConnectionState>("get_connection_state");
}

export async function getPlayerProfile(): Promise<PlayerProfile> {
  return invoke<PlayerProfile>("get_player_profile");
}

export async function getAgents(): Promise<AgentInfo[]> {
  return invoke<AgentInfo[]>("get_agents");
}

export async function getPregameState(): Promise<PregameState | null> {
  return invoke<PregameState | null>("get_pregame_state");
}

export async function instalockAgent(matchId: string, agentId: string): Promise<void> {
  return invoke<void>("instalock_agent", { matchId, agentId });
}

export async function dodgeMatch(matchId: string): Promise<void> {
  return invoke<void>("dodge_match", { matchId });
}

export interface AppConfig {
  instalock: {
    active: boolean;
    defaultAgent: string | null;
    mapOverrides: Record<string, string>;
  };
  mapDodge: {
    active: boolean;
    blacklistedMaps: string[];
  };
  timing: {
    preset: string;
    selectDelay: number;
    lockDelay: number;
  };
  app: {
    minimizeOnClose: boolean;
    startMinimized: boolean;
  };
  discord: {
    enabled: boolean;
    details: string;
    state: string;
  };
}

export async function loadConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("load_config");
}

export async function saveConfig(cfg: AppConfig): Promise<void> {
  return invoke<void>("save_config", { cfg });
}

export async function getLiveMatch(): Promise<LiveMatch | null> {
  return invoke<LiveMatch | null>("get_live_match");
}

export async function getParty(): Promise<PartyState | null> {
  return invoke<PartyState | null>("get_party");
}

export async function partyInvite(partyId: string, name: string, tag: string): Promise<void> {
  return invoke<void>("party_invite", { partyId, name, tag });
}

export async function partyKick(partyId: string, targetPuuid: string): Promise<void> {
  return invoke<void>("party_kick", { partyId, targetPuuid });
}

export async function partyAcceptInvite(partyId: string): Promise<void> {
  return invoke<void>("party_accept_invite", { partyId });
}

export async function partyDeclineInvite(partyId: string, requestId: string): Promise<void> {
  return invoke<void>("party_decline_invite", { partyId, requestId });
}

export async function partyPromote(partyId: string, targetPuuid: string): Promise<void> {
  return invoke<void>("party_promote", { partyId, targetPuuid });
}

export async function partySetAccessibility(partyId: string, open: boolean): Promise<void> {
  return invoke<void>("party_set_accessibility", { partyId, open });
}

export async function partySetReady(partyId: string, ready: boolean): Promise<void> {
  return invoke<void>("party_set_ready", { partyId, ready });
}

export async function partyQueue(partyId: string, start: boolean): Promise<void> {
  return invoke<void>("party_queue", { partyId, start });
}

export async function partySetQueue(partyId: string, queueId: string): Promise<void> {
  return invoke<void>("party_set_queue", { partyId, queueId });
}

export async function partyGenerateCode(partyId: string): Promise<string> {
  return invoke<string>("party_generate_code", { partyId });
}

export async function partyDisableCode(partyId: string): Promise<void> {
  return invoke<void>("party_disable_code", { partyId });
}

export async function getFriends(): Promise<Friend[]> {
  return invoke<Friend[]>("get_friends");
}

export async function minimizeToTray(): Promise<void> {
  return invoke<void>("minimize_to_tray");
}

export async function getCurrentMatch(): Promise<CurrentMatch | null> {
  return invoke<CurrentMatch | null>("get_current_match");
}
