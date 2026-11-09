// Two-player end-to-end run against a local or deployed Dropped. Saves screenshots per phase.
// Usage: node tools/e2e.mjs [baseUrl=http://localhost:8797] [outDir=shots/e2e]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:8797';
const OUT = process.argv[3] || 'shots/e2e';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const A = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const B = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = [];
for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errs.push(`${n}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${n} console: ${m.text()}`)); }
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` });
const screen = (p, s) => p.waitForFunction(x => document.body.dataset.screen === x, s, { timeout: 20000 });
const step = msg => console.log('·', msg);

await A.goto(BASE); await A.fill('#name', 'Arham'); await A.click('button[data-mode="duo"]');
await screen(A, 'lobby'); step('A in lobby');
const link = await A.inputValue('#inviteLink');
await B.goto(link); await B.fill('#name', 'Bilal'); await B.click('button[data-mode="join"]');
await screen(B, 'lobby'); step('B joined');
await A.click('#settings label:has-text("Mixed")');
await A.click('#settings label:has-text("3")');
await A.click('#settings label:has-text("15s after first pin")');
await A.waitForTimeout(800);
await shot(A, '01-lobby-host'); await shot(B, '02-lobby-guest');
const guestSees = await B.evaluate(() => [...document.querySelectorAll('#settings input:checked')].map(i => i.value).join(','));
step('guest sees settings: ' + guestSees);
await A.click('#startBtn');


// Click the guess map until a pin lands (the phone sheet slides up, so the first click can miss).
async function pinAt(page, fx, fy) {
  for (let i = 0; i < 4; i++) {
    const b = await page.locator('#guessMap').boundingBox();
    await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
    try { await page.waitForSelector('#lockBtn:not([disabled])', { timeout: 1500 }); return; } catch {}
  }
  throw new Error('pin never landed on the guess map');
}
for (let rd = 0; rd < 3; rd++) {
  await screen(A, 'round'); await screen(B, 'round');
  await A.waitForTimeout(4500);
  if (rd === 0) { await shot(A, '03-round-desktop'); await shot(B, '04-round-phone'); }
  // A pins somewhere and locks
  const box = await A.locator('#guessMap').boundingBox();
  await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await A.waitForTimeout(400);
  await pinAt(A, 0.3 + rd * 0.15, 0.45);
  await A.click('#lockBtn');
  await B.waitForFunction(() => document.querySelector('#status').textContent.includes('locked in'), null, { timeout: 8000 });
  if (rd === 0) { await B.waitForTimeout(1200); await shot(B, '05-phone-opponent-locked'); }
  step(`rd ${rd + 1}: B sees "${await B.textContent('#status')}" clock ${await B.textContent('#clock')}`);
  // B opens the sheet, pins, locks (round 2: B lets the clock run out instead)
  if (rd !== 1) {
    await B.click('#mapToggle'); await B.waitForTimeout(500);
    await pinAt(B, 0.6, 0.4);
    if (rd === 0) { await B.waitForTimeout(700); await shot(B, '06-phone-map-open'); }
    await B.click('#lockBtn');
  } else step('rd 2: B waits for the 15s clock');
  await screen(A, 'reveal'); await screen(B, 'reveal');
  await A.waitForTimeout(2000);
  if (rd === 0) { await shot(A, '07-reveal-desktop'); await shot(B, '08-reveal-phone'); }
  if (rd === 1) await shot(A, '09-reveal-timeout');
  step(`rd ${rd + 1}: ${await A.textContent('#revealPlace')} | ${(await A.textContent('#revealRows')).replace(/\s+/g, ' ')}`);
  await A.click('#nextBtn'); await A.waitForTimeout(300);
  if (rd === 0) step('A ready, A note: ' + await A.textContent('#nextNote'));
  await B.click('#nextBtn');
}
await screen(A, 'final'); await screen(B, 'final');
await A.waitForTimeout(2500);
await shot(A, '10-final-desktop'); await shot(B, '11-final-phone');
step('final: ' + await A.textContent('#finalTitle') + ' | ' + await A.textContent('#finalSub'));

// past games show up on the home screen afterwards
await A.goto(BASE); await A.waitForTimeout(2500);
await A.click('#runs summary');
await A.waitForTimeout(300);
await shot(A, '14-home-history');
step('history: ' + (await A.textContent('#records')).replace(/\s+/g, ' ') + ' | ' + (await A.locator('#runs li').count()) + ' run(s)');

// solo
const C = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
C.on('pageerror', e => errs.push(`C: ${e.message}`));
await C.goto(BASE); await C.fill('#name', 'Arham'); await C.click('button[data-mode="solo"]');
await screen(C, 'lobby');
await C.click('#settings label:has-text("Hard")'); await C.click('#settings label:has-text("60s")'); await C.click('#settings label:has-text("Frozen")');
await C.waitForTimeout(600); await shot(C, '12-solo-lobby');
await C.click('#startBtn'); await screen(C, 'round'); await C.waitForTimeout(4500); await shot(C, '13-solo-round-frozen');
step('solo clock: ' + await C.textContent('#clock') + ', tier ' + await C.textContent('#bugTier'));

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await browser.close();
