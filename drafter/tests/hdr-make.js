// (POST8 batch 0k) small high dynamic range pictures written for the tests (no picture from anywhere else): a Radiance .hdr (RGBE, flat
// scanlines) and an OpenEXR .exr (scanlines, no compression, 32-bit float channels). f(x, y) gives [r, g, b] for column x, row y (row 0 the top).
"use strict";

function rgbe(r, g, b) {
  const v = Math.max(r, g, b);
  if (!(v > 1e-32)) return [0, 0, 0, 0];
  const e = Math.ceil(Math.log2(v) + 1e-12), s = 256/Math.pow(2, e);
  // v·s is below 256 (the mantissa under 1): a value exactly a power of two would otherwise reach 256
  const c = (x) => Math.min(255, Math.floor(x*s));
  return [c(r), c(g), c(b), e + 128];
}
function hdrBytes(w, h, f) {
  const head = Buffer.from("#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y " + h + " +X " + w + "\n", "latin1");
  const px = Buffer.alloc(w*h*4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(rgbe(...f(x, y)), 4*(y*w + x));
  return Buffer.concat([head, px]);
}

function exrBytes(w, h, f) {
  const parts = [], str = (s) => Buffer.from(s + "\0", "latin1"), i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v); return b; };
  const f32 = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v); return b; };
  const attr = (name, type, data) => parts.push(str(name), str(type), i32(data.length), data);
  parts.push(Buffer.from([0x76, 0x2f, 0x31, 0x01]), i32(2));
  // channels in alphabetical order, each FLOAT (2), pLinear 0, reserved, xSampling 1, ySampling 1
  const ch = Buffer.concat([...[..."BGR"].map(c => Buffer.concat([str(c), i32(2), Buffer.from([0, 0, 0, 0]), i32(1), i32(1)])), Buffer.from([0])]);
  attr("channels", "chlist", ch);
  attr("compression", "compression", Buffer.from([0]));
  const box = Buffer.concat([i32(0), i32(0), i32(w - 1), i32(h - 1)]);
  attr("dataWindow", "box2i", box);
  attr("displayWindow", "box2i", box);
  attr("lineOrder", "lineOrder", Buffer.from([0]));
  attr("pixelAspectRatio", "float", f32(1));
  attr("screenWindowCenter", "v2f", Buffer.concat([f32(0), f32(0)]));
  attr("screenWindowWidth", "float", f32(1));
  parts.push(Buffer.from([0]));
  const head = Buffer.concat(parts), lineSize = 3*4*w, block = 8 + lineSize, start = head.length + 8*h;
  const table = Buffer.alloc(8*h);
  for (let y = 0; y < h; y++) table.writeBigUInt64LE(BigInt(start + y*block), 8*y);
  const lines = [];
  for (let y = 0; y < h; y++) {
    const b = Buffer.alloc(block);
    b.writeInt32LE(y, 0); b.writeInt32LE(lineSize, 4);
    for (let x = 0; x < w; x++) { const [r, g, bl] = f(x, y); b.writeFloatLE(bl, 8 + 4*x); b.writeFloatLE(g, 8 + 4*(w + x)); b.writeFloatLE(r, 8 + 4*(2*w + x)); }
    lines.push(b);
  }
  return Buffer.concat([head, table, ...lines]);
}
module.exports = { hdrBytes, exrBytes, rgbe };
