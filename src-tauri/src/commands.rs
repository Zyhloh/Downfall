use std::sync::Arc;
use tauri::State;
use crate::valorant::api;
use crate::valorant::connection::ValorantConnection;
use crate::valorant::types::{ConnectionState, PlayerProfile, AgentInfo, PregameState, CurrentMatch, LiveMatch, PartyState, Friend};
use crate::config;

#[tauri::command]
pub async fn get_connection_state(conn: State<'_, Arc<ValorantConnection>>) -> Result<ConnectionState, String> {
    Ok(conn.get_state().await)
}

#[tauri::command]
pub async fn get_player_profile(conn: State<'_, Arc<ValorantConnection>>) -> Result<PlayerProfile, String> {
    let state = conn.get_state().await;
    let info = state.player_info.ok_or("not connected")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;

    let account_xp = api::fetch_account_xp(&tokens, &info.puuid, &shard).await;
    let mmr = api::fetch_mmr(&tokens, &info.puuid, &shard).await;
    let comp_updates = api::fetch_comp_updates(&tokens, &info.puuid, &shard).await;

    Ok(PlayerProfile { info, account_xp, mmr, comp_updates })
}

#[tauri::command]
pub async fn get_agents(conn: State<'_, Arc<ValorantConnection>>) -> Result<Vec<AgentInfo>, String> {
    let state = conn.get_state().await;
    let info = state.player_info.ok_or("not connected")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    Ok(api::fetch_agents(&tokens, &info.puuid, &shard).await)
}

#[tauri::command]
pub async fn get_pregame_state(conn: State<'_, Arc<ValorantConnection>>) -> Result<Option<PregameState>, String> {
    let state = conn.get_state().await;
    let info = state.player_info.ok_or("not connected")?;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    Ok(api::fetch_pregame(&tokens, &info.puuid, &region, &shard).await)
}

#[tauri::command]
pub async fn instalock_agent(conn: State<'_, Arc<ValorantConnection>>, match_id: String, agent_id: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::select_agent(&tokens, &region, &shard, &match_id, &agent_id).await.ok();
    api::lock_agent(&tokens, &region, &shard, &match_id, &agent_id).await
}

#[tauri::command]
pub async fn dodge_match(conn: State<'_, Arc<ValorantConnection>>, match_id: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::quit_pregame(&tokens, &region, &shard, &match_id).await
}

#[tauri::command]
pub async fn get_live_match(conn: State<'_, Arc<ValorantConnection>>) -> Result<Option<LiveMatch>, String> {
    let state = conn.get_state().await;
    let puuid = state.player_info.as_ref().map(|i| i.puuid.clone()).ok_or("no puuid")?;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    Ok(api::fetch_live_match(&tokens, &puuid, &region, &shard).await)
}

#[tauri::command]
pub async fn get_party(conn: State<'_, Arc<ValorantConnection>>) -> Result<Option<PartyState>, String> {
    let state = conn.get_state().await;
    let puuid = state.player_info.as_ref().map(|i| i.puuid.clone()).ok_or("no puuid")?;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    Ok(api::fetch_party(&tokens, &puuid, &region, &shard).await)
}

#[tauri::command]
pub async fn party_invite(conn: State<'_, Arc<ValorantConnection>>, party_id: String, name: String, tag: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_invite(&tokens, &region, &shard, &party_id, &name, &tag).await
}

#[tauri::command]
pub async fn party_kick(conn: State<'_, Arc<ValorantConnection>>, party_id: String, target_puuid: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_kick(&tokens, &region, &shard, &party_id, &target_puuid).await
}

#[tauri::command]
pub async fn party_accept_invite(conn: State<'_, Arc<ValorantConnection>>, party_id: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let puuid = state.player_info.map(|p| p.puuid).ok_or("no puuid")?;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_accept_invite(&tokens, &region, &shard, &party_id, &puuid).await
}

#[tauri::command]
pub async fn party_decline_invite(conn: State<'_, Arc<ValorantConnection>>, party_id: String, request_id: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_decline_invite(&tokens, &region, &shard, &party_id, &request_id).await
}

#[tauri::command]
pub async fn party_promote(conn: State<'_, Arc<ValorantConnection>>, party_id: String, target_puuid: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_promote(&tokens, &region, &shard, &party_id, &target_puuid).await
}

#[tauri::command]
pub async fn party_set_accessibility(conn: State<'_, Arc<ValorantConnection>>, party_id: String, open: bool) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_set_accessibility(&tokens, &region, &shard, &party_id, open).await
}

#[tauri::command]
pub async fn party_set_ready(conn: State<'_, Arc<ValorantConnection>>, party_id: String, ready: bool) -> Result<(), String> {
    let state = conn.get_state().await;
    let puuid = state.player_info.as_ref().map(|i| i.puuid.clone()).ok_or("no puuid")?;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_set_ready(&tokens, &region, &shard, &party_id, &puuid, ready).await
}

#[tauri::command]
pub async fn party_queue(conn: State<'_, Arc<ValorantConnection>>, party_id: String, start: bool) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    if start {
        api::party_start_queue(&tokens, &region, &shard, &party_id).await
    } else {
        api::party_leave_queue(&tokens, &region, &shard, &party_id).await
    }
}

#[tauri::command]
pub async fn party_set_queue(conn: State<'_, Arc<ValorantConnection>>, party_id: String, queue_id: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_set_queue(&tokens, &region, &shard, &party_id, &queue_id).await
}

#[tauri::command]
pub async fn party_generate_code(conn: State<'_, Arc<ValorantConnection>>, party_id: String) -> Result<String, String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_generate_code(&tokens, &region, &shard, &party_id).await
}

#[tauri::command]
pub async fn party_disable_code(conn: State<'_, Arc<ValorantConnection>>, party_id: String) -> Result<(), String> {
    let state = conn.get_state().await;
    let region = state.region.ok_or("no region")?;
    let shard = state.shard.ok_or("no shard")?;
    let tokens = conn.get_tokens().await.ok_or("no auth tokens")?;
    api::party_disable_code(&tokens, &region, &shard, &party_id).await
}

#[tauri::command]
pub async fn get_friends(conn: State<'_, Arc<ValorantConnection>>) -> Result<Vec<Friend>, String> {
    let (client, lock) = conn.get_client_and_lock().await
        .ok_or_else(|| "not connected".to_string())?;
    Ok(api::fetch_friends(&client, &lock).await)
}

#[tauri::command]
pub async fn minimize_to_tray(window: tauri::WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())?;
    use tauri_plugin_notification::NotificationExt;
    let _ = app.notification()
        .builder()
        .title("Downfall")
        .body("Minimized to system tray")
        .show();
    Ok(())
}

#[tauri::command]
pub async fn load_config() -> Result<config::AppConfig, String> {
    Ok(config::load())
}

#[tauri::command]
pub async fn save_config(cfg: config::AppConfig) -> Result<(), String> {
    config::save(&cfg)
}

#[tauri::command]
pub async fn get_current_match(conn: State<'_, Arc<ValorantConnection>>) -> Result<Option<CurrentMatch>, String> {
    let (client, lock) = conn.get_client_and_lock().await
        .ok_or_else(|| "not connected".to_string())?;
    api::fetch_current_match(&client, &lock).await.map_err(|e| e.to_string())
}
