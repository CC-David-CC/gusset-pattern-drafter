// Run 14c, roadmap 1.T45: 3D Pen (Avatar), Edit 3D Pen (Avatar), 3D Pencil (Avatar): lines drawn on the avatar's skin, the document's
// (S.avedit.pens), each point a place on the skin, so a line follows the avatar's pose, size and place.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
// Marty loaded; near(x, y, z): the place on the skin nearest that point; sd(p): the body's field there
const START = `
  const out = {}, R = (n, ...a) => app.ev(n)(...a), TH = app.ev("THREE"), G3 = app.G3;
  app.ev("setLayout")("both");
  app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
  const near = (x, y, z) => R("skinNear", new TH.Vector3(x, y, z));
  const sd = (p) => app.ev("SIM3D").sdfSample(R("avatarField", S.av), p[0], p[1], p[2], [0, 0, 0]);
  const at = (a) => R("skinAt", a, R("avPos", S.av, false));
`;

test("t45 / 1: a line drawn on the avatar is one step, lies on the skin (PEN_LIFT off it), runs taut over it; it follows the avatar when it moves; undo, redo and the file keep it exactly", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const a = near(-120, 1350, 300), b = near(120, 1350, 300);
      const steps = S.un.length;
      R("penAdd", [a, b], false);
      const ln = S.avedit.pens[0], r = R("penGeom", ln);
      out.made = [S.avedit.pens.length, ln.id, ln.name, !!ln.closed, S.un.length - steps, S.un[S.un.length - 1].n, G3.penSel && G3.penSel.id];
      const ds = r.pts.map(sd);
      out.lift = [Math.min(...ds), Math.max(...ds)];
      out.len = [r.len, Math.hypot(...[0, 1, 2].map(c => at(a)[c] - at(b)[c]))];
      out.x0 = r.pts[0][0];
      app.push("Place"); S.avedit = R("normAvEdit", { ...S.avedit, place: { x: 100 } }); app.commit();
      const r2 = R("penGeom", S.avedit.pens[0]);
      out.x1 = r2.pts[0][0]; out.lift2 = Math.max(...r2.pts.map(p => Math.abs(sd(p) - 1)));
      app.undo(); app.undo();
      out.undone = !!S.avedit.pens;
      app.ev("redo")();
      out.redone = app.ev("canonJSON")(S.avedit.pens) === app.ev("canonJSON")([ln]);
      const doc = JSON.parse(app.ev("docJSON")());
      out.file = [!!doc.avedit.pens, app.ev("canonJSON")(R("normAvEdit", doc.avedit)) === app.ev("canonJSON")(S.avedit), R("avEditOn")];
      // what normAvPens() refuses: a point that is not a place, a line of one point, two of one id
      out.norm = R("normAvPens", [{ id: 1, pts: [a, { v: [1], w: [1] }] }, { id: 2, pts: [a, b], closed: true }, { id: 2, pts: [a, b] }, { id: 3, name: " ", pts: [a, b, near(0, 1200, 300)], closed: true }]).map(l => [l.id, l.pts.length, !!l.closed, l.name]);
      return out;
    });` });
  assert.deepStrictEqual(o.made, [1, 1, "Avatar Line 1", false, 1, "3D Pen (Avatar)", 1]);
  assert.ok(o.lift[0] > 0.3 && o.lift[1] < 2.5, "every point about PEN_LIFT off the skin: " + o.lift);
  assert.ok(o.len[0] >= o.len[1] - 1 && o.len[0] < 1.5*o.len[1], "along the skin, a little longer than straight: " + o.len);
  assert.ok(Math.abs(o.x1 - o.x0 - 100) < 2, "it went with the avatar: " + [o.x0, o.x1]);
  assert.ok(o.lift2 < 1.5, "still on the skin: " + o.lift2);
  assert.strictEqual(o.undone, false);
  assert.strictEqual(o.redone, true);
  assert.deepStrictEqual(o.file, [true, true, true]);
  assert.deepStrictEqual(o.norm, [[2, 2, false, "Avatar Line 2"], [3, 3, true, "Avatar Line 3"]], "a closed line of two points is open; an empty name is the default");
});

test("t45 / 2: 3D Pen (Avatar)'s draft: Delete takes the last point back, Esc gives it up, Enter ends it (two points or more); a curve point makes a smooth curve; the garment is see-through while a pen is in hand; Edit 3D Pen (Avatar)'s commands are one step each", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      app.setTool3("pen_avatar");
      out.see = [R("penSee"), R("penTool")];
      const p = (x, y, z, c) => { const at = near(x, y, z); return { p: new TH.Vector3(...R("skinAt", at, R("avPos", S.av, false))), at, ...(c ? { c: true } : {}) }; };
      G3.penDraft = { pts: [p(-120, 1350, 300), p(0, 1300, 300, true)] };
      app.key("Delete"); out.back = G3.penDraft.pts.length;
      app.key("Enter"); out.one = [!!S.avedit.pens, R("penKey", "enter")];       // one point: not a line
      G3.penDraft.pts.push(p(0, 1300, 300, true), p(120, 1350, 300));
      app.key("Enter");
      const ln = S.avedit.pens[0];
      out.line = [ln.pts.length, !!ln.pts[1].c, G3.penDraft];
      // the curve point: its span is a curve, not two taut lines meeting at a corner
      const r = R("penGeom", ln), st = R("penGeom", { ...ln, pts: ln.pts.map(q => ({ v: q.v, w: q.w })) });
      out.samples = [r.pts.length > 2*12, r.len, st.len];
      G3.penDraft = { pts: [p(0, 1000, 300)] }; app.key("Escape"); out.esc = [G3.penDraft, S.avedit.pens.length];
      // Edit 3D Pen (Avatar)
      app.setTool3("edit_pen_avatar");
      const n0 = S.un.length, id = ln.id;
      R("penPointKind", id, 1); out.kind = [S.avedit.pens[0].pts[1].c, S.un[S.un.length - 1].n];
      R("penSetClosed", id, true); out.closed = S.avedit.pens[0].closed;
      R("penDeletePoint", id, 0); out.del = [S.avedit.pens[0].pts.length, !!S.avedit.pens[0].closed];
      out.steps = S.un.length - n0;
      app.undo(); app.undo(); app.undo();
      out.back3 = app.ev("canonJSON")(S.avedit.pens) === app.ev("canonJSON")([ln]);
      S.over3d = true; G3.penSel = { id }; app.key("Delete"); out.gone = [!!S.avedit.pens, S.un[S.un.length - 1].n];
      app.undo();
      app.setTool3("select_move"); out.off = [R("penSee"), G3.penDraft];
      return out;
    });` });
  assert.deepStrictEqual(o.see, [true, true]);
  assert.strictEqual(o.back, 1);
  assert.deepStrictEqual(o.one, [false, true], "one point: Enter says so and makes nothing");
  assert.deepStrictEqual(o.line, [3, true, null]);
  assert.ok(o.samples[0], "sampled as a curve: " + JSON.stringify(o.samples));
  assert.ok(Math.abs(o.samples[1] - o.samples[2]) > 0.5, "the curve differs from the taut corner: " + o.samples);
  assert.deepStrictEqual(o.esc, [null, 1]);
  assert.deepStrictEqual(o.kind, [null, "Convert to Segment Point"]);
  assert.strictEqual(o.closed, true);
  assert.deepStrictEqual(o.del, [2, false], "two points left: the line is open again");
  assert.strictEqual(o.steps, 3);
  assert.strictEqual(o.back3, true);
  assert.deepStrictEqual(o.gone, [false, "Delete Avatar Line"]);
  assert.deepStrictEqual(o.off, [false, null]);
});

test("t45 / 4: 3D Pencil (Avatar): a stroke's corner and ends become segment points, its bends curve points; a stroke that comes back to its start is a closed line; Convert to 3D Pen is one step and puts Edit 3D Pen (Avatar) in hand; Symmetry mirrors a stroke across the avatar's middle (Erase: the browser smoke, with the real mouse)", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      // a sample where a ray from in front meets the skin, as the pointer's does
      const smp = (x, y) => { const h = R("skinHit", { rc: new TH.Raycaster(new TH.Vector3(x, y, 800), new TH.Vector3(0, 0, -1)) }); return { p: [h.p.x, h.p.y, h.p.z], at: h.at }; };
      // an L: across the chest, then straight down
      const L = []; for (let x = -100; x <= 0; x += 5) L.push(smp(x, 1350)); for (let y = 1345; y >= 1250; y -= 5) L.push(smp(0, y));
      const pl = R("pencilPlan", L);
      out.L = [pl.closed, pl.pts.filter(x => !x.c).map(x => x.k)];
      out.Lcorner = L[pl.pts.filter(x => !x.c)[1].k].p;
      // a loop round on the chest, back to its start
      const O = []; for (let a = 0; a <= 360; a += 10) O.push(smp(60*Math.cos(a*Math.PI/180), 1300 + 60*Math.sin(a*Math.PI/180)));
      const po = R("pencilPlan", O);
      out.O = [po.closed, po.pts.filter(x => x.c).length > 3];
      app.setTool3("pencil_avatar");
      out.panel = !!app.ev("document").getElementById("pencil3d");
      G3.pencil = { strokes: [L, O] };
      const n0 = S.un.length;
      R("pencilConvert");
      const ls = S.avedit.pens;
      out.conv = [ls.length, !!ls[0].closed, !!ls[1].closed, S.un.length - n0, S.un[S.un.length - 1].n, S.tool3, G3.pencil.strokes.length];
      app.undo(); out.undone = !!S.avedit.pens;
      // Symmetry: the mirror image of the L's first sample lies across the middle
      const mx = R("pencilMid"), m = R("pencilMirror", L);
      out.mir = [m.length === L.length, m[0].p[0] - mx, L[0].p[0] - mx];
      return out;
    });` });
  assert.strictEqual(o.L[0], false);
  assert.strictEqual(o.L[1].length, 3, "the two ends and the corner: " + o.L[1]);
  assert.ok(Math.abs(o.Lcorner[0]) < 12 && Math.abs(o.Lcorner[1] - 1350) < 12, "the corner where the stroke turned: " + o.Lcorner);
  assert.deepStrictEqual(o.O, [true, true], "a loop: closed, curve points round it");
  assert.strictEqual(o.panel, true);
  assert.deepStrictEqual(o.conv, [2, false, true, 1, "Convert to 3D Pen", "edit_pen_avatar", 0]);
  assert.strictEqual(o.undone, false);
  assert.ok(o.mir[0] && Math.abs(o.mir[1] + o.mir[2]) < 12, "mirrored across the middle: " + o.mir);
});

test("t45 / 5: (run 14d, the maintainer's answer to run 14c's Q5) 3D Pencil strokes not yet converted are saved with the project: saved, opened on a fresh document they are back on the avatar where they were, still convertible; saved again the same bytes; a change marks unsaved work; a new document has none", () => {
  const o = boot({ blank: true, three: true, streams: false, script: START + `
    const saveBytes = () => { let got = null; app.setDownload((n, b) => { got = b; }); app.saveDoc(false); app.setDownload(null); return got; };
    return app.wait(() => S.av, "Marty").then(() => {
      const smp = (x, y) => { const h = R("skinHit", { rc: new TH.Raycaster(new TH.Vector3(x, y, 800), new TH.Vector3(0, 0, -1)) }); return { p: [h.p.x, h.p.y, h.p.z], at: h.at }; };
      const L = []; for (let x = -100; x <= 0; x += 5) L.push(smp(x, 1350)); for (let y = 1345; y >= 1250; y -= 5) L.push(smp(0, y));
      const O = []; for (let a = 0; a <= 360; a += 10) O.push(smp(60*Math.cos(a*Math.PI/180), 1300 + 60*Math.sin(a*Math.PI/180)));
      app.setTool3("pencil_avatar");
      S.dirty = false;
      G3.pencil = { strokes: [L] };
      // a stroke drawn as the pointer draws it: up() keeps it and marks unsaved work
      G3.pencilCur = O.map(s => ({ ...s, sx: 0, sy: 0 })); app.TOOL3.pencil_avatar.up();
      out.drawn = [R("pencilStrokes").length, S.dirty, S.un.length];
      const was = R("pencilStrokes").map(st => st.map(s => s.p));
      const b1 = saveBytes(), doc = app.fileDoc(b1);
      out.inFile = [Array.isArray(doc.pencil), doc.pencil && doc.pencil.length, doc.pencil && doc.pencil[0].length === L.length];
      // (the fake page cannot load a preset a second time: the file is opened over the same Marty, the strokes taken away first)
      G3.pencil = { strokes: [] };
      app.ev("openFile")("p.pdraft", b1, null, true);
      return app.wait(() => S.av && R("pencilStrokes").length === 2, "the strokes back").then(() => {
        const now = R("pencilStrokes").map(st => st.map(s => s.p));
        let d = 0; now.forEach((st, k) => st.forEach((p, i) => { d = Math.max(d, Math.hypot(p[0] - was[k][i][0], p[1] - was[k][i][1], p[2] - was[k][i][2])); }));
        out.where = [now.map(st => st.length).join() === was.map(st => st.length).join(), d];
        const b2 = saveBytes(); out.same = b1.length === b2.length && b1.every((x, i) => x === b2[i]);
        // still convertible
        R("pencilConvert");
        out.conv = [S.avedit.pens.length, !!S.avedit.pens[1].closed, R("pencilStrokes").length, "pencil" in JSON.parse(app.ev("docJSON")())];
        // what normPencil() refuses: a place that is not one, a stroke of one place
        app.undo(); G3.pencil = { strokes: [L, O] }; R("blankDoc"); out.blank = R("pencilStrokes").length;
        out.norm = R("normPencil", [[{ v: [1, 2, 3], w: [1, 0, 0] }, { v: [1, 2], w: [1, 0] }], [{ v: [4, 5, 6], w: [0.5, 0.5, 0] }, { v: [4, 5, 6], w: [0, 1, 0] }], "x"]).map(st => st.length);
        return out;
      });
    });` });
  assert.deepStrictEqual(o.drawn.slice(0, 2), [2, true], "the stroke kept; unsaved work");
  assert.deepStrictEqual(o.inFile, [true, 2, true]);
  assert.strictEqual(o.blank, 0, "a new document has none");
  assert.strictEqual(o.where[0], true, "every place of every stroke back");
  // (the test's samples are the skin hits themselves; reopened, a sample is laid PEN_LIFT off the skin as a drawn stroke's is)
  assert.ok(o.where[1] < 3, "back where they were drawn: " + o.where[1]);
  assert.strictEqual(o.same, true, "saved again: the same bytes");
  assert.deepStrictEqual(o.conv, [2, true, 0, false]);
  assert.deepStrictEqual(o.norm, [2], "only the stroke of two places");
});

test("3.E4 / 1: Flatten: two closed shapes on Marty's chest sharing two corners become two patterns (one step), each flat outline as long as its line on the skin, a segment point at each of the line's points; sewn where they share the corners; arranged and draped where they were drawn; undone exactly", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const hit = (x, y) => R("skinHit", { rc: new TH.Raycaster(new TH.Vector3(x, y, 800), new TH.Vector3(0, 0, -1)) }).at;
      const tl = hit(-110, 1420), tm = hit(0, 1420), tr = hit(110, 1420), bl = hit(-110, 1260), bm = hit(0, 1260), br = hit(110, 1260);
      R("penAdd", [tl, tm, bm, bl], true); R("penAdd", [tm, tr, br, bm], true);
      const L = S.avedit.pens, lens = L.map(l => R("penGeom", l).len);
      app.setTool3("flatten");
      out.see = R("penSee");
      G3.flatSel = new Set(L.map(l => l.id));
      const n0 = S.un.length, p0 = S.pieces.length, s0 = S.seams.length;
      const plan = R("flattenPlan", L[0]); out.dev = plan.dev;
      app.key("Enter");
      const made = S.pieces.slice(p0);
      out.made = [made.length, S.un.length - n0, S.un[S.un.length - 1].n, made.map(p => p.name), made.map(p => p.pts.length), S.seams.length - s0, JSON.stringify(S.sel) === JSON.stringify(made.map(p => p.id))];
      // each outline as long as its line on the skin
      out.per = made.map((p, k) => { let s = 0; for (let i = 0; i < p.segs.length; i++) s += R("segLen", p, i); return [s, lens[k]]; });
      out.p3 = made.map(p => !!p.p3 && p.p3.pos.every(Number.isFinite));
      // the cloth made where it was drawn: its middle in front of the chest, a few mm off the skin
      out.cloth = made.map(p => { const it = G3.items.get(p.id); if (!it) return null; let c = [0, 0, 0], n = it.X.length/3, near = 0; for (let i = 0; i < it.X.length; i += 3) { for (let k = 0; k < 3; k++) c[k] += it.X[i+k]/n; near = Math.max(near, Math.abs(sd([it.X[i], it.X[i+1], it.X[i+2]]))); } return [c.map(Math.round), near]; });
      // the seam: the two patterns' shared stretch
      const sm = S.seams[S.seams.length - 1]; out.seam = sm ? [sm.a[0].piece, sm.b[0].piece].sort().join() === made.map(p => p.id).sort().join() : false;
      app.undo(); out.undone = [S.pieces.length - p0, S.seams.length - s0];
      // a line that is not closed: refused, nothing done
      R("penAdd", [tl, tr], false);
      out.open = R("flattenPlan", S.avedit.pens[S.avedit.pens.length - 1]).err;
      return out;
    });` });
  assert.strictEqual(o.see, true);
  assert.ok(o.dev < 0.05, "the chest lies nearly flat: " + o.dev);
  assert.deepStrictEqual(o.made.slice(0, 3), [2, 1, "Flatten"]);
  assert.deepStrictEqual(o.made[3], ["Avatar Line 1", "Avatar Line 2"]);
  assert.deepStrictEqual(o.made[4], [4, 4], "a segment point at each of the line's four points");
  assert.strictEqual(o.made[5], 1, "one seam where they share two corners");
  assert.strictEqual(o.made[6], true, "the new patterns selected");
  for (const [flat, skin] of o.per) assert.ok(Math.abs(flat - skin)/skin < 0.03, "the outline as long as the line on the skin: " + [flat, skin]);
  assert.deepStrictEqual(o.p3, [true, true]);
  for (const c of o.cloth) { assert.ok(c, "the cloth made"); assert.ok(c[0][1] > 1250 && c[0][1] < 1430 && c[0][2] > 50, "in front of the chest: " + c[0]); assert.ok(c[1] < 6, "FLAT_LIFT off the skin: " + c[1]); }
  assert.strictEqual(o.seam, true);
  assert.deepStrictEqual(o.undone, [0, 0]);
  assert.ok(/not closed/.test(o.open), o.open);
});

test("3.A16 / 1: avatar tapes: a Circumference Avatar Tape is the skin's loop through its three places, a Linear one runs over the skin; the pens do not see them nor the tape tools the pens' lines; Attach to Measure holds a pattern's line onto a tape (one step, undone): the solver gets a hold for each place along the line, each on the tape a cloth's thickness off the skin, as far along as along the line", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const hit = (x, y) => R("skinHit", { rc: new TH.Raycaster(new TH.Vector3(x, y, 800), new TH.Vector3(0, 0, -1)) }).at;
      // the waist round: three places across its front, level (the plane through them cuts the body round the waist)
      R("penAdd", [hit(-80, 1100), hit(0, 1100), hit(80, 1100)], false, "circ");
      const tp = S.avedit.pens[0], r = R("penGeom", tp);
      out.circ = [tp.tape, tp.name, r.loop, r.len, S.un[S.un.length - 1].n, Math.max(...r.pts.map(p => Math.abs(sd(p) - 1)))];
      R("penAdd", [hit(-100, 1300), hit(100, 1300)], false, "line");
      out.line = [S.avedit.pens[1].tape, R("penGeom", S.avedit.pens[1]).loop || false];
      R("penAdd", [hit(-50, 1400), hit(50, 1400)], false);
      app.setTool3("pen_avatar"); out.penSees = R("penOwn").map(l => l.id);
      app.setTool3("edit_avatar_tape"); out.tapeSees = R("penOwn").map(l => l.id);
      // a band in front of the waist, its top line attached to the waist tape
      app.push("Band"); const P = R("mkPiece", "Band", R("mkShape", [{ x: -150, y: -1150 }, { x: 150, y: -1150 }, { x: 150, y: -1050 }, { x: -150, y: -1050 }], true)); S.pieces.push(P); app.commit();
      const n0 = S.un.length;
      R("attachSet", { piece: P.id, shape: 0, sid: P.segs[0].id }, "t" + tp.id);
      out.set = [P.segs[0].atape, S.un.length - n0, S.un[S.un.length - 1].n];
      const order = S.pieces.map(p => p.id), H = R("simTacks", order).holds, pr = R("attachPairs");
      out.holds = [H.length, pr.length, pr[0] && pr[0].places.length];
      out.onTape = Math.max(...H.map(h => Math.abs(sd(h.to) - R("fabricPhys", R("fabricOf", P)).thick)));
      // as far along the tape as along the line: the targets' steps match the line's
      const to = pr[0].to; let along = 0; for (let k = 1; k < to.length; k++) along += Math.hypot(to[k][0] - to[k-1][0], to[k][1] - to[k-1][1], to[k][2] - to[k-1][2]);
      out.along = [along, R("segLen", P, 0)];
      app.undo(); out.undone = !S.pieces.find(p => p.id === P.id).segs[0].atape;      // (undo puts new pattern objects in)
      return out;
    });` });
  assert.deepStrictEqual(o.circ.slice(0, 3), ["circ", "Avatar Tape 1", true]);
  assert.ok(o.circ[3] > 650 && o.circ[3] < 1000, "round Marty's waist: " + o.circ[3]);
  assert.strictEqual(o.circ[4], "Circumference Avatar Tape");
  assert.ok(o.circ[5] < 1.5, "on the skin: " + o.circ[5]);
  assert.deepStrictEqual(o.line, ["line", false]);
  assert.deepStrictEqual(o.penSees, [3], "the pens see only the line");
  assert.deepStrictEqual(o.tapeSees, [1, 2], "the tape tools only the tapes");
  assert.deepStrictEqual(o.set, ["t1", 1, "Attach to Measure"]);
  assert.ok(o.holds[1] === 1 && o.holds[0] === o.holds[2] && o.holds[0] >= 10, "a hold for each place along the line: " + o.holds);
  assert.ok(o.onTape < 1.5, "each hold a cloth's thickness off the skin: " + o.onTape);
  assert.ok(Math.abs(o.along[0] - o.along[1]) < 0.06*o.along[1], "as far along the tape as along the line: " + o.along);
  assert.strictEqual(o.undone, true);
});

test("3.A16 / 2: in the solver an attached line is pulled onto its tape: a band 120 mm in front of Marty's waist, its top line attached to a waist tape, ends with that line on the tape", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const hit = (x, y) => R("skinHit", { rc: new TH.Raycaster(new TH.Vector3(x, y, 800), new TH.Vector3(0, 0, -1)) }).at;
      R("penAdd", [hit(-80, 1100), hit(0, 1100), hit(80, 1100)], false, "circ");
      app.push("Band"); const P = R("mkPiece", "Band", R("mkShape", [{ x: -120, y: -1110 }, { x: 120, y: -1110 }, { x: 120, y: -1010 }, { x: -120, y: -1010 }], true)); S.pieces.push(P); app.commit();
      // the band 120 mm in front of the waist (its cloth moved as it hangs)
      app.ev("movePieces3")([P.id], new TH.Vector3(0, 0, 120));
      R("attachSet", { piece: P.id, shape: 0, sid: P.segs[0].id }, "t" + S.avedit.pens[0].id);
      const pr = R("attachPairs")[0];
      app.SIM.optTest = { gravity: 0, ground: false, self: false };
      R("simBuild");
      const sim = app.SIM.sim, order = app.SIM.order;
      const gap = () => { let m = 0; pr.places.forEach((q, k) => { const a = R("tackAnchor", q, order), x = [0, 0, 0]; a.i.forEach((v, j) => { const i = sim.off[a.p] + v; for (let c = 0; c < 3; c++) x[c] += a.w[j]*sim.x[3*i + c]; }); m = Math.max(m, Math.hypot(x[0] - pr.to[k][0], x[1] - pr.to[k][1], x[2] - pr.to[k][2])); }); return m; };
      out.g0 = gap();
      for (let f = 0; f < 300; f++) app.ev("SIM3D").clothStep(sim, 1/60);
      out.g1 = gap(); out.nan = Array.from(sim.x).some(v => !Number.isFinite(v));
      return out;
    });` });
  assert.ok(o.g0 > 60, "it starts away from the tape: " + o.g0);
  assert.strictEqual(o.nan, false);
  assert.ok(o.g1 < 12, "pulled onto the tape: " + o.g0.toFixed(1) + " -> " + o.g1.toFixed(1));
});

test("3.E4 / 2: Press: one layer, then the one it is sewn to: their seam folded flat back to back, strongly (one step); two layers not sewn: nothing, said so. Seam Taping's tool: a click on a line tapes it, again takes the tape away (one step each)", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, R = (n, ...a) => app.ev(n)(...a), T3 = app.TOOL3;
    app.ev("setLayout")("both");
    app.push("Two"); const A = R("mkPiece", "A", R("mkShape", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], true)), B = R("mkPiece", "B", R("mkShape", [{ x: 200, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 200, y: 100 }], true)), Cp = R("mkPiece", "C", R("mkShape", [{ x: 400, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 100 }, { x: 400, y: 100 }], true));
    S.pieces.push(A, B, Cp); S.seams.push(R("makeSeam", S.seams, { piece: A.id, shape: 0, sids: [A.segs[1].id] }, { piece: B.id, shape: 0, sids: [B.segs[3].id] }, true)); app.commit();
    app.setTool3("press");
    out.panel = [!!app.ev("document").getElementById("press3d"), app.ev("PRESS").kind];
    const n0 = S.un.length;
    // (run 14d, the maintainer's answer to run 14c's Q4: two kinds, Pressed Open by default; run 14c's back-to-back fold is Pressed to One Side)
    R("pressPair", A.id, B.id);
    let sm = S.seams[0]; out.open = [sm.foldAngle, sm.foldStrength, sm.press, S.un.length - n0, S.un[S.un.length - 1].n, R("seamFold", sm) && R("seamFold", sm).a];
    R("pressPair", A.id, B.id, "side");
    sm = S.seams[0]; out.press = [sm.foldAngle, sm.foldStrength, sm.press, S.un.length - n0, S.un[S.un.length - 1].n];
    R("pressPair", A.id, Cp.id);
    out.none = [S.un.length - n0, /not sewn together/.test(toasts[toasts.length - 1])];
    app.undo(); sm = S.seams[0]; out.back = [sm.foldAngle, sm.press];
    // another angle typed ends Pressed Open; 180 then folds nothing again
    R("setSeamFold", sm, { angle: 90 }); out.typed = [S.seams[0].press, S.seams[0].foldAngle];
    app.undo(); app.undo(); out.undone = [S.seams[0].foldAngle, S.seams[0].foldStrength, S.seams[0].press];
    // Seam Taping's tool
    app.setTool3("seam_taping");
    const ln = () => { const P = S.pieces.find(p => p.name === "A"); return { piece: P.id, shape: 0, sid: P.segs[0].id, sh: P, i: 0 }; };
    R("tapeToggle", ln()); out.tape1 = [S.pieces.find(p => p.name === "A").segs[0].tape, S.un[S.un.length - 1].n];
    R("tapeToggle", ln()); out.tape2 = !!S.pieces.find(p => p.name === "A").segs[0].tape;
    return out;` });
  assert.deepStrictEqual(o.panel, [true, "open"], "the panel, Pressed Open by default");
  assert.deepStrictEqual(o.open, [null, 50, "open", 1, "Press", 180], "pressed open: held flat at 180°, strongly");
  assert.deepStrictEqual(o.press, [0, 50, null, 2, "Press"], "pressed to one side: folded back to back, as run 14c's Press");
  assert.deepStrictEqual(o.none, [2, true], "not sewn: no step, said so");
  assert.deepStrictEqual(o.back, [null, "open"]);
  assert.deepStrictEqual(o.typed, [null, 90]);
  assert.deepStrictEqual(o.undone, [null, null, null]);
  assert.deepStrictEqual(o.tape1, [true, "Seam Taping"]);
  assert.strictEqual(o.tape2, false);
});

test("FMT-1 / A: File ▸ Import ▸ OBJ / FBX / glTF 2.0: the file, then its Load Type; an OBJ (no skeleton) cannot be an avatar; Button opens Register Button's box with the file's mesh; the rows are built", () => {
  const cube = "v 0 0 0\\nv 10 0 0\\nv 10 10 0\\nv 0 10 0\\nf 1 2 3\\nf 1 3 4\\n";
  const o = boot({ blank: true, three: true, script: `
    const out = {}, R = (n, ...a) => app.ev(n)(...a), doc = app.ev("document");
    const bytes = new TextEncoder().encode("${cube}").buffer;
    const t1 = R("importMeshAs", "box.obj", bytes, null);
    out.obj = t1.map(t => t.n);
    app.ev("closeModal")(); t1.find(t => t.k === "button").f();
    out.dlg = /Register Button/.test(doc.getElementById("dlg").innerHTML);
    app.ev("hideDlg")();
    const t2 = R("importMeshAs", "body.glb", new ArrayBuffer(8), null);
    out.glb = t2.map(t => t.n); app.ev("closeModal")();
    const f = app.MENUS.file(), imp = f.find(x => x && x.n === "Import").menu().filter(x => x && x.n && !x.off).map(x => x.n);
    out.rows = ["OBJ…", "FBX…", "glTF 2.0 (GLTF/GLB)…"].map(n => imp.includes(n));
    return out;` });
  assert.deepStrictEqual(o.obj, ["Avatar Accessory", "Button", "Buttonhole", "Zipper Slider", "Cancel"]);
  assert.strictEqual(o.dlg, true, "Register Button's box");
  assert.deepStrictEqual(o.glb, ["Avatar", "Avatar Accessory", "Button", "Buttonhole", "Zipper Slider", "Cancel"]);
  assert.deepStrictEqual(o.rows, [true, true, true]);
});

test("t45 / 3: the tools are built and on the 3D toolbar; the menus' rows reach them; Show 3D Pen (Avatar) is a switch, on by default; the lines are kept out of renders", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, T = app.TOOLS;
    out.status = ["pen_avatar", "edit_pen_avatar", "pencil_avatar"].map(id => T[id] && T[id].st);
    out.ui = app.ev("S.ui.pen3");
    out.hide = app.ev("RENDER_HIDE").includes("pens");
    return out;` });
  assert.deepStrictEqual(o.status, ["built", "built", "built"]);
  assert.strictEqual(o.ui, true);
  assert.strictEqual(o.hide, true);
});

module.exports = T;
