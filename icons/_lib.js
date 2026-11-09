// shared bits for the Dropped icon plates (arham-kengo-canvas kit)
const C = {
  page: [10, 10, 10], char: [22, 21, 23], pink: [247, 78, 130], pinkL: [255, 128, 162], pinkD: [214, 46, 104],
  lime: [200, 242, 83], teal: [60, 209, 195], tealD: [15, 44, 41], chalk: [238, 234, 226], cream: [240, 232, 212], ink: [16, 16, 18]
};
// the Dropped pin: head centred on (cx,cy) radius r, tip straight down at cy + 1.94r (same build as favicon.svg)
function pin(cx, cy, r, ang = 0) {
  const tip = [cx, cy + r * 1.94], a0 = 140 / 180 * Math.PI, a1 = 400 / 180 * Math.PI, P = [];
  const side = (a, b, n) => { for (let i = 0; i < n; i++) P.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
  const at = t => [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  side(tip, at(a0), 24);                                     // short edges so the scissor's smoothing keeps the point sharp
  for (let i = 0; i <= 64; i++) P.push(at(a0 + (a1 - a0) * i / 64));
  side(at(a1), tip, 24); P.pop(); P.push(tip);
  if (!ang) return P;
  const tx = cx, ty = cy + r * 1.94, co = Math.cos(ang), si = Math.sin(ang);
  return P.map(([x, y]) => [tx + (x - tx) * co - (y - ty) * si, ty + (x - tx) * si + (y - ty) * co]);
}
// bare: no paper sheet, the drawing sits straight on the page colour (for the share image)
const scene = (name, paper, draw, seed = 3, bare = false) => ({
  title: `dropped icon ${name}`, alt: `Dropped app icon, ${name}`, W: 1024, seed, top: 0, overlap: 0, bottom: 0, void: C.page,
  draw, sheets: [{ name, h: 1024, paper, draw(K, Y, Y1, R) { if (!bare) K.paper(R, -40, Y - 40, 1064, Y1 + 40, paper, { shadow: [0, 0, 0] }); draw(K, R, Y); } }]
});
// a hand-drawn X
function cross(K, R, x, y, s, col, w) {
  K.sk(R, [[x - s, y - s * .9], [x + s * .1, y + s * .05], [x + s, y + s * .95]], { col, w, a: .95, taper: 'out', amp: 1 });
  K.sk(R, [[x + s * .95, y - s], [x - s * .05, y + s * .1], [x - s * .9, y + s * .9]], { col, w, a: .95, taper: 'in', amp: 1 });
}
// a dashed hand line from a to b
function dashed(K, R, a, b, col, w, dash = 22, gap = 16) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  for (let s = 0; s < L; s += dash + gap) { const e = Math.min(L, s + dash); K.sk(R, [[a[0] + ux * s, a[1] + uy * s], [a[0] + ux * e, a[1] + uy * e]], { col, w, a: .9, pool: false, dust: false, press: 0, amp: .6 }); }
}
// where the hole sits once the pin is tilted about its tip
function hole(cx, cy, r, ang = 0) { const ty = cy + r * 1.94, d = cy - ty; return [cx - Math.sin(ang) * d, ty + Math.cos(ang) * d]; }
module.exports = { C, pin, hole, scene, cross, dashed };
