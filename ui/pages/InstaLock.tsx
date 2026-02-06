import { Component, Show, For, createSignal, createEffect, on, onCleanup } from "solid-js";
import { getAgents, getPregameState, instalockAgent } from "@src/ipc/commands";
import type { ConnectionStatus, AgentInfo, PregameState } from "@src/types/valorant";
import type { InstalockTiming } from "./Settings";

interface InstaLockProps {
  status: ConnectionStatus;
  instalockTiming: InstalockTiming;
  active: boolean;
  onActiveChange: (v: boolean) => void;
  selectedAgent: string | null;
  onAgentChange: (v: string | null) => void;
  mapOverrides: Record<string, string>;
  onOverridesChange: (v: Record<string, string>) => void;
  configLoaded: boolean;
}

const ROLE_ORDER: Record<string, number> = {
  "Duelist": 0,
  "Initiator": 1,
  "Controller": 2,
  "Sentinel": 3,
};

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
  `https://media.valorant-api.com/maps/${uuid}/listviewicontall.png`;

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

const InstaLock: Component<InstaLockProps> = (props) => {
  const [agents, setAgents] = createSignal<AgentInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [filterRole, setFilterRole] = createSignal<string | null>(null);
  const [tab, setTab] = createSignal<"all" | "permap">("all");
  const [editingMap, setEditingMap] = createSignal<string | null>(null);
  const [pregame, setPregame] = createSignal<PregameState | null>(null);
  const [lockStatus, setLockStatus] = createSignal<"idle" | "locking" | "locked">("idle");
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let hasLockedThisMatch = "";

  let agentPollInterval: ReturnType<typeof setInterval> | null = null;

  const refreshAgents = () => {
    getAgents().then(setAgents).catch(() => {});
  };

  createEffect(on(() => props.status, (status) => {
    if (agentPollInterval) clearInterval(agentPollInterval);
    if (status === "connected") {
      setLoading(true);
      getAgents()
        .then(setAgents)
        .catch(() => setAgents([]))
        .finally(() => setLoading(false));
      agentPollInterval = setInterval(refreshAgents, 5000);
      preloadMapImages();
    } else {
      setAgents([]);
    }
  }));

  const getAgentForMap = (mapName: string): string | null => {
    const overrides = props.mapOverrides;
    if (overrides[mapName]) return overrides[mapName];
    return props.selectedAgent;
  };

  const pollPregame = async () => {
    if (props.status !== "connected" || !props.active) {
      setPregame(null);
      setLockStatus("idle");
      return;
    }

    try {
      const state = await getPregameState();
      setPregame(state);

      if (!state) {
        if (lockStatus() === "locked") setLockStatus("idle");
        hasLockedThisMatch = "";
        return;
      }

      if (state.locked) {
        setLockStatus("locked");
        return;
      }

      if (hasLockedThisMatch === state.matchId) return;

      const agentId = getAgentForMap(state.mapName);
      if (!agentId) return;

      setLockStatus("locking");
      const timing = props.instalockTiming;
      const selDelay = timing.preset === "humanized" ? 400 + Math.random() * 800 : timing.selectDelay;
      const lckDelay = timing.preset === "humanized" ? 200 + Math.random() * 600 : timing.lockDelay;
      try {
        if (selDelay > 0) {
          await new Promise(r => setTimeout(r, selDelay));
        }
        await instalockAgent(state.matchId, agentId);
        if (lckDelay > 0) {
          await new Promise(r => setTimeout(r, lckDelay));
        }
        hasLockedThisMatch = state.matchId;
        setLockStatus("locked");
      } catch {
        setLockStatus("idle");
      }
    } catch {
      setPregame(null);
    }
  };

  createEffect(on([() => props.active, () => props.status], () => {
    if (pollInterval) clearInterval(pollInterval);
    if (props.active && props.status === "connected") {
      pollPregame();
      pollInterval = setInterval(pollPregame, 1500);
    } else {
      setPregame(null);
      setLockStatus("idle");
    }
  }));

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (agentPollInterval) clearInterval(agentPollInterval);
  });

  const roles = () => {
    const seen = new Set<string>();
    return agents()
      .map(a => a.role)
      .filter(r => { if (seen.has(r)) return false; seen.add(r); return true; })
      .sort((a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99));
  };

  const filtered = () => {
    const role = filterRole();
    const list = role ? agents().filter(a => a.role === role) : agents();
    return list.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  };

  const selectedAgent = () => agents().find(a => a.uuid === props.selectedAgent);
  const agentByUuid = (uuid: string) => agents().find(a => a.uuid === uuid);

  createEffect(on(() => agents(), (list) => {
    if (!props.configLoaded || list.length === 0) return;
    if (props.selectedAgent && !list.find(a => a.uuid === props.selectedAgent && a.unlocked)) {
      props.onAgentChange(null);
    }
    const overrides = { ...props.mapOverrides };
    let changed = false;
    for (const [map, agentId] of Object.entries(overrides)) {
      if (!list.find(a => a.uuid === agentId && a.unlocked)) {
        delete overrides[map];
        changed = true;
      }
    }
    if (changed) props.onOverridesChange(overrides);
  }));

  const handleSelect = (agent: AgentInfo) => {
    if (!agent.unlocked) return;
    const editing = editingMap();
    if (editing) {
      props.onOverridesChange({ ...props.mapOverrides, [editing]: agent.uuid });
      setEditingMap(null);
    } else {
      props.onAgentChange(props.selectedAgent === agent.uuid ? null : agent.uuid);
    }
  };

  const clearMapOverride = (map: string) => {
    const next = { ...props.mapOverrides };
    delete next[map];
    props.onOverridesChange(next);
  };

  const hasAnyAgent = () => !!props.selectedAgent || Object.keys(props.mapOverrides).length > 0;

  const getMapAgent = (map: string) => {
    const perMap = props.mapOverrides[map];
    const def = selectedAgent();
    if (perMap) {
      return { agent: agentByUuid(perMap), isOverride: !!def, isPerMap: true };
    }
    return { agent: def, isOverride: false, isPerMap: false };
  };

  return (
    <div class="instalock">
      <Show when={props.status === "connected" && !loading()} fallback={
        <div class="dash-empty">
          <div class="dash-spinner" />
          <Show when={props.status !== "connected"}>
            <h2>Waiting for Valorant</h2>
            <p>Connect to Valorant to configure instalock</p>
          </Show>
          <Show when={props.status === "connected" && loading()}>
            <h2>Loading Agents</h2>
            <p>Fetching your agent collection...</p>
          </Show>
        </div>
      }>
        <div class="il-header">
          <div class="il-header-left">
            <h1 class="il-title">Insta Lock</h1>
            <p class="il-desc">Automatically lock your agent in agent select</p>
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

        <div class="il-tabs">
          <button class={`il-tab ${tab() === "all" ? "il-tab-active" : ""}`} onClick={() => { setTab("all"); setEditingMap(null); }}>
            All Maps
          </button>
          <button class={`il-tab ${tab() === "permap" ? "il-tab-active" : ""}`} onClick={() => { setTab("permap"); setEditingMap(null); }}>
            Per Map
          </button>
        </div>

        <Show when={tab() === "all"}>
          <div class="il-filters il-fade-in">
            <button
              class={`il-filter-btn ${filterRole() === null ? "il-filter-active" : ""}`}
              onClick={() => setFilterRole(null)}
            >
              All
            </button>
            <For each={roles()}>
              {(role) => (
                <button
                  class={`il-filter-btn ${filterRole() === role ? "il-filter-active" : ""}`}
                  onClick={() => setFilterRole(prev => prev === role ? null : role)}
                >
                  {role}
                </button>
              )}
            </For>
          </div>

          <div class="il-grid il-fade-in">
            <For each={filtered()}>
              {(agent) => (
                <button
                  class={`il-agent ${!agent.unlocked ? "il-agent-locked" : ""} ${props.selectedAgent === agent.uuid ? "il-agent-selected" : ""}`}
                  onClick={() => handleSelect(agent)}
                  disabled={!agent.unlocked}
                >
                  <div class="il-agent-img-wrap">
                    <img src={agent.icon} class="il-agent-img" alt="" />
                    <Show when={!agent.unlocked}>
                      <div class="il-agent-lock-overlay" />
                    </Show>
                  </div>
                  <span class="il-agent-name">{agent.name}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={tab() === "permap"}>
          <Show when={editingMap()}>
            {(map) => (
              <div class="il-fade-in">
                <div class="il-permap-header">
                  <p class="il-permap-hint">Select agent for <strong>{map()}</strong></p>
                  <button class="il-filter-btn" onClick={() => setEditingMap(null)}>Back</button>
                </div>
                <div class="il-grid" style={{ "margin-top": "10px" }}>
                  <For each={agents().filter(a => a.unlocked).sort((a, b) => a.name.localeCompare(b.name))}>
                    {(agent) => (
                      <button
                        class={`il-agent ${props.mapOverrides[map()] === agent.uuid ? "il-agent-selected" : ""}`}
                        onClick={() => handleSelect(agent)}
                      >
                        <div class="il-agent-img-wrap">
                          <img src={agent.icon} class="il-agent-img" alt="" />
                        </div>
                        <span class="il-agent-name">{agent.name}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            )}
          </Show>

          <Show when={!editingMap()}>
            <div class="il-fade-in">
              <div class="il-permap-header">
                <p class="il-permap-hint">Click a map to override its agent</p>
                <Show when={selectedAgent()}>
                  <span class="il-permap-default">Default: {selectedAgent()!.name}</span>
                </Show>
              </div>
              <div class="il-map-grid" style={{ "margin-top": "10px" }}>
                <For each={COMP_MAPS}>
                  {(m) => {
                    const info = () => getMapAgent(m.name);
                    return (
                      <div
                        class={`il-map-card ${info().isPerMap ? "il-map-card-active" : ""}`}
                        onClick={() => setEditingMap(m.name)}
                        style={{ "background-image": `linear-gradient(to right, rgba(15,15,20,0.92) 40%, rgba(15,15,20,0.5)), url(${cachedMapSplash(m.uuid)})` }}
                      >
                        <div class="il-map-info">
                          <div class="il-map-name">{m.name}</div>
                          <div class={`il-map-agent-name ${info().isPerMap ? "il-map-override" : ""}`}>
                            {info().agent ? info().agent!.name : "No agent set"}
                            {info().isPerMap && info().isOverride ? " (override)" : info().isPerMap ? "" : info().agent ? " (default)" : ""}
                          </div>
                        </div>
                        <Show when={info().agent}>
                          <img src={info().agent!.icon} class="il-map-agent-icon" alt="" />
                        </Show>
                        <Show when={info().isPerMap}>
                          <button class="il-map-clear" onClick={(e) => { e.stopPropagation(); clearMapOverride(m.name); }}>Reset</button>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </Show>

        <div class="il-status-banner">
          <div class={`il-status-dot ${
            !props.active ? "il-status-dot-inactive" :
            lockStatus() === "locked" ? "il-status-dot-locked" :
            lockStatus() === "locking" ? "il-status-dot-locking" :
            pregame() ? "il-status-dot-locking" :
            "il-status-dot-waiting"
          }`} />
          <span class="il-status-text">
            <Show when={!props.active}>Instalock is inactive</Show>
            <Show when={props.active && !hasAnyAgent() && !pregame()}>No agent selected</Show>
            <Show when={props.active && lockStatus() === "locked"}>
              Agent locked{pregame()?.mapName ? ` on ${pregame()!.mapName}` : ""}
              {(() => {
                const a = pregame()?.lockedAgent ? agents().find(x => x.uuid === pregame()!.lockedAgent) : null;
                return a ? <> as <span class="il-status-agent">{a.name}</span></> : null;
              })()}
            </Show>
            <Show when={props.active && lockStatus() === "locking"}>
              Locking agent{pregame()?.mapName ? ` on ${pregame()!.mapName}` : ""}...
            </Show>
            <Show when={props.active && hasAnyAgent() && lockStatus() === "idle" && !pregame()}>
              Waiting for match{props.selectedAgent ? <> — will lock <span class="il-status-agent">{selectedAgent()?.name}</span></> : <> — per-map agents configured</>}
            </Show>
            <Show when={props.active && hasAnyAgent() && lockStatus() === "idle" && pregame() && !pregame()!.locked}>
              In agent select on <span class="il-status-agent">{pregame()!.mapName}</span>
              {(() => {
                const a = getAgentForMap(pregame()!.mapName);
                return a ? <> — will lock {agents().find(x => x.uuid === a)?.name}</> : <> — no agent for this map</>;
              })()}
            </Show>
          </span>
        </div>
      </Show>
    </div>
  );
};

export default InstaLock;
