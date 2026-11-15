// Run 14d, roadmap FMT-1 (3.A2): File ▸ Open / Add / Save As ▸ Garment, Garment (Selected), Pattern (the maintainer's answer to run 14c's Q3:
// the File ▸ Save As / Open rows first, then the exports).
"use strict";
const FV = require("./harness").FILE_VERSION;
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
// three rectangles: A–B sewn, B–C sewn; a measurement on C; a 3D place for each
const DOC = `
  const out = {}, R = (n, ...a) => app.ev(n)(...a);
  const sq = (x) => R("mkShape", [{ x, y: 0 }, { x: x + 100, y: 0 }, { x: x + 100, y: 100 }, { x, y: 100 }], true);
  app.push("Three");
  const A = R("mkPiece", "A", sq(0)), B = R("mkPiece", "B", sq(200)), C = R("mkPiece", "C", sq(400));
  S.pieces.push(A, B, C);
  S.seams.push(R("makeSeam", S.seams, { piece: A.id, shape: 0, sids: [A.segs[1].id] }, { piece: B.id, shape: 0, sids: [B.segs[3].id] }, true));
  S.seams.push(R("makeSeam", S.seams, { piece: B.id, shape: 0, sids: [B.segs[1].id] }, { piece: C.id, shape: 0, sids: [C.segs[3].id] }, true));
  app.commit();
  const grab = (fn) => { let got = null, name = null; app.setDownload((n, b) => { got = b; name = n; }); fn(); app.setDownload(null); return { name, bytes: got }; };
  const parts = (b) => { let q = null; app.ev("zipUnpack")(b, (e, p) => { q = p; }); return q; };
  const sum = (b) => { const d = app.fileDoc(b), p = parts(b); return { v: d.v, pieces: d.pieces.map(x => x.name), seams: d.seams.length, p3: d.pieces.map(x => !!x.p3), avatar: !!(d.scene && d.scene.avatar), files: [...p.keys()].sort() }; };
`;

test("fmt1 / B1: Save As ▸ Garment, Garment (Selected) and Pattern write a pattern file of the garment alone: the patterns (all or the selected), the sewing wholly on them, no avatar, no history; Pattern without 3D places or drape; Garment (Selected) refuses with nothing selected", () => {
  const o = boot({ blank: true, script: DOC + `
    out.none = grab(() => R("garmentSave", "sel")).bytes === null && /Select the patterns/.test(toasts[toasts.length - 1]);
    const all = grab(() => R("garmentSave", "all")); out.all = [all.name, sum(all.bytes)];
    S.sel = [A.id, B.id];
    const sel = grab(() => R("garmentSave", "sel")); out.sel = [sel.name, sum(sel.bytes)];
    const pat = grab(() => R("garmentSave", "pattern")); out.pat = [pat.name, sum(pat.bytes)];
    S.sel = [];
    out.patAll = sum(grab(() => R("garmentSave", "pattern")).bytes).pieces;
    // the project itself is unchanged and still saved whole
    out.doc = [S.pieces.length, S.seams.length];
    const rows = app.MENUS.file(), sub = (n) => rows.find(x => x && x.n === n).menu().filter(x => x && x.n && !x.nb).map(x => x.n);
    out.rows = [sub("Open"), sub("Add"), sub("Save As")].map(L => L.filter(n => /^(Garment|Pattern)/.test(n)));
    return out;` });
  assert.strictEqual(o.none, true);
  assert.strictEqual(o.all[0], "garment (garment).pdraft");
  assert.deepStrictEqual(o.all[1].pieces, ["A", "B", "C"]);
  assert.strictEqual(o.all[1].seams, 2);
  assert.strictEqual(o.all[1].v, FV);
  assert.strictEqual(o.all[1].avatar, false);
  assert.ok(!o.all[1].files.includes("history.json"), "no history: " + o.all[1].files);
  assert.deepStrictEqual(o.sel[1].pieces, ["A", "B"]);
  assert.strictEqual(o.sel[1].seams, 1, "only the seam wholly on the selected patterns");
  assert.deepStrictEqual(o.pat[1].pieces, ["A", "B"], "Pattern: the selected ones");
  assert.deepStrictEqual(o.pat[1].p3, [false, false], "no 3D places");
  assert.ok(!o.pat[1].files.includes("drape.bin"));
  assert.deepStrictEqual(o.patAll, ["A", "B", "C"], "nothing selected: all");
  assert.deepStrictEqual(o.doc, [3, 2]);
  assert.deepStrictEqual(o.rows, [["Garment…", "Pattern…"], ["Garment…", "Pattern…"], ["Garment…", "Garment (Selected)…", "Pattern…"]]);
});

test("fmt1 / B2: Open ▸ / Add ▸ Garment and Pattern go through the Open Garment box: Add puts the file's patterns and their sewing beside what is there with new ids (one step), Open makes it the document; a Pattern's patterns come without their 3D places", () => {
  const o = boot({ blank: true, script: DOC + `
    S.sel = [A.id, B.id];
    const g = grab(() => R("garmentSave", "sel")).bytes, p = grab(() => R("garmentSave", "pattern")).bytes;
    let d = null; R("readDocBytes", "g.pdraft", g, (e, x) => { d = x; });
    let asked = null; app.answer = (title, fields) => { asked = [title, fields.find(f => f.k === "load").val]; return { load: "add", x: 0, y: 0, z: 0, unit: "mm" }; };
    const n0 = S.un.length;
    R("garmentTake", "g.pdraft", d, "add", false);
    out.add = [asked, S.pieces.length, S.seams.length, S.un.length - n0, new Set(S.pieces.map(q => q.id)).size];
    // a pattern file added: 3D places made afresh from 2D (the file had none)
    R("readDocBytes", "p.pdraft", p, (e, x) => { d = x; });
    out.flatIn = d.pieces.map(q => !!q.p3);
    R("garmentTake", "p.pdraft", d, "add", true);
    out.addP = [S.pieces.length, S.seams.length];
    // Open: the file is the document
    R("readDocBytes", "g.pdraft", g, (e, x) => { d = x; });
    app.answer = () => ({ load: "open", x: 0, y: 0, z: 0, unit: "mm" });
    R("garmentTake", "g.pdraft", d, "open", false);
    out.open = [S.pieces.map(q => q.name), S.seams.length];
    return out;` });
  assert.deepStrictEqual(o.add[0], ["Open Garment", "add"]);
  assert.deepStrictEqual(o.add.slice(1), [5, 3, 1, 5], "two patterns and one seam more, new ids, one step");
  assert.deepStrictEqual(o.flatIn, [false, false]);
  assert.deepStrictEqual(o.addP, [7, 4]);
  assert.deepStrictEqual(o.open, [["A", "B"], 1]);
});

test("fmt1 / C1: Save As / Open ▸ Render Properties, Camera Projection, Camera Transformation and User Setting: each saved as our JSON and opened back, the settings as they were saved; a file of another kind refused; Surface Textures: every picture the project uses in one .zip", () => {
  // (a one-pixel picture, its URL made at run time: release check rule 7 refuses an embedded picture URL in a released file)
  const PNG = ["da", "ta:image/png;base64,", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="].join("");
  const o = boot({ blank: true, three: true, script: DOC + `
    const text = (fn) => { let t = null; app.setDownload((n, b) => { t = [n, typeof b === "string" ? b : new TextDecoder().decode(b)]; }); fn(); app.setDownload(null); return t; };
    // Render Properties: a few rows changed, saved, changed again, opened
    const o0 = R("loadRender"); R("saveRender", { ...o0, samples: 77, fov: 33, bg: "color" });
    const rp = text(() => R("setFileSave", "render"));
    R("saveRender", { ...R("loadRender"), samples: 12, fov: 50, bg: "none" });
    const n0 = S.un.length;
    out.render = [rp[0], JSON.parse(rp[1]).gusset, R("setFileText", "render", rp[1], "r.json"), R("loadRender").samples, R("loadRender").fov, R("loadRender").bg, S.un.length - n0];
    // Camera Projection: only the lens
    R("saveRender", { ...R("loadRender"), fov: 20, samples: 200 });
    const cp = text(() => R("setFileSave", "camP"));
    R("saveRender", { ...R("loadRender"), fov: 60, samples: 300 });
    R("setFileText", "camP", cp[1]); out.camP = [R("loadRender").fov, R("loadRender").samples];
    // Camera Transformation
    const cam = app.ev("view3d").cam; Object.assign(cam, { az: 0.7, el: 0.2, dist: 2500, tx: 10, ty: 900, tz: -5 });
    const ct = text(() => R("setFileSave", "camT"));
    Object.assign(cam, { az: 0, el: 0, dist: 1500, tx: 0, ty: 0, tz: 0 });
    R("setFileText", "camT", ct[1]); out.camT = [cam.az, cam.el, cam.dist, cam.tx, cam.ty, cam.tz];
    // User Setting
    app.ev("setPrefs")({ unit: "cm", decimals: 2, wheelRev: true });
    const us = text(() => R("setFileSave", "user"));
    app.ev("setPrefs")({ unit: "mm", decimals: 1, wheelRev: false });
    R("setFileText", "user", us[1]); out.user = [S.prefs.unit, S.prefs.decimals, S.prefs.wheelRev, S.unit];
    // the wrong kind
    out.wrong = [R("setFileText", "user", ct[1]), /not a User Setting file/.test(toasts[toasts.length - 1]), R("setFileText", "camT", "{}")];
    // Surface Textures: none, then a fabric's texture and a graphic's picture
    out.noTex = [grab(() => R("surfaceTexturesSave")).bytes, /uses no pictures/.test(toasts[toasts.length - 1])];
    S.images.push({ id: "im1", name: "denim.png", data: "${PNG}", w: 1, h: 1 }, { id: "im2", name: "denim.png", data: "${PNG}", w: 1, h: 1 });
    S.lib.fabric[0].tex = { img: "im1", w: 100, h: 100 }; (S.pieces[0].graphics = S.pieces[0].graphics || []).push({ id: 1, img: "im2", x: 0, y: 0, w: 10, h: 10 });
    const z = grab(() => R("surfaceTexturesSave"));
    out.tex = [z.name, [...parts(z.bytes).keys()].sort()];
    return out;` });
  assert.deepStrictEqual(o.render, ["garment render properties.json".replace("garment", "gusset"), "render-properties", true, 77, 33, "color", 0], "back as saved; no undo step");
  assert.deepStrictEqual(o.camP, [20, 300], "the lens only");
  assert.deepStrictEqual(o.camT, [0.7, 0.2, 2500, 10, 900, -5]);
  assert.deepStrictEqual(o.user, ["cm", 2, true, "cm"]);
  assert.deepStrictEqual(o.wrong, [false, true, false]);
  assert.deepStrictEqual(o.noTex, [null, true]);
  assert.deepStrictEqual(o.tex, ["gusset textures.zip", ["denim-2.png", "denim.png"]], "each picture once, under its own name");
});

test("fmt1 / C2: Save As / Open ▸ Hand Pose: Marty's hand bones only (the hand and its fingers); opened, only his hands turn back as saved, one undo step, the arms as they stand", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, R = (n, ...a) => app.ev(n)(...a), TH = app.ev("THREE");
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      const H = R("handBones", S.av), names = [...H];
      out.bones = [H.size, names.some(n => /hand_l/.test(n)), names.some(n => /hand_r/.test(n)), names.some(n => /index|thumb/.test(n)), names.some(n => /lowerarm|upperarm/.test(n))];
      // a hand curled by a joint edit, saved
      const finger = names.find(n => /index_01_l/.test(n)) || names.find(n => /_l$/.test(n) && !/hand/.test(n));
      app.push("Curl"); S.avedit = R("normAvEdit", { ...S.avedit, joints: { [finger]: new TH.Quaternion().setFromAxisAngle(new TH.Vector3(0, 0, 1), 1).toArray() } }); app.commit();
      const was = S.av.bones.get(finger).quaternion.toArray();
      let t = null; app.setDownload((n, b) => { t = b; }); R("setFileSave", "hand"); app.setDownload(null);
      const saved = JSON.parse(t);
      out.saved = [saved.gusset, Object.keys(saved.q).every(k => H.has(k)), Object.keys(saved.q).length === H.size];
      // straightened, and the arm turned: opening the hand pose curls the finger again and leaves the arm
      const arm = [...S.av.bones.keys()].find(n => /lowerarm_l/.test(n));
      app.push("Other"); S.avedit = R("normAvEdit", { ...S.avedit, joints: { [arm]: new TH.Quaternion().setFromAxisAngle(new TH.Vector3(1, 0, 0), 0.5).toArray() } }); app.commit();
      const armWas = S.av.bones.get(arm).quaternion.toArray();
      const n0 = S.un.length;
      out.ok = R("setFileText", "hand", t, "h.json");
      const now = S.av.bones.get(finger).quaternion.toArray(), armNow = S.av.bones.get(arm).quaternion.toArray();
      out.finger = Math.max(...now.map((v, i) => Math.abs(v - was[i])));
      out.arm = Math.max(...armNow.map((v, i) => Math.abs(v - armWas[i])));
      out.step = [S.un.length - n0, S.un[S.un.length - 1].n];
      app.undo(); out.undone = !!(S.avedit.joints && S.avedit.joints[finger]);
      return out;
    });` });
  assert.ok(o.bones[0] >= 10, "the hands and their fingers: " + o.bones);
  assert.deepStrictEqual(o.bones.slice(1), [true, true, true, false], "both hands, the fingers, no arm bone");
  assert.deepStrictEqual(o.saved, ["hand-pose", true, true]);
  assert.strictEqual(o.ok, true);
  assert.ok(o.finger < 1e-4, "the finger back as saved: " + o.finger);
  assert.ok(o.arm < 1e-6, "the arm as it stood: " + o.arm);
  assert.deepStrictEqual(o.step, [1, "Hand Pose"]);
  assert.strictEqual(o.undone, false);
});

// the three rectangles' cloth made in the 3D window, A hidden there
const CLOTH = DOC + `
  app.ev("setLayout")("both"); R("garmentSync", true);
  const bin = (fn) => { let got = null, name = null; app.setDownload((n, b) => { got = b; name = n; }); fn(); app.setDownload(null); return { name, got }; };
  const pts = () => S.pieces.filter(p => !p.hide3).map(p => app.G3.items.get(p.id).X.length/3);
  const tris = () => S.pieces.filter(p => !p.hide3).map(p => app.G3.items.get(p.id).mesh.tri.length/3);
`;

test("fmt1 / D1: Export ▸ USD: a .usda of the garment as draped, a Mesh a pattern (its points, triangles, texture places, the fabric's colour), millimetres, y up; a hidden pattern left out; nothing in the 3D window: said so", () => {
  const o = boot({ blank: true, three: true, script: CLOTH + `
    S.pieces[0].hide3 = true; S.pieces[1].name = "Back 2"; app.commit(); R("garmentSync", true);
    const r = bin(() => R("exportMesh3", "usd")), t = r.got;
    out.name = r.name;
    out.head = [/^#usda 1[.]0/.test(t), /metersPerUnit = 0[.]001/.test(t), /upAxis = "Y"/.test(t)];
    out.meshes = (t.match(/def Mesh "([^"]+)"/g) || []).map(s => s.slice(10, -1));
    const counts = (t.match(/point3f\\[\\] points = \\[([^\\]]*)\\]/g) || []).map(s => (s.match(/[(]/g) || []).length);
    const faces = (t.match(/int\\[\\] faceVertexCounts = \\[([^\\]]*)\\]/g) || []).map(s => s.split(",").length);
    out.counts = [counts, pts(), faces, tris(), (t.match(/primvars:st/g) || []).length];
    return out;` });
  assert.strictEqual(o.name, "garment.usda");
  assert.deepStrictEqual(o.head, [true, true, true]);
  assert.deepStrictEqual(o.meshes, ["Back_2", "C"], "a hidden pattern left out; a name a prim may have");
  assert.deepStrictEqual(o.counts[0], o.counts[1], "every point");
  assert.deepStrictEqual(o.counts[2], o.counts[3], "every triangle");
  assert.strictEqual(o.counts[4], 2, "texture places");
});

test("fmt1 / D2: Export ▸ FBX: a binary FBX 7.4 of the garment as draped, read back by three.js's own FBX loader: a mesh a pattern with every point where it hangs, every triangle, texture places and the fabric's colour", () => {
  const o = boot({ blank: true, three: true, script: CLOTH + `
    S.lib.fabric[0].color = "#336699"; app.commit();
    const r = bin(() => R("exportMesh3", "fbx")), b = r.got;
    out.name = r.name; out.magic = new TextDecoder().decode(b.slice(0, 18));
    const root = new (app.ev("THREE_LOADERS").FBXLoader)().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "");
    const ms = []; root.traverse(x => { if (x.isMesh) ms.push(x); });
    out.n = ms.map(m => m.name);
    // three's loader turns each triangle's corners into points of their own: as many as three a triangle
    out.corners = [ms.map(m => m.geometry.attributes.position.count), tris().map(n => 3*n)];
    out.uv = ms.every(m => !!m.geometry.attributes.uv);
    // (three's loader reads a DiffuseColor as sRGB and keeps it linear: back to sRGB to compare)
    const c = ms[0].material.color.clone().convertLinearToSRGB(); out.color = [c.r, c.g, c.b].map(v => Math.round(v*255));
    // the places: the box of A's points as written against the cloth's
    const X = app.G3.items.get(S.pieces[0].id).X, P = ms[0].geometry.attributes.position.array;
    const box = (A) => { let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < A.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], A[i+k]); hi[k] = Math.max(hi[k], A[i+k]); } return [...lo, ...hi]; };
    out.box = [box(X), box(P)];
    return out;` });
  assert.strictEqual(o.name, "garment.fbx");
  assert.strictEqual(o.magic, "Kaydara FBX Binary");
  assert.deepStrictEqual(o.n, ["A", "B", "C"]);
  assert.deepStrictEqual(o.corners[0], o.corners[1], "every triangle");
  assert.strictEqual(o.uv, true);
  assert.ok(o.color.every((v, k) => Math.abs(v - [0x33, 0x66, 0x99][k]) <= 2), "the fabric's colour: " + o.color);
  for (let k = 0; k < 6; k++) assert.ok(Math.abs(o.box[0][k] - o.box[1][k]) < 0.01, "where the cloth hangs: " + o.box);
});

module.exports = T;
