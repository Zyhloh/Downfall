import { Component, Show, For, createSignal, createEffect, on, onCleanup } from "solid-js";
import { TbOutlineCrown, TbOutlineX, TbOutlineCopy, TbOutlineCheck, TbOutlineHash, TbOutlineTrash, TbOutlineChevronDown } from "solid-icons/tb";
import { getParty, partyInvite, partyKick, partyPromote, partySetAccessibility, partySetReady, getFriends, partyGenerateCode, partyDisableCode, partyAcceptInvite, partyDeclineInvite, partySetQueue } from "@src/ipc/commands";
import { rankName, rankIcon } from "@src/utils/ranks";
import type { ConnectionStatus, PartyState, PartyMember, PartyInvite, Friend } from "@src/types/valorant";

interface PartyProps {
  status: ConnectionStatus;
}

const QUEUE_LABELS: Record<string, string> = {
  competitive: "Competitive",
  unrated: "Unrated",
  spikerush: "Spike Rush",
  deathmatch: "Deathmatch",
  ggteam: "Escalation",
  swiftplay: "Swiftplay",
  premier: "Premier",
  "": "No Queue",
};

const MemberCard: Component<{
  member: PartyMember;
  isOwner: boolean;
  isSelf: boolean;
  partyId: string;
  onRefresh: () => void;
}> = (props) => {
  const m = () => props.member;
  const [kicking, setKicking] = createSignal(false);
  const [promoting, setPromoting] = createSignal(false);
  const avatarUrl = () => m().playerCardId
    ? `https://media.valorant-api.com/playercards/${m().playerCardId}/smallart.png`
    : null;

  const handleKick = async () => {
    if (kicking()) return;
    setKicking(true);
    try {
      await partyKick(props.partyId, m().puuid);
      props.onRefresh();
    } catch {}
    setKicking(false);
  };

  const handlePromote = async () => {
    if (promoting()) return;
    setPromoting(true);
    try {
      await partyPromote(props.partyId, m().puuid);
      props.onRefresh();
    } catch {}
    setPromoting(false);
  };

  return (
    <div class={`pt-member ${props.isSelf ? "pt-member-self" : ""} ${kicking() ? "pt-member-kicking" : ""}`}>
      <div class="pt-member-left">
        <div class="pt-member-avatar">
          <Show when={avatarUrl()} fallback={<div class="pt-avatar-placeholder" />}>
            <img src={avatarUrl()!} class="pt-avatar-img" alt="" />
          </Show>
          <Show when={m().isReady}>
            <div class="pt-ready-dot" />
          </Show>
        </div>
        <div class="pt-member-info">
          <div class="pt-member-name">
            {m().gameName || "Unknown"}
            <Show when={m().tagLine}>
              <span class="pt-member-tag">#{m().tagLine}</span>
            </Show>
            <Show when={m().isOwner}>
              <TbOutlineCrown size={12} class="pt-crown" />
            </Show>
          </div>
          <div class="pt-member-sub">
            <Show when={m().rank > 0} fallback={<span class="pt-member-rank-text">Unranked</span>}>
              <Show when={rankIcon(m().rank)}>
                <img src={rankIcon(m().rank)} class="pt-rank-icon" alt="" />
              </Show>
              <span class="pt-member-rank-text">{rankName(m().rank)}</span>
            </Show>
            <Show when={m().accountLevel > 0}>
              <span class="pt-member-level">Lv. {m().accountLevel}</span>
            </Show>
            <Show when={m().ping > 0}>
              <span class="pt-member-ping">{m().ping}ms</span>
            </Show>
          </div>
        </div>
      </div>
      <Show when={props.isOwner && !props.isSelf}>
        <div class="pt-member-actions">
          <button class={`pt-action-btn pt-promote-btn ${promoting() ? "pt-promote-loading" : ""}`} onClick={handlePromote} title="Promote to Leader" disabled={promoting()}>
            <Show when={promoting()} fallback={<TbOutlineCrown size={13} />}>
              <div class="pt-promote-spinner" />
            </Show>
          </button>
          <button class={`pt-action-btn pt-kick-btn ${kicking() ? "pt-kick-loading" : ""}`} onClick={handleKick} title="Kick" disabled={kicking()}>
            <Show when={kicking()} fallback={<TbOutlineX size={14} />}>
              <div class="pt-kick-spinner" />
            </Show>
          </button>
        </div>
      </Show>
    </div>
  );
};

const Party: Component<PartyProps> = (props) => {
  const [party, setParty] = createSignal<PartyState | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [friends, setFriends] = createSignal<Friend[]>([]);
  const [friendFilter, setFriendFilter] = createSignal("");
  const [inviteStatus, setInviteStatus] = createSignal<Record<string, "sending" | "sent" | "error">>({});
  const [copied, setCopied] = createSignal(false);
  const [accessLoading, setAccessLoading] = createSignal(false);
  const [codeLoading, setCodeLoading] = createSignal(false);
  const [queueOpen, setQueueOpen] = createSignal(false);
  const [queueLoading, setQueueLoading] = createSignal(false);
  const [inviteActions, setInviteActions] = createSignal<Record<string, "accepting" | "declining">>({});
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const fetchParty = async () => {
    if (props.status !== "connected") {
      setParty(null);
      return;
    }
    try {
      const p = await getParty();
      setParty(p);
    } catch {
      setParty(null);
    }
  };

  const fetchFriendsList = async () => {
    if (props.status !== "connected") return;
    try {
      const f = await getFriends();
      setFriends(f);
    } catch {}
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([fetchParty(), fetchFriendsList()]);
    setLoading(false);
  };

  createEffect(on(() => props.status, (status) => {
    if (pollInterval) clearInterval(pollInterval);
    if (status === "connected") {
      refresh();
      pollInterval = setInterval(fetchParty, 1500);
    } else {
      setParty(null);
      setFriends([]);
    }
  }));

  onCleanup(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  const partyPuuids = () => new Set(party()?.members.map(m => m.puuid) || []);

  const filteredFriends = () => {
    const q = friendFilter().toLowerCase();
    const inParty = partyPuuids();
    return friends()
      .filter(f => f.isOnline && !inParty.has(f.puuid))
      .filter(f => !q || f.gameName.toLowerCase().includes(q) || f.tagLine.toLowerCase().includes(q));
  };

  const handleInviteFriend = async (friend: Friend) => {
    const p = party();
    if (!p) return;
    setInviteStatus(prev => ({ ...prev, [friend.puuid]: "sending" }));
    try {
      await partyInvite(p.partyId, friend.gameName, friend.tagLine);
      setInviteStatus(prev => ({ ...prev, [friend.puuid]: "sent" }));
      setTimeout(() => setInviteStatus(prev => { const n = { ...prev }; delete n[friend.puuid]; return n; }), 2000);
    } catch {
      setInviteStatus(prev => ({ ...prev, [friend.puuid]: "error" }));
      setTimeout(() => setInviteStatus(prev => { const n = { ...prev }; delete n[friend.puuid]; return n; }), 2000);
    }
  };

  const handleAccessibility = async (open: boolean) => {
    const p = party();
    if (!p || accessLoading()) return;
    setAccessLoading(true);
    try {
      await partySetAccessibility(p.partyId, open);
      await fetchParty();
    } catch {}
    setAccessLoading(false);
  };

  const handleGenerateCode = async () => {
    const p = party();
    if (!p || codeLoading()) return;
    setCodeLoading(true);
    try {
      await partyGenerateCode(p.partyId);
      await fetchParty();
    } catch {}
    setCodeLoading(false);
  };

  const handleDisableCode = async () => {
    const p = party();
    if (!p || codeLoading()) return;
    setCodeLoading(true);
    try {
      await partyDisableCode(p.partyId);
      await fetchParty();
    } catch {}
    setCodeLoading(false);
  };

  const copyCode = () => {
    const code = party()?.inviteCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAcceptInvite = async (invite: PartyInvite) => {
    setInviteActions(prev => ({ ...prev, [invite.requestId]: "accepting" }));
    try {
      await partyAcceptInvite(invite.partyId);
      await fetchParty();
    } catch {}
    setInviteActions(prev => { const n = { ...prev }; delete n[invite.requestId]; return n; });
  };

  const handleDeclineInvite = async (invite: PartyInvite) => {
    setInviteActions(prev => ({ ...prev, [invite.requestId]: "declining" }));
    try {
      await partyDeclineInvite(invite.partyId, invite.requestId);
      await fetchParty();
    } catch {}
    setInviteActions(prev => { const n = { ...prev }; delete n[invite.requestId]; return n; });
  };

  const handleChangeQueue = async (queueId: string) => {
    const p = party();
    if (!p || queueLoading()) return;
    setQueueLoading(true);
    setQueueOpen(false);
    try {
      await partySetQueue(p.partyId, queueId);
      await fetchParty();
    } catch {}
    setQueueLoading(false);
  };

  const stateLabel = () => {
    const s = party()?.state || "";
    if (s === "MATCHMAKING") return "Searching...";
    if (s === "MATCHMADE_GAME_STARTING") return "Match Found";
    return "Lobby";
  };

  return (
    <div class="party-page">
      <Show when={props.status === "connected"} fallback={
        <div class="dash-empty">
          <div class="dash-spinner" />
          <h2>Waiting for Valorant</h2>
          <p>Connect to Valorant to manage your party</p>
        </div>
      }>
        <Show when={party()} fallback={
          <div class="dash-empty">
            <Show when={loading()}>
              <div class="dash-spinner" />
              <h2>Loading Party</h2>
            </Show>
            <Show when={!loading()}>
              <h2>No Party Found</h2>
              <p>Could not fetch party data</p>
            </Show>
          </div>
        }>
          {(p) => (
            <div class="pt-content pt-fade-in">
              <div class="pt-header">
                <div class="pt-header-left">
                  <h1 class="pt-title">Party</h1>
                  <div class="pt-meta">
                    <Show when={p().isOwner}>
                      <div class="pt-queue-selector-wrap">
                        <button class={`pt-queue-btn ${queueLoading() ? "pt-btn-loading" : ""}`} onClick={() => setQueueOpen(!queueOpen())}>
                          <span>{QUEUE_LABELS[p().queueId] || p().queueId || "Select Mode"}</span>
                          <TbOutlineChevronDown size={10} class={`pt-q-chevron ${queueOpen() ? "pt-q-chevron-open" : ""}`} />
                        </button>
                        <Show when={queueOpen()}>
                          <div class="pt-queue-dropdown">
                            <For each={p().eligibleQueues}>
                              {(q) => (
                                <button
                                  class={`pt-queue-option ${q === p().queueId ? "pt-queue-option-active" : ""}`}
                                  onClick={() => handleChangeQueue(q)}
                                >
                                  {QUEUE_LABELS[q] || q}
                                </button>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    </Show>
                    <Show when={!p().isOwner}>
                      <span class="pt-queue">{QUEUE_LABELS[p().queueId] || p().queueId}</span>
                    </Show>
                    <span class="pt-sep">·</span>
                    <span class={`pt-state ${p().state === "MATCHMAKING" ? "pt-state-queue" : ""}`}>
                      {stateLabel()}
                    </span>
                    <span class="pt-sep">·</span>
                    <span class="pt-size">{p().members.length}/5</span>
                  </div>
                </div>
                <Show when={p().isOwner}>
                  <div class={`pt-toggle-wrap ${accessLoading() ? "pt-toggle-loading" : ""}`}>
                    <button
                      class={`pt-toggle-opt ${p().accessibility === "CLOSED" ? "pt-toggle-active" : ""}`}
                      onClick={() => handleAccessibility(false)}
                    >Closed</button>
                    <button
                      class={`pt-toggle-opt ${p().accessibility === "OPEN" ? "pt-toggle-active" : ""}`}
                      onClick={() => handleAccessibility(true)}
                    >Open</button>
                    <div class={`pt-toggle-slider ${p().accessibility === "OPEN" ? "pt-toggle-slider-right" : ""}`} />
                  </div>
                </Show>
              </div>

              <Show when={p().invites.length > 0}>
                <div class="pt-invites">
                  <For each={p().invites}>
                    {(invite) => {
                      const action = () => inviteActions()[invite.requestId];
                      return (
                        <div class={`pt-invite-banner ${action() ? "pt-invite-processing" : ""}`}>
                          <div class="pt-invite-info">
                            <span class="pt-invite-label">Party Invite</span>
                            <span class="pt-invite-from">
                              {invite.fromName || "Unknown"}
                              <Show when={invite.fromTag}>
                                <span class="pt-invite-from-tag">#{invite.fromTag}</span>
                              </Show>
                            </span>
                          </div>
                          <div class="pt-invite-actions">
                            <button
                              class="pt-invite-accept"
                              onClick={() => handleAcceptInvite(invite)}
                              disabled={!!action()}
                            >
                              {action() === "accepting" ? "..." : "Accept"}
                            </button>
                            <button
                              class="pt-invite-decline"
                              onClick={() => handleDeclineInvite(invite)}
                              disabled={!!action()}
                            >
                              {action() === "declining" ? "..." : "Decline"}
                            </button>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>

              <div class="pt-members">
                <For each={p().members}>
                  {(member) => (
                    <MemberCard
                      member={member}
                      isOwner={p().isOwner}
                      isSelf={member.isOwner && p().isOwner || false}
                      partyId={p().partyId}
                      onRefresh={fetchParty}
                    />
                  )}
                </For>
              </div>

              <div class="pt-code-section">
                <Show when={p().inviteCode} fallback={
                  <button class={`pt-gen-code-btn ${codeLoading() ? "pt-btn-loading" : ""}`} onClick={handleGenerateCode} disabled={codeLoading()}>
                    <TbOutlineHash size={14} />
                    <span>{codeLoading() ? "Generating..." : "Generate Party Code"}</span>
                  </button>
                }>
                  <div class="pt-code-row">
                    <div class="pt-code-left">
                      <span class="pt-code-label">Party Code</span>
                      <div class="pt-code-value">
                        <span>{p().inviteCode}</span>
                      </div>
                    </div>
                    <div class="pt-code-actions">
                      <button class="pt-copy-btn" onClick={copyCode} title="Copy">
                        <Show when={copied()} fallback={<TbOutlineCopy size={13} />}>
                          <TbOutlineCheck size={13} />
                        </Show>
                      </button>
                      <button class={`pt-delete-code-btn ${codeLoading() ? "pt-btn-loading" : ""}`} onClick={handleDisableCode} title="Remove Code" disabled={codeLoading()}>
                        <TbOutlineTrash size={13} />
                      </button>
                    </div>
                  </div>
                </Show>
              </div>

              <div class="pt-friends-panel">
                <div class="pt-friends-header">
                  <span class="pt-friends-title">Online Friends</span>
                  <span class="pt-friends-count">{filteredFriends().length}</span>
                </div>
                <input
                  class="pt-friends-search"
                  type="text"
                  placeholder="Search..."
                  value={friendFilter()}
                  onInput={(e) => setFriendFilter(e.currentTarget.value)}
                />
                <div class="pt-friends-list">
                  <Show when={filteredFriends().length > 0} fallback={
                    <div class="pt-friends-empty">No online friends found</div>
                  }>
                    <For each={filteredFriends()}>
                      {(friend) => {
                        const status = () => inviteStatus()[friend.puuid];
                        const friendAvatar = () => friend.playerCardId
                          ? `https://media.valorant-api.com/playercards/${friend.playerCardId}/wideart.png`
                          : null;
                        const statusLabel = () => {
                          if (friend.status === "dnd") return "In Game";
                          if (friend.status === "away") return "Away";
                          return "Online";
                        };
                        return (
                          <div class="pt-friend-row">
                            <div class="pt-friend-info">
                              <div class="pt-friend-avatar-wrap">
                                <Show when={friendAvatar()} fallback={<div class="pt-friend-avatar-ph" />}>
                                  <img src={friendAvatar()!} class="pt-friend-avatar" alt="" />
                                </Show>
                                <div class={`pt-friend-status-dot pt-status-${friend.status}`} />
                              </div>
                              <div class="pt-friend-details">
                                <div class="pt-friend-name-row">
                                  <span class="pt-friend-name">{friend.gameName}</span>
                                  <span class="pt-friend-tag">#{friend.tagLine}</span>
                                </div>
                                <span class={`pt-friend-status-text pt-status-text-${friend.status}`}>{statusLabel()}</span>
                              </div>
                            </div>
                            <button
                              class={`pt-friend-invite ${status() === "sent" ? "pt-invite-sent" : status() === "error" ? "pt-invite-error" : ""}`}
                              onClick={() => handleInviteFriend(friend)}
                              disabled={!!status()}
                            >
                              {status() === "sending" ? "..." : status() === "sent" ? "Sent" : status() === "error" ? "Failed" : "Invite"}
                            </button>
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default Party;
