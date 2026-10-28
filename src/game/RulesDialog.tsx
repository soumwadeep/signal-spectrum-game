import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        className="rules-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        ref={dialogRef}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">FIELD MANUAL / SIGNAL</p>
            <h2 id="rules-title">HOW TO PLAY</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Close rules"
          >
            ×
          </button>
        </div>

        <div className="rules-body">
          <p className="rules-lede">
            One player can see the hidden point on a spectrum. Everyone else reads their clue
            and places a marker. The closer you land, the more you score.
          </p>

          <ol className="rules-steps">
            <li>
              <span className="step-number">1</span>
              <p><b>One Beacon.</b> Only the Beacon sees the target on this round's spectrum.</p>
            </li>
            <li>
              <span className="step-number">2</span>
              <p><b>One clue.</b> The Beacon gives up to five words that point toward the target. No numbers, no spectrum words, no obvious synonyms.</p>
            </li>
            <li>
              <span className="step-number">3</span>
              <p><b>Everyone dials.</b> All other players secretly place a marker, then lock in. Thirty seconds. No discussing a guess before the reveal.</p>
            </li>
            <li>
              <span className="step-number">4</span>
              <p><b>Reveal and score.</b> The target appears, every marker is shown, and the next Beacon takes over.</p>
            </li>
          </ol>

          <section className="rules-score" aria-labelledby="rules-scoring">
            <div className="rules-score-head">
              <h3 id="rules-scoring">SCORING</h3>
              <span className="eyebrow">DISTANCE FROM THE TARGET</span>
            </div>
            <div className="mini-spectrum" aria-hidden="true">
              <span className="mini-band mini-near" />
              <span className="mini-band mini-close" />
              <span className="mini-band mini-bullseye" />
              <span className="mini-target" />
              <span className="mini-caption caption-left">NEAR</span>
              <span className="mini-caption caption-close">CLOSE</span>
              <span className="mini-caption caption-bullseye">BULLSEYE</span>
            </div>
            <table className="score-table">
              <tbody>
                <tr><th scope="row">BULLSEYE</th><td>Within 7</td><td>4 points</td></tr>
                <tr><th scope="row">CLOSE</th><td>Within 15</td><td>3 points</td></tr>
                <tr><th scope="row">NEAR</th><td>Within 25</td><td>2 points</td></tr>
                <tr><th scope="row">ELSEWHERE</th><td>Anywhere else</td><td>1 point</td></tr>
              </tbody>
            </table>
            <p className="score-note">
              Beacon bonus: <b>+1</b> for each guesser who scores 3 or more, up to 4 points,
              plus <b>+1</b> if anyone hits the bullseye. A good clue pays.
            </p>
          </section>

          <div className="rules-grid">
            <div>
              <h3>A GOOD CLUE</h3>
              <p>
                It is a thing or a situation, not a description of the spectrum. For a target
                near <em>ORGANIZED</em>, try "my browser tabs." Keep it surprising.
              </p>
            </div>
            <div>
              <h3>THE MATCH</h3>
              <p>
                Everyone gets a turn as Beacon. In a 2 or 3 player game, everyone gets two turns.
                Highest total wins. A tie for first goes to one sudden-death round.
              </p>
            </div>
            <div>
              <h3>IF TIME RUNS OUT</h3>
              <p>
                If you do not lock in, your current marker is submitted for you when time runs
                low. If you never touched the dial, it stays at the center. A locked guess cannot be changed.
              </p>
            </div>
            <div>
              <h3>ON THE DIAL</h3>
              <p>
                Drag with a finger or mouse, or use the arrow keys. The rings show the four scoring
                zones. Your guess stays hidden until the reveal.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="eyebrow">2–8 PLAYERS · ONE ROOM CODE · NO DOWNLOADS</span>
          <button type="button" className="btn btn-primary" onClick={onClose}>GOT IT</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
