// Run 15 / part 1, roadmap 3.A2 (the maintainer's answer to run 14d's Q1): File ▸ Save As ▸ Project (with Other Files) (one .zip with the
// project and every file it uses, read back by Open, Add and a drop), Save As ▸ Avatar and Add ▸ Avatar.
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
// two sewn rectangles, a background image and an IES light
const DOC = `
  const out = {}, R = (n, ...a) => app.ev(n)(...a);
  const sq = (x) => R("mkShape", [{ x, y: 0 }, { x: x + 100, y: 0 }, { x: x + 100, y: 100 }, { x, y: 100 }], true);
  app.push("Two");
  const A = R("mkPiece", "Front", sq(0)), B = R("mkPiece", "Back", sq(200));
  S.pieces.push(A, B);
  S.seams.push(R("makeSeam", S.seams, { piece: A.id, shape: 0, sids: [A.segs[1].id] }, { piece: B.id, shape: 0, sids: [B.segs[3].id] }, true));
  const PNG = "data:" + "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  S.images.push({ id: 7, name: "wall.png", data: PNG, w: 1, h: 1 });
  S.backdrop = R("normBackdrop", { img: 7, x: 0, y: 0, w: 100, h: 100, opacity: 0.5 }, S.images);
  S.lights = R("normLights", [{ id: 1, type: "ies", ies: { name: "street.ies", text: "IESNA:LM-63-2002\\nTILT=NONE\\n" } }]);
  app.commit();
  const grab = (fn) => { let got = null, name = null; app.setDownload((n, b) => { got = b; name = n; }); fn(); app.setDownload(null); return { name, bytes: got }; };
  const parts = (b) => { let q = null; app.ev("zipUnpack")(b, (e, p) => { q = p; }); return q; };
`;

test("run15 / 1: Save As ▸ Project (with Other Files) writes one .zip: the project as Save As writes it, and beside it every picture, IES profile and accessory as files of their own", () => {
  const o = boot({ blank: true, script: DOC + `
    const z = grab(() => R("projectBundleSave"));
    out.name = z.name;
    const p = parts(z.bytes);
    out.files = [...p.keys()].sort();
    const inner = p.get(out.files.find(n => /[.]pdraft$/.test(n)));
    const d = app.fileDoc(inner);
    out.inner = [d.pieces.map(x => x.name), d.seams.length, (d.images || []).length];
    out.ies = new TextDecoder().decode(p.get("ies/street.ies"));
    out.png = p.get("textures/wall.png").length;
    out.toast = toasts[toasts.length - 1];
    return out;` });
  assert.strictEqual(o.name, "gusset (with other files).zip");
  assert.deepStrictEqual(o.files, ["gusset.pdraft", "ies/street.ies", "textures/wall.png"]);
  assert.deepStrictEqual(o.inner, [["Front", "Back"], 1, 1], "the project inside is whole, its picture in it too");
  assert.ok(/^IESNA/.test(o.ies));
  assert.ok(o.png > 60);
  assert.ok(/2 other files/.test(o.toast), o.toast);
});

test("run15 / 2: Open reads a Project (with Other Files) .zip back as the project inside it; Add / Open ▸ Garment read it too (readDocBytes); a .zip without a project is refused as before", () => {
  const o = boot({ blank: true, script: DOC + `
    const z = grab(() => R("projectBundleSave")).bytes;
    let d = null; R("readDocBytes", "x.zip", z, (e, x) => { d = [e, x && x.pieces.map(q => q.name)]; });
    out.read = d;
    S.pieces.length = 0; S.seams.length = 0; app.commit(); R("markClean");
    R("openFile", "x.zip", z, null, true);
    out.open = [S.pieces.map(q => q.name), S.seams.length, !!S.backdrop, (S.lights || []).length];
    // a zip of pictures only (Surface Textures) is no project
    const t = grab(() => R("surfaceTexturesSave")).bytes;
    let e2 = null; R("readDocBytes", "t.zip", t, (e) => { e2 = e; });
    out.bad = e2;
    return out;` });
  assert.deepStrictEqual(o.read, [null, ["Front", "Back"]]);
  assert.deepStrictEqual(o.open, [["Front", "Back"], 1, true, 1]);
  assert.ok(/not a pattern file/.test(o.bad), o.bad);
});

test("run15 / 3: Save As ▸ Avatar… writes the avatar's own file as loaded (refused with no avatar); the File menu's rows: Save As ▸ Project (with Other Files)… and Avatar…, Add ▸ Avatar…, Trim still not built", () => {
  const o = boot({ blank: true, script: DOC + `
    out.none = grab(() => R("avatarSaveFile")).bytes === null && /no avatar/.test(toasts[toasts.length - 1]);
    S.av = { name: "Own", file: { name: "own.glb", buf: new Uint8Array([1, 2, 3, 4]).buffer } };
    const a = grab(() => R("avatarSaveFile"));
    out.av = [a.name, Array.from(a.bytes)];
    S.av = null;
    const rows = app.MENUS.file(), sub = (n) => rows.find(x => x && x.n === n).menu().filter(Boolean);
    const live = (n) => sub(n).filter(x => x.n && !x.nb).map(x => x.n), nb = (n) => sub(n).filter(x => x.nb).map(x => x.n);
    out.rows = [live("Save As").filter(n => /^(Project|Avatar)/.test(n)), live("Add").filter(n => /^Avatar/.test(n)), nb("Save As").filter(n => /^(Trim|Avatar)/.test(n))];
    return out;` });
  assert.strictEqual(o.none, true);
  assert.deepStrictEqual(o.av, ["own.glb", [1, 2, 3, 4]]);
  assert.deepStrictEqual(o.rows, [["Project", "Project (with Other Files)…", "Avatar…"], ["Avatar…"], ["Trim (not built yet)"]]);
});

module.exports = T;
