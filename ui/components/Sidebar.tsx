import { Component, For, Show } from "solid-js";
import { TbOutlineLock, TbOutlineMapX, TbOutlineLayoutDashboard, TbOutlineSettings, TbOutlineSwords, TbOutlineUsers } from "solid-icons/tb";
import type { JSX } from "solid-js";
import type { ConnectionStatus, PlayerInfo } from "@src/types/valorant";

export interface SidebarTab {
  id: string;
  label: string;
  icon: () => JSX.Element;
}

export const tabs: SidebarTab[] = [
  { id: "dashboard", label: "Home", icon: () => <TbOutlineLayoutDashboard size={20} /> },
  { id: "instalock", label: "Insta Lock", icon: () => <TbOutlineLock size={20} /> },
  { id: "mapdodge", label: "Map Dodge", icon: () => <TbOutlineMapX size={20} /> },
  { id: "livematch", label: "Live Match", icon: () => <TbOutlineSwords size={20} /> },
  { id: "party", label: "Party", icon: () => <TbOutlineUsers size={20} /> },
];

const statusLabels: Record<ConnectionStatus, string> = {
  disconnected: "Waiting for Valorant",
  connecting: "Connecting...",
  connected: "Connected",
};

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
  status: ConnectionStatus;
  playerInfo: PlayerInfo | null;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const avatarUrl = () => {
    const id = props.playerInfo?.playerCardId;
    return id ? `https://media.valorant-api.com/playercards/${id}/largeart.png` : null;
  };

  return (
    <nav class="sidebar">
      <div class="sidebar-tabs">
        <For each={tabs}>
          {(tab) => (
            <button
              class={`sidebar-tab ${props.active === tab.id ? "sidebar-tab-active" : ""}`}
              onClick={() => props.onNavigate(tab.id)}

            >
              <span class="sidebar-tab-icon">{tab.icon()}</span>
              <span class="sidebar-tab-label">{tab.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="sidebar-footer">
        <div class="sidebar-profile">
          <div class="sidebar-avatar-wrap">
            <Show when={props.status === "connected" && avatarUrl()} fallback={
              <div class={`sidebar-avatar-placeholder ${props.status !== "disconnected" ? "sidebar-avatar-loading" : ""}`} />
            }>
              <img src={avatarUrl()!} class="sidebar-avatar" alt="" />
            </Show>
            <div class={`sidebar-avatar-dot status-dot-${props.status}`} />
          </div>
          <div class="sidebar-profile-info">
            <Show when={props.playerInfo} fallback={
              <span class="sidebar-profile-status">{statusLabels[props.status]}</span>
            }>
              <span class="sidebar-profile-name">
                {props.playerInfo!.gameName}<span class="sidebar-profile-tag">#{props.playerInfo!.tagLine}</span>
              </span>
              <span class={`sidebar-profile-status status-text-${props.status}`}>
                {statusLabels[props.status]}
              </span>
            </Show>
          </div>
          <button
            class="sidebar-settings-btn"
            onClick={() => props.onNavigate("settings")}

          >
            <TbOutlineSettings size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
