import { Component, Show, createSignal, createEffect } from "solid-js";
import { TbOutlineBolt, TbOutlineUser, TbOutlineAdjustments, TbOutlineWindow, TbOutlineEyeOff, TbOutlineBrandDiscord } from "solid-icons/tb";

export type TimingPreset = "instant" | "humanized" | "custom";

export interface InstalockTiming {
  preset: TimingPreset;
  selectDelay: number;
  lockDelay: number;
}

const PRESET_DESCRIPTIONS: Record<TimingPreset, string> = {
  instant: "Locks agent immediately with zero delay",
  humanized: "Adds natural-feeling delays to mimic human behavior",
  custom: "Set your own select and lock delay timings",
};

const PRESET_VALUES: Record<Exclude<TimingPreset, "custom">, { select: number; lock: number }> = {
  instant: { select: 0, lock: 0 },
  humanized: { select: 800, lock: 1200 },
};

interface SettingsProps {
  instalockTiming: InstalockTiming;
  onTimingChange: (timing: InstalockTiming) => void;
  minimizeOnClose: boolean;
  onMinimizeOnCloseChange: (v: boolean) => void;
  startMinimized: boolean;
  onStartMinimizedChange: (v: boolean) => void;
  discordEnabled: boolean;
  onDiscordEnabledChange: (v: boolean) => void;
  discordDetails: string;
  onDiscordDetailsChange: (v: string) => void;
  discordState: string;
  onDiscordStateChange: (v: string) => void;
}

const Settings: Component<SettingsProps> = (props) => {
  const [preset, setPreset] = createSignal<TimingPreset>(props.instalockTiming.preset);
  const [selectDelay, setSelectDelay] = createSignal(props.instalockTiming.selectDelay);
  const [lockDelay, setLockDelay] = createSignal(props.instalockTiming.lockDelay);

  createEffect(() => {
    setPreset(props.instalockTiming.preset);
    setSelectDelay(props.instalockTiming.selectDelay);
    setLockDelay(props.instalockTiming.lockDelay);
  });

  const handlePresetChange = (p: TimingPreset) => {
    setPreset(p);
    if (p === "custom") {
      props.onTimingChange({ preset: p, selectDelay: selectDelay(), lockDelay: lockDelay() });
    } else {
      const vals = PRESET_VALUES[p];
      setSelectDelay(vals.select);
      setLockDelay(vals.lock);
      props.onTimingChange({ preset: p, selectDelay: vals.select, lockDelay: vals.lock });
    }
  };

  const handleSelectDelay = (val: number) => {
    setSelectDelay(val);
    props.onTimingChange({ preset: "custom", selectDelay: val, lockDelay: lockDelay() });
  };

  const handleLockDelay = (val: number) => {
    setLockDelay(val);
    props.onTimingChange({ preset: "custom", selectDelay: selectDelay(), lockDelay: val });
  };

  const formatMs = (ms: number) => {
    if (ms === 0) return "0ms";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div class="settings">
      <div class="settings-header">
        <h1 class="settings-title">Settings</h1>
        <p class="settings-desc">Configure Downfall preferences</p>
      </div>

      <div class="settings-section st-fade-in">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Instalock Timing</h2>
          <p class="settings-section-desc">Control how fast agents are selected and locked</p>
        </div>

        <div class="st-presets">
          <button
            class={`st-preset ${preset() === "instant" ? "st-preset-active" : ""}`}
            onClick={() => handlePresetChange("instant")}
          >
            <div class="st-preset-icon"><TbOutlineBolt size={18} /></div>
            <div class="st-preset-info">
              <span class="st-preset-name">Instant</span>
              <span class="st-preset-desc">{PRESET_DESCRIPTIONS.instant}</span>
            </div>
          </button>
          <button
            class={`st-preset ${preset() === "humanized" ? "st-preset-active" : ""}`}
            onClick={() => handlePresetChange("humanized")}
          >
            <div class="st-preset-icon"><TbOutlineUser size={18} /></div>
            <div class="st-preset-info">
              <span class="st-preset-name">Humanized</span>
              <span class="st-preset-desc">{PRESET_DESCRIPTIONS.humanized}</span>
            </div>
          </button>
          <button
            class={`st-preset ${preset() === "custom" ? "st-preset-active" : ""}`}
            onClick={() => handlePresetChange("custom")}
          >
            <div class="st-preset-icon"><TbOutlineAdjustments size={18} /></div>
            <div class="st-preset-info">
              <span class="st-preset-name">Custom</span>
              <span class="st-preset-desc">{PRESET_DESCRIPTIONS.custom}</span>
            </div>
          </button>
        </div>

        <Show when={preset() === "custom"}>
          <div class="st-sliders st-fade-in">
            <div class="st-slider-group">
              <div class="st-slider-header">
                <span class="st-slider-label">Select Delay</span>
                <span class="st-slider-value">{formatMs(selectDelay())}</span>
              </div>
              <input
                type="range"
                class="st-slider"
                min={0}
                max={5000}
                step={50}
                value={selectDelay()}
                onInput={(e) => handleSelectDelay(parseInt(e.currentTarget.value))}
              />
              <div class="st-slider-range">
                <span>0ms</span>
                <span>5s</span>
              </div>
            </div>
            <div class="st-slider-group">
              <div class="st-slider-header">
                <span class="st-slider-label">Lock Delay</span>
                <span class="st-slider-value">{formatMs(lockDelay())}</span>
              </div>
              <input
                type="range"
                class="st-slider"
                min={0}
                max={5000}
                step={50}
                value={lockDelay()}
                onInput={(e) => handleLockDelay(parseInt(e.currentTarget.value))}
              />
              <div class="st-slider-range">
                <span>0ms</span>
                <span>5s</span>
              </div>
            </div>
          </div>
        </Show>

        <Show when={preset() === "instant"}>
          <div class="st-timing-preview st-fade-in">
            <div class="st-timing-item">
              <span class="st-timing-label">Select Delay</span>
              <span class="st-timing-val">{formatMs(selectDelay())}</span>
            </div>
            <div class="st-timing-divider" />
            <div class="st-timing-item">
              <span class="st-timing-label">Lock Delay</span>
              <span class="st-timing-val">{formatMs(lockDelay())}</span>
            </div>
          </div>
        </Show>
      </div>

      <div class="settings-section st-fade-in">
        <div class="settings-section-header">
          <h2 class="settings-section-title">App Controls</h2>
          <p class="settings-section-desc">Window and startup behavior</p>
        </div>

        <div class="st-toggles">
          <div class="st-toggle-row">
            <div class="st-toggle-info">
              <div class="st-toggle-icon"><TbOutlineWindow size={16} /></div>
              <div class="st-toggle-text">
                <span class="st-toggle-label">Minimize on Close</span>
                <span class="st-toggle-desc">Hide to system tray instead of closing</span>
              </div>
            </div>
            <button
              class={`st-switch ${props.minimizeOnClose ? "st-switch-on" : ""}`}
              onClick={() => props.onMinimizeOnCloseChange(!props.minimizeOnClose)}
            >
              <div class="st-switch-thumb" />
            </button>
          </div>
          <div class="st-toggle-row">
            <div class="st-toggle-info">
              <div class="st-toggle-icon"><TbOutlineEyeOff size={16} /></div>
              <div class="st-toggle-text">
                <span class="st-toggle-label">Start Minimized</span>
                <span class="st-toggle-desc">Launch hidden in the system tray</span>
              </div>
            </div>
            <button
              class={`st-switch ${props.startMinimized ? "st-switch-on" : ""}`}
              onClick={() => props.onStartMinimizedChange(!props.startMinimized)}
            >
              <div class="st-switch-thumb" />
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section st-fade-in">
        <div class="settings-section-header">
          <h2 class="settings-section-title">Discord Rich Presence</h2>
          <p class="settings-section-desc">Show Downfall activity on your Discord profile</p>
        </div>

        <div class="st-toggles">
          <div class="st-toggle-row">
            <div class="st-toggle-info">
              <div class="st-toggle-icon"><TbOutlineBrandDiscord size={16} /></div>
              <div class="st-toggle-text">
                <span class="st-toggle-label">Discord RPC</span>
                <span class="st-toggle-desc">Display rich presence on Discord</span>
              </div>
            </div>
            <button
              class={`st-switch ${props.discordEnabled ? "st-switch-on" : ""}`}
              onClick={() => props.onDiscordEnabledChange(!props.discordEnabled)}
            >
              <div class="st-switch-thumb" />
            </button>
          </div>
        </div>

        <Show when={props.discordEnabled}>
          <div class="st-inputs st-fade-in">
            <div class="st-input-group">
              <label class="st-input-label">Details Text</label>
              <input
                type="text"
                class="st-input"
                value={props.discordDetails}
                onInput={(e) => props.onDiscordDetailsChange(e.currentTarget.value)}
                placeholder="Playing Valorant with Downfall"
              />
            </div>
            <div class="st-input-group">
              <label class="st-input-label">State Text</label>
              <input
                type="text"
                class="st-input"
                value={props.discordState}
                onInput={(e) => props.onDiscordStateChange(e.currentTarget.value)}
                placeholder="Optional second line"
              />
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default Settings;
