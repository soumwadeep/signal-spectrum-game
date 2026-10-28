import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useRef, useState } from "react";
import { copyText } from "./clipboard";
import { secondsLabel } from "./time";
import type { PlayerView } from "./types";

export function SignalMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="signal-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeOpacity="0.42" />
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeOpacity="0.22" />
      <circle cx="16" cy="16" r="1.8" fill="currentColor" />
      <path
        d="M2.8 16h6.1l2.6-6.2 4.1 13.4 3.1-7.2h10.5"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand({ large = false, sub = false }: { large?: boolean; sub?: boolean }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <SignalMark size={large ? 38 : 26} />
      <span className="brand-word">SIGNAL</span>
      {sub && <span className="brand-sub">SPECTRUM PROTOCOL</span>}
    </div>
  );
}

export function PlayerDot({ color, ring = false }: { color: string; ring?: boolean }) {
  return (
    <span
      className={`player-dot ${ring ? "player-dot-ring" : ""}`}
      style={{ "--dot": color } as CSSProperties}
      aria-hidden="true"
    />
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ScoreStrip({
  players,
  youId,
  beaconId,
}: {
  players: PlayerView[];
  youId: string;
  beaconId: string | null;
}) {
  return (
    <div className="score-strip" aria-label="Scores">
      {players.map((player) => (
        <div
          className={`score-chip ${player.id === youId ? "is-you" : ""}`}
          key={player.id}
          aria-label={`${player.name}: ${player.score} points${player.id === beaconId ? ", beacon" : ""}${player.id === youId ? ", you" : ""}`}
        >
          <PlayerDot color={player.color} ring={player.id === beaconId} />
          <span className="score-name">{player.name}</span>
          {player.id === beaconId && <span className="mini-tag" title="Beacon">B</span>}
          {player.id === youId && <span className="mini-tag you-tag">YOU</span>}
          <span className="score-number">{player.score}</span>
        </div>
      ))}
    </div>
  );
}

export function PhaseHeader({
  kicker,
  title,
  description,
  aside,
}: {
  kicker: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <header className="phase-head">
      <div className="phase-head-copy">
        <p className="eyebrow">{kicker}</p>
        <h2 className="phase-title">{title}</h2>
        {description && <p className="phase-desc">{description}</p>}
      </div>
      {aside && <div className="phase-aside">{aside}</div>}
    </header>
  );
}

export function TimerBar({
  remaining,
  total,
  label,
}: {
  remaining: number;
  total: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const low = remaining <= 5000;
  return (
    <div className={`timer ${low ? "timer-low" : ""}`} role="timer" aria-label={`${label}: ${secondsLabel(remaining)}`}>
      <div className="timer-meta">
        <span>{label}</span>
        <span className="timer-number">{secondsLabel(remaining)}</span>
      </div>
      <div className="timer-track" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function InlineBanner({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="inline-banner" role="alert">
      <span className="banner-led" aria-hidden="true" />
      <p>{message}</p>
      <button type="button" className="banner-close" onClick={onClose} aria-label="Dismiss message">
        ×
      </button>
    </div>
  );
}

export function CopyButton({
  text,
  label = "COPY LINK",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const handleCopy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      className={`btn btn-ghost copy-button ${className}`}
      onClick={() => void handleCopy()}
    >
      {copied ? "COPIED" : label}
      <span className="sr-only" role="status">{copied ? "Copied to clipboard" : ""}</span>
    </button>
  );
}

export interface SpectrumMarker {
  id: string;
  name: string;
  color: string;
  value: number;
}

export interface SpectrumProps {
  left: string;
  right: string;
  mode: "masked" | "target" | "guess" | "reveal";
  target?: number | null;
  bands?: number[];
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  markers?: SpectrumMarker[];
}

function clampFrequency(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function Spectrum({
  left,
  right,
  mode,
  target = null,
  bands = [7, 15, 25],
  value = 50,
  onChange,
  disabled = false,
  markers = [],
}: SpectrumProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const interactive = mode === "guess" && Boolean(onChange) && !disabled;
  const showTarget = (mode === "target" || mode === "reveal") && typeof target === "number";
  const safeValue = clampFrequency(value);

  const updateFromClientX = (clientX: number) => {
    if (!interactive || !onChange) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    onChange(clampFrequency(percent));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateFromClientX(event.clientX);
  };

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onChange) return;
    let next = safeValue;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += 1;
    else if (event.key === "PageDown") next -= 10;
    else if (event.key === "PageUp") next += 10;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 100;
    else return;
    event.preventDefault();
    onChange(clampFrequency(next));
  };

  const bandLayers = [...bands]
    .map((width, index) => ({
      width,
      className: index === 0 ? "band-bullseye" : index === 1 ? "band-close" : "band-near",
    }))
    .sort((a, b) => b.width - a.width);

  const ariaLabel = mode === "masked"
    ? `Spectrum from ${left} to ${right}. The target is hidden.`
    : mode === "guess"
      ? `Frequency dial from ${left} to ${right}. Current value ${safeValue}.`
      : `Spectrum from ${left} to ${right}. Target at ${target ?? "unknown"}.`;

  return (
    <div className={`spectrum spectrum-${mode}`}>
      <div className="spectrum-top">
        <span className="spectrum-pole pole-left">{left}</span>
        <span className="spectrum-mode">
          {mode === "masked" && "SIGNAL MASKED"}
          {mode === "target" && "TARGET LOCKED"}
          {mode === "guess" && "YOUR FREQUENCY"}
          {mode === "reveal" && "SIGNAL MAP"}
        </span>
        <span className="spectrum-pole pole-right">{right}</span>
      </div>

      <div className="spectrum-dial">
        <div className="dial-topline">
          {mode === "guess" && (
            <>
              <span className="dial-readout">{String(safeValue).padStart(3, "0")}</span>
              <span className="dial-unit">/ 100</span>
            </>
          )}
          {mode === "target" && (
            <>
              <span className="dial-readout target-readout">{String(target ?? 0).padStart(3, "0")}</span>
              <span className="dial-unit">TARGET</span>
            </>
          )}
          {mode === "reveal" && (
            <>
              <span className="dial-readout target-readout">{String(target ?? 0).padStart(3, "0")}</span>
              <span className="dial-unit">TARGET</span>
            </>
          )}
          {mode === "masked" && <span className="dial-masked">•••</span>}
        </div>

        <div
          ref={fieldRef}
          className={`dial-field ${dragging ? "is-dragging" : ""} ${interactive ? "is-interactive" : ""}`}
          role={interactive ? "slider" : "img"}
          aria-label={ariaLabel}
          aria-valuemin={interactive ? 0 : undefined}
          aria-valuemax={interactive ? 100 : undefined}
          aria-valuenow={interactive ? safeValue : undefined}
          aria-valuetext={interactive ? `${safeValue} out of 100` : undefined}
          tabIndex={interactive ? 0 : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onLostPointerCapture={() => setDragging(false)}
          onKeyDown={handleKeyDown}
          data-testid="frequency-dial"
        >
          <div className="dial-rail" aria-hidden="true" />
          <div className="dial-ticks" aria-hidden="true" />
          <div className="dial-major-ticks" aria-hidden="true">
            {Array.from({ length: 21 }, (_, index) => (
              <i key={index} style={{ left: `${index * 5}%` }} />
            ))}
          </div>

          {showTarget && target !== null && (
            <>
              {bandLayers.map((band) => {
                const start = Math.max(0, target - band.width);
                const end = Math.min(100, target + band.width);
                return (
                  <div
                    key={band.className}
                    className={`dial-band ${band.className}`}
                    style={{ left: `${start}%`, width: `${end - start}%` }}
                    aria-hidden="true"
                  />
                );
              })}
              <div className="target-line" style={{ left: `${target}%` }} aria-hidden="true">
                <span className="target-tag">TARGET {target}</span>
              </div>
            </>
          )}

          {mode === "guess" && (
            <div className="needle" style={{ left: `${safeValue}%` }} aria-hidden="true">
              <span className="needle-cap" />
              <span className="needle-pole" />
            </div>
          )}

          {mode === "reveal" && markers.map((marker, index) => (
            <div
              key={marker.id}
              className={`guess-marker ${index % 2 === 0 ? "marker-up" : "marker-down"}`}
              style={{ left: `${marker.value}%`, "--marker": marker.color } as CSSProperties}
              title={`${marker.name}: ${marker.value}`}
              aria-hidden="true"
            >
              <span className="marker-pill">
                <i />
                {initials(marker.name)}
                <b>{marker.value}</b>
              </span>
              <span className="marker-pole" />
            </div>
          ))}

          {mode === "masked" && (
            <div className="mask-plate" aria-hidden="true">
              <span>ENCRYPTED</span>
              <i />
            </div>
          )}

          <div className="dial-scale" aria-hidden="true">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <div className="spectrum-foot">
        {showTarget ? (
          <span>BULLSEYE ±{bands[0]} · CLOSE ±{bands[1]} · NEAR ±{bands[2]}</span>
        ) : mode === "masked" ? (
          <span>ONLY THE BEACON SEES THE TARGET</span>
        ) : (
          <span>DRAG THE NEEDLE OR USE ARROW KEYS</span>
        )}
        {mode === "guess" && <span className="foot-right">LOCK WHEN READY</span>}
        {mode === "reveal" && <span className="foot-right">CLOSER IS BETTER</span>}
      </div>
    </div>
  );
}
