import { Component, createSignal, Switch, Match, onMount } from "solid-js";
import { useValorant } from "@src/hooks/useValorant";
import { loadConfig, saveConfig } from "@src/ipc/commands";
import type { AppConfig } from "@src/ipc/commands";
import Titlebar from "./components/Titlebar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import InstaLock from "./pages/InstaLock";
import MapDodge from "./pages/MapDodge";
import LiveMatch from "./pages/LiveMatch";
import Party from "./pages/Party";
import Settings from "./pages/Settings";
import type { InstalockTiming } from "./pages/Settings";

const App: Component = () => {
  const { status, playerInfo } = useValorant();
  const [activeTab, setActiveTab] = createSignal("dashboard");
  const [instalockTiming, setInstalockTiming] = createSignal<InstalockTiming>({
    preset: "instant",
    selectDelay: 0,
    lockDelay: 0,
  });
  const [instalockActive, setInstalockActive] = createSignal(false);
  const [instalockAgent, setInstalockAgent] = createSignal<string | null>(null);
  const [instalockOverrides, setInstalockOverrides] = createSignal<Record<string, string>>({});
  const [dodgeActive, setDodgeActive] = createSignal(false);
  const [dodgeBlacklist, setDodgeBlacklist] = createSignal<string[]>([]);
  const [minimizeOnClose, setMinimizeOnClose] = createSignal(false);
  const [startMinimized, setStartMinimized] = createSignal(false);
  const [discordEnabled, setDiscordEnabled] = createSignal(true);
  const [discordDetails, setDiscordDetails] = createSignal("Playing Valorant with Downfall");
  const [discordState, setDiscordState] = createSignal("");
  const [configLoaded, setConfigLoaded] = createSignal(false);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const buildConfig = (): AppConfig => ({
    instalock: {
      active: instalockActive(),
      defaultAgent: instalockAgent(),
      mapOverrides: instalockOverrides(),
    },
    mapDodge: {
      active: dodgeActive(),
      blacklistedMaps: dodgeBlacklist(),
    },
    timing: {
      preset: instalockTiming().preset,
      selectDelay: instalockTiming().selectDelay,
      lockDelay: instalockTiming().lockDelay,
    },
    app: {
      minimizeOnClose: minimizeOnClose(),
      startMinimized: startMinimized(),
    },
    discord: {
      enabled: discordEnabled(),
      details: discordDetails(),
      state: discordState(),
    },
  });

  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveConfig(buildConfig()).catch(() => {});
    }, 500);
  };

  const updateInstalockActive = (v: boolean) => { setInstalockActive(v); debouncedSave(); };
  const updateInstalockAgent = (v: string | null) => { setInstalockAgent(v); debouncedSave(); };
  const updateInstalockOverrides = (v: Record<string, string>) => { setInstalockOverrides(v); debouncedSave(); };
  const updateDodgeActive = (v: boolean) => { setDodgeActive(v); debouncedSave(); };
  const updateDodgeBlacklist = (v: string[]) => { setDodgeBlacklist(v); debouncedSave(); };
  const updateTiming = (v: InstalockTiming) => { setInstalockTiming(v); debouncedSave(); };
  const updateMinimizeOnClose = (v: boolean) => { setMinimizeOnClose(v); debouncedSave(); };
  const updateStartMinimized = (v: boolean) => { setStartMinimized(v); debouncedSave(); };
  const updateDiscordEnabled = (v: boolean) => { setDiscordEnabled(v); debouncedSave(); };
  const updateDiscordDetails = (v: string) => { setDiscordDetails(v); debouncedSave(); };
  const updateDiscordState = (v: string) => { setDiscordState(v); debouncedSave(); };

  onMount(async () => {
    try {
      const cfg = await loadConfig();
      setInstalockActive(cfg.instalock.active);
      setInstalockAgent(cfg.instalock.defaultAgent);
      setInstalockOverrides(cfg.instalock.mapOverrides);
      setDodgeActive(cfg.mapDodge.active);
      setDodgeBlacklist(cfg.mapDodge.blacklistedMaps);
      setInstalockTiming({
        preset: cfg.timing.preset as InstalockTiming["preset"],
        selectDelay: cfg.timing.selectDelay,
        lockDelay: cfg.timing.lockDelay,
      });
      setMinimizeOnClose(cfg.app?.minimizeOnClose ?? false);
      setStartMinimized(cfg.app?.startMinimized ?? false);
      setDiscordEnabled(cfg.discord?.enabled ?? true);
      setDiscordDetails(cfg.discord?.details ?? "Playing Valorant with Downfall");
      setDiscordState(cfg.discord?.state ?? "");
    } catch {}
    setConfigLoaded(true);
  });

  return (
    <div class="app">
      <Titlebar minimizeOnClose={minimizeOnClose()} />
      <div class="app-body">
        <div class="sidebar-wrapper">
          <Sidebar active={activeTab()} onNavigate={setActiveTab} status={status()} playerInfo={playerInfo()} />
        </div>
        <main class="app-content">
          <Switch>
            <Match when={activeTab() === "dashboard"}>
              <Dashboard status={status()} />
            </Match>
            <Match when={activeTab() === "instalock"}>
              <InstaLock
                status={status()}
                instalockTiming={instalockTiming()}
                active={instalockActive()}
                onActiveChange={updateInstalockActive}
                selectedAgent={instalockAgent()}
                onAgentChange={updateInstalockAgent}
                mapOverrides={instalockOverrides()}
                onOverridesChange={updateInstalockOverrides}
                configLoaded={configLoaded()}
              />
            </Match>
            <Match when={activeTab() === "mapdodge"}>
              <MapDodge
                status={status()}
                active={dodgeActive()}
                onActiveChange={updateDodgeActive}
                blacklist={dodgeBlacklist()}
                onBlacklistChange={updateDodgeBlacklist}
              />
            </Match>
            <Match when={activeTab() === "livematch"}>
              <LiveMatch status={status()} />
            </Match>
            <Match when={activeTab() === "party"}>
              <Party status={status()} />
            </Match>
            <Match when={activeTab() === "settings"}>
              <Settings
                instalockTiming={instalockTiming()}
                onTimingChange={updateTiming}
                minimizeOnClose={minimizeOnClose()}
                onMinimizeOnCloseChange={updateMinimizeOnClose}
                startMinimized={startMinimized()}
                onStartMinimizedChange={updateStartMinimized}
                discordEnabled={discordEnabled()}
                onDiscordEnabledChange={updateDiscordEnabled}
                discordDetails={discordDetails()}
                onDiscordDetailsChange={updateDiscordDetails}
                discordState={discordState()}
                onDiscordStateChange={updateDiscordState}
              />
            </Match>
          </Switch>
        </main>
      </div>
    </div>
  );
};

export default App;
