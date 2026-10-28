import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { GameView } from "./types";
import { PhaseHeader, PlayerDot, Spectrum } from "./ui";

interface CluePhaseProps {
  view: GameView;
  busy: boolean;
  onClue: (clue: string) => Promise<boolean>;
  onOpenRules: () => void;
}

export function CluePhase({ view, busy, onClue, onOpenRules }: CluePhaseProps) {
  const beacon = view.players.find((player) => player.id === view.beaconId);
  const isBeacon = view.you.isBeacon;
  const [clue, setClue] = useState("");

  useEffect(() => {
    setClue("");
  }, [view.round]);

  const poles = view.poles ?? { left: "LEFT", right: "RIGHT" };
  const words = clue.trim() ? clue.trim().split(/\s+/).length : 0;
  const hasNumber = /\d/.test(clue);
  const tooManyWords = words > 5;
  const tooLong = clue.length > 60;
  const issue = hasNumber
    ? "No numbers. Words only."
    : tooManyWords
      ? "Five words maximum."
      : tooLong
        ? "Sixty characters maximum."
        : null;
  const canSend = isBeacon
    && !busy
    && clue.trim().length > 0
    && !hasNumber
    && !tooManyWords
    && !tooLong;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    void onClue(clue.trim());
  };

  return (
    <section className="phase clue-phase">
      <PhaseHeader
        kicker={`ROUND ${String(view.round).padStart(2, "0")} / ${String(view.totalRounds).padStart(2, "0")} · CLUE${view.suddenDeath ? " · SUDDEN DEATH" : ""}`}
        title={isBeacon ? "SEND THE CLUE" : "THE BEACON IS THINKING"}
        description={isBeacon
          ? "You can see the target. Point the room at it with one short clue."
          : `${beacon?.name ?? "The Beacon"} can see the target. Their clue lands here.`}
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

      <div className="clue-layout">
        <div className="panel spectrum-panel">
          <div className="panel-kicker">
            <span className="eyebrow">ROUND SPECTRUM</span>
            {isBeacon ? (
              <span className="target-pill">TARGET {view.target}</span>
            ) : (
              <span className="masked-pill">TARGET MASKED</span>
            )}
          </div>
          <Spectrum
            left={poles.left}
            right={poles.right}
            mode={isBeacon ? "target" : "masked"}
            target={view.target}
            bands={view.bands}
          />
          <p className="panel-note">
            {isBeacon
              ? "Only your screen shows this target. The room sees the two poles and nothing else."
              : "The target is hidden from everyone except the Beacon. Read the clue, not the dial."}
          </p>
        </div>

        {isBeacon ? (
          <div className="panel clue-side">
            <div className="panel-kicker">
              <span className="eyebrow">CLUE TRANSMISSION</span>
              <span className={`word-count ${tooManyWords ? "is-over" : ""}`}>{words} / 5 WORDS</span>
            </div>
            <p className="clue-prompt">
              Aim for <strong>{view.target}</strong> on this spectrum. One clue. Make it land.
            </p>
            <form className="clue-form" onSubmit={submit}>
              <label className="sr-only" htmlFor="clue-field">Your clue</label>
              <input
                id="clue-field"
                className="clue-input"
                value={clue}
                onChange={(event) => setClue(event.target.value)}
                placeholder="e.g. my browser tabs"
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                aria-describedby="clue-hint"
                data-testid="clue-input"
              />
              <p id="clue-hint" className={`field-hint ${issue ? "is-error" : ""}`} aria-live="polite">
                {issue ?? "A thing or situation. No numbers, no pole words, no obvious synonyms."}
              </p>
              <button
                type="submit"
                className="btn btn-primary btn-wide"
                disabled={!canSend}
                data-testid="send-clue"
              >
                {busy ? "SENDING…" : "SEND CLUE"}
              </button>
            </form>
            <div className="tip-card">
              <span className="eyebrow">GOOD CLUE / EXAMPLE</span>
              <p>“my browser tabs” points near ORGANIZED. A description like “quite organized” does not count.</p>
              <button type="button" className="text-link" onClick={onOpenRules}>SCORING &amp; RULES</button>
            </div>
          </div>
        ) : (
          <div className="panel clue-side transmission-panel">
            <div className="panel-kicker">
              <span className="eyebrow">INBOUND TRANSMISSION</span>
              <span className="inbound-led"><i aria-hidden="true" /> LISTENING</span>
            </div>
            <div className="transmission-visual" aria-hidden="true">
              {Array.from({ length: 28 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    height: `${22 + ((index * 13) % 62)}%`,
                    animationDelay: `${index * 55}ms`,
                  }}
                />
              ))}
            </div>
            <p className="transmission-title">Waiting on {beacon?.name ?? "the Beacon"}.</p>
            <p className="transmission-sub">
              They see the target and are choosing their words. When the clue lands,
              you will have thirty seconds to dial in.
            </p>
            <div className="mini-rule-list">
              <div><span>01</span><p>Read the clue as a thing or a situation.</p></div>
              <div><span>02</span><p>Place your marker where it feels true.</p></div>
              <div><span>03</span><p>Closer to the hidden target scores more.</p></div>
            </div>
            <button type="button" className="text-link" onClick={onOpenRules}>HOW SCORING WORKS</button>
          </div>
        )}
      </div>
    </section>
  );
}
