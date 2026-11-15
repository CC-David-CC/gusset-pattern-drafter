// Round POST8, fourteenth session. FIX-8 / A (roadmap 1.S16b): the avatar's place in the scene, Move to Ground and Move to Center.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const START = `
  const out = {};
  app.ev("setLayout")("both");
  app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
`;

test("FIX-8 / A1: Move to Ground stands the posed avatar's lowest point on the floor, Move to Center its middle over x = 0, z = 0; each one undo step kept in the avatar edits (the file), undone exactly; already there: said, no step", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const box = () => { const b = app.ev("avatarBox")(S.av); return [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1].map(v => Math.round(v)); };
      const mid = (b) => [Math.round((b[0] + b[3])/2), Math.round((b[2] + b[5])/2)];
      S.undo.length = 0; S.un.length = 0;
      const row = (n) => app.ev("avatarMenu")().find(r => r.n === n);
      const n0 = S.undo.length; row("Move to Ground").f(); out.already = [S.undo.length - n0, /already/.test(toasts[toasts.length - 1])];
      // the avatar somewhere else (as a file or a pose could leave it): 150 mm up, 300 mm to its left, 80 mm back
      app.push("Place"); S.avedit = app.ev("normAvEdit")({ ...S.avedit, place: { x: 300, y: 150, z: -80 } }); app.commit();
      const off = box(); out.off = [off[1], mid(off)];
      row("Move to Ground").f(); const g = box(); out.ground = [g[1], mid(g), S.un[S.un.length - 1].n];
      row("Move to Center").f(); const c = box(); out.center = [c[1], mid(c), S.un[S.un.length - 1].n];
      out.place = S.avedit.place; out.inDoc = JSON.parse(app.ev("docJSON")()).avedit.place;
      app.undo(); out.undo1 = mid(box()); app.undo(); out.undo2 = box()[1]; app.redo(); app.redo(); out.redo = [box()[1], mid(box())];
      out.sdf = !!S.av.sdf;
      out.rows = app.ev("contextMenuRows")().find(r => r.n === "Avatar").menu().filter(r => /Move to/.test(r.n)).map(r => [r.n, !!r.off]);
      return out;
    });` });
  assert.deepStrictEqual(o.already, [0, true], "Marty stands on the floor already: said, no step");
  assert.ok(Math.abs(o.off[0] - 150) <= 1 && o.off[1][0] > 250, JSON.stringify(o.off));
  assert.ok(Math.abs(o.ground[0]) <= 1, "on the floor: " + o.ground); assert.ok(o.ground[1][0] > 250, "Move to Ground leaves x"); assert.strictEqual(o.ground[2], "Move to Ground");
  assert.ok(Math.abs(o.center[1][0]) <= 1 && Math.abs(o.center[1][1]) <= 1 && Math.abs(o.center[0]) <= 1, "in the middle and still on the floor: " + JSON.stringify(o.center)); assert.strictEqual(o.center[2], "Move to Center");
  assert.deepStrictEqual(o.inDoc, o.place, "kept in the file's avatar edits");
  assert.ok(o.undo1[0] > 250 && Math.abs(o.undo2 - 150) <= 1, "undone exactly: " + JSON.stringify([o.undo1, o.undo2]));
  assert.ok(Math.abs(o.redo[0]) <= 1 && Math.abs(o.redo[1][0]) <= 1, JSON.stringify(o.redo));
  assert.deepStrictEqual(o.rows, [["Move to Ground", false], ["Move to Center", false]]);
});

test("FIX-8 / A2: the place is kept only when not 0 (a version 36 file without it opens as it was), rounded and held within the scene; with no avatar the rows say so and change nothing", () => {
  const o = boot({ blank: true, script: `
    const N = app.ev("normAvEdit");
    const rows = app.ev("avPlaceRows")().map(r => [r.n, !!r.off]);
    return { none: N({}).place, zero: N({ place: { x: 0, y: 0.01, z: 0 } }).place, kept: N({ place: { x: 12.345, y: -1e9, z: "x" } }).place, rows, on: app.ev("avEditOn")() };` });
  assert.strictEqual(o.none, undefined); assert.strictEqual(o.zero, undefined);
  assert.deepStrictEqual(o.kept, { x: 12.3, y: -20000 });
  assert.deepStrictEqual(o.rows, [["Move to Ground", true], ["Move to Center", true]]);
  assert.strictEqual(o.on, false);
});

test("FIX-8 / B1: the avatar's Property Editor (the avatar clicked): Information (name, size, Item No.), Surface (the fixed skin offset, Static / Kinetic Friction), Material (Color); each change one undo step in the avatar edits; the friction reaches the solver's options, the colour the avatar's material; none set: as before", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const G3 = app.G3, pr = () => app.ev("document").getElementById("props").innerHTML;
      out.before = [JSON.stringify(app.ev("avSurfaceOpt")()), app.ev("avEditOn")()];
      G3.avSel = true; app.ev("ui")(); const h = pr();
      out.rows = ["<h2>Avatar</h2>", "Avatar Name", "Item No.", "Skin Offset (mm)", "Static Friction", "Kinetic Friction", "Color"].map(s => h.includes(s));
      out.left = /Body Styling|Eye Control|Soft Body|Divide Mesh|Skin Inward|Tech Pack|not built/.test(h);
      const mat = S.av.meshes.map(m => m.userData.mat0).find(m => m && m.color), c0 = mat.color.getHex();
      const n0 = S.un.length;
      app.push("Avatar Friction"); S.avedit = app.ev("normAvEdit")({ ...S.avedit, surface: { fs: 0.6, fk: 0.2 } }); app.commit();
      app.push("Avatar Color"); S.avedit = app.ev("normAvEdit")({ ...S.avedit, color: "#AA5500" }); app.commit();
      app.push("Avatar Item No."); S.avedit = app.ev("normAvEdit")({ ...S.avedit, info: { itemNo: " MV-01 " } }); app.commit();
      out.after = [JSON.stringify(app.ev("avSurfaceOpt")()), mat.color.getHex().toString(16), S.avedit.info.itemNo, S.un.length - n0];
      out.inDoc = JSON.parse(app.ev("docJSON")()).avedit;
      app.undo(); app.undo(); out.undone = [mat.color.getHex() === c0, JSON.stringify(app.ev("avSurfaceOpt")())];
      G3.avSel = false; app.ev("ui")(); out.gone = !pr().includes("<h2>Avatar</h2>");
      return out;
    });` });
  assert.deepStrictEqual(o.before, ["{}", false], "none set: the fabric's own friction, nothing in the file");
  assert.deepStrictEqual(o.rows, Array(7).fill(true)); assert.strictEqual(o.left, false, "only rows with something behind them");
  // (POST8 batch 0p: kinetic 0.2 is raised to the minimum, 0.3, AV_FRIC_MIN)
  assert.deepStrictEqual(o.after, ['{"bodyStatic":0.6,"bodyKinetic":0.3}', "aa5500", "MV-01", 3]);
  assert.deepStrictEqual([o.inDoc.surface, o.inDoc.color, o.inDoc.info], [{ fs: 0.6, fk: 0.3 }, "#aa5500", { itemNo: "MV-01" }]);
  assert.deepStrictEqual(o.undone, [true, '{"bodyStatic":0.6,"bodyKinetic":0.3}'], "the colour undone, the friction still there (two steps back)");
  assert.ok(o.gone);
});

test("FIX-8 / B2 (batch 0p: within 0.3 to 2): the surface's values are made whole: one given sets both, static never below kinetic, held within AV_FRIC_MIN (0.3: below it a skirt pulled down slid off) to 2; empty is none", () => {
  const o = boot({ blank: true, script: `
    const N = (s) => app.ev("normAvEdit")({ surface: s }).surface;
    return [N({ fs: 0.5 }), N({ fk: 0.3 }), N({ fs: 0.1, fk: 0.4 }), N({ fs: 9, fk: 9 }), N({ fs: "", fk: null }), N({ fs: -1 }), app.ev("normAvEdit")({ color: "red" }).color, N({ fs: 0, fk: 0 }), N({ fs: 0.8, fk: 0.05 }), app.ev("AV_FRIC_MIN")];` });
  // (undefined comes back as null through the result's JSON)
  assert.deepStrictEqual(o, [{ fs: 0.5, fk: 0.5 }, { fs: 0.3, fk: 0.3 }, { fs: 0.4, fk: 0.4 }, { fs: 2, fk: 2 }, null, null, null, { fs: 0.3, fk: 0.3 }, { fs: 0.8, fk: 0.3 }, 0.3]);
});

module.exports = T;
