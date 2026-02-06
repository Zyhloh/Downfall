import { Component, Show, For, createSignal, createEffect, on, onCleanup } from "solid-js";
import { getLiveMatch } from "@src/ipc/commands";
import { rankName, rankIcon } from "@src/utils/ranks";
import type { ConnectionStatus, LiveMatch as LiveMatchType, LiveMatchPlayer } from "@src/types/valorant";

interface LiveMatchProps {
  status: ConnectionStatus;
}

const PlayerRow: Component<{ player: LiveMatchPlayer }> = (props) => {
  const p = () => props.player;
  return (
    <div class={`lm-player ${p().isSelf ? "lm-player-self" : ""}`}>
      <div class="lm-player-agent">
        <Show when={p().agentIcon} fallback={<div class="lm-agent-placeholder" />}>
          <img src={p().agentIcon} class="lm-agent-icon" alt="" />
        </Show>
      </div>
      <div class="lm-player-info">
        <span class="lm-player-name">
          <Show when={p().gameName} fallback={
            <span class="lm-player-anon">Anonymous</span>
          }>
            {p().gameName}
            <Show when={p().tagLine}>
              <span class="lm-player-tag">#{p().tagLine}</span>
            </Show>
          </Show>
        </span>
        <div class="lm-player-sub">
          <span class="lm-player-agent-name">{p().agentName}</span>
          <Show when={p().accountLevel > 0}>
            <span class="lm-player-level">Lv. {p().accountLevel}</span>
          </Show>
        </div>
      </div>
      <div class="lm-player-rank">
        <Show when={p().rank > 0} fallback={<span class="lm-rank-unranked">Unranked</span>}>
          <Show when={rankIcon(p().rank)}>
            <img src={rankIcon(p().rank)} class="lm-rank-icon" alt="" />
          </Show>
          <div class="lm-rank-info">
            <span class="lm-rank-name">{rankName(p().rank)}</span>
            <Show when={p().rr > 0}>
              <span class="lm-rank-rr">{p().rr} RR</span>
            </Show>
          </div>
        </Show>
      </div>
      <div class="lm-player-peak">
        <Show when={p().peakRank > 0} fallback={<span class="lm-rank-unranked">—</span>}>
          <Show when={rankIcon(p().peakRank)}>
            <img src={rankIcon(p().peakRank)} class="lm-peak-icon" alt="" />
          </Show>
          <span class="lm-peak-name">{rankName(p().peakRank)}</span>
        </Show>
      </div>
    </div>
  );
};

const LiveMatch: Component<LiveMatchProps> = (props) => {
  const [match, setMatch] = createSignal<LiveMatchType | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [cachedMatchId, setCachedMatchId] = createSignal("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const fetchMatch = async () => {
    if (props.status !== "connected") {
      setMatch(null);
      setCachedMatchId("");
      return;
    }
    try {
      const m = await getLiveMatch();
      if (!m) {
        setMatch(null);
        setCachedMatchId("");
        return;
      }
      if (m.matchId !== cachedMatchId()) {
        setMatch(m);
        setCachedMatchId(m.matchId);
      } else {
        setMatch(prev => {
          if (!prev) return m;
          return {
            ...prev,
            phase: m.phase,
            allyTeam: prev.allyTeam.map(p => {
              const updated = m.allyTeam.find(u => u.puuid === p.puuid);
              return updated ? { ...p, agentId: updated.agentId, agentName: updated.agentName, agentIcon: updated.agentIcon } : p;
            }),
            enemyTeam: m.enemyTeam.length > 0 && prev.enemyTeam.length === 0 ? m.enemyTeam : prev.enemyTeam.map(p => {
              const updated = m.enemyTeam.find(u => u.puuid === p.puuid);
              return updated ? { ...p, agentId: updated.agentId, agentName: updated.agentName, agentIcon: updated.agentIcon } : p;
            }),
          };
        });
      }
    } catch {
      if (!match()) setMatch(null);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setCachedMatchId("");
    await fetchMatch();
    setLoading(false);
  };

  createEffect(on(() => props.status, (status) => {
    if (pollInterval) clearInterval(pollInterval);
    if (status === "connected") {
      refresh();
      pollInterval = setInterval(fetchMatch, 5000);
    } else {
      setMatch(null);
    }
  }));

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  const phaseLabel = () => {
    const m = match();
    if (!m) return "";
    return m.phase === "pregame" ? "Agent Select" : "In Game";
  };

  const queueLabel = () => {
    const q = match()?.queueId || "";
    const labels: Record<string, string> = {
      competitive: "Competitive",
      unrated: "Unrated",
      spikerush: "Spike Rush",
      deathmatch: "Deathmatch",
      ggteam: "Escalation",
      newmap: "New Map",
      swiftplay: "Swiftplay",
      premier: "Premier",
    };
    return labels[q] || q || "Unknown";
  };

  return (
    <div class="livematch">
      <Show when={props.status === "connected"} fallback={
        <div class="dash-empty">
          <div class="dash-spinner" />
          <h2>Waiting for Valorant</h2>
          <p>Connect to Valorant to see live match data</p>
        </div>
      }>
        <Show when={match()} fallback={
          <div class="dash-empty">
            <Show when={loading()}>
              <div class="dash-spinner" />
              <h2>Searching for Match</h2>
              <p>Looking for an active match...</p>
            </Show>
            <Show when={!loading()}>
              <h2>No Active Match</h2>
              <p>Queue up or enter agent select to see match data</p>
              <p class="lm-poll-hint">Auto-refreshing every 5 seconds</p>
            </Show>
          </div>
        }>
          {(m) => (
            <div class="lm-content lm-fade-in">
              <div class="lm-header">
                <div class="lm-header-left">
                  <h1 class="lm-title">Live Match</h1>
                  <div class="lm-meta">
                    <span class="lm-map">{m().mapName}</span>
                    <span class="lm-sep">·</span>
                    <span class="lm-queue">{queueLabel()}</span>
                    <span class="lm-sep">·</span>
                    <span class={`lm-phase ${m().phase === "pregame" ? "lm-phase-pregame" : "lm-phase-ingame"}`}>
                      {phaseLabel()}
                    </span>
                  </div>
                </div>
              </div>

              <div class="lm-teams">
                <Show when={m().isTeamMode} fallback={
                  <div class="lm-team">
                    <div class="lm-team-header lm-team-ffa">
                      <span class="lm-team-label">All Players</span>
                      <span class="lm-team-count">{m().allyTeam.length} players</span>
                    </div>
                    <div class="lm-team-list">
                      <div class="lm-list-header">
                        <span class="lm-col-agent">Agent</span>
                        <span class="lm-col-name">Player</span>
                        <span class="lm-col-rank">Current Rank</span>
                        <span class="lm-col-peak">Peak</span>
                      </div>
                      <For each={m().allyTeam}>
                        {(player) => <PlayerRow player={player} />}
                      </For>
                    </div>
                  </div>
                }>
                  <div class="lm-team">
                    <div class="lm-team-header lm-team-ally">
                      <span class="lm-team-label">Your Team</span>
                      <span class="lm-team-count">{m().allyTeam.length} players</span>
                    </div>
                    <div class="lm-team-list">
                      <div class="lm-list-header">
                        <span class="lm-col-agent">Agent</span>
                        <span class="lm-col-name">Player</span>
                        <span class="lm-col-rank">Current Rank</span>
                        <span class="lm-col-peak">Peak</span>
                      </div>
                      <For each={m().allyTeam}>
                        {(player) => <PlayerRow player={player} />}
                      </For>
                    </div>
                  </div>

                  <Show when={m().enemyTeam.length > 0}>
                    <div class="lm-team">
                      <div class="lm-team-header lm-team-enemy">
                        <span class="lm-team-label">Enemy Team</span>
                        <span class="lm-team-count">{m().enemyTeam.length} players</span>
                      </div>
                      <div class="lm-team-list">
                        <div class="lm-list-header">
                          <span class="lm-col-agent">Agent</span>
                          <span class="lm-col-name">Player</span>
                          <span class="lm-col-rank">Current Rank</span>
                          <span class="lm-col-peak">Peak</span>
                        </div>
                        <For each={m().enemyTeam}>
                          {(player) => <PlayerRow player={player} />}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <Show when={m().phase === "pregame" && m().enemyTeam.length === 0}>
                    <div class="lm-team">
                      <div class="lm-team-header lm-team-enemy">
                        <span class="lm-team-label">Enemy Team</span>
                      </div>
                      <div class="lm-team-hidden">
                        Hidden during agent select
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default LiveMatch;
