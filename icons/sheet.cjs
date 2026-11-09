// contact sheet: each icon as a rounded app icon at 360px, plus 120px and 48px to check it reads small
const path = require('path'), fs = require('fs');
const { createCanvas, loadImage } = require(require.resolve('@napi-rs/canvas', { paths: [path.join(process.env.HOME, '.claude/skills/arham-kengo-canvas/assets'), path.join(process.env.HOME, '.claude/skills/arham-hand-drawn-canvas/assets')] }));
const names = ['a-painted-pin', 'b-dropping', 'c-duel', 'd-road', 'e-ripple'], labels = ['A  Painted pin', 'B  Dropping in', 'C  The duel', 'D  The road', 'E  Ripple'];
(async () => {
  const S = 360, gap = 48, W = names.length * (S + gap) + gap, H = 640, cv = createCanvas(W, H), c = cv.getContext('2d');
  c.fillStyle = '#ece8e0'; c.fillRect(0, 0, W, H);
  const rr = (x, y, s, r) => { c.beginPath(); c.roundRect(x, y, s, s, r); };
  for (let i = 0; i < names.length; i++) {
    const img = await loadImage(path.join(__dirname, 'out', names[i] + '.png')), x = gap + i * (S + gap);
    for (const [s, y, dx] of [[S, 60, 0], [120, 470, 40], [48, 506, 200]]) { c.save(); rr(x + dx, y, s, s * .225); c.clip(); c.drawImage(img, x + dx, y, s, s); c.restore(); }
    c.fillStyle = '#111'; c.font = '600 26px Helvetica'; c.fillText(labels[i], x, 40);
  }
  fs.writeFileSync(path.join(__dirname, 'out', 'icons-sheet.png'), cv.toBuffer('image/png'));
  console.log('sheet ok');
})();
