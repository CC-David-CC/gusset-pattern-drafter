// POST8 batch 0r: the splash's timing. The browser smoke check's r24 splash check wanted the splash gone within 150 ms of the page's
// load ("gusset-ready"); since Round r32 the splash waits for "gusset-usable", which on a busy machine comes 175-200 ms or more later,
// so the check failed once (post8q) with the page right. The smoke now checks the order of the marks; the timing is measured by hand
// (scripts/startup-time.js, scripts/startup-built.js); the desktop smoke checks what a check's start does (no splash, ready before shown).
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pageHTML, pageScripts } = require("./harness");

const ROOT = path.join(__dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const T = [];
const test = (name, fn) => T.push({ name, fn });

// the overlay's script on a stand-in page whose timers can come early (as a real one may by a fraction of a millisecond)
function overlay(early) {
  const code = pageScripts(pageHTML()).find(s => !s.src && /gussetSplashEnd/.test(s.code)).code;
  const timers = [], marks = [];
  let now = 0;
  const el = { className: "", parentNode: { removeChild: () => { el.parentNode = null; } }, addEventListener: () => {} };
  const win = {};
  vm.runInNewContext(code, { window: win, document: { getElementById: () => el },
    performance: { now: () => now, mark: (n) => marks.push([n, now]) }, setTimeout: (f, ms) => timers.push({ f, at: now + (ms || 0) - early }) });
  const run = (to) => { for (let k = 0; k < 20; k++) { const due = timers.filter(t => !t.done && t.at <= to).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = Math.max(now, due.at); due.done = true; due.f(); } now = to; };
  return { el, win, marks, run, at: (t) => { now = t; } };
}

test("post8r / 1: the browser splash never goes before 600 ms, even when a timer comes early; once the page is ready it goes", () => {
  const o = overlay(0.4);
  o.at(250.3); o.win.gussetSplashEnd();
  o.run(599.9); assert.strictEqual(o.el.className, "", "still up before 600 ms: " + JSON.stringify(o.marks));
  o.run(700); assert.strictEqual(o.el.className, "out");
  assert.ok(o.marks.length === 1 && o.marks[0][1] >= 600, JSON.stringify(o.marks));
  const late = overlay(0.4); late.at(900); late.win.gussetSplashEnd(); late.run(900);
  assert.deepStrictEqual(late.marks, [["gusset-splash-gone", 900]], "ready after 600 ms: at once");
});

test("post8r / 2: the smoke checks the order of the start, the timing is measured by hand", () => {
  // (run 15: these three scripts stay in this repository, not the public one; its export runs the tests without them, as r28 / 10 is)
  if (!["smoke-browser.js", "startup-time.js", "startup-built.js"].every(f => require("fs").existsSync(path.join(__dirname, "..", "..", "scripts", f)))) return;
  const smoke = read("scripts/smoke-browser.js");
  assert.ok(/t\[2\] >= 600 && t\[2\] >= t\[1\]/.test(smoke) && smoke.includes('m("gusset-usable")'), "gone after usable and after 600 ms");
  assert.ok(!/t\[1\] - Math\.max\(600, t\[0\]\) < 150/.test(smoke), "no speed limit in the smoke");
  const st = read("scripts/startup-time.js"), sb = read("scripts/startup-built.js");
  assert.ok(st.includes("SPLASH_LAG = 150") && st.includes('splashLine("browser", b.rows, 600, "lag")') && st.includes('splashLine("desktop", d.rows, 1000, "grey")'));
  assert.ok(sb.includes('"splash unpacked: "'));
});

test("post8r / 3: the shell writes where SPLASH_MIN counts from and when the splash went; the desktop smoke reads its start log", () => {
  const main = read("desktop/main.js"), ds = read("desktop/smoke.js");
  assert.ok(main.includes('splashAt = Date.now(); mark("splashAsked");'));
  assert.ok(main.includes('splash.on("closed", () => { splash = null; mark("splashGone"); startLog(); });'));
  assert.ok(ds.includes("(0r) a check's start: no splash shown") && /m\.mainShown >= m\.pageReady/.test(ds) && /m\.splashShown, undefined/.test(ds));
});

/* ---- FIX-8 / C2 (roadmap 3.A14): avatar accessories ---- */
const { spawnSync } = require("child_process");
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
// a closed cube, 100 mm a side, its faces outward, in front of Marty's chest (his front is +z)
const CUBE = (() => {
  const c = [0, 1300, 300], s = 50, v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const f = [[1, 4, 3], [1, 3, 2], [5, 6, 7], [5, 7, 8], [1, 2, 6], [1, 6, 5], [4, 8, 7], [4, 7, 3], [1, 5, 8], [1, 8, 4], [2, 3, 7], [2, 7, 6]];
  return v.map(p => "v " + p.map((x, k) => c[k] + s*x).join(" ")).join("\n") + "\n" + f.map(q => "f " + q.join(" ")).join("\n") + "\n";
})();

test("post8r / C2-1: Register Accessory (a mesh file): placed where the file has it, on the nearest bone, part of the collision body (the field inside it), following the avatar when it moves; its Property Editor; Collision off and Delete each one step, undone exactly; saved with the avatar edits and read back the same", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const G3 = app.G3, F = () => app.ev("avatarField")(S.av), at = (f) => app.ev("SIM3D").sdfSample(f, 0, 1300, 300, [0, 0, 0]);
      const pr = () => app.ev("document").getElementById("props").innerHTML;
      out.before = at(F());
      const m = app.ev("objParse")(${JSON.stringify(CUBE)});
      out.parsed = [m.P.length/3, m.I.length/3];
      const rec = app.ev("accFromMesh")("box.obj", m, "mm", "");
      const a = S.avedit.acc[0];
      out.rec = [S.avedit.acc.length, typeof a.bone, a.bone.length > 0, S.av.bones.has(a.bone), a.name, S.un[S.un.length - 1].n, G3.accSel === a.id];
      out.inside = at(F());
      const W = app.ev("accWorld")(S.av, a); let cx = 0; for (let i = 0; i < W.length; i += 3) cx += W[i]/8; out.cx0 = Math.round(cx);
      app.push("Place"); S.avedit = app.ev("normAvEdit")({ ...S.avedit, place: { x: 300 } }); app.commit();
      const W2 = app.ev("accWorld")(S.av, S.avedit.acc[0]); let cx2 = 0; for (let i = 0; i < W2.length; i += 3) cx2 += W2[i]/8; out.cx1 = Math.round(cx2);
      out.moved = app.ev("SIM3D").sdfSample(F(), 300, 1300, 300, [0, 0, 0]);
      app.undo();
      app.ev("ui")(); const h = pr();
      out.panel = ["<h2>Avatar Accessory</h2>", "Attached To", "Part of the collision body", "Color", "Delete Accessory", "Save as OBJ"].map(s => h.includes(s));
      const id = S.avedit.acc[0].id;
      app.ev("accSet")(id, { nocol: true }, "Accessory Collision"); out.off = [S.avedit.acc[0].nocol, at(F()) > 0];
      app.undo(); out.on = [S.avedit.acc[0].nocol, at(F()) < 0];
      // the file: the avatar edits keep it; read back, the same record
      const doc = JSON.parse(app.ev("docJSON")());
      out.file = [!!doc.avedit.acc, app.ev("canonJSON")(app.ev("normAvEdit")(doc.avedit)) === app.ev("canonJSON")(S.avedit)];
      // as OBJ, read back: the same mesh where it is
      const t = app.ev("accObjText")(S.avedit.acc[0]), back = app.ev("objParse")(t);
      out.obj = [/^# Gusset/.test(t), back.P.length/3, back.I.length/3, Math.max(...Array.from(back.P).map((v, i) => Math.abs(v - m.P[i])))];
      { const b = app.ev("accBone")(S.av, "no such bone"); out.root = !!b && !(b.parent && b.parent.isBone); }
      app.ev("accDelete")(id); out.del = [!!S.avedit.acc, G3.accSel, at(F()) > 0, S.un[S.un.length - 1].n];
      app.undo(); out.undel = S.avedit.acc.length;
      return out;
    });` });
  assert.ok(o.before > 100, "nothing there before: " + o.before);
  assert.deepStrictEqual(o.parsed, [8, 12]);
  assert.deepStrictEqual(o.rec, [1, "string", true, true, "box", "Register Accessory", true]);
  assert.ok(o.inside < 0, "the field is inside it: " + o.inside);
  assert.ok(Math.abs(o.cx0) <= 1 && Math.abs(o.cx1 - 300) <= 1, "it follows the avatar: " + [o.cx0, o.cx1]);
  assert.ok(o.moved < 0, "the collision body moved with it: " + o.moved);
  assert.deepStrictEqual(o.panel, [true, true, true, true, true, true]);
  assert.deepStrictEqual(o.off, [true, true], "Collision off: not in the field");
  assert.deepStrictEqual(o.on, [null, true], "(undefined comes back as null over JSON)");
  assert.deepStrictEqual(o.file, [true, true]);
  assert.ok(o.obj[0] && o.obj[1] === 8 && o.obj[2] === 12 && o.obj[3] < 0.01, JSON.stringify(o.obj));
  assert.deepStrictEqual(o.del, [false, null, true, "Delete Accessory"]);
  assert.ok(o.root, "a bone not on this avatar: the skeleton's root");
  assert.strictEqual(o.undel, 1);
});

test("post8r / C2-2: Convert ▸ to Avatar Accessory: the selected pattern's cloth as it hangs, a closed shell its fabric's thickness thick, on the nearest bone; the pattern archived; one step, undone exactly; the rows built (Convert, File ▸ Open / Save As ▸ Accessory, Context Menu ▸ Avatar ▸ Delete Accessory, the Avatar menu)", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      const G3 = app.G3, R = (n, ...a) => app.ev(n)(...a);
      app.push("Rectangle"); S.pieces.push(R("mkPiece", "Hat", R("mkShape", [{ x: -80, y: -1800 }, { x: 80, y: -1800 }, { x: 80, y: -1700 }, { x: -80, y: -1700 }], true))); app.commit();
      const p = S.pieces[0];
      return app.wait(() => G3.items.has(p.id) && G3.items.get(p.id).X, "the cloth").then(() => {
        const it = G3.items.get(p.id), nv = it.X.length/3, nt = it.mesh.tri.length/3;
        S.sel = [p.id];
        R("convertToAccessory");
        const a = S.avedit.acc[0], g = R("accGeom", a);
        out.made = [S.avedit.acc.length, p.arch3 === true, S.sel.length, G3.accSel === a.id, a.name, S.un[S.un.length - 1].n, S.av.bones.has(a.bone)];
        out.shell = [g.P.length/3 === 2*nv, g.I.length/3 > 2*nt];
        // closed: every edge of the shell in exactly two triangles
        const E = new Map(); for (let k = 0; k < g.I.length; k += 3) for (const [u, w] of [[g.I[k], g.I[k+1]], [g.I[k+1], g.I[k+2]], [g.I[k+2], g.I[k]]]) { const key = Math.min(u, w) + "," + Math.max(u, w); E.set(key, (E.get(key) || 0) + 1); }
        out.closed = [...E.values()].every(n => n === 2);
        // where the cloth hung: the shell's middle at the cloth's middle
        const W = R("accWorld", S.av, a); let c = [0, 0, 0], d = [0, 0, 0]; for (let i = 0; i < W.length; i += 3) for (let k = 0; k < 3; k++) c[k] += W[i+k]/(W.length/3); for (let i = 0; i < it.X.length; i += 3) for (let k = 0; k < 3; k++) d[k] += it.X[i+k]/nv;
        out.where = Math.max(...c.map((v, k) => Math.abs(v - d[k])));
        out.bone = a.bone;
        // (undo and redo put new pattern objects in: looked up by id)
        app.undo(); out.undone = [!!S.avedit.acc, !!R("byId", p.id).arch3];
        app.redo(); out.redone = [S.avedit.acc.length, R("byId", p.id).arch3];
        // the rows
        const flat = (rows) => rows.flatMap(r => (r && r.menu ? [r, ...flat(r.menu())] : r ? [r] : []));
        const all = (rows) => flat(rows).map(r => [r.n, !!r.off]);
        out.ctxAvatar = all(R("contextMenuRows").find(r => r.n === "Avatar").menu()).filter(r => /Accessory/.test(r[0]));
        out.avMenu = all(R("avatarMenu")).filter(r => /Accessory/.test(String(r[0])));
        out.file = all(R("menuFile")).filter(r => /^Accessory/.test(String(r[0])));
        return out;
      });
    });` });
  assert.deepStrictEqual(o.made, [1, true, 0, true, "Hat", "Convert to Avatar Accessory", true]);
  assert.deepStrictEqual(o.shell, [true, true]);
  assert.ok(o.closed, "a closed shell");
  assert.ok(o.where < 1, "where the cloth hung: " + o.where);
  assert.ok(/head|neck/i.test(o.bone), "a hat at head height follows the head: " + o.bone);
  assert.deepStrictEqual(o.undone, [false, false]);
  assert.deepStrictEqual(o.redone, [1, true]);
  assert.deepStrictEqual(o.ctxAvatar, [["Delete Accessory", false]]);
  assert.ok(o.avMenu.some(r => /^Register Accessory/.test(r[0]) && !r[1]) && o.avMenu.some(r => r[0] === "Accessory: Hat"), JSON.stringify(o.avMenu));
  assert.deepStrictEqual(o.file, [["Accessory", false], ["Accessory…", false]]);
});

test("post8r / C2-3: an accessory record that is not a mesh is dropped, one id once; none kept: no avatar edits written", () => {
  const o = boot({ blank: true, script: `
    const N = app.ev("normAvEdit"), enc = app.ev("accEncode");
    const good = { id: 1, name: " A ", bone: "head", ...enc([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]) };
    return {
      kept: N({ acc: [good] }).acc.map(a => [a.id, a.name, a.bone]),
      badIdx: N({ acc: [{ ...good, ...enc([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 7]) }] }).acc,
      badText: N({ acc: [{ ...good, pos: "!!" }] }).acc,
      twice: N({ acc: [good, good] }).acc.length,
      none: N({ acc: [] }).acc, on: app.ev("avEditOn")() };` });
  assert.deepStrictEqual(o.kept, [[1, "A", "head"]]);
  assert.strictEqual(o.badIdx, undefined); assert.strictEqual(o.badText, undefined); assert.strictEqual(o.twice, 1);
  assert.strictEqual(o.none, undefined); assert.strictEqual(o.on, false);
});

module.exports = T;
