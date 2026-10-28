import { shareUrl } from "./storage";
import type { GameView, PlayerView } from "./types";
import { CopyButton, PhaseHeader, PlayerDot } from "./ui";

interface FinishedPhaseProps {
  view: GameView;
  busy: boolean;
  onRematch: () => void;
}

function namesFor(players: PlayerView[]): string {
  if (players.length === 0) return "NOBODY";
  if (players.length === 1) return players[0].name.toUpperCase();
  if (players.length === 2) return `${players[0].name.toUpperCase()} & ${players[1].name.toUpperCase()}`;
  return `${players.slice(0, -1).map((player) => player.name.toUpperCase()).join(", ")} & ${players[players.length - 1].name.toUpperCase()}`;
}

export function FinishedPhase({ view, busy, onRematch }: FinishedPhaseProps) {
  const sorted = [...view.players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = view.winners?.length
    ? sorted.filter((player) => view.winners?.includes(player.id))
    : sorted.filter((player) => player.score === topScore);
  const youWin = winners.some((player) => player.id === view.you.id);
  const host = view.players.find((player) => player.id === view.hostId);

  let lastScore: number | null = null;
  let lastRank = 0;
  const ranked = sorted.map((player, index) => {
    if (player.score !== lastScore) {
      lastRank = index + 1;
      lastScore = player.score;
    }
    return { player, rank: lastRank };
  });

  return (
    <section className="phase finished-phase">
      <PhaseHeader
        kicker={`${view.suddenDeath ? "SUDDEN DEATH RESOLVED" : "MATCH COMPLETE"} · ${view.totalRounds} ROUNDS`}
        title="THE ROOM HAS SPOKEN"
        description={youWin
          ? "You read the room better than anyone. The room is yours."
          : `${namesFor(winners)} read the room best this time.`}
        aside={<span className="status-tag status-complete"><i aria-hidden="true" /> MATCH CLOSED</span>}
      />

      <div className={`winner-panel panel ${youWin ? "is-you-win" : ""}`}>
        <span className="eyebrow">FINAL SIGNAL</span>
        <h3>
          {youWin ? "YOU HELD THE SIGNAL." : `${namesFor(winners)} HELD THE SIGNAL.`}
        </h3>
        <div className="winner-score">
          <strong>{topScore}</strong>
          <span>POINTS</span>
        </div>
        <div className="winner-players">
          {winners.map((player) => (
            <span key={player.id} className="winner-chip">
              <PlayerDot color={player.color} />
              {player.name}
              {player.id === view.you.id ? " / YOU" : ""}
            </span>
          ))}
        </div>
        <p className="winner-copy">
          {winners.length > 1
            ? "A joint signal. Nobody blinked first."
            : "One clear frequency. A clean read."}
        </p>
      </div>

      <div className="panel final-board" data-testid="final-scores">
        <div className="final-head">
          <span className="eyebrow">FINAL STANDINGS</span>
          <span className="eyebrow">SCORE</span>
        </div>
        <div className="final-rows">
          {ranked.map(({ player, rank }) => {
            const isWinner = winners.some((winner) => winner.id === player.id);
            const width = topScore > 0 ? Math.max(4, (player.score / topScore) * 100) : 0;
            return (
              <div
                className={`final-row ${player.id === view.you.id ? "is-you" : ""} ${isWinner ? "is-winner" : ""}`}
                key={player.id}
              >
                <span className="final-rank">{String(rank).padStart(2, "0")}</span>
                <PlayerDot color={player.color} />
                <div className="final-name">
                  <b>{player.name}</b>
                  <span>
                    {player.id === view.you.id && <em>YOU</em>}
                    {player.isHost && <em>HOST</em>}
                    {isWinner && <em className="winner-tag">WINNER</em>}
                  </span>
                </div>
                <div className="final-bar" aria-hidden="true">
                  <i style={{ width: `${width}%`, background: player.color }} />
                </div>
                <span className="final-score">{player.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="finished-actions">
        {view.you.isHost ? (
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={onRematch}
            disabled={busy}
            data-testid="rematch"
          >
            {busy ? "RESETTING…" : "RUN IT BACK"}
          </button>
        ) : (
          <div className="waiting-box" role="status">
            <span className="waiting-pulse" aria-hidden="true" />
            <span>WAITING FOR {host?.name ?? "THE HOST"} TO RESTART</span>
          </div>
        )}
        <CopyButton text={shareUrl(view.room)} label="COPY INVITE LINK" />
        <p className="finished-note">
          Same room, same crew. Scores reset and a new Beacon starts.
        </p>
      </div>
    </section>
  );
}
