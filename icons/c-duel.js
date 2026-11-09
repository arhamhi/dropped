// C: the duel. a torn scrap of map, your pink pin and their lime pin, dashed lines to the teal X. closest wins.
const { C, pin, hole, scene, cross, dashed } = require('./_lib.js');
module.exports = scene('duel', C.char, (K, R, Y) => {
  const Q = K.paper(R, 110, Y + 150, 914, Y + 900, C.cream, { edge: 'torn', rot: -.05, shadow: [10, 14, .5] });
  const box = [80, Y + 120, 944, Y + 930], f = (x, y) => K.fbm(x / 260, y / 260, 11, 3), lines = [];
  for (const lv of [.32, .38, .44, .5, .56, .62, .68]) for (const L of K.contours(f, box, 8, lv)) if (L.length > 6) lines.push([K.wob(R, K.resample(L, 4), .5), K.rgba([150, 140, 120], .55), 1.6]);
  K.clippedLines(Q, lines);
  const X = [548, Y + 640];
  const drop = (col, colD, cx, cy, r, ang) => {
    const P = pin(cx, cy, r, ang), tip = P[0];
    dashed(K, R, tip, X, K.shade(col, .25), 5);
    K.fillPoly(P.map(p => [p[0] + 14, p[1] + 10]), [0, 0, 0], .28);
    const PQ = K.cutPaper(R, P, col);
    K.hatch(R, K.clipRect(PQ, cx + r * .25, 0, 2000, 2000), 7, -1.05, .5, { col: colD, w: 1.8 });
    const H = hole(cx, cy, r, ang); K.cutPaper(R, K.ring(H[0], H[1], r * .36, 40), C.cream, { shadow: .2 });
  };
  cross(K, R, X[0], X[1], 42, [28, 160, 150], 13);
  drop(C.lime, [150, 190, 40], 700, Y + 380, 118, .14);
  drop(C.pink, C.pinkD, 330, Y + 300, 138, -.12);
});
