import { useEffect, useState } from "react";

export function useServerOffset(serverNow: string | undefined): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!serverNow) return;
    const parsed = Date.parse(serverNow);
    if (Number.isFinite(parsed)) setOffset(parsed - Date.now());
  }, [serverNow]);
  return offset;
}

export function useCountdown(
  deadline: string | null | undefined,
  serverOffset: number,
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (!deadline) return null;
  const ends = Date.parse(deadline);
  if (!Number.isFinite(ends)) return null;
  return Math.max(0, ends - (now + serverOffset));
}

export function secondsLabel(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}
