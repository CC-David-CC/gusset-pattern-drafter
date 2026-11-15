// Round POST8: the rows toward 1.0. FIX-5 / A: the 3D pattern menu's arrangement rows (Symmetric Arrangement, Flip ▸ Wrap
// Direction, Reverse-Arrange ▸ Horizontally / Vertically, Duplicate to Symmetric Patterns).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}

// A, a trapezoid (no symmetry of its own), and B its symmetric copy mirrored about the upright x = 350; both up in 3D
const PAIR = `
  const out = {}, G3 = app.G3, SIM3D = app.ev("SIM3D");
  app.ev("setLayout")("both");
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:700,y:0},{x:400,y:0},{x:400,y:400},{x:700,y:300}], true));
  B.segs.forEach((s, k) => { s.id = A.segs[k].id; });
  B.link = { of: A.id, kind: "symmetric", m: [-1, 0, 0, 1, 700, 0] };
  S.pieces.push(A, B);
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
  // where 2D point (x, y) of pattern p stands in the 3D window now
  const W = (p, x, y) => { const c = G3.items.get(p.id).mesh.c; return SIM3D.placePoint(x, y, app.ev("p3C")(p, c), app.ev("pieceP3")(p, c), [0, 0, 0]).map(v => +v.toFixed(4)); };
  const CORNERS = [[0, 0], [300, 0], [300, 400], [0, 300], [150, 200]];
  const rows = () => { const L = []; const walk = (R) => { for (const r of R || []) { if (r && r.n) L.push(r); if (r && typeof r.menu === "function") walk(r.menu()); } }; walk(app.ev("contextMenuRows")()); return L; };
`;

test("POST8 FIX-5 / A1: Symmetric Arrangement places the symmetric copy as the mirror image across the avatar's middle, flat and wrapped, one step", () => {
  const o = boot({ blank: true, three: true, script: PAIR + `
    const tilt = SIM3D.qMul(SIM3D.qAxis([0, 1, 0], 30), SIM3D.qAxis([1, 0, 0], 12));
    out.cases = [];
    for (const r of [0, 260, -260]) {
      A.p3 = { pos: [180, 1150, 140], q: tilt, r, o: [150, 200], pt: "chest_l" }; app.commit();
      S.sel = [A.id]; app.ev("symArrange3")();
      // every corner of A, mirrored across x = 0, is where the same corner of B (through the pair's mirror) stands
      const err = Math.max(...CORNERS.map(([x, y]) => { const a = W(A, x, y), b = W(B, 700 - x, y); return Math.hypot(-a[0] - b[0], a[1] - b[1], a[2] - b[2]); }));
      out.cases.push([r, +err.toFixed(6), B.p3.r, S.un[S.un.length - 1].n]);
    }
    const n = S.undo.length; app.undo(); out.undo = [S.undo.length === n - 1, S.pieces[1].p3.r];
    // the copy selected works too (the map run the other way)
    const A2 = S.pieces[0], B2 = S.pieces[1];                      // undo made the patterns afresh
    A2.p3 = { pos: [200, 1000, 150], q: [0, 0, 0, 1], r: 0, o: [150, 200] }; app.commit();
    B2.p3 = { pos: [50, 900, 120], q: [0, 0, 0, 1], r: 0, o: [550, 200] }; app.commit();
    S.sel = [B2.id]; app.ev("symArrange3")();
    out.back = [S.pieces[0].p3.pos.map(v => +v.toFixed(3)), S.pieces[1].p3.pos];
    // a pattern with no copy: nothing happens, a toast says why
    const C = app.mkPiece("C", app.mkShape([{x:0,y:600},{x:100,y:600},{x:100,y:700}], true)); S.pieces.push(C); app.commit(); app.ev("garmentSync")();
    const k = S.undo.length; S.sel = [C.id]; app.ev("symArrange3")(); out.none = S.undo.length - k;
    out.row = rows().filter(r => r.n === "Symmetric Arrangement").map(r => !!r.nb);
    return out;` });
  for (const c of o.cases) {
    assert.ok(c[1] < 1e-3, "mirror image within 0.001 mm at radius " + c[0] + ": " + c[1]);
    assert.strictEqual(c[2], c[0], "the same curve");
    assert.strictEqual(c[3], "Symmetric Arrangement");
  }
  assert.deepStrictEqual(o.undo, [true, 260], "undo puts the copy back where the step before left it");
  assert.deepStrictEqual(o.back[0], [-50, 900, 120], "the copy selected places its source");
  assert.strictEqual(o.none, 0);
  assert.deepStrictEqual(o.row, [false], "a real row, not a placeholder");
});

test("POST8 FIX-5 / A2: Reverse-Arrange flips a wrapped pattern left to right / top to bottom where it stands, keeping its curve; Flip Wrap Direction turns it in its own plane round the same axis (greyed for a flat one)", () => {
  const o = boot({ blank: true, three: true, script: PAIR + `
    const set = () => { A.p3 = { pos: [120, 1150, 140], q: SIM3D.qAxis([0, 1, 0], 25), r: 220, o: [150, 200] }; app.commit(); S.sel = [A.id]; };
    const before = () => CORNERS.map(([x, y]) => W(A, x, y)), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    // a mirrored pair of 2D points about the place it hangs on (150, 200): u -> -u is x -> 300 - x, v -> -v is y -> 400 - y
    const check = (fn, map) => { set(); const was = CORNERS.map(([x, y]) => W(A, ...map(x, y))); fn(); return +Math.max(...CORNERS.map(([x, y], k) => d(W(A, x, y), was[k]))).toFixed(6); };
    out.h = check(() => app.ev("reverseArrange3")("h"), (x, y) => [300 - x, y]);
    out.hStep = [S.un[S.un.length - 1].n, A.p3.r];
    out.v = check(() => app.ev("reverseArrange3")("v"), (x, y) => [x, 400 - y]);
    out.vStep = S.un[S.un.length - 1].n;
    out.wrap = check(() => app.ev("wrapFlip3")(), (x, y) => [300 - x, 400 - y]);
    out.wrapStep = [S.un[S.un.length - 1].n, A.p3.r];
    // twice is where it was
    set(); const w0 = before(); app.ev("reverseArrange3")("h"); app.ev("reverseArrange3")("h"); out.twice = +Math.max(...before().map((p, k) => d(p, w0[k]))).toFixed(6);
    // the cylinder's axis stays: every point as far from it as before
    set(); app.ev("reverseArrange3")("h"); out.r = A.p3.r;
    // flat: Wrap Direction greyed and does nothing
    A.p3 = { pos: [0, 1000, 100], q: [0, 0, 0, 1], r: 0, o: [150, 200] }; app.commit(); S.sel = [A.id];
    const k = S.undo.length; app.ev("wrapFlip3")(); out.flat = [S.undo.length - k, app.ev("wrapFlipOff")()];
    out.rows = rows().filter(r => /Flip Wrap Direction|^Horizontally$|^Vertically$/.test(r.n)).map(r => r.n + (r.nb ? " nb" : ""));
    return out;` });
  assert.ok(o.h < 1e-3, "Reverse-Arrange Horizontally: each point where its left-right mirror stood (" + o.h + ")");
  assert.deepStrictEqual(o.hStep, ["Reverse-Arrange Horizontally", -220], "one step; the curve turned toward its other face");
  assert.ok(o.v < 1e-3, "Vertically: each point where its top-bottom mirror stood (" + o.v + ")");
  assert.strictEqual(o.vStep, "Reverse-Arrange Vertically");
  assert.ok(o.wrap < 1e-3, "Flip Wrap Direction: half round in its own plane (" + o.wrap + ")");
  assert.deepStrictEqual(o.wrapStep, ["Flip Wrap Direction", 220]);
  assert.ok(o.twice < 1e-3, "twice is where it was");
  assert.strictEqual(o.r, -220);
  assert.deepStrictEqual(o.flat, [0, true], "a flat pattern: greyed, no step");
  assert.ok(o.rows.includes("Flip Wrap Direction") && o.rows.includes("Horizontally") && o.rows.includes("Vertically") && !o.rows.some(n => / nb$/.test(n)), JSON.stringify(o.rows));
});

test("POST8 FIX-5 / A3: Duplicate to Symmetric Patterns mirrors the pins onto the symmetric copy (not doubled); a curve below 0 is kept in a file", () => {
  const o = boot({ blank: true, three: true, script: PAIR + `
    A.pins = [{ x: 10, y: 20 }, { x: 250, y: 300 }]; app.commit(); S.sel = [A.id];
    app.ev("pinsToSymmetric3")(); out.pins = B.pins; out.step = S.un[S.un.length - 1].n;
    const k = S.undo.length; app.ev("pinsToSymmetric3")(); out.again = [B.pins.length, S.undo.length - k];
    out.row = rows().filter(r => r.n === "Duplicate to Symmetric Patterns").map(r => !!r.nb);
    // a reversed pattern's curve survives the file
    A.p3 = { pos: [0, 1000, 100], q: [0, 0, 0, 1], r: -180, o: [150, 200] }; app.commit();
    const doc = JSON.parse(app.ev("docJSON")()); out.saved = doc.pieces[0].p3.r;
    out.norm = [app.ev("normP3")({ pos: [0, 0, 0], q: [0, 0, 0, 1], r: -180 }).r, app.ev("normP3")({ pos: [0, 0, 0], q: [0, 0, 0, 1], r: "x" }).r];
    return out;` });
  assert.deepStrictEqual(o.pins, [{ x: 690, y: 20 }, { x: 450, y: 300 }]);
  assert.strictEqual(o.step, "Duplicate to Symmetric Patterns");
  assert.deepStrictEqual(o.again, [2, 0], "the second time nothing new: no pin doubled, no step");
  assert.deepStrictEqual(o.row, [false]);
  assert.strictEqual(o.saved, -180);
  assert.deepStrictEqual(o.norm, [-180, 0]);
});

module.exports = T;
