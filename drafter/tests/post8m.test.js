// Round POST8, thirteenth session. P8.1: the schematic's seam lines are drawn from the cloth points sewn together, not from where the pattern
// pass changes colour; near such a line a colour change between two sewn patterns makes no line (the spurs and specks where two mirrored
// panels cross beside a centre-back seam). Elsewhere a colour change still draws.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const fs = require("fs"), os = require("os"), f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "post8m-")), "opt.json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  fs.unlinkSync(f); fs.rmdirSync(path.dirname(f));
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr + (r.error ? r.error.message : ""));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}

test("P8.1 / 1: schLines: a zig-zag colour boundary between two sewn patterns beside their drawn seam line makes no line (only the seam line is drawn); the same boundary between patterns not sewn, or far from a seam line, still draws", () => {
  const o = boot({ blank: true, script: `
    const L3 = app.ev("schLines"), W = 60, H = 40, N = W*H, id = app.ev("schId");
    const a = id(1), b = id(2), c = id(3);
    // the pattern pass: pattern 1 left, pattern 2 right of a boundary that zig-zags round x = 30 (x 29 / 31 by row); pattern 3 in the far right quarter
    const mk = () => { const I = new Uint8Array(4*N), D = new Uint8Array(4*N), L = new Uint8Array(4*N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y*W + x, z = 30 + (y % 4 < 2 ? -1 : 1), q = x < z ? a : x < 50 ? b : c; I[4*p] = q[0]; I[4*p+1] = q[1]; I[4*p+2] = q[2]; I[4*p+3] = 255; D[4*p] = 100; D[4*p+3] = 255; L[4*p+3] = 255; }
      return { I, D, L }; };
    const P = mk();
    for (let y = 0; y < H; y++) { const p = y*W + 30; P.L[4*p+1] = 255; }      // the seam's own line, green, straight at x = 30
    const sewn = (pairs) => ({ at: new Map([[a, 0], [b, 1], [c, 2]].map(([q, k]) => [q[0]*65536 + q[1]*256 + q[2], k])), pairs: new Set(pairs) });
    const cols = (m) => { const s = new Set(); for (let p = 0; p < N; p++) if (m[p]) s.add(p % W); return [...s].sort((x, y) => x - y); };
    const on = L3(P.I, P.D, P.L, W, H, 1e9, 1e9, sewn(["0|1"]), 4).seam, off = L3(P.I, P.D, P.L, W, H, 1e9, 1e9, sewn([]), 4).seam;
    const Q = mk(), far = L3(Q.I, Q.D, Q.L, W, H, 1e9, 1e9, sewn(["0|1", "1|2"]), 4).seam;      // no seam line drawn at all
    return { on: cols(on), off: cols(off), far: cols(far) };` });
  assert.deepStrictEqual(o.on, [30, 49], "sewn, beside the drawn line: the line alone at x = 30 (the boundary to pattern 3, not sewn to 2, still draws at 49)");
  assert.ok(o.off.includes(28) || o.off.includes(29), "not sewn: the zig-zag colour change draws as before: " + o.off);
  assert.ok(o.far.includes(49) && (o.far.includes(28) || o.far.includes(29)), "sewn but with no seam line near: the colour change still draws: " + o.far);
});

test("P8.1 / 2: schSeamRuns gives each shown seam's two sides on the cloth (from its sewn points, one run per pattern); a deactivated, hidden or glued seam none; schSewnPairs names the two sewn patterns by their pass colours", () => {
  const o = boot({ blank: true, three: true, script: `
    const G3 = app.G3; app.ev("setLayout")("both");
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
    const A = S.pieces[0], B = S.pieces[1];
    A.p3 = { pos: [500, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [500, 1100, -120], q: [0, 1, 0, 0], r: 0 };
    S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
    app.commit();
    const sm = app.ev("makeSeam")(S.seams, { piece: A.id, sid: A.segs[1].id }, { piece: B.id, sid: B.segs[3].id }, true); S.seams.push(sm); app.commit(); app.ev("garmentSync")();
    const items = [...G3.items.values()], runs = app.ev("schSeamRuns")(items);
    const sp = app.ev("schSewnPairs")(items);
    S.seams[0].off = true; app.commit(); const offRuns = app.ev("schSeamRuns")([...G3.items.values()]).length; S.seams[0].off = false;
    S.seams[0].hide = true; app.commit(); const hidRuns = app.ev("schSeamRuns")([...G3.items.values()]).length; delete S.seams[0].hide; app.commit();
    const len = (r) => { let s = 0; for (let k = 1; k < r.length; k++) s += r[k].distanceTo(r[k-1]); return s; };
    return { n: runs.length, lens: runs.map(r => Math.round(len(r))), pairs: [...sp.pairs], at: sp.at.size, offRuns, hidRuns };` });
  assert.strictEqual(o.n, 2, "the seam's two sides");
  for (const l of o.lens) assert.ok(Math.abs(l - 400) < 30, "each side along its 400 mm edge: " + o.lens);
  assert.deepStrictEqual(o.pairs, ["0|1"]); assert.strictEqual(o.at, 2);
  assert.deepStrictEqual([o.offRuns, o.hidRuns], [0, 0]);
});

test("P8.1 / 3 (batch 0n): a seam line along the outline is left to the outline: its pixels beside the outline go, a short piece left near it goes, a short seam away from the outline and a long seam stay", () => {
  const o = boot({ blank: true, script: `
    const L3 = app.ev("schLines"), W = 80, H = 60, N = W*H, a = app.ev("schId")(1);
    const I = new Uint8Array(4*N), D = new Uint8Array(4*N), L = new Uint8Array(4*N);
    // one pattern from x = 10 to 70 (its outline there), the background outside
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y*W + x, on = x >= 10 && x < 70; if (on) { I[4*p] = a[0]; I[4*p+1] = a[1]; I[4*p+2] = a[2]; } I[4*p+3] = 255; D[4*p] = 100; D[4*p+3] = 255; L[4*p+3] = 255; }
    const g = (x, y) => { L[4*(y*W + x) + 1] = 255; };
    for (let y = 5; y < 55; y++) g(10, y);            // a side seam on the outline itself, seen edge-on
    for (let y = 20; y < 25; y++) g(13, y);           // a short stub just inside the outline (5 px)
    for (let y = 20; y < 25; y++) g(40, y);           // a short seam in the middle (5 px): kept
    for (let y = 5; y < 55; y++) g(55, y);            // a long seam: kept
    const m = L3(I, D, L, W, H, 1e9, 1e9, { at: new Map(), pairs: new Set() }, 8).seam;      // near 8 = SCH_SEAM_NEAR x 2: supersampled twice
    const cols = new Set(); for (let p = 0; p < N; p++) if (m[p]) cols.add(p % W);
    return [...cols].sort((x, y) => x - y);` });
  assert.deepStrictEqual(o, [40, 55], "only the middle short seam and the long one");
});

module.exports = T;
