// Round PULL-3c: PULL-3b a bit more movable, still never off (the maintainer's hand test of PULL-3b: "better, but still too stuck").
// The pull's force is a preference now, Pull Strength (Settings ▸ 3D ▸ Simulation), its default 70 % of the most measured to keep every
// garment of the pull gate on (scripts/pull-real.js), its slider never above that; the hand's own friction
// (dragSlide) holds only while the pull is held. The gate itself is the real page: scripts/pull-real.js and the browser smoke's group pull3.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const C = require("../drafter-sim.js");
const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt, ms) {
  const f = path.join(os.tmpdir(), "pdraft-pull3c-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: ms || 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung on boot");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
function sheet(w, h, res) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res), dx = w/nx, dy = h/ny;
  for (let i = 0; i < nx; i++) pts.push([i*dx, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*dy]);
  for (let i = 0; i < nx; i++) pts.push([w - i*dx, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*dy]);
  return C.meshPolygon(pts, res);
}

test("pull3c / 1 Pull Strength (guess pull3c/3): 5.6 N by default (70 % of the measured 8 N), kept within 1.9 to 8 N whatever is stored, a preference and never a file's; the Settings box's 3D page has its slider from 1.9 to 8 N with its plain words", () => {
  const o = boot({ script: `
    const out = {};
    const P = app.ev("normPrefs"), N = () => app.ev("pullN")();
    out.consts = [app.ev("PULL_DEFAULT"), app.ev("PULL_SAFE"), app.ev("PULL_MIN")];
    S.prefs = P(null); out.def = [N(), app.ev("pullMax")(), S.prefs.pullN];
    S.prefs = P({ pullN: 7 }); out.seven = N();
    S.prefs = P({ pullN: 50 }); out.high = N();
    S.prefs = P({ pullN: 0.2 }); out.low = N();
    S.prefs = P({ pullN: "x" }); out.junk = [S.prefs.pullN, N()];
    S.prefs = P({ pullN: 6.66 }); out.round = S.prefs.pullN;
    app.settingsDialog({ x: 10, y: 10 }); const h = app.el("dlg").innerHTML;
    out.slider = /<h3>Simulation<[/]h3>/.test(h) && /type="range" id="set-pull" data-p="pullN" min="1.9" max="8"/.test(h) && h.includes("How strongly the mouse pulls cloth");
    out.page = /data-page="3d"[^]*set-pull[^]*data-page="other"/.test(h);
    out.inFile = JSON.stringify(app.ev("docObj")()).includes("pullN");
    return out;
  ` });
  assert.deepStrictEqual(o.consts, [5.6, 8, 1.9]);
  assert.deepStrictEqual(o.def, [5.6, 5.6e6, null], "the default when nothing is stored");
  assert.strictEqual(o.seven, 7);
  assert.strictEqual(o.high, 8, "never above the measured safe limit, whatever is stored");
  assert.strictEqual(o.low, 1.9);
  assert.deepStrictEqual(o.junk, [null, 5.6]);
  assert.strictEqual(o.round, 6.7);
  assert.ok(o.slider, "the slider and its words");
  assert.ok(o.page, "on the 3D page");
  assert.strictEqual(o.inFile, false, "a preference, never in a file");
});

test("pull3c / 2 the pull's force reaches a running solver with each move (a drag's max), and a drag without one keeps the solver's own", () => {
  const m = sheet(100, 100, 10), X = new Float32Array(3*m.xy.length/2);
  for (let i = 0; i < m.xy.length/2; i++) X.set([m.xy[2*i], 500, m.xy[2*i+1]], 3*i);
  const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 2.5 } }], opt: { ground: false, self: false } });
  assert.strictEqual(sim.opt.dragMax, 5e6, "the solver alone keeps its 5 N (the app always sends Pull Strength)");
  C.clothDrag(sim, { i: [0], w: [1], to: [0, 600, 0], max: 8e6 }); assert.strictEqual(sim.opt.dragMax, 8e6);
  C.clothDrag(sim, { i: [0], w: [1], to: [0, 650, 0] }); assert.strictEqual(sim.opt.dragMax, 8e6, "a move without max changes nothing");
  C.clothDrag(sim, { i: [0], w: [1], to: [0, 650, 0], max: -1 }); assert.strictEqual(sim.opt.dragMax, 8e6, "nonsense is ignored");
  C.clothDrag(sim, null);
});

test("pull3c / 3 the hand's own friction (dragSlide) holds only while the pull is held (guess pull3c/2): let go, the cloth it held has its whole friction at once, so what the hand slid stays where it was left", () => {
  // a sheet lying on the floor; its middle grabbed and pulled a little, then let go (or still held), and every point given the same
  // speed along the floor: how far it slides in 30 frames
  const slid = (dragSlide, release, far) => {
    const m = sheet(200, 200, 10), n = m.xy.length/2, X = new Float32Array(3*n);
    for (let i = 0; i < n; i++) X.set([m.xy[2*i], 2.5, m.xy[2*i+1]], 3*i);
    const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 2.5 } }], opt: { self: false, dragSlide, ...(far ? { dragMax: 2e4 } : {}) } });      // (held: 0.02 N, about the 6 g sheet's own friction, so friction decides)
    for (let f = 0; f < 30; f++) C.clothStep(sim, 1/60);
    let c = 0, cd = 1e9; for (let i = 0; i < n; i++) { const d = Math.hypot(m.xy[2*i] - 100, m.xy[2*i+1] - 100); if (d < cd) { cd = d; c = i; } }
    const at = [sim.x[3*c], sim.x[3*c+1], sim.x[3*c+2]];
    // held: the pointer 100 mm away along the floor for 30 frames; how far the held place came
    if (far) { for (let f = 0; f < 30; f++) { C.clothDrag(sim, { i: [c], w: [1], to: [at[0] + 100, at[1], at[2]] }); C.clothStep(sim, 1/60); } return sim.x[3*c] - at[0]; }
    for (let f = 0; f < 10; f++) { C.clothDrag(sim, { i: [c], w: [1], to: [at[0] + 2*f, at[1], at[2]] }); C.clothStep(sim, 1/60); }
    if (release) C.clothDrag(sim, null);
    const x0 = Float64Array.from(sim.x);
    let moved = 0;
    for (let f = 0; f < 30; f++) { for (let i = 0; i < n; i++) sim.v[3*i] = 400; C.clothStep(sim, 1/60); }
    for (let i = 0; i < n; i++) moved += sim.x[3*i] - x0[3*i];
    return moved/n;
  };
  const relLow = slid(0.05, true), relOwn = slid(1, true), heldLow = slid(0.05, false, true), heldOwn = slid(1, false, true);
  // (the two differ by what the held frames before letting go left behind: hundredths of a millimetre)
  assert.ok(Math.abs(relLow - relOwn) < 0.01, "let go, the hand's friction is gone: " + relLow + " against " + relOwn);
  assert.ok(heldLow > heldOwn + 1, "while held, the cloth in the hand slides more with less friction: " + heldLow.toFixed(1) + " against " + heldOwn.toFixed(1));
});

module.exports = T;
