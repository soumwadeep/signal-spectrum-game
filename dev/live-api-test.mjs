import assert from "node:assert/strict";

const SITE = "https://signal-spectrum-khsmca9k4iv.qoder.website";
const ENDPOINT = `${SITE}/functions/v1/app`;
const ORIGIN = new URL(SITE).origin;

async function call(body, expectedError) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (expectedError) {
    assert.equal(response.status, expectedError.status ?? 400, JSON.stringify(data));
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

function farFrom(target) {
  return target <= 50 ? 100 : 0;
}

const host = await call({ action: "create", name: "Live Alice" });
const guest = await call({ action: "join", code: host.code, name: "Live Bob" });
console.log("live room", host.code, "created and joined");

await call({ action: "start", code: host.code, token: guest.token }, { error: "not_host", status: 403 });
const started = await call({ action: "start", code: host.code, token: host.token });
assert.equal(started.view.phase, "clue");
assert.equal(started.view.you.isBeacon, true);
let hostView = started.view;
let guestView = await sync(guest);
assert.equal(guestView.target, null, "non-Beacon must not receive target");

for (let round = 1; round <= 6; round += 1) {
  assert.equal(hostView.phase, "clue", `round ${round} clue phase`);
  assert.equal(guestView.phase, "clue");
  const hostIsBeacon = hostView.beaconId === host.playerId;
  const beacon = hostIsBeacon ? host : guest;
  const guesser = hostIsBeacon ? guest : host;
  const beaconView = hostIsBeacon ? hostView : guestView;
  const guesserView = hostIsBeacon ? guestView : hostView;
  assert.equal(beaconView.you.isBeacon, true);
  assert.equal(guesserView.target, null);
  assert.ok(Number.isInteger(beaconView.target));

  const target = beaconView.target;
  await call({ action: "clue", code: host.code, token: beacon.token, clue: "a tiny dog" });
  const afterClue = await refresh(host, guest);
  assert.equal(afterClue.hostView.phase, "guess");
  assert.equal(afterClue.guestView.phase, "guess");
  assert.equal(hostIsBeacon ? afterClue.guestView.target : afterClue.hostView.target, null);
  await call({ action: "guess", code: host.code, token: beacon.token, value: 50 }, { error: "beacon_cannot_guess", status: 409 });

  const value = beacon.playerId === host.playerId ? farFrom(target) : target;
  const reveal = (await call({ action: "guess", code: host.code, token: guesser.token, value })).view;
  assert.equal(reveal.phase, "reveal");
  assert.equal(reveal.target, target);
  assert.ok(reveal.roundResult);
  const guesserEntry = reveal.roundResult.entries.find((entry) => !entry.isBeacon);
  assert.equal(guesserEntry.points, value === target ? 4 : 1);
  const afterReveal = await refresh(host, guest);
  assert.equal(afterReveal.hostView.target, target);
  assert.equal(afterReveal.guestView.target, target);
  console.log(`round ${round}: beacon=${hostIsBeacon ? "host" : "guest"} target=${target} guess=${value} points=${guesserEntry.points}`);

  await call({ action: "advance", code: host.code, token: host.token });
  const next = await refresh(host, guest);
  hostView = next.hostView;
  guestView = next.guestView;
}

assert.equal(hostView.phase, "finished");
assert.equal(guestView.phase, "finished");
assert.deepEqual(hostView.winners, [host.playerId]);
const hostTotal = hostView.players.find((player) => player.id === host.playerId).score;
const guestTotal = hostView.players.find((player) => player.id === guest.playerId).score;
assert.equal(hostTotal, 12);
assert.equal(guestTotal, 9);
console.log("live final scores", hostTotal, guestTotal, "winner", hostView.winners[0] === host.playerId ? "host" : "guest");

await call({ action: "join", code: host.code, name: "Late" }, { error: "game_started", status: 409 });

await call({ action: "leave", code: host.code, token: host.token });
await call({ action: "leave", code: host.code, token: guest.token });
const gone = await call({ action: "sync", code: host.code, token: host.token }, { error: "room_not_found", status: 404 });
assert.equal(gone.ok, false);

console.log("LIVE API: all checks passed");
