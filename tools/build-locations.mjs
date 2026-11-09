// Builds public/locations/{easy,medium,hard}.json: official Google Street View car panoramas only.
// 1) Pick a point near a seed (distance depends on tier) and snap it to the nearest road with OSRM.
// 2) Load the keyless Street View embed for that road point in headless Chrome.
// 3) Keep it only if the frame says Google car coverage (!2e0 and a "© <year> Google" credit).
// Usage: node tools/build-locations.mjs [easyTarget=100] [mediumTarget=220] [hardTarget=160]
import { chromium } from 'playwright-core'; // uses your installed Chrome (channel: 'chrome')
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUTDIR = path.join(here, '../src/data'); // server-only: never in public/, or players could look answers up
fs.mkdirSync(OUTDIR, { recursive: true });
const readSeeds = f => fs.readFileSync(path.join(here, f), 'utf8').trim().split('\n')
  .map(l => { const [cc, ll] = l.split('|'); const [lat, lng] = ll.split(',').map(Number); return { cc, lat, lng }; });

const [eT, mT, hT] = process.argv.slice(2).map(Number);
const TIERS = {
  easy:   { seeds: readSeeds('easy-seeds.txt'), min: 0,  max: 1.5, target: eT || 100 },
  medium: { seeds: readSeeds('seeds.txt'),      min: 1,  max: 15,  target: mT || 220 },
  hard:   { seeds: readSeeds('seeds.txt'),      min: 20, max: 80,  target: hT || 160 },
};
const out = {}, seen = new Set();
for (const t in TIERS) {
  const f = path.join(OUTDIR, t + '.json');
  out[t] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  out[t].forEach(l => seen.add(l.id));
}
const save = t => fs.writeFileSync(path.join(OUTDIR, t + '.json'), JSON.stringify(out[t]));
const done = t => out[t].length >= TIERS[t].target;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function jitter(s, minKm, maxKm) {
  const d = minKm + Math.random() * (maxKm - minKm), a = Math.random() * 2 * Math.PI;
  return { lat: s.lat + (d / 111) * Math.cos(a), lng: s.lng + (d / (111 * Math.cos(s.lat * Math.PI / 180))) * Math.sin(a) };
}
async function snap(p) {
  try {
    const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${p.lng.toFixed(5)},${p.lat.toFixed(5)}?number=1`,
      { headers: { 'User-Agent': 'geo-duel-personal-game/0.1' } });
    const j = await r.json();
    const w = j.waypoints?.[0];
    if (!w || w.distance > 3000) return null;
    return { lat: w.location[1], lng: w.location[0] };
  } catch { return null; }
}

async function probe(page, p) {
  await page.setContent(`<iframe style="width:800px;height:500px;border:0" src="https://www.google.com/maps?layer=c&cbll=${p.lat},${p.lng}&cbp=12,0,0,0,0&output=svembed"></iframe>`);
  for (let t = 0; t < 14; t++) {
    await sleep(500);
    const fr = page.frames().find(f => f.url().includes('/maps/embed'));
    if (!fr) continue;
    const info = await fr.evaluate(() => {
      const txt = document.body.innerText.replace(/\s+/g, ' ');
      const view = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'View on Google Maps');
      return { txt, href: view?.href || null };
    }).catch(() => null);
    if (!info) continue;
    if (info.txt.includes('No Street View')) return null;
    if (!info.href) continue;
    const m = info.href.match(/@(-?[\d.]+),(-?[\d.]+),[^/]*\/data=.*?!1s([^!]+)!2e(\d+)/);
    if (!m || m[4] !== '0' || !/© \d{4} Google/.test(info.txt)) return null;
    const label = info.txt.split(' View on Google Maps')[0].trim();
    return { id: m[3], lat: +(+m[1]).toFixed(6), lng: +(+m[2]).toFixed(6), label };
  }
  return null;
}

const queue = [];
let producing = true;
(async () => {
  while (!Object.keys(TIERS).every(done)) {
    for (const t of Object.keys(TIERS)) {
      if (done(t) || queue.filter(q => q.tier === t).length > 8) continue;
      const T = TIERS[t], s = T.seeds[Math.floor(Math.random() * T.seeds.length)];
      const p = await snap(jitter(s, T.min, T.max));
      if (p) queue.push({ ...p, cc: s.cc, tier: t });
      await sleep(400);
    }
    await sleep(50);
  }
  producing = false;
})();

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pages = await Promise.all([0, 1, 2, 3].map(() => browser.newPage()));
const tried = { easy: 0, medium: 0, hard: 0 };
await Promise.all(pages.map(async page => {
  while (producing || queue.length) {
    const p = queue.shift();
    if (!p) { await sleep(300); continue; }
    if (done(p.tier)) continue;
    const r = await probe(page, p).catch(() => null);
    tried[p.tier]++;
    const pool = out[p.tier];
    const minGap = p.tier === 'easy' ? 0.003 : 0.02; // keep spots apart
    if (r && !seen.has(r.id) && !pool.some(o => Math.hypot(o.lat - r.lat, o.lng - r.lng) < minGap)) {
      seen.add(r.id); pool.push({ ...r, cc: p.cc, heading: Math.round(Math.random() * 360) }); save(p.tier);
    }
    const sum = Object.values(tried).reduce((a, b) => a + b, 0);
    if (sum % 25 === 0) console.log(new Date().toISOString().slice(11, 19), Object.keys(TIERS).map(t => `${t} ${out[t].length}/${TIERS[t].target} (tried ${tried[t]})`).join(' | '));
  }
}));
console.log('DONE', Object.keys(TIERS).map(t => `${t} ${out[t].length}`).join(' '));
await browser.close();
