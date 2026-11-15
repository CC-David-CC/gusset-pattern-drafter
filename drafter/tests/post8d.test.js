// Round POST8, fourth session. Batch 0d: Roll Up's hint and Auto Sewing's result held until the next action.
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

// (the harness's page has no real class list: what is checked is whether the message is held, holdNow(), which holdCheck() acts on)
test("POST8 batch 0d / H1: after Roll Up the message \"Add a fold line or tack to keep it rolled when simulating.\" stays until the next action (another tool, an undo, a step), as Auto Sewing's result does; another message takes its place", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, G3 = app.G3;
    app.ev("setLayout")("both");
    const R = app.mkPiece("R", app.mkShape([{x:-150,y:-1400},{x:150,y:-1400},{x:150,y:-1000},{x:-150,y:-1000}], true));
    const Q = app.mkPiece("Q", app.mkShape([{x:300,y:-1400},{x:700,y:-1400},{x:700,y:-1000},{x:300,y:-1000}], true));
    S.pieces.push(R, Q);
    S.cloth = app.normCloth({ ...S.cloth, res: 20, substeps: 8, self: false, worker: false });
    app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
    const held = () => { app.ev("holdCheck")(); return !!app.ev("holdNow")(); };
    const other = () => (S.tool === "transform_pattern" ? "edit_pattern" : "transform_pattern");
    S.sel = [R.id]; app.ev("rollUp3")("h", { w: 50, n: 2 });
    out.text = toasts.slice(-1)[0]; out.after = held();
    // a click that only selects is no action: it stays
    S.sel = [R.id, Q.id]; out.select = held();
    app.ev("setTool")(other()); out.tool = held();
    // again, then an undo
    S.sel = [R.id]; app.ev("rollUp3")("h", { w: 50, n: 1 }); out.again = held(); app.undo(); out.undo = held();
    // again, then a step of another command
    app.ev("rollUp3")("h", { w: 50, n: 1 }); app.ev("push")("Edit"); out.step = held();
    // too short on one of two (R 300 wide, Q 400): R named in the one message
    S.sel = [R.id, Q.id]; app.ev("rollUp3")("v", { w: 160, n: 1 }); out.mixed = toasts.slice(-1)[0];
    // another message takes its place
    out.before = held(); app.ev("toast")("something else"); out.replaced = held();
    // Auto Sewing's result is held the same way
    const mk = (n, x) => { const p = app.mkPiece(n, app.mkShape([{x:x,y:-800},{x:x+300,y:-800},{x:x+300,y:-400},{x:x,y:-400}], true)); S.pieces.push(p); return p; };
    const A = mk("A", 1000), B = mk("B", 1400); app.commit(); app.ev("garmentSync")();
    S.sel = [A.id, B.id]; app.ev("autoSewRun")(); out.sew = [toasts.slice(-1)[0].slice(0, 6), held()];
    app.ev("setTool")(other()); out.sewAfter = held();
    return out;` });
  assert.strictEqual(o.text, "Add a fold line or tack to keep it rolled when simulating.");
  assert.strictEqual(o.after, true, "held");
  assert.strictEqual(o.select, true, "selecting is no action");
  assert.strictEqual(o.tool, false, "gone with another tool");
  assert.strictEqual(o.again, true);
  assert.strictEqual(o.undo, false, "gone with an undo");
  assert.strictEqual(o.step, false, "gone with a step");
  assert.ok(/^Add a fold line or tack to keep it rolled when simulating[.] Not rolled: R: the pattern is shorter than 2 widths that way[.]$/.test(o.mixed), o.mixed);
  assert.deepStrictEqual([o.before, o.replaced], [true, false], "another message: no longer held");
  assert.deepStrictEqual(o.sew, ["Sewed ", true]);
  assert.strictEqual(o.sewAfter, false);
});

// the T-shirt example as shipped (front and back hanging flat in front of and behind where the body is, the sleeves wrapped)
const TSHIRT = `
  const out = {}, G3 = app.G3, EX = app.ev("PATTERN_EXAMPLES"), ex = EX.find(e => /T-shirt/.test(e.name));
  app.ev("setLayout")("both");
  app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
  S.undo.length = 0; S.un.length = 0; S.sel = [];
  const P = (n) => S.pieces.find(p => p.name === n), X = (n) => Array.from(G3.items.get(P(n).id).X);
  const all = () => S.pieces.flatMap(p => Array.from(G3.items.get(p.id).X));
  const ys = (A) => [...new Set(A.filter((v, k) => k % 3 === 1).map(v => +v.toFixed(3)))].sort((a, b) => a - b);
  const box = (A) => { const b = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]; for (let i = 0; i < A.length; i += 3) { b[0] = Math.min(b[0], A[i]); b[1] = Math.max(b[1], A[i]); b[2] = Math.min(b[2], A[i+1]); b[3] = Math.max(b[3], A[i+1]); b[4] = Math.min(b[4], A[i+2]); b[5] = Math.max(b[5], A[i+2]); } return b; };
  const share = (A, y) => A.filter((v, k) => k % 3 === 1 && Math.abs(v - y) < 1e-3).length/(A.length/3);
`;

test("POST8 FIX-5 / E1: Fold 3D Garment ▸ Lay Flat lays the T-shirt face up on the floor in two layers (the front on top, the back under it, 3 mm apart) in front of where it hung, clear of it; the patterns' places untouched; one step, undo; ↩ Back on the Avatar puts the drape from before back; the panel and the tool", () => {
  const o = boot({ blank: true, three: true, script: TSHIRT + `
    const before = all(), b0 = box(before), p3 = JSON.stringify(S.pieces.map(p => p.p3));
    app.ev("setTool3")("fold_garment");
    const html = () => app.el("foldg3d").innerHTML;
    out.panel = [/Lay Flat/.test(html()), /T-pose/.test(html()), /not built/.test(html())];
    out.flat = app.ev("layFlat")();
    const A = all(), b1 = box(A);
    out.ys = ys(A);
    out.front = share(X("Front"), 6); out.back = share(X("Back"), 3);
    out.clear = b1[4] - b0[5]; out.mid = (b1[0] + b1[1])/2;
    out.width = [b0[1] - b0[0], b1[1] - b1[0]];
    out.p3 = JSON.stringify(S.pieces.map(p => p.p3)) === p3;
    out.steps = S.un.map(u => u.n);
    app.undo(); out.undo = Math.max(...all().map((v, k) => Math.abs(v - before[k])));
    app.redo(); out.redo = Math.max(...all().map((v, k) => Math.abs(v - A[k])));
    out.backOn = /↩/.test(html()); app.ev("foldgPanel")(true);
    out.back = app.ev("foldgBack")(); out.backAt = Math.max(...all().map((v, k) => Math.abs(v - before[k]))); out.steps2 = S.un.map(u => u.n);
    // Manual: the switch's rows (with the not-built switch on, the three unknown ones greyed)
    app.ev("FOLDG").mode = "manual"; S.ui.unbuilt = false; app.ev("foldgPanel")(true); out.manual = [/Rotate X-Axis/.test(html()), /Flip Horizontally/.test(html()), /Fold [(]Selected[)]/.test(html()), /not built/.test(html())];
    S.ui.unbuilt = true; app.ev("foldgPanel")(true); out.manualNb = (html().match(/not built yet[)]/g) || []).length;
    app.ev("setTool3")("select_move"); out.hidden = app.el("foldg3d").style.display;
    return out;` });
  assert.deepStrictEqual(o.panel, [true, true, false]);
  assert.strictEqual(o.flat, true);
  assert.deepStrictEqual(o.ys, [3, 6], "two layers on the floor");
  assert.ok(o.front > 0.9 && o.back > 0.9, "the front on top, the back under it: " + o.front + " " + o.back);
  assert.ok(o.clear >= 299, "laid in front of where it hung, clear of it: " + o.clear);
  assert.ok(Math.abs(o.mid) < 1, "on the floor's middle line");
  assert.ok(o.width[1] >= o.width[0] - 1, "its width kept (x is kept): " + o.width);
  assert.strictEqual(o.p3, true, "the patterns' places untouched");
  assert.deepStrictEqual(o.steps, ["Lay Flat"]);
  assert.ok(o.undo < 1e-3 && o.redo < 1e-9, "undo / redo: " + o.undo + " " + o.redo);
  assert.strictEqual(o.backOn, true);
  assert.strictEqual(o.back, true);
  assert.ok(o.backAt < 1e-3, "back as it hung: " + o.backAt);
  assert.deepStrictEqual(o.steps2, ["Lay Flat", "Back on the Avatar"]);
  assert.deepStrictEqual(o.manual, [true, true, true, false]);
  assert.strictEqual(o.manualNb, 3, "Optimize-Res Garment, the two Set Physical Property rows: greyed only with the switch on");
  assert.strictEqual(o.hidden, "none", "the panel goes with the tool");
});

test("POST8 FIX-5 / E2: on the laid T-shirt, Flip Horizontally turns it over (the back on top), Rotate X-Axis keeps it on the floor, Fold folds the smaller part over the line onto the top (mirrored, above every other layer), Fold (Selected) folds only the selected sleeve; each one step", () => {
  const o = boot({ blank: true, three: true, script: TSHIRT + `
    app.ev("layFlat")();
    app.ev("foldgFlip")(); out.flip = [share(X("Front"), 3), share(X("Back"), 6), box(all())[2]];
    app.ev("foldgFlip")();
    // a fold along the garment's length (z), 150 mm in from its right edge: the right part folds over
    const b = box(all()), lx = b[1] - 150, A0 = all();
    out.fold = app.ev("foldgFold")([lx, 0, b[4]], [lx, 0, b[5]], false);
    const A1 = all(), top = Math.max(...A0.filter((v, k) => k % 3 === 1));
    let n = 0, bad = 0, stay = 0;
    for (let i = 0; i < A0.length; i += 3) {
      if (A0[i] > lx + 1e-6) { n++; if (Math.abs(A1[i] - (2*lx - A0[i])) > 1e-3 || A1[i+1] <= top || Math.abs(A1[i+2] - A0[i+2]) > 1e-3) bad++; }
      else if (Math.hypot(A1[i] - A0[i], A1[i+1] - A0[i+1], A1[i+2] - A0[i+2]) > 1e-9) stay++;
    }
    out.foldRes = [n > 0, bad, stay];
    app.undo();
    // Fold (Selected): the right sleeve (laid at the right) folded in over the body along a line through its armhole's middle
    const R = P("Right sleeve"), L = P("Left sleeve"), rb = box(X("Right sleeve")), cx = rb[1] > 0 ? rb[0] + 20 : rb[1] - 20, L0 = X("Left sleeve"), F0 = X("Front");
    S.sel = [R.id];
    out.sel = app.ev("foldgFold")([cx, 0, rb[4] - 50], [cx, 0, rb[5] + 50], true);
    out.others = [Math.max(...X("Left sleeve").map((v, k) => Math.abs(v - L0[k]))), Math.max(...X("Front").map((v, k) => Math.abs(v - F0[k])))];
    out.rMoved = X("Right sleeve").some((v, k) => k % 3 === 1 && v > 6.5);
    app.ev("foldgRotateX")(); out.rot = box(all())[2];
    out.steps = S.un.map(u => u.n);
    // a line that does not cross the garment: no step (it would have turned the whole garment over)
    const k = S.undo.length, bb = box(all()); out.none = app.ev("foldgFold")([bb[1] + 100, 0, bb[4]], [bb[1] + 100, 0, bb[5]], false); out.noneSteps = S.undo.length - k; out.noneToast = toasts.slice(-1)[0];
    return out;` });
  assert.deepStrictEqual([o.flip[0] > 0.9, o.flip[1] > 0.9, Math.round(o.flip[2]*1000)/1000], [true, true, 3], "turned over: the back on top, still on the floor");
  assert.strictEqual(o.fold, true);
  assert.deepStrictEqual(o.foldRes, [true, 0, 0], "the part beyond the line mirrored over it and laid above the top layer; the rest unmoved");
  assert.strictEqual(o.sel, true);
  assert.deepStrictEqual(o.others, [0, 0], "only the selected sleeve folds");
  assert.strictEqual(o.rMoved, true);
  assert.ok(Math.abs(o.rot - 3) < 1e-6, "Rotate X-Axis: still on the floor");
  assert.deepStrictEqual(o.steps, ["Lay Flat", "Flip Horizontally", "Flip Horizontally", "Fold (Selected)", "Rotate X-Axis"]);
  assert.deepStrictEqual([o.none, o.noneSteps, o.noneToast], [false, 0, "Fold: the line does not cross the garment"]);
});

module.exports = T;
