// Round PIPE-1 (run 17, the round's spec, guesses pipe1/1-12): piping and binding made as patterns. A binding is two strips
// (Outside, Inside) cut to the band of the garment it covers beside its edge, sewn to the edge folded onto both faces; the strips of two
// bindings meeting at a seam are sewn end to end; they are cut again when the edge changes and go with the binding. A piping's bias strip
// is a pattern. Both kinds of strip are archived in 3D (the rod simulates them). An imported binding is one of ours.
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const ZPRJ = require("../zprj-import.js");
const MK = require("./zprj-make");

const T = [];
const test = (name, fn) => T.push({ name, fn });
// (the options through a file: a script holding a file's bytes is longer than a Windows command line may be)
function boot(opt) {
  const f = path.join(require("os").tmpdir(), "gusset-pipe1-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 600000, maxBuffer: 1 << 27 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, (m || "") + " " + a + " vs " + b);

// two patterns side by side, sewn at A's right side to B's left side: A's top a curve bending down into it (a neckline), hems free
const TWO = `
  const out = {}, R = (n, ...a) => app.ev(n)(...a);
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  app.push("Rectangle"); S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400)); app.commit();
  const A = S.pieces[0], B = S.pieces[1], part = (p, i, rev) => ({ piece: p.id, shape: 0, sids: [p.segs[i].id], t0: 0, t1: 1, rev: !!rev });
  app.push("Curve"); A.segs[0].curved = true; A.segs[0].cps = [{ x: 150, y: 60 }]; app.commit();
  app.push("Sew"); S.seams.push({ id: 1, a: [part(A, 1)], b: [part(B, 3, true)] }); app.commit();
  const steps = () => app.histSteps().steps.map(s => s.n), fab = S.lib.fabric[0].id;
  // (Round PIPE-1b: one strip is the box's default now; these tests are of PIPE-1's two strips, the option Two-piece, so they tick it;
  // the one strip: pipe1b.test.js)
  const bind = (p, i, runOn, w) => { app.answer = (t, f, o) => ({ w: w || 10, fabric: o.selects[0].val, runOn, two: true }); const pt = R("freeEdgePart", p, i, true); pt.one = p.segs[i].id; R("bindingDialog", pt, null, { x: 0, y: 0 }); app.answer = null; return S.bindings[S.bindings.length - 1]; };
  const P = (id) => S.pieces.find(p => p.id === id), len = (p, i) => R("segLen", p, i), r1 = (v) => Math.round(v*10)/10;
  // a polyline's length and its points every 2 mm
  const poly = (sh, i) => { const L = len(sh, i), n = Math.max(2, Math.ceil(L/2)), pts = []; for (let k = 0; k <= n; k++) pts.push(R("segPt", sh, i, R("tAtFrac", sh, i, k/n))); return pts; };
  const dseg = (q, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx*dx + dy*dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x)*dx + (q.y - a.y)*dy)/l2)) : 0; return Math.hypot(q.x - a.x - t*dx, q.y - a.y - t*dy); };
  const dpoly = (q, L) => { let m = 1e9; for (let k = 1; k < L.length; k++) m = Math.min(m, dseg(q, L[k-1], L[k])); return m; };
`;

test("PIPE-1 / B 1 (pipe1/1-3, 6-7): Binding on a curved free edge makes two strip patterns, Outside and Inside (its mirror image), each the band of the garment Width in from the edge: its edge line as long as the garment's edge, its inner line every point Width from it, the ends along the garment's next lines; two seams sew them to the edge folded onto the front (360) and the back (0); on the bias, no seam allowance, the binding's fabric, archived in 3D, right of every pattern; one undo step; the rod still simulates it", () => {
  const o = boot({ blank: true, script: TWO + `
    const n0 = steps().length, b = bind(A, 0, false), [SA, SB] = b.pat.map(P);
    out.rec = [b.pat.length, b.sew.length, typeof b.at, b.w, b.fabric === fab, steps().slice(n0)];
    out.names = [SA.name, SB.name]; out.arch = [SA.arch3, SB.arch3]; out.fab = [SA.fabric === fab, SB.fabric === fab];
    out.sa = [...SA.segs, ...SB.segs].every(s => !s.sa);
    out.segs = [SA.segs.length, SB.segs.length, SA.segs.map(s => (s.curved ? "c" : "s")).join("")];
    const E = poly(A, 0);
    out.edge = [r1(len(A, 0)), r1(len(SA, 0)), r1(len(SB, 0))];
    // every point of the inner line (Outside's line 2) Width from the edge line, once the strip is put back on the garment (its own edge line's start on the garment's)
    const sh = (p) => p, inner = poly(SA, 2), e0 = R("segPt", SA, 0, 0), g0 = R("segPt", A, 0, 0), back = inner.map(q => ({ x: q.x - e0.x + g0.x, y: q.y - e0.y + g0.y }));
    const ds = back.slice(3, -3).map(q => dpoly(q, E)); out.width = [r1(Math.min(...ds)), r1(Math.max(...ds))];
    // the ends: on the garment's sides (x 0 and 300 there)
    out.ends = [r1(SA.pts[1].x - e0.x + g0.x), r1(SA.pts[2].x - e0.x + g0.x), r1(SA.pts[3].x - e0.x + g0.x)];
    out.mirror = [Math.sign(R("signedArea", R("flatten", SA, 8))), Math.sign(R("signedArea", R("flatten", SB, 8)))];
    const s0 = S.seams.find(s => s.id === b.sew[0]), s1 = S.seams.find(s => s.id === b.sew[1]);
    out.seams = [s0.a[0].piece === SA.id, s0.b[0].piece === A.id, s0.foldAngle, s1.a[0].piece === SB.id, s1.foldAngle, s0.b[0].sids[0] === A.segs[0].id];
    const bx = R("bboxOf", [A, B]), ba = R("bboxOf", [SA]), bb = R("bboxOf", [SB]); out.place = [ba.x0 > bx.x1, bb.x0 > ba.x1, Math.abs(ba.y0 - bx.y0) < 1e-6];
    const g = R("grainAngle", SA.grain); out.grain = r1(Math.abs(g));
    app.undo(); out.undone = [S.bindings.length, S.pieces.length, S.seams.length]; app.redo(); out.redone = [S.bindings.length, S.pieces.length, S.seams.length];
    return out;` });
  assert.deepStrictEqual(o.rec, [2, 2, "string", 10, true, ["Binding"]]);
  assert.deepStrictEqual(o.names, ["Binding 1 Outside", "Binding 1 Inside"]);
  assert.deepStrictEqual(o.arch, [true, true], "archived in 3D (pipe1/2b)"); assert.deepStrictEqual(o.fab, [true, true]); assert.ok(o.sa, "no seam allowance");
  assert.deepStrictEqual(o.segs, [4, 4, "cscs"], "the edge and the inner line curves, the ends straight: " + JSON.stringify(o.segs));
  near(o.edge[1], o.edge[0], 0.3, "Outside's edge line as long as the garment's edge"); near(o.edge[2], o.edge[0], 0.3, "and Inside's");
  near(o.width[0], 10, 0.3, "the inner line Width from the edge"); near(o.width[1], 10, 0.3, "everywhere");
  assert.deepStrictEqual([o.ends[0], o.ends[2]].map(Math.round).sort((a, b) => a - b), [0, 300], "the ends on the garment's sides: " + o.ends);
  assert.strictEqual(o.mirror[0], -o.mirror[1], "Inside is Outside's mirror image");
  assert.deepStrictEqual(o.seams, [true, true, 360, true, 0, true]);
  assert.deepStrictEqual(o.place, [true, true, true], "right of every pattern, Inside beside Outside, at the garment's height");
  near(o.grain, 45, 1, "on the bias");      // (the rod that still simulates it: D 2, with the cloth)
  assert.deepStrictEqual(o.undone, [0, 2, 1]); assert.deepStrictEqual(o.redone, [1, 4, 3]);
});

test("PIPE-1 / D 1 (pipe1/4, 5, 9): a binding run on round corners has its inner line mitred there; round the whole outline it is a ring (the inner line a hole); two bindings ending at the same seam are sewn end to end; the strips are cut again when the garment's edge changes (same patterns, same step); Delete takes the strips and seams; a strip deleted ends the binding; the garment deleted takes its strips", () => {
  const o = boot({ blank: true, script: TWO + `
    // A's hem and left side and top run on (its right side is sewn): two corners
    const b1 = bind(A, 2, true), [SA] = b1.pat.map(P);
    out.run = [b1.part.sids.length, SA.segs.length];
    // the corner at A's bottom left (0, 400): the inner line's corner Width in from both lines, at (10, 390) on the garment
    const e0 = R("segPt", SA, 0, 0), g0 = R("segPt", A, 2, 0), at = (q) => ({ x: Math.round((q.x - e0.x + g0.x)*10)/10, y: Math.round((q.y - e0.y + g0.y)*10)/10 });
    out.mitre = SA.pts.map(at).filter(q => Math.abs(q.x - 10) < 0.5 && Math.abs(q.y - 390) < 0.5).length;
    // B's hem ends at the seam's bottom end, where A's binding starts: their strips are sewn end to end (each end along the seam's line, 10 mm)
    const b2 = bind(B, 2, false), joins = (S.bindings[0].sew || []).slice(2);
    out.joins = [joins.length, joins.every(id => S.seams.some(s => s.id === id))];
    out.joinSides = joins.map(id => { const s = S.seams.find(x => x.id === id); return [b1.pat.indexOf(s.a[0].piece), b2.pat.indexOf(s.b[0].piece)]; });
    // the garment's edge changes: B's hem made 40 mm longer (its outer corner moved out); the strips follow, in the same step, as the same patterns
    const ids = b2.pat.slice(), L0 = len(P(ids[0]), 0), n0 = steps().length;
    app.push("Move Point"); B.pts[2].x += 40; app.commit();
    out.follow = [r1(len(B, 2)), r1(len(P(ids[0]), 0)), r1(L0), b2.pat.join() === ids.join(), steps().length - n0];
    // Delete the second binding: its strips, its seams and the joins go; undo brings them back
    const all = S.pieces.length, sm = S.seams.length;
    R("deleteTrim", "binding", b2.id);
    out.del = [S.bindings.length, all - S.pieces.length, sm - S.seams.length, (S.bindings[0].sew || []).length];
    app.undo(); out.back = [S.bindings.length, S.pieces.length === all, S.seams.length === sm];
    // a strip deleted by hand ends the binding; the other strip stays
    const keep = S.bindings[1].pat[1];
    app.push("Delete"); R("removePieces", [P(S.bindings[1].pat[0])]); app.commit();
    out.ended = [S.bindings.length, !!P(keep)];
    // the garment deleted: its binding's strips go with it
    const s1 = S.bindings[0].pat.slice();
    app.push("Delete"); R("removePieces", [A]); app.commit();
    out.gone = [S.bindings.length, s1.filter(P).length];
    // round the whole outline: a lone square's binding is a ring with a hole
    app.push("Rectangle"); const C = sq("Patch", 0, 600, 200, 200); S.pieces.push(C); app.commit();
    const b3 = bind(C, 0, true), [RA] = b3.pat.map(P);
    out.ring = [b3.part.sids.length, (RA.internals || []).filter(it => it.hole && it.closed).length, RA.segs.length, r1(R("bboxOf", [RA]).x1 - R("bboxOf", [RA]).x0)];
    return out;` });
  assert.deepStrictEqual(o.run, [3, 8], "three lines: three edge lines, an end, three inner lines, an end");
  assert.ok(o.mitre >= 1, "the inner line's corner is Width in from both lines");
  assert.deepStrictEqual(o.joins, [2, true], "Outside to Outside, Inside to Inside: " + JSON.stringify(o)); assert.deepStrictEqual(o.joinSides, [[0, 0], [1, 1]]);
  near(o.follow[1], o.follow[0], 0.3, "the strip as long as the moved hem"); assert.ok(o.follow[1] > o.follow[2] + 1, "longer than before");
  assert.deepStrictEqual(o.follow.slice(3), [true, 1], "the same patterns, in the one step");
  assert.deepStrictEqual(o.del, [1, 2, 4, 2], "two strips, two seams and two joins went; the first binding keeps its own two seams");
  assert.deepStrictEqual(o.back, [2, true, true]);
  assert.deepStrictEqual(o.ended, [1, true]);
  assert.deepStrictEqual(o.gone, [0, 0]);
  assert.deepStrictEqual(o.ring.slice(0, 3), [4, 1, 4], "four edge lines round the outline, the inner line a hole");
  near(o.ring[3], 200, 0.5, "as wide as the patch");
});

test("PIPE-1 / C 1 (pipe1/10): Piping makes its bias strip a pattern: as long as its run of the seam, π d + 2 × 10 mm wide, a fold line along its middle, archived in 3D; its box changes it (the same pattern); deleted with the piping; the cord is still the rod", () => {
  const o = boot({ blank: true, script: TWO + `
    const ask = (d, t0, t1) => { app.answer = (t, f, op) => ({ d, t0, t1, fabric: op.selects[0].val, side: "out" }); };
    ask(4, 0, 50); R("pipingDialog", 1, null, { x: 0, y: 0 });
    // (Round PIPE-1b: the strip's allowance is its own now, the document's 10 mm by default, outside its seam lines π d apart: so the cut
    // line is π d + 2 × 10 wide as before, and the outline π d)
    const t = S.pipings[0], St = P(t.pat[0]), bx = (p) => { const b = R("bboxOf", [p]); return [r1(b.x1 - b.x0), r1(b.y1 - b.y0)]; }, cx = (p) => { const L = R("cutLine", p), xs = L.map(q => q.x), ys = L.map(q => q.y); return [r1(Math.max(...xs) - Math.min(...xs)), r1(Math.max(...ys) - Math.min(...ys))]; };
    out.made = [S.pipings.length, t.pat.length, St.name, St.arch3, cx(St), (St.internals || []).filter(it => !it.closed && it.fold).length, steps().slice(-1)[0], bx(St), t.sa];
    ask(6, 0, 100); R("pipingDialog", 1, t, { x: 0, y: 0 });
    out.edited = [t.pat[0] === St.id, cx(P(t.pat[0]))];
    const n = S.pieces.length; R("deleteTrim", "piping", t.id); out.del = [S.pipings.length, n - S.pieces.length];
    return out;` });
  assert.deepStrictEqual(o.made.slice(0, 4), [1, 1, "Piping 1 Strip", true]);
  // (PIPE-1b: the cut line's length has the allowance at both ends too, + 2 × 10)
  near(o.made[4][0], 200 + 20, 0.2, "half the 400 mm seam"); near(o.made[4][1], Math.PI*4 + 20, 0.05, "π d + 2 flanges");
  assert.deepStrictEqual(o.made.slice(5, 7), [1, "Piping"]);
  near(o.made[7][1], Math.PI*4, 0.05, "π d between the seam lines (PIPE-1b)"); assert.strictEqual(o.made[8], 10, "the document's allowance");
  assert.strictEqual(o.edited[0], true); near(o.edited[1][0], 400 + 20, 0.2); near(o.edited[1][1], Math.PI*6 + 20, 0.05);
  assert.deepStrictEqual(o.del, [0, 1]);
});

test("PIPE-1 / B 2 (pipe1/8): saved and opened, a binding and a piping keep their strips, seams and edge (pat, sew, at); Add Project brings them on the new ids; an older file's rod binding (the golden sewing file) opens as it was, and its box's OK makes it as strips", () => {
  const gold = fs.readFileSync(path.join(__dirname, "files", "v37", "sewing.pdraft")).toString("base64");
  const o = boot({ blank: true, streams: true, script: TWO + `
    return (async () => {
      bind(A, 0, false); app.answer = (t, f, op) => ({ d: 4, t0: 0, t1: 100, fabric: op.selects[0].val, side: "out" }); R("pipingDialog", 1, null, { x: 0, y: 0 }); app.answer = null;
      const refs = () => [S.bindings.map(b => [b.pat, b.sew, b.at]), S.pipings.map(t => [t.pat, t.at])];
      out.before = refs();
      let file = null; app.setDownload((n, b) => { file = b; }); app.saveDoc(false); await app.wait(() => file, "the file");
      const parts = await new Promise(res => app.ev("zipUnpack")(file, (e, p) => res(p))), doc = JSON.parse(new TextDecoder().decode(parts.get("document.json")));
      out.inFile = [doc.bindings.map(b => [b.pat, b.sew, b.at]), doc.pipings.map(t => [t.pat, t.at])];
      const n0 = toasts.length; app.ev("openFile")("b.pdraft", file, null, true); await app.wait(() => toasts.slice(n0).some(x => /^Opened b/.test(x)), "the file to open");
      out.opened = refs();
      // Add Project: the same document again, on new ids
      const np = S.pieces.length; R("addDocument", "b", doc); out.added = [S.bindings.length, S.pieces.length - np];
      const b2 = S.bindings[1]; out.addRefs = [b2.pat.every(id => S.pieces.some(p => p.id === id)), b2.pat.some(id => S.bindings[0].pat.includes(id)), b2.sew.every(id => S.seams.some(s => s.id === id && s.a[0].piece === b2.pat[b2.sew.indexOf(id)]))];
      // the golden file: a rod binding, no strips; its box's OK makes them
      const n1 = toasts.length; app.ev("openFile")("g.pdraft", app.ev("bytesOf")(${JSON.stringify(gold)}), null, true); await app.wait(() => toasts.slice(n1).some(x => /^Opened g/.test(x)), "the golden file");
      const g = S.bindings[0]; out.gold = [S.bindings.length, !!g.pat, S.pipings.length, !!S.pipings[0].pat];
      // (PIPE-1b: OK'd with the box's default it is made as one strip)
      app.answer = (t, f, op) => ({ w: 12, fabric: op.selects[0].val }); R("bindingDialog", g.part, g, { x: 0, y: 0 }); app.answer = null;
      out.converted = [S.bindings[0].pat.length, S.bindings[0].w];
      return out;
    })();` });
  assert.deepStrictEqual(o.inFile, o.before); assert.deepStrictEqual(o.opened, o.before);
  assert.deepStrictEqual(o.added, [2, 5], "the garment, its back, two strips and the piping's strip again: " + JSON.stringify(o));
  assert.deepStrictEqual(o.addRefs, [true, false, true]);
  assert.deepStrictEqual(o.gold, [1, false, 1, false], "an older binding and piping: no strips until changed");
  assert.deepStrictEqual(o.converted, [1, 12], "one strip, the box's default since PIPE-1b");
});

test("PIPE-1 / C 2 (pipe1/11, 12): an imported project file's binding is a binding of ours: its edge, its width, the file's strip pattern and its two seams; simulated as the file's (no rod); the report says so; its box's OK cuts it again as ours (the file's strip and seams go); a piping on a free edge stays the file's patterns", async () => {
  const { map, list, str, f32, u32, i32, bool } = MK;
  const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
  const sq = (x0, x1, y0, y1) => ({ points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], lines: ring(4) });
  const pl = (pat, from, to, r0, r1, fwd) => map({ uiSelfIndex: u32(pat), uiStartIndex: u32(from), uiEndIndex: u32(to), fRatioStart: f32(r0), fRatioEnd: f32(r1), bDirection: bool(fwd) });
  // a 200 mm square (pattern 0), a tube (1) and a strip (2) 200 × 6.35; the strip's two long lines sewn to the square's right line (seams 0, 1)
  const run = (pattern, from, fwd) => ({ pattern, from, to: from, r0: fwd ? 0 : 1, r1: fwd ? 1 : 0, forward: fwd });
  const seams = [{ name: "Top", a: [run(2, 0, true)], b: [run(0, 1, false)] }, { name: "Bottom", a: [run(2, 2, true)], b: [run(0, 1, true)] }];
  const extra = {
    listPiping: list([map({ qsName: str("Edge piping"), fDiameter: f32(3), listParamLine: list([pl(0, 3, 3, 0, 1, true)]), uiPipingPatternSelfIndex: u32(1), bIsClosedStart: bool(false), bIsClosedEnd: bool(false) })]),
    listInBinding: list([map({ qsName: str("Side binding"), fBindingDiameter: f32(6.35), listParamLine: list([pl(0, 1, 1, 1, 0, false)]), listBindingPatternSelfIndex: list([map({ uiBindingPatternSelfIndex: u32(2) })]),
      fBindingPatternLineLength: f32(200), iBindingFoldAngle: i32(180), iBindingFoldStrength: i32(5), bBindingTurned: bool(true),
      listBindingTopSLPGroupSelfIndex: list([map({ iBindingTopSLPGroupSelfIndex: i32(0) })]), listBindingBottomSLPGroupSelfIndex: list([map({ iBindingBottomSLPGroupSelfIndex: i32(1) })]) })]) };
  const r = await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([sq(-100, 100, -100, 100), sq(0, 200, 0, 9.42), sq(0, 200, 0, 6.35)], extra, { seams }) }));
  const asJSON = (x) => JSON.stringify(x, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
  const o = boot({ blank: true, script: `const r = ${asJSON(r)}; for (const im of r.images || []) im.bytes = new Uint8Array(im.bytes);
    const rep = app.ev("zprjTake")("file.zprj", r, {}), out = {}, P = (id) => S.pieces.find(p => p.id === id);
    const b = S.bindings[0];
    out.b = b && [S.bindings.length, b.name, Math.round(b.w*100)/100, b.pat.length, P(b.pat[0]) && P(b.pat[0]).segs.length, (b.sew || []).length, b.part.sids.length, P(b.part.piece).segs.findIndex(s => s.id === b.part.sids[0])];
    out.seamsOk = (b.sew || []).every(id => S.seams.some(s => s.id === id));
    out.rods = app.ev("bindingRods")(S.pieces.map(p => p.id)).length;
    out.rows = app.ev("zprjTrimRows")(rep.trimsIn, rep.bindingsIn);
    out.pipings = S.pipings.length;
    const n = S.pieces.length, ns = S.seams.length, strip = b.pat[0];
    app.answer = (t, f, op) => ({ w: 8, fabric: op.selects[0].val }); app.ev("bindingDialog")(b.part, b, { x: 0, y: 0 }); app.answer = null;
    out.ours = [b.pat.length, !P(strip), S.pieces.length - n, S.seams.length - ns, b.w];
    return out;` });
  assert.deepStrictEqual(o.b, [1, "Side binding", 6.35, 1, 4, 2, 1, 1]);
  assert.strictEqual(o.seamsOk, true); assert.strictEqual(o.rods, 0, "the file's strip simulates it");
  assert.ok(/came in as a binding/.test(o.rows[1]), o.rows[1]); assert.ok(/goes into a seam/.test(o.rows[0]), o.rows[0]);
  assert.strictEqual(o.pipings, 0, "the file's piping stays its patterns");
  // (PIPE-1b: OK'd with the box's default, one strip of ours for the file's one, two seams of ours for its two)
  assert.deepStrictEqual(o.ours, [1, true, 0, 0, 8], "one strip of ours for the file's one, two seams of ours for its two");
});

/* PIPE-1 / D 2: the T-shirt example on Marty, its front and back necklines bound, simulated. Its strips are cut pieces (archived) and the binding
   is simulated as its rod along the neckline: nothing of the garment inside the body (3 mm, the skin offset), every seam closed (2 mm), the
   binding as long along the neckline as it was cut (no bunching: at least 95 %, at most 110 %), each strip's edge line as long as its neckline. */
test("PIPE-1 / D 2: a T-shirt's necklines bound and simulated on Marty: nothing inside him, every seam closed, the binding along the neckline as long as cut (no bunching), the strips cut to the necklines", () => {
  const o = boot({ blank: true, three: true, script: `
    return (async () => { try {
      const out = {}, R = (n, ...a) => app.ev(n)(...a), G3 = app.G3;
      app.ev("setLayout")("both");
      app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av && S.av.preset === "marty", "Marty");
      app.ev("openExample")(app.ev("shippedExamples")().find(e => e.id === "tshirt-marty"), true); await app.wait(() => S.av && S.pieces.length, "the example");
      S.cloth = app.normCloth({ ...S.cloth, worker: false });
      const sewn = app.ev("segSewn"), mid = (p, i) => R("segPt", p, i, 0.5);
      for (const p of S.pieces.slice()) {
        if (!/front|back/i.test(p.name)) continue;
        let best = -1, by = 1e9;
        p.segs.forEach((s, i) => { if (!sewn(p, s.id) && mid(p, i).y < by) { by = mid(p, i).y; best = i; } });
        app.answer = (t, f, op) => ({ w: 10, fabric: op.selects[0].val, runOn: true, two: true }); R("bindingDialog", R("freeEdgePart", p, best, true), null, { x: 0, y: 0 }); app.answer = null;
      }
      out.n = [S.bindings.length, S.bindings.map(b => b.pat.length)];
      out.cut = S.bindings.map(b => { const g = S.pieces.find(p => p.id === b.part.piece), s = S.pieces.find(p => p.id === b.pat[0]), n = b.part.sids.length;
        let lg = 0, ls = 0; for (let k = 0; k < n; k++) { lg += R("segLen", g, g.segs.findIndex(x => x.id === b.part.sids[k])); ls += R("segLen", s, k); } return [Math.round(lg), Math.round(ls)]; });
      app.ev("garmentSync")();
      const SIM = app.ev("SIM"), C = app.ev("SIM3D");
      app.ev("simStart")(); for (let i = 0; i < 250; i++) app.ev("simFrame")();
      const sim = SIM.sim, x = sim.x, f = sim.field;
      let deep = 0; for (let i = 0; i < sim.n; i++) { const s = C.sdfAt(f, x[3*i], x[3*i+1], x[3*i+2]); if (-s > deep) deep = -s; }
      out.deep = Math.round(deep*10)/10;
      out.archived = S.bindings.every(b => b.pat.every(id => { const it = G3.items.get(id); return !it || !it.obj.visible; }));
      // the rod along each neckline: its length now against as cut
      const order = SIM.order, rods = R("bindingRods", order), pos = app.ev("anchorPos");
      out.rods = rods.map(rd => { let L = 0, L0 = 0; for (let j = 0; j + 1 < rd.a.length; j++) { const A = pos(rd.a[j], order, [0, 0, 0]), B = pos(rd.a[j + 1], order, [0, 0, 0]); L += Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2]); L0 += rd.S[j]; } return Math.round(L/L0*1000)/1000; });
      app.ev("simStop")();
      const seams = R("simSeams", order);
      out.gap = Math.max(...seams.filter(s => !s.skip).map(s => { let g = 0; for (const [a, b] of s.pairs) { const A = pos(a, order, [0, 0, 0]), B = pos(b, order, [0, 0, 0]); g = Math.max(g, Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2])); } return g; }));
      app.ev("garmentLines")();
      out.sweeps = app.view3d.group("trims").children.filter(c => c.userData.trim && c.userData.trim.kind === "binding").length;
      return out;
    } catch (e) { return { err: e.stack }; } })();` });
  assert.ok(!o.err, o.err);
  assert.deepStrictEqual(o.n, [2, [2, 2]]);
  for (const [g, s] of o.cut) near(s, g, 1, "a strip cut to its neckline");
  assert.ok(o.deep <= 3, "nothing inside Marty deeper than the skin offset: " + o.deep);
  assert.strictEqual(o.archived, true, "the strips are not cloth in 3D");
  assert.strictEqual(o.rods.length, 2);
  for (const r of o.rods) assert.ok(r >= 0.95 && r <= 1.1, "the binding as long as cut along the neckline (no bunching): " + o.rods);
  assert.ok(o.gap < 2, "every seam closed: " + o.gap);
  assert.strictEqual(o.sweeps, 2, "each drawn folded over its neckline");
});

module.exports = T;
