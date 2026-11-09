// Probe: load the keyless Street View embed for a point and read what the frame shows.
import { chromium } from 'playwright-core'; // uses your installed Chrome (channel: 'chrome')
const pts = process.argv.slice(2).map(s => s.split(',').map(Number));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
for (const [lat, lng] of pts) {
  await page.setContent(`<iframe id=f style="width:800px;height:500px;border:0" src="https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed"></iframe>`);
  await page.waitForTimeout(3500);
  const fr = page.frames().find(f => f.url().includes('/maps/embed'));
  const info = fr ? await fr.evaluate(() => ({
    links: [...document.querySelectorAll('a')].map(a => [a.textContent.trim(), a.href]).filter(x => x[1].includes('maps')).slice(0, 3),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
  })).catch(e => String(e)) : 'no frame';
  console.log(JSON.stringify({ lat, lng, info }, null, 1));
}
await browser.close();
