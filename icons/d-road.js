// D: dropped on a road somewhere. a chalk street running to the horizon, the pin standing on the vanishing point
const { C, pin, scene } = require('./_lib.js');
module.exports = scene('road', C.char, (K, R, Y) => {
  const hz = Y + 600, vx = 512;
  K.glow(R, vx, Y + 330, 300, 290, C.teal, .07, .4);
  const road = [[vx - 14, hz], [vx + 14, hz], [1000, Y + 1064], [24, Y + 1064]];
  K.cutPaper(R, road, [36, 36, 40], { exact: true, shadow: 0 });
  K.hatch(R, road, 10, .05, .35, { col: [70, 70, 74], w: 1.6 });
  K.sk(R, [[vx - 14, hz], [24, Y + 1064]], { col: C.chalk, w: 7, a: .9, taper: 'in', amp: 1.2 });
  K.sk(R, [[vx + 14, hz], [1000, Y + 1064]], { col: C.chalk, w: 7, a: .9, taper: 'in', amp: 1.2 });
  for (let t = .1; t < 1; t = t * 1.0 + .16 + t * .22) {             // centre dashes, bigger as they come closer
    const y0 = hz + (Y + 1064 - hz) * t * t, y1 = hz + (Y + 1064 - hz) * Math.min(1, (t + .07 + t * .1) ** 2);
    const w0 = 2 + t * 26, P = [[vx - w0 * .5, y0], [vx + w0 * .5, y0], [vx + w0 * .6, y1], [vx - w0 * .6, y1]];
    K.cutPaper(R, P, C.lime, { shadow: 0, exact: true });
  }
  K.sk(R, [[-20, hz + 4], [300, hz - 2], [vx - 14, hz]], { col: C.chalk, w: 3.4, a: .7, amp: 1 });
  K.sk(R, [[vx + 14, hz], [760, hz + 3], [1044, hz - 4]], { col: C.chalk, w: 3.4, a: .7, amp: 1 });
  const r = 160, cy = hz - r * 1.94;
  K.glow(R, vx, hz + 4, 70, 12, [0, 0, 0], .5, .6);
  const PQ = K.cutPaper(R, pin(vx, cy, r), C.pink);
  K.hatch(R, K.clipRect(PQ, vx + 30, 0, 2000, 2000), 8, -1.05, .5, { col: C.pinkD, w: 2 });
  K.cutPaper(R, K.ring(vx, cy, 58, 48), C.char, { shadow: 0 });
});
