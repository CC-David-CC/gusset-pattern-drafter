// Round UV-1 (roadmap 3.E3 3.D3 2.C25 3.B12; the round's spec). Batch B: a pattern's UV place (uv, kept only once
// set), the UV Editor (Materials/UV ▸ UV Editor, a stage tab), Move UV, Rotate / Scale, Arrange with UV (0-1), Reset UV to 2D Arrangement,
// Offset, Select ▸ All with Same Property, UV Display, UV Snapshot, the OBJ's texture places from the UV square.
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
// two rectangles side by side: A 200 x 300 at 0..200, B 200 x 300 at 300..500 (the garment 500 x 300)
const SCENE = `
    S.pieces = [];
    const A = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)), B = app.mkPiece("Back", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:300},{x:300,y:300}], true));
    S.pieces.push(A, B); app.commit();
    const ev = (n) => app.ev(n), r6 = (v) => Math.round(v*1e6)/1e6;
`;

test("UV-1 / B 1: the default UV place is the 2D arrangement fitted into the 0-1 tile with one scale, centred, y up; Move UV, Rotate 90°, Scale, Offset, Arrange with UV (0-1) and Reset UV to 2D Arrangement are one step each and keep their places through a file; junk is dropped", () => {
  const o = boot({ script: SCENE + `
    return (async () => {
    const out = {}, place = (p) => ev("uvPlace")(p), loopBox = (p) => { const L = ev("uvLoop")(p, place(p)); return [Math.min(...L.map(q => q[0])), Math.min(...L.map(q => q[1])), Math.max(...L.map(q => q[0])), Math.max(...L.map(q => q[1]))].map(r6); };
    out.def = [loopBox(A), loopBox(B), !!A.uv];
    // the corner (0, 300) of A (its lower left in 2D, y down) is its lower left in UV (V up)
    const pl = place(A); out.corner = ev("uvOf")(pl, { x: 0, y: 300 }).map(r6);
    S.sel = [A.id]; const u0 = S.undo.length;
    ev("uvMove")(0.1, 0.05); out.move = [S.undo.length - u0, r6(A.uv.x - pl.x), r6(A.uv.y - pl.y), !!B.uv];
    ev("uvTurnScale")(90, 1, "Rotate UV"); out.turn = [A.uv.a, S.un[S.un.length - 1].n];
    ev("uvTurnScale")(0, 0.5, "Scale UV"); out.scale = r6(A.uv.s/pl.s);
    ev("uvArrange")(); const all = [...loopBox(A), ...loopBox(B)]; out.arr = [Math.min(all[0], all[4]) >= 0, Math.max(all[2], all[6]) <= 1, Math.min(all[1], all[5]) >= 0, Math.max(all[3], all[7]) <= 1, !!A.uv && !!B.uv, S.un[S.un.length - 1].n];
    let bytes = null; app.setDownload((n, b) => { bytes = b; }); ev("saveDoc")(); await app.wait(() => bytes, "the file");
    const d = app.fileDoc(bytes); out.file = [!!d.pieces[0].uv, typeof d.pieces[0].uv.s];
    ev("newDoc")(true); ev("openFile")("uv.pdraft", new Uint8Array(bytes), null, true); await app.wait(() => S.pieces.length === 2, "opened");
    out.open = [!!S.pieces[0].uv, S.pieces[0].uv.a];
    ev("uvReset")(); out.reset = [S.pieces.every(p => !p.uv), S.un[S.un.length - 1].n, ev("uvReset")()];
    out.junk = [ev("normUV")({ x: 1, y: 1, a: 0, s: -1 }), ev("normUV")({ x: "a" }), ev("normUV")({ x: 0.5, y: 0.5, a: 450, s: 0.002 }).a];
    return out; })();` });
  // the garment 500 x 300: s0 = 0.96 / 500; it is 0.96 wide and 0.576 high, centred: u from 0.02 to 0.98, v from 0.212 to 0.788
  assert.deepStrictEqual(o.def[0], [0.02, 0.212, 0.404, 0.788]);
  assert.deepStrictEqual(o.def[1], [0.596, 0.212, 0.98, 0.788]);
  assert.strictEqual(o.def[2], false, "no uv kept until set");
  assert.deepStrictEqual(o.corner, [0.02, 0.212]);
  assert.deepStrictEqual(o.move, [1, 0.1, 0.05, false], "one step; the other pattern keeps its default");
  assert.deepStrictEqual(o.turn, [90, "Rotate UV"]);
  assert.strictEqual(o.scale, 0.5);
  assert.deepStrictEqual(o.arr, [true, true, true, true, true, "Arrange with UV (0-1)"]);
  assert.deepStrictEqual(o.file, [true, "number"]);
  assert.deepStrictEqual(o.open, [true, 90]);
  assert.deepStrictEqual(o.reset, [true, "Reset UV to 2D Arrangement", false]);
  assert.deepStrictEqual(o.junk, [null, null, 90]);
});

test("UV-1 / B 2: Materials/UV ▸ UV Editor and Window ▸ UV Editor open it as a stage tab; Edit UV says where it is; Select ▸ All with Same Property; the arrow keys over it move the selected UVs; a UV Snapshot of the outlines; the OBJ's texture places are the UV square's", () => {
  const o = boot({ three: true, script: SCENE + `
    const out = {};
    const row = app.MENUS.materials().find(x => x && x.n === "UV Editor");
    out.row = [!!row, !!row.off]; row.f();
    out.open = [ev("UVED").open, ev("UVED").front, /UV Editor/.test(app.el("avtabs").innerHTML), /Move UV/.test(app.el("uved").innerHTML)];
    out.tool = /Materials\\/UV/.test(ev("TOOLS").edit_uv.via || "");
    out.same = [ev("uvSameProp")(A.id), S.sel.length];
    S.sel = [B.id]; const was = ev("uvPlace")(B).x; ev("UVED").over = true;
    app.key("ArrowRight", { code: "ArrowRight" }); out.key = [Math.round((B.uv.x - was)*1000)/1000, S.un[S.un.length - 1].n];
    ev("UVED").over = false;
    out.snap = !!ev("uvSnapshot")(256, "01", true, "#000000");
    app.ev("garmentSync")(true);
    const t = ev("objText")(false, "multi").text, vt = t.split("\\n").filter(l => /^vt /.test(l)).map(l => l.split(" ").slice(1).map(Number));
    out.obj = [vt.length > 0, vt.every(([u, v]) => u >= -0.001 && u <= 1.001 && v >= -0.001 && v <= 1.001), /UV square/.test(t)];
    ev("uvEditor")(false); out.closed = [ev("UVED").open, ev("UVED").front];
    return out;` });
  assert.deepStrictEqual(o.row, [true, false], "a built row");
  assert.deepStrictEqual(o.open, [true, true, true, true]);
  assert.strictEqual(o.tool, true, "the toolbar's Edit UV says where the window is");
  assert.deepStrictEqual(o.same, [2, 2], "same Particle Distance, Layer and Fabric: both");
  assert.deepStrictEqual(o.key, [0.01, "Move UV"]);
  assert.strictEqual(o.snap, true);
  assert.deepStrictEqual(o.obj, [true, true, true]);
  assert.deepStrictEqual(o.closed, [false, false]);
});

test("UV-1 / C 1: Auto UV Packing packs the patterns into the tile in rows with the padding, as large as fits (one step); Fix Scale Ratio keeps their sizes' ratio; Advanced Placement may turn a pattern a quarter; a Selected Tile shifts them; Bake Textures paints each pattern's face into its place", () => {
  const o = boot({ script: SCENE + `
    const out = {}, place = (p) => ev("uvPlace")(p), loopBox = (p) => { const L = ev("uvLoop")(p, place(p)); return [Math.min(...L.map(q => q[0])), Math.min(...L.map(q => q[1])), Math.max(...L.map(q => q[0])), Math.max(...L.map(q => q[1]))]; };
    S.sel = []; const u0 = S.undo.length;
    const plan = ev("uvPack")({ padding: 0.02, fidelity: 5, fix: true, adv: false });
    const a = loopBox(A), b = loopBox(B), inT = (x) => x[0] >= 0.02 - 1e-6 && x[1] >= 0.02 - 1e-6 && x[2] <= 0.98 + 1e-6 && x[3] <= 0.98 + 1e-6;
    out.pack = [S.undo.length - u0, S.un[S.un.length - 1].n, inT(a), inT(b), a[2] <= b[0] - 0.02 + 1e-6 || b[2] <= a[0] - 0.02 + 1e-6 || a[3] <= b[1] - 0.02 + 1e-6 || b[3] <= a[1] - 0.02 + 1e-6, r6(A.uv.s/B.uv.s)];
    // as large as fits: two boxes 200 x 300 side by side with three paddings across, the width decides: each (1 - 3 x 0.02) / 2 = 0.47 wide
    out.size = Math.abs((a[2] - a[0]) - 0.47) < 0.002;
    ev("uvPack")({ padding: 0.02, fidelity: 5, fix: true, adv: true }); out.adv = [A.uv.a, B.uv.a].every(v => v === 90);
    ev("uvPack")({ padding: 0.02, fidelity: 3, fix: true, tu: 1, tv: 2 }); out.tile = [A.uv.x > 1 && A.uv.x < 2, A.uv.y > 2 && A.uv.y < 3];
    out.junk = ev("uvPackPlan")([{ id: 1, w: 10, h: 10, k: 1 }], { padding: 0.6 });
    out.bake = !!ev("uvBake")(256, "01", 4, false) && !!ev("uvBake")(128, "all", 0, true);
    return out;` });
  assert.deepStrictEqual(o.pack.slice(0, 5), [1, "Auto UV Packing", true, true, true], "one step; both inside the padding, apart by it");
  assert.strictEqual(o.pack[5], 1, "one scale for both");
  assert.strictEqual(o.size, true);
  assert.strictEqual(o.adv, true, "tall boxes lie turned a quarter with Advanced Placement");
  assert.deepStrictEqual(o.tile, [true, true]);
  assert.strictEqual(o.junk, null, "no room with that padding");
  assert.strictEqual(o.bake, true);
});

test("UV-1 / D 1: Pattern Matching (Texture Based: one print over the 2D window; Lock in Place: the texture's place kept) and its Lock (Edit Texture cannot move it); the Materials rows: Reset to Basic Fabric, Delete Texture, Flip Texture, Reset Fabric Angle, Align Grain X / Y, Match Up Grain, one step each; kept in the file only when set", () => {
  const o = boot({ script: SCENE + `
    return (async () => {
    const out = {}, row = (n) => app.ev("contextMenuRows")().find(x => x.n === "Materials").menu().find(x => x && x.n === n);
    out.rows = ["Reset to Basic Fabric", "Delete Texture", "Flip Texture Horizontally", "Flip Texture Vertically", "Reset Fabric Angle", "Align Grain X-Axis", "Align Grain Y-Axis", "Align Grain Parallel to Selected", "Match Up Grain", "Duplicate to Symmetric Pattern"].map(n => { const r = row(n); return !!r && !r.off && typeof r.f === "function"; });
    // a texture on the fabric (an image the page cannot draw: texPlace needs the picture, so the place is read through texPlace's own rule)
    const im = ev("addImage")("t.png", ["data", "image/png;base64,iVBORw0KGgo="].join(":"), 2, 2);
    S.lib.fabric[0].tex = { img: im.id, w: 50, h: 50 }; app.commit();
    S.sel = [A.id];
    const u0 = S.undo.length; ev("setMatch")([A], "texture"); out.tex = [A.match, S.undo.length - u0];
    ev("setMatch")([A], "lock"); out.lock = [A.match, !!A.matchAt];
    ev("setMatch")([A], ""); out.none = [A.match, A.matchAt];
    A.matchLock = true; app.commit();      // (Edit Texture refusing a locked pattern is the browser smoke's, group uv1, with the real mouse)
    // the Materials rows
    const lining = app.libAdd("fabric"); A.fabric = lining.id; app.commit();
    row("Reset to Basic Fabric").f(); out.basic = A.fabric === S.lib.fabric[0].id;
    row("Flip Texture Horizontally").f(); out.flip = JSON.stringify(A.texFlip); row("Flip Texture Horizontally").f(); out.unflip = A.texFlip;
    row("Align Grain X-Axis").f(); const g = ev("grainOf")(A); out.x = Math.abs(g.a.y - g.b.y) < 1e-6 && Math.abs(g.a.x - g.b.x) > 1;
    row("Reset Fabric Angle").f(); const g2 = ev("grainOf")(A); out.reset = Math.abs(g2.a.x - g2.b.x) < 1e-6;
    S.sel = [B.id]; row("Align Grain X-Axis").f(); S.sel = [A.id, B.id]; row("Match Up Grain").f(); const ga = ev("grainOf")(A); out.match = Math.abs(ga.a.y - ga.b.y) < 1e-6;
    S.sel = [A.id]; const u1 = S.undo.length; row("Delete Texture").f(); out.del = [!S.lib.fabric[0].tex, S.undo.length - u1];
    let bytes = null; app.setDownload((n, b) => { bytes = b; }); ev("saveDoc")(); await app.wait(() => bytes, "the file");
    const d = app.fileDoc(bytes); out.file = [d.pieces[0].matchLock, "match" in d.pieces[1], "texFlip" in d.pieces[1]];
    return out; })();` });
  assert.deepStrictEqual(o.rows, Array(10).fill(true), "every Materials row built");
  assert.deepStrictEqual(o.tex, ["texture", 1]);
  assert.deepStrictEqual(o.lock, ["lock", true]);
  assert.deepStrictEqual(o.none, [null, null], "both gone (undefined comes over as null)");
  assert.strictEqual(o.basic, true);
  assert.strictEqual(o.flip, '{"h":true}'); assert.strictEqual(o.unflip, undefined);
  assert.strictEqual(o.x, true); assert.strictEqual(o.reset, true); assert.strictEqual(o.match, true);
  assert.deepStrictEqual(o.del, [true, 1]);
  assert.deepStrictEqual(o.file, [true, false, false], "kept only when set");
});

module.exports = T;
