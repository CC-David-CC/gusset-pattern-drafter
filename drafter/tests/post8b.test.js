// Round POST8, second session. FIX-5 / C: Mesh Type ▸ Triangle / Quad, Quadrangulate, Triangulate (a pattern's mesh3).
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

const SIM3D = require("../drafter-sim.js");

// every edge of a mesh once, with its length and its angle to the direction a (0..90 degrees)
function edges(m, a) {
  const seen = new Set(), out = [];
  for (let k = 0; k < m.tri.length; k += 3) for (const [p, q] of [[m.tri[k], m.tri[k+1]], [m.tri[k+1], m.tri[k+2]], [m.tri[k+2], m.tri[k]]]) {
    const key = p < q ? p + "," + q : q + "," + p;
    if (seen.has(key)) continue;
    seen.add(key);
    const dx = m.xy[2*q] - m.xy[2*p], dy = m.xy[2*q+1] - m.xy[2*p+1];
    let ang = Math.abs(((Math.atan2(dy, dx) - a)*180/Math.PI) % 180); if (ang > 90) ang = 180 - ang;
    out.push({ p, q, len: Math.hypot(dx, dy), ang, diag: SIM3D.quadDiag(m, p, q) });
  }
  return out;
}
function outline(w, h, step) {
  const L = [];
  for (let x = 0; x < w; x += step) L.push([x, 0]);
  for (let y = 0; y < h; y += step) L.push([w, y]);
  for (let x = w; x > 0; x -= step) L.push([x, h]);
  for (let y = h; y > 0; y -= step) L.push([0, y]);
  return L;
}

test("POST8 FIX-5 / C1: Mesh Type Quad meshes the inside as a square grid along the grain (upright and turned 30°), each square two triangles whose diagonal quadDiag() tells apart; the whole area covered; without the option the mesh is what it was", () => {
  const L = outline(300, 400, 20);
  for (const a of [Math.PI/2, Math.PI/2 + Math.PI/6]) {
    const m = SIM3D.meshPolygon(L, 20, [], [], { quad: a });
    assert.ok(m && m.gij, "a quad mesh says where its grid points are");
    assert.ok(Math.abs(SIM3D.triArea2D(m.xy, m.tri) - 120000) < 1, "the outline wholly covered");
    // between two grid points: a side (20 mm, along or across the grain) or a diagonal (28.3 mm, at 45°)
    const grid = edges(m, a).filter(e => m.gij[2*e.p] !== SIM3D.QUAD_OFF && m.gij[2*e.q] !== SIM3D.QUAD_OFF);
    assert.ok(grid.length > 400, "most of the cloth is the grid: " + grid.length);
    for (const e of grid) {
      if (e.diag) assert.ok(Math.abs(e.len - 20*Math.SQRT2) < 0.2 && Math.abs(e.ang - 45) < 0.5, "a diagonal: " + JSON.stringify(e));
      else assert.ok(Math.abs(e.len - 20) < 0.2 && (e.ang < 0.5 || e.ang > 89.5), "a side along or across the grain: " + JSON.stringify(e));
    }
    // each square holds exactly one diagonal: the diagonals are half the grid's triangles
    const nd = grid.filter(e => e.diag).length, sq = grid.filter(e => !e.diag).length;
    assert.ok(nd > 0.4*sq && nd < 0.6*sq, "one diagonal a square: " + nd + " diagonals, " + sq + " sides");
    const q = SIM3D.triQuality(m.xy, m.tri);
    assert.ok(q.min > 0.15, "no sliver: " + q.min);
  }
  const a = SIM3D.meshPolygon(L, 20, [], []), b = SIM3D.meshPolygon(L, 20, [], [], undefined);
  assert.ok(!a.gij, "a triangle mesh has no grid");
  assert.deepStrictEqual(Array.from(a.tri), Array.from(b.tri));
  assert.deepStrictEqual(Array.from(a.xy), Array.from(b.xy));
});

const SCENE = `
  const out = {}, G3 = app.G3;
  app.ev("setLayout")("both");
  const A = app.mkPiece("A", app.mkShape([{x:0,y:-1400},{x:300,y:-1400},{x:300,y:-1000},{x:0,y:-1100}], true));
  const B = app.mkPiece("B", app.mkShape([{x:700,y:-1400},{x:400,y:-1400},{x:400,y:-1000},{x:700,y:-1100}], true));
  B.segs.forEach((s, k) => { s.id = A.segs[k].id; });
  B.link = { of: A.id, kind: "symmetric", m: [-1, 0, 0, 1, 700, 0] };
  const C = app.mkPiece("C", app.mkShape([{x:1000,y:-1400},{x:1200,y:-1400},{x:1200,y:-1200},{x:1000,y:-1200}], true));
  S.pieces.push(A, B, C);
  S.cloth = app.normCloth({ ...S.cloth, res: 20, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
  const rows = () => { const L = []; const walk = (R) => { for (const r of R || []) { if (r && r.n) L.push(r); if (r && typeof r.menu === "function") walk(r.menu()); } }; walk(app.ev("contextMenuRows")()); return L; };
  const quadOf = (p) => !!(G3.items.get(p.id) && G3.items.get(p.id).mesh.gij);
`;

test("POST8 FIX-5 / C2: Quadrangulate / Triangulate (Context Menu ▸ 3D Garment) and Mesh Type ▸: one step, the symmetric copy follows, the cloth meshed again, Show Wireframe and the 2D Show Mesh leave the diagonals out; undo; kept in the file only when Quad", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    out.nb = rows().filter(r => ["Quadrangulate", "Triangulate", "Mesh Type", "Triangle", "Quad"].includes(r.n)).map(r => r.n + ":" + !!r.nb + ":" + !!r.off);
    const e0 = app.ev("meshEdges2")(A).length;
    S.sel = [A.id]; rows().find(r => r.n === "Quadrangulate").f();
    out.after = [A.mesh3, B.mesh3, C.mesh3, quadOf(A), quadOf(B), quadOf(C), S.un[S.un.length - 1].n, S.undo.length];
    out.ticked = rows().filter(r => r.h === "Mesh Type").map(r => r.n + ":" + !!r.on);
    out.edges2 = [e0, app.ev("meshEdges2")(A).length];
    app.ev("setWire3")(true);
    const it = G3.items.get(A.id), tri = it.mesh.tri.length, wire = it.wire.geometry.index.count/2;
    out.wire = [wire < tri, wire === app.ev("meshEdgesOf")(it.mesh).length/2];
    // a few frames simulate it (no point lost)
    app.ev("simStart")(); for (let i = 0; i < 20; i++) app.ev("simFrame")(); app.ev("simStop")();
    out.finite = Array.from(G3.items.get(A.id).X).every(Number.isFinite);
    // the file: Quad kept, Triangle not stored
    const doc = JSON.parse(app.ev("docJSON")()); out.saved = doc.pieces.map(p => p.mesh3 || null);
    // again: nothing to do, no step
    const k = S.undo.length; app.ev("setMeshType")([A.id], "quad"); out.again = S.undo.length - k;
    app.undo(); app.undo(); out.undone = [S.pieces[0].mesh3 || null, S.pieces[1].mesh3 || null, quadOf(S.pieces[0])];
    app.redo(); out.redone = [S.pieces[0].mesh3, quadOf(S.pieces[0])];
    S.sel = [S.pieces[1].id]; rows().find(r => r.n === "Triangulate").f();
    out.tri = [S.pieces[0].mesh3 || null, S.pieces[1].mesh3 || null, quadOf(S.pieces[0])];
    // the Mesh Type submenu's Quad on C alone
    S.sel = [S.pieces[2].id]; rows().find(r => r.h === "Mesh Type" && r.n === "Quad").f(); out.c = [S.pieces[2].mesh3, S.un[S.un.length - 1].n];
    // a file's Quad comes back; anything else is the default
    app.ev("loadDoc")(doc); app.ev("showDoc")(); out.loaded = S.pieces.map(p => p.mesh3 || null);
    out.norm = ["quad", "tri", "x", 1].map(v => { const q = { mesh3: v, shrink: {} }; app.ev("normProps")(q); return q.mesh3 || null; });
    return out;` });
  assert.deepStrictEqual(o.nb, ["Quadrangulate:false:false", "Triangulate:false:false", "Mesh Type:false:false", "Triangle:false:false", "Quad:false:false"], "every row built (no greyed placeholder)");
  assert.deepStrictEqual(o.after, ["quad", "quad", null, true, true, false, "Mesh Type", 1], "A and its symmetric copy B, C left; one step");
  assert.deepStrictEqual(o.ticked, ["Triangle:false", "Quad:true"]);
  assert.ok(o.edges2[1] < o.edges2[0], "the 2D Show Mesh draws fewer edges (no diagonals): " + o.edges2);
  assert.deepStrictEqual(o.wire, [true, true], "Show Wireframe draws the quad edges");
  assert.strictEqual(o.finite, true);
  assert.deepStrictEqual(o.saved, ["quad", "quad", null]);
  assert.strictEqual(o.again, 0);
  assert.deepStrictEqual(o.undone, [null, null, false]);
  assert.deepStrictEqual(o.redone, ["quad", true]);
  assert.deepStrictEqual(o.tri, [null, null, false], "Triangulate on the copy takes the source back too");
  assert.deepStrictEqual(o.c, ["quad", "Mesh Type"]);
  assert.deepStrictEqual(o.loaded, ["quad", "quad", null]);
  assert.deepStrictEqual(o.norm, ["quad", null, null, null]);
});

test("POST8 FIX-5 / C3: the cloth's key names the Quad mesh only when Quad (a triangle pattern's key, which saved drapes are matched by, is what it was)", () => {
  const o = boot({ blank: true, script: SCENE.replace("app.ev(\"garmentSync\")();", "") + `
    const k0 = app.ev("pieceSig")(A, 20); A.mesh3 = "quad"; const k1 = app.ev("pieceSig")(A, 20); delete A.mesh3;
    return [k0 === app.ev("pieceSig")(A, 20), k0 === k1, k1.includes("quad")];` });
  assert.deepStrictEqual(o, [true, false, true]);
});

// (Round POST8, second session, roadmap 1.T41) Auto Sewing, third attempt: every shipped example with its seams taken off (but a dart's
// legs, which Add Dart sews) sewn again by the 3D toolbar's Auto Sewing on all its patterns; each seam made checked against the example's
// own: every two lines it joins joined there too, the same way round. Measured by scripts/auto-sew.js: both skirts 7 of 7, the T-shirt
// 4 of 6 (the two sleeve caps left: nothing in the patterns tells which way round they go), nothing wrong or reversed.
const EXAMPLES = `
  const out = [], EX = app.ev("PATTERN_EXAMPLES");
  app.ev("setLayout")("both");
  for (const ex of EX) {
    app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
    const legs = app.ev("dartLegs")(S.seams, S.pieces), isLeg = (sm) => sm.a.length === 1 && sm.b.length === 1 && legs.has(sm.a[0].piece + ":" + sm.a[0].sids[0]) && legs.has(sm.b[0].piece + ":" + sm.b[0].sids[0]);
    const side = (L) => L.map(q => [q.piece, q.sids, !!q.rev, q.shape || 0]);
    const truth = S.seams.filter(sm => !isLeg(sm)).map(sm => ({ a: side(sm.a), b: side(sm.b) }));
    S.seams = S.seams.filter(isLeg); app.commit(); S.undo.length = 0; S.un.length = 0; S.sel = [];
    const n0 = S.seams.length, n = app.ev("autoSewRun")();
    const made = S.seams.slice(n0).map(sm => ({ id: sm.id, a: side(sm.a), b: side(sm.b) }));
    const sel = [S.selSeam, ...(S.selSeams || [])].filter(x => x != null).sort((x, y) => x - y);
    const r = { name: ex.name, n, truth, made, sel, steps: S.un.map(u => u.n), tool: S.tool, count: S.seams.length };
    app.undo(); r.undone = S.seams.length === n0;
    out.push(r);
  }
  return out;`;
function judge(r) {
  const key = (p, s, q, t) => (p + ":" + s < q + ":" + t ? p + ":" + s + "|" + q + ":" + t : q + ":" + t + "|" + p + ":" + s);
  const pairs = (A, B) => { const out = []; for (const [p, S, ra] of A) for (const [q, R, rb] of B) for (const s of S) for (const t of R) out.push([key(p, s, q, t), ra === rb]); return out; };
  const T = new Map();
  for (const sm of r.truth) for (const [k, par] of pairs(sm.a, sm.b)) T.set(k, par);
  const res = { right: 0, wrong: 0, reversed: 0, found: 0 };
  const madeK = r.made.map(sm => pairs(sm.a, sm.b));
  for (const ks of madeK) { if (!ks.every(([k]) => T.has(k))) res.wrong++; else if (!ks.every(([k, par]) => T.get(k) === par)) res.reversed++; else res.right++; }
  for (const sm of r.truth) {
    if (sm.a.concat(sm.b).every(x => x[0] === sm.a[0][0])) continue;
    const ks = new Set(pairs(sm.a, sm.b).map(([k]) => k)), lines = sm.a.concat(sm.b).flatMap(([p, S]) => S.map(s => p + ":" + s));
    const mine = madeK.map(K => K.map(([k]) => k)).filter(K => K.every(k => ks.has(k)));
    if (lines.every(l => mine.some(K => K.some(k => k.split("|").includes(l))))) res.found++;
  }
  return res;
}

test("POST8 Auto Sewing D1: the shipped examples with their seams taken off, sewn again by Auto Sewing (all patterns): both skirts 7 of 7 seams between patterns, the T-shirt 4 of 6, none wrong, none reversed; one step, the new seams selected with Edit Sewing in hand; undo takes them all", () => {
  const o = boot({ blank: true, three: true, script: EXAMPLES });
  const want = { "Straight skirt on Marty": 7, "T-shirt on Marty": 4, "Straight skirt on Jessica": 7 };
  for (const r of o) {
    const j = judge(r);
    assert.deepStrictEqual([j.wrong, j.reversed], [0, 0], r.name + ": nothing wrong or reversed " + JSON.stringify(j));
    assert.strictEqual(j.found, want[r.name], r.name + " found " + JSON.stringify(j));
    assert.strictEqual(r.made.length, r.n, r.name + ": the seams it says it made are the ones there (no mirror added)");
    assert.deepStrictEqual(r.steps, ["Auto Sewing"], r.name);
    assert.strictEqual(r.tool, "edit_sewing");
    assert.deepStrictEqual(r.sel, r.made.map(m => m.id).sort((x, y) => x - y), r.name + ": every new seam selected");
    assert.strictEqual(r.undone, true);
  }
});

test("POST8 Auto Sewing D2: what it refuses: two hems facing down, two sleeves of one shape along their underarms, a pattern's own two lines; with nothing sure, no step and a toast; the toolbar's Auto Sewing is built and on the 3D toolbar", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {};
    const mk = (n, pts) => { const p = app.mkPiece(n, app.mkShape(pts, true)); S.pieces.push(p); return p; };
    // two equal rectangles side by side, flat (nothing arranged): their sides, tops and hems all match by length
    const A = mk("A", [{x:0,y:-800},{x:300,y:-800},{x:300,y:-400},{x:0,y:-400}]), B = mk("B", [{x:400,y:-800},{x:700,y:-800},{x:700,y:-400},{x:400,y:-400}]);
    app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
    const plan = app.ev("autoSewPlan")(app.ev("autoSewGarment")([A, B]));
    out.flat = plan.seams.length;
    S.sel = [A.id, B.id]; const k = S.undo.length; out.n = app.ev("autoSewRun")(); out.steps = S.undo.length - k;
    out.toast = toasts.slice(-1)[0];
    // one pattern alone: refused before anything
    S.sel = [A.id]; out.one = app.ev("autoSewRun")();
    // two identical trapezoid sleeves (their underarms mirror twins): never sewn to each other along those, even placed side by side
    const L = mk("L", [{x:0,y:-300},{x:440,y:-300},{x:380,y:-80},{x:60,y:-80}]), Rr = mk("R", [{x:500,y:-300},{x:940,y:-300},{x:880,y:-80},{x:560,y:-80}]);
    const G = app.ev("autoSewGarment")([L, Rr]); G.patterns.forEach(p => { p.arranged = true; });
    out.sleeves = app.ev("autoSewPlan")(G).seams.length;
    out.bar = app.ev("shownTools")(app.GROUPS.find(g => g.some(t => t.id === "auto_sewing"))).some(t => t.id === "auto_sewing");
    return out;` });
  assert.strictEqual(o.flat, 0, "flat and alike: every side ties with another, so nothing is sure");
  assert.deepStrictEqual([o.n, o.steps], [0, 0]);
  // (POST8 batch 0c, changed on purpose: the maintainer's brief) the message now says what it sewed and what it left, and on two
  // look-alikes laid flat (each side ties with its mirror) asks for the patterns to be arranged first; was "found no seam it is sure of"
  assert.ok(/^Sewed 0 seams[.] [0-9]+ lines? left unsewn[.] Arrange the patterns around the avatar first/.test(o.toast), o.toast);
  assert.strictEqual(o.one, 0);
  assert.strictEqual(o.sleeves, 0);
  assert.strictEqual(o.bar, true);
});

module.exports = T;
