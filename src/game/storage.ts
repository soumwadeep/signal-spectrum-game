import type { Session } from "./types";

export const SESSION_KEY = "signal.session.v1";
export const RULES_KEY = "signal.rules.v1";
const NAME_KEY = "signal.name.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const { code, token, playerId, name } = parsed;
    if (
      typeof code !== "string"
      || typeof token !== "string"
      || typeof playerId !== "string"
      || typeof name !== "string"
    ) {
      return null;
    }
    return { code, token, playerId, name };
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage is optional. The in-memory session still works for this tab.
  }
}

export function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Ignore unavailable storage.
  }
}

export function readPrefillRoom(): string {
  try {
    const code = new URLSearchParams(window.location.search).get("room") ?? "";
    return normalizeCode(code);
  } catch {
    return "";
  }
}

export function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function shareUrl(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", code);
  return url.toString();
}

export function replaceRoomInUrl(code: string): void {
  try {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("room", code);
    window.history.replaceState(null, "", url.toString());
  } catch {
    // History is a convenience, not a requirement.
  }
}
