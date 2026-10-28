import { useCallback, useEffect, useState } from "react";
import { CluePhase } from "./CluePhase";
import { FinishedPhase } from "./FinishedPhase";
import { GuessPhase } from "./GuessPhase";
import { Landing } from "./Landing";
import { Lobby } from "./Lobby";
import { Reconnect } from "./Reconnect";
import { RevealPhase } from "./RevealPhase";
import { RulesDialog } from "./RulesDialog";
import { TopBar } from "./TopBar";
import { readPrefillRoom, replaceRoomInUrl, RULES_KEY } from "./storage";
import { useServerOffset } from "./time";
import { InlineBanner, ScoreStrip } from "./ui";
import { useGame } from "./useGame";
import type { GameView } from "./types";

function announcementFor(view: GameView): string {
  if (view.phase === "lobby") {
    return `Lobby. ${view.players.length} of ${view.maxPlayers} players in the room.`;
  }
  if (view.phase === "finished") {
    return "Match complete. Final standings are on screen.";
  }
  const round = `Round ${view.round} of ${view.totalRounds}.`;
  if (view.phase === "clue") {
    return `${round} ${view.you.isBeacon ? "You are the Beacon. Send a clue." : "The Beacon is choosing a clue."}`;
  }
  if (view.phase === "guess") {
    return `${round} ${view.you.isBeacon ? "The room is guessing." : view.you.hasGuessed ? "Your guess is locked." : "Find the frequency and lock a guess."}`;
  }
  return `${round} Reveal. Check the target and everyone's markers.`;
}

export function GameApp() {
  const game = useGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [initialCode] = useState(() => readPrefillRoom());
  const offset = useServerOffset(game.view?.serverNow);

  const openRules = useCallback(() => {
    try {
      localStorage.setItem(RULES_KEY, "1");
    } catch {
      // Reading the rules does not depend on storage.
    }
    setRulesOpen(true);
  }, []);

  const closeRules = useCallback(() => setRulesOpen(false), []);

  useEffect(() => {
    if (!game.view) return;
    replaceRoomInUrl(game.view.room);
    try {
      if (!localStorage.getItem(RULES_KEY)) {
        localStorage.setItem(RULES_KEY, "1");
        setRulesOpen(true);
      }
    } catch {
      // The rules button remains available.
    }
  }, [game.view?.room]);

  if (!game.session) {
    return (
      <div className="signal-app">
        <Landing
          busy={game.busy}
          error={game.error}
          entryError={game.entryError}
          lastName={game.lastName}
          initialCode={initialCode}
          onCreate={game.create}
          onJoin={game.join}
          onOpenRules={openRules}
        />
        <RulesDialog open={rulesOpen} onClose={closeRules} />
      </div>
    );
  }

  if (!game.view) {
    return (
      <div className="signal-app">
        <Reconnect
          room={game.session.code}
          name={game.session.name}
          status={game.status}
          onRetry={() => void game.retry()}
          onForget={game.forget}
        />
        <RulesDialog open={rulesOpen} onClose={closeRules} />
      </div>
    );
  }

  const view = game.view;
  const showScores = view.phase === "clue" || view.phase === "guess" || view.phase === "reveal";

  return (
    <div className="signal-app">
      <div className="app-frame">
        <TopBar
          view={view}
          status={game.status}
          busy={game.busy}
          onOpenRules={openRules}
          onLeave={() => void game.leave()}
        />

        {game.error && (
          <InlineBanner message={game.error} onClose={game.clearError} />
        )}

        <main className={`game-main phase-${view.phase}`}>
          {showScores && (
            <ScoreStrip players={view.players} youId={view.you.id} beaconId={view.beaconId} />
          )}

          {view.phase === "lobby" && (
            <Lobby
              view={view}
              busy={game.busy}
              onStart={() => void game.start()}
              onOpenRules={openRules}
            />
          )}

          {view.phase === "clue" && (
            <CluePhase
              view={view}
              busy={game.busy}
              onClue={game.submitClue}
              onOpenRules={openRules}
            />
          )}

          {view.phase === "guess" && (
            <GuessPhase
              view={view}
              busy={game.busy}
              offset={offset}
              onGuess={game.submitGuess}
              onOpenRules={openRules}
            />
          )}

          {view.phase === "reveal" && (
            <RevealPhase
              view={view}
              busy={game.busy}
              offset={offset}
              onAdvance={() => void game.advance()}
              onOpenRules={openRules}
            />
          )}

          {view.phase === "finished" && (
            <FinishedPhase view={view} busy={game.busy} onRematch={() => void game.rematch()} />
          )}
        </main>

        <footer className="game-footer">
          <span>SIGNAL / SPECTRUM PROTOCOL</span>
          <span>ROOM {view.room} · {view.players.length} OPERATORS</span>
        </footer>
      </div>

      <RulesDialog open={rulesOpen} onClose={closeRules} />
      <p className="sr-only" role="status" aria-live="polite">{announcementFor(view)}</p>
    </div>
  );
}
