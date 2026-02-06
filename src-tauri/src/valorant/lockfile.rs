use std::fs;
use std::env;
use super::types::Lockfile;

pub fn read() -> Result<Lockfile, Box<dyn std::error::Error + Send + Sync>> {
    let local_app_data = env::var("LOCALAPPDATA")?;
    let path = format!("{}\\Riot Games\\Riot Client\\Config\\lockfile", local_app_data);
    let contents = fs::read_to_string(&path)?;
    parse(&contents)
}

fn parse(raw: &str) -> Result<Lockfile, Box<dyn std::error::Error + Send + Sync>> {
    let parts: Vec<&str> = raw.trim().split(':').collect();
    if parts.len() < 5 {
        return Err("invalid lockfile format".into());
    }

    Ok(Lockfile {
        name: parts[0].to_string(),
        pid: parts[1].parse()?,
        port: parts[2].parse()?,
        password: parts[3].to_string(),
        protocol: parts[4].to_string(),
    })
}
