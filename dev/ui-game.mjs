import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = "http://127.0.0.1:5173/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];

function watch(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${label} console: ${msg.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${label} pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (!request.url().includes("favicon")) {
      errors.push(`${label} requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`);
    }
  });
}

async function dismissRules(page) {
  const modal = page.locator(".modal-backdrop");
  if (await modal.count()) {
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "detached", timeout: 3000 }).catch(async () => {
      const close = page.getByRole("button", { name: "Close rules" });
      if (await close.count()) await close.click();
    });
  }
}

async function screenshot(page, name) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}

try {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  watch(host, "host");
  watch(guest, "guest");

  console.log("1. host creates a room");
  await host.goto(base, { waitUntil: "networkidle" });
  await screenshot(host, "landing-desktop");
  await host.getByTestId("name-input").fill("Alice");
  await host.getByTestId("access-submit").click();
  await host.getByTestId("room-code").waitFor({ timeout: 10000 });
  const code = (await host.getByTestId("room-code").innerText()).trim();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/);
  await host.waitForTimeout(500);
  await dismissRules(host);
  await screenshot(host, "lobby-one-player");
  console.log("   room", code);

  console.log("2. guest joins from a separate browser context");
  await guest.goto(`${base}?room=${code}`, { waitUntil: "networkidle" });
  await guest.getByTestId("name-input").fill("Bob");
  await guest.getByTestId("access-submit").click();
  await guest.getByTestId("room-code").waitFor({ timeout: 10000 });
  await guest.waitForTimeout(500);
  await dismissRules(guest);
  const start = host.getByTestId("start-game");
  for (let i = 0; i < 40; i += 1) {
    if (await start.isEnabled().catch(() => false)) break;
    await host.waitForTimeout(250);
  }
  assert.equal(await start.isEnabled(), true, "host start should be enabled after guest joins");
  await screenshot(host, "lobby-two-players");

  console.log("3. play six UI rounds");
  await start.click();

  for (let round = 1; round <= 6; round += 1) {
    let beaconPage = null;
    let beaconLabel = "";
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await host.getByTestId("clue-input").isVisible().catch(() => false)) {
        beaconPage = host;
        beaconLabel = "host";
        break;
      }
      if (await guest.getByTestId("clue-input").isVisible().catch(() => false)) {
        beaconPage = guest;
        beaconLabel = "guest";
        break;
      }
      await host.waitForTimeout(250);
    }
    assert.ok(beaconPage, `round ${round}: a Beacon should have the clue input`);
    const guesserPage = beaconLabel === "host" ? guest : host;
    const targetPill = await beaconPage.locator(".target-pill").first().innerText();
    const target = Number(targetPill.match(/\d+/)?.[0]);
    assert.ok(Number.isInteger(target) && target >= 15 && target <= 85, `target parsed: ${targetPill}`);
    console.log(`   round ${round}: beacon=${beaconLabel} target=${target}`);

    if (round === 1) {
      await screenshot(beaconPage, "clue-beacon");
      await screenshot(guesserPage, "clue-waiting");
    }

    await beaconPage.getByTestId("clue-input").fill("a tiny dog");
    await beaconPage.getByTestId("send-clue").click();
    await guesserPage.getByTestId("lock-guess").waitFor({ state: "visible", timeout: 12000 });
    await beaconPage.locator(".target-pill").first().waitFor({ state: "visible", timeout: 12000 });

    assert.equal(await guesserPage.locator(".target-pill").count(), 0, "guesser must not see target pill");
    assert.equal(await guesserPage.locator(".target-readout").count(), 0, "guesser must not see target readout");
    assert.equal(await guesserPage.locator(".target-tag").count(), 0, "guesser must not see target tag");

    const dial = guesserPage.locator(".dial-field.is-interactive");
    await dial.waitFor({ state: "visible", timeout: 8000 });
    const box = await dial.boundingBox();
    assert.ok(box, "dial bounds");
    const pct = beaconLabel === "guest" ? target : (target <= 50 ? 100 : 0);
    const x = box.x + Math.min(box.width - 2, Math.max(2, (box.width * pct) / 100));
    await guesserPage.mouse.click(x, box.y + box.height / 2);
    const shown = Number(await guesserPage.locator(".dial-readout").innerText());
    console.log(`     guesser=${beaconLabel === "host" ? "guest" : "host"} placed ${shown} (wanted ${pct})`);
    assert.ok(Math.abs(shown - pct) <= 1, "dial should follow the pointer");
    if (round === 1) {
      await screenshot(guesserPage, "guess-desktop");
      if (beaconLabel === "host") {
        await screenshot(host, "guess-beacon");
      }
    }
    await guesserPage.getByTestId("lock-guess").click();

    await host.getByTestId("advance-round").waitFor({ state: "visible", timeout: 12000 });
    await guest.getByTestId("advance-round").waitFor({ state: "visible", timeout: 12000 });
    assert.equal(await guesserPage.locator(".target-tag").count() > 0, true, "target visible on reveal");
    if (round === 1) {
      await screenshot(host, "reveal-desktop");
      await screenshot(guest, "reveal-guest");
    }

    if (round === 2) {
      await guest.setViewportSize({ width: 390, height: 844 });
      await screenshot(guest, "reveal-mobile");
      await guest.setViewportSize({ width: 1440, height: 1000 });
    }

    await host.getByTestId("advance-round").click();
    if (round < 6) {
      await host.waitForTimeout(1300);
    }
  }

  console.log("4. final standings");
  await host.getByTestId("final-scores").waitFor({ state: "visible", timeout: 12000 });
  await guest.getByTestId("final-scores").waitFor({ state: "visible", timeout: 12000 });
  await screenshot(host, "finished-desktop");
  await guest.setViewportSize({ width: 390, height: 844 });
  await screenshot(guest, "finished-mobile");
  const hostFinal = await host.locator(".winner-panel h3").innerText();
  const guestFinal = await guest.locator(".winner-panel h3").innerText();
  assert.match(hostFinal, /YOU HELD THE SIGNAL/);
  assert.match(guestFinal, /ALICE HELD THE SIGNAL/);
  const finalScores = await host.getByTestId("final-scores").innerText();
  console.log("   final host:", hostFinal);
  console.log("   final guest:", guestFinal);
  console.log("   standings:", finalScores.replace(/\s+/g, " ").slice(0, 220));

  console.log("5. mobile landing");
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  watch(mobile, "mobile");
  await mobile.goto(base, { waitUntil: "networkidle" });
  await screenshot(mobile, "landing-mobile");
  await mobileContext.close();

  console.log("console+request errors:", errors);
  assert.deepEqual(errors, [], "no browser console or request errors");
  console.log("SIGNAL UI: all checks passed");
} finally {
  await browser.close();
}
