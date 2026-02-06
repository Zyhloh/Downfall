use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub instalock: InstalockConfig,
    #[serde(default)]
    pub map_dodge: MapDodgeConfig,
    #[serde(default)]
    pub timing: TimingConfig,
    #[serde(default)]
    pub app: AppBehaviorConfig,
    #[serde(default)]
    pub discord: DiscordRpcConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalockConfig {
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub default_agent: Option<String>,
    #[serde(default)]
    pub map_overrides: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapDodgeConfig {
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub blacklisted_maps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingConfig {
    #[serde(default = "default_preset")]
    pub preset: String,
    #[serde(default)]
    pub select_delay: u32,
    #[serde(default)]
    pub lock_delay: u32,
}

fn default_preset() -> String {
    "instant".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            instalock: InstalockConfig::default(),
            map_dodge: MapDodgeConfig::default(),
            timing: TimingConfig::default(),
            app: AppBehaviorConfig::default(),
            discord: DiscordRpcConfig::default(),
        }
    }
}

impl Default for InstalockConfig {
    fn default() -> Self {
        Self {
            active: false,
            default_agent: None,
            map_overrides: HashMap::new(),
        }
    }
}

impl Default for MapDodgeConfig {
    fn default() -> Self {
        Self {
            active: false,
            blacklisted_maps: Vec::new(),
        }
    }
}

impl Default for TimingConfig {
    fn default() -> Self {
        Self {
            preset: "instant".to_string(),
            select_delay: 0,
            lock_delay: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBehaviorConfig {
    #[serde(default)]
    pub minimize_on_close: bool,
    #[serde(default)]
    pub start_minimized: bool,
}

impl Default for AppBehaviorConfig {
    fn default() -> Self {
        Self {
            minimize_on_close: false,
            start_minimized: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordRpcConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_rpc_text")]
    pub details: String,
    #[serde(default)]
    pub state: String,
}

fn default_true() -> bool { true }
fn default_rpc_text() -> String { "Playing Valorant with Downfall".to_string() }

impl Default for DiscordRpcConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            details: "Playing Valorant with Downfall".to_string(),
            state: String::new(),
        }
    }
}

fn config_path() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    exe.parent().unwrap_or(&PathBuf::from(".")).join("downfall_config.json")
}

pub fn load() -> AppConfig {
    let path = config_path();
    match std::fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())
}
