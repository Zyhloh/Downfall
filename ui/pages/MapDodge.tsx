import { Component, Show, For, createSignal, createEffect, on, onCleanup } from "solid-js";
import { getPregameState, dodgeMatch } from "@src/ipc/commands";
import type { ConnectionStatus, PregameState } from "@src/types/valorant";

interface MapDodgeProps {
  status: ConnectionStatus;
  active: boolean;
  onActiveChange: (v: boolean) => void;
  blacklist: string[];
  onBlacklistChange: (v: string[]) => void;
}

const COMP_MAPS: { name: string; uuid: string }[] = [
  { name: "Abyss", uuid: "224b0a95-48b9-f703-1bd8-67aca101a61f" },
  { name: "Ascent", uuid: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319" },
  { name: "Bind", uuid: "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba" },
  { name: "Breeze", uuid: "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53" },
  { name: "Corrode", uuid: "1c18ab1f-420d-0d8b-71d0-77ad3c439115" },
  { name: "Fracture", uuid: "b529448b-4d60-346e-e89e-00a4c527a405" },
  { name: "Haven", uuid: "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047" },
  { name: "Icebox", uuid: "e2ad5c54-4114-a870-9641-8ea21279579a" },
  { name: "Lotus", uuid: "2fe4ed3a-450a-948b-6d6b-e89a78e680a9" },
  { name: "Pearl", uuid: "fd267378-4d1d-484f-ff52-77821ed10dc2" },
  { name: "Split", uuid: "d960549e-485c-e861-8d71-aa9d1aed12a2" },
  { name: "Sunset", uuid: "92584fbe-486a-b1b2-9faa-39b0f486b498" },
];

const mapSplash = (uuid: string) =>
  `https://media.valorant-api.com/maps/${uuid}/splash.png`;

const mapImageCache = new Map<string, string>();

const preloadMapImages = async () => {
  for (const m of COMP_MAPS) {
    if (mapImageCache.has(m.uuid)) continue;
    try {
      const resp = await fetch(mapSplash(m.uuid));
      const blob = await resp.blob();
      mapImageCache.set(m.uuid, URL.createObjectURL(blob));
    } catch {}
  }
};

const cachedMapSplash = (uuid: string) => mapImageCache.get(uuid) || mapSplash(uuid);

const MapDodge: Component<MapDodgeProps> = (props) => {
  const blacklisted = () => new Set(props.blacklist);
  const [pregame, setPregame] = createSignal<PregameState | null>(null);
  const [dodgeStatus, setDodgeStatus] = createSignal<"idle" | "dodging" | "dodged">("idle");
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let hasDodgedThisMatch = "";

  createEffect(on(() => props.status, (status) => {
    if (status === "connected") preloadMapImages();
  }));

  const toggleMap = (name: string) => {
    const next = new Set(props.blacklist);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    props.onBlacklistChange([...next]);
  };

  const pollForDodge = async () => {
    if (props.status !== "connected" || !props.active) {
      setPregame(null);
      setDodgeStatus("idle");
      return;
    }

    try {
      const state = await getPregameState();
      setPregame(state);

      if (!state) {
        if (dodgeStatus() === "dodged") setDodgeStatus("idle");
        hasDodgedThisMatch = "";
        return;
      }

      if (hasDodgedThisMatch === state.matchId) return;

      if (blacklisted().has(state.mapName)) {
        setDodgeStatus("dodging");
        try {
          await dodgeMatch(state.matchId);
          hasDodgedThisMatch = state.matchId;
          setDodgeStatus("dodged");
        } catch {
          setDodgeStatus("idle");
        }
      }
    } catch {
      setPregame(null);
    }
  };

  createEffect(on([() => props.active, () => props.status], () => {
    if (pollInterval) clearInterval(pollInterval);
    if (props.active && props.status === "connected") {
      pollForDodge();
      pollInterval = setInterval(pollForDodge, 1500);
    } else {
      setPregame(null);
      setDodgeStatus("idle");
    }
  }));

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  return (
    <div class="mapdodge">
      <div class="md-header">
        <div class="md-header-left">
          <h1 class="md-title">Map Dodge</h1>
          <p class="md-desc">Automatically dodge blacklisted maps in agent select</p>
        </div>
        <div class="il-toggle-wrap">
          <span class={`il-toggle-label ${props.active ? "il-toggle-active" : ""}`}>
            {props.active ? "Active" : "Inactive"}
          </span>
          <button
            class={`il-toggle ${props.active ? "il-toggle-on" : ""}`}
            onClick={() => props.onActiveChange(!props.active)}
          >
            <div class="il-toggle-knob" />
          </button>
        </div>
      </div>

      <div class="md-info">
        <span class="md-blacklist-count">
          <Show when={blacklisted().size > 0} fallback="No maps blacklisted">
            <strong>{blacklisted().size}</strong> map{blacklisted().size !== 1 ? "s" : ""} blacklisted
          </Show>
        </span>
        <span class="md-hint">Click a map to toggle blacklist</span>
      </div>

      <div class="md-grid il-fade-in">
        <For each={COMP_MAPS}>
          {(m) => {
            const isBlacklisted = () => blacklisted().has(m.name);
            return (
              <button
                class={`md-map ${isBlacklisted() ? "md-map-blacklisted" : ""}`}
                onClick={() => toggleMap(m.name)}
              >
                <div class="md-map-img-wrap">
                  <img src={cachedMapSplash(m.uuid)} class="md-map-img" alt="" loading="lazy" />
                  <Show when={isBlacklisted()}>
                    <div class="md-map-overlay">
                      <div class="md-map-x">✕</div>
                    </div>
                  </Show>
                </div>
                <span class={`md-map-name ${isBlacklisted() ? "md-map-name-blocked" : ""}`}>{m.name}</span>
              </button>
            );
          }}
        </For>
      </div>

      <div class="il-status-banner">
        <div class={`il-status-dot ${
          !props.active ? "il-status-dot-inactive" :
          dodgeStatus() === "dodged" ? "il-status-dot-locked" :
          dodgeStatus() === "dodging" ? "il-status-dot-locking" :
          pregame() ? "il-status-dot-locking" :
          "il-status-dot-waiting"
        }`} />
        <span class="il-status-text">
          <Show when={!props.active}>Map dodge is inactive</Show>
          <Show when={props.active && blacklisted().size === 0 && !pregame()}>No maps blacklisted</Show>
          <Show when={props.active && blacklisted().size > 0 && dodgeStatus() === "idle" && !pregame()}>
            Waiting for match — dodging {blacklisted().size} map{blacklisted().size !== 1 ? "s" : ""}
          </Show>
          <Show when={props.active && dodgeStatus() === "dodging"}>
            Dodging <span class="il-status-agent">{pregame()?.mapName}</span>...
          </Show>
          <Show when={props.active && dodgeStatus() === "dodged"}>
            Dodged <span class="il-status-agent">{pregame()?.mapName}</span>
          </Show>
          <Show when={props.active && dodgeStatus() === "idle" && pregame() && !blacklisted().has(pregame()!.mapName)}>
            In agent select on <span class="il-status-agent">{pregame()!.mapName}</span> — safe map
          </Show>
        </span>
      </div>
    </div>
  );
};

export default MapDodge;
