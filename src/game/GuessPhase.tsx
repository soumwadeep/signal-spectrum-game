import { useEffect, useRef, useState } from "react";
import { secondsLabel, useCountdown } from "./time";
import type { GameView } from "./types";
import { PhaseHeader, PlayerDot, Spectrum, TimerBar } from "./ui";

interface GuessPhaseProps {
  view: GameView;
  busy: boolean;
  offset: number;
  onGuess: (value: number) => Promise<boolean>;
  onOpenRules: () => void;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function LockRoster({ view }: { view: GameView }) {
  const guessers = view.players.filter((player) => player.id !== view.beaconId);
  return (
    <div className="lock-roster">
      <div className="lock-head">
        <span className="eyebrow">ROOM STATUS</span>
        <span className="lock-count">{view.lockedCount} / {view.guesserCount} LOCKED</span>
      </div>
      <div className="lock-chips">
        {guessers.map((player) => (
          <div className={`lock-chip ${player.hasGuessed ? "is-locked" : ""}`} key={player.id}>
            <PlayerDot color={player.color} />
            <span>{player.name}</span>
            <b>{player.hasGuessed ? "LOCKED" : "DIALING"}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuessPhase({ view, busy, offset, onGuess, onOpenRules }: GuessPhaseProps) {
  const beacon = view.players.find((player) => player.id === view.beaconId);
  const isBeacon = view.you.isBeacon;
  const locked = view.you.hasGuessed;
  const remaining = useCountdown(view.deadline, offset);
  const [value, setValue] = useState(clamp(view.yourGuess ?? 50));
  const [sending, setSending] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const autoLocked = useRef(false);

  useEffect(() => {
    setValue(clamp(view.yourGuess ?? 50));
  }, [view.round, view.yourGuess]);

  useEffect(() => {
    autoLocked.current = false;
  }, [view.round]);

  const send = async (next: number) => {
    if (sending || busy || locked || isBeacon) return;
    setSending(true);
    try {
      await onGuess(clamp(next));
    } finally {
      setSending(false);
    }
  };

  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (isBeacon || locked || autoLocked.current || sending) return;
    if (remaining === null) return;
    if (remaining <= 2000) {
      autoLocked.current = true;
      void sendRef.current(valueRef.current);
    }
  }, [remaining, isBeacon, locked, sending]);

  const poles = view.poles ?? { left: "LEFT", right: "RIGHT" };
  const autoSoon = !isBeacon && !locked && remaining !== null && remaining <= 5000;
  const displayValue = locked ? (view.yourGuess ?? value) : value;

  return (
    <section className="phase guess-phase">
      <PhaseHeader
        kicker={`ROUND ${String(view.round).padStart(2, "0")} / ${String(view.totalRounds).padStart(2, "0")} · DIAL IN${view.suddenDeath ? " · SUDDEN DEATH" : ""}`}
        title={isBeacon ? "WATCH THE ROOM DIAL" : "FIND THE FREQUENCY"}
        description={isBeacon
          ? "Your clue is out. You can see the target; the room cannot."
          : `Where did ${beacon?.name ?? "the Beacon"}'s clue land?`}
        aside={(
          <div className="beacon-aside">
            <PlayerDot color={beacon?.color ?? "#77ffb4"} ring />
            <div>
              <span className="eyebrow">BEACON</span>
              <b>{beacon?.name ?? "—"}{isBeacon ? " / YOU" : ""}</b>
            </div>
          </div>
        )}
      />

      <figure className="panel clue-card">
        <figcaption>
          <span className="eyebrow">CLUE FROM {beacon?.name ?? "THE BEACON"}</span>
          <span className="clue-markers" aria-hidden="true"><i /><i /><i /></span>
        </figcaption>
        <blockquote>“{view.clue ?? "…"}”</blockquote>
      </figure>

      <div className="guess-board">
        <div className="panel spectrum-panel">
          <div className="panel-kicker">
            <span className="eyebrow">THE DIAL</span>
            {isBeacon ? (
              <span className="target-pill">TARGET {view.target}</span>
            ) : (
              <span className="masked-pill">TARGET MASKED</span>
            )}
          </div>
          <Spectrum
            left={poles.left}
            right={poles.right}
            mode={isBeacon ? "target" : "guess"}
            target={isBeacon ? view.target : null}
            bands={view.bands}
            value={displayValue}
            onChange={(next) => {
              if (!locked && !busy && !sending) setValue(next);
            }}
            disabled={locked || busy || sending}
          />
          <p className="panel-note">
            {isBeacon
              ? "Only you can see the target. The room sees the clue and an empty dial."
              : locked
                ? "Your guess is sealed. It stays hidden until every marker is revealed."
                : "Drag the needle or use the arrow keys, then lock it in. Your guess stays private."}
          </p>
        </div>

        <div className="panel guess-side">
          {remaining !== null && (
            <TimerBar remaining={remaining} total={30_000} label={isBeacon ? "ROOM TIME LEFT" : "TIME TO LOCK"} />
          )}

          {isBeacon ? (
            <div className="beacon-wait">
              <span className="eyebrow">YOUR JOB IS DONE</span>
              <h3>THE ROOM IS DIALING</h3>
              <p>
                You sent the clue. Everyone else is placing a marker. You will see every guess
                at the reveal.
              </p>
              <div className="readout-big">
                <span>{view.lockedCount}</span>
                <small>OF {view.guesserCount} LOCKED</small>
              </div>
            </div>
          ) : locked ? (
            <div className="locked-card">
              <span className="eyebrow">FREQUENCY SEALED</span>
              <div className="locked-value">{String(displayValue).padStart(3, "0")}</div>
              <p>
                Your marker is in. It stays hidden until the reveal. Waiting on the rest of the room.
              </p>
            </div>
          ) : (
            <div className="lock-controls">
              <span className="eyebrow">YOUR MARKER</span>
              <div className="lock-value">
                {String(displayValue).padStart(3, "0")}
                <small>/ 100</small>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-wide"
                onClick={() => void send(value)}
                disabled={sending || busy}
                data-testid="lock-guess"
              >
                {sending ? "LOCKING…" : "LOCK FREQUENCY"}
              </button>
              <p className={`field-hint ${autoSoon ? "is-warning" : ""}`}>
                {autoSoon
                  ? `Auto-locking in ${secondsLabel(remaining ?? 0)}`
                  : "No one sees your marker until reveal."}
              </p>
            </div>
          )}

          <LockRoster view={view} />

          <div className="guess-side-foot">
            <button type="button" className="text-link" onClick={onOpenRules}>SCORING &amp; RULES</button>
            <span className="faint">CLOSER IS BETTER</span>
          </div>
        </div>
      </div>
    </section>
  );
}
