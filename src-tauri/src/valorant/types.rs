use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lockfile {
    pub name: String,
    pub pid: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionState {
    pub status: ConnectionStatus,
    pub player_info: Option<PlayerInfo>,
    pub region: Option<String>,
    pub shard: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerInfo {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub player_card_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionInfo {
    pub region: String,
    pub shard: String,
}

#[derive(Debug, Clone)]
pub struct AuthTokens {
    pub access_token: String,
    pub entitlements: String,
    pub client_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountXP {
    pub level: u32,
    pub xp: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerMMR {
    pub rank: u32,
    pub rr: u32,
    pub leaderboard_rank: u32,
    pub peak_rank: u32,
    pub peak_rank_act: String,
    pub wins: u32,
    pub games: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompUpdate {
    pub match_id: String,
    pub map_id: String,
    pub rank_before: u32,
    pub rank_after: u32,
    pub rr_before: u32,
    pub rr_after: u32,
    pub rr_change: i32,
    pub timestamp: u64,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub score: u32,
    pub rounds_won: u32,
    pub rounds_lost: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProfile {
    pub info: PlayerInfo,
    pub account_xp: Option<AccountXP>,
    pub mmr: Option<PlayerMMR>,
    pub comp_updates: Vec<CompUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub uuid: String,
    pub name: String,
    pub icon: String,
    pub role: String,
    pub role_icon: String,
    pub unlocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PregameState {
    pub match_id: String,
    pub map_id: String,
    pub map_name: String,
    pub locked: bool,
    pub locked_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchPlayer {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub team_id: String,
    pub character_id: String,
    pub competitive_tier: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentMatch {
    pub match_id: String,
    pub players: Vec<MatchPlayer>,
    pub map_id: String,
    pub queue_id: String,
    pub is_ranked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Friend {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub is_online: bool,
    pub status: String,
    pub player_card_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartyMember {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub rank: u32,
    pub account_level: u32,
    pub player_card_id: String,
    pub is_owner: bool,
    pub is_ready: bool,
    pub is_moderator: bool,
    pub ping: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartyInvite {
    pub request_id: String,
    pub party_id: String,
    pub from_puuid: String,
    pub from_name: String,
    pub from_tag: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartyState {
    pub party_id: String,
    pub members: Vec<PartyMember>,
    pub state: String,
    pub accessibility: String,
    pub queue_id: String,
    pub invite_code: String,
    pub is_owner: bool,
    pub eligible_queues: Vec<String>,
    pub invites: Vec<PartyInvite>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveMatchPlayer {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub team_id: String,
    pub agent_id: String,
    pub agent_name: String,
    pub agent_icon: String,
    pub rank: u32,
    pub rr: u32,
    pub peak_rank: u32,
    pub account_level: u32,
    pub incognito: bool,
    pub is_self: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveMatch {
    pub match_id: String,
    pub map_id: String,
    pub map_name: String,
    pub queue_id: String,
    pub phase: String,
    pub is_team_mode: bool,
    pub ally_team: Vec<LiveMatchPlayer>,
    pub enemy_team: Vec<LiveMatchPlayer>,
}
