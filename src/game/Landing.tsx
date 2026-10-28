import type { FormEvent } from "react";
import { useState } from "react";
import { normalizeCode } from "./storage";
import { Brand, PlayerDot, Spectrum } from "./ui";

interface LandingProps {
  busy: boolean;
  error: string | null;
  entryError: string | null;
  lastName: string;
  initialCode: string;
  onCreate: (name: string) => Promise<boolean>;
  onJoin: (code: string, name: string) => Promise<boolean>;
  onOpenRules: () => void;
}

type Mode = "create" | "join";

export function Landing({
  busy,
  error,
  entryError,
  lastName,
  initialCode,
  onCreate,
  onJoin,
  onOpenRules,
}: LandingProps) {
  const [mode, setMode] = useState<Mode>(initialCode ? "join" : "create");
  const [name, setName] = useState(lastName);
  const [code, setCode] = useState(initialCode);
  const [localError, setLocalError] = useState<string | null>(null);

  const message = localError ?? error ?? (mode === "join" ? entryError : null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setLocalError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    const cleanName = name.trim();
    if (!cleanName) {
      setLocalError("Add a name so the room knows who you are.");
      return;
    }
    if ([...cleanName].length > 16) {
      setLocalError("Keep your name to 16 characters or fewer.");
      return;
    }
    if (mode === "create") {
      void onCreate(cleanName);
      return;
    }
    const cleanCode = normalizeCode(code);
    if (cleanCode.length !== 4) {
      setLocalError("Room codes are 4 characters. Check the code and try again.");
      return;
    }
    void onJoin(cleanCode, cleanName);
  };

  return (
    <main className="landing">
      <section className="landing-intro">
        <Brand large sub />
        <p className="eyebrow hero-eyebrow">A real-time party game / 2–8 players</p>
        <h1 className="hero-title">
          Find the
          <br />
          <span className="accent">frequency.</span>
        </h1>
        <p className="hero-lede">
          One player, the Beacon, sees a hidden point on a spectrum. They give one clue.
          Everyone else reads it, dials in, and scores by how close they land. A clue that
          lands for the room scores for the Beacon, too.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn btn-ghost" onClick={onOpenRules}>
            HOW TO PLAY
          </button>
          <span className="hero-note">NO DOWNLOADS · ONE PHONE EACH</span>
        </div>

      </section>

      <section className="landing-access" aria-label="Enter a room">
        <form className="access-card" onSubmit={handleSubmit}>
          <div className="access-top">
            <span className="eyebrow">Signal access</span>
            <span className="live-label"><i /> READY</span>
          </div>
          <h2 className="access-title">{mode === "create" ? "OPEN A ROOM" : "JOIN A ROOM"}</h2>
          <p className="access-sub">
            {mode === "create"
              ? "Start a room, share the 4-letter code, and wait for your people."
              : initialCode
                ? `You're joining room ${initialCode}. Pick a name and open the channel.`
                : "Enter the 4-letter room code from your host."}
          </p>

          <div className="mode-switch" role="group" aria-label="Choose room action">
            <button
              type="button"
              className={mode === "create" ? "is-active" : ""}
              aria-pressed={mode === "create"}
              onClick={() => switchMode("create")}
              data-testid="mode-host"
            >
              HOST
            </button>
            <button
              type="button"
              className={mode === "join" ? "is-active" : ""}
              aria-pressed={mode === "join"}
              onClick={() => switchMode("join")}
              data-testid="mode-join"
            >
              JOIN
            </button>
          </div>

          {message && (
            <div className="form-alert" role="alert">
              <span className="alert-line" aria-hidden="true" />
              <p>{message}</p>
            </div>
          )}

          <label className="field">
            <span>OPERATOR NAME</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={16}
              placeholder="What should the room call you?"
              autoComplete="nickname"
              spellCheck={false}
              disabled={busy}
              data-testid="name-input"
            />
          </label>

          {mode === "join" && (
            <label className="field">
              <span>ROOM FREQUENCY</span>
              <input
                className="code-input"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
                maxLength={4}
                placeholder="7K2M"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                disabled={busy}
                data-testid="code-input"
              />
            </label>
          )}

          <button type="submit" className="btn btn-primary btn-wide" disabled={busy} data-testid="access-submit">
            {busy
              ? "OPENING CHANNEL…"
              : mode === "create" ? "CREATE ROOM" : "JOIN THE ROOM"}
          </button>

          <p className="form-foot">
            No account. No install. Works on any phone, tablet, or laptop.
          </p>
        </form>

        <button type="button" className="text-link access-rules" onClick={onOpenRules}>
          Read the full rules
        </button>
      </section>

      <section className="landing-hero-extra" aria-label="How a round works">
        <div className="landing-demo" aria-hidden="true">
          <div className="demo-head">
            <span className="eyebrow">A round, roughly</span>
            <span className="live-label"><i /> LIVE</span>
          </div>
          <div className="demo-clue">
            <span className="demo-beacon"><PlayerDot color="#ffc266" /> BEACON</span>
            <b>“my browser tabs”</b>
          </div>
          <Spectrum
            left="CHAOTIC"
            right="ORGANIZED"
            mode="reveal"
            target={72}
            markers={[
              { id: "demo-a", name: "Sam", color: "#ffc266", value: 66 },
              { id: "demo-b", name: "Ira", color: "#76d6ff", value: 81 },
            ]}
          />
          <div className="demo-score">
            <span><i className="dot-mint" /> YOU +3</span>
            <span><i className="dot-amber" /> SAM +4</span>
            <span><i className="dot-sky" /> IRA +2</span>
          </div>
        </div>

        <div className="hero-steps">
          <div>
            <span>01</span>
            <p><b>ONE BEACON</b>Sees the hidden target.</p>
          </div>
          <div>
            <span>02</span>
            <p><b>ONE CLUE</b>Five words or fewer.</p>
          </div>
          <div>
            <span>03</span>
            <p><b>EVERYONE DIALS</b>Closer is better.</p>
          </div>
        </div>

      </section>


      <footer className="landing-footer">
        <span>SIGNAL / SPECTRUM PROTOCOL</span>
        <span>2–8 PLAYERS · ONE ROOM CODE</span>
      </footer>
    </main>
  );
}
