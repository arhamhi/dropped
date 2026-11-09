// A: one big hand-made pin, cut from pink paper, shaded in pencil, stuck into a fat teal X (the real spot)
const { C, pin, scene } = require('./_lib.js');
module.exports = scene('painted-pin', C.char, (K, R, Y) => {
  const cx = 512, cy = Y + 340, r = 228, P = pin(cx, cy, r), tipY = cy + r * 1.94;
  K.glow(R, cx, tipY + 40, 210, 50, C.teal, .26, .4);                        // where it lands
  const xy = tipY + 34, xs = 74;                                              // the real spot: a fat painted X
  const arms = [[[cx - xs, xy - xs * .82], [cx + xs, xy + xs * .86]], [[cx + xs * .96, xy - xs * .84], [cx - xs * .92, xy + xs * .84]]];
  for (const [a, b] of arms) K.sk(R, [[a[0] + 8, a[1] + 10], [b[0] + 8, b[1] + 10]], { col: [0, 0, 0], w: 40, a: .45, pool: false, dust: false, press: 0, amp: 1 });
  for (const [a, b] of arms) {
    K.sk(R, [a, [(a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2 - 2], b], { col: C.teal, w: 40, a: 1, press: .18, pool: false, dust: true, amp: 1.6 });
    K.sk(R, [a, b].map(p => [p[0] * .86 + (a[0] + b[0]) / 2 * .14 - 4, p[1] * .86 + (a[1] + b[1]) / 2 * .14 - 7]), { col: [160, 244, 234], w: 5, a: .6, taper: 'both', amp: 1, pool: false, dust: false });
  }
  K.fillPoly(P.map(p => [p[0] + 18, p[1] + 16]), [0, 0, 0], .45);            // lifted off the page
  const Q = K.cutPaper(R, P, C.pink);
  K.hatch(R, K.clipRect(Q, cx + 40, 0, 2000, 2000), 9, -1.05, .55, { col: C.pinkD, w: 2.2 });
  for (const [rr, a0, a1, w] of [[r * .78, 3.5, 4.35, 14], [r * .62, 3.65, 4.1, 8]]) K.sk(R, K.arc(cx, cy, rr, rr, a0, a1, 24), { col: C.pinkL, w, a: .8, taper: 'both', amp: .8 });
  K.hair(R, K.closed(Q.map(p => [p[0] - 10, p[1] - 8])), C.chalk, .55, { w: 2.2, amp: .9 });  // misregistered print line
  K.cutPaper(R, K.ring(cx, cy, 84, 60), C.char, { shadow: 0 });
  K.hatch(R, K.ring(cx + 6, cy + 8, 78, 40), 7, .8, .35, { col: [0, 0, 0], w: 1.6 });
});
