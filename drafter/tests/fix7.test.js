// Round POST8, FIX-7: menus and settings. A: Customize Tools (roadmap 1.T30): Group Tools, Rearrange Tools, Reset to Default, a tool set
// file; a preference of this computer (S.prefs.toolSet), never in a document, no undo step.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const fs = require("fs"), os = require("os"), f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fix7-")), "opt.json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  fs.unlinkSync(f); fs.rmdirSync(path.dirname(f));
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr + (r.error ? r.error.message : ""));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}

test("FIX-7 / A1: the tool set's moves: within a slot (the first tool is the one shown), onto another slot, into a gap as a slot of its own; an emptied slot goes; a whole slot along its toolbar; hide and show", () => {
  const o = boot({ blank: true, script: `
    const D = app.ev("toolSetDefault"), mv = app.ev("toolSetMove"), slot = app.ev("toolSetMoveSlot"), hide = app.ev("toolSetHide"), N = app.ev("normToolSet");
    const base = { "2D": D("2D"), "3D": D("3D"), hide: [] }, s2 = base["2D"];
    const ed = s2.findIndex(s => s.includes("edit_pattern")), a = s2[ed][0], b = s2[ed][1];
    const within = mv(base, "2D", b, ed, 0)["2D"][ed].slice(0, 2);
    const onto = mv(base, "2D", "transform_pattern", ed, 1)["2D"];
    const gap = mv(base, "2D", b, 0, undefined, true)["2D"];
    const one = s2.findIndex(s => s.length === 1), lone = s2[one][0], gone = mv(base, "2D", lone, ed)["2D"];
    const sl = slot(base, "2D", 0, 3)["2D"];
    const h = hide(base, "notch", true), h2 = hide(h, "notch", false);
    const wrong = mv(base, "2D", "simulate", ed)["2D"];
    return { a, b, within, ontoLen: [onto.length, s2.length], ontoAt: onto[ed - 1] && onto[ed - 1][1], gap0: gap[0], gapLen: [gap.length, s2.length], lone, goneLen: [gone.length, gone.some(s => s.includes(lone)), gone[ed - (one < ed ? 1 : 0)].slice(-1)[0]],
      sl: [sl[2][0], s2[0][0], sl[0][0], s2[1][0]], hide: [h.hide, h2.hide], wrongSame: JSON.stringify(wrong) === JSON.stringify(s2), baseUntouched: JSON.stringify(base["2D"]) === JSON.stringify(D("2D")), normDefault: N(base) };` });
  assert.deepStrictEqual(o.within, [o.b, o.a], "the second tool put first: it is the one the slot shows");
  assert.deepStrictEqual(o.ontoLen, [o.ontoLen[1] - 1, o.ontoLen[1]], "Transform Pattern's own slot emptied and gone");
  assert.strictEqual(o.ontoAt, "transform_pattern", "it went into Edit's slot at place 1");
  assert.deepStrictEqual(o.gap0, [o.b], "a slot of its own, first"); assert.strictEqual(o.gapLen[0], o.gapLen[1] + 1);
  assert.deepStrictEqual(o.goneLen.slice(0, 2), [o.goneLen[0], true]); assert.strictEqual(o.goneLen[2], o.lone, "at the end of the slot it was dropped on");
  assert.deepStrictEqual(o.sl, [o.sl[1], o.sl[1], o.sl[3], o.sl[3]], "the first slot moved to before the fourth (now the third)");
  assert.deepStrictEqual(o.hide, [["notch"], []]);
  assert.ok(o.wrongSame, "a 3D tool never goes onto the 2D toolbar (the reference: tools cannot be moved between the two)");
  assert.ok(o.baseUntouched, "a move returns a copy");
  assert.strictEqual(o.normDefault, null, "the registry's own layout with nothing hidden is no set");
});

test("FIX-7 / A2: a stored set is made whole: unknown, repeated and other-window ids dropped, empty slots gone, a tool it does not name back beside its registry group's tools (a newer version's tool), a hidden id kept only if it is a tool", () => {
  const o = boot({ blank: true, script: `
    const D = app.ev("toolSetDefault"), N = app.ev("normToolSet"), d2 = D("2D");
    const all = (s) => s.flat().sort().join(",");
    const ed = d2.find(s => s.includes("edit_pattern"));
    // Edit's slot without its last tool, a stranger, a 3D tool, a repeat, an empty slot
    const mine = { "2D": [["nope", "simulate", ...ed.slice(0, -1), ed[0]], [], ...d2.filter(s => s !== ed)], hide: ["notch", "nope"] };
    const n = N(mine), back = n["2D"].find(s => s.includes(ed[0]));
    return { same2: all(n["2D"]) === all(d2), same3: JSON.stringify(n["3D"]) === JSON.stringify(D("3D")), back: back.slice(-1)[0], last: ed.slice(-1)[0], hide: n.hide, slots: [n["2D"].length, d2.length],
      none: [N(null), N(5), N("x")] };` });
  assert.ok(o.same2, "every 2D tool once"); assert.ok(o.same3, "the 3D toolbar not named: the registry's");
  assert.strictEqual(o.back, o.last, "the tool the set left out is back in its group's slot");
  assert.deepStrictEqual(o.hide, ["notch"]); assert.deepStrictEqual(o.slots, [o.slots[1], o.slots[1]]);
  assert.deepStrictEqual(o.none, [null, null, null]);
});

test("FIX-7 / A3: OK in Group Tools rebuilds the toolbars from the set (GROUPS, the slot a tool is picked from, a hidden tool on no slot but its key still works); a preference: kept in pdraft:prefs, back on a fresh start; no undo step, nothing in a document", () => {
  const o = boot({ blank: true, script: `
    const D = app.ev("toolSetDefault"), mv = app.ev("toolSetMove"), put = app.ev("toolSetPut"), shown = app.ev("shownTools");
    const base = { "2D": D("2D"), "3D": D("3D"), hide: [] };
    const ed = base["2D"].findIndex(s => s.includes("edit_pattern"));
    const steps = S.undo.length;
    let set = mv(base, "2D", "edit_curvature", 0, undefined, true); set = app.ev("toolSetHide")(set, "edit_curve_point", true);
    put(set);
    const G = app.GROUPS, first = G.filter(g => g.win === "2D")[0].map(t => t.id), notchShown = G.some(g => shown(g).some(t => t.id === "edit_curve_point"));
    app.key("v"); const toolN = S.tool;
    const stored = JSON.parse(app.ev("localStorage").getItem("pdraft:prefs")).toolSet;
    const doc = app.ev("docJSON")();
    return { first, notchShown, toolN, stored: !!stored && stored.hide, steps: [steps, S.undo.length], inDoc: /toolSet|edit_curvature/.test(doc), gi: G.findIndex(g => g.some(t => t.id === "edit_curvature")) };` });
  assert.deepStrictEqual(o.first, ["edit_curvature"], "a slot of its own, the 2D toolbar's first");
  assert.strictEqual(o.notchShown, false, "hidden: on no slot");
  assert.strictEqual(o.toolN, "edit_curve_point", "its key (V) still picks it");
  assert.deepStrictEqual(o.stored, ["edit_curve_point"], "kept in the preferences");
  assert.deepStrictEqual(o.steps, [o.steps[0], o.steps[0]], "no undo step");
  assert.strictEqual(o.inDoc, false, "never in a document");
  // read back as a fresh start reads it (loadPrefs)
  const again = boot({ blank: true, script: `
    app.ev("localStorage").setItem("pdraft:prefs", JSON.stringify({ toolSet: { "2D": [["edit_curvature"]], hide: ["notch"] } }));
    const p = app.ev("loadPrefs")(); return [p.toolSet["2D"].find(s => s.includes("edit_curvature")).slice(0, 1), p.toolSet.hide, p.toolSet["2D"].flat().length === app.ev("toolSetDefault")("2D").flat().length];` });
  assert.deepStrictEqual(again, [["edit_curvature"], ["notch"], true]);
});

test("FIX-7 / A4: the rows: Settings ▸ Display ▸ Customize Tools ▸ Group Tools…, Rearrange Tools, Reset to Default (greyed while there is nothing to reset; asked first, as it cannot be undone); a toolbar's right-click has the same rows before More ▸; nothing greyed as not built", () => {
  const o = boot({ blank: true, script: `
    const rows = (w) => app.ev("customizeToolRows")(w).map(r => [r.n, !!r.off, r.note || ""]);
    const before = rows("2D");
    const D = app.ev("toolSetDefault"); app.ev("toolSetPut")({ "2D": D("2D"), "3D": D("3D"), hide: ["notch"] });
    const after = rows("3D");
    app.ev("toolSetResetAsk")(); const asked = !!app.ev("modalNow"); app.modalPick("y");
    const back = app.ev("S").prefs.toolSet;
    const disp = app.ev("menuDisplay")().find(r => r.n === "Customize Tools"), sub = disp.menu().map(r => r.n);
    const src = app.ev("String(wireLayout)");
    return { before, after, asked, back, sub, nb: disp.menu().some(r => /not built/.test(r.note || "") || r.nb), rail: /customizeToolRows[(]win[)]/.test(src) && /closest[(]".slot"[)]/.test(src) };` });
  assert.deepStrictEqual(o.before.map(r => r[0]), ["Group Tools…", "Rearrange Tools", "Reset to Default"]);
  assert.deepStrictEqual(o.before[2].slice(0, 2), ["Reset to Default", true], "nothing to reset");
  assert.strictEqual(o.after[2][1], false);
  assert.ok(o.asked, "Reset asks first"); assert.strictEqual(o.back, null, "and puts the registry's back");
  assert.deepStrictEqual(o.sub, ["Group Tools…", "Rearrange Tools", "Reset to Default"]);
  assert.strictEqual(o.nb, false); assert.ok(o.rail, "the toolbar's right-click, on its tools too");
});

test("FIX-7 / A5: the tool set file (our JSON): saved and read back the same; anything else is refused with why; Group Tools lists the window's slots with each tool and its eye, and switches to the 3D toolbar", () => {
  const o = boot({ blank: true, script: `
    const D = app.ev("toolSetDefault"), mv = app.ev("toolSetMove"), txt = app.ev("toolSetText"), rd = app.ev("toolSetRead");
    const set = app.ev("toolSetHide")(mv({ "2D": D("2D"), "3D": D("3D"), hide: [] }, "3D", "simulate", 2), "zipper", true);
    const t = txt(set), back = rd(t);
    app.ev("groupToolsDialog")("2D"); const h2 = app.ev("dlg").innerHTML;
    app.ev("GT").win = "3D"; app.ev("gtRender")(); const h3 = app.ev("dlg").innerHTML;
    return { same: JSON.stringify(back) === JSON.stringify(app.ev("normToolSet")(set)), head: JSON.parse(t).gusset, bad: [rd("{}"), rd("nope"), rd(JSON.stringify({ gusset: "library-item" }))],
      h2: [/data-id="edit_pattern"/.test(h2), /data-id="simulate"/.test(h2), (h2.match(/class="gt-slot"/g) || []).length, /data-eye="notch"/.test(h2), /Open…/.test(h2), /Save…/.test(h2)],
      h3: [/data-id="simulate"/.test(h3), /data-id="edit_pattern"/.test(h3)] };` });
  assert.ok(o.same); assert.strictEqual(o.head, "tool-set");
  assert.deepStrictEqual(o.bad, Array(3).fill("That is not a tool set file"));
  assert.deepStrictEqual(o.h2.slice(0, 2), [true, false], "the 2D toolbar's tools only");
  assert.ok(o.h2[2] > 5, "a framed box a slot"); assert.deepStrictEqual(o.h2.slice(3), [true, true, true]);
  assert.deepStrictEqual(o.h3, [true, false]);
});

test("FIX-7 / A6: Rearrange Tools is a mode: on, its row is ticked and the toolbar marked; a press off the toolbars, Esc or the row again ends it; a slot moved changes the set by that slot", () => {
  const o = boot({ blank: true, script: `
    const st = app.ev("TOOLSET_RE"), rows = () => app.ev("customizeToolRows")("2D")[1];
    app.ev("rearrangeStart")("3D"); const on = [st.win, rows().on];
    app.ev("rearrangeKey")({ key: "Escape", stopPropagation() {} }); const off = [st.win, rows().on];
    app.ev("rearrangeStart")("2D"); rows().f(); const off2 = st.win;
    const D = app.ev("toolSetDefault"), set = app.ev("toolSetMoveSlot")({ "2D": D("2D"), "3D": D("3D"), hide: [] }, "3D", 0, 2);
    return { on, off, off2, moved: [set["3D"][1][0], D("3D")[0][0], set["3D"][0][0], D("3D")[1][0]] };` });
  assert.deepStrictEqual(o.on, ["3D", true]); assert.deepStrictEqual(o.off, [null, false]); assert.strictEqual(o.off2, null);
  assert.deepStrictEqual(o.moved, [o.moved[1], o.moved[1], o.moved[3], o.moved[3]]);
});

/* ---------- B: the Display lists' greyed rows (roadmap 3.A21) ---------- */
const TWO3 = `
  const out = {}, G3 = app.G3, THREE = app.ev("THREE");
  app.ev("setLayout")("both");
  const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
  S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400));
  const A = S.pieces[0], B = S.pieces[1];
  A.p3 = { pos: [500, 1100, 120], q: [0, 0, 0, 1], r: 0 }; B.p3 = { pos: [500, 1100, -120], q: [0, 1, 0, 0], r: 0 };
  S.cloth = app.normCloth({ ...S.cloth, res: 25, substeps: 8, self: false, worker: false });
  app.commit(); app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;`;

test("FIX-7 / B1: Show Puckering and Show 2D Measurements lay a puckering's wave and a measurement on one pattern onto its cloth (one across two patterns stays 2D); Show Puckering on at first, Show 2D Measurements off; neither is picked as a line", () => {
  const o = boot({ blank: true, three: true, script: TWO3 + `
    const seg = A.segs[0]; app.ev("addPucker")({ piece: A.id, shape: 0, sids: [seg.id], t0: 0, t1: 1, rev: false }); app.commit();
    const an = (p, i) => app.ev("mkAnchor")(p, p, i);
    S.measures.push({ id: 1, a: an(A, 0), b: an(A, 2), kind: "line" }, { id: 2, a: an(A, 0), b: an(A, 2), kind: "along" }, { id: 3, a: an(A, 1), b: an(B, 0), kind: "line" }); app.commit(); app.ev("garmentSync")();
    const it = G3.items.get(A.id), L = app.ev("clothLineList")(A, it), kinds = L.map(l => l.kind + (l.kind === "meas" ? l.id : "")).filter(k => /pucker|meas/.test(k));
    const vis = () => { app.ev("clothLines")(); return G3.items.get(A.id).lines.filter(l => /pucker|meas/.test(l.kind)).map(l => l.kind + ":" + l.obj.visible); };
    const v0 = vis(); app.ev("setShow3")("meas3", true); app.ev("setShow3")("pucker3", false); const v1 = vis();
    const along = L.find(l => l.kind === "meas" && l.id === 2), straight = L.find(l => l.kind === "meas" && l.id === 1);
    const rows3 = app.ev("menuDisplay")().find(r => r.n === "3D Trims").menu().map(r => r.n + (r.off ? "(off)" : "")), rowsG = app.ev("menuDisplay")().find(r => r.n === "3D Garment").menu().map(r => r.n);
    return { kinds, v0, v1, lens: [along.an.length > straight.an.length], rows3, rowsG: rowsG.includes("Show 2D Measurements"), src: /l[.]kind === "pucker" [|][|] l[.]kind === "meas"/.test(app.ev("String(clothLineHit)")) };` });
  assert.deepStrictEqual(o.kinds.sort(), ["meas1", "meas2", "pucker"], "the measurement across two patterns is not on the cloth");
  assert.ok(o.v0.includes("pucker:true") && o.v0.filter(x => /meas/.test(x)).every(x => /false/.test(x)), JSON.stringify(o.v0));
  assert.ok(o.v1.includes("pucker:false") && o.v1.filter(x => /meas/.test(x)).every(x => /true/.test(x)), JSON.stringify(o.v1));
  assert.deepStrictEqual(o.lens, [true], "along the outline: round two sides, more points than straight across");
  assert.ok(o.rows3.includes("Show Bond/Skive") && o.rows3.includes("Show Puckering"), o.rows3.join(" | ")); assert.ok(o.rowsG);
  assert.ok(o.src, "never picked as a line");
});

test("FIX-7 / B2: Show Bond/Skive switches the glues on the cloth; on at first", () => {
  const o = boot({ blank: true, three: true, script: TWO3 + `
    S.glues = [{ id: 1, name: "Glue 1", kind: "area", a: A.id, b: B.id, poly: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 }], m: [1, 0, 400, 0, 1, 0] }]; app.commit(); app.ev("garmentSync")();
    const n = () => { app.ev("showTrims3")(); return app.view3d.group("trims").children.length; };
    const on = n(); app.ev("setShow3")("bond", false); const off = n();
    return { on, off, first: app.ev("show3")("bond") };` });
  assert.ok(o.on > 0, "the glue drawn while on"); assert.strictEqual(o.off, 0); assert.strictEqual(o.first, false, "switched off now");
});

test("FIX-7 / B3: Show Simulation Shrinkage draws a pattern's resting outline: Warp along its grainline, Weft across it; none at 100 / 100 or Solidified; a per-machine switch, off at first, left out of a file's display settings", () => {
  const o = boot({ blank: true, script: `
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("A", 0, 0, 200, 400)); const A = S.pieces[0]; A.grain = { a: { x: 100, y: 100 }, b: { x: 100, y: 300 } }; app.commit();
    const so = app.ev("simShrinkOutline"), box = (pts) => { const xs = pts.map(q => q.x), ys = pts.map(q => q.y); return [Math.round(Math.max(...xs) - Math.min(...xs)), Math.round(Math.max(...ys) - Math.min(...ys))]; };
    const none = so(A); A.shrink3 = { weft: 90, warp: 80 }; const s = so(A); A.solid3 = true; const sol = so(A); delete A.solid3;
    const first = !!S.show.shrink3, row = app.ev("menuDisplay")().find(r => r.n === "2D Pattern").menu().find(r => r.n === "Show Simulation Shrinkage");
    row.f(); const on = S.show.shrink3; app.ev("draw")();
    const disp = app.ev("displayOut")();
    return { none, size: box(s.pts), sol, first, on, inFile: JSON.stringify(disp).includes("shrink3") };` });
  assert.strictEqual(o.none, null); assert.deepStrictEqual(o.size, [180, 320], "200 wide × 90 % across the grain, 400 long × 80 % along it");
  assert.strictEqual(o.sol, null); assert.deepStrictEqual([o.first, o.on], [false, true]); assert.strictEqual(o.inFile, false);
});

test("FIX-7 / B4: Show Camera marks each custom view's camera in the 3D window (never in a render); Add Background Image puts a picture behind the 3D scene, proportions kept, for the session; Format 3D Background ▸ reset takes it away", () => {
  const o = boot({ blank: true, three: true, script: TWO3 + `
    const r = app.ev("loadRender")(); r.views = [{ name: "Side", az: 1.2, el: 0.3, dist: 3000, tx: 0, ty: 900, tz: 0 }, { name: "Top", az: 0, el: 1.2, dist: 2500, tx: 0, ty: 900, tz: 0 }]; app.ev("saveRender")(r);
    const g = app.view3d.group("cams3"), env = app.ev("cams3Marks");
    env(); const off = g.children.length; app.ev("setShow3")("cam3", true); env(); const on = g.children.length;
    const hide = app.ev("RENDER_HIDE").includes("cams3");
    const im = { naturalWidth: 400, naturalHeight: 100, width: 400, height: 100 };
    app.ev("bg3ImageSet")("photo.jpg", im); const sc = app.view3d.scene(), isTex = !!(sc.background && sc.background.isTexture);
    const row = app.ev("menuDisplay")().find(r => /Add Background Image/.test(r.n));
    app.ev("bg3ImageSet")(null, null); const back = !!(sc.background && sc.background.isColor);
    return { off, on, hide, isTex, row: [row.n, row.note, !!row.off], back, kept: !app.ev("UI_PREFS").includes("bgImg") };` });
  assert.deepStrictEqual([o.off, o.on], [0, 2], "a mark a view, only while switched on"); assert.ok(o.hide);
  assert.ok(o.isTex); assert.deepStrictEqual(o.row, ["Add Background Image…", "photo.jpg", false]); assert.ok(o.back);
});

test("FIX-7 / B5: the Display lists keep greyed only what is another round's or not known: with Show Tools That Are Not Built Yet off none of the rows built here is missing and none of theirs shows", () => {
  const o = boot({ blank: true, script: `
    S.ui.unbuilt = false;
    const flat = (rows) => rows.filter(Boolean).flatMap(r => r.menu ? [r.n + " >", ...flat(r.menu())] : [r.n]);
    const all = flat(app.ev("menuDisplay")());
    S.ui.unbuilt = true; const nb = flat(app.ev("menuDisplay")()).filter(n => /not built/.test(n));
    return { all, nb };` });
  for (const n of ["Show 2D Measurements", "Show Bond/Skive", "Show Puckering", "Show Simulation Shrinkage", "Show Camera", "Add Background Image…", "Group Tools…"]) assert.ok(o.all.includes(n), n);
  // what stays greyed: 3D pen (1.T45), the fitting suit's drape (FIX-8), trims as objects (IMP-1), wind and Show Grid (not known here), the other rounds' windows
  for (const n of o.nb) assert.ok(/3D Pen|Fitting Suit|All Trims|Trim Status|Wind|Show Grid|NURBS|Scene and Props|UV Editor|Grading Review|Colorway|Pattern Dr[a]fter|Modular Library|Animation|USD/.test(n), "greyed: " + n);
});

/* ---------- C: User Settings' last pages (roadmap 3.A20) ---------- */
test("FIX-7 / C1: Graphic Options: Antialiasing (on unless switched off) and Set Maximum Image Resolution for Rendering, which caps a render's and a 3D snapshot's size below what the card and the browser allow; the Settings box no longer resets the preferences it does not show", () => {
  const o = boot({ blank: true, script: `
    const N = app.ev("normPrefs"), d = N(null), bad = N({ aa: "x", renderMax: 1234 }), set = N({ aa: "off", renderMax: 2048 });
    const before = app.ev("pxMax3")();
    S.prefs = N({ ...S.prefs, renderMax: 2048 }); const capped = app.ev("pxMax3")(); S.prefs = N({ ...S.prefs, renderMax: null });
    // the box's change of one field keeps the tool set and Simulation Quality
    const D = app.ev("toolSetDefault"); app.ev("toolSetPut")(app.ev("toolSetMove")({ "2D": D("2D"), "3D": D("3D"), hide: [] }, "2D", "edit_curvature", 0, undefined, true));
    app.ev("setPrefs")({ simQuality: "high" });
    app.settingsDialog({ x: 10, y: 10 }); const html = app.ev("dlg").innerHTML;
    app.ev("dlg").onchange({});
    return { d: [d.aa, d.renderMax], bad: [bad.aa, bad.renderMax], set: [set.aa, set.renderMax], capped: [before >= 2048, capped], kept: [!!S.prefs.toolSet, S.prefs.simQuality],
      pages: [/data-spage="gfx"[^>]*>Graphic Options/.test(html), /data-spage="files"[^>]*>Default Files/.test(html), /data-p="aa"/.test(html), /data-p="renderMax"/.test(html), /set-defproj-pick/.test(html)] };` });
  assert.deepStrictEqual(o.d, ["on", null]); assert.deepStrictEqual(o.bad, ["on", null]); assert.deepStrictEqual(o.set, ["off", 2048]);
  assert.deepStrictEqual(o.capped, [true, 2048]);
  assert.deepStrictEqual(o.kept, [true, "high"], "a change in the box kept the preferences it does not show");
  assert.deepStrictEqual(o.pages, [true, true, true, true, true]);
});

test("FIX-7 / C2: Default Files ▸ Project File: File ▸ New Project starts from it as a new, unsaved project without its history; reset, New Project is blank again; a browser keeps at most 3 MB, the desktop app any size; a file that is no pattern file is refused", () => {
  const o = boot({ blank: true, script: `
    const sq = (n, x, y, w, h) => app.mkPiece(n, app.mkShape([{x:x,y:y},{x:x+w,y:y},{x:x+w,y:y+h},{x:x,y:y+h}], true));
    S.pieces.push(sq("Front", 0, 0, 300, 400), sq("Back", 400, 0, 300, 400)); app.commit(); app.commit();
    const bytes = new TextEncoder().encode(app.docJSON({ history: true }));
    const why = app.ev("defProjSet")("my start.pdraft", bytes), name = app.ev("defProjName")();
    S.pieces.length = 0; app.commit();
    app.ev("newDoc")(true);
    const made = [S.pieces.map(p => p.name), S.undo.length, !!S.dirty];
    const big = app.ev("defProjSet")("big.pdraft", new Uint8Array(4*1024*1024));
    app.ev("defProjSet")(null); app.ev("newDoc")(true);
    return { why, name, made, big, blank: S.pieces.length, gone: app.ev("defProjName")() };` });
  assert.strictEqual(o.why, ""); assert.strictEqual(o.name, "my start.pdraft");
  assert.deepStrictEqual(o.made, [["Front", "Back"], 0, false], "the file's patterns, no history, nothing unsaved");
  assert.ok(/Only in the desktop app/.test(o.big), o.big);
  assert.deepStrictEqual([o.blank, o.gone], [0, ""]);
});

test("FIX-7 / C3: File ▸ Open ▸ Tool Set… and Save As ▸ Tool Set… are built (Customize Tools' file); User Setting is built too since run 14d (FMT-1 / C)", () => {
  const o = boot({ blank: true, script: `
    const f = app.MENUS.file(), sub = (n) => f.find(x => x && x.n === n).menu().filter(Boolean);
    const row = (n, r) => { const x = sub(n).find(y => y.n && y.n.indexOf(r) === 0); return x ? [x.n, !!x.off, !!x.nb] : null; };
    return { open: row("Open", "Tool Set"), save: row("Save As", "Tool Set"), user: row("Open", "User Setting") };` });
  assert.deepStrictEqual(o.open, ["Tool Set\u2026", false, false]); assert.deepStrictEqual(o.save, ["Tool Set\u2026", false, false]);
  // (run 14d, FMT-1 / C: User Setting… is built, this computer's preferences as our JSON; it was "stays not built")
  assert.deepStrictEqual(o.user, ["User Setting…", false, false], "User Setting: built");
});

module.exports = T;
