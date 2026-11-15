// Round PIPE-1b (run 18, the maintainer's answers to PIPE-1; the round's report, guesses pipe1b/1-9): a binding is ONE
// strip to cut by default: 2 × Width between its seam lines, its own seam allowance all round, a fold line along its middle, bias (woven) or
// cross-grain (knit), as long as the edge less the Reduction (0 % bias, 10 % cross-grain by default), notches at the quarters on the strip and
// on the garment's edge. PIPE-1's two strips are the option Two-piece. A piping's strip takes the same seam allowance and grain.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "gusset-pipe1b-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 600000, maxBuffer: 1 << 27 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, (m || "") + " " + a + " vs " + b);

// two patterns sewn at A's right side to B's left side; A's top a curve bending down into it (a neckline), the rest free
const TWO = `
  const out = {}, R = (n, ...a) => app.ev(n)(...a);
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  app.push("Rectangle"); S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400)); app.commit();
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  app.push("Curve"); A.segs[0].curved = true; A.segs[0].cps = [{ x: 150, y: 60 }]; app.commit();
  app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }); app.commit();
  const steps = () => app.histSteps().steps.map(s => s.n), fab = S.lib.fabric[0].id;
  const bind = (p, i, more, runOn) => { app.answer = (t, f, o) => ({ w: 10, fabric: o.selects[0].val, runOn: !!runOn, ...(more || {}) }); const pt = R("freeEdgePart", p, i, true); pt.one = p.segs[i].id; R("bindingDialog", pt, null, { x: 0, y: 0 }); app.answer = null; return S.bindings[S.bindings.length - 1]; };
  const P = (id) => S.pieces.find(p => p.id === id), len = (p, i) => R("segLen", p, i), r1 = (v) => Math.round(v*10)/10, r3 = (v) => Math.round(v*1000)/1000;
  const box = (L) => { const xs = L.map(q => q.x), ys = L.map(q => q.y); return [r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))]; };
  // the arc length from a line's start to each of its notches (and the line's length)
  const notchAt = (p, i, only) => (p.segs[i].notches || []).filter(n => !only || (n && n.bind)).map(n => r1(R("lenTo", p, i, R("nT", n))));
`;

test("PIPE-1b / A 1 (pipe1b/1, 2, 5): Binding on a curved edge makes ONE strip by default: 2 × Width between its seam lines, the document's seam allowance all round, a fold line along its middle, on the bias, as long as the edge (Reduction 0 %), notches at its quarters on both seam lines and at the edge's quarters on the garment; its two seam lines sewn to the edge folded onto the front (360) and back (0); archived in 3D, the rod still simulates it; one undo step", () => {
  const o = boot({ blank: true, three: true, script: TWO + `
    app.ev("setLayout")("both");
    const n0 = steps().length, b = bind(A, 0), St = P(b.pat[0]), E = len(A, 0);
    out.rec = [b.pat.length, b.sew.length, b.sa, b.red, b.grain || "bias", R("bindKind", b), typeof b.at, steps().slice(n0)];
    out.strip = [St.name, St.arch3, St.fabric === fab, St.segs.length, St.segs.map(s => s.sa), box(St.pts), box(R("cutLine", St))];
    out.L = [r1(E), r1(len(St, 0)), r1(len(St, 2))];
    const fl = St.internals.filter(it => !it.closed && it.fold); out.fold = [fl.length, fl[0] && fl[0].fold, fl[0] && r1(fl[0].pts[0].y - St.pts[0].y), fl[0] && r1(fl[0].pts[1].x - fl[0].pts[0].x)];
    out.stripNotches = [notchAt(St, 0), notchAt(St, 2), notchAt(St, 1).length + notchAt(St, 3).length];
    out.edgeNotches = notchAt(A, 0, true);
    const s0 = S.seams.find(s => s.id === b.sew[0]), s1 = S.seams.find(s => s.id === b.sew[1]);
    out.seams = [s0.a[0].piece === St.id, s0.a[0].sids[0] === St.segs[0].id, s0.b[0].sids[0] === A.segs[0].id, s0.foldAngle, s1.a[0].sids[0] === St.segs[2].id, s1.a[0].rev, s1.foldAngle];
    out.grain = r1(Math.abs(R("grainAngle", St.grain)));
    const bx = R("bboxOf", [A, B]), bs = R("bboxOf", [St]); out.place = [bs.x0 > bx.x1, Math.abs(bs.y0 - bx.y0) < 1e-6];
    app.ev("garmentSync")(true); out.rods = R("bindingRods", S.pieces.filter(p => !p.arch3).map(p => p.id)).length;
    // (undo and redo put new pattern objects in: the garment read back by its id)
    app.undo(); out.undone = [S.bindings.length, S.pieces.length, S.seams.length, (P(A.id).segs[0].notches || []).length]; app.redo(); out.redone = [S.bindings.length, S.pieces.length, S.seams.length, (P(A.id).segs[0].notches || []).length];
    return out;` });
  assert.deepStrictEqual(o.rec, [1, 2, 10, 0, "bias", "strip", "string", ["Binding"]], JSON.stringify(o));
  assert.deepStrictEqual(o.strip.slice(0, 5), ["Binding 1 Strip", true, true, 4, [10, 10, 10, 10]], "one strip, archived, the binding's fabric, the document's 10 mm all round");
  near(o.strip[5][1], 20, 0.05, "2 × Width between the seam lines"); near(o.strip[6][1], 20 + 20, 0.05, "+ 2 × the seam allowance: what is cut");
  near(o.L[1], o.L[0], 0.1, "as long as the edge (Reduction 0 % on the bias)"); near(o.L[2], o.L[0], 0.1, "both seam lines");
  near(o.strip[6][0], o.L[0] + 20, 0.1, "the allowance at the ends too");
  assert.deepStrictEqual([o.fold[0], o.fold[1], o.fold[2]], [1, "valley", 10], "a fold line along the middle, Width from the top seam line"); near(o.fold[3], o.L[1], 0.1, "all along it");
  const q = [0.25, 0.5, 0.75].map(f => Math.round(f*o.L[1]*10)/10);
  for (const k of [0, 1]) o.stripNotches[k].forEach((v, j) => near(v, k === 0 ? q[j] : o.L[1] - q[2 - j], 0.2, "the strip's quarter notches on seam line " + k));
  assert.strictEqual(o.stripNotches[2], 0, "none on the ends");
  assert.strictEqual(o.edgeNotches.length, 3, "three notches on the garment's edge");
  o.edgeNotches.forEach((v, j) => near(v, [0.25, 0.5, 0.75][j]*o.L[0], 0.3, "at the edge's quarters (by its length along the curve)"));
  assert.deepStrictEqual(o.seams, [true, true, true, 360, true, true, 0], "the top seam line onto the front, the bottom one (run the same way) onto the back");
  near(o.grain, 45, 1, "on the bias");
  assert.deepStrictEqual(o.place, [true, true], "right of every pattern, at the garment's height");
  assert.strictEqual(o.rods, 1, "the rod still simulates it (pipe1/2b)");
  assert.deepStrictEqual(o.undone, [0, 2, 1, 0]); assert.deepStrictEqual(o.redone, [1, 3, 3, 3]);
});

test("PIPE-1b / A 2 (pipe1b/3, 4): the strip's sums for both grains: width 2 × Width + 2 × the seam allowance, length the edge × (1 − Reduction); cross-grain defaults to 10 % shorter, its grainline across the strip; a Reduction typed is kept; the box's Reduction follows the grain chosen; the strip's quarters still meet the edge's (eased evenly)", () => {
  const o = boot({ blank: true, script: TWO + `
    const E = len(A, 0), res = [];
    // bias, Width 8, allowance 6; cross-grain with its default; cross-grain at 5 %; bias at 3 %
    for (const [k, more] of [[0, { w: 8, sa: 6, grain: "bias" }], [1, { w: 8, sa: 6, grain: "cross" }], [2, { w: 12, sa: 0, grain: "cross", red: 5 }], [3, { w: 10, sa: 15, grain: "bias", red: 3 }]]) {
      const b = bind(A, 0, more), St = P(b.pat[0]);
      res.push({ red: b.red, grain: b.grain || "bias", L: r3(len(St, 0)/E), H: box(St.pts)[1], cut: box(R("cutLine", St))[1], g: r1(Math.abs(R("grainAngle", St.grain))) });
      R("deleteTrim", "binding", b.id);
    }
    out.res = res; out.E = r1(E);
    // the box: the Reduction field follows the grain (its sync), the defaults by grain
    let opts = null; app.answer = (t, f, op) => { opts = op; return null; };
    const pt = R("freeEdgePart", A, 0, true); R("bindingDialog", pt, null, { x: 0, y: 0 }); app.answer = null;
    out.sync = [opts.sync({ grain: "cross" }, "grain").red, opts.sync({ grain: "bias" }, "grain").red, JSON.stringify(opts.sync({ grain: "cross" }, "w"))];
    out.reds = [app.ev("BIND_RED").bias, app.ev("BIND_RED").cross];
    // a cross-grain strip 10 % short: its notches at its own quarters, the garment's at the edge's: matched by the seam's proportion
    const b = bind(A, 0, { grain: "cross" }), St = P(b.pat[0]), Ls = len(St, 0);
    out.ease = [notchAt(St, 0).map(v => r3(v/Ls)), notchAt(A, 0, true).map(v => r3(v/E))];
    return out;` });
  const [bias, cross, cross5, bias3] = o.res;
  assert.deepStrictEqual([bias.red, cross.red, cross5.red, bias3.red], [0, 10, 5, 3], "Reduction: 0 bias, 10 cross-grain by default, a typed one kept");
  assert.deepStrictEqual([bias.L, cross.L, cross5.L, bias3.L], [1, 0.9, 0.95, 0.97], "length = the edge × (1 − Reduction)");
  assert.deepStrictEqual([bias.H, cross.H, cross5.H, bias3.H], [16, 16, 24, 20], "2 × Width between the seam lines");
  for (const [r, w] of [[bias, 16 + 12], [cross, 16 + 12], [cross5, 24], [bias3, 20 + 30]]) near(r.cut, w, 0.05, "the cut width 2 × Width + 2 × the allowance");
  // (grainAngle() is measured from up the screen; the strip lies level, so across it is 0°)
  near(bias.g, 45, 1, "bias: 45°"); near(cross.g, 0, 1, "cross-grain: the grainline across the strip"); near(cross5.g, 0, 1);
  assert.deepStrictEqual(o.sync, [10, 0, "{}"], "the box's Reduction follows the grain");
  assert.deepStrictEqual(o.reds, [0, 10]);
  assert.deepStrictEqual(o.ease[0], [0.25, 0.5, 0.75], "the strip's notches at its quarters");
  for (let j = 0; j < 3; j++) near(o.ease[1][j], o.ease[0][j], 0.002, "the garment's at the edge's: the 10 % eased in evenly between them");
});

test("PIPE-1b / A 3 (pipe1b/5-8): the strip follows its edge (cut again in the same step, the same pattern, the garment's notches moved); all round an outline its ends are sewn together; Two-piece switches to PIPE-1's two strips and back; Delete takes the strip, its seams and the garment's notches; saved and opened it keeps everything; a piping's strip takes the allowance and grain", () => {
  const o = boot({ blank: true, streams: true, script: TWO + `
    return (async () => {
      // B's hem: a straight edge, cross-grain
      const b = bind(B, 2, { grain: "cross" }), id0 = b.pat[0], n0 = steps().length;
      app.push("Move Point"); B.pts[2].x += 40; app.commit();
      out.follow = [b.pat[0] === id0, steps().length - n0, r3(len(P(id0), 0)/len(B, 2)), notchAt(B, 2, true).map(v => r1(v/len(B, 2)*100))];
      // Two-piece, then one strip again
      app.answer = (t, f, op) => ({ w: 10, fabric: op.selects[0].val, two: true }); R("bindingDialog", b.part, b, { x: 0, y: 0 }); app.answer = null;
      out.two = [b.pat.length, R("bindKind", b), b.sa === undefined, b.grain === undefined, (B.segs[2].notches || []).filter(n => n && n.bind).length, !P(id0)];
      app.answer = (t, f, op) => ({ w: 10, fabric: op.selects[0].val, two: false, grain: "cross" }); R("bindingDialog", b.part, b, { x: 0, y: 0 }); app.answer = null;
      out.one = [b.pat.length, R("bindKind", b), b.red, (B.segs[2].notches || []).filter(n => n && n.bind).length];
      // round a whole lone patch: the strip's ends sewn together
      app.push("Rectangle"); const C = sq("Patch", 0, 600, 200, 200); S.pieces.push(C); app.commit();
      const bc = bind(C, 0, {}, true), Sc = P(bc.pat[0]), se = S.seams.find(s => s.id === bc.sew[2]);
      out.ring = [bc.part.sids.length, bc.sew.length, se && se.a[0].sids[0] === Sc.segs[1].id, se && se.b[0].sids[0] === Sc.segs[3].id, se && se.b[0].rev, r1(len(Sc, 0)), C.segs.reduce((n, s) => n + (s.notches || []).filter(x => x && x.bind).length, 0)];
      // saved and opened: everything kept
      const refs = () => S.bindings.map(t => [t.pat.length, t.sew.length, t.at, t.sa, t.red, t.grain || "bias"]).concat([S.pieces.map(p => p.segs.map(s => (s.notches || []).length).join(",")).join("|")]);
      const before = refs();
      let file = null; app.setDownload((n, by) => { file = by; }); app.saveDoc(false); await app.wait(() => file, "the file");
      const n1 = toasts.length; app.ev("openFile")("b.pdraft", file, null, true); await app.wait(() => toasts.slice(n1).some(x => /^Opened b/.test(x)), "the file to open");
      out.kept = [JSON.stringify(refs()) === JSON.stringify(before), S.pieces.find(p => p.name === "Back").segs[2].notches.filter(n => n && n.bind).length];
      // Delete: the strip, its seams and the garment's notches go; undo puts them back
      const Bk = S.pieces.find(p => p.name === "Back"), bb = S.bindings.find(t => t.part.piece === Bk.id), np = S.pieces.length, ns = S.seams.length;
      R("deleteTrim", "binding", bb.id);
      out.del = [np - S.pieces.length, ns - S.seams.length, Bk.segs[2].notches.filter(n => n && n.bind).length];
      app.undo(); out.back = [S.pieces.length === np, S.seams.length === ns, S.pieces.find(p => p.name === "Back").segs[2].notches.filter(n => n && n.bind).length];
      // a piping: the document's allowance, cross-grain
      app.answer = (t, f, op) => ({ d: 4, t0: 0, t1: 100, fabric: op.selects[0].val, side: "out", sa: 8, grain: "cross" }); R("pipingDialog", 1, null, { x: 0, y: 0 }); app.answer = null;
      const pp = S.pipings[0], Sp = S.pieces.find(p => p.id === pp.pat[0]);
      out.piping = [pp.sa, pp.grain, Sp.segs.map(s => s.sa), box(Sp.pts)[1], box(R("cutLine", Sp))[1], r1(Math.abs(R("grainAngle", Sp.grain)))];
      return out;
    })();` });
  assert.deepStrictEqual(o.follow.slice(0, 3), [true, 1, 0.9], "the same strip, cut again in the one step, still 10 % short");
  o.follow[3].forEach((v, j) => near(v, [25, 50, 75][j], 0.2, "the garment's notches at the moved edge's quarters"));
  assert.deepStrictEqual(o.two, [2, "two", true, true, 0, true], "Two-piece: PIPE-1's two strips, the one strip and its notches gone");
  assert.deepStrictEqual(o.one, [1, "strip", 10, 3], "one strip again");
  assert.deepStrictEqual(o.ring.slice(0, 5), [4, 3, true, true, true], "round the outline: its two ends sewn together");
  near(o.ring[5], 800, 0.1, "as long as the patch round"); assert.strictEqual(o.ring[6], 3, "three notches round the patch");
  assert.deepStrictEqual(o.kept, [true, 3], "saved and opened: strips, seams, cut settings and notches kept");
  assert.deepStrictEqual(o.del, [1, 2, 0], "Delete: the strip, its two seams and the garment's notches");
  assert.deepStrictEqual(o.back, [true, true, 3]);
  assert.deepStrictEqual(o.piping.slice(0, 3), [8, "cross", [8, 8, 8, 8]]);
  near(o.piping[3], Math.PI*4, 0.05, "π d between the seam lines"); near(o.piping[4], Math.PI*4 + 16, 0.05, "+ 2 × its allowance"); near(o.piping[5], 0, 1, "cross-grain: across the level strip");
});

test("PIPE-1b / A 4: the DXF of a bound neckline (the T-shirt example's front, Cross-grain 10 %): the strip with its cut line and seam line, its fold line, grainline and six notches; the garment with the three notches at its neckline's quarters", () => {
  const o = boot({ blank: true, script: `
    return (async () => {
      const out = {}, R = (n, ...a) => app.ev(n)(...a);
      app.ev("openExample")(app.ev("shippedExamples")().find(e => e.id === "tshirt-marty"), true); await app.wait(() => S.pieces.length, "the example");
      const F = S.pieces.find(p => /front/i.test(p.name)), sewn = app.ev("segSewn");
      let best = -1, by = 1e9; F.segs.forEach((s, i) => { const m = R("segPt", F, i, 0.5); if (!sewn(F, s.id) && m.y < by) { by = m.y; best = i; } });
      const before = F.segs.reduce((n, s) => n + (s.notches || []).length, 0);
      app.answer = (t, f, op) => ({ w: 10, fabric: op.selects[0].val, runOn: true, grain: "cross" }); R("bindingDialog", R("freeEdgePart", F, best, true), null, { x: 0, y: 0 }); app.answer = null;
      const b = S.bindings[0], St = S.pieces.find(p => p.id === b.pat[0]);
      const doc = R("dxfParse", R("dxfExport", [St, F], { format: "aama" }, S.grading)), names = Object.keys(doc.blocks);
      const count = (bl, type, layer) => doc.blocks[bl].filter(e => e.type === type && String(e.layer) === String(layer)).length;
      out.strip = [count(names[0], "POLY", 1), count(names[0], "POLY", 14), count(names[0], "POLY", 8), count(names[0], "POLY", 7), count(names[0], "POINT", 4)];
      out.front = [count(names[1], "POINT", 4) - before, F.segs.reduce((n, s) => n + (s.notches || []).filter(x => x && x.bind).length, 0)];
      out.red = b.red;
      return out;
    })();` });
  assert.strictEqual(o.red, 10);
  assert.deepStrictEqual(o.strip, [1, 1, 1, 1, 6], "the strip: its cut line (1), seam line (14), fold line (8), grainline (7) and six notches (4)");
  assert.deepStrictEqual(o.front, [3, 3], "the neckline's three quarter notches");
});

test("PIPE-1b / A 5: the golden file binding.pdraft holds a one-strip binding (Cross-grain, its own allowance and Reduction, the garment's quarter notches) and a PIPE-1b piping; opened, its binding is that kind, and nothing is cut again", () => {
  const gold = fs.readFileSync(path.join(__dirname, "files", "v37", "binding.pdraft")).toString("base64");
  const o = boot({ blank: true, streams: true, script: `
    return (async () => {
      const out = {}, R = (n, ...a) => app.ev(n)(...a);
      const n0 = toasts.length; app.ev("openFile")("g.pdraft", app.ev("bytesOf")(${JSON.stringify(gold)}), null, true); await app.wait(() => toasts.slice(n0).some(x => /^Opened g/.test(x)), "the golden file");
      const b = S.bindings[0], p = S.pipings[0];
      out.b = [S.bindings.length, R("bindKind", b), b.grain, b.red, b.sa, b.at === R("stripSig", b)];
      out.p = [S.pipings.length, p.sa, p.at === R("pipingSig", p)];
      out.notches = S.pieces.reduce((n, q) => n + q.segs.reduce((m, s) => m + (s.notches || []).filter(x => x && x.bind).length, 0), 0);
      return out;
    })();` });
  assert.deepStrictEqual(o.b.slice(0, 2), [1, "strip"]); assert.strictEqual(o.b[2], "cross"); assert.ok(o.b[4] >= 0); assert.strictEqual(o.b[5], true, "its edge as it was cut");
  assert.strictEqual(o.p[0], 1); assert.ok(o.p[1] >= 0); assert.strictEqual(o.p[2], true);
  assert.strictEqual(o.notches, 3);
});

module.exports = T;
