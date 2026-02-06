use std::sync::Arc;
use tokio::sync::Mutex;
use reqwest::Client;
use super::lockfile;
use super::api;
use super::types::{ConnectionState, ConnectionStatus, Lockfile, AuthTokens};

pub struct ValorantConnection {
    pub state: Arc<Mutex<ConnectionState>>,
    client: Arc<Mutex<Option<Client>>>,
    lockfile: Arc<Mutex<Option<Lockfile>>>,
    tokens: Arc<Mutex<Option<AuthTokens>>>,
}

impl ValorantConnection {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(ConnectionState {
                status: ConnectionStatus::Disconnected,
                player_info: None,
                region: None,
                shard: None,
            })),
            client: Arc::new(Mutex::new(None)),
            lockfile: Arc::new(Mutex::new(None)),
            tokens: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn try_connect(&self) -> bool {
        {
            let mut state = self.state.lock().await;
            state.status = ConnectionStatus::Connecting;
        }

        let lock = match lockfile::read() {
            Ok(l) => l,
            Err(_) => {
                self.disconnect().await;
                return false;
            }
        };

        let client = match api::build_client(&lock) {
            Ok(c) => c,
            Err(_) => {
                self.disconnect().await;
                return false;
            }
        };

        let mut info = match api::fetch_player_info(&client, &lock).await {
            Ok(i) => i,
            Err(_) => {
                self.disconnect().await;
                return false;
            }
        };

        let region_info = match api::fetch_region(&client, &lock).await {
            Ok(r) => r,
            Err(_) => {
                self.disconnect().await;
                return false;
            }
        };

        let auth = api::fetch_auth_tokens(&client, &lock).await.ok();

        if let Some(ref tokens) = auth {
            if let Some(card_id) = api::fetch_player_card_id(tokens, &info.puuid, &region_info.shard).await {
                info.player_card_id = Some(card_id);
            }
        }

        {
            let mut state = self.state.lock().await;
            state.status = ConnectionStatus::Connected;
            state.player_info = Some(info);
            state.region = Some(region_info.region);
            state.shard = Some(region_info.shard);
        }
        {
            let mut c = self.client.lock().await;
            *c = Some(client);
        }
        {
            let mut l = self.lockfile.lock().await;
            *l = Some(lock);
        }
        {
            let mut t = self.tokens.lock().await;
            *t = auth;
        }

        true
    }

    pub async fn health_check(&self) -> bool {
        let (c, l) = {
            let client = self.client.lock().await;
            let lock = self.lockfile.lock().await;
            match (client.clone(), lock.clone()) {
                (Some(c), Some(l)) => (c, l),
                _ => return false,
            }
        };

        if api::fetch_player_info(&c, &l).await.is_err() {
            return false;
        }

        if let Ok(new_tokens) = api::fetch_auth_tokens(&c, &l).await {
            let mut t = self.tokens.lock().await;
            *t = Some(new_tokens);
        }

        let tokens = self.tokens.lock().await.clone();
        let mut state = self.state.lock().await;
        if let (Some(ref info), Some(ref tkn)) = (&state.player_info, &tokens) {
            if info.player_card_id.is_none() {
                let shard = state.shard.clone().unwrap_or_else(|| "na".to_string());
                if let Some(card_id) = api::fetch_player_card_id(tkn, &info.puuid, &shard).await {
                    let mut updated = info.clone();
                    updated.player_card_id = Some(card_id);
                    state.player_info = Some(updated);
                }
            }
        }

        true
    }

    pub async fn disconnect(&self) {
        let mut state = self.state.lock().await;
        state.status = ConnectionStatus::Disconnected;
        state.player_info = None;
        state.region = None;
        state.shard = None;
        let mut t = self.tokens.lock().await;
        *t = None;
    }

    pub async fn get_state(&self) -> ConnectionState {
        self.state.lock().await.clone()
    }

    pub async fn get_client_and_lock(&self) -> Option<(Client, Lockfile)> {
        let client = self.client.lock().await;
        let lock = self.lockfile.lock().await;
        match (client.as_ref(), lock.as_ref()) {
            (Some(c), Some(l)) => Some((c.clone(), l.clone())),
            _ => None,
        }
    }

    pub async fn get_tokens(&self) -> Option<AuthTokens> {
        self.tokens.lock().await.clone()
    }
}
