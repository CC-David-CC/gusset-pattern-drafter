// Run 16, the rest of Round IMP-1 (roadmap 1.S15a, 1.S28, 1.3c): more of a project file comes in. A: a fabric's stiffness (its ratios by
// direction), friction, and what is only named (damping, buckling). The files here are made by zprj-make.js from the layout in
// docs/zprj-format.md: no file of another program is used.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const ZPRJ = require("../zprj-import.js");
const MK = require("./zprj-make");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
const square = { points: [[-100, -100], [100, -100], [100, 100], [-100, 100]], lines: ring(4) };
// a fabric's mapPhysical as the files keep it: the newer keys and, for a second fabric, only the older ones
const PHYS = { fSuK: 330000, fSvK: 230000, fRightShearK_v2: 10000, fLeftShearK_v2: 9000, fBuK_v2: 314.1593, fBvK_v2: 1884.956, fBRightShearK_v2: 471.2389, fBLeftShearK_v2: 350,
  fFriction: 0.03, fIDS: 0.0001, fBuLR: 0.02, fBvLR: 0.01, fBhLR: 0.04, fBLeftShearLR: 0.05, fBucklingStiffnessU: 0.06, fBucklingStiffnessV: 0.07, fBucklingStiffnessH: 0.08, fBucklingStiffnessLeftShear: 0.09 };
const OLD = { fSuK: 100000, fSvK: 100000, fHK: 5000, fLeftShearK: 4500, fBuK: 100, fBvK: 600, fBhK: 150, fBLeftShearK: 111.4085 };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, (m || "") + " " + a + " vs " + b);

test("IMP-1b / A 1: the reader takes a fabric's stiffness rows (the newer keys, else the older ones as the files hold both: shear × 2, bending × π), its friction, internal damping and buckling rows; a fabric without them has none", async () => {
  const r = await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([square], null, { fabrics: [{ name: "Twill", phys: PHYS }, { name: "Older", phys: OLD }, { name: "Plain" }] }) }));
  const k = r.fabrics[0].physics;
  assert.deepStrictEqual([k.stretchWeft, k.stretchWarp, k.shearR, k.shearL].map(Math.round), [330000, 230000, 10000, 9000]);
  near(k.bendWeft, 314.159, 0.01); near(k.bendWarp, 1884.956, 0.01); near(k.bendBiasR, 471.239, 0.01); near(k.bendBiasL, 350, 0.01);
  near(k.friction, 0.03, 1e-6); near(k.damping, 0.0001, 1e-8);
  assert.deepStrictEqual(Object.keys(k.buckling).sort(), ["ratioBiasL", "ratioBiasR", "ratioWarp", "ratioWeft", "stiffBiasL", "stiffBiasR", "stiffWarp", "stiffWeft"]);
  near(k.buckling.stiffBiasL, 0.09, 1e-6);
  const o = r.fabrics[1].physics;
  assert.deepStrictEqual([o.shearR, o.shearL].map(Math.round), [10000, 9000], "the older shear keys × 2");
  near(o.bendWeft, 314.159, 0.01); near(o.bendBiasL, 350, 0.01);
  assert.strictEqual(r.fabrics[2].physics, undefined);
});

test("IMP-1b / A 2: imported, the library fabric keeps its preset's stiffness and takes the file's ratios by direction as its Detail shares (each set against its own geometric mean), its friction × 10, and the report names damping and buckling as not taken; a fabric with the same values every way gets no shares", () => {
  const k = { stretchWeft: 330000, stretchWarp: 230000, shearR: 10000, shearL: 9000, bendWeft: 314.1593, bendWarp: 1884.956, bendBiasR: 471.2389, bendBiasL: 350, friction: 0.03, damping: 0.0001,
    buckling: { ratioWeft: 0.02, ratioWarp: 0.01, ratioBiasR: 0.04, ratioBiasL: 0.05, stiffWeft: 0.06, stiffWarp: 0.07, stiffBiasR: 0.08, stiffBiasL: 0.09 } };
  const o = boot({ script: `
    const rep = { fabrics: [] }, res = { fabrics: [{ name: "Twill", type: "Woven", content: "", physics: ${JSON.stringify(k)} }, { name: "Even", type: "Woven", content: "", physics: { stretchWeft: 5, stretchWarp: 5, friction: 0.5 } }] };
    const pieces = [{ _zf: 0 }, { _zf: 1 }];
    app.ev("zprjFabrics")(res, pieces, rep);
    const f = (id) => S.lib.fabric.find(x => x.id === id), a = f(pieces[0].fabric), b = f(pieces[1].fabric);
    return { a: [a.physical, a.dir, a.friction, app.ev("fabricPhys")(a).stretch], b: [b.dir === undefined, b.friction], notes: rep.fabricNotes };` });
  assert.strictEqual(o.a[0], "Medium woven");
  const d = o.a[1];
  near(d.stretchWeft, 119.8, 0.1); near(d.stretchWarp, 83.5, 0.1); near(d.shearR, 105.4, 0.1); near(d.shearL, 94.9, 0.1);
  near(d.stretchWeft*d.stretchWarp, 10000, 20, "the mean kept");
  const g = Math.pow(314.1593*1884.956*471.2389*350, 0.25);
  near(d.bendWeft, 100*314.1593/g, 0.1); near(d.bendWarp, 100*1884.956/g, 0.1); near(d.bendBiasR, 100*471.2389/g, 0.1); near(d.bendBiasL, 100*350/g, 0.1);
  assert.strictEqual(d.damping, undefined, "internal damping not taken");
  near(o.a[2], 0.3, 1e-9);
  assert.strictEqual(o.a[3], 4e6, "the preset's own stretch stays");
  assert.deepStrictEqual(o.b, [true, 1.5]);
  assert.strictEqual(o.notes.length, 1);
  assert.ok(/^Twill: Internal Damping 1 not taken/.test(o.notes[0]) && /Buckling Weft 2 \/ 6, Warp 1 \/ 7, Bias \(Right\) 4 \/ 8, Bias \(Left\) 5 \/ 9/.test(o.notes[0]), o.notes[0]);
});

/* ---------- B: what lies on the patterns ---------- */
const { map, list, str, u32, i32, f32, v2, bool } = MK;
const sq = (x0, x1, y0, y1) => ({ points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], lines: ring(4) });
const center = (pat, x, y) => list([map({ mapCenter: map({ uiPatternSelfIndex: u32(pat), v2LocalPosition: v2(x, y) }) })]);
// a pattern with a topstitch on its line 2 (index 1), a buttonhole, a button pattern on it, a trim object, two topstitch styles, a textured fabric
function onFile() {
  const front = { ...square, fabric: 0, shapeMore: { listDecorStitch: list([map({ mapElement: map({ qsName: str("Edge stitch"), uiID: u32(77) }), mapParamLine: map({ uiSelfIndex: u32(0), uiStartIndex: u32(1), uiEndIndex: u32(1), fRatioStart: f32(0), fRatioEnd: f32(1), bDirection: bool(true) }), fThickOffset: f32(0.5) })]) },
    more: { listPrintTexture: list([map({ bButtonHole: bool(true), fAngle: f32(90), mapButtoneBase: map({ listButtonSewingArea: center(0, -10, 20) }), mapPrintTexture: map({ v2TextureSize: v2(25, 5) }) })]) } };
  const button = { ...sq(0, 1, 0, 1), more: { listButtonSewingArea: center(0, 30, 20), uiButtonHeadStyleIndex: u32(0) } };
  const row = (on) => map({ bEnableFlag: bool(on), fStitchLength: f32(2.54), fThreadThickness: f32(0.25), fStitchDistance: f32(4) });
  const root = {
    listTopStitchStyleProperty: list([map({ mapElement: map({ uiID: u32(4), qsName: str("Other") }), mapMultiStitch: map({ fAddtionalOffset: f32(9), listStitch: list([row(true)]) }) }),
      map({ mapElement: map({ uiID: u32(5), qsName: str("Twin needle") }), mapMultiStitch: map({ fAddtionalOffset: f32(2), listStitch: list([row(true), row(true), row(false)]) }) })]),
    mapColorWay: map({ mapNewColorway: map({ listColorway: list([map({ mapAssign: map({ listThickParametricLineToTopStitchStyle: list([map({ uiItemID: u32(77), uiStyleID: u32(5) })]) }) })]) }) }),
    listButtonHeadStyleMap: list([map({ mapButtonStyleBase: map({ fObjWidth: f32(18), fThickness: f32(3) }) })]), listButtonHeadStyle: list([map({ qsName: str("Shirt.btn") })]) };
  return MK.zprj([], { pac: MK.pac([front, button], { listTrimObject: list([map({ qsTrimName: str("Bead"), fMass: f32(2) })]) }, { root, fabrics: [{ name: "Printed", tex: { file: "print.png", w: 120, h: 80 } }] }), files: [{ name: "print.png", data: MK.png(2, 2, [0, 0, 255, 255]) }] });
}
const asJSON = (r) => JSON.stringify(r, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const TAKE = (r) => `const r = ${asJSON(r)}; for (const im of r.images || []) im.bytes = new Uint8Array(im.bytes);
  const rep = app.ev("zprjTake")("file.zprj", r, {}), P = (id) => S.pieces.find(p => p.id === id);
  const start = (pt) => { const p = P(pt.piece), id = pt.rev ? pt.sids[pt.sids.length - 1] : pt.sids[0], i = p.segs.findIndex(s => s.id === id); return app.ev("segPt")(p, i, pt.rev ? pt.t1 : pt.t0); };
  const end = (pt) => { const p = P(pt.piece), id = pt.rev ? pt.sids[0] : pt.sids[pt.sids.length - 1], i = p.segs.findIndex(s => s.id === id); return app.ev("segPt")(p, i, pt.rev ? pt.t0 : pt.t1); };`;

test("IMP-1b / B 1: the reader takes a pattern's topstitches (name, id, stretch, offset), its buttonholes (middle, size, turn), a button pattern as a button (left out of the patterns and of the count), the styles and their assignment, a trim object, the fabric's front picture with its repeat", async () => {
  const r = await ZPRJ.importZprj(onFile());
  assert.strictEqual(r.pieces.length, 1); assert.strictEqual(r.total, 1, "the button is not a pattern");
  assert.deepStrictEqual(r.pieces[0].stitches.map(s => [s.name, s.id, s.from, s.to, s.r0, s.r1, s.forward, s.off]), [["Edge stitch", 77, 1, 1, 0, 1, true, 0.5]]);
  const h = r.pieces[0].buttonholes[0];
  assert.deepStrictEqual([h.pattern, h.at, h.w, h.h, h.angle], [0, [-10, 20], 25, 5, 90]);
  assert.deepStrictEqual(r.buttons.map(b => [b.index, b.pattern, b.at, b.style]), [[1, 0, [30, 20], 0]]);
  assert.deepStrictEqual(r.styles.assign, [[77, 5]]);
  const t = r.styles.topstitch.find(s => s.id === 5);
  assert.deepStrictEqual([t.name, t.offset, t.rows.length], ["Twin needle", 2, 2], "only the rows switched on");
  assert.deepStrictEqual(r.styles.button.map(b => [b.name, b.width, b.thickness]), [["Shirt", 18, 3]]);
  assert.deepStrictEqual(r.trims.trims.map(x => [x.name, x.mass]), [["Bead", 2]]);
  assert.deepStrictEqual([r.fabrics[0].tex.file, r.fabrics[0].tex.w, r.fabrics[0].tex.h], ["print.png", 120, 80]);
  assert.ok(r.images.some(im => im.file === "print.png" && im.w === 2), "the fabric's picture is read with the graphics'");
});

test("IMP-1b / B 2: imported, the topstitch is ours on its line (its style's offset plus the line's, 10 stitches to the inch from 2.54 mm, thread, two rows 4 mm apart; the style into the library once), the button and the buttonhole on the pattern as far apart as in the file (the buttonhole turned as there, its length its type's width), the fabric's texture with its repeat, the trim named", async () => {
  const r = await ZPRJ.importZprj(onFile());
  const o = boot({ script: TAKE(r) + `
    const st = S.stitches[0], b = S.buttons.find(x => x.kind === "button"), h = S.buttons.find(x => x.kind === "hole"), fab = S.lib.fabric.find(f => f.tex);
    return { st: [S.stitches.length, st.name, st.offset, st.spi, st.thread, st.count, st.gap, st.part.sids.length, st.preset], lib: S.lib.topstitch.filter(t => t.name === "Twin needle").map(t => [t.offset, t.length, t.thread, t.lines]),
      bt: [b.x - h.x, b.y - h.y, h.angle, S.lib.button.find(t => t.id === b.lib).width, S.lib.buttonhole.find(t => t.id === h.lib).width, b.piece === h.piece],
      tex: fab ? [fab.name, fab.tex.w, fab.tex.h, !!S.images.find(i => i.id === fab.tex.img)] : null, rows: app.ev("zprjTrimRows")(rep.trimsIn), rep: [rep.stitches, rep.buttons, rep.textures] };` });
  assert.deepStrictEqual(o.st, [1, "Edge stitch", 2.5, 10, 0.25, 2, 4, 1, "Twin needle"]);
  assert.deepStrictEqual(o.lib, [[2.5, 2.54, 0.25, 2]]);
  near(o.bt[0], 40, 1e-6, "40 mm apart across"); near(o.bt[1], 0, 1e-6, "level");
  near(Math.min(Math.abs(o.bt[2] - 90), Math.abs(o.bt[2] - 270)), 0, 1e-6, "turned upright, as in the file");
  assert.deepStrictEqual(o.bt.slice(3), [18, 25, true]);
  assert.deepStrictEqual(o.tex, ["Printed", 120, 80, true]);
  assert.deepStrictEqual(o.rows, ["Trims not imported (no trim objects here yet): Bead (2 g)"]);
  assert.deepStrictEqual(o.rep[0], ["Edge stitch on Pattern"]);
});

// two garment patterns side by side with a zipper between them: each tape sewn to a garment edge, the tapes to each other, all upward
function zipFile() {
  const A = sq(-100, 100, -100, 100), T1 = { ...sq(100, 105, -100, 100), tape: true }, T2 = { ...sq(105, 110, -100, 100), tape: true }, B = sq(110, 310, -100, 100);
  const run = (pattern, line, fwd) => ({ pattern, from: line, to: line, r0: fwd ? 0 : 1, r1: fwd ? 1 : 0, forward: fwd });
  const seams = [{ name: "a-tape", a: [run(0, 1, true)], b: [run(1, 3, false)] }, { name: "teeth", a: [run(1, 1, true)], b: [run(2, 3, false)] }, { name: "tape-b", a: [run(2, 1, true)], b: [run(3, 3, false)] }];
  return MK.zprj([], { pac: MK.pac([A, T1, T2, B], { listZipper: list([map({ qsName: str("Fly"), uiStyleUID: u32(9) })]) }, { seams, root: { listZipperStyle: list([map({ uiID: u32(9), qsName: str("Metal fly"), fTeethWidth: f32(4), fTapeWidth: f32(7) })]) } }) });
}
test("IMP-1b / B 3: a zipper whose tapes are sewn to two garment edges and to each other comes in as one zipper seam between those edges, both sides running the same way (start beside start, end beside end), the tape seams not sewn and not counted, its style as a library zipper; turned the other way in the file, the same", async () => {
  for (const flip of [false, true]) {
    const r = await ZPRJ.importZprj(zipFile());
    if (flip) { const t = r.seams.list[0]; t.a = t.a.map(x => ({ ...x, forward: !x.forward, r0: x.r1, r1: x.r0 })); t.b = t.b.map(x => ({ ...x, forward: !x.forward, r0: x.r1, r1: x.r0 })); }
    const o = boot({ blank: true, script: TAKE(r) + `
      const z = S.seams.filter(s => s.zip);
      return { n: [S.pieces.length, S.seams.length, z.length, rep.seams, rep.seamsTotal, rep.seamLeft, rep.zippers], ends: z.map(s => [start(s.a[0]), start(s.b[0]), end(s.a[0]), end(s.b[0])]), lib: S.lib.zipper.map(t => [t.name, t.teethW, t.tapeW]), names: z.map(s => s.zip.name) };` });
    assert.deepStrictEqual(o.n, [2, 1, 1, 0, 0, [], ["Fly"]], (flip ? "flipped: " : "") + JSON.stringify(o.n));
    const [[a0, b0, a1, b1]] = o.ends;
    near(a0.y, b0.y, 0.01, "start beside start"); near(a1.y, b1.y, 0.01, "end beside end"); assert.ok(Math.abs(a0.y - a1.y) > 150);
    assert.ok(o.lib.some(t => t[0] === "Metal fly" && t[1] === 4 && t[2] === 7), JSON.stringify(o.lib));
    assert.deepStrictEqual(o.names, ["Fly"]);
  }
});

/* ---------- C: piping and binding ---------- */
test("IMP-1b / C 1: the reader takes a piping (name, diameter, its edge stretches, its tube pattern, its seams, closed ends) and a binding (name, width, edge, strip pattern, length, fold angle and strength, turned, top and bottom seams); the report names them as come in as their own patterns", async () => {
  const pl = (pat, from, to, r0, r1, fwd) => map({ uiSelfIndex: u32(pat), uiStartIndex: u32(from), uiEndIndex: u32(to), fRatioStart: f32(r0), fRatioEnd: f32(r1), bDirection: bool(fwd) });
  const extra = {
    listPiping: list([map({ qsName: str("Edge piping"), fDiameter: f32(3), listParamLine: list([pl(0, 3, 3, 0, 1, true)]), uiPipingPatternSelfIndex: u32(1), arrPipingSeamLinePairGroup: MK.ints([0, 1]), bIsClosedStart: bool(false), bIsClosedEnd: bool(true) })]),
    listInBinding: list([map({ qsName: str("Neck binding"), fBindingDiameter: f32(6.35), listParamLine: list([pl(0, 1, 1, 1, 0, false)]), listBindingPatternSelfIndex: list([map({ uiBindingPatternSelfIndex: u32(2) })]),
      fBindingPatternLineLength: f32(200), iBindingFoldAngle: i32(180), iBindingFoldStrength: i32(5), bBindingTurned: bool(true),
      listBindingTopSLPGroupSelfIndex: list([map({ iBindingTopSLPGroupSelfIndex: i32(2) })]), listBindingBottomSLPGroupSelfIndex: list([map({ iBindingBottomSLPGroupSelfIndex: i32(3) })]) })]) };
  const r = await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([square, sq(0, 200, 0, 9.42), sq(0, 200, 0, 6.35)], extra) }));
  const p = r.trims.pipings[0], b = r.trims.bindings[0];
  assert.deepStrictEqual([p.name, p.d, p.pattern, p.seams, p.closed, p.lines.map(l => [l.pattern, l.from, l.to, l.forward])], ["Edge piping", 3, 1, [0, 1], [false, true], [[0, 3, 3, true]]]);
  near(b.w, 6.35, 1e-5);
  assert.deepStrictEqual([b.name, b.pattern, b.length, b.fold, b.strength, b.turned, b.top, b.bottom], ["Neck binding", 2, 200, 180, 5, true, 2, 3]);
  const o = boot({ script: `return app.ev("zprjTrimRows")(${JSON.stringify(r.trims)});` });
  // (Round PIPE-1, pipe1/11: the piping's row says why it stays the file's patterns; a binding not made one of ours, as here with no
  // import, keeps its words: PIPE-1 / C 2 has the one that comes in as ours)
  assert.deepStrictEqual(o, ["Piping Edge piping: 3 mm across, came in as its own tube pattern and the 2 seams that sew it on (Piping here goes into a seam between two patterns)", "Binding Neck binding: 6.35 mm wide, 200 mm long, came in as its own strip pattern and the seams that sew it on (its fold 180° is not set here)"]);
});

test("IMP-1b / A 3 (guess imp1b/4): a library fabric of the file's fabric's name that is still a new document's untouched default takes the file's values, its id and place kept; one that was changed is used as it is (IMP-1 / A as before)", () => {
  const o = boot({ blank: true, script: `
    const L = S.lib, def = L.fabric[0], id = def.id, name = def.name, n = L.fabric.length;
    const res = (nm) => ({ fabrics: [{ name: nm, type: "Woven", content: "", color: "#112233", weight: 210, physics: { stretchWeft: 2, stretchWarp: 1 } }] });
    const p1 = [{ _zf: 0 }]; app.ev("zprjFabrics")(res(name), p1, { fabrics: [] });
    const a = L.fabric[0], took = [p1[0].fabric === id, a.id === id, L.fabric.length === n, a.color, a.weight, !!a.dir];
    a.color = "#abcdef";                                       // changed by hand: the next import of that name leaves it
    const p2 = [{ _zf: 0 }]; app.ev("zprjFabrics")(res(name), p2, { fabrics: [] });
    return { took, kept: [p2[0].fabric === id, L.fabric[0].color, L.fabric.length === n] };` });
  assert.deepStrictEqual(o.took, [true, true, true, "#112233", 210, true]);
  assert.deepStrictEqual(o.kept, [true, "#abcdef", true]);
});

module.exports = T;
