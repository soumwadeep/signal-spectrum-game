import { SPECTRA } from "./spectra.mjs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;
const COLORS = [
  "#72ffb0",
  "#ffbd5c",
  "#ff7a85",
  "#71d6ff",
  "#c6a4ff",
  "#c4f75f",
  "#ff9ad8",
  "#eef6ef",
];
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const CLUE_MAX_WORDS = 5;
const CLUE_MAX_CHARS = 60;
const GUESS_MS = 30_000;
const REVEAL_MS = 20_000;
const BAND_WIDTHS = [7, 15, 25];

const POLE_STOPWORDS = new Set([
  "would", "could", "should", "with", "from", "that", "this", "your", "youre",
  "have", "into", "over", "under", "more", "less", "most", "very", "than",
  "then", "when", "what", "will", "just", "like", "about", "after", "before",
  "being", "been", "were", "also", "because", "while", "where", "which",
  "there", "their", "them", "they", "some", "such", "only", "really", "thing",
  "things", "person", "people", "going", "gets", "with", "without", "yourself",
  "and", "the", "for", "are", "not", "its", "you", "our", "out", "off", "on",
  "in", "at", "to", "of", "a", "an", "or", "be", "is", "as", "by", "do", "it",
]);

export class PublicError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "PublicError";
    this.code = code;
    this.status = status;
  }
}

const fail = (code, status = 400) => {
  throw new PublicError(code, status);
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function isAppPath(pathname) {
  return /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})\/?$/.test(pathname);
}

async function readJson(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    fail("invalid_request", 400);
  }
  const reader = request.body?.getReader();
  if (!reader) fail("invalid_request", 400);
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        fail("invalid_request", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) fail("invalid_request", 400);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      fail("invalid_request", 400);
    }
    return parsed;
  } catch (error) {
    if (error instanceof PublicError) throw error;
    fail("invalid_request", 400);
  }
}

function nowIso(ms) {
  return new Date(ms).toISOString();
}

function randomInt(max) {
  if (max <= 1) return 0;
  const buffer = new Uint8Array(1);
  const limit = 256 - (256 % max);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

function randomCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => ALPHABET[byte & 31]).join("");
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanCode(raw) {
  if (typeof raw !== "string") fail("invalid_code", 400);
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!CODE_RE.test(code)) fail("invalid_code", 400);
  return code;
}

function cleanName(raw) {
  if (typeof raw !== "string") fail("invalid_name", 400);
  const name = raw
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if ([...name].length < 1 || [...name].length > 16 || !/[\p{L}\p{N}]/u.test(name)) {
    fail("invalid_name", 400);
  }
  return name;
}

function cleanToken(raw) {
  if (typeof raw !== "string" || !TOKEN_RE.test(raw)) fail("not_in_room", 403);
  return raw;
}

function makePlayer(name, players, now) {
  const usedColors = new Set(players.map((player) => player.color));
  const color = COLORS.find((candidate) => !usedColors.has(candidate)) ?? COLORS[players.length % COLORS.length];
  return {
    id: crypto.randomUUID(),
    token: randomToken(),
    name,
    color,
    joinedAt: nowIso(now),
  };
}

function pickSpectrum(state) {
  let pool = SPECTRA.map((_, index) => index).filter((index) => !state.used.includes(index));
  if (pool.length === 0) {
    state.used = [];
    pool = SPECTRA.map((_, index) => index);
  }
  const index = pool[randomInt(pool.length)];
  state.used.push(index);
  state.spectrumIndex = index;
  state.target = 15 + randomInt(71);
}

function createState(code, player, now) {
  return {
    v: 1,
    revision: 1,
    code,
    phase: "lobby",
    round: 0,
    totalRounds: 0,
    suddenDeath: false,
    players: [player],
    hostId: player.id,
    beaconIndex: 0,
    clue: null,
    guesses: {},
    scores: {},
    spectrumIndex: null,
    target: null,
    used: [],
    roundResult: null,
    winners: null,
    deadline: null,
    gameNumber: 0,
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
  };
}

function startGame(state, now) {
  const count = state.players.length;
  if (count < MIN_PLAYERS) fail("not_enough_players", 409);
  const start = (state.gameNumber ?? 0) % count;
  state.gameNumber = (state.gameNumber ?? 0) + 1;
  state.phase = "clue";
  state.round = 1;
  state.totalRounds = count >= 4 ? count : 6;
  state.suddenDeath = false;
  state.beaconIndex = start;
  state.clue = null;
  state.guesses = {};
  state.scores = Object.fromEntries(state.players.map((player) => [player.id, 0]));
  state.spectrumIndex = null;
  state.target = null;
  state.used = [];
  state.roundResult = null;
  state.winners = null;
  state.deadline = null;
  pickSpectrum(state);
  state.startedAt = nowIso(now);
}

function beginNextRound(state) {
  state.round += 1;
  state.beaconIndex = (state.beaconIndex + 1) % state.players.length;
  state.phase = "clue";
  state.clue = null;
  state.guesses = {};
  state.roundResult = null;
  state.deadline = null;
  pickSpectrum(state);
}

function leaders(state) {
  const top = Math.max(0, ...state.players.map((player) => state.scores[player.id] ?? 0));
  return state.players
    .filter((player) => (state.scores[player.id] ?? 0) === top)
    .map((player) => player.id);
}

function resolveRound(state, now) {
  if (state.phase !== "guess") return false;
  const beacon = state.players[state.beaconIndex];
  if (!beacon) fail("room_unavailable", 503);
  const guessers = state.players.filter((player) => player.id !== beacon.id);
  for (const player of guessers) {
    if (!Number.isInteger(state.guesses[player.id])) {
      state.guesses[player.id] = 50;
    }
  }
  const byId = new Map();
  let closeOrBetter = 0;
  let bullseye = false;
  for (const player of guessers) {
    const guess = state.guesses[player.id];
    const distance = Math.abs(guess - state.target);
    const points = distance <= BAND_WIDTHS[0] ? 4 : distance <= BAND_WIDTHS[1] ? 3 : distance <= BAND_WIDTHS[2] ? 2 : 1;
    if (points >= 3) closeOrBetter += 1;
    if (points === 4) bullseye = true;
    state.scores[player.id] = (state.scores[player.id] ?? 0) + points;
    byId.set(player.id, {
      playerId: player.id,
      name: player.name,
      color: player.color,
      guess,
      distance,
      points,
      isBeacon: false,
    });
  }
  const beaconPoints = Math.min(4, closeOrBetter) + (bullseye ? 1 : 0);
  state.scores[beacon.id] = (state.scores[beacon.id] ?? 0) + beaconPoints;
  byId.set(beacon.id, {
    playerId: beacon.id,
    name: beacon.name,
    color: beacon.color,
    guess: null,
    distance: null,
    points: beaconPoints,
    isBeacon: true,
  });
  state.roundResult = {
    target: state.target,
    clue: state.clue,
    beaconId: beacon.id,
    beaconName: beacon.name,
    beaconPoints,
    bullseye,
    closeOrBetter,
    bands: BAND_WIDTHS,
    entries: state.players.map((player) => byId.get(player.id)),
  };
  state.phase = "reveal";
  state.deadline = nowIso(now + REVEAL_MS);
  return true;
}

function advanceRoom(state, now) {
  if (state.phase !== "reveal") return false;
  const currentLeaders = leaders(state);
  if (state.suddenDeath) {
    state.phase = "finished";
    state.winners = currentLeaders;
    state.deadline = null;
    state.roundResult = null;
    return true;
  }
  if (state.round >= state.totalRounds) {
    if (currentLeaders.length > 1) {
      state.suddenDeath = true;
      state.round = state.totalRounds + 1;
      state.beaconIndex = (state.beaconIndex + 1) % state.players.length;
      state.phase = "clue";
      state.clue = null;
      state.guesses = {};
      state.roundResult = null;
      state.deadline = null;
      pickSpectrum(state);
      return true;
    }
    state.phase = "finished";
    state.winners = currentLeaders;
    state.deadline = null;
    state.roundResult = null;
    return true;
  }
  beginNextRound(state);
  return true;
}

function viewFor(state, viewerId, now) {
  const viewer = state.players.find((player) => player.id === viewerId);
  if (!viewer) fail("not_in_room", 403);
  const beacon = state.phase === "lobby" || state.phase === "finished"
    ? null
    : state.players[state.beaconIndex] ?? null;
  const beaconId = beacon?.id ?? null;
  const revealed = state.phase === "reveal" || state.phase === "finished";
  const isBeacon = viewer.id === beaconId;
  const spectrum = state.spectrumIndex === null ? null : SPECTRA[state.spectrumIndex];
  const guessers = beacon ? state.players.filter((player) => player.id !== beacon.id) : [];
  const target = (isBeacon || revealed) && state.target !== null ? state.target : null;
  return {
    room: state.code,
    revision: Number.isInteger(state.revision) ? state.revision : 1,
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    suddenDeath: state.suddenDeath,
    hostId: state.hostId,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      score: state.scores[player.id] ?? 0,
      isHost: player.id === state.hostId,
      isBeacon: player.id === beaconId,
      hasGuessed: Object.hasOwn(state.guesses, player.id),
    })),
    you: {
      id: viewer.id,
      isHost: viewer.id === state.hostId,
      isBeacon,
      hasGuessed: Object.hasOwn(state.guesses, viewer.id),
    },
    beaconId,
    poles: spectrum ? { left: spectrum[0], right: spectrum[1] } : null,
    clue: state.clue,
    target,
    bands: BAND_WIDTHS,
    deadline: state.deadline,
    serverNow: nowIso(now),
    lockedCount: guessers.filter((player) => Object.hasOwn(state.guesses, player.id)).length,
    guesserCount: guessers.length,
    yourGuess: Object.hasOwn(state.guesses, viewer.id) ? state.guesses[viewer.id] : null,
    canStart: viewer.id === state.hostId && state.phase === "lobby" && state.players.length >= MIN_PLAYERS,
    canRematch: viewer.id === state.hostId && state.phase === "finished",
    roundResult: state.phase === "reveal" ? state.roundResult : null,
    winners: state.phase === "finished" ? state.winners : null,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
  };
}

function validateClue(raw, spectrum) {
  if (typeof raw !== "string") fail("clue_empty", 400);
  const clue = raw.replace(/\s+/g, " ").trim();
  if (!clue) fail("clue_empty", 400);
  if ([...clue].length > CLUE_MAX_CHARS) fail("clue_too_long", 400);
  if (!/[\p{L}]/u.test(clue)) fail("clue_empty", 400);
  const words = clue.split(" ").filter(Boolean);
  if (words.length > CLUE_MAX_WORDS) fail("clue_word_limit", 400);
  if (/\d/.test(clue)) fail("clue_has_number", 400);
  const lower = clue.toLowerCase();
  for (const pole of spectrum) {
    const normalized = pole.toLowerCase().replace(/\s+/g, " ");
    if (lower.includes(normalized)) fail("clue_uses_pole", 400);
    const tokens = normalized
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !POLE_STOPWORDS.has(token));
    for (const token of tokens) {
      const match = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (match.test(clue)) fail("clue_uses_pole", 400);
    }
  }
  return clue;
}

function allGuessersLocked(state) {
  const beacon = state.players[state.beaconIndex];
  if (!beacon) return false;
  return state.players
    .filter((player) => player.id !== beacon.id)
    .every((player) => Number.isInteger(state.guesses[player.id]));
}

export function application({ repo, now = () => Date.now() }) {
  async function withRoom(code, token, mutate) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const row = await repo.get(code);
      if (!row) fail("room_not_found", 404);
      const state = row.state;
      const player = state.players.find((candidate) => candidate.token === token);
      if (!player) fail("not_in_room", 403);
      const stamp = now();
      const changed = mutate(state, player, stamp);
      if (!changed) return viewFor(state, player.id, stamp);
      state.revision = (Number.isInteger(state.revision) ? state.revision : 1) + 1;
      state.updatedAt = nowIso(stamp);
      const written = await repo.update({
        code,
        version: row.version,
        state,
        updatedAt: state.updatedAt,
      });
      if (written) return viewFor(state, player.id, stamp);
    }
    fail("busy", 409);
  }

  async function handle(request) {
    try {
      const url = new URL(request.url);
      if (!isAppPath(url.pathname)) return json({ ok: false, error: "not_found" }, 404);
      if (request.method === "GET") return json({ ok: true, service: "signal" });
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
          status: 405,
          headers: {
            allow: "GET, POST",
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
          },
        });
      }
      const body = await readJson(request);
      const action = body.action;

      if (action === "create") {
        const name = cleanName(body.name);
        const stamp = now();
        let created = null;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const code = randomCode();
          const existing = await repo.get(code);
          if (existing) continue;
          const player = makePlayer(name, [], stamp);
          const state = createState(code, player, stamp);
          const written = await repo.insert({
            code,
            state,
            version: 1,
            createdAt: state.createdAt,
            updatedAt: state.updatedAt,
          });
          if (written) {
            created = { code, state, player };
            break;
          }
        }
        if (!created) fail("room_unavailable", 503);
        return json({
          ok: true,
          code: created.code,
          token: created.player.token,
          playerId: created.player.id,
          view: viewFor(created.state, created.player.id, stamp),
        });
      }

      if (action === "join") {
        const code = cleanCode(body.code);
        const name = cleanName(body.name);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const row = await repo.get(code);
          if (!row) fail("room_not_found", 404);
          const state = row.state;
          if (state.phase !== "lobby") fail("game_started", 409);
          if (state.players.length >= MAX_PLAYERS) fail("room_full", 409);
          if (state.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
            fail("name_taken", 409);
          }
          const stamp = now();
          const player = makePlayer(name, state.players, stamp);
          state.players.push(player);
          state.revision = (Number.isInteger(state.revision) ? state.revision : 1) + 1;
          state.updatedAt = nowIso(stamp);
          const written = await repo.update({
            code,
            version: row.version,
            state,
            updatedAt: state.updatedAt,
          });
          if (written) {
            return json({
              ok: true,
              code,
              token: player.token,
              playerId: player.id,
              view: viewFor(state, player.id, stamp),
            });
          }
        }
        fail("busy", 409);
      }

      if (action === "leave") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const row = await repo.get(code);
          if (!row) return json({ ok: true, left: true });
          const state = row.state;
          const index = state.players.findIndex((player) => player.token === token);
          if (index < 0) return json({ ok: true, left: true });
          const player = state.players[index];
          if (state.phase !== "lobby" && state.phase !== "finished") {
            fail("game_in_progress", 409);
          }
          state.players.splice(index, 1);
          delete state.guesses[player.id];
          delete state.scores[player.id];
          if (state.players.length === 0) {
            await repo.remove(code);
            return json({ ok: true, left: true });
          }
          if (state.hostId === player.id) state.hostId = state.players[0].id;
          if (state.phase === "finished") {
            state.winners = leaders(state);
          }
          if (state.beaconIndex >= state.players.length) state.beaconIndex = 0;
          const stamp = now();
          state.revision = (Number.isInteger(state.revision) ? state.revision : 1) + 1;
          state.updatedAt = nowIso(stamp);
          const written = await repo.update({
            code,
            version: row.version,
            state,
            updatedAt: state.updatedAt,
          });
          if (written) return json({ ok: true, left: true });
        }
        fail("busy", 409);
      }

      if (action === "sync") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        const view = await withRoom(code, token, (state, _player, stamp) => {
          if (state.phase === "guess") {
            if (state.deadline && Date.parse(state.deadline) <= stamp) {
              return resolveRound(state, stamp);
            }
            if (allGuessersLocked(state)) return resolveRound(state, stamp);
          }
          if (state.phase === "reveal" && state.deadline && Date.parse(state.deadline) <= stamp) {
            return advanceRoom(state, stamp);
          }
          return false;
        });
        return json({ ok: true, view });
      }

      if (action === "start") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        const view = await withRoom(code, token, (state, player, stamp) => {
          if (state.phase !== "lobby") return false;
          if (player.id !== state.hostId) fail("not_host", 403);
          startGame(state, stamp);
          return true;
        });
        return json({ ok: true, view });
      }

      if (action === "clue") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        const view = await withRoom(code, token, (state, player, stamp) => {
          const beacon = state.players[state.beaconIndex];
          if (state.phase === "guess" || state.phase === "reveal" || state.phase === "finished") {
            if (state.clue && beacon && player.id === beacon.id && body.clue === state.clue) return false;
            fail("phase_closed", 409);
          }
          if (state.phase !== "clue") fail("phase_closed", 409);
          if (!beacon || player.id !== beacon.id) fail("not_beacon", 403);
          const clue = validateClue(body.clue, SPECTRA[state.spectrumIndex]);
          state.clue = clue;
          state.guesses = {};
          state.phase = "guess";
          state.deadline = nowIso(stamp + GUESS_MS);
          return true;
        });
        return json({ ok: true, view });
      }

      if (action === "guess") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        const value = body.value;
        if (!Number.isInteger(value) || value < 0 || value > 100) fail("invalid_guess", 400);
        const view = await withRoom(code, token, (state, player, stamp) => {
          const beacon = state.players[state.beaconIndex];
          if (state.phase === "reveal" && state.guesses[player.id] === value) return false;
          if (state.phase !== "guess") fail("phase_closed", 409);
          if (!beacon || player.id === beacon.id) fail("beacon_cannot_guess", 409);
          if (Object.hasOwn(state.guesses, player.id)) {
            if (state.guesses[player.id] === value) return false;
            fail("already_locked", 409);
          }
          if (state.deadline && Date.parse(state.deadline) <= stamp) {
            resolveRound(state, stamp);
            return true;
          }
          state.guesses[player.id] = value;
          if (allGuessersLocked(state)) return resolveRound(state, stamp);
          return true;
        });
        return json({ ok: true, view });
      }

      if (action === "advance") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        const view = await withRoom(code, token, (state, _player, stamp) => {
          if (state.phase !== "reveal") return false;
          return advanceRoom(state, stamp);
        });
        return json({ ok: true, view });
      }

      if (action === "rematch") {
        const code = cleanCode(body.code);
        const token = cleanToken(body.token);
        const view = await withRoom(code, token, (state, player, stamp) => {
          if (state.phase !== "finished") return false;
          if (player.id !== state.hostId) fail("not_host", 403);
          startGame(state, stamp);
          return true;
        });
        return json({ ok: true, view });
      }

      return json({ ok: false, error: "unknown_action" }, 404);
    } catch (error) {
      if (error instanceof PublicError) {
        return json({ ok: false, error: error.code }, error.status);
      }
      throw error;
    }
  }

  return handle;
}
