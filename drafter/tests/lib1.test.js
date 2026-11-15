// Round LIB-1 (roadmap 1.T1 3.C16 2.D1; the round's spec): the library panel. Batch B: the panel shell and browsing
// (the tree Garment / Avatar / Fabric / Trim, the breadcrumb, Search for Keyword…, tiles / list, the sort, the session's view), filled with
// what ships and the user's own garments; an item used by a double-click / Enter / Add to Workspace by the code that does it elsewhere.
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

test("LIB-1 / B 1: the panel drops from its button with a tree of four categories (no Stage, no online sources, no account), Garment's folders as tiles, folders first; a folder shows its items as tiles with a drawn thumbnail; the breadcrumb, the search across a category's folders, the sort, tiles / list; the folder and view kept for the session", () => {
  const o = boot({ script: `
    const out = {}, set = app.ev("(o) => Object.assign(LIBUI, o)"), draw = () => app.ev("libDraw")();
    out.ret = app.ev("libraryDialog")(); const html = app.el("dlg").innerHTML;
    out.shell = [app.el("dlg").className, /class="lb-head dt">Library</.test(html), /id="lb-save"/.test(html), /id="lb-q"/.test(html), /data-v="tile"/.test(html) && /data-v="list"/.test(html), /Stage|Sign In|account/i.test(html)];
    out.cats = [...html.matchAll(/class="lb-tr cat[^"]*" role="treeitem" data-c="([a-z]+)"/g)].map(m => m[1]);
    const d0 = draw(); out.garment = [d0.cat, d0.folder, d0.folders, d0.items];
    // a folder: its items, sorted by name; the block's thumbnail its four patterns' outlines
    set({ path: ["garment", "blocks"] }); const d1 = draw(); out.blocks = [d1.folder, d1.items, (d1.html.match(/<path d="M/g) || []).length];
    set({ path: ["garment", "examples"] }); out.examples = draw().items;
    set({ path: ["trim", "button"] }); const d2 = draw(); out.buttons = [d2.items.length, d2.items[0], /class="lb-tile" data-k="trim[/]button[/]cat/.test(d2.html)];
    set({ path: ["fabric", "presets"] }); out.fabrics = draw().items;
    set({ path: ["avatar"] }); out.avatar = draw().folders;
    set({ path: ["avatar", "pose"] }); out.poses = draw().items;
    // the search at a category looks through all its folders; in a folder, only that folder; nothing found says so
    set({ path: ["garment"], q: "skirt" }); const s1 = draw(); out.search = [s1.folders, s1.items];
    set({ path: ["trim"], q: "coat" }); out.search2 = draw().items;
    set({ path: ["trim"], q: "nothing like it" }); out.none = /Nothing here is called/.test(draw().html);
    set({ path: ["trim", "zipper"], q: "" });
    // list view writes names in full; the view and the folder are kept when the panel opens again (the session's)
    set({ view: "list", path: ["garment", "examples"] }); const l = draw(); out.list = /Straight skirt on Jessica/.test(l.html);
    app.ev("hideDlg")(); app.ev("libraryDialog")(); const again = app.el("dlg").innerHTML;
    out.kept = [/class="lb-items list"/.test(again), /class="lb-tr sub on" role="treeitem" data-c="garment" data-f="examples"/.test(again), /class="lb-ib on" data-v="list"/.test(again)];
    // Y and File ▸ Library… still open it
    app.ev("hideDlg")(); out.key = [app.keyFind({ key: "y", code: "KeyY" }).id, app.MENUS.file().some(x => x && x.n === "Library…")];
    return out;` });
  assert.deepStrictEqual(o.ret, { blocks: 1, mine: 0 });
  assert.deepStrictEqual(o.shell, ["library drop", true, true, true, true, false]);
  assert.deepStrictEqual(o.cats, ["garment", "avatar", "fabric", "trim"], "Stage is left out: no empty shells");
  assert.deepStrictEqual(o.garment, ["garment", null, ["blocks", "examples"], []], "My Garments only once there is one");
  assert.deepStrictEqual(o.blocks, ["blocks", ["Straight skirt"], 4]);
  assert.deepStrictEqual(o.examples, ["Straight skirt on Jessica", "Straight skirt on Marty", "T-shirt on Marty"]);
  assert.deepStrictEqual(o.buttons, [12, "Blouse, 14 L (9 mm)", true]);
  assert.deepStrictEqual(o.fabrics, ["Heavy woven", "Light woven", "Medium woven", "Rib knit", "Single jersey"]);
  assert.deepStrictEqual(o.avatar, ["male", "female", "pose"]);
  assert.deepStrictEqual(o.poses, ["A-Pose", "Arms Down", "T-Pose"]);
  assert.deepStrictEqual(o.search, [[], ["Straight skirt", "Straight skirt on Jessica", "Straight skirt on Marty"]]);
  assert.deepStrictEqual(o.search2, ["Coat, 40 L (25 mm)", "Coat, square, 36 L (23 mm)"]);
  assert.strictEqual(o.none, true);
  assert.strictEqual(o.list, true);
  assert.deepStrictEqual(o.kept, [true, true, true]);
  assert.deepStrictEqual(o.key, ["library", true]);
});

test("LIB-1 / B 2: using an item: a garment opens the Open Garment box (Open by a double-click, Add by Add to Workspace); a fabric preset becomes a fabric of the document with its preset's rows (one step), or is given to the selected patterns; a catalogue button, a zipper kind, the default buttonhole each one step, selected in their tab; a pose with no avatar says so and makes no step", () => {
  const o = boot({ script: `
    const out = {}, items = () => app.ev("libFolders")().flatMap(f => f.items), find = (n) => items().find(i => i.name === n);
    let seen = null; app.answer = (t, f) => { seen = [t, f.find(x => x.k === "load").val]; return null; };
    app.ev("libraryDialog")();
    app.ev("libUse")(find("Straight skirt")); out.open = [seen, app.el("dlg").style.display !== "block" || !/library/.test(app.el("dlg").className)];
    seen = null; app.ev("libItemMenuRows")(find("T-shirt on Marty")).find(r => r.n === "Add to Workspace").f(); out.add = seen;
    // a fabric preset
    const u0 = S.undo.length, n0 = S.lib.fabric.length;
    app.ev("libUse")(find("Single jersey")); const f = S.lib.fabric[S.lib.fabric.length - 1];
    out.fabric = [S.lib.fabric.length - n0, S.undo.length - u0, f.name, f.physical, f.weight, f.thickness, f.maxStretch, app.ev("obState")().tab, app.ev("obState")().sel === f.id];
    app.undo(); out.undone = S.lib.fabric.length === n0;
    // given to the selected patterns (More ▸ Assign to Selected Patterns), none selected: no step
    const rows = app.ev("libItemMenuRows")(find("Heavy woven")), more = rows.find(r => r.n === "More").menu();
    out.fabricRows = [rows.filter(r => r.n).map(r => r.n), more.map(r => r.n)];
    S.sel = []; const u1 = S.undo.length; more[0].f(); out.noneSel = [S.undo.length - u1, toasts[toasts.length - 1]];
    const P = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)); S.pieces.push(P); app.commit(); S.sel = [P.id];
    more[0].f(); const g = S.lib.fabric[S.lib.fabric.length - 1]; out.assigned = [g.name, S.pieces[S.pieces.length - 1].fabric === g.id];
    // trims
    app.ev("libUse")(find("Coat, 40 L (25 mm)")); const b = S.lib.button[S.lib.button.length - 1]; out.button = [b.name, b.width, app.ev("obState")().tab];
    app.ev("libUse")(find("Metal zipper")); const z = S.lib.zipper[S.lib.zipper.length - 1]; out.zipper = [z.name, z.type, app.ev("obState")().tab];
    const bh0 = S.lib.buttonhole.length; app.ev("libUse")(find("Default Buttonhole")); out.buttonhole = [S.lib.buttonhole.length - bh0, app.ev("obState")().tab];
    // a pose needs an avatar
    const u2 = S.undo.length; app.ev("libUse")(find("T-Pose")); out.pose = [S.undo.length - u2, /Load an avatar/.test(toasts[toasts.length - 1])];
    // a shipped item's menu: W8's Add to Workspace, no path rows (no file of its own), More ▸ Open for a garment
    const br = app.ev("libItemMenuRows")(find("Straight skirt"));
    out.blockMenu = [br.filter(r => r.n).map(r => r.n), br.find(r => r.n === "More").menu().map(r => r.n)];
    out.avatarMenu = app.ev("libItemMenuRows")(find("Marty")).filter(r => r.n).map(r => r.n);
    return out;` });
  assert.deepStrictEqual(o.open, [["Open Garment", "open"], true], "the panel closes for the box");
  assert.deepStrictEqual(o.add, ["Open Garment", "add"]);
  assert.deepStrictEqual(o.fabric, [1, 1, "Single jersey", "Single jersey", 160, 0.5, 30, "fabric", true]);
  assert.strictEqual(o.undone, true);
  assert.deepStrictEqual(o.fabricRows, [["Add to Workspace", "More"], ["Assign to Selected Patterns"]]);
  assert.deepStrictEqual(o.noneSel, [0, "Select the patterns to give this fabric to"]);
  assert.deepStrictEqual(o.assigned, ["Heavy woven", true]);
  assert.deepStrictEqual(o.button, ["Coat, 40 L (25 mm)", 25, "button"]);
  assert.deepStrictEqual(o.zipper, ["Metal zipper", "Metal", "zipper"]);
  assert.deepStrictEqual(o.buttonhole, [1, "buttonhole"]);
  assert.deepStrictEqual(o.pose, [0, true]);
  assert.deepStrictEqual(o.blockMenu, [["Add to Workspace", "More"], ["Open"]]);
  assert.deepStrictEqual(o.avatarMenu, ["Add to Workspace"]);
});

test("LIB-1 / B 3: one's own garments: Save to Library… with the panel open shows My Garments at once, its tile drawn from the document, dated; More ▸ Delete takes it out; Enter uses the selected tile; a click only selects (no step)", () => {
  const o = boot({ streams: true, script: `
    return (async () => {
    const out = {}, set = app.ev("(o) => Object.assign(LIBUI, o)");
    S.pieces.push(app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)), app.mkPiece("Back", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:300},{x:300,y:300}], true))); app.commit();
    app.ev("libraryDialog")();
    let file = null; app.setDownload((n) => { file = n; });
    app.ev("saveToLibrary")("Two panels"); await app.wait(() => file, "the file");
    set({ path: ["garment"] }); const d = app.ev("libDraw")(); out.folders = d.folders;
    set({ path: ["garment", "mine"] }); const m = app.ev("libDraw")(); out.mine = [m.items, (m.html.match(/<path d="M/g) || []).length === S.pieces.length, new RegExp(new Date().toISOString().slice(0, 10)).test(m.html)];
    // Enter on the selected tile: its use (the Open Garment box)
    const it = app.ev("libFolders")().flatMap(f => f.items).find(i => i.name === "Two panels"), key = app.ev("libItemKey")(it);
    const u0 = S.undo.length; set({ sel: key }); out.selStep = S.undo.length - u0;
    let seen = null; app.answer = (t) => { seen = t; return null; };
    app.ev("dlgEsc")({ key: "Enter", target: { tagName: "DIV" }, stopPropagation() {}, preventDefault() {} }); out.enter = seen;
    // More ▸ Delete
    app.ev("libraryDialog")(); set({ path: ["garment", "mine"] });
    app.ev("libItemMenuRows")(it).find(r => r.n === "More").menu().find(r => r.n === "Delete").f();
    set({ path: ["garment"] }); out.after = [app.ev("myPatterns")().length, app.ev("libDraw")().folders];
    return out; })();` });
  assert.deepStrictEqual(o.folders, ["blocks", "examples", "mine"]);
  assert.deepStrictEqual(o.mine, [["Two panels"], true, true], "an outline a pattern in its thumbnail");
  assert.strictEqual(o.selStep, 0);
  assert.strictEqual(o.enter, "Open Garment");
  assert.deepStrictEqual(o.after, [0, ["blocks", "examples"]]);
});

test("LIB-1 / C 1: items of one's own: Add to Library on the Object Browser's … menu and a drop on the panel keep a document's fabric in Fabric ▸ My Fabrics or a folder of one's own; New Folder… / Rename… / Delete on one's own folders (shown empty), Delete asked first when it holds something; an item's More ▸ Rename…, Move to, Delete; used, it is a fabric of the document again (one step); the store pdraft:libitems, junk left out", () => {
  const o = boot({ script: `
    const out = {}, set = app.ev("(o) => Object.assign(LIBUI, o)"), draw = () => app.ev("libDraw")(), items = () => app.ev("libFolders")().flatMap(f => f.items);
    app.ev("libraryDialog")();
    // a fabric of the document, made from a preset, then kept in the library by its … menu
    const fab = app.ev("libUseFabric")("Rib knit"); fab.name = "My rib";
    const rows = app.ev("libItemRows")("fabric", fab); out.obRows = rows.filter(r => r.n).map(r => r.n);
    const u0 = S.undo.length; rows.find(r => r.n === "Add to Library").f(); out.noStep = S.undo.length - u0;
    set({ path: ["fabric"] }); out.fabFolders = draw().folders;
    set({ path: ["fabric", "myfab"] }); out.myfab = [draw().items, /kept in the library [(]Fabric ▸ My Fabrics[)]/.test(toasts[toasts.length - 1])];
    // a folder of one's own: shown with nothing in it; the tree's right-click on a category offers New Folder…
    out.catRows = app.ev("libFolderRows")("fabric", "").filter(r => r.n).map(r => r.n);
    const wf = app.ev("libFolderNew")("fabric", "Wools"); out.newFolder = [app.ev("() => LIBUI.path")(), draw().items, /Nothing here yet/.test(draw().html)];
    // dropped from the Object Browser on that folder's tile (the drop's target inside it)
    set({ path: ["fabric"] });
    const ev = { dataTransfer: { getData: () => "fabric:" + fab.id }, target: { closest: (s) => (s === "[data-f]" ? { dataset: { f: wf.id } } : null) } };
    app.ev("libPanelDrop")(ev);
    set({ path: ["fabric", wf.id] }); out.inWools = draw().items;
    out.ownRows = app.ev("libFolderRows")("fabric", wf.id).filter(r => r.n).map(r => r.n);
    app.ev("libFolderRename")(wf.id, "Wool cloth"); set({ path: ["fabric"] }); out.renamed = app.ev("libFolders")().filter(f => f.cat === "fabric").map(f => f.name);
    // an item's More ▸: Rename…, Move to, Delete
    const it = items().find(i => i.own && i.folder === "myfab"), more = app.ev("libItemMenuRows")(it).find(r => r.n === "More").menu();
    out.more = more.filter(r => r.n).map(r => r.n);
    app.ev("libItemRenameOwn")(it.id, "Rib, mine");
    more.find(r => r.n === "Move to").menu().find(r => r.n === "Wool cloth").f();
    set({ path: ["fabric", wf.id] }); out.moved = draw().items;
    // used: a fabric of the document again, with the kept rows, one step, selected in its tab
    const mine = items().find(i => i.name === "Rib, mine"), n0 = S.lib.fabric.length, u1 = S.undo.length;
    app.ev("libUse")(mine); const g = S.lib.fabric[S.lib.fabric.length - 1];
    out.used = [S.lib.fabric.length - n0, S.undo.length - u1, g.name, g.physical, g.weight, g.id !== fab.id, app.ev("obState")().tab, app.ev("obState")().sel === g.id];
    // the store, as kept
    const st = JSON.parse(app.ev("() => kv().getItem('pdraft:libitems')")()); out.store = [st.v, st.folders.map(f => [f.cat, f.name]), st.items.map(i => [i.kind, i.name, i.folder === wf.id])];
    out.norm = app.ev("normLibStore")({ folders: [{ id: "x", cat: "fabric", name: "bad id" }, { id: "u3", cat: "stage", name: "no such category" }, { id: "u4", cat: "trim", name: " Buttons " }], items: [{ id: "i1", kind: "garment", name: "not a kind", data: "" }, { id: "i2", kind: "button", name: "B", folder: "u4", data: "{}" }, { id: "i2", kind: "button", name: "twice", data: "{}" }] });
    // Delete on a folder holding something asks first; Cancel keeps it, Delete takes it with what is in it
    const modal = app.ev("() => !!modalNow");
    app.ev("libFolderDelete")(wf.id); out.asked = modal();
    app.ev("modalPick")("x"); out.kept = app.ev("libStore")().folders.length;
    app.ev("libFolderDelete")(wf.id); app.ev("modalPick")("del"); out.gone = [app.ev("libStore")().folders.length, app.ev("libStore")().items.length];
    // an empty folder of one's own goes without asking
    const e1 = app.ev("libFolderNew")("trim", "Empty"); app.ev("libFolderDelete")(e1.id); out.emptyGone = [!modal(), app.ev("libStore")().folders.length];
    return out;` });
  assert.deepStrictEqual(o.obRows, ["Duplicate", "Rename…", "Export…", "Import…", "Add to Library", "Delete"]);
  assert.strictEqual(o.noStep, 0, "the library is no document: no undo step");
  assert.deepStrictEqual(o.fabFolders, ["presets", "myfab"]);
  assert.deepStrictEqual(o.myfab, [["My rib"], true]);
  assert.deepStrictEqual(o.catRows, ["New Folder…"]);
  assert.strictEqual(o.newFolder[0][0], "fabric");
  assert.deepStrictEqual(o.newFolder.slice(1), [[], true], "one's own folder is shown with nothing in it");
  assert.deepStrictEqual(o.inWools, ["My rib"]);
  assert.deepStrictEqual(o.ownRows, ["New Folder…", "Rename…", "Delete"]);
  assert.deepStrictEqual(o.renamed, ["Presets", "Wool cloth", "My Fabrics"]);
  // (Round LIB-1 / D, on purpose: a fabric of one's own has Assign to Selected Patterns first, as a shipped preset's More has)
  assert.deepStrictEqual(o.more, ["Assign to Selected Patterns", "Rename…", "Move to", "Delete"]);
  assert.deepStrictEqual(o.moved, ["My rib", "Rib, mine"]);
  assert.deepStrictEqual(o.used, [1, 1, "Rib, mine", "Rib knit", 240, true, "fabric", true]);
  assert.deepStrictEqual(o.store, [1, [["fabric", "Wool cloth"]], [["fabric", "Rib, mine", true], ["fabric", "My rib", true]]]);      // (the first kept, renamed and moved; then the one dropped)
  assert.deepStrictEqual(o.norm.folders, [{ id: "u4", cat: "trim", name: "Buttons", date: "" }]);
  assert.deepStrictEqual(o.norm.items, [{ id: "i2", kind: "button", folder: "u4", name: "B", date: "", data: "{}" }]);
  assert.strictEqual(o.norm.next, 5);
  assert.strictEqual(o.asked, true);
  assert.strictEqual(o.kept, 1);
  assert.deepStrictEqual(o.gone, [0, 0]);
  assert.deepStrictEqual(o.emptyGone, [true, 0]);
});

test("LIB-1 / C 2: garments in folders of one's own (Save to Library… into the folder in view, More ▸ Move to, Rename…), with a thumbnail when one can be drawn (none in a page that cannot draw, none with Save with Thumbnail off); files copied in (a pattern, a library item, a pose, an OBJ; an avatar left out and said why) into folders of the chosen folder's name per category; what a file is; an accessory of one's own needs an avatar; the preferences' defaults", () => {
  const o = boot({ streams: true, script: `
    return (async () => {
    const out = {}, set = app.ev("(o) => Object.assign(LIBUI, o)"), draw = () => app.ev("libDraw")();
    S.pieces.push(app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true))); app.commit();
    app.ev("libraryDialog")();
    const sk = app.ev("libFolderNew")("garment", "Skirts");
    out.plus = app.ev("libPlusRows")().filter(r => r.n).map(r => r.n);
    let file = null; app.setDownload((n) => { file = n; });
    app.ev("saveToLibrary")("Into skirts"); await app.wait(() => file, "the file");
    out.saved = app.ev("myPatterns")().map(e => [e.name, e.folder === sk.id]);
    set({ path: ["garment", sk.id] }); out.inSkirts = draw().items;
    set({ path: ["garment"] }); out.gFolders = draw().folders;
    const it = app.ev("libFolders")().flatMap(f => f.items).find(i => i.name === "Into skirts"), more = app.ev("libItemMenuRows")(it).find(r => r.n === "More").menu();
    out.gMore = more.filter(r => r.n).map(r => r.n);
    more.find(r => r.n === "Move to").menu().find(r => r.n === "My Garments").f();
    out.movedOut = app.ev("myPatterns")().map(e => [e.name, e.folder || ""]);
    app.ev("libGarmentRename")("Into skirts", "A front"); out.gRenamed = app.ev("myPatterns")().map(e => e.name);
    // the picture: off draws none; this page cannot draw, so none either way (the tile is drawn from the patterns)
    out.prefs = [S.prefs.libThumb, S.prefs.thumbBeside, app.ev("normPrefs")({ libThumb: false, thumbBeside: true }).libThumb, app.ev("normPrefs")({ thumbBeside: true }).thumbBeside];
    // (the URIs made from parts: release check rule 7 counts a data URI written out in a released file)
    const png = ["data", "image/png;base64,"].join(":");
    out.thumbOk = app.ev("libThumbOf")({ thumb: png + "iVBORw0KGgo=" }).startsWith('<img alt="" src="' + png); out.thumbBad = app.ev("libThumbOf")({ thumb: png + 'x" onerror="1' });
    S.prefs.libThumb = false; out.off = app.ev("libThumbPng")(); S.prefs.libThumb = true;
    // what a file is
    const K = app.ev("libFileKind");
    out.kinds = [K("a.pdraft", ""), K("a.glb", ""), K("a.obj", ""), K("a.txt", ""), K("p.json", '{"gusset":"pose","v":1'), K("b.json", '{"gusset":"library-item","v":1,"kind":"button"'), K("x.json", '{"gusset":"library-item","v":1,"kind":"accessory"'), K("d.json", '{"pieces":[]'), K("q.json", '{"gusset":"other"}')];
    // files copied in, into folders called "Kit" (one per category)
    const enc = (s) => new TextEncoder().encode(s), doc = JSON.parse(app.ev("docJSON")());
    const btn = app.ev("libItemText")("button", { ...S.lib.button[0], name: "Kit button" });
    const pose = JSON.stringify({ gusset: "pose", v: 1, name: "Kit pose", q: { root: [0, 0, 0, 1] } });
    const obj = "v 0 0 0\\nv 10 0 0\\nv 0 10 0\\nf 1 2 3\\n";
    app.ev("libImportTake")([{ name: "kit-front.json", kind: "garment", bytes: enc(JSON.stringify(doc)) }, { name: "kit.button.json", kind: "button", bytes: enc(btn) }, { name: "kit.pose.json", kind: "pose", bytes: enc(pose) }, { name: "hat.obj", kind: "accessory", bytes: enc(obj) }], [["body.glb", "avatar"]], "Kit");
    await app.wait(() => app.ev("myPatterns")().some(e => e.name === "kit-front"), "the garment");
    const kits = app.ev("libStore")().folders.filter(f => f.name === "Kit");
    out.kits = kits.map(f => f.cat).sort();
    out.kitItems = app.ev("libFolders")().filter(f => f.name === "Kit").map(f => [f.cat, f.items.map(i => i.name)]).sort();
    out.pose = S.poses.some(p => p.name === "Kit pose");
    out.said = /Added to the library: 4 items. Left out: body.glb [(]an avatar/.test(toasts[toasts.length - 1]);
    // an accessory of one's own needs an avatar; used with none, it says so and makes no step
    const acc = app.ev("libFolders")().flatMap(f => f.items).find(i => i.kind === "accessory"), u0 = S.undo.length;
    app.ev("libUse")(acc); out.acc = [S.undo.length - u0, /Load an avatar first/.test(toasts[toasts.length - 1]), app.ev("libItemMenuRows")(acc)[1].n];
    return out; })();` });
  assert.deepStrictEqual(o.plus, ["Add Folder…", "New Folder…", "Save to Library…"]);
  assert.deepStrictEqual(o.saved, [["Into skirts", true]], "into the folder of one's own in view");
  assert.deepStrictEqual(o.inSkirts, ["Into skirts"]);
  assert.deepStrictEqual(o.gFolders.slice(0, 2), ["blocks", "examples"]);
  assert.strictEqual(o.gFolders.length, 3, "My Garments has nothing yet: Blocks, Examples and Skirts");
  assert.deepStrictEqual(o.gMore, ["Open", "Rename…", "Move to", "Delete"]);
  assert.deepStrictEqual(o.movedOut, [["Into skirts", ""]]);
  assert.deepStrictEqual(o.gRenamed, ["A front"]);
  assert.deepStrictEqual(o.prefs, [true, false, false, true]);
  assert.strictEqual(o.thumbOk, true);
  assert.strictEqual(o.thumbBad, "", "only a plain PNG's base64 is put into the page");
  assert.strictEqual(o.off, "");
  assert.deepStrictEqual(o.kinds, ["garment", "avatar", "accessory", "", "pose", "button", "", "garment", ""]);
  assert.deepStrictEqual(o.kits, ["avatar", "garment", "trim"]);
  assert.deepStrictEqual(o.kitItems, [["avatar", ["hat"]], ["garment", ["kit-front"]], ["trim", ["Kit button"]]]);
  assert.strictEqual(o.pose, true);
  assert.strictEqual(o.said, true);
  assert.deepStrictEqual(o.acc, [0, true, "Add to Avatar"]);
});

test("LIB-1 / D 1: an item dragged out of the panel: a fabric dropped on a pattern gives it that fabric (added first, one step; the same again reuses it); a button type dropped on a placed button gives it that type (one step); a garment on the 2D window opens Open Garment with Add; dropped where it does not go, it says where (no step); on the Object Browser a trim is added; tiles are draggable; a fabric of one's own: Assign to Selected Patterns", () => {
  const o = boot({ script: `
    return (async () => {
    const out = {}, items = () => app.ev("libFolders")().flatMap(f => f.items), find = (n) => items().find(i => i.name === n), key = app.ev("libItemKey");
    const cv = app.ev("() => cv")(), ob = app.el("ob"), other = { closest: () => null };
    const drop = (it, target, x, y) => app.ev("libItemDrop")({ dataTransfer: { getData: (t) => (t === "${"application/x-pdraft-libitem"}" ? key(it) : "") }, target, clientX: x || 0, clientY: y || 0 });
    S.pieces = []; const P = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)); S.pieces.push(P); app.commit();
    const at = app.ev("toS")({ x: 100, y: 150 }), r = cv.getBoundingClientRect(), sx = at.x + r.left, sy = at.y + r.top;
    // a fabric preset onto the pattern: one step, the pattern has it, selected in the Fabric tab
    const n0 = S.lib.fabric.length, u0 = S.undo.length;
    await drop(find("Heavy woven"), cv, sx, sy);
    const f = S.lib.fabric[S.lib.fabric.length - 1];
    out.fabric = [S.lib.fabric.length - n0, S.undo.length - u0, f.name, S.pieces[0].fabric === f.id, app.ev("obState")().tab];
    // the same again: the equal fabric is reused (no second one), still one step
    S.pieces[0].fabric = null; const u1 = S.undo.length; await drop(find("Heavy woven"), cv, sx, sy);
    out.again = [S.lib.fabric.length - n0, S.undo.length - u1, S.pieces[0].fabric === f.id];
    app.undo(); out.undone = S.pieces[0].fabric == null;
    // off the pattern: says where it goes, no step
    const u2 = S.undo.length; await drop(find("Light woven"), cv, 2, 2); out.off = [S.undo.length - u2, /Drop a fabric on a pattern/.test(toasts[toasts.length - 1])];
    // a button type onto a placed button
    S.buttons = [{ id: 1, kind: "button", piece: P.id, x: 100, y: 100, angle: 0, lib: S.lib.button[0] ? S.lib.button[0].id : 1, fasten: null }]; app.commit();
    const bat = app.ev("toS")({ x: 100, y: 100 }), b0 = S.lib.button.length, u3 = S.undo.length;
    await drop(find("Coat, 40 L (25 mm)"), cv, bat.x + r.left, bat.y + r.top);
    const bt = S.lib.button[S.lib.button.length - 1];
    out.button = [S.lib.button.length - b0, S.undo.length - u3, bt.name, S.buttons[0].lib === bt.id];
    // a garment on the 2D window: the Open Garment box, Add chosen
    let seen = null; app.answer = (t, fl) => { seen = [t, fl.find(x => x.k === "load").val]; return null; };
    await drop(find("Straight skirt"), cv, sx, sy); out.garment = seen;
    // an avatar dropped on the 2D window: says to use the 3D window
    await drop(find("Marty"), cv, sx, sy); out.avatar = /on the 3D window/.test(toasts[toasts.length - 1]);
    // a zipper kind on the Object Browser: added; elsewhere: says so
    const z0 = S.lib.zipper.length; await drop(find("Coil zipper"), ob, 0, 0);
    out.ob = S.lib.zipper.length - z0;
    await drop(find("Coil zipper"), other, 0, 0); out.zipOff = /Object Browser/.test(toasts[toasts.length - 1]);
    // the panel's tiles are draggable
    app.ev("libraryDialog")(); app.ev("(o) => Object.assign(LIBUI, o)")({ path: ["fabric", "presets"] }); app.ev("libDraw")();
    out.draggable = /draggable/.test(app.el("dlg").innerHTML) || [...(app.el("dlg").querySelectorAll ? app.el("dlg").querySelectorAll(".lb-tile[data-k]") : [])].every(t => t.draggable === true);
    // a fabric of one's own: Assign to Selected Patterns, one step
    const fab = S.lib.fabric[0]; app.ev("libAddFromScene")("fabric", { ...fab, name: "Own twill" });
    const own = items().find(i => i.name === "Own twill"); S.sel = [P.id]; const u4 = S.undo.length;
    app.ev("libItemMenuRows")(own).find(rw => rw.n === "More").menu().find(rw => rw.n === "Assign to Selected Patterns").f();
    out.assign = [S.undo.length - u4, app.ev("fabricOf")(S.pieces[0]).name];
    return out; })();` });
  assert.deepStrictEqual(o.fabric, [1, 1, "Heavy woven", true, "fabric"]);
  assert.deepStrictEqual(o.again, [1, 1, true], "the equal fabric reused");
  assert.strictEqual(o.undone, true);
  assert.deepStrictEqual(o.off, [0, true]);
  assert.deepStrictEqual(o.button, [1, 1, "Coat, 40 L (25 mm)", true]);
  assert.deepStrictEqual(o.garment, ["Open Garment", "add"]);
  assert.strictEqual(o.avatar, true);
  assert.strictEqual(o.ob, 1);
  assert.strictEqual(o.zipOff, true);
  assert.strictEqual(o.draggable, true);
  assert.deepStrictEqual(o.assign, [1, "Own twill"]);
});

test("LIB-1 / E 1: Register Button / Register Buttonhole / Register OBJ (Materials/UV, built rows now): a mesh made a new type, in mm, its up axis turned to y, centred, standing on y = 0, its Width the mesh across (a button's Thickness its height); one step, selected in its tab, kept in the library panel too; the mesh kept through a file's save and open and only when set; Remove takes it off (one step); junk refused", () => {
  const o = boot({ script: `
    return (async () => {
    const out = {}, items = () => app.ev("libFolders")().flatMap(f => f.items);
    // the rows: built, not behind the not-built switch
    const mat = app.MENUS.materials ? app.MENUS.materials() : [];
    const sub = (n) => { const r = mat.find(x => x && x.n === n); return r && r.menu ? r.menu() : []; };
    out.rows = [sub("Button").filter(r => r && /Register/.test(r.n || "")).map(r => [r.n, !!r.off]), sub("Zipper").filter(r => r && /Register/.test(r.n || "")).map(r => [r.n, !!r.off])];
    // a box 20 x 30 (x, y) and 4 mm along z, in cm, z up
    const obj = ["v 0 0 0", "v 2 0 0", "v 2 3 0", "v 0 3 0", "v 0 0 0.4", "v 2 0 0.4", "v 2 3 0.4", "v 0 3 0.4", "f 1 2 3 4", "f 5 6 7 8", "f 1 2 6 5", "f 3 4 8 7"].join("\\n");
    const m = app.ev("objParse")(obj), u0 = S.undo.length, b0 = S.lib.button.length;
    const t = app.ev("trimRegister")("button", "toggle.obj", m, "cm", "z");
    out.button = [S.undo.length - u0, S.lib.button.length - b0, t.name, t.width, t.thickness, app.ev("obState")().tab, app.ev("obState")().sel === t.id, !!t.mesh];
    const g = app.ev("accGeom")(t.mesh), P = Array.from(g.P), ax = (k) => P.filter((v, i) => i % 3 === k);
    out.box = [Math.min(...ax(1)), +Math.max(...ax(1)).toFixed(3), +Math.min(...ax(0)).toFixed(3), +Math.max(...ax(0)).toFixed(3), +Math.min(...ax(2)).toFixed(3), +Math.max(...ax(2)).toFixed(3), g.I.length/3];
    out.inLib = items().some(i => i.own && i.kind === "button" && i.name === "toggle");
    // a buttonhole and a zipper
    const h = app.ev("trimRegister")("buttonhole", "eyelet.obj", m, "mm", "y"), z = app.ev("trimRegister")("zipper", "slider.obj", m, "mm", "y");
    out.others = [h.width, !!h.mesh, !!z.mesh, z.name, app.ev("obState")().tab];
    // through a file: kept
    let bytes = null; app.setDownload((n, b) => { bytes = b; }); app.ev("saveDoc")(); await app.wait(() => bytes, "the file");
    const d = app.fileDoc(bytes); out.file = [!!(d.lib.button.find(x => x.name === "toggle") || {}).mesh, !!(d.lib.zipper.find(x => x.name === "slider") || {}).mesh, !!(d.lib.button[0] || {}).mesh];
    // the Property Editor's Remove: one step, the type drawn by its Shape again
    const u1 = S.undo.length; S.lib.button.find(x => x.id === t.id).mesh && (() => { app.ev("push")("Remove Mesh"); delete S.lib.button.find(x => x.id === t.id).mesh; app.commit(); })();
    out.removed = [S.undo.length - u1, !S.lib.button.find(x => x.id === t.id).mesh];
    // junk is not a mesh
    out.junk = [app.ev("normTrimMesh")({ pos: "!!", idx: "AAAA" }), app.ev("normTrimMesh")(null), app.ev("normLibItem")("button", { mesh: { pos: 1 } }, 9).mesh === undefined];
    // the 3D drawing: a placed button of a mesh type is that mesh (three: the page's 3D window is up)
    return out; })();` });
  assert.deepStrictEqual(o.rows, [[["Register Button…", false], ["Register Buttonhole…", false]], [["Register OBJ…", false]]]);
  assert.deepStrictEqual(o.button, [1, 1, "toggle", 30, 4, "button", true, true], "30 mm across (y of the file lies across now), 4 mm high");
  assert.deepStrictEqual(o.box, [0, 4, -10, 10, -15, 15, 8], "z up turned to y, centred across, standing on 0; four quads, eight triangles");
  assert.strictEqual(o.inLib, true);
  assert.deepStrictEqual(o.others, [2, true, true, "slider", "zipper"], "the same box in mm, y up: 2 mm across (x), 0.4 (z)");
  assert.deepStrictEqual(o.file, [true, true, false], "kept in the file, only where set");
  assert.deepStrictEqual(o.removed, [1, true]);
  assert.deepStrictEqual(o.junk, [null, null, true]);
});

test("LIB-1 / E 2: in the 3D window a placed button of a registered type is drawn as its mesh (its points, its triangles), one of a plain type as before", () => {
  const o = boot({ three: true, script: `
    const out = {};
    S.pieces = []; const P = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)); S.pieces.push(P); app.commit();
    const m = app.ev("objParse")(["v 0 0 0", "v 10 0 0", "v 0 10 0", "v 0 0 3", "f 1 2 3", "f 1 2 4", "f 2 3 4", "f 1 3 4"].join("\\n"));
    const t = app.ev("trimRegister")("button", "cone.obj", m, "mm", "z"), plain = S.lib.button[0];
    S.buttons = [{ id: 1, kind: "button", piece: P.id, x: 100, y: 100, angle: 0, lib: t.id, fasten: null }, { id: 2, kind: "button", piece: P.id, x: 100, y: 200, angle: 0, lib: plain.id, fasten: null }]; app.commit();
    app.ev("showButtons3")();
    const g = app.ev("() => view3d.group('buttons3')")(), kids = (g && g.children) || [];
    const one = kids.find(c => c.userData.btn === 1), two = kids.find(c => c.userData.btn === 2);
    out.mesh = one ? [one.geometry.attributes.position.count, one.geometry.index ? one.geometry.index.count/3 : 0] : null;
    out.plain = two ? two.geometry.type : null;
    return out;` });
  assert.deepStrictEqual(o.mesh, [4, 4]);
  assert.ok(/Cylinder/.test(o.plain || ""), o.plain);
});

test("Q2 (the maintainer's answer, guess post8/75): a button's and a buttonhole's registered mesh is a choice of its Shape list, not a row of its own (the zipper keeps its Mesh row); Shape ▸ Mesh… registers onto the type (one step, no new type); Round / Square takes the mesh away (one step); a file with a mesh beside its stored shape opens and saves the same", () => {
  const o = boot({ script: `
    return (async () => {
    const out = {};
    const m = app.ev("objParse")(["v 0 0 0", "v 10 0 0", "v 0 10 0", "v 0 0 3", "f 1 2 3", "f 1 2 4", "f 2 3 4", "f 1 3 4"].join("\\n"));
    const t = app.ev("trimRegister")("button", "cone.obj", m, "mm", "z");
    const html = (kind, it) => { const pr = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null }; app.ev("libProps")(pr, kind, it); return pr.innerHTML; };
    const h = html("button", t);
    out.list = [/<option value="__mesh" selected>Mesh: cone [(]4 triangles[)]/.test(h), /<summary>Mesh<[/]summary>/.test(h), /lp-mesh-reg/.test(h)];
    const plain = S.lib.button[0], hp = html("button", plain);
    out.plain = [/<option value="__mesh">Mesh…<[/]option>/.test(hp), /<option selected>Round<[/]option>/.test(hp)];
    const z = app.ev("trimRegister")("zipper", "slider.obj", m, "mm", "y");
    out.zip = /<summary>Mesh<[/]summary>/.test(html("zipper", z));
    // onto a type that is there: one step, no new type, its width from the mesh
    const n0 = S.lib.button.length, u0 = S.undo.length;
    const r = app.ev("trimRegister")("button", "cone.obj", m, "mm", "z", plain);
    out.onto = [S.undo.length - u0, S.lib.button.length - n0, r === plain, !!plain.mesh, plain.shape, plain.width];
    // Square on a type with a mesh: the mesh goes, one step
    const u1 = S.undo.length; app.ev("trimShapeSet")("button", plain, "Square");
    out.square = [S.undo.length - u1, !!plain.mesh, plain.shape];
    const u2 = S.undo.length; app.ev("trimShapeSet")("button", plain, "Square");
    out.same = S.undo.length - u2;
    // a file: the type with its mesh and its stored shape Round opens as it was and saves to the same bytes
    let a = null; app.setDownload((n, b) => { a = b; }); app.ev("saveDoc")(); await app.wait(() => a, "the file");
    const d = app.fileDoc(a), bt = d.lib.button.find(x => x.name === "cone");
    out.file = [!!bt.mesh, bt.shape];
    app.ev("newDoc")(true); out.fresh = S.lib.button.some(x => x.name === "cone");
    app.ev("openFile")("q2.pdraft", new Uint8Array(a), null, true); await app.wait(() => S.lib.button.some(x => x.name === "cone"), "opened");
    let b = null; app.setDownload((n, x) => { b = x; }); app.ev("saveDoc")(); await app.wait(() => b, "the second file");
    out.again = canonDoc(app.fileDoc(a)) === canonDoc(app.fileDoc(b));
    function canonDoc(x) { const y = JSON.parse(JSON.stringify(x)); delete y.saved; delete y.modified; return JSON.stringify(y.lib); }
    return out; })();` });
  assert.deepStrictEqual(o.list, [true, false, false], "the mesh is the Shape's selected choice; no Mesh row");
  assert.deepStrictEqual(o.plain, [true, true]);
  assert.strictEqual(o.zip, true, "the zipper has no Shape list: its Mesh row stays");
  assert.deepStrictEqual(o.onto.slice(0, 5), [1, 0, true, true, "Round"]);
  assert.ok(o.onto[5] > 0);
  assert.deepStrictEqual(o.square, [1, false, "Square"]);
  assert.strictEqual(o.same, 0, "the same shape again: no step");
  assert.deepStrictEqual(o.file, [true, "Round"], "the mesh beside its stored shape, as LIB-1 / E wrote it");
  assert.strictEqual(o.again, true);
});

module.exports = T;
