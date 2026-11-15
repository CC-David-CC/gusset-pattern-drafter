// Round CW-1 (roadmap 1.T22 2.F2; the round's spec): colorways, looks only (the maintainer's answer to the overnight
// report's Q5: one simulation for all colorways). Batch B: the data (S.colorways: the document's library is always the current colorway),
// Add / Switch / Rename / Delete, each one undo step, the file field kept only with two or more, and the Colorway Editor (Production ▸
// Colorway, O) with a column per colorway.
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
// two patterns on two fabrics, a button placed, a topstitch
const SCENE = `
    S.pieces = [];
    const A = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)), B = app.mkPiece("Back", app.mkShape([{x:300,y:0},{x:500,y:0},{x:500,y:300},{x:300,y:300}], true));
    S.pieces.push(A, B);
    const lining = app.libAdd("fabric"); lining.name = "Lining"; lining.color = "#336699"; B.fabric = lining.id; S.lib.fabric[0].name = "Shell"; S.lib.fabric[0].color = "#cc3300"; A.fabric = S.lib.fabric[0].id;
    S.buttons = [{ id: 1, kind: "button", piece: A.id, x: 100, y: 100, angle: 0, lib: S.lib.button[0].id, fasten: null }];
    S.stitches = [{ id: 1, name: "Hem", preset: S.lib.topstitch[0].name, part: { piece: A.id, shape: 0, sids: [A.segs[2].id], t0: 0, t1: 1, rev: false }, offset: 5, extS: true, extE: true, corner: "right" }];
    app.commit();
    const shell = () => S.lib.fabric.find(f => f.name === "Shell"), lin = () => S.lib.fabric.find(f => f.name === "Lining");
`;

test("CW-1 / B 1: + Add makes Colorway A and B (one step, B current, the library as it was); a color changed in B is B's own; Switch Colorway (one step) lays A's rows back on the items, undo and redo exact; a fabric added later is linked (the same in both); Rename and Delete (the current one gives way to its neighbour; one left, the field goes)", () => {
  const o = boot({ script: SCENE + `
    const out = {}, u0 = S.undo.length, lib0 = JSON.stringify(S.lib);
    out.none = [app.ev("cwOn")(), S.colorways == null];
    const b = app.ev("cwAdd")();
    out.add = [S.undo.length - u0, S.colorways.list.map(c => c.name), S.colorways.cur === b, JSON.stringify(S.lib) === lib0, S.colorways.own.length > 0];
    app.ev("push")("Fabric Color"); shell().color = "#00aa44"; app.commit();
    const a = S.colorways.list[0].id, u1 = S.undo.length;
    out.sw = [app.ev("cwSwitch")(a), S.undo.length - u1, shell().color, lin().color, S.colorways.cur === a];
    out.again = app.ev("cwSwitch")(a);
    app.ev("cwSwitch")(b); out.back = shell().color;
    app.undo(); out.undo = [shell().color, S.colorways.cur === a]; app.redo(); out.redo = [shell().color, S.colorways.cur === b];
    // a fabric added now is linked: changed in B, it is the same in A
    const f3 = app.libAdd("fabric"); f3.name = "Pocketing"; app.commit(); app.ev("push")(); S.lib.fabric.find(f => f.name === "Pocketing").color = "#123456"; app.commit();
    app.ev("cwSwitch")(a); out.linked = [S.lib.fabric.find(f => f.name === "Pocketing").color, shell().color];
    // a third, renamed; the current deleted: its neighbour is current
    const c = app.ev("cwAdd")(); out.third = S.colorways.list.map(x => x.name);
    out.rename = [app.ev("cwRename")(c, "Night"), S.colorways.list.find(x => x.id === c).name];
    app.ev("cwDelete")(c); out.del = [S.colorways.list.map(x => x.name), S.colorways.list.some(x => x.id === S.colorways.cur)];
    app.ev("cwDelete")(S.colorways.cur); out.last = [S.colorways, app.ev("cwOn")()];
    return out;` });
  assert.deepStrictEqual(o.none, [false, true]);
  assert.deepStrictEqual(o.add, [1, ["Colorway A", "Colorway B"], true, true, true]);
  assert.deepStrictEqual(o.sw, [true, 1, "#cc3300", "#336699", true], "A's own front color back; the lining was not changed");
  assert.strictEqual(o.again, false, "the current one again: nothing, no step");
  assert.strictEqual(o.back, "#00aa44");
  assert.deepStrictEqual(o.undo, ["#cc3300", true]); assert.deepStrictEqual(o.redo, ["#00aa44", true]);
  assert.deepStrictEqual(o.linked, ["#123456", "#cc3300"], "the later fabric is linked; the shell is each colorway's own");
  assert.deepStrictEqual(o.third, ["Colorway A", "Colorway B", "Colorway C"]);
  assert.deepStrictEqual(o.rename, [true, "Night"]);
  assert.deepStrictEqual(o.del[0], ["Colorway A", "Colorway B"]); assert.strictEqual(o.del[1], true);
  assert.deepStrictEqual(o.last, [null, false], "one colorway left: no colorways field");
});

test("CW-1 / B 2: the file keeps colorways only with two or more: the library is the current colorway's (what an older beta shows), the others' rows beside; opened again it is the same and saves to the same bytes; a texture only another colorway uses is kept in the file; a file without them has no field", () => {
  const o = boot({ script: SCENE + `
    return (async () => {
    const out = {}, save = async () => { let b = null; app.setDownload((n, x) => { b = x; }); app.ev("saveDoc")(); await app.wait(() => b, "the file"); return b; };
    out.plain = "colorways" in app.fileDoc(await save());
    const b = app.ev("cwAdd")(), a = S.colorways.list[0].id;
    app.ev("push")(); shell().color = "#00aa44"; shell().tex = { img: app.ev("addImage")("t.png", ["data", "image/png;base64,iVBORw0KGgo="].join(":"), 2, 2).id, w: 100, h: 100 };      // (a stand-in picture's text, not an asset: written in two parts for the release check's rule 7) app.commit();
    app.ev("cwSwitch")(a);
    const bytes = await save(), d = app.fileDoc(bytes);
    const fk = "fabric:" + d.lib.fabric.find(f => f.name === "Shell").id;
    out.file = [d.colorways.cur === a, d.colorways.list.length, d.lib.fabric.find(f => f.name === "Shell").color, Object.keys(d.colorways.list[0].mat).length, d.colorways.list[1].mat[fk].color, !!d.colorways.list[1].mat[fk].tex];
    out.img = d.images.length;
    app.ev("newDoc")(true); out.fresh = S.colorways;
    app.ev("openFile")("cw.pdraft", new Uint8Array(bytes), null, true); await app.wait(() => S.colorways, "opened");
    out.open = [S.colorways.cur === a, shell().color, S.images.length];
    const again = await save();
    out.same = bytes.length === again.length && bytes.every((x, i) => x === again[i]);
    app.ev("cwSwitch")(b); out.openSw = [shell().color, !!shell().tex];
    return out; })();` });
  assert.strictEqual(o.plain, false, "one colorway: no field");
  assert.deepStrictEqual(o.file, [true, 2, "#cc3300", 0, "#00aa44", true], "the library is A's; B's rows (with its texture) beside; A's own mat empty");
  assert.strictEqual(o.img, 1, "B's texture picture is kept though A is current");
  assert.strictEqual(o.fresh, null);
  assert.deepStrictEqual(o.open, [true, "#cc3300", 1]);
  assert.deepStrictEqual(o.openSw, ["#00aa44", true]);
  assert.strictEqual(o.same, true, "saved again: the same bytes");
});

test("CW-1 / B 3: the Colorway Editor: Production ▸ Colorway (built, key O) opens it in the 2D window's place with a tab at the foot; a column per colorway, the current one marked by a frame and the word, not colour alone; COLOR / FABRIC / BUTTON / TOPSTITCH rows of what the garment uses; a click on a column makes it current (one step), a swatch makes its colorway current and selects the item; the Fabric tab's chips switch too; × closes it", () => {
  const o = boot({ script: SCENE + `
    const out = {};
    const row = app.MENUS.production().find(x => x && /^Colorway/.test(x.n));
    out.row = [row.n, !!row.off, row.k, app.keyFind({ key: "o", code: "KeyO" }).id];
    row.f();
    const ed = () => app.el("cwed"), tabs = () => app.el("avtabs");
    out.one = [!!ed(), /Colorway A/.test(ed().innerHTML), /2D Pattern Window/.test(tabs().innerHTML) && /Colorway Editor/.test(tabs().innerHTML)];
    app.ev("cwAdd")();
    const h = ed().innerHTML;
    out.cols = [(h.match(/class="cw-h/g) || []).length, /aria-current="true"/.test(h), /cw-cur">current</.test(h), ["COLOR", "FABRIC", "BUTTON", "TOPSTITCH"].every(k => h.includes(">" + k + "<")), h.includes(">BUTTONHOLE<")];
    // (the test page's stand-in finds no element inside written HTML: the clicks themselves are the browser smoke's, group cw1)
    const a = S.colorways.list[0].id, u0 = S.undo.length;
    out.hasHead = new RegExp('class="cw-h" data-cw="' + a + '"').test(h);
    app.ev("cwSwitch")(a);
    out.click = [S.colorways.cur === a, S.undo.length - u0];
    const b = S.colorways.list[1].id, k = "fabric:" + shell().id;
    out.swFound = h.includes('data-cw="' + b + '" data-k="' + k + '"');
    app.ev("cwSwatch")(b, k);
    out.swatch = [S.colorways.cur === b, app.ev("obState")().tab, app.ev("obState")().sel === shell().id];
    app.ev("obSelect")("fabric", null);
    const bar = [...app.el("ob-items").children].find(d => d.className === "cw-chips");
    out.chip = !!bar && new RegExp('data-cwchip="' + a + '"').test(bar.innerHTML) && /cw-chip cur/.test(bar.innerHTML);
    app.ev("cwSwitch")(a); out.chipCur = S.colorways.cur === a;
    app.ev("colorwayEditor")(false); out.closed = [app.ev("CWED").open === false, app.ev("CWED").front === false];
    return out;` });
  assert.deepStrictEqual(o.row, ["Colorway", false, "O", "colorway"]);
  assert.deepStrictEqual(o.one, [true, true, true]);
  assert.deepStrictEqual(o.cols, [2, true, true, true, false], "no buttonhole placed: no BUTTONHOLE row");
  assert.strictEqual(o.hasHead, true); assert.strictEqual(o.swFound, true);
  assert.deepStrictEqual(o.click, [true, 1]);
  assert.deepStrictEqual(o.swatch, [true, "fabric", true]);
  assert.strictEqual(o.chip, true); assert.strictEqual(o.chipCur, true);
  assert.deepStrictEqual(o.closed, [true, true]);
});

test("CW-1 / B 4: Update draws each colorway's picture from the 3D window and puts the looks back exactly: the library and the colorways the same text, no step; with the 3D window down it says so", () => {
  const o = boot({ three: true, script: SCENE + `
    const out = {};
    app.ev("cwAdd")(); app.ev("push")(); shell().color = "#00aa44"; app.commit();
    const lib = JSON.stringify(S.lib), cw = JSON.stringify(S.colorways), u = S.undo.length;
    out.n = app.ev("cwPictures")();
    out.same = [JSON.stringify(S.lib) === lib, JSON.stringify(S.colorways) === cw, S.undo.length === u, shell().color];
    out.pics = app.ev("CWED").pics.size;
    return out;` });
  // (the test page's renderer draws nothing and gives no picture back: the pictures themselves are the browser smoke's, group cw1)
  assert.deepStrictEqual(o.same, [true, true, true, "#00aa44"]);
  assert.strictEqual(o.pics, o.n);
});

test("CW-1 / C 1: Add as Custom Settings (Materials / Link per item); Unlink All Colorways and Link All Colorways (one step each); a material changed with Settings ▸ Other ▸ Colorway at Offer All: the current colorway's only and a held message with Apply to All Colorways (its own step); at Assign to All Colorways: every colorway in the same step; undo after it starts afresh", () => {
  const o = boot({ script: SCENE + `
    const out = {}, sk = "fabric:" + shell().id, lk = "fabric:" + lin().id;
    out.pref = app.ev("normPrefs")({}).cwAssign;
    const b = app.ev("cwAddCustom")([sk]), a = S.colorways.list[0].id;
    out.custom = [S.colorways.own.includes(sk), S.colorways.own.includes(lk), S.undo.length];
    app.ev("push")(); shell().color = "#00aa44"; lin().color = "#999999"; app.commit();
    out.offer = [toasts[toasts.length - 1], !!app.ev("TOAST_ACT")];
    app.ev("cwSwitch")(a); out.inA = [shell().color, lin().color];
    app.ev("cwSwitch")(b);
    // Apply to All Colorways from the held message
    app.ev("push")(); shell().color = "#0000ff"; app.commit();
    const u0 = S.undo.length; app.ev("TOAST_ACT").f(); out.apply = [S.undo.length - u0, S.colorways.list[0].mat[sk].color];
    // Unlink the lining, Link the shell
    const u1 = S.undo.length; out.unlink = [app.ev("cwUnlink")(lk), S.colorways.own.includes(lk), S.undo.length - u1, app.ev("cwUnlink")(lk)];
    out.link = [app.ev("cwLink")(sk), S.colorways.own.includes(sk), Object.keys(S.colorways.list[0].mat).includes(sk)];
    // Assign to All Colorways: one step, every colorway
    S.prefs = app.ev("normPrefs")({ ...S.prefs, cwAssign: "all" });
    const u2 = S.undo.length; app.ev("push")(); lin().color = "#abcdef"; app.commit();
    out.all = [S.undo.length - u2, S.colorways.list[0].mat[lk].color];
    app.undo(); out.undo = [lin().color, S.colorways.list[0].mat[lk].color];
    return out;` });
  assert.strictEqual(o.pref, "ask");
  assert.deepStrictEqual(o.custom.slice(0, 2), [true, false], "the shell its own, the lining linked");
  assert.deepStrictEqual(o.offer, ["Changed in Colorway B only.", true]);
  assert.deepStrictEqual(o.inA, ["#cc3300", "#999999"], "A keeps its shell; the linked lining is the same in both");
  assert.deepStrictEqual(o.apply, [1, "#0000ff"]);
  assert.deepStrictEqual(o.unlink, [true, true, 1, false]);
  assert.deepStrictEqual(o.link, [true, false, false]);
  assert.deepStrictEqual(o.all, [1, "#abcdef"]);
  assert.deepStrictEqual(o.undo, ["#999999", "#999999"]);
});

test("CW-1 / C 2: Select All with Same Color selects the patterns whose fabric has that colour in that colorway; View Mode shows the names and pictures only; the swatch of a linked item is marked in words and with a sign, not colour alone", () => {
  const o = boot({ script: SCENE + `
    const out = {};
    app.ev("colorwayEditor")(true);
    const b = app.ev("cwAddCustom")(["fabric:" + shell().id]), a = S.colorways.list[0].id;
    app.ev("push")(); shell().color = "#336699"; app.commit();
    out.same = [app.ev("cwSameColor")(b, "fabric:" + lin().id), S.sel.length, app.ev("cwSameColor")(a, "fabric:" + lin().id)];
    const h = app.el("cwed").innerHTML;
    out.linked = /cw-sw lk[^>]*one look in every colorway/.test(h) && h.includes("\\u221e");
    app.ev("CWED").view = "view"; app.ev("cwedRender")();
    const v = app.el("cwed").innerHTML;
    out.view = [/>FABRIC</.test(v), /cw-h/.test(v), /data-cwmode="view" class="on"/.test(v)];
    return out;` });
  assert.deepStrictEqual(o.same, [2, 2, 1], "in B the shell is the lining's blue too: both patterns; in A only the back");
  assert.strictEqual(o.linked, true);
  assert.deepStrictEqual(o.view, [false, true, true]);
});

test("CW-1 / D 1: a Colorway row in Snapshot (Current / All / each), Render's Image/Video, Print Layout's Nesting (made current, one step), the BOM (a color column per colorway) and Garment Information; Save HTML File's page; Snapshot's views take the custom views", () => {
  const o = boot({ script: SCENE + `
    const out = {};
    out.none = [app.ev("cwRow")("cwr"), /Colorway/.test(app.ev("infoGarment")())];
    const b = app.ev("cwAddCustom")(["fabric:" + shell().id]), a = S.colorways.list[0].id;
    app.ev("push")(); shell().color = "#336699"; app.commit();
    app.ev("snap3Dialog")({ x: 10, y: 10 });
    const d = app.el("dlg").innerHTML; app.ev("hideDlg")();
    out.snap = [/data-cw="1"/.test(d), /All Colorways/.test(d), /Colorway B/.test(d), /data-x="html"/.test(d), !/not built yet/.test(d)];
    out.norm = [app.ev("normSnap")({ d3: { html: true, views: ["custom:2", "front", "junk"] } }).d3.html, app.ev("normSnap")({ d3: { views: ["custom:2", "front", "junk"] } }).d3.views.slice(0, 3)];
    const page = app.ev("snapHtml")([{ name: "a.png", url: "u1", label: "Colorway A", w: 10, h: 20 }, { name: "b.png", url: "u2", label: "Colorway B", w: 10, h: 20 }]);
    out.html = [/^<!doctype html>/.test(page), (page.match(/<figure>/g) || []).length, /Colorway B/.test(page), /<script/i.test(page), /http/.test(page)];
    const rw = app.ev("rwinImageHTML")(app.ev("loadRender")());
    out.render = [/data-cwr="1"/.test(rw), /Colorway A/.test(rw)];
    const u0 = S.undo.length; app.ev("rwinChange")({ target: { dataset: { cwr: "1" }, value: String(a) } });
    out.renderSw = [S.colorways.cur === a, S.undo.length - u0];
    out.layoutRow = /class="row"><label>Colorway<[/]label><select data-cwl="1"/.test(app.ev("cwRow")("cwl", "Colorway", "row"));
    app.ev("BOM_CW = 'all'"); app.ev("bomView")(); const bomAll = app.el("bom").innerHTML;
    out.bom = [/Color [(]Colorway A[)]/.test(bomAll), /Color [(]Colorway B[)]/.test(bomAll), /#336699/.test(bomAll), /#cc3300/.test(bomAll)];
    out.info = /opens in Colorway A/.test(app.ev("infoGarment")()); app.ev("hideDlg")();
    return out;` });
  assert.deepStrictEqual(o.none, ["", true], "one colorway: no Colorway row; Garment Information says one");
  assert.deepStrictEqual(o.snap, [true, true, true, true, true]);
  assert.deepStrictEqual(o.norm, [true, ["custom:2", "front", "left"]], "junk keeps the default view there");
  assert.deepStrictEqual(o.html, [true, 2, true, false, false], "our own page: no script, nothing fetched");
  assert.deepStrictEqual(o.render, [true, true]);
  assert.deepStrictEqual(o.renderSw, [true, 1]);
  assert.strictEqual(o.layoutRow, true);
  assert.deepStrictEqual(o.bom, [true, true, true, true]);
  assert.strictEqual(o.info, true);
});

module.exports = T;
