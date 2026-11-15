// Round PULL-3b: PULL-3 was too glued (the maintainer's hand test: "I can't move the skirt at all"). His rule, whatever the fabric:
// garments behave like real clothes. You can always move, slide and turn a garment on the body and stretch the fabric a lot; a tight
// garment moves only a little, a loose one easily, a stretchy fabric stretches far. Cloth never passes through the body, and a garment
// can never be pulled off. Here in the solver alone (fast), on a tube round a cylinder (a sleeve on an arm, a waistband on a waist); the
// gate is the real page with the real mouse, scripts/pull-real.js and the browser smoke's group pull3.
"use strict";
const assert = require("assert");
const C = require("../drafter-sim.js");
const T = [];
const test = (name, fn) => T.push({ name, fn });

function sheet(w, h, res) {
  const pts = [], nx = Math.round(w/res), ny = Math.round(h/res), dx = w/nx, dy = h/ny;
  for (let i = 0; i < nx; i++) pts.push([i*dx, 0]); for (let j = 0; j < ny; j++) pts.push([w, j*dy]);
  for (let i = 0; i < nx; i++) pts.push([w - i*dx, h]); for (let j = 0; j < ny; j++) pts.push([0, h - j*dy]);
  return C.meshPolygon(pts, res);
}
const lay = (m, f) => { const n = m.xy.length/2, X = new Float32Array(3*n); for (let i = 0; i < n; i++) X.set(f(m.xy[2*i], m.xy[2*i+1]), 3*i); return X; };
const edge = (m, f) => Array.from({ length: m.xy.length/2 }, (_, i) => i).filter(i => f(m.xy[2*i], m.xy[2*i+1])).sort((p, q) => m.xy[2*p+1] - m.xy[2*q+1]);
const side = (m, p, vs) => C.seamPath(vs.map(v => ({ a: { p, i: [v], w: [1] }, pos: [m.xy[2*v], m.xy[2*v+1]] })));
function cylinder(r, y0, y1, n) {
  const t = [], P = (a, y) => [r*Math.cos(a), y, r*Math.sin(a)];
  for (let k = 0; k < n; k++) {
    const a = 2*Math.PI*k/n, b = 2*Math.PI*(k + 1)/n, A0 = P(a, y0), B0 = P(b, y0), A1 = P(a, y1), B1 = P(b, y1);
    t.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0, 0, y1, 0, ...B1, ...A1, 0, y0, 0, ...A0, ...B0);
  }
  return new Float32Array(t);
}
const R = 120, field = C.buildSDF(cylinder(R, 600, 1400, 128), { cell: 8 });      // (about a waist's round, 754 mm)
const FABS = {
  woven:  { weight: 160, stretch: 4e6, bend: 1000, friction: 0.35, thick: 2.5, maxStretch: 0.08 },        // the presets' Medium woven
  heavy:  { weight: 340, stretch: 1e7, bend: 5e4, friction: 0.45, thick: 2.5, maxStretch: 0.05 },         // Heavy woven
  jersey: { weight: 160, stretch: 3e5, bend: 4, friction: 0.40, thick: 2.5, maxStretch: 0.30 },           // Single jersey
};
// a tube of two panels sewn into one round the cylinder, `fit` times the cylinder's round (under 1: tight); the front panel's middle
// grabbed and moved by `mv` over 20 frames, held 60, let go, 150 frames to settle. mv: a move [x, y, z] (mm), or a function of the
// share s (0 to 1) and the place grabbed giving where the pointer is
function pullTube(fab, fit, mv, opt) {
  const W = fit*Math.PI*R, H = 160, res = 10, rr = R + fab.thick, A = sheet(W, H, res), B = sheet(W, H, res);
  const at = (th0) => (x, y) => { const th = th0 + Math.PI*x/W; return [rr*Math.cos(th), 1100 - y, rr*Math.sin(th)]; };
  const lA = edge(A, (x) => x < 1e-6), rA = edge(A, (x) => x > W - 1e-6), lB = edge(B, (x) => x < 1e-6), rB = edge(B, (x) => x > W - 1e-6);
  const seams = [{ id: 1, pairs: C.seamPairs(side(A, 0, rA), side(B, 1, lB), res, true) }, { id: 2, pairs: C.seamPairs(side(A, 0, lA), side(B, 1, rB), res, true) }];
  const sim = C.clothBuild({ pieces: [{ xy: A.xy, tri: A.tri, X: lay(A, at(-Math.PI)), fab }, { xy: B.xy, tri: B.tri, X: lay(B, at(0)), fab }], seams, field, opt: { self: false, ground: false, ...opt } });
  const run = (k) => { for (let j = 0; j < k; j++) C.clothStep(sim, 1/60); };
  run(150);
  // panel A lies from -180° to 0° (z < 0): its middle faces -z; the far panel B is watched
  const nA = A.xy.length/2, x = sim.x;
  let c = 0; for (let i = 0; i < nA; i++) if (Math.hypot(A.xy[2*i] - W/2, A.xy[2*i+1] - H/2) < Math.hypot(A.xy[2*c] - W/2, A.xy[2*c+1] - H/2)) c = i;
  const ang = (i) => Math.atan2(x[3*i+2], x[3*i]), turnB = (X0) => { let s = 0; for (let i = nA; i < sim.n; i++) { let d = ang(i) - Math.atan2(X0[3*i+2], X0[3*i]); while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; s += d; } return s/(sim.n - nA)*R; };
  const X0 = Float64Array.from(x), p0 = [x[3*c], x[3*c+1], x[3*c+2]];
  let inside = 0, place = 0;
  const look = () => { for (let i = 0; i < sim.n; i++) if (C.sdfAt(field, x[3*i], x[3*i+1], x[3*i+2]) < -1) inside++; };
  // the edges round the hand (within 40 mm of the place): how far they stretch while held
  const near = []; for (let e = 0; e < sim.eI.length; e++) { const i = sim.eI[e]; if (Math.hypot(x[3*i] - p0[0], x[3*i+1] - p0[1], x[3*i+2] - p0[2]) < 40) near.push(e); }
  const localStrain = () => { let s = 0; for (const e of near) { const a = 3*sim.eI[e], b = 3*sim.eJ[e]; s = Math.max(s, Math.hypot(x[a] - x[b], x[a+1] - x[b+1], x[a+2] - x[b+2])/sim.eL[e] - 1); } return s; };
  let heldStrain = 0;
  for (let k = 1; k <= 80; k++) { const s = Math.min(1, k/20); C.clothDrag(sim, { i: [c], w: [1], to: typeof mv === "function" ? mv(s, p0) : [p0[0] + s*mv[0], p0[1] + s*mv[1], p0[2] + s*mv[2]] }); run(1); look(); heldStrain = Math.max(heldStrain, localStrain()); }
  place = Math.hypot(x[3*c] - p0[0], x[3*c+1] - p0[1], x[3*c+2] - p0[2]);
  const heldTurn = turnB(X0);
  C.clothDrag(sim, null);
  for (let k = 0; k < 150; k++) { run(1); look(); }
  let gap = 0; for (const g of C.clothSeamGaps(sim)) if (g) gap = Math.max(gap, g.max);
  const r1 = (v) => +v.toFixed(1);
  return { place: r1(place), placeAfter: r1(Math.hypot(x[3*c] - p0[0], x[3*c+1] - p0[1], x[3*c+2] - p0[2])), heldTurn: r1(heldTurn), turn: r1(turnB(X0)), strain: +heldStrain.toFixed(3), gap: +gap.toFixed(2), inside };
}

test("pull3b / 1 the pull's defaults (guesses pull3b/1-3): its force capped at 5 N (dragMax), no pin, no leash, no grip, the cloth held keeping its own friction; the edges still meet the body (dragEdges)", () => {
  const o = C.clothBuild({ pieces: [], seams: [] }).opt;
  assert.deepStrictEqual([o.dragMax, o.dragPin, o.dragLeash, o.dragGrip, o.dragSlide, o.dragSlideReach, o.dragEdges], [5e6, false, 0, 1, 1, 0, true]);
});

// round the cylinder, as a hand slides cloth round a body: the place turned by the share s of `a` (radians) about the axis, 10 mm out
const round = (a) => (s, p) => { const r = Math.hypot(p[0], p[2]) + 10*s, t = Math.atan2(p[2], p[0]) + s*a; return [r*Math.cos(t), p[1], r*Math.sin(t)]; };
// (Fit: on this straight cylinder a tube 10 % tight turns about as far as one that just touches, 142 / 148 mm, at the presets' friction:
// the 5 N pull outweighs the grip either way, and only the body's friction tells them apart, below. On the real skirts fit does show, the
// waistband not turning at all when the skirt is made 10 % smaller (Jessica's already at 6 %; Marty's still turned at 6 %, the band then
// inside its fabric's elastic range): the PULL-3b report, and scripts/pull-real.js's fit cases)
test("pull3b / 2 a garment turns on the body, and stays turned: a tube round a waist-sized cylinder pulled 200 mm round it at its front turns with it and stays turned once let go; a fabric that grips the body more (friction 1) is held clearly more; nothing inside, no seam open", () => {
  // (the tube just touches the cylinder all round, 0.99 of its round: one looser has nothing to hold it up on a straight cylinder, which
  // has no hips, and slides down off its end)
  const turned = pullTube(FABS.woven, 0.99, round(200/R)), grippy = pullTube({ ...FABS.woven, friction: 1 }, 0.99, round(200/R)), both = JSON.stringify({ turned, grippy });
  if (process.env.PDRAFT_PULL_REPORT) console.log("  pull3b/2 " + both);
  assert.ok(Math.abs(turned.turn) > 40, "the tube turned, and stayed turned once let go: " + both);
  assert.ok(Math.abs(grippy.turn) < 0.5*Math.abs(turned.turn), "held by more friction, it turns clearly less: " + both);
  for (const r of [turned, grippy]) { assert.strictEqual(r.inside, 0, "nothing inside the cylinder: " + both); assert.ok(r.gap < 1, "no seam open: " + both); }
});

test("pull3b / 3 a stretchy fabric stretches further than a stiff one under the same pull: the tube's front pulled 150 mm straight out from the cylinder; let go, the stretched place springs back", () => {
  const jersey = pullTube(FABS.jersey, 0.98, [0, 0, -150]), heavy = pullTube(FABS.heavy, 0.98, [0, 0, -150]), both = JSON.stringify({ jersey, heavy });
  if (process.env.PDRAFT_PULL_REPORT) console.log("  pull3b/3 " + both);
  assert.ok(jersey.place > 1.5*heavy.place, "the jersey's place comes clearly further out: " + both);
  assert.ok(jersey.placeAfter < 0.3*jersey.place && heavy.placeAfter < 0.3*Math.max(heavy.place, 10), "let go, each springs back: " + both);
  for (const r of [jersey, heavy]) { assert.strictEqual(r.inside, 0, "nothing inside the cylinder: " + both); assert.ok(r.gap < 1, "no seam open: " + both); }
});

module.exports = T;
