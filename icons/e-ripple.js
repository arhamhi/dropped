// E: the drop. a black pin on lead pink, the ground rippling out from where it hit, like a stone into water
const { C, pin, scene } = require('./_lib.js');
module.exports = scene('ripple', C.pink, (K, R, Y) => {
  const cx = 512, cy = Y + 360, r = 220, P = pin(cx, cy, r), d = K.polyDist(P);
  const box = [-40, Y - 40, 1064, Y + 1064];
  for (let k = 1; k <= 9; k++) for (const L of K.contours(d, box, 8, k * 44)) if (L.length > 8) K.sk(R, L, { col: C.pinkD, w: 5.5 - k * .35, a: .95 - k * .07, amp: 1.1, pool: false, dust: false });
  K.fillPoly(P.map(p => [p[0] + 16, p[1] + 14]), [90, 10, 40], .35);
  const Q = K.cutPaper(R, P, C.ink);
  const inner = (x, y) => -d(x, y);
  for (const [lv, col] of [[22, C.teal], [44, C.lime]]) for (const L of K.contours(inner, box, 6, lv)) if (L.length > 8) K.sk(R, L, { col, w: 3.2, a: .9, amp: .7, pool: false, dust: false });
  K.cutPaper(R, K.ring(cx, cy, 80, 60), C.pink, { shadow: 0 });
  K.hair(R, K.closed(K.ring(cx, cy, 80, 60)), [0, 0, 0], .5, { w: 2 });
});
