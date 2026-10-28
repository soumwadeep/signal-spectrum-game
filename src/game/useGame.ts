import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceRoom,
  ApiError,
  createRoom,
  joinRoom,
  leaveRoom,
  rematchRoom,
  sendClue,
  sendGuess,
  startRoom,
  syncRoom,
} from "./api";
import { isSessionLost, messageFor } from "./messages";
import { readName, readSession, writeName, writeSession } from "./storage";
import type { ConnectionState, GameView, Session, ViewResult } from "./types";

function errorCode(error: unknown): string {
  return error instanceof ApiError ? error.code : "network";
}

export interface GameController {
  session: Session | null;
  view: GameView | null;
  status: ConnectionState;
  busy: boolean;
  error: string | null;
  entryError: string | null;
  lastName: string;
  create: (name: string) => Promise<boolean>;
  join: (code: string, name: string) => Promise<boolean>;
  start: () => Promise<boolean>;
  submitClue: (clue: string) => Promise<boolean>;
  submitGuess: (value: number) => Promise<boolean>;
  advance: () => Promise<boolean>;
  rematch: () => Promise<boolean>;
  leave: () => Promise<void>;
  forget: () => void;
  retry: () => Promise<void>;
  clearError: () => void;
  clearEntryError: () => void;
}

export function useGame(): GameController {
  const initialSession = useRef<Session | null | undefined>(undefined);
  if (initialSession.current === undefined) initialSession.current = readSession();

  const [session, setSession] = useState<Session | null>(initialSession.current ?? null);
  const [view, setView] = useState<GameView | null>(null);
  const [status, setStatus] = useState<ConnectionState>(
    initialSession.current ? "boot" : "idle",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [lastName, setLastName] = useState(() => readName());

  const applyView = useCallback((incoming: GameView) => {
    setView((current) => {
      if (current
        && current.room === incoming.room
        && Number.isFinite(incoming.revision)
        && incoming.revision < current.revision) {
        return current;
      }
      return incoming;
    });
  }, []);

  const forget = useCallback(() => {
    writeSession(null);
    setSession(null);
    setView(null);
    setStatus("idle");
    setError(null);
  }, []);

  const handleLostSession = useCallback((code: string) => {
    writeSession(null);
    setSession(null);
    setView(null);
    setStatus("idle");
    setError(null);
    setEntryError(messageFor(code));
  }, []);

  useEffect(() => {
    if (!session) {
      setStatus("idle");
      return;
    }

    const currentSession = session;
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    let timer: number | undefined;

    function schedule(delay: number) {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(tick, delay);
    }

    async function tick() {
      if (cancelled || inFlight) return;
      if (document.hidden) {
        schedule(2500);
        return;
      }
      inFlight = true;
      try {
        const result = await syncRoom(currentSession);
        if (cancelled) return;
        applyView(result.view);
        setStatus("live");
        failures = 0;
      } catch (caught) {
        if (cancelled) return;
        const code = errorCode(caught);
        if (isSessionLost(code)) {
          handleLostSession(code);
          return;
        }
        failures += 1;
        setStatus("reconnecting");
      } finally {
        inFlight = false;
        if (!cancelled) {
          schedule(failures > 0 ? Math.min(4000, 1200 + failures * 700) : 1100);
        }
      }
    }

    function onVisible() {
      if (!document.hidden) {
        failures = 0;
        schedule(40);
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    schedule(50);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearTimeout(timer);
    };
  }, [session, applyView, handleLostSession]);

  const adopt = useCallback((nextSession: Session, nextView: GameView) => {
    writeSession(nextSession);
    writeName(nextSession.name);
    setSession(nextSession);
    setView(nextView);
    setStatus("live");
    setError(null);
    setEntryError(null);
    setLastName(nextSession.name);
  }, []);

  const create = useCallback(async (rawName: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setEntryError(null);
    try {
      const result = await createRoom(rawName.trim());
      const me = result.view.players.find((player) => player.id === result.playerId);
      const name = me?.name ?? rawName.trim();
      adopt(
        { code: result.code, token: result.token, playerId: result.playerId, name },
        result.view,
      );
      return true;
    } catch (caught) {
      setError(messageFor(errorCode(caught)));
      return false;
    } finally {
      setBusy(false);
    }
  }, [adopt]);

  const join = useCallback(async (rawCode: string, rawName: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setEntryError(null);
    try {
      const result = await joinRoom(rawCode, rawName.trim());
      const me = result.view.players.find((player) => player.id === result.playerId);
      const name = me?.name ?? rawName.trim();
      adopt(
        { code: result.code, token: result.token, playerId: result.playerId, name },
        result.view,
      );
      return true;
    } catch (caught) {
      setError(messageFor(errorCode(caught)));
      return false;
    } finally {
      setBusy(false);
    }
  }, [adopt]);

  const runAction = useCallback(async (
    action: (currentSession: Session) => Promise<ViewResult>,
  ): Promise<boolean> => {
    if (!session) return false;
    setBusy(true);
    setError(null);
    try {
      const result = await action(session);
      applyView(result.view);
      setStatus("live");
      return true;
    } catch (caught) {
      const code = errorCode(caught);
      if (isSessionLost(code)) {
        handleLostSession(code);
        return false;
      }
      setError(messageFor(code));
      return false;
    } finally {
      setBusy(false);
    }
  }, [session, applyView, handleLostSession]);

  const start = useCallback(
    () => runAction((currentSession) => startRoom(currentSession)),
    [runAction],
  );

  const submitClue = useCallback(
    (clue: string) => runAction((currentSession) => sendClue(currentSession, clue)),
    [runAction],
  );

  const submitGuess = useCallback(
    (value: number) => runAction((currentSession) => sendGuess(currentSession, value)),
    [runAction],
  );

  const advance = useCallback(
    () => runAction((currentSession) => advanceRoom(currentSession)),
    [runAction],
  );

  const rematch = useCallback(
    () => runAction((currentSession) => rematchRoom(currentSession)),
    [runAction],
  );

  const retry = useCallback(async () => {
    if (!session) return;
    setStatus("boot");
    try {
      const result = await syncRoom(session);
      applyView(result.view);
      setStatus("live");
      setError(null);
    } catch (caught) {
      const code = errorCode(caught);
      if (isSessionLost(code)) {
        handleLostSession(code);
        return;
      }
      setStatus("reconnecting");
    }
  }, [session, applyView, handleLostSession]);

  const leave = useCallback(async () => {
    if (!session) {
      forget();
      return;
    }
    setBusy(true);
    setError(null);
    let shouldForget = true;
    try {
      await leaveRoom(session);
    } catch (caught) {
      const code = errorCode(caught);
      if (!isSessionLost(code)) {
        setError(messageFor(code));
        shouldForget = false;
      }
    } finally {
      setBusy(false);
    }
    if (shouldForget) forget();
  }, [session, forget]);

  const clearError = useCallback(() => setError(null), []);
  const clearEntryError = useCallback(() => setEntryError(null), []);

  return {
    session,
    view,
    status,
    busy,
    error,
    entryError,
    lastName,
    create,
    join,
    start,
    submitClue,
    submitGuess,
    advance,
    rematch,
    leave,
    forget,
    retry,
    clearError,
    clearEntryError,
  };
}
