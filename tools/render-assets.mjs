// Renders public/og.png (1200x630) with your installed Chrome. The icons come from icons/build.sh (run that first).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + path.join(root, 'tools/og.html')); await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(root, 'public/og.png') });
await b.close();
console.log('og.png written');
