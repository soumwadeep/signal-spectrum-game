import { useEffect, useRef, useState } from "react";
import { copyText } from "./clipboard";
import { shareUrl } from "./storage";
import type { ConnectionState, GameView } from "./types";
import { Brand } from "./ui";

interface TopBarProps {
  view: GameView;
  status: ConnectionState;
  busy: boolean;
  onOpenRules: () => void;
  onLeave: () => void;
}

export function TopBar({ view, status, busy, onOpenRules, onLeave }: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const copy = async () => {
    const ok = await copyText(shareUrl(view.room));
    if (!ok) return;
    setCopied(true);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  const roundLabel = view.phase === "lobby"
    ? "LOBBY"
    : view.phase === "finished"
      ? "COMPLETE"
      : view.suddenDeath
        ? "SUDDEN DEATH"
        : `R ${String(view.round).padStart(2, "0")} / ${String(view.totalRounds).padStart(2, "0")}`;

  const connectionLabel = status === "live"
    ? "LINK STABLE"
    : status === "reconnecting"
      ? "SYNCING"
      : "CONNECTING";

  const canLeave = view.phase === "lobby" || view.phase === "finished";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Brand />
        <span className="topbar-divider" aria-hidden="true" />
        <span className="topbar-protocol">SPECTRUM PROTOCOL</span>
      </div>

      <div className="topbar-center">
        <span className="eyebrow room-eyebrow">ROOM</span>
        <button
          type="button"
          className="room-chip"
          onClick={() => void copy()}
          title="Copy the invite link"
        >
          <strong>{view.room}</strong>
          <span>{copied ? "COPIED" : "COPY LINK"}</span>
        </button>
      </div>

      <div className="topbar-right">
        <span className={`connection connection-${status}`}>
          <i aria-hidden="true" />
          <span className="connection-text">{connectionLabel}</span>
        </span>
        <span className="round-chip">{roundLabel}</span>
        <button
          type="button"
          className="icon-button topbar-help"
          onClick={onOpenRules}
          aria-label="How to play"
          title="How to play"
        >
          ?
        </button>
        {canLeave && (
          <div className="leave-wrap">
            <button
              type="button"
              className="btn btn-quiet topbar-leave"
              onClick={() => setLeaving((value) => !value)}
              disabled={busy}
              aria-expanded={leaving}
            >
              LEAVE
            </button>
            {leaving && (
              <div className="leave-pop" role="group" aria-label="Leave room">
                <p>Leave this room?</p>
                <div>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      setLeaving(false);
                      onLeave();
                    }}
                    disabled={busy}
                  >
                    LEAVE
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => setLeaving(false)}
                  >
                    STAY
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
