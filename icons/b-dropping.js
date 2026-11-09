// B: the pin falling out of the sky onto the curve of the Earth, the landing spot marked
const { C, pin, hole, scene, cross } = require('./_lib.js');
module.exports = scene('dropping', C.char, (K, R, Y) => {
  const gx = 512, gy = Y + 1024 + 420, gr = 660, G = K.ring(gx, gy, gr, 220);
  K.glow(R, gx, Y + 790, 520, 90, C.teal, .05, .3);
  const Q = K.cutPaper(R, G, C.tealD, { shadow: 0 });
  const lines = [];
  for (const m of [-.82, -.58, -.3, 0, .3, .58, .82]) {               // meridians
    const rx = gr * Math.sin(Math.abs(m)) || 2, pts = K.arc(gx, gy, rx, gr, Math.PI, 2 * Math.PI, 90).filter(p => (m < 0 ? p[0] <= gx : p[0] >= gx));
    lines.push([K.wob(R, K.resample(m === 0 ? [[gx, gy - gr], [gx, gy]] : pts, 4), .7), K.rgba(C.teal, .55), 2.2]);
  }
  for (const l of [.12, .26, .4]) { const y = gy - gr * Math.cos(l * Math.PI / 2 * 1.2) ; const rx = Math.sqrt(Math.max(0, gr * gr - (y - gy) ** 2)); lines.push([K.wob(R, K.resample(K.arc(gx, y, rx, rx * .12, Math.PI, 0, 90), 4), .7), K.rgba(C.teal, .45), 2]); }
  K.clippedLines(Q, lines);
  K.hair(R, K.closed(Q), C.teal, .8, { w: 3.4, amp: 1.2 });
  const land = [gx + 10, gy - gr + 92];
  cross(K, R, land[0], land[1], 30, C.chalk, 9);
  const r = 158, cx = 512, cy = Y + 350, P = pin(cx, cy, r, -.16);
  for (const [dx, h] of [[-95, 60], [-15, 95], [75, 50]]) { const top = cy - r - 30 - h; K.sk(R, [[cx + dx, top], [cx + dx + 4, cy - r - 30]], { col: C.chalk, w: 6, a: .75, taper: 'in', amp: 1 }); K.sk(R, [[cx + dx - 2, top - 70], [cx + dx, top - 40]], { col: C.chalk, w: 4, a: .45, taper: 'in', amp: .8 }); }
  const PQ = K.cutPaper(R, P, C.pink);
  K.hatch(R, K.clipRect(PQ, cx + 30, 0, 2000, 2000), 8, -1.1, .5, { col: C.pinkD, w: 2 });
  const H = hole(cx, cy, r, -.16); K.cutPaper(R, K.ring(H[0], H[1], 56, 48), C.char, { shadow: 0 });
});
