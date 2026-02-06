use std::sync::Mutex;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

const CLIENT_ID: &str = "1469360807132528660";

static RPC_CLIENT: once_cell::sync::Lazy<Mutex<Option<DiscordIpcClient>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

static RPC_CONNECTED: once_cell::sync::Lazy<Mutex<bool>> =
    once_cell::sync::Lazy::new(|| Mutex::new(false));

pub fn connect() {
    let mut client_lock = RPC_CLIENT.lock().unwrap();
    let mut connected = RPC_CONNECTED.lock().unwrap();

    if *connected {
        return;
    }

    let mut client = DiscordIpcClient::new(CLIENT_ID);
    if client.connect().is_ok() {
        *connected = true;
        *client_lock = Some(client);
    }
}

pub fn disconnect() {
    let mut client_lock = RPC_CLIENT.lock().unwrap();
    let mut connected = RPC_CONNECTED.lock().unwrap();

    if let Some(ref mut client) = *client_lock {
        let _ = client.close();
    }
    *client_lock = None;
    *connected = false;
}

pub fn update_presence(details: &str, state: &str) {
    let mut client_lock = RPC_CLIENT.lock().unwrap();
    let connected = RPC_CONNECTED.lock().unwrap();

    if !*connected {
        return;
    }

    if let Some(ref mut client) = *client_lock {
        let buttons = vec![
            activity::Button::new("View Github", "https://github.com/Zyhloh/Downfall"),
            activity::Button::new("Join Discord", "https://discord.gg/sypg8uaDBX"),
        ];

        let mut payload = activity::Activity::new()
            .assets(
                activity::Assets::new()
                    .large_image("downfall")
                    .large_text("Downfall"),
            )
            .buttons(buttons);

        if !details.is_empty() {
            payload = payload.details(details);
        }
        if !state.is_empty() {
            payload = payload.state(state);
        }

        let _ = client.set_activity(payload);
    }
}

pub fn is_connected() -> bool {
    *RPC_CONNECTED.lock().unwrap()
}
