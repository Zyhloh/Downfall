import { Component } from "solid-js";
import type { PlayerInfo } from "@src/types/valorant";

interface PlayerCardProps {
  player: PlayerInfo;
}

const PlayerCard: Component<PlayerCardProps> = (props) => {
  return (
    <div class="player-card">
      <div class="player-card-header">
        <h2 class="player-name">{props.player.gameName}</h2>
        <span class="player-tag">#{props.player.tagLine}</span>
      </div>
      <div class="player-card-body">
        <div class="player-stat">
          <span class="stat-label">PUUID</span>
          <span class="stat-value">{props.player.puuid.slice(0, 8)}...</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
