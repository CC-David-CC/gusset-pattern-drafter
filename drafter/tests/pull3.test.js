// Round PULL-3: the pull with the leash and with the cloth's edges meeting the body, in the solver alone (fast). The gate is the real
// page: scripts/pull-real.js and the browser smoke's group pull3 (the maintainer's recording and 29 more pulls with the real mouse).
"use strict";
const assert = require("assert");
const C = require("../drafter-sim.js");
const T = [];
const test = (name, fn) => T.push({ name, fn });

function strip(W, H, res) {
  const pts = [], nx = Math.round(W/res), ny = Math.max(1, Math.round(H/res)), dx = W/nx, dy = H/ny;
  for (let i = 0; i < nx; i++) pts.push([i*dx, 0]); for (let j = 0; j < ny; j++) pts.push([W, j*dy]);
  for (let i = 0; i < nx; i++) pts.push([W - i*dx, H]); for (let j = 0; j < ny; j++) pts.push([0, H - j*dy]);
  return C.meshPolygon(pts, res);
}
function cylinder(r, y0, y1, n) {
  const t = [], P = (a, y) => [r*Math.cos(a), y, r*Math.sin(a)];
  for (let k = 0; k < n; k++) {
    const a = 2*Math.PI*k/n, b = 2*Math.PI*(k + 1)/n, A0 = P(a, y0), B0 = P(b, y0), A1 = P(a, y1), B1 = P(b, y1);
    t.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0, 0, y1, 0, ...B1, ...A1, 0, y0, 0, ...A0, ...B0);
  }
  return new Float32Array(t);
}
const FAB = { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 2.5, maxStretch: 0.08 };

// (Round PULL-3b, changed on purpose: the maintainer's "too glued". The leash is off by default now: the pull's force is capped instead
// (dragMax), so the pointer's move is taken as it is however far it goes; dragLeash set still leashes it, as PULL-3 did)
test("pull3 / 1 the leash is off by default (PULL-3b): the pointer 300 mm from the place grabbed is taken as it is; dragLeash 180 takes it 180 mm along its way, and within it as it is", () => {
  const m = strip(100, 100, 10), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i], 1000, m.xy[2*i+1]], 3*i);
  const go = (opt, d) => { const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: FAB }], seams: [], opt: { ground: false, ...opt } }); const at = [sim.x[0], sim.x[1], sim.x[2]];
    C.clothDrag(sim, { i: [0], w: [1], to: [at[0] + d, at[1], at[2]] }); return sim.drag.to[0] - at[0]; };
  assert.ok(Math.abs(go({}, 300) - 300) < 1e-9, "no leash by default");
  assert.ok(Math.abs(go({ dragLeash: 180 }, 300) - 180) < 1e-9, "dragLeash 180: taken at 180 mm");
  assert.ok(Math.abs(go({ dragLeash: 180 }, -100) + 100) < 1e-9, "within the leash, as it is");
});

test("pull3 / 2 a cloth edge drawn straight through a thin body (its two ends outside, 5 mm off the skin) while a pull is held: with dragEdges no place along any edge stays inside; without, it does (the bug PULL-1's points-only check could not see)", () => {
  // a strip 200 mm long, its points 40 mm apart along it, lying straight through a cylinder of radius 15 mm: the points at x = ±20 lie
  // outside, the edge between them through the middle; the strip's far end held by the pointer where it is
  const field = C.buildSDF(cylinder(15, 600, 1400, 48), { cell: 4 });
  const m = strip(200, 40, 40), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i] - 100, 1000 + m.xy[2*i+1] - 20, 0], 3*i);
  const deep = (sim) => { let d = 0; for (let c = 0; c < sim.eI.length; c++) { const a = 3*sim.eI[c], b = 3*sim.eJ[c];
    for (let s = 1; s < 20; s++) { const u = s/20, v = C.sdfAt(field, sim.x[a] + u*(sim.x[b] - sim.x[a]), sim.x[a+1] + u*(sim.x[b+1] - sim.x[a+1]), sim.x[a+2] + u*(sim.x[b+2] - sim.x[a+2])); if (-v > d) d = -v; } } return d; };
  const go = (on) => {
    const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: FAB }], seams: [], field, opt: { ground: false, self: false, gravity: 0, dragEdges: on } });
    const before = deep(sim);
    let far = 0; for (let i = 0; i < n; i++) if (sim.x[3*i] > sim.x[3*far]) far = i;
    C.clothDrag(sim, { i: [far], w: [1], to: [sim.x[3*far], sim.x[3*far+1], sim.x[3*far+2]] });
    for (let k = 0; k < 10; k++) C.clothStep(sim, 1/60);
    return { before, held: deep(sim) };
  };
  const on = go(true), off = go(false), both = JSON.stringify({ on, off });
  assert.ok(on.before > 10, "the strip starts through the body: " + both);
  assert.ok(off.held > 5, "without the edges meeting the body, it stays through it: " + both);
  assert.ok(on.held < 1, "with them, no edge inside the body: " + both);
});

test("pull3 / 3 not pulling, nothing of PULL-3 runs: a step with no pull is the same bit for bit with dragEdges and dragGrip on or off", () => {
  const field = C.buildSDF(cylinder(60, 600, 1400, 48), { cell: 8 });
  const m = strip(200, 200, 10), n = m.xy.length/2, X = new Float32Array(3*n);
  for (let i = 0; i < n; i++) X.set([m.xy[2*i] - 100, 1100 - m.xy[2*i+1], 70], 3*i);
  const go = (opt) => { const sim = C.clothBuild({ pieces: [{ xy: m.xy, tri: m.tri, X, fab: FAB }], seams: [], field, opt: { ground: false, ...opt } }); for (let k = 0; k < 30; k++) C.clothStep(sim, 1/60); return Array.from(sim.x); };
  assert.deepStrictEqual(go({}), go({ dragEdges: false, dragGrip: 1, dragLeash: 0 }));
});

module.exports = T;
