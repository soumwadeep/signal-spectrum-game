import { useCountdown } from "./time";
import type { GameView, RoundEntry, RoundResult } from "./types";
import { PhaseHeader, PlayerDot, Spectrum, TimerBar } from "./ui";

interface RevealPhaseProps {
  view: GameView;
  busy: boolean;
  offset: number;
  onAdvance: () => void;
  onOpenRules: () => void;
}

function bandLabel(points: number): string {
  if (points === 4) return "BULLSEYE";
  if (points === 3) return "CLOSE";
  if (points === 2) return "NEAR";
  return "ELSEWHERE";
}

function entryDetail(entry: RoundEntry, result: RoundResult): string {
  if (entry.isBeacon) {
    return `CLUE BONUS · ${result.closeOrBetter} CLOSE-OR-BETTER${result.bullseye ? " · BULLSEYE" : ""}`;
  }
  return `GUESS ${entry.guess ?? "—"} · OFF BY ${entry.distance ?? "—"} · ${bandLabel(entry.points)}`;
}

export function RevealPhase({ view, busy, offset, onAdvance, onOpenRules }: RevealPhaseProps) {
  const result = view.roundResult;
  const remaining = useCountdown(view.deadline, offset);
  const poles = view.poles ?? { left: "LEFT", right: "RIGHT" };

  if (!result) {
    return (
      <section className="phase reveal-phase">
        <PhaseHeader kicker="REVEAL" title="READING THE SIGNAL" description="The room is resolving this round." />
        <div className="panel">
          <p>The reveal is on its way. This screen will update automatically.</p>
        </div>
      </section>
    );
  }

  const myEntry = result.entries.find((entry) => entry.playerId === view.you.id);
  const markers = result.entries
    .filter((entry) => !entry.isBeacon && typeof entry.guess === "number")
    .map((entry) => ({
      id: entry.playerId,
      name: entry.name,
      color: entry.color,
      value: entry.guess as number,
    }));
  const nextLabel = view.suddenDeath || view.round >= view.totalRounds
    ? "FINAL RESULT"
    : "NEXT ROUND";
  const remainingSafe = remaining ?? 0;

  return (
    <section className="phase reveal-phase">
      <PhaseHeader
        kicker={`ROUND ${String(view.round).padStart(2, "0")} / ${String(view.totalRounds).padStart(2, "0")} · REVEAL${view.suddenDeath ? " · SUDDEN DEATH" : ""}`}
        title="SIGNAL RECEIVED"
        description={`The target was ${result.target}. Here is where every marker landed.`}
        aside={(
          <div className="delta-badge">
            <span className="eyebrow">THIS ROUND</span>
            <strong>+{myEntry?.points ?? 0}</strong>
            <small>{myEntry?.isBeacon ? "CLUE BONUS" : myEntry ? bandLabel(myEntry.points) : ""}</small>
          </div>
        )}
      />

      <figure className="panel clue-card reveal-clue">
        <figcaption><span className="eyebrow">THE CLUE</span><span className="clue-markers" aria-hidden="true"><i /><i /><i /></span></figcaption>
        <blockquote>“{result.clue}”</blockquote>
      </figure>

      <div className="panel panel-spectrum reveal-spectrum">
        <div className="panel-kicker">
          <span className="eyebrow">ROUND MAP</span>
          <span className="target-pill">TARGET {result.target}</span>
        </div>
        <Spectrum
          left={poles.left}
          right={poles.right}
          mode="reveal"
          target={result.target}
          bands={result.bands}
          markers={markers}
        />
      </div>

      <div className="reveal-grid">
        <div className="panel result-summary">
          <span className="eyebrow">YOUR RESULT</span>
          {myEntry?.isBeacon ? (
            <>
              <h3>YOUR CLUE LANDED</h3>
              <p className="result-headline">
                <strong>+{result.beaconPoints}</strong>
                <span>for the room's guesses</span>
              </p>
              <p className="result-copy">
                {result.closeOrBetter} of {view.guesserCount} landed close or better.
                {result.bullseye ? " Someone hit the bullseye." : " No bullseye this time."}
              </p>
            </>
          ) : myEntry ? (
            <>
              <h3>{bandLabel(myEntry.points)}</h3>
              <p className="result-headline">
                <strong>+{myEntry.points}</strong>
                <span>off by {myEntry.distance}</span>
              </p>
              <p className="result-copy">
                You placed your marker at {myEntry.guess}. The target was {result.target}.
              </p>
            </>
          ) : (
            <p className="result-copy">This round is complete.</p>
          )}
          <div className="beacon-rule">
            <span className="eyebrow">BEACON BONUS</span>
            <p>+1 per guesser who scores 3 or more, capped at 4. +1 more for a bullseye.</p>
          </div>
        </div>

        <div className="panel round-table">
          <div className="round-table-head">
            <span className="eyebrow">THE ROUND</span>
            <span className="eyebrow">ROUND / TOTAL</span>
          </div>
          <div className="round-table-body">
            {result.entries.map((entry) => {
              const player = view.players.find((candidate) => candidate.id === entry.playerId);
              return (
                <div
                  className={`round-row ${entry.playerId === view.you.id ? "is-you" : ""}`}
                  key={entry.playerId}
                >
                  <PlayerDot color={entry.color} />
                  <div className="round-row-name">
                    <b>{entry.name}</b>
                    <span>
                      {entry.playerId === view.you.id && <em>YOU</em>}
                      {entry.isBeacon && <em>BEACON</em>}
                    </span>
                  </div>
                  <div className="round-row-detail">{entryDetail(entry, result)}</div>
                  <div className="round-row-points">+{entry.points}</div>
                  <div className="round-row-total">{player?.score ?? 0}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="reveal-actions">
        {remaining !== null && (
          <TimerBar remaining={remainingSafe} total={20_000} label="NEXT ROUND IN" />
        )}
        <button
          type="button"
          className="btn btn-primary reveal-next"
          onClick={onAdvance}
          disabled={busy}
          data-testid="advance-round"
        >
          {busy ? "MOVING…" : nextLabel}
        </button>
        <div className="reveal-aside">
          <p>Anyone can move the room on. It advances automatically after the countdown.</p>
          <button type="button" className="text-link" onClick={onOpenRules}>HOW SCORING WORKS</button>
        </div>
      </div>
    </section>
  );
}
