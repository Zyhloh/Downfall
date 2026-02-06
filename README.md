<div align="center">

<img src="src-tauri/icons/downfall.png" width="80" />

# Downfall

A desktop companion app for Valorant built with Tauri, SolidJS, and Rust.

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/sypg8uaDBX)
[![GitHub](https://img.shields.io/badge/GitHub-Zyhloh-181717?style=flat&logo=github)](https://github.com/Zyhloh/Downfall)

</div>

---

## About

Downfall is a lightweight Valorant tool that interfaces with the local game client API. It runs alongside Valorant and provides automation, party management, live match intel, and more — all through a clean native desktop app.

## Features

**Instalock** — Automatically select and lock your agent the instant a match starts. Supports per-map agent overrides and configurable timing presets (instant, humanized, or custom delays).

**Map Dodge** — Blacklist maps you don't want to play. When a match loads on a blacklisted map, the app automatically dodges for you.

**Live Match** — View detailed information about your current match including player ranks, agents, levels, and team compositions.

**Party Management** — Full party controls without alt-tabbing. Invite friends, kick members, promote to leader, toggle open/closed party, generate invite codes, accept or decline incoming invites, and switch game modes.

**Discord Rich Presence** — Show your Downfall activity on Discord with customizable text and buttons linking to the project.

**System Tray** — Optionally minimize to the system tray on close and start minimized. The app continues running all automation in the background.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | SolidJS, TypeScript, Vite |
| Backend | Rust, Tauri 2 |
| Styling | Vanilla CSS |
| API | Valorant Local Client API |

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Setup

```
git clone https://github.com/Zyhloh/Downfall.git
cd Downfall
npm install
```

### Development

```
npm run tauri dev
```

### Production Build

```
npm run tauri build
```

The installer will be output to `src-tauri/target/release/bundle/nsis/`.

## Project Structure

```
Downfall/
├── src/                  # Frontend logic
│   ├── hooks/            # SolidJS hooks
│   ├── ipc/              # Tauri IPC commands
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── ui/                   # UI layer
│   ├── assets/           # Static assets
│   ├── components/       # Reusable components
│   ├── pages/            # Page views
│   └── styles/           # Global CSS
└── src-tauri/            # Rust backend
    ├── src/
    │   ├── valorant/     # API client, types, connection
    │   ├── commands.rs   # Tauri IPC handlers
    │   ├── config.rs     # App configuration
    │   ├── discord.rs    # Discord RPC
    │   └── lib.rs        # App entry point
    ├── icons/            # App icons
    └── capabilities/     # Tauri permissions
```

## Configuration

Settings are stored in `downfall_config.json` next to the executable. All configuration is managed through the in-app Settings page — no manual editing required.

## License

This project is provided as-is for educational purposes.
