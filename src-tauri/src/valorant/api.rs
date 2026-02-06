use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use reqwest::Client;
use serde_json::Value;
use super::types::{Lockfile, PlayerInfo, RegionInfo, AuthTokens, AccountXP, PlayerMMR, CompUpdate, AgentInfo, PregameState, CurrentMatch, LiveMatch, LiveMatchPlayer, PartyState, PartyMember, PartyInvite, Friend};

pub fn build_client(lock: &Lockfile) -> Result<Client, reqwest::Error> {
    let auth = BASE64.encode(format!("riot:{}", lock.password));

    Client::builder()
        .danger_accept_invalid_certs(true)
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::AUTHORIZATION,
                format!("Basic {}", auth).parse().unwrap(),
            );
            headers
        })
        .build()
}

fn base_url(lock: &Lockfile) -> String {
    format!("https://127.0.0.1:{}", lock.port)
}

pub async fn fetch_region(client: &Client, lock: &Lockfile) -> Result<RegionInfo, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/product-session/v1/external-sessions", base_url(lock));
    let resp: Value = client.get(&url).send().await?.json().await?;

    let mut region = String::new();
    for (_key, session) in resp.as_object().into_iter().flat_map(|m| m.iter()) {
        if let Some(args) = session["launchConfiguration"]["arguments"].as_array() {
            for arg in args {
                if let Some(s) = arg.as_str() {
                    if s.starts_with("-ares-deployment=") {
                        region = s.trim_start_matches("-ares-deployment=").to_string();
                    }
                }
            }
        }
    }

    if region.is_empty() {
        let url = format!("{}/riotclient/region-locale", base_url(lock));
        let resp: Value = client.get(&url).send().await?.json().await?;
        region = resp["region"].as_str().unwrap_or("na").to_lowercase();
    }

    let shard = match region.as_str() {
        "latam" | "br" => "na".to_string(),
        "eu" => "eu".to_string(),
        "ap" => "ap".to_string(),
        "kr" => "kr".to_string(),
        _ => region.clone(),
    };

    Ok(RegionInfo { region, shard })
}

pub async fn fetch_player_info(client: &Client, lock: &Lockfile) -> Result<PlayerInfo, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/chat/v1/session", base_url(lock));
    let resp: Value = client.get(&url).send().await?.json().await?;

    let puuid = resp["puuid"].as_str().unwrap_or_default().to_string();
    let game_name = resp["game_name"].as_str().unwrap_or_default().to_string();
    let tag_line = resp["game_tag"].as_str().unwrap_or_default().to_string();

    Ok(PlayerInfo { puuid, game_name, tag_line, player_card_id: None })
}

pub async fn fetch_auth_tokens(client: &Client, lock: &Lockfile) -> Result<AuthTokens, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/entitlements/v1/token", base_url(lock));
    let resp: Value = client.get(&url).send().await?.json().await?;

    let access_token = resp["accessToken"].as_str()
        .ok_or("missing accessToken")?.to_string();
    let entitlements = resp["token"].as_str()
        .ok_or("missing token")?.to_string();

    let mut client_version = String::new();
    if let Ok(ver_resp) = Client::new()
        .get("https://valorant-api.com/v1/version")
        .send().await
    {
        if let Ok(ver_json) = ver_resp.json::<Value>().await {
            if let Some(v) = ver_json["data"]["riotClientVersion"].as_str() {
                client_version = v.to_string();
            }
        }
    }
    if client_version.is_empty() {
        let version_url = format!("{}/product-session/v1/external-sessions", base_url(lock));
        if let Ok(version_resp) = client.get(&version_url).send().await {
            if let Ok(vr) = version_resp.json::<Value>().await {
                for (_key, session) in vr.as_object().into_iter().flat_map(|m| m.iter()) {
                    if let Some(v) = session["version"].as_str() {
                        if !v.is_empty() {
                            client_version = v.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }
    if client_version.is_empty() {
        client_version = "release-09.06-shipping-17-2621129".to_string();
    }
    Ok(AuthTokens { access_token, entitlements, client_version })
}

const CLIENT_PLATFORM: &str = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

pub async fn fetch_player_card_id(tokens: &AuthTokens, puuid: &str, shard: &str) -> Option<String> {
    let pd_url = format!(
        "https://pd.{}.a.pvp.net/personalization/v2/players/{}/playerloadout",
        shard, puuid
    );
    let loadout: Value = Client::builder().build().ok()?
        .get(&pd_url)
        .header("Authorization", format!("Bearer {}", tokens.access_token))
        .header("X-Riot-Entitlements-JWT", &tokens.entitlements)
        .header("X-Riot-ClientPlatform", CLIENT_PLATFORM)
        .header("X-Riot-ClientVersion", &tokens.client_version)
        .send().await.ok()?
        .json().await.ok()?;

    let card_id = loadout["Identity"]["PlayerCardID"].as_str()?.to_string();
    if card_id.is_empty() { None } else { Some(card_id) }
}

fn pd_client(tokens: &AuthTokens) -> Option<Client> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("Authorization", format!("Bearer {}", tokens.access_token).parse().ok()?);
    headers.insert("X-Riot-Entitlements-JWT", tokens.entitlements.parse().ok()?);
    headers.insert("X-Riot-ClientPlatform", CLIENT_PLATFORM.parse().ok()?);
    headers.insert("X-Riot-ClientVersion", tokens.client_version.parse().ok()?);
    Client::builder().default_headers(headers).build().ok()
}

fn pd_url(shard: &str, path: &str) -> String {
    format!("https://pd.{}.a.pvp.net{}", shard, path)
}

fn glz_client(tokens: &AuthTokens) -> Option<Client> {
    pd_client(tokens)
}

fn glz_url(region: &str, shard: &str, path: &str) -> String {
    format!("https://glz-{}-1.{}.a.pvp.net{}", region, shard, path)
}

pub async fn fetch_account_xp(tokens: &AuthTokens, puuid: &str, shard: &str) -> Option<AccountXP> {
    let client = pd_client(tokens)?;
    let url = pd_url(shard, &format!("/account-xp/v1/players/{}", puuid));
    let resp: Value = client.get(&url).send().await.ok()?.json().await.ok()?;

    let level = resp["Progress"]["Level"].as_u64()? as u32;
    let xp = resp["Progress"]["XP"].as_u64().unwrap_or(0) as u32;

    Some(AccountXP { level, xp })
}

pub async fn fetch_mmr(tokens: &AuthTokens, puuid: &str, shard: &str) -> Option<PlayerMMR> {
    let client = pd_client(tokens)?;
    let url = pd_url(shard, &format!("/mmr/v1/players/{}", puuid));
    let resp = client.get(&url).send().await.ok()?;
    let status = resp.status();
    if !status.is_success() {
        println!("[mmr] failed for {} — status {}", &puuid[..8], status);
        return None;
    }
    let resp: Value = resp.json().await.ok()?;

    let latest = &resp["LatestCompetitiveUpdate"];
    let rank = latest["TierAfterUpdate"].as_u64().unwrap_or(0) as u32;
    let rr = latest["RankedRatingAfterUpdate"].as_u64().unwrap_or(0) as u32;

    let mut peak_rank: u32 = 0;
    let mut peak_act = String::new();
    let mut wins: u32 = 0;
    let mut games: u32 = 0;

    if let Some(seasons) = resp["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"].as_object() {
        for (season_id, season) in seasons {
            let tier = season["CompetitiveTier"].as_u64().unwrap_or(0) as u32;
            if tier > peak_rank {
                peak_rank = tier;
                peak_act = season_id.clone();
            }
            wins += season["NumberOfWins"].as_u64().unwrap_or(0) as u32;
            games += season["NumberOfGames"].as_u64().unwrap_or(0) as u32;
        }
    }

    let leaderboard_rank = latest["LeaderboardRank"].as_u64().unwrap_or(0) as u32;

    Some(PlayerMMR { rank, rr, leaderboard_rank, peak_rank, peak_rank_act: peak_act, wins, games })
}

pub async fn fetch_comp_updates(tokens: &AuthTokens, puuid: &str, shard: &str) -> Vec<CompUpdate> {
    let client = match pd_client(tokens) {
        Some(c) => c,
        None => return Vec::new(),
    };
    let url = pd_url(shard, &format!(
        "/mmr/v1/players/{}/competitiveupdates?startIndex=0&endIndex=15",
        puuid
    ));
    let resp: Value = match client.get(&url).send().await {
        Ok(r) => match r.json().await { Ok(v) => v, Err(_) => return Vec::new() },
        Err(_) => return Vec::new(),
    };

    let matches = match resp["Matches"].as_array() {
        Some(m) => m,
        None => return Vec::new(),
    };

    let entries: Vec<_> = matches.iter()
        .filter_map(|m| {
            let match_id = m["MatchID"].as_str().filter(|s| !s.is_empty())?.to_string();
            Some((match_id, m.clone()))
        })
        .take(10)
        .collect();

    let futs: Vec<_> = entries.iter()
        .map(|(mid, _)| fetch_match_kda(&client, shard, mid, puuid))
        .collect();

    let results: Vec<_> = futures::future::join_all(futs).await;

    let mut updates: Vec<CompUpdate> = Vec::new();
    for (i, (match_id, m)) in entries.iter().enumerate() {
        let (kills, deaths, assists, score, rounds_won, rounds_lost) = results[i];

        let rr_before = m["RankedRatingBeforeUpdate"].as_i64().unwrap_or(0);
        let rr_after = m["RankedRatingAfterUpdate"].as_i64().unwrap_or(0);
        let rank_before = m["TierBeforeUpdate"].as_u64().unwrap_or(0) as u32;
        let rank_after = m["TierAfterUpdate"].as_u64().unwrap_or(0) as u32;

        let rr_change = if rank_after > rank_before {
            (100 - rr_before + rr_after) as i32
        } else if rank_after < rank_before {
            -(rr_before + (100 - rr_after)) as i32
        } else {
            (rr_after - rr_before) as i32
        };

        updates.push(CompUpdate {
            match_id: match_id.clone(),
            map_id: m["MapID"].as_str().unwrap_or_default().to_string(),
            rank_before,
            rank_after,
            rr_before: rr_before as u32,
            rr_after: rr_after as u32,
            rr_change,
            timestamp: m["MatchStartTime"].as_u64().unwrap_or(0),
            kills,
            deaths,
            assists,
            score,
            rounds_won,
            rounds_lost,
        });
    }

    updates
}

async fn fetch_match_kda(client: &Client, shard: &str, match_id: &str, puuid: &str) -> (u32, u32, u32, u32, u32, u32) {
    let url = pd_url(shard, &format!("/match-details/v1/matches/{}", match_id));
    let resp: Value = match client.get(&url).send().await {
        Ok(r) => match r.json().await { Ok(v) => v, Err(_) => return (0, 0, 0, 0, 0, 0) },
        Err(_) => return (0, 0, 0, 0, 0, 0),
    };

    let players = match resp["players"].as_array() {
        Some(p) => p,
        None => return (0, 0, 0, 0, 0, 0),
    };

    let player = match players.iter().find(|p| p["subject"].as_str() == Some(puuid)) {
        Some(p) => p,
        None => return (0, 0, 0, 0, 0, 0),
    };

    let stats = &player["stats"];
    let kills = stats["kills"].as_u64().unwrap_or(0) as u32;
    let deaths = stats["deaths"].as_u64().unwrap_or(0) as u32;
    let assists = stats["assists"].as_u64().unwrap_or(0) as u32;
    let score = stats["score"].as_u64().unwrap_or(0) as u32;

    let team_id = player["teamId"].as_str().unwrap_or_default();
    let mut rounds_won: u32 = 0;
    let mut rounds_lost: u32 = 0;

    if let Some(teams) = resp["teams"].as_array() {
        for team in teams {
            let won = team["roundsWon"].as_u64().unwrap_or(0) as u32;
            if team["teamId"].as_str() == Some(team_id) {
                rounds_won = won;
            } else {
                rounds_lost = won;
            }
        }
    }

    (kills, deaths, assists, score, rounds_won, rounds_lost)
}

const AGENT_ENTITLEMENT_TYPE: &str = "01bb38e1-da47-4e6a-9b3d-945fe4655707";

pub async fn fetch_agents(tokens: &AuthTokens, puuid: &str, shard: &str) -> Vec<AgentInfo> {
    let owned: Vec<String> = match pd_client(tokens) {
        Some(client) => {
            let url = pd_url(shard, &format!("/store/v1/entitlements/{}/{}", puuid, AGENT_ENTITLEMENT_TYPE));
            match client.get(&url).send().await {
                Ok(r) => match r.json::<Value>().await {
                    Ok(resp) => {
                        resp["Entitlements"].as_array()
                            .map(|arr| arr.iter().filter_map(|e| e["ItemID"].as_str().map(|s| s.to_lowercase())).collect())
                            .unwrap_or_default()
                    },
                    Err(_) => Vec::new(),
                },
                Err(_) => Vec::new(),
            }
        }
        None => Vec::new(),
    };

    let all_agents: Value = match Client::new()
        .get("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
        .send().await
    {
        Ok(r) => match r.json().await { Ok(v) => v, Err(_) => return Vec::new() },
        Err(_) => return Vec::new(),
    };

    let agents = match all_agents["data"].as_array() {
        Some(a) => a,
        None => return Vec::new(),
    };

    let mut result: Vec<AgentInfo> = agents.iter().filter_map(|a| {
        let uuid = a["uuid"].as_str()?.to_string();
        let name = a["displayName"].as_str()?.to_string();
        let icon = a["displayIcon"].as_str()?.to_string();
        let role = a["role"]["displayName"].as_str().unwrap_or("Unknown").to_string();
        let role_icon = a["role"]["displayIcon"].as_str().unwrap_or_default().to_string();
        let is_free = a["isBaseContent"].as_bool().unwrap_or(false);
        let unlocked = is_free || owned.contains(&uuid.to_lowercase());
        Some(AgentInfo { uuid, name, icon, role, role_icon, unlocked })
    }).collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

pub async fn fetch_current_match(client: &Client, lock: &Lockfile) -> Result<Option<CurrentMatch>, Box<dyn std::error::Error + Send + Sync>> {
    let session_url = format!("{}/chat/v1/session", base_url(lock));
    let session: Value = client.get(&session_url).send().await?.json().await?;
    let puuid = session["puuid"].as_str().unwrap_or_default();

    if puuid.is_empty() {
        return Ok(None);
    }

    let presences_url = format!("{}/chat/v4/presences", base_url(lock));
    let presences: Value = client.get(&presences_url).send().await?.json().await?;

    let friends = presences["presences"].as_array();
    if friends.is_none() {
        return Ok(None);
    }

    let self_presence = friends.unwrap().iter().find(|p| p["puuid"].as_str() == Some(puuid));
    if self_presence.is_none() {
        return Ok(None);
    }

    let private_b64 = self_presence.unwrap()["private"].as_str().unwrap_or_default();
    if private_b64.is_empty() {
        return Ok(None);
    }

    let decoded = BASE64.decode(private_b64)?;
    let private: Value = serde_json::from_slice(&decoded)?;

    let match_id = private["matchMap"].as_str().unwrap_or_default();
    if match_id.is_empty() {
        return Ok(None);
    }

    Ok(Some(CurrentMatch {
        match_id: private["matchMap"].as_str().unwrap_or_default().to_string(),
        map_id: private["matchMap"].as_str().unwrap_or_default().to_string(),
        queue_id: private["queueId"].as_str().unwrap_or_default().to_string(),
        is_ranked: private["competitiveTier"].as_u64().unwrap_or(0) > 0,
        players: Vec::new(),
    }))
}

fn resolve_map_name(map_url: &str) -> String {
    let codename = map_url.split('/').filter(|s| !s.is_empty()).last().unwrap_or("Unknown");
    match codename.to_lowercase().as_str() {
        "ascent" => "Ascent",
        "duality" => "Bind",
        "bonsai" => "Split",
        "triad" => "Haven",
        "port" => "Icebox",
        "foxtrot" => "Breeze",
        "canyon" => "Fracture",
        "pitt" => "Pearl",
        "jam" => "Lotus",
        "juliett" => "Sunset",
        "infinity" => "Abyss",
        "rook" => "Corrode",
        "delta" => "Drift",
        _ => codename,
    }.to_string()
}

pub async fn fetch_pregame(tokens: &AuthTokens, puuid: &str, region: &str, shard: &str) -> Option<PregameState> {
    let client = glz_client(tokens)?;

    let player_url = glz_url(region, shard, &format!("/pregame/v1/players/{}", puuid));
    let player_resp: Value = client.get(&player_url).send().await.ok()?.json().await.ok()?;
    let match_id = player_resp["MatchID"].as_str().filter(|s| !s.is_empty())?.to_string();

    let match_url = glz_url(region, shard, &format!("/pregame/v1/matches/{}", match_id));
    let match_resp: Value = client.get(&match_url).send().await.ok()?.json().await.ok()?;

    let map_id = match_resp["MapID"].as_str().unwrap_or_default().to_string();
    let map_name = resolve_map_name(&map_id);

    let mut locked = false;
    let mut locked_agent: Option<String> = None;

    if let Some(players) = match_resp["AllyTeam"]["Players"].as_array() {
        for p in players {
            if p["Subject"].as_str() == Some(puuid) {
                let char_id = p["CharacterID"].as_str().unwrap_or_default();
                let selection_state = p["CharacterSelectionState"].as_str().unwrap_or_default();
                if selection_state == "locked" && !char_id.is_empty() {
                    locked = true;
                    locked_agent = Some(char_id.to_string());
                }
                break;
            }
        }
    }

    Some(PregameState { match_id, map_id, map_name, locked, locked_agent })
}

pub async fn lock_agent(tokens: &AuthTokens, region: &str, shard: &str, match_id: &str, agent_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/pregame/v1/matches/{}/lock/{}", match_id, agent_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("lock failed: {}", resp.status()))
    }
}

pub async fn quit_pregame(tokens: &AuthTokens, region: &str, shard: &str, match_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/pregame/v1/matches/{}/quit", match_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("quit failed: {}", resp.status()))
    }
}

use std::sync::Mutex as StdMutex;
use once_cell::sync::Lazy;

static LIVE_MATCH_CACHE: Lazy<StdMutex<(String, std::collections::HashMap<String, (u32, u32, u32)>)>> =
    Lazy::new(|| StdMutex::new((String::new(), std::collections::HashMap::new())));

pub async fn fetch_live_match(tokens: &AuthTokens, puuid: &str, region: &str, shard: &str) -> Option<LiveMatch> {
    let client = glz_client(tokens)?;
    let pd = pd_client(tokens)?;

    let pregame_url = glz_url(region, shard, &format!("/pregame/v1/players/{}", puuid));
    let coregame_url = glz_url(region, shard, &format!("/core-game/v1/players/{}", puuid));

    let pregame_resp: Option<Value> = match client.get(&pregame_url).send().await {
        Ok(r) if r.status().is_success() => r.json().await.ok(),
        _ => None,
    };

    let coregame_resp: Option<Value> = match client.get(&coregame_url).send().await {
        Ok(r) if r.status().is_success() => r.json().await.ok(),
        _ => None,
    };

    let (match_id, phase) = if let Some(ref pg) = pregame_resp {
        if let Some(mid) = pg["MatchID"].as_str().filter(|s| !s.is_empty()) {
            (mid.to_string(), "pregame".to_string())
        } else if let Some(ref cg) = coregame_resp {
            if let Some(mid) = cg["MatchID"].as_str().filter(|s| !s.is_empty()) {
                (mid.to_string(), "ingame".to_string())
            } else { return None; }
        } else { return None; }
    } else if let Some(ref cg) = coregame_resp {
        if let Some(mid) = cg["MatchID"].as_str().filter(|s| !s.is_empty()) {
            (mid.to_string(), "ingame".to_string())
        } else { return None; }
    } else { return None; };

    let (map_id, queue_id, raw_players, my_team) = if phase == "pregame" {
        let match_url = glz_url(region, shard, &format!("/pregame/v1/matches/{}", match_id));
        let match_data: Value = client.get(&match_url).send().await.ok()?.json().await.ok()?;
        let map_id = match_data["MapID"].as_str().unwrap_or_default().to_string();
        let queue_id = match_data["QueueID"].as_str().unwrap_or_default().to_string();

        let mut players: Vec<(String, String, String, bool, u32, u32)> = Vec::new();
        let my_team_id = match_data["AllyTeam"]["TeamID"].as_str().unwrap_or("Blue").to_string();

        if let Some(ally_players) = match_data["AllyTeam"]["Players"].as_array() {
            for p in ally_players {
                let pid = p["Subject"].as_str().unwrap_or_default().to_string();
                let char_id = p["CharacterID"].as_str().unwrap_or_default().to_string();
                let incognito = p["PlayerIdentity"]["Incognito"].as_bool().unwrap_or(false);
                let level = p["PlayerIdentity"]["AccountLevel"].as_u64().unwrap_or(0) as u32;
                let tier = p["CompetitiveTier"].as_u64().unwrap_or(0) as u32;
                players.push((pid, char_id, my_team_id.clone(), incognito, level, tier));
            }
        }

        (map_id, queue_id, players, my_team_id)
    } else {
        let match_url = glz_url(region, shard, &format!("/core-game/v1/matches/{}", match_id));
        let match_data: Value = client.get(&match_url).send().await.ok()?.json().await.ok()?;
        let map_id = match_data["MapID"].as_str().unwrap_or_default().to_string();
        let queue_id = match_data["MatchmakingData"]["QueueID"].as_str().unwrap_or_default().to_string();

        let mut players: Vec<(String, String, String, bool, u32, u32)> = Vec::new();
        let mut my_team_id = "Blue".to_string();

        if let Some(all_players) = match_data["Players"].as_array() {
            for p in all_players {
                let pid = p["Subject"].as_str().unwrap_or_default().to_string();
                let char_id = p["CharacterID"].as_str().unwrap_or_default().to_string();
                let team_id = p["TeamID"].as_str().unwrap_or_default().to_string();
                let incognito = p["PlayerIdentity"]["Incognito"].as_bool().unwrap_or(false);
                let level = p["PlayerIdentity"]["AccountLevel"].as_u64().unwrap_or(0) as u32;
                let tier = p["CompetitiveTier"].as_u64().unwrap_or(0) as u32;
                if pid == puuid {
                    my_team_id = team_id.clone();
                }
                players.push((pid, char_id, team_id, incognito, level, tier));
            }
        }

        (map_id, queue_id, players, my_team_id)
    };

    let map_name = resolve_map_name(&map_id);

    let puuids: Vec<String> = raw_players.iter().map(|(pid, _, _, _, _, _)| pid.clone()).collect();

    let name_url = pd_url(shard, "/name-service/v2/players");
    let names: std::collections::HashMap<String, (String, String)> = match pd.put(&name_url)
        .json(&puuids)
        .send().await
    {
        Ok(resp) => {
            let arr: Vec<Value> = resp.json().await.unwrap_or_default();
            arr.iter().filter_map(|v| {
                let pid = v["Subject"].as_str()?.to_string();
                let name = v["GameName"].as_str().unwrap_or_default().to_string();
                let tag = v["TagLine"].as_str().unwrap_or_default().to_string();
                Some((pid, (name, tag)))
            }).collect()
        }
        Err(_) => std::collections::HashMap::new(),
    };

    let cached_mmr = {
        let cache = LIVE_MATCH_CACHE.lock().unwrap();
        if cache.0 == match_id {
            Some(cache.1.clone())
        } else {
            None
        }
    };

    let mmr_map = if let Some(cached) = cached_mmr {
        cached
    } else {
        let mut map = std::collections::HashMap::new();
        if let Some(mmr) = fetch_mmr(tokens, puuid, shard).await {
            map.insert(puuid.to_string(), (mmr.rank, mmr.rr, mmr.peak_rank));
        }
        for pid in &puuids {
            if pid == puuid { continue; }
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            if let Some(mmr) = fetch_mmr(tokens, pid, shard).await {
                map.insert(pid.clone(), (mmr.rank, mmr.rr, mmr.peak_rank));
            }
        }
        let mut cache = LIVE_MATCH_CACHE.lock().unwrap();
        *cache = (match_id.clone(), map.clone());
        map
    };

    let agents = fetch_agent_map().await;

    let mut ally_team: Vec<LiveMatchPlayer> = Vec::new();
    let mut enemy_team: Vec<LiveMatchPlayer> = Vec::new();

    for (_i, (pid, char_id, team_id, incognito, level, _tier)) in raw_players.iter().enumerate() {
        let (game_name, tag_line) = names.get(pid).cloned().unwrap_or_default();

        let (agent_name, agent_icon) = agents.get(char_id.as_str())
            .cloned()
            .unwrap_or(("Unknown".to_string(), String::new()));

        let (rank, rr, peak_rank) = mmr_map.get(pid).copied().unwrap_or((0, 0, 0));

        let player = LiveMatchPlayer {
            puuid: pid.clone(),
            game_name,
            tag_line,
            team_id: team_id.clone(),
            agent_id: char_id.clone(),
            agent_name,
            agent_icon,
            rank,
            rr,
            peak_rank,
            account_level: *level,
            incognito: *incognito,
            is_self: pid == puuid,
        };

        if team_id == &my_team {
            ally_team.push(player);
        } else {
            enemy_team.push(player);
        }
    }

    let ffa_queues = ["deathmatch"];
    let is_team_mode = !ffa_queues.contains(&queue_id.as_str());

    if !is_team_mode {
        ally_team.extend(enemy_team.drain(..));
    }

    ally_team.sort_by(|a, b| b.rank.cmp(&a.rank));
    enemy_team.sort_by(|a, b| b.rank.cmp(&a.rank));

    Some(LiveMatch {
        match_id,
        map_id,
        map_name,
        queue_id,
        phase,
        is_team_mode,
        ally_team,
        enemy_team,
    })
}

async fn fetch_agent_map() -> std::collections::HashMap<String, (String, String)> {
    let mut map = std::collections::HashMap::new();
    let resp: Value = match reqwest::get("https://valorant-api.com/v1/agents?isPlayableCharacter=true").await {
        Ok(r) => match r.json().await { Ok(v) => v, Err(_) => return map },
        Err(_) => return map,
    };
    if let Some(agents) = resp["data"].as_array() {
        for a in agents {
            let uuid = a["uuid"].as_str().unwrap_or_default().to_lowercase();
            let name = a["displayName"].as_str().unwrap_or_default().to_string();
            let icon = a["displayIcon"].as_str().unwrap_or_default().to_string();
            map.insert(uuid, (name, icon));
        }
    }
    map
}

pub async fn select_agent(tokens: &AuthTokens, region: &str, shard: &str, match_id: &str, agent_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/pregame/v1/matches/{}/select/{}", match_id, agent_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("select failed: {}", resp.status()))
    }
}

pub async fn fetch_party(tokens: &AuthTokens, puuid: &str, region: &str, shard: &str) -> Option<PartyState> {
    let client = glz_client(tokens)?;
    let pd = pd_client(tokens)?;

    let player_url = glz_url(region, shard, &format!("/parties/v1/players/{}", puuid));
    let player_resp: Value = client.get(&player_url).send().await.ok()?.json().await.ok()?;
    let party_id = player_resp["CurrentPartyID"].as_str().filter(|s| !s.is_empty())?.to_string();

    let party_url = glz_url(region, shard, &format!("/parties/v1/parties/{}", party_id));
    let party: Value = client.get(&party_url).send().await.ok()?.json().await.ok()?;

    let members_arr = party["Members"].as_array()?;
    let puuids: Vec<String> = members_arr.iter()
        .filter_map(|m| m["Subject"].as_str().map(|s| s.to_string()))
        .collect();

    let name_url = pd_url(shard, "/name-service/v2/players");
    let names: std::collections::HashMap<String, (String, String)> = match pd.put(&name_url)
        .json(&puuids)
        .send().await
    {
        Ok(resp) => {
            let arr: Vec<Value> = resp.json().await.unwrap_or_default();
            arr.iter().filter_map(|v| {
                let pid = v["Subject"].as_str()?.to_string();
                let name = v["GameName"].as_str().unwrap_or_default().to_string();
                let tag = v["TagLine"].as_str().unwrap_or_default().to_string();
                Some((pid, (name, tag)))
            }).collect()
        }
        Err(_) => std::collections::HashMap::new(),
    };

    let mut is_owner = false;
    let mut members: Vec<PartyMember> = Vec::new();

    for m in members_arr {
        let pid = m["Subject"].as_str().unwrap_or_default().to_string();
        let (game_name, tag_line) = names.get(&pid).cloned().unwrap_or_default();
        let owner = m["IsOwner"].as_bool().unwrap_or(false);
        if owner && pid == puuid {
            is_owner = true;
        }
        let ping = m["Pings"].as_array()
            .and_then(|pings| pings.first())
            .and_then(|p| p["Ping"].as_u64())
            .unwrap_or(0) as u32;

        members.push(PartyMember {
            puuid: pid,
            game_name,
            tag_line,
            rank: m["CompetitiveTier"].as_u64().unwrap_or(0) as u32,
            account_level: m["PlayerIdentity"]["AccountLevel"].as_u64().unwrap_or(0) as u32,
            player_card_id: m["PlayerIdentity"]["PlayerCardID"].as_str().unwrap_or_default().to_string(),
            is_owner: owner,
            is_ready: m["IsReady"].as_bool().unwrap_or(false),
            is_moderator: m["IsModerator"].as_bool().unwrap_or(false),
            ping,
        });
    }

    let queue_id = party["MatchmakingData"]["QueueID"].as_str().unwrap_or_default().to_string();
    let accessibility = party["Accessibility"].as_str().unwrap_or("CLOSED").to_string();
    let invite_code = party["InviteCode"].as_str().unwrap_or_default().to_string();
    let state = party["State"].as_str().unwrap_or("DEFAULT").to_string();

    let eligible_queues: Vec<String> = party["EligibleQueues"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let mut invites: Vec<PartyInvite> = Vec::new();
    if let Some(requests) = player_resp["Requests"].as_array() {
        let req_puuids: Vec<String> = requests.iter()
            .filter_map(|r| r["RequestedBySubject"].as_str().map(|s| s.to_string()))
            .collect();
        let req_names: std::collections::HashMap<String, (String, String)> = if !req_puuids.is_empty() {
            match pd.put(&name_url).json(&req_puuids).send().await {
                Ok(resp) => {
                    let arr: Vec<Value> = resp.json().await.unwrap_or_default();
                    arr.iter().filter_map(|v| {
                        let pid = v["Subject"].as_str()?.to_string();
                        let n = v["GameName"].as_str().unwrap_or_default().to_string();
                        let t = v["TagLine"].as_str().unwrap_or_default().to_string();
                        Some((pid, (n, t)))
                    }).collect()
                }
                Err(_) => std::collections::HashMap::new(),
            }
        } else { std::collections::HashMap::new() };

        for r in requests {
            let request_id = r["ID"].as_str().unwrap_or_default().to_string();
            let req_party_id = r["PartyID"].as_str().unwrap_or_default().to_string();
            let from_puuid = r["RequestedBySubject"].as_str().unwrap_or_default().to_string();
            let (from_name, from_tag) = req_names.get(&from_puuid).cloned().unwrap_or_default();
            invites.push(PartyInvite { request_id, party_id: req_party_id, from_puuid, from_name, from_tag });
        }
    }

    Some(PartyState {
        party_id,
        members,
        state,
        accessibility,
        queue_id,
        invite_code,
        is_owner,
        eligible_queues,
        invites,
    })
}

pub async fn party_invite(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, name: &str, tag: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/invites/name/{}/tag/{}", party_id, name, tag));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("invite failed: {}", resp.status())) }
}

pub async fn party_kick(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, target_puuid: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/members/{}", party_id, target_puuid));
    let resp = client.delete(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        println!("[party_kick] failed: {} — {}", status, body);
        Err(format!("kick failed: {}", status))
    }
}

pub async fn party_promote(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, target_puuid: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/members/{}/owner", party_id, target_puuid));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        println!("[party_promote] failed: {} — {}", status, body);
        Err(format!("promote failed: {}", status))
    }
}

pub async fn party_accept_invite(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, puuid: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/players/{}/joinparty/{}", puuid, party_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        println!("[party_accept] failed: {} — {}", status, body);
        Err(format!("accept failed: {}", status))
    }
}

pub async fn party_decline_invite(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, request_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/request/{}/decline", party_id, request_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        println!("[party_decline] failed: {} — {}", status, body);
        Err(format!("decline failed: {}", status))
    }
}

pub async fn party_set_accessibility(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, open: bool) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/accessibility", party_id));
    let body = serde_json::json!({ "accessibility": if open { "OPEN" } else { "CLOSED" } });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("accessibility failed: {}", resp.status())) }
}

pub async fn party_set_ready(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, puuid: &str, ready: bool) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/members/{}/setReady", party_id, puuid));
    let body = serde_json::json!({ "ready": ready });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("ready failed: {}", resp.status())) }
}

pub async fn party_start_queue(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/matchmaking/join", party_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("queue failed: {}", resp.status())) }
}

pub async fn party_leave_queue(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/matchmaking/leave", party_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("leave queue failed: {}", resp.status())) }
}

pub async fn fetch_friends(client: &Client, lock: &Lockfile) -> Vec<Friend> {
    let friends_url = format!("{}/chat/v4/friends", base_url(lock));
    let presences_url = format!("{}/chat/v4/presences", base_url(lock));

    let friends_resp: Value = match client.get(&friends_url).send().await {
        Ok(r) => r.json().await.unwrap_or_default(),
        Err(_) => return Vec::new(),
    };

    let presences_resp: Value = match client.get(&presences_url).send().await {
        Ok(r) => r.json().await.unwrap_or_default(),
        Err(_) => Value::Null,
    };

    let online_puuids: std::collections::HashSet<String> = presences_resp["presences"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter(|p| p["state"].as_str().unwrap_or("") != "offline")
                .filter_map(|p| p["puuid"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let presence_map: std::collections::HashMap<String, (String, String)> = presences_resp["presences"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|p| {
                    let pid = p["puuid"].as_str()?.to_string();
                    let state = p["state"].as_str().unwrap_or("offline").to_string();
                    let card_id = p["private"].as_str()
                        .and_then(|b64| BASE64.decode(b64).ok())
                        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
                        .and_then(|v| v["playerCardId"].as_str().map(|s| s.to_string()))
                        .unwrap_or_default();
                    Some((pid, (state, card_id)))
                })
                .collect()
        })
        .unwrap_or_default();

    let mut friends: Vec<Friend> = Vec::new();

    if let Some(arr) = friends_resp["friends"].as_array() {
        for f in arr {
            let puuid = f["puuid"].as_str().unwrap_or_default().to_string();
            let game_name = f["game_name"].as_str().unwrap_or_default().to_string();
            let tag_line = f["game_tag"].as_str().unwrap_or_default().to_string();
            if game_name.is_empty() { continue; }
            let is_online = online_puuids.contains(&puuid);
            let (status, player_card_id) = presence_map.get(&puuid).cloned().unwrap_or(("offline".to_string(), String::new()));
            friends.push(Friend { puuid, game_name, tag_line, is_online, status, player_card_id });
        }
    }

    friends.sort_by(|a, b| b.is_online.cmp(&a.is_online).then(a.game_name.to_lowercase().cmp(&b.game_name.to_lowercase())));
    friends
}

pub async fn party_generate_code(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str) -> Result<String, String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/invitecode", party_id));
    let resp = client.post(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        let body: Value = resp.json().await.unwrap_or_default();
        Ok(body["InviteCode"].as_str().unwrap_or_default().to_string())
    } else { Err(format!("generate code failed: {}", resp.status())) }
}

pub async fn party_disable_code(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/invitecode", party_id));
    let resp = client.delete(&url).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("disable code failed: {}", resp.status())) }
}

pub async fn party_set_queue(tokens: &AuthTokens, region: &str, shard: &str, party_id: &str, queue_id: &str) -> Result<(), String> {
    let client = glz_client(tokens).ok_or("no client")?;
    let url = glz_url(region, shard, &format!("/parties/v1/parties/{}/queue", party_id));
    let body = serde_json::json!({ "queueID": queue_id });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if resp.status().is_success() { Ok(()) } else { Err(format!("set queue failed: {}", resp.status())) }
}
