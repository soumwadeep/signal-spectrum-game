import { Brand } from "./ui";

interface ReconnectProps {
  room: string;
  name: string;
  status: "boot" | "live" | "reconnecting" | "idle";
  onRetry: () => void;
  onForget: () => void;
}

export function Reconnect({ room, name, status, onRetry, onForget }: ReconnectProps) {
  const connecting = status === "boot" || status === "live";
  return (
    <main className="reconnect-screen">
      <div className="reconnect-panel panel">
        <Brand large sub />
        <div className="reconnect-radar" aria-hidden="true">
          <span className="radar-ring ring-one" />
          <span className="radar-ring ring-two" />
          <span className="radar-ring ring-three" />
          <span className="radar-sweep" />
          <span className="radar-dot" />
        </div>
        <p className="eyebrow">ROOM {room} · {name.toUpperCase()}</p>
        <h1>{connecting ? "CONNECTING TO THE ROOM" : "SIGNAL INTERRUPTED"}</h1>
        <p className="reconnect-copy">
          {connecting
            ? "Opening your channel. This takes a second."
            : "We lost the room for a moment. Your seat is safe; we're trying again automatically."}
        </p>
        <div className="reconnect-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRetry}
            disabled={status === "boot"}
          >
            {status === "boot" ? "CONNECTING…" : "RETRY NOW"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onForget}>
            FORGET ROOM
          </button>
        </div>
        <p className="faint reconnect-foot">
          Keep this tab open. If the host closed the room, you will return to the entrance.
        </p>
      </div>
    </main>
  );
}
