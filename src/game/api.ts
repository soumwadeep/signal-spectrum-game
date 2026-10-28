import type { AuthResult, GameView, Session, ViewResult } from "./types";

const ENDPOINT = "/functions/v1/app";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readView(value: unknown): GameView {
  if (!isRecord(value) || typeof value.phase !== "string" || !Array.isArray(value.players)) {
    throw new ApiError("invalid_response", 502);
  }
  return value as unknown as GameView;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("network", 0);
  } finally {
    window.clearTimeout(timeout);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !isRecord(data) || data.ok !== true) {
    const code = isRecord(data) && typeof data.error === "string"
      ? data.error
      : `http_${response.status}`;
    throw new ApiError(code, response.status);
  }
  return data as T;
}

export async function createRoom(name: string): Promise<AuthResult> {
  const data = await post<Record<string, unknown>>({ action: "create", name });
  if (
    typeof data.code !== "string"
    || typeof data.token !== "string"
    || typeof data.playerId !== "string"
  ) {
    throw new ApiError("invalid_response", 502);
  }
  return {
    ok: true,
    code: data.code,
    token: data.token,
    playerId: data.playerId,
    view: readView(data.view),
  };
}

export async function joinRoom(code: string, name: string): Promise<AuthResult> {
  const data = await post<Record<string, unknown>>({ action: "join", code, name });
  if (
    typeof data.code !== "string"
    || typeof data.token !== "string"
    || typeof data.playerId !== "string"
  ) {
    throw new ApiError("invalid_response", 502);
  }
  return {
    ok: true,
    code: data.code,
    token: data.token,
    playerId: data.playerId,
    view: readView(data.view),
  };
}

export async function syncRoom(session: Session): Promise<ViewResult> {
  const data = await post<Record<string, unknown>>({
    action: "sync",
    code: session.code,
    token: session.token,
  });
  return { ok: true, view: readView(data.view) };
}

export async function startRoom(session: Session): Promise<ViewResult> {
  const data = await post<Record<string, unknown>>({
    action: "start",
    code: session.code,
    token: session.token,
  });
  return { ok: true, view: readView(data.view) };
}

export async function sendClue(session: Session, clue: string): Promise<ViewResult> {
  const data = await post<Record<string, unknown>>({
    action: "clue",
    code: session.code,
    token: session.token,
    clue,
  });
  return { ok: true, view: readView(data.view) };
}

export async function sendGuess(session: Session, value: number): Promise<ViewResult> {
  const data = await post<Record<string, unknown>>({
    action: "guess",
    code: session.code,
    token: session.token,
    value,
  });
  return { ok: true, view: readView(data.view) };
}

export async function advanceRoom(session: Session): Promise<ViewResult> {
  const data = await post<Record<string, unknown>>({
    action: "advance",
    code: session.code,
    token: session.token,
  });
  return { ok: true, view: readView(data.view) };
}

export async function rematchRoom(session: Session): Promise<ViewResult> {
  const data = await post<Record<string, unknown>>({
    action: "rematch",
    code: session.code,
    token: session.token,
  });
  return { ok: true, view: readView(data.view) };
}

export async function leaveRoom(session: Session): Promise<void> {
  await post<Record<string, unknown>>({
    action: "leave",
    code: session.code,
    token: session.token,
  });
}
