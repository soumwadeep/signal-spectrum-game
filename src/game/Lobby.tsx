import type { CSSProperties } from "react";
import { shareUrl } from "./storage";
import type { GameView } from "./types";
import { CopyButton, PhaseHeader, PlayerDot } from "./ui";

interface LobbyProps {
  view: GameView;
  busy: boolean;
  onStart: () => void;
  onOpenRules: () => void;
}

export function Lobby({ view, busy, onStart, onOpenRules }: LobbyProps) {
  const host = view.players.find((player) => player.id === view.hostId);
  const openSlots = Array.from({ length: view.maxPlayers }, (_, index) => view.players[index] ?? null);

  return (
    <section className="phase lobby-phase">
      <PhaseHeader
        kicker={`ROOM OPEN · ${view.players.length} / ${view.maxPlayers} OPERATORS`}
        title="WAITING FOR THE CREW"
        description="Share the room code. Two players are enough to begin; eight is a full room."
        aside={<span className="status-tag"><i aria-hidden="true" /> CHANNEL OPEN</span>}
      />

      <div className="panel lobby-board">
        <div className="lobby-code-row">
          <div className="lobby-code-block">
            <span className="eyebrow">ROOM FREQUENCY</span>
            <div className="room-code-display" data-testid="room-code">{view.room}</div>
          </div>
          <div className="lobby-code-actions">
            <CopyButton text={shareUrl(view.room)} label="COPY INVITE LINK" />
            <p>or read the code aloud. Phones, tablets, laptops all work.</p>
          </div>
        </div>

        <div className="roster-head">
          <span className="eyebrow">CREW MANIFEST</span>
          <span className="roster-count">{view.players.length} / {view.maxPlayers}</span>
        </div>

        <div className="roster-grid" data-testid="roster">
          {openSlots.map((player, index) => (
            <div
              className={`roster-slot ${player ? "is-filled" : "is-open"}`}
              key={player?.id ?? `open-${index}`}
              style={player ? ({ "--player": player.color } as CSSProperties) : undefined}
            >
              <span className="slot-index">{String(index + 1).padStart(2, "0")}</span>
              {player ? (
                <>
                  <div className="slot-player">
                    <PlayerDot color={player.color} />
                    <b>{player.name}</b>
                  </div>
                  <div className="slot-tags">
                    {player.id === view.you.id && <span className="slot-tag you-tag">YOU</span>}
                    {player.isHost && <span className="slot-tag">HOST</span>}
                  </div>
                </>
              ) : (
                <span className="slot-empty">OPEN SLOT</span>
              )}
            </div>
          ))}
        </div>

        <div className="lobby-start-row">
          <div className="lobby-start-note">
            <span className="eyebrow">NEXT STEP</span>
            <p>
              {view.you.isHost
                ? "You have the room. Start when your people are in."
                : `${host?.name ?? "The host"} starts the round for everyone.`}
            </p>
            <p className="faint">Keep this tab open. Refreshing keeps your seat.</p>
          </div>

          {view.you.isHost ? (
            <button
              type="button"
              className="btn btn-primary btn-wide lobby-start"
              onClick={onStart}
              disabled={!view.canStart || busy}
              data-testid="start-game"
            >
              {busy
                ? "STARTING…"
                : view.players.length < view.minPlayers
                  ? "NEED ONE MORE PLAYER"
                  : "START THE ROUND"}
            </button>
          ) : (
            <div className="waiting-box" role="status">
              <span className="waiting-pulse" aria-hidden="true" />
              <span>WAITING FOR {host?.name ?? "THE HOST"} TO START</span>
            </div>
          )}
        </div>
      </div>

      <div className="lobby-brief">
        <article>
          <span className="brief-number">01</span>
          <h3>ONE BEACON</h3>
          <p>One player sees the hidden target on the spectrum. Only them.</p>
        </article>
        <article>
          <span className="brief-number">02</span>
          <h3>ONE CLUE</h3>
          <p>They send up to five words. No numbers, no spectrum words, no obvious synonyms.</p>
        </article>
        <article>
          <span className="brief-number">03</span>
          <h3>EVERYONE DIALS</h3>
          <p>Everyone else locks a guess. Closer to the target scores more. Good clues score for the Beacon.</p>
        </article>
        <div className="brief-action">
          <button type="button" className="text-link" onClick={onOpenRules}>READ THE FULL RULES</button>
          <span className="faint">2–8 PLAYERS · 10 MINUTES</span>
        </div>
      </div>
    </section>
  );
}
