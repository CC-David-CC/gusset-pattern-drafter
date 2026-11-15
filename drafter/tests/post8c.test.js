// Round POST8, third session. Batch 0c: Auto Sewing says what it sewed and what it left, and marks the lines it left.
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

// the T-shirt example with every seam but a dart's legs taken off (it has no darts: all of them)
const TSHIRT = `
  const out = {}, EX = app.ev("PATTERN_EXAMPLES"), ex = EX.find(e => /T-shirt/.test(e.name));
  app.ev("setLayout")("both");
  app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
  S.seams = []; app.commit(); S.undo.length = 0; S.un.length = 0; S.sel = [];
  S.show.sewing = false;                                 // as every start has it: the seams must show because of the tool in hand
  const LEFT = app.ev("AUTOSEW_COL");
  const marks3 = () => app.ev("ov3Items")().filter(x => x.col === LEFT && x.dash);
`;

test("POST8 batch 0c / E1: Auto Sewing on the T-shirt (arranged): \"Sewed 4 seams. 6 lines left unsewn.\"; the left lines (both sleeve caps and their armholes) marked dashed in 2D and 3D until the next action; the new seams shown in both windows with Show Sewing off; a running simulation stopped first; one undo step", () => {
  const o = boot({ blank: true, three: true, script: TSHIRT + `
    app.ev("simStart")(); out.simBefore = !!app.ev("SIM").on;
    const k0 = S.un.length;                               // (simStart's own step "Simulate" before it)
    const n = app.ev("autoSewRun")();
    out.n = n; out.toast = toasts.slice(-1)[0]; out.simAfter = !!app.ev("SIM").on;
    out.steps = S.un.slice(k0).map(u => u.n); out.tool = S.tool;
    const L = app.ev("autoLeftNow")();
    out.left = L.map(x => S.pieces.find(p => p.id === x.piece).name + ":" + x.why).sort();
    out.marks3 = marks3().length;
    app.ev("drawAutoLeft")();                             // draws without error
    // the new seams: drawn in 2D (Edit Sewing in hand passes drawSeams()'s gate) and on the cloth in 3D
    const ids = S.seams.map(sm => sm.id);
    out.shown3 = S.seams.every(sm => app.ev("ov3Seams")().some(it => sm.a.concat(sm.b).some(q => q.piece === it.pid)));
    out.gate2 = S.show.sewing === false && S.tool === "edit_sewing";
    out.sel = [S.selSeam, ...(S.selSeams || [])].filter(x => x != null).length === ids.length;
    // the next action: another tool takes the marks away
    app.ev("setTool")("edit_pattern"); out.afterTool = (app.ev("autoLeftNow")() || []).length; out.marks3After = marks3().length;
    // again, then an undo takes them away with the seams (one step)
    app.ev("autoSewRun")(); out.again = (app.ev("autoLeftNow")() || []).length;
    app.undo(); out.afterUndo = [(app.ev("autoLeftNow")() || []).length, S.seams.length];
    return out;` });
  assert.strictEqual(o.simBefore, true, "the simulation was running");
  assert.strictEqual(o.simAfter, false, "Auto Sewing stops it, so nothing pulls an unchecked seam");
  assert.strictEqual(o.n, 4);
  assert.ok(/^Sewed 4 seams[.] 6 lines left unsewn[.] The new seams are selected/.test(o.toast), o.toast);
  assert.ok(!/Arrange the patterns/.test(o.toast), "arranged: no hint");
  assert.deepStrictEqual(o.steps, ["Auto Sewing"], "one step");
  assert.strictEqual(o.tool, "edit_sewing");
  assert.strictEqual(o.left.length, 6, JSON.stringify(o.left));
  assert.ok(o.left.every(s => /:ends$/.test(s)), "left because which way round is not known: " + JSON.stringify(o.left));
  assert.strictEqual(o.left.filter(s => /sleeve:/.test(s)).length, 2, "both caps: " + JSON.stringify(o.left));
  assert.strictEqual(o.marks3, 6, "each left line marked on the cloth, dashed");
  assert.strictEqual(o.shown3, true, "every new seam on the cloth");
  assert.strictEqual(o.gate2, true);
  assert.strictEqual(o.sel, true, "every new seam selected");
  assert.deepStrictEqual([o.afterTool, o.marks3After], [0, 0], "gone at the next action");
  assert.ok(o.again > 0);
  assert.deepStrictEqual(o.afterUndo, [0, 0], "undo takes the seams (one step) and the marks");
});

test("POST8 batch 0c / E2: the same T-shirt laid flat (no 3D arrangement): most lines tie with their mirror, so the message adds \"Arrange the patterns around the avatar first for better results.\" and the lines are marked; with nothing made, no step", () => {
  const o = boot({ blank: true, three: true, script: TSHIRT + `
    for (const p of S.pieces) delete p.p3;
    app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
    out.arranged = app.ev("autoSewGarment")(S.pieces).patterns.some(p => p.arranged);
    const k = S.undo.length; out.n = app.ev("autoSewRun")(); out.steps = S.undo.length - k;
    out.toast = toasts.slice(-1)[0];
    const L = app.ev("autoLeftNow")() || [];
    out.left = L.length; out.flat = L.filter(x => x.why === "tie-flat").length;
    out.marks3 = marks3().length;
    out.text = [app.ev("autoSewText")(1, [{ why: "tie" }]), app.ev("autoSewText")(2, [])];
    return out;` });
  assert.strictEqual(o.arranged, false);
  assert.ok(o.left > 0 && o.flat*2 > o.left, "most left tied with their mirror: " + o.flat + " of " + o.left);
  assert.ok(new RegExp("^Sewed " + o.n + " seams?[.] " + o.left + " lines? left unsewn[.] Arrange the patterns around the avatar first for better results[.]").test(o.toast), o.toast);
  if (!o.n) assert.strictEqual(o.steps, 0, "nothing made: no step");
  assert.strictEqual(o.marks3, o.left, "marked in 3D too");
  assert.deepStrictEqual(o.text, ["Sewed 1 seam. 1 line left unsewn.", "Sewed 2 seams. 0 lines left unsewn."]);
});

// FIX-5 / D: a flat rectangle (300 wide, 400 tall) standing in front, a symmetric pair and a third pattern
const SCENE = `
  const out = {}, G3 = app.G3;
  app.ev("setLayout")("both");
  const R = app.mkPiece("R", app.mkShape([{x:-150,y:-1400},{x:150,y:-1400},{x:150,y:-1000},{x:-150,y:-1000}], true));
  const A = app.mkPiece("A", app.mkShape([{x:400,y:-1400},{x:700,y:-1400},{x:700,y:-1000},{x:400,y:-1100}], true));
  const B = app.mkPiece("B", app.mkShape([{x:1100,y:-1400},{x:800,y:-1400},{x:800,y:-1000},{x:1100,y:-1100}], true));
  B.segs.forEach((s, k) => { s.id = A.segs[k].id; });
  B.link = { of: A.id, kind: "symmetric", m: [-1, 0, 0, 1, 1500, 0] };
  S.pieces.push(R, A, B);
  S.cloth = app.normCloth({ ...S.cloth, res: 20, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
  const rows = () => { const L = []; const walk = (Q) => { for (const r of Q || []) { if (r && r.n) L.push(r); if (r && typeof r.menu === "function") walk(r.menu()); } }; walk(app.ev("contextMenuRows")()); return L; };
  const row = (n) => rows().find(r => r.n === n);
`;

test("POST8 FIX-5 / D1: Roll Up Horizontally / Vertically roll the selected cloth up where it hangs: Number turns of Width from the chosen edge, each turn's cloth laid outward one gap (3 mm) a layer over the cloth before its line, the hem inside; nothing else moves; one step, undo and redo exact; too short refused with no step; the rows built", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    out.rows0 = ["Roll Up Horizontally", "Roll Up Vertically", "Copy Symmetric Weights"].map(n => { const r = row(n); return r ? n + ":" + !!r.nb + ":" + !!r.off : n + ": none"; });
    S.sel = [R.id];
    out.rows1 = ["Roll Up Horizontally", "Roll Up Vertically"].map(n => !!row(n).off);
    const it = G3.items.get(R.id), m = it.mesh, X0 = Array.from(it.X), N = m.xy.length/2;
    // the flat cloth's plane and how 2D y maps to 3D height
    const z0 = X0[2], at = (v) => [X0[3*v], X0[3*v+1], X0[3*v+2]];
    out.flat = X0.every((x, k) => k % 3 !== 2 || Math.abs(x - z0) < 1e-6);
    const k0 = S.un.length; out.n = app.ev("rollUp3")("h", { w: 50, n: 2 });
    out.steps = S.un.slice(k0).map(u => u.n);
    const X1 = Array.from(it.X);
    // by the 2D place each point started at (y down: the bottom is y = -1000)
    const res = { stay: 0, stayBad: 0, hem: [], band: [], heightBad: 0 };
    for (let v = 0; v < N; v++) {
      const y = m.xy[2*v+1], dz = X1[3*v+2] - z0, moved = Math.hypot(X1[3*v] - X0[3*v], X1[3*v+1] - X0[3*v+1], dz);
      if (y < -1100 - 1e-6) { res.stay++; if (moved > 1e-6) res.stayBad++; continue; }
      if (y > -1050 + 1e-6) res.hem.push(+dz.toFixed(3)); else if (y > -1100 + 1e-6) res.band.push(+dz.toFixed(3));
      // every rolled point lies over the cloth between 2D y -1150 and -1100 (3D heights 1100 to 1150)
      if (y > -1100 + 1e-6 && (X1[3*v+1] < 1100 - 0.5 || X1[3*v+1] > 1150 + 0.5)) res.heightBad++;
    }
    out.res = { stay: res.stay, stayBad: res.stayBad, heightBad: res.heightBad, hem: [...new Set(res.hem)], band: [...new Set(res.band)] };
    app.undo(); out.undo = Array.from(G3.items.get(R.id).X).every((x, k) => Math.abs(x - X0[k]) < 1e-9);
    app.redo(); out.redo = Array.from(G3.items.get(R.id).X).every((x, k) => Math.abs(x - X1[k]) < 1e-9);
    app.undo();
    // Vertically, from the right: one turn of 40 mm; the cloth past x = 110 goes over 70..110
    app.ev("rollUp3")("v", { w: 40, n: 1, from: "right" });
    const X2 = Array.from(G3.items.get(R.id).X);
    let vBad = 0, vMoved = 0;
    for (let v = 0; v < N; v++) {
      const x = m.xy[2*v];
      if (x > 110 + 1e-6) { vMoved++; if (Math.abs(X2[3*v+2] - z0 - 3) > 0.01 || X2[3*v] < X0[3*v] - 1e-6 + (110 - x)*2 - 0.5) vBad++; }
      else if (Math.hypot(X2[3*v] - X0[3*v], X2[3*v+1] - X0[3*v+1], X2[3*v+2] - X0[3*v+2]) > 1e-6) vBad++;
    }
    out.v = [vMoved > 0, vBad, S.un[S.un.length - 1].n];
    // the row's own box: Width, Number, From (Bottom / Top), answered with From Top; the rows' Width and Number remembered
    app.undo();
    let asked = null;
    app.answer = (title, fields) => { asked = [title, fields.map(f => f.k + ":" + (f.options ? f.options.map(x => x[0]).join("/") : f.val))]; return { w: 40, n: 1, from: "top" }; };
    row("Roll Up Horizontally").f(); app.answer = undefined;
    const X3 = Array.from(G3.items.get(R.id).X);
    let topMoved = 0, otherMoved = 0;
    for (let v = 0; v < N; v++) { const mv = Math.hypot(X3[3*v] - X0[3*v], X3[3*v+1] - X0[3*v+1], X3[3*v+2] - X0[3*v+2]) > 1e-6; if (mv && m.xy[2*v+1] < -1360 - 1e-6) topMoved++; else if (mv) otherMoved++; }
    out.box = [asked, topMoved > 0, otherMoved, S.rollW, S.rollN];
    app.undo();
    // too short: 3 widths of 200 on a 400 tall pattern
    const k1 = S.undo.length; out.short = app.ev("rollUp3")("h", { w: 200, n: 2 }); out.shortSteps = S.undo.length - k1; out.shortToast = toasts.slice(-1)[0];
    // a few frames simulate it (nothing lost)
    app.ev("simStart")(); for (let i = 0; i < 10; i++) app.ev("simFrame")(); app.ev("simStop")();
    out.finite = Array.from(G3.items.get(R.id).X).every(Number.isFinite);
    return out;` });
  assert.deepStrictEqual(o.rows0, ["Roll Up Horizontally:false:true", "Roll Up Vertically:false:true", "Copy Symmetric Weights:false:true"], "built rows, greyed with nothing selected (no placeholder)");
  assert.deepStrictEqual(o.rows1, [false, false]);
  assert.strictEqual(o.flat, true);
  assert.strictEqual(o.n, 1);
  assert.deepStrictEqual(o.steps, ["Roll Up Horizontally"], "one step");
  assert.ok(o.res.stay > 0 && o.res.stayBad === 0, "the cloth above the roll does not move: " + JSON.stringify(o.res));
  assert.strictEqual(o.res.heightBad, 0, "every rolled point lies over the band before the last line");
  assert.deepStrictEqual(o.res.hem, [3], "the hem's turn is the inner layer, one gap out");
  assert.deepStrictEqual(o.res.band, [6], "the second turn's cloth the outer layer, two gaps out");
  assert.strictEqual(o.undo, true, "undo exact");
  assert.strictEqual(o.redo, true, "redo exact");
  assert.deepStrictEqual(o.v, [true, 0, "Roll Up Vertically"]);
  assert.deepStrictEqual(o.box, [["Roll Up Horizontally", ["w:30", "n:2", "from:bottom/top"]], true, 0, 40, 1], "the box, From Top rolls the top edge down");
  assert.deepStrictEqual([o.short, o.shortSteps], [0, 0]);
  assert.ok(/shorter than 3 widths/.test(o.shortToast), o.shortToast);
  assert.strictEqual(o.finite, true);
});

test("POST8 FIX-5 / D3: Roll Up on the T-shirt as shipped (front and back hanging flat, the sleeves wrapped round the arms): every rolled point lies outward of the cloth it covers (away from the body for the panels, from the arm's tube for the sleeves), one or two gaps off", () => {
  const o = boot({ blank: true, three: true, script: TSHIRT.replace("S.seams = []; ", "") + `
    const res = [], CN = app.ev("clothNormals"), G3 = app.G3;
    for (const P of S.pieces) {
      const it = G3.items.get(P.id); if (!it) continue;
      const X0 = Array.from(it.X), NV = X0.length/3, mid = [0, 0, 0], N = CN(X0, it.mesh.tri);
      for (let q = 0; q < X0.length; q += 3) for (let c = 0; c < 3; c++) mid[c] += X0[q+c]/NV;
      S.sel = [P.id]; app.ev("rollUp3")("h", { w: 30, n: 2 });
      const X1 = Array.from(it.X), stay = [], mv = [];
      for (let v = 0; v < NV; v++) (Math.hypot(X1[3*v]-X0[3*v], X1[3*v+1]-X0[3*v+1], X1[3*v+2]-X0[3*v+2]) < 1e-6 ? stay : mv).push(v);
      const sleeve = /sleeve/.test(P.name);
      let good = 0, lo = Infinity, hi = -Infinity;
      for (const v of mv) {
        let b = -1, bd = 1e9; for (const u of stay) { const d = Math.hypot(X1[3*v]-X0[3*u], X1[3*v+1]-X0[3*u+1], X1[3*v+2]-X0[3*u+2]); if (d < bd) { bd = d; b = u; } }
        const n = [N[3*b], N[3*b+1], N[3*b+2]], off = [0, 1, 2].reduce((s, c) => s + n[c]*(X1[3*v+c] - X0[3*b+c]), 0);
        const ref = sleeve ? [0, 1, 2].map(c => X0[3*b+c] - mid[c]) : [X0[3*b], 0, X0[3*b+2]], so = Math.sign(n[0]*ref[0] + n[1]*ref[1] + n[2]*ref[2]);
        if (off*so > 0) good++; lo = Math.min(lo, off*so); hi = Math.max(hi, off*so);
      }
      res.push([P.name, mv.length, good, +lo.toFixed(1), +hi.toFixed(1)]);
      app.undo();
    }
    return res;` });
  assert.strictEqual(o.length, 4);
  for (const [name, n, good, lo, hi] of o) {
    assert.ok(n > 50, name + ": rolled " + n);
    assert.strictEqual(good, n, name + ": every rolled point outward");
    assert.ok(lo >= 2 && hi <= 6.5, name + ": one or two gaps off: " + lo + " to " + hi);
  }
});

test("POST8 FIX-5 / S1: Smart Arrangement moves the selected pattern as one (its drape kept) so its sewn edges lie on the ones they are sewn to: two seams fit exactly (Horn), one straight seam keeps how the pattern faces; its place moves with it (placed again from it, the cloth is the same); one step, undo / redo exact; a chain in rounds; nothing to fit to: no step", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3;
    app.ev("setLayout")("both");
    const rect = (n, x) => app.mkPiece(n, app.mkShape([{x:x,y:-1400},{x:x+300,y:-1400},{x:x+300,y:-1000},{x:x,y:-1000}], true));
    const F = rect("F", -150), K = rect("K", 400), C = rect("C", 900);
    S.pieces.push(F, K, C);
    S.cloth = app.normCloth({ ...S.cloth, res: 20, substeps: 8, self: false, worker: false });
    app.commit(); app.ev("garmentSync")();
    const mk = app.ev("makeSeam"), sew = (pa, ia, pb, ib, rev) => { const s = mk(S.seams, { piece: pa.id, sid: pa.segs[ia].id }, { piece: pb.id, sid: pb.segs[ib].id }, rev); S.seams.push(s); return s; };
    // K's top and right sewn to F's top and right (the same way round): fitted exactly, K lands on F
    sew(F, 0, K, 0, false); sew(F, 1, K, 1, false);
    // K turned 40 degrees about a slanted axis and moved away
    const SIM3D = app.ev("SIM3D"), turn = SIM3D.qAxis([0.3, 0.8, 0.5].map(v => v/Math.hypot(0.3, 0.8, 0.5)), 40);
    K.p3 = { ...K.p3, pos: [K.p3.pos[0] + 250, K.p3.pos[1] + 120, K.p3.pos[2] - 300], q: SIM3D.qMul(turn, K.p3.q) };
    app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
    const XK = () => Array.from(G3.items.get(K.id).X), XF = Array.from(G3.items.get(F.id).X), K0 = XK();
    S.sel = [K.id]; out.n = app.ev("smartArrange3")();
    const K1 = XK();
    // K's four corners on F's (the same shape)
    const corner = (P, i) => { const p = S.pieces.find(x => x.id === P.id), q = p.pts[i], it = G3.items.get(p.id); return app.ev("clothAt")(it, app.ev("clothAnchor")(it, q.x, q.y)); };
    out.onF = Math.max(...[0, 1, 2, 3].map(i => Math.hypot(...corner(K, i).map((v, c) => v - corner(F, i)[c]))));
    out.XF = XF.length > 0;
    out.steps = S.un.map(u => u.n);
    // the place moved with it: placed again from p3 (K is not draped), the cloth is the same
    const it = G3.items.get(K.id); app.ev("placeItem")(it, S.pieces.find(p => p.id === K.id)); out.replace = Math.max(...Array.from(it.X).map((x, k) => Math.abs(x - K1[k])));
    app.undo(); out.undo = Math.max(...XK().map((x, k) => Math.abs(x - K0[k])));
    app.redo(); out.redo = Math.max(...XK().map((x, k) => Math.abs(x - K1[k])));
    // one straight seam: C's left side sewn to F's right side; C turned 30 degrees about the upright: it keeps facing that way
    app.undo();
    S.seams = S.seams.filter(sm => sm.a[0].piece !== K.id && sm.b[0].piece !== K.id);
    sew(F, 1, C, 3, true);
    C.p3 = { ...C.p3, pos: [C.p3.pos[0] + 100, C.p3.pos[1] + 50, C.p3.pos[2] + 80], q: SIM3D.qMul(SIM3D.qAxis([0, 1, 0], 30), C.p3.q) };
    app.commit(); app.ev("garmentSync")();
    const nrm = (X) => { const a = [X[3]-X[0], X[4]-X[1], X[5]-X[2]], b = [X[6]-X[0], X[7]-X[1], X[8]-X[2]]; const n = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], l = Math.hypot(...n); return n.map(v => v/l); };
    const itC = G3.items.get(C.id), tri = itC.mesh.tri, triX = (X) => [tri[0], tri[1], tri[2]].flatMap(v => [X[3*v], X[3*v+1], X[3*v+2]]);
    const C0 = Array.from(itC.X), n0 = nrm(triX(C0));
    S.sel = [C.id]; out.nC = app.ev("smartArrange3")();
    const C1 = Array.from(G3.items.get(C.id).X), n1 = nrm(triX(C1));
    out.facing = n0.reduce((s, v, k) => s + v*n1[k], 0);
    // the seam's two edges meet: C's left side on F's right side (y the same at its ends, x and z on F's edge)
    const sideF = [1, 2].map(i => { const q = S.pieces.find(p => p.id === F.id).pts[i]; return app.ev("clothAt")(G3.items.get(F.id), app.ev("clothAnchor")(G3.items.get(F.id), q.x, q.y)); });
    const sideC = [0, 3].map(i => { const q = S.pieces.find(p => p.id === C.id).pts[i]; return app.ev("clothAt")(G3.items.get(C.id), app.ev("clothAnchor")(G3.items.get(C.id), q.x, q.y)); });
    out.meet = Math.max(Math.hypot(...sideF[0].map((v, k) => v - sideC[0][k])), Math.hypot(...sideF[1].map((v, k) => v - sideC[1][k])));
    out.rigid = Math.abs(Math.hypot(C1[0]-C1[30], C1[1]-C1[31], C1[2]-C1[32]) - Math.hypot(C0[0]-C0[30], C0[1]-C0[31], C0[2]-C0[32]));
    // a chain: K sewn to C only; K and C selected: C goes to F first, then K to C
    sew(C, 1, K, 3, true); app.commit();
    S.sel = [K.id, C.id]; out.chain = app.ev("smartArrange3")(); out.chainToast = toasts.slice(-1)[0];
    // nothing that stays: every pattern selected
    S.sel = S.pieces.map(p => p.id); const k = S.undo.length; out.none = app.ev("smartArrange3")(); out.noneSteps = S.undo.length - k;
    return out;` });
  assert.strictEqual(o.n, 1);
  assert.ok(o.onF < 0.01, "two seams: K's cloth lands on F's: " + o.onF);
  assert.deepStrictEqual(o.steps, ["Smart Arrangement"]);
  assert.ok(o.replace < 1e-3, "its place moved with it (to the cloth's 32-bit floats): " + o.replace);
  // (K hangs undraped: redo places it from its moved place, to the cloth's 32-bit floats)
  assert.ok(o.undo < 1e-9 && o.redo < 1e-3, "undo / redo exact: " + o.undo + " " + o.redo);
  assert.strictEqual(o.nC, 1);
  assert.ok(o.facing > 0.9999, "one straight seam: it keeps facing the way it did: " + o.facing);
  assert.ok(o.meet < 0.5, "the sewn edges meet: " + o.meet);
  assert.ok(o.rigid < 1e-6, "moved as one");
  assert.strictEqual(o.chain, 2, o.chainToast);
  assert.deepStrictEqual([o.none, o.noneSteps], [0, 0]);
});

test("POST8 FIX-5 / D2: Copy Symmetric Weights copies the selected pattern's simulation properties (Particle Distance, Shrinkage, Pressure, Fill, Solidify and its Strength, Strengthen) onto its symmetric copy, either side selected; one step; nothing to copy or no copy: no step; greyed without a symmetric copy", () => {
  const o = boot({ blank: true, three: true, script: SCENE + `
    Object.assign(A, { res3: 15, shrink3: { weft: 90, warp: 95 }, press3: 5, fill: 20, solid3: true, solid3s: 40, strong3: true });
    Object.assign(B, { fill: 60 });
    app.commit(); S.undo.length = 0; S.un.length = 0;
    const keys = ["res3", "shrink3", "press3", "fill", "solid3", "solid3s", "strong3"], of = (p) => JSON.stringify(keys.map(k => p[k] === undefined ? null : p[k]));
    S.sel = [R.id]; out.offR = !!row("Copy Symmetric Weights").off;
    out.noCopy = app.ev("copySymWeights")(); out.noSteps = S.undo.length;
    S.sel = [A.id]; out.offA = !!row("Copy Symmetric Weights").off;
    row("Copy Symmetric Weights").f();
    out.same = of(S.pieces[2]) === of(S.pieces[1]); out.b = of(S.pieces[2]); out.step = S.un.map(u => u.n);
    out.again = app.ev("copySymWeights")(); out.againSteps = S.undo.length;
    // the copy selected hands its own back to the source
    S.pieces[2].fill = 10; app.commit(); S.sel = [S.pieces[2].id]; app.ev("copySymWeights")(); out.back = S.pieces[1].fill;
    app.undo(); app.undo(); out.undone = of(S.pieces[2]);
    return out;` });
  assert.strictEqual(o.offR, true, "no symmetric copy: greyed");
  assert.deepStrictEqual([o.noCopy, o.noSteps], [0, 0]);
  assert.strictEqual(o.offA, false);
  assert.strictEqual(o.same, true, o.b);
  assert.strictEqual(o.b, JSON.stringify([15, { weft: 90, warp: 95 }, 5, 20, true, 40, true]));
  assert.deepStrictEqual(o.step, ["Copy Symmetric Weights"]);
  assert.deepStrictEqual([o.again, o.againSteps], [0, 1], "nothing to copy: no step");
  assert.strictEqual(o.back, 10);
  assert.strictEqual(o.undone, JSON.stringify([null, null, null, 60, null, null, null]), "undo: the copy as it was");
});

module.exports = T;
