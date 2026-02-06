import { Component, Show, For, createSignal, createEffect, on } from "solid-js";
import { TbOutlineRefresh } from "solid-icons/tb";
import { getPlayerProfile } from "@src/ipc/commands";
import { rankName, rankIcon, mapName } from "@src/utils/ranks";
import type { ConnectionStatus, PlayerProfile } from "@src/types/valorant";

interface DashboardProps {
  status: ConnectionStatus;
}

const Dashboard: Component<DashboardProps> = (props) => {
  const [profile, setProfile] = createSignal<PlayerProfile | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);

  const fetchProfile = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    getPlayerProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  createEffect(on(() => props.status, (status) => {
    if (status === "connected") fetchProfile();
    else setProfile(null);
  }));

  const avatarUrl = () => {
    const id = profile()?.info.playerCardId;
    return id ? `https://media.valorant-api.com/playercards/${id}/largeart.png` : null;
  };

  const bannerUrl = () => {
    const id = profile()?.info.playerCardId;
    return id ? `https://media.valorant-api.com/playercards/${id}/wideart.png` : null;
  };

  const winRate = () => {
    const mmr = profile()?.mmr;
    if (!mmr || mmr.games === 0) return 0;
    return Math.round((mmr.wins / mmr.games) * 100);
  };

  return (
    <div class="dashboard">
      <Show when={props.status === "connected" && !loading()} fallback={
        <div class="dash-empty">
          <div class="dash-spinner" />
          <Show when={props.status === "disconnected"}>
            <h2>Waiting for Valorant</h2>
            <p>Launch Valorant to see your profile</p>
          </Show>
          <Show when={props.status === "connecting"}>
            <h2>Connecting...</h2>
            <p>Establishing connection to Valorant</p>
          </Show>
          <Show when={props.status === "connected" && loading()}>
            <h2>Loading Profile</h2>
            <p>Fetching your stats...</p>
          </Show>
        </div>
      }>
        <Show when={profile()}>
          {(p) => (
            <>
              <div class="dash-hero" style={bannerUrl() ? { "background-image": `url(${bannerUrl()})` } : {}}>
                <div class="dash-hero-overlay" />
                <button class="dash-refresh" onClick={() => fetchProfile(true)} disabled={refreshing()}>
                  <span class={refreshing() ? "dash-refresh-spin" : ""}><TbOutlineRefresh size={14} /></span>
                </button>
                <div class="dash-hero-content">
                  <Show when={avatarUrl()}>
                    <img src={avatarUrl()!} class="dash-hero-avatar" alt="" />
                  </Show>
                  <div class="dash-hero-info">
                    <h1 class="dash-hero-name">
                      {p().info.gameName}<span class="dash-hero-tag">#{p().info.tagLine}</span>
                    </h1>
                    <Show when={p().accountXp}>
                      <span class="dash-hero-level">Level {p().accountXp!.level}</span>
                    </Show>
                  </div>
                </div>
              </div>

              <div class="dash-grid">
                <div class="dash-card dash-rank-card">
                  <div class="dash-card-label">Current Rank</div>
                  <Show when={p().mmr && p().mmr!.rank > 0} fallback={
                    <div class="dash-card-value">Unranked</div>
                  }>
                    <div class="dash-rank-display">
                      <Show when={rankIcon(p().mmr!.rank)}>
                        <img src={rankIcon(p().mmr!.rank)} class="dash-rank-icon" alt="" />
                      </Show>
                      <div class="dash-rank-info">
                        <div class="dash-card-value">{rankName(p().mmr!.rank)}</div>
                        <div class="dash-rank-rr">{p().mmr!.rr} RR</div>
                      </div>
                    </div>
                  </Show>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Peak Rank</div>
                  <Show when={p().mmr && p().mmr!.peakRank > 0} fallback={
                    <div class="dash-card-value">Unranked</div>
                  }>
                    <div class="dash-rank-display">
                      <Show when={rankIcon(p().mmr!.peakRank)}>
                        <img src={rankIcon(p().mmr!.peakRank)} class="dash-rank-icon dash-rank-icon-sm" alt="" />
                      </Show>
                      <div class="dash-card-value">{rankName(p().mmr!.peakRank)}</div>
                    </div>
                  </Show>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Win Rate</div>
                  <Show when={p().mmr && p().mmr!.games > 0} fallback={<div class="dash-card-value">—</div>}>
                    <div class="dash-card-value">{winRate()}%</div>
                    <div class="dash-card-sub">{p().mmr!.wins}W / {p().mmr!.games - p().mmr!.wins}L</div>
                  </Show>
                </div>

                <div class="dash-card">
                  <div class="dash-card-label">Total Games</div>
                  <Show when={p().mmr && p().mmr!.games > 0} fallback={<div class="dash-card-value">—</div>}>
                    <div class="dash-card-value">{p().mmr!.games}</div>
                    <div class="dash-card-sub">Competitive</div>
                  </Show>
                </div>
              </div>

              <Show when={p().compUpdates.length > 0}>
                <div class="dash-section">
                  <h3 class="dash-section-title">Recent Matches</h3>
                  <div class="dash-comp-list">
                    <For each={p().compUpdates}>
                      {(update) => (
                        <div class={`dash-comp-item ${update.roundsWon > update.roundsLost ? "comp-win" : update.roundsLost > update.roundsWon ? "comp-loss" : "comp-draw"}`}>
                          <div class="dash-comp-result">{update.roundsWon > update.roundsLost ? "W" : update.roundsLost > update.roundsWon ? "L" : update.roundsWon > 0 ? "D" : "—"}</div>
                          <div class="dash-comp-map">{mapName(update.mapId)}</div>
                          <div class="dash-comp-score">{update.roundsWon}–{update.roundsLost}</div>
                          <div class="dash-comp-kda">
                            <span class="kda-kills">{update.kills}</span>
                            <span class="kda-sep">/</span>
                            <span class="kda-deaths">{update.deaths}</span>
                            <span class="kda-sep">/</span>
                            <span class="kda-assists">{update.assists}</span>
                          </div>
                          <div class="dash-comp-rank">
                            <Show when={rankIcon(update.rankAfter)}>
                              <img src={rankIcon(update.rankAfter)} class="dash-comp-rank-icon" alt="" />
                            </Show>
                          </div>
                          <div class={`dash-comp-rr ${update.rrChange > 0 ? "rr-pos" : update.rrChange < 0 ? "rr-neg" : ""}`}>
                            {update.rrChange > 0 ? "+" : ""}{update.rrChange}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default Dashboard;
