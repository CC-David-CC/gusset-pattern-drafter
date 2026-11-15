// POST8 FIX-4b (roadmap 1.T19): Lacing and Edit Lacing. Eyelets (closed internal shapes) clicked in order in the 2D window or on the
// garment, Enter or a double-click makes the lacing (one step); Edit Lacing selects one and changes it in its box (Cord Diameter, Length,
// Curvature, Fabric), a click on an eyelet of the selected lacing reverses the cord there; Delete deletes it. S.lacings is in the file
// only when there are some (file version stays 36). In the solver a lacing is a slack cord: its spans pull their eyelets together when
// they are longer than its length, never push.
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
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, (what || "") + " " + a + " vs " + b);

// two rectangles 60 mm apart, each with two square holes 16 mm wide near the gap: A's at x 170, B's at x 290, both at y 80 and 220
const DOC = `
  const out = {}, E = (n) => app.ev(n);
  S.pieces.length = 0;
  const sq = (x, y) => Object.assign(app.mkShape([{x:x-8,y:y-8},{x:x+8,y:y-8},{x:x+8,y:y+8},{x:x-8,y:y+8}], true), { hole: true });
  const A = app.mkPiece("A", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true));
  const B = app.mkPiece("B", app.mkShape([{x:260,y:0},{x:460,y:0},{x:460,y:300},{x:260,y:300}], true));
  E("addChild")(A, "internals", sq(170, 80)); E("addChild")(A, "internals", sq(170, 220));
  E("addChild")(B, "internals", sq(290, 80)); E("addChild")(B, "internals", sq(290, 220));
  S.pieces.push(A, B); E("commit")();
  E("setLayout")("both"); E("garmentSync")(true);
  const toS = E("toS"), V = E("V");
  const at = (x, y) => { const q = toS(V(x, y)); return [q.x, q.y]; };
  const steps = () => app.histSteps().steps.map(s => s.n);
`;

test("post8s / 1: Lacing in the 2D window: the eyelets clicked in order, Enter makes the lacing (one step, its spans measured on the garment), Backspace takes the last eyelet back and Esc gives it up; undo and redo; the tool and its twin on the 2D toolbar are one tool", () => {
  const r = boot({ blank: true, three: true, script: DOC + `
    E("setTool")("lacing_2d"); out.tool = [S.tool, S.tool3];
    // Esc gives a lacing being threaded up
    app.click(...at(170, 80)); app.click(...at(290, 80)); out.draft = S.laceDraft.holes.length;
    app.key("Escape"); out.esc = [S.laceDraft, S.lacings.length];
    // a click off any eyelet adds nothing; Backspace takes the last one back
    app.click(...at(100, 150)); out.off = S.laceDraft;
    app.click(...at(170, 80)); app.click(...at(290, 80)); app.click(...at(170, 220)); app.click(...at(400, 40));
    app.key("Backspace"); out.back = S.laceDraft.holes.length;
    app.click(...at(170, 220)); app.click(...at(290, 220));
    out.n0 = S.undo.length;
    app.key("Enter");
    const t = S.lacings[0];
    out.made = { n: S.lacings.length, holes: t.holes.map(h => [h.piece === A.id ? "A" : "B", (h.piece === A.id ? A : B).internals.findIndex(x => x.id === h.shape)]), spans: t.spans, d: t.d, curve: t.curve, rev: t.rev, name: t.name };
    out.step = steps().slice(-1)[0]; out.steps = S.undo.length - out.n0; out.draftAfter = S.laceDraft; out.sel = S.selTrim;
    out.sides = [0, 1, 2].map(j => E("laceSide")(t, j));
    app.key("z", { ctrlKey: true }); out.undone = S.lacings.length;
    app.key("y", { ctrlKey: true }); out.redone = S.lacings.length === 1 && JSON.stringify(S.lacings[0]) === JSON.stringify(t);
    // the 3D toolbar's tool is the same one
    E("setTool3")("edit_lacing"); out.edit = [S.tool, S.tool3];
    return out;` });
  assert.deepStrictEqual(r.tool, ["lacing", "lacing"], "Lacing on the 2D toolbar puts the tool in both hands");
  assert.strictEqual(r.draft, 2);
  assert.deepStrictEqual(r.esc, [null, 0], "Esc gives it up, nothing made");
  assert.strictEqual(r.off, null, "a click off any eyelet adds none");
  assert.strictEqual(r.back, 2, "three eyelets (the fourth click was off any), Backspace took the last back");
  assert.strictEqual(r.made.n, 1);
  assert.deepStrictEqual(r.made.holes, [["A", 0], ["B", 0], ["A", 1], ["B", 1]], "the eyelets in the order clicked");
  near(r.made.spans[0], 120, 1, "A1 to B1 on the garment"); near(r.made.spans[1], Math.hypot(120, 140), 1, "B1 to A2"); near(r.made.spans[2], 120, 1, "A2 to B2");
  assert.strictEqual(r.made.d, 3); assert.strictEqual(r.made.curve, undefined, "the default curvature is not stored"); assert.strictEqual(r.made.rev, undefined);
  assert.strictEqual(r.made.name, "Lacing 1");
  assert.strictEqual(r.step, "Lacing"); assert.strictEqual(r.steps, 1, "one step"); assert.strictEqual(r.draftAfter, null);
  assert.deepStrictEqual(r.sel, { kind: "lace", id: 1 }, "the new lacing is selected");
  assert.deepStrictEqual(r.sides, [1, -1, 1], "front, back, front: the cord goes through each eyelet");
  assert.strictEqual(r.undone, 0); assert.strictEqual(r.redone, true);
  assert.deepStrictEqual(r.edit, ["edit_lacing", "edit_lacing"]);
});

test("post8s / 2: Edit Lacing: a click on a lacing selects it and opens its box (Length scales every span, Curvature, Cord Diameter, Fabric: one step); a click on one of its eyelets reverses the cord there (one step, undone exactly); Delete deletes it; in the file only when there are some, read back the same", () => {
  const r = boot({ blank: true, three: true, script: DOC + `
    out.none = "lacings" in E("docObj")();
    E("setTool")("lacing_2d");
    for (const [x, y] of [[170, 80], [290, 80], [170, 220], [290, 220]]) app.click(...at(x, y));
    app.key("Enter");
    const L0 = S.lacings[0].spans.slice(), len0 = L0.reduce((a, b) => a + b, 0);
    { const Lb = E("libOf")(); Lb.fabric.push(E("normLibItem")("fabric", { name: "Cord", physical: "Heavy woven" }, Lb.nextId++)); }      // a second fabric to choose
    E("setTool")("edit_lacing_2d");
    E("trimSelect")("lace", null);
    const asked = [];
    app.answer = (title, fields, opts) => { asked.push([title, fields.map(f => [f.k, f.label, f.unit]), (opts.selects || []).map(s => s.label)]); const f = Object.fromEntries(fields.map(x => [x.k, x.val])); return { ...f, d: 4, len: f.len*0.6, curve: 55, fabric: String(E("libOf")().fabric[1].id) }; };
    app.click(...at(230, 80));                                 // on the span from A1 to B1
    const t = S.lacings[0];
    out.asked = asked; out.sel = S.selTrim; out.step = steps().slice(-1)[0];
    out.edit = { d: t.d, curve: t.curve, fab: t.fabric === E("libOf")().fabric[1].id, ratio: t.spans.map((s, j) => s/L0[j]), len: E("laceLen")(t)/len0 };
    // with it selected, a click on its third eyelet (A2) reverses it there
    app.answer = null;
    const before = JSON.stringify(t);
    app.click(...at(170, 220));
    out.rev = S.lacings[0].rev; out.revStep = steps().slice(-1)[0]; out.sides = [0, 1, 2].map(j => E("laceSide")(S.lacings[0], j));
    app.key("z", { ctrlKey: true }); out.revUndo = JSON.stringify(S.lacings[0]) === before;
    app.key("y", { ctrlKey: true });
    // the file: written, read back the same
    const d = JSON.parse(JSON.stringify(E("docObj")()));
    out.inFile = d.lacings;
    E("loadDoc")(d); out.back = JSON.stringify(S.lacings) === JSON.stringify(d.lacings);
    // Delete with Edit Lacing deletes the selected one
    E("setTool")("edit_lacing_2d"); E("trimSelect")("lace", S.lacings[0].id);
    app.key("Delete"); out.del = [S.lacings.length, steps().slice(-1)[0], "lacings" in E("docObj")()];
    app.key("z", { ctrlKey: true }); out.delUndo = S.lacings.length;
    return out;` });
  assert.strictEqual(r.none, false, "no lacing: no key in the file");
  assert.strictEqual(r.asked.length, 1);
  assert.ok(/^Edit Lacing/.test(r.asked[0][0]), r.asked[0][0]);
  assert.deepStrictEqual(r.asked[0][1].map(f => f[1]), ["Cord Diameter", "Length", "Curvature"]);
  assert.deepStrictEqual(r.asked[0][2], ["Fabric"]);
  assert.deepStrictEqual(r.sel, { kind: "lace", id: 1 });
  assert.strictEqual(r.step, "Edit Lacing");
  assert.strictEqual(r.edit.d, 4); assert.strictEqual(r.edit.curve, 55); assert.strictEqual(r.edit.fab, true);
  // (the box shows the length to 0.1 mm, so 60 % of the shown length is within a hair of 60 % of the real one)
  for (const k of r.edit.ratio) near(k, 0.6, 1e-4, "every span scaled");
  near(r.edit.len, 0.6, 1e-4, "the length typed");
  assert.deepStrictEqual(r.rev, [2], "reversed at the third eyelet"); assert.strictEqual(r.revStep, "Reverse Lacing");
  assert.deepStrictEqual(r.sides, [1, -1, -1], "from the reversed eyelet on, the cord stays on the back");
  assert.strictEqual(r.revUndo, true);
  assert.strictEqual(r.inFile.length, 1); assert.deepStrictEqual(r.inFile[0].rev, [2]); assert.strictEqual(r.inFile[0].curve, 55);
  assert.strictEqual(r.back, true, "read back the same");
  assert.deepStrictEqual(r.del, [0, "Delete Lacing", false]);
  assert.strictEqual(r.delUndo, 1);
});

test("post8s / 3: an eyelet that goes takes its place in the lacing with it (the spans either side joined); fewer than two eyelets: the lacing goes; a lacing comes in with Add Project on the new patterns' eyelets", () => {
  const r = boot({ blank: true, three: true, script: DOC + `
    E("setTool")("lacing_2d");
    for (const [x, y] of [[170, 80], [290, 80], [170, 220], [290, 220]]) app.click(...at(x, y));
    app.key("Enter");
    const sp = S.lacings[0].spans.slice();
    const saved = JSON.parse(JSON.stringify(E("docObj")()));
    app.push("Delete hole"); B.internals.splice(0, 1); E("commit")();
    out.after = { holes: S.lacings[0].holes.length, spans: S.lacings[0].spans, want: [sp[0] + sp[1], sp[2]] };
    app.push("Delete holes"); A.internals.length = 0; B.internals.length = 0; E("commit")();
    out.gone = S.lacings.length;
    // Add Project: the saved document added to this one
    E("addDocument")("saved", saved);
    out.added = S.lacings.map(t => t.holes.every(h => { const p = S.pieces.find(q => q.id === h.piece); return p && p.internals.some(x => x.id === h.shape && x.hole); }));
    out.addedIds = S.lacings.map(t => t.holes.map(h => h.piece).filter(id => id === A.id || id === B.id).length);
    return out;` });
  assert.strictEqual(r.after.holes, 3);
  r.after.spans.forEach((s, k) => near(s, r.after.want[k], 1e-9, "span " + k));
  assert.strictEqual(r.gone, 0);
  assert.deepStrictEqual(r.added, [true], "the added lacing on the added patterns' eyelets");
  assert.deepStrictEqual(r.addedIds, [0], "none of it on the patterns that were there");
});

test("post8s / 4: in the solver a lacing is a slack cord: shorter than it lies it pulls its eyelets together to its length; as long as it lies, or longer, it moves nothing (it never pushes); with no lacing nothing of it is built", () => {
  const run = (k) => boot({ blank: true, three: true, script: DOC + `
    E("setTool")("lacing_2d");
    for (const [x, y] of [[170, 80], [290, 80], [170, 220], [290, 220]]) app.click(...at(x, y));
    app.key("Enter");
    const t = S.lacings[0];
    ${k === null ? "S.lacings = []; E(\"commit\")();" : "t.spans = t.spans.map(s => s*" + k + ");"}
    app.SIM.optTest = { gravity: 0, ground: false, self: false };
    E("simBuild")();
    const sim = app.SIM.sim, C = E("SIM3D"), order = app.SIM.order;
    out.rT = sim.rT ? Array.from(sim.rT) : null; out.nRods = sim.rI.length;
    const pos = () => t.holes.map(h => { const a = E("laceAnchor")(h, order); const q = [0, 0, 0]; a.i.forEach((v, j) => { const i = sim.off[a.p] + v; for (let c = 0; c < 3; c++) q[c] += a.w[j]*sim.x[3*i + c]; }); return q; });
    const gaps = (P) => P.slice(1).map((q, j) => Math.hypot(q[0] - P[j][0], q[1] - P[j][1], q[2] - P[j][2]));
    out.g0 = gaps(pos()); out.rest = t.spans;
    for (let f = 0; f < 240; f++) C.clothStep(sim, 1/60);
    out.g1 = gaps(pos());
    out.nan = Array.from(sim.x).some(v => !Number.isFinite(v));
    return out;` });
  const tight = run(0.6), same = run(1), long = run(2), none = run(null);
  assert.deepStrictEqual(tight.rT, [1, 1, 1], "three slack links");
  assert.strictEqual(tight.nan, false);
  tight.g1.forEach((g, j) => { assert.ok(g < tight.g0[j] - 20, "span " + j + " pulled in: " + tight.g0[j].toFixed(1) + " -> " + g.toFixed(1)); assert.ok(g <= tight.rest[j]*1.06, "span " + j + " at most its length: " + g.toFixed(1) + " / " + tight.rest[j].toFixed(1)); });
  same.g1.forEach((g, j) => near(g, same.g0[j], 0.5, "as long as it lies: span " + j + " moves nothing"));
  long.g1.forEach((g, j) => near(g, long.g0[j], 0.5, "longer: span " + j + " is slack, nothing pushed"));
  assert.strictEqual(none.rT, null, "no lacing: no slack links"); assert.strictEqual(none.nRods, 0);
});

test("post8s / 5: the tools are built and named: Lacing and Edit Lacing on the 3D toolbar's Trims and as twins on the 2D toolbar; 2D ▸ Lacing / Edit Lacing reach them; the Object Browser's Scene counts the lacings and opens their list", () => {
  const r = boot({ blank: true, three: true, script: DOC + `
    const rows = E("menu2D")().flatMap(r => r.menu ? r.menu() : [r]).filter(r => r && /Lacing/.test(r.n || ""));
    out.rows = rows.map(r => [r.n, !!r.off, typeof r.f]);
    E("setTool")("lacing_2d");
    for (const [x, y] of [[170, 80], [290, 80]]) app.click(...at(x, y));
    app.key("Enter");
    out.scene = E("trimKey")("lace");
    E("obSelect")("lace", null);
    out.list = E("obName")("lace");
    return out;` });
  const REG = require("../drafter-tools.js"), tool = (id) => REG.tools.find(t => t.id === id) || {};
  assert.deepStrictEqual(["lacing", "edit_lacing", "lacing_2d", "edit_lacing_2d"].map(id => tool(id).status), ["built", "built", "built", "built"]);
  assert.deepStrictEqual(["lacing", "edit_lacing", "lacing_2d", "edit_lacing_2d"].map(id => tool(id).group), ["bond", "bond", "lace2", "lace2"]);
  assert.deepStrictEqual(r.rows, [["Lacing", false, "function"], ["Edit Lacing", false, "function"]]);
  assert.strictEqual(r.scene, "lacings"); assert.strictEqual(r.list, "Lacing");
});

module.exports = T;
