// icon A with no paper behind it, on the page colour, for tools/og.html (the share image)
const { C, scene } = require('./_lib.js');
module.exports = scene('painted-pin', C.page, require('./a-painted-pin.js').draw, 3, true);
