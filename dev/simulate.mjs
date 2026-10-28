import assert from "node:assert/strict";
import { application } from "../functions/game.mjs";
import { createMemoryRepo } from "./memory-repo.mjs";

let clock = Date.parse("2026-10-27T12:00:00.000Z");
const repo = createMemoryRepo();
const game = application({ repo, now: () => clock });

const endpoint = "http://127.0.0.1:8000/functions/v1/app";

async function call(body, expectedError) {
  const response = await game(new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
  const data = await response.json();
  if (expectedError) {
    assert.equal(response.status, expectedError.status ?? 400, `error status for ${JSON.stringify(body)}`);
    assert.equal(data.ok, false);
    assert.equal(data.error, expectedError.error);
    return data;
  }
  assert.ok(response.status < 400, `unexpected ${response.status}: ${JSON.stringify(data)}`);
  assert.equal(data.ok, true);
  return data;
}

async function sync(session) {
  return (await call({ action: "sync", code: session.code, token: session.token })).view;
}

async function refresh(host, guest) {
  return { hostView: await sync(host), guestView: await sync(guest) };
}

async function createGame() {
  const host = await call({ action: "create", name: "Alice" });
  const guest = await call({ action: "join", code: host.code, name: "Bob" });
  await call({ action: "start", code: host.code, token: host.token });
  const views = await refresh(host, guest);
  return { host, guest, ...views };
}

function farFrom(target) {
  return target <= 50 ? 100 : 0;
}

function checkPhase(view, phase) {
  assert.equal(view.phase, phase, `expected ${phase}, got ${view.phase}`);
}

console.log("1. create, join, start");
const host = await call({ action: "create", name: "Alice" });
assert.match(host.code, /^[A-HJ-NP-Z2-9]{4}$/);
assert.equal(host.view.phase, "lobby");
assert.equal(host.view.you.isHost, true);
const code = host.code;

await call({ action: "join", code, name: "Alice" }, { error: "name_taken", status: 409 });
await call({ action: "join", code: "!!!!", name: "Eve" }, { error: "invalid_code", status: 400 });
const guest = await call({ action: "join", code, name: "Bob" });
assert.equal(guest.view.players.length, 2);
assert.equal(guest.view.you.isHost, false);
await call({ action: "start", code, token: guest.token }, { error: "not_host", status: 403 });
await call({ action: "sync", code, token: "0".repeat(48) }, { error: "not_in_room", status: 403 });

const started = await call({ action: "start", code, token: host.token });
assert.equal(started.view.phase, "clue");
assert.equal(started.view.totalRounds, 6);
assert.equal(started.view.you.isBeacon, true);
let hostView = started.view;
let guestView = await sync(guest);
checkPhase(guestView, "clue");
assert.equal(guestView.target, null, "non-Beacon must not receive the target");
assert.equal(guestView.roundResult, null);
assert.ok(guestView.poles);

console.log("2. clue validation and Beacon privacy");
await call({ action: "clue", code, token: host.token, clue: "target 42" }, { error: "clue_has_number" });
await call({ action: "clue", code, token: host.token, clue: "one two three four five six" }, { error: "clue_word_limit" });
await call({ action: "clue", code, token: host.token, clue: hostView.poles.left }, { error: "clue_uses_pole" });
await call({ action: "clue", code, token: guest.token, clue: "a tiny dog" }, { error: "not_beacon", status: 403 });

console.log("3. one complete six-round match");
const clue = "a tiny dog";
for (let round = 1; round <= 6; round += 1) {
  checkPhase(hostView, "clue");
  checkPhase(guestView, "clue");
  const hostIsBeacon = hostView.beaconId === host.playerId;
  const beacon = hostIsBeacon ? host : guest;
  const beaconView = hostIsBeacon ? hostView : guestView;
  const guesserView = hostIsBeacon ? guestView : hostView;
  const guesser = hostIsBeacon ? guest : host;

  assert.equal(beaconView.you.isBeacon, true);
  assert.equal(guesserView.you.isBeacon, false);
  assert.equal(guesserView.target, null);
  assert.ok(beaconView.target !== null, "Beacon sees the target");

  const target = beaconView.target;
  await call({ action: "clue", code, token: beacon.token, clue });
  const afterClue = await refresh(host, guest);
  blackoutCheck(afterClue, hostIsBeacon);
  checkPhase(afterClue.hostView, "guess");
  assert.equal(afterClue.guestView.clue, clue);
  assert.ok(afterClue.guestView.deadline);
  await call({ action: "guess", code, token: beacon.token, value: 50 }, { error: "beacon_cannot_guess", status: 409 });

  const value = beacon.playerId === host.playerId ? farFrom(target) : target;
  const reveal = (await call({ action: "guess", code, token: guesser.token, value })).view;
  checkPhase(reveal, "reveal");
  assert.equal(reveal.target, target);
  assert.ok(reveal.roundResult);
  const result = reveal.roundResult;
  assert.equal(result.target, target);
  assert.equal(result.clue, clue);
  assert.equal(result.entries.length, 2);
  const guesserEntry = result.entries.find((entry) => !entry.isBeacon);
  const beaconEntry = result.entries.find((entry) => entry.isBeacon);
  assert.ok(guesserEntry);
  assert.ok(beaconEntry);
  assert.equal(guesserEntry.points, value === target ? 4 : 1);
  assert.equal(beaconEntry.points, value === target ? 2 : 0);

  const afterReveal = await refresh(host, guest);
  assert.equal(afterReveal.hostView.target, target);
  assert.equal(afterReveal.guestView.target, target);
  assert.ok(afterReveal.hostView.roundResult);

  await call({ action: "advance", code, token: host.token });
  const views = await refresh(host, guest);
  hostView = views.hostView;
  guestView = views.guestView;
  if (hostView.phase === "finished") break;
}

function blackoutCheck(views, hostIsBeacon) {
  const hidden = hostIsBeacon ? views.guestView : views.hostView;
  const shown = hostIsBeacon ? views.hostView : views.guestView;
  assert.equal(hidden.target, null, "non-Beacon still cannot see target after clue");
  assert.equal(hidden.roundResult, null);
  assert.ok(shown.target !== null);
}

checkPhase(hostView, "finished");
checkPhase(guestView, "finished");
assert.equal(hostView.totalRounds, 6);
assert.deepEqual(hostView.winners, [host.playerId]);
assert.deepEqual(guestView.winners, [host.playerId]);
assert.equal(hostView.players.find((player) => player.id === host.playerId).score, 12);
assert.equal(hostView.players.find((player) => player.id === guest.playerId).score, 9);

console.log("4. join is closed after start");
await call({ action: "join", code, name: "Eve" }, { error: "game_started", status: 409 });

console.log("5. rematch rotates the first Beacon");
await call({ action: "rematch", code, token: guest.token }, { error: "not_host", status: 403 });
const rematch = await call({ action: "rematch", code, token: host.token });
assert.equal(rematch.view.phase, "clue");
assert.equal(rematch.view.round, 1);
assert.equal(rematch.view.beaconId, guest.playerId);
assert.equal(rematch.view.players.find((player) => player.id === host.playerId).score, 0);

console.log("6. timeout resolves and auto-advances");
const timed = await createGame();
assert.equal(timed.hostView.you.isBeacon, true);
await call({
  action: "clue",
  code: timed.host.code,
  token: timed.host.token,
  clue: "a tiny dog",
});
const timedAfterClue = await refresh(timed.host, timed.guest);
const timedTarget = timedAfterClue.hostView.target;
clock += 31_000;
const expired = await sync(timed.guest);
checkPhase(expired, "reveal");
assert.equal(expired.roundResult.entries.find((entry) => !entry.isBeacon).guess, 50);
assert.equal(expired.target, timedTarget);
clock += 21_000;
const next = await sync(timed.guest);
checkPhase(next, "clue");
assert.equal(next.round, 2);

console.log("7. lobby leave transfers host and blocks a one-player start");
const lobby = await call({ action: "create", name: "Carol" });
const lobbyGuest = await call({ action: "join", code: lobby.code, name: "Dave" });
const other = await call({ action: "join", code: lobby.code, name: "Erin" });
const left = await call({ action: "leave", code: lobby.code, token: lobby.token });
assert.equal(left.ok, true);
const afterLeave = await sync(lobbyGuest);
assert.equal(afterLeave.you.isHost, true);
assert.equal(afterLeave.players.length, 2);
assert.equal(afterLeave.hostId, lobbyGuest.playerId);
await call({ action: "leave", code: lobby.code, token: other.token });
await call({ action: "start", code: lobby.code, token: lobbyGuest.token }, { error: "not_enough_players", status: 409 });
const oneLeft = await sync(lobbyGuest);
assert.equal(oneLeft.phase, "lobby");
assert.equal(oneLeft.players.length, 1);

console.log("SIGNAL backend: all checks passed");
