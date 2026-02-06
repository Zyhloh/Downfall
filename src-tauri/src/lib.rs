mod valorant;
mod commands;
mod config;
mod discord;

use std::sync::Arc;
use commands::{get_connection_state, get_player_profile, get_agents, get_pregame_state, instalock_agent, dodge_match, get_live_match, get_party, party_invite, party_kick, party_accept_invite, party_decline_invite, party_promote, party_set_accessibility, party_set_ready, party_queue, party_set_queue, party_generate_code, party_disable_code, get_friends, minimize_to_tray, load_config, save_config, get_current_match};
use valorant::connection::ValorantConnection;
use valorant::types::ConnectionStatus;
use tauri::{image::Image, Manager};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_notification::NotificationExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let connection = Arc::new(ValorantConnection::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(connection.clone())
        .invoke_handler(tauri::generate_handler![
            get_connection_state,
            get_player_profile,
            get_agents,
            get_pregame_state,
            instalock_agent,
            dodge_match,
            get_live_match,
            get_party,
            party_invite,
            party_kick,
            party_accept_invite,
            party_decline_invite,
            party_promote,
            party_set_accessibility,
            party_set_ready,
            party_queue,
            party_set_queue,
            party_generate_code,
            party_disable_code,
            get_friends,
            minimize_to_tray,
            load_config,
            save_config,
            get_current_match,
        ])
        .setup(move |app| {
            let png = image::load_from_memory(include_bytes!("../icons/downfall.png"))
                .expect("failed to load icon")
                .to_rgba8();
            let (w, h) = png.dimensions();
            let icon = Image::new_owned(png.into_raw(), w, h);
            let window = app.get_webview_window("main").unwrap();
            window.set_icon(icon.clone())?;

            let app_handle = app.handle().clone();
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("Downfall")
                .on_tray_icon_event(move |_tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            let cfg = config::load();
            if cfg.app.start_minimized {
                let _ = window.hide();
                let _ = app.notification()
                    .builder()
                    .title("Downfall")
                    .body("Started minimized to system tray")
                    .show();
            }

            if cfg.discord.enabled {
                std::thread::spawn(move || {
                    discord::connect();
                    if discord::is_connected() {
                        discord::update_presence(&cfg.discord.details, &cfg.discord.state);
                    }
                });
            }

            let conn = connection.clone();
            tauri::async_runtime::spawn(async move {
                let mut rpc_tick: u32 = 0;
                loop {
                    let state = conn.get_state().await;
                    match state.status {
                        ConnectionStatus::Connected => {
                            if !conn.health_check().await {
                                conn.disconnect().await;
                            }
                        }
                        _ => {
                            conn.try_connect().await;
                        }
                    }

                    rpc_tick += 1;
                    if rpc_tick % 10 == 0 {
                        let rpc_cfg = config::load().discord;
                        tokio::task::spawn_blocking(move || {
                            if rpc_cfg.enabled {
                                if !discord::is_connected() {
                                    discord::connect();
                                }
                                discord::update_presence(&rpc_cfg.details, &rpc_cfg.state);
                            } else if discord::is_connected() {
                                discord::disconnect();
                            }
                        });
                    }

                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run downfall");
}
