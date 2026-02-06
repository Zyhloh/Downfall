import { createSignal, onMount, onCleanup } from "solid-js";
import { getConnectionState } from "../ipc/commands";
import type { ConnectionStatus, PlayerInfo } from "../types/valorant";

export function useValorant() {
  const [status, setStatus] = createSignal<ConnectionStatus>("disconnected");
  const [playerInfo, setPlayerInfo] = createSignal<PlayerInfo | null>(null);

  let pollTimer: ReturnType<typeof setInterval>;

  async function poll() {
    try {
      const state = await getConnectionState();
      setStatus(state.status);
      setPlayerInfo(state.playerInfo);
    } catch {
      setStatus("disconnected");
      setPlayerInfo(null);
    }
  }

  onMount(() => {
    poll();
    pollTimer = setInterval(poll, 2000);
  });

  onCleanup(() => {
    clearInterval(pollTimer);
  });

  return { status, playerInfo };
}
