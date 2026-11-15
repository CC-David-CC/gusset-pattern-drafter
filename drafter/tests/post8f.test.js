// Round POST8, sixth session. Batch 0f: the pose presets as document edits, the hint's T-pose → Re-drape → Lay Flat in one step, Crop keeps the shadow.
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
  const out = {}, EX = app.ev("PATTERN_EXAMPLES"), ex = EX.find(e => /T-shirt/.test(e.name));
  app.ev("setLayout")("both");
  app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
`;

test("POST8 batch 0f / P1: Avatar ▸ A-Pose / T-Pose / Arms Down / As Loaded are document edits, one undo step each, kept in the avatar edits; the file opened on a fresh profile stands the same; the pose panel's presets too", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
      S.undo.length = 0; S.un.length = 0;
      const arms = () => Math.round(app.ev("armsOut")(S.av)), row = (n) => app.ev("avatarMenu")().find(r => r.n === n);
      out.a0 = arms(); out.machine0 = JSON.stringify(S.avSet.pose);
      row("T-Pose").f(); out.t = arms(); out.machine = JSON.stringify(S.avSet.pose) === out.machine0;
      row("Arms Down").f(); out.i = arms();
      row("A-Pose").f(); out.a = arms();
      row("T-Pose").f();
      out.steps = S.un.map(u => u.n);
      app.undo(); out.undo = arms(); app.redo(); out.redo = arms();
      out.doc = JSON.parse(JSON.stringify(app.ev("docObj")()));
      row("As Loaded").f(); out.loaded = [arms(), Object.keys(S.avedit.joints || {}).length]; app.undo();
      // the pose panel's preset list goes the same way
      const k = S.undo.length; app.ev("setPosePreset")("i"); out.panel = [S.undo.length - k, S.un[S.un.length - 1].n, arms()];
      return out;
    });` });
  assert.ok(o.a0 < 70, "Marty in his A-pose: " + o.a0);
  assert.ok(Math.abs(o.t - 90) <= 2, "T-Pose: " + o.t);
  assert.strictEqual(o.machine, true, "this machine's pose sliders untouched");
  assert.ok(o.i < o.a0 && o.i < 20, "Arms Down: " + o.i);
  assert.ok(Math.abs(o.a - 45) <= 3, "A-Pose: " + o.a);
  assert.deepStrictEqual(o.steps, ["T-Pose", "Arms Down", "A-Pose", "T-Pose"], "one step each");
  assert.ok(Math.abs(o.undo - o.a) <= 1 && Math.abs(o.redo - 90) <= 2);
  assert.ok(Math.abs(o.loaded[0] - o.a0) <= 1 && o.loaded[1] === 0, "As Loaded: the file's own pose, no joints: " + o.loaded);
  assert.deepStrictEqual(o.panel, [1, "Arms Down", o.i]);
  // the same file on a fresh profile
  const p = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      app.ev("loadDoc")(${JSON.stringify(o.doc)}); app.ev("showDoc")(); app.ev("garmentSync")();
      return { arms: Math.round(app.ev("armsOut")(S.av)), machine: JSON.stringify(S.avSet.pose) };
    });` });
  assert.ok(Math.abs(p.arms - 90) <= 2, "fresh profile, same pose: " + p.arms);
});

test("POST8 batch 0f / P2: the Lay Flat hint's button sets the T-pose, re-drapes (the cloth carried with the body, simulated until it settles, a note meanwhile) and lays flat again: ONE undo step; undo puts the laid A-pose garment back, redo the new one", () => {
  const o = boot({ blank: true, three: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")();
      S.cloth = app.ev("normCloth")({ ...S.cloth, res: 30, worker: false, self: false });
      app.ev("garmentSync")();
      app.ev("simStart")(); for (let i = 0; i < 60; i++) app.ev("simFrame")(); app.ev("simStop")();
      S.undo.length = 0; S.un.length = 0;
      const all = () => S.pieces.flatMap(p => Array.from(app.G3.items.get(p.id).X));
      const ys = (A) => [...new Set(A.filter((v, k) => k % 3 === 1).map(v => +v.toFixed(3)))].sort((a, b) => a - b);
      app.ev("layFlat")(); const A0 = all(); out.armsA = Math.round(app.ev("armsOut")(S.av));
      const act = app.ev("TOAST_ACT"); out.label = act.label;
      out.go = act.f(); out.running = !!app.ev("TPCHAIN").on; out.note = app.el("note3d").textContent;
      let n = 0; while (app.ev("TPCHAIN").on && n < 1200) { app.ev("tpChainFrame")(); n++; }
      out.frames = n; out.ended = !app.ev("TPCHAIN").on && !app.ev("SIM").on;
      const A1 = all(); out.ys = ys(A1); out.arms = Math.round(app.ev("armsOut")(S.av));
      out.steps = S.un.map(u => u.n); out.toast = toasts.slice(-1)[0];
      app.undo(); out.undo = [Math.max(...all().map((v, k) => Math.abs(v - A0[k]))), Math.round(app.ev("armsOut")(S.av))];
      app.redo(); out.redo = [Math.max(...all().map((v, k) => Math.abs(v - A1[k]))), Math.round(app.ev("armsOut")(S.av))];
      return out;
    });` });
  assert.ok(o.armsA < 70);
  assert.strictEqual(o.label, "T-Pose, Re-drape, Lay Flat");
  assert.strictEqual(o.go, true);
  assert.strictEqual(o.running, true, "re-draping");
  assert.ok(/re-draping/.test(o.note), "a note while it simulates: " + o.note);
  assert.ok(o.ended && o.frames >= 60 && o.frames <= 900, "settled and ended: " + o.frames + " frames");
  assert.deepStrictEqual(o.ys, [3, 6], "laid flat again, two layers");
  assert.ok(Math.abs(o.arms - 90) <= 2, "in the T-pose: " + o.arms);
  assert.deepStrictEqual(o.steps, ["Lay Flat", "T-Pose, Re-drape and Lay Flat"], "ONE step");
  assert.ok(/one step/.test(o.toast), o.toast);
  assert.ok(o.undo[0] < 1e-3 && Math.abs(o.undo[1] - o.armsA) <= 1, "undo: the laid A-pose garment: " + o.undo);
  assert.ok(o.redo[0] < 1e-3 && Math.abs(o.redo[1] - 90) <= 2, "redo: the new one: " + o.redo);
});

test("POST8 batch 0f / C1: Crop takes in the floor shadow: every corner of the box cast onto the floor along each light (a dome none, a low light at most 4 box heights) lies inside the crop", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: START + `
    return app.wait(() => S.av, "Marty").then(() => {
      app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
      const N = app.ev("normRender"), v3 = app.view3d, THREE = app.ev("THREE");
      Object.assign(v3.cam, { az: 0.5, el: 0.35, dist: 6500, tx: 0, ty: 900, tz: 0 });
      // a light from the left, low: its shadow falls far to the right
      S.lights = [app.ev("normLight")({ type: "dir", az: 90, el: 25, intensity: 2 }, 1), app.ev("normLight")({ type: "dome", intensity: 1 }, 2)];
      out.dirs = app.ev("cropShadowDirs")(app.ev("avatarBox")(S.av)).length;
      const r = app.ev("renderCropRect")(N({ crop: true }), 1920, 1080, null), cam = v3.camFor(1920, 1080, null, null);
      const b = app.ev("avatarBox")(S.av), d = app.ev("lightDir")(S.lights[0]);
      const tip = (x, y, z) => { const k = Math.min(y/d.y, 4*(b.y1 - Math.max(0, b.y0))), v = new THREE.Vector3(x - d.x*k, 0, z - d.z*k).project(cam); return [(v.x + 1)/2*1920, (1 - v.y)/2*1080]; };
      out.inside = [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1], [b.x1, b.y1, b.z0]].map(([x, y, z]) => tip(x, y, z)).every(([px, py]) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
      S.lights = []; out.noShadow = app.ev("renderCropRect")(N({ crop: true }), 1920, 1080, null);
      out.rect = r;
      return out;
    });` });
  assert.strictEqual(o.dirs, 1, "the directional light casts one, the dome none");
  assert.strictEqual(o.inside, true, "the shadow's tips inside the crop: " + JSON.stringify(o.rect));
});

test("POST8 FIX-6 / B1: the Camera pane's Lens ▸ Panorama and Physical Camera (Render Only) with F-Stop, Focus Distance, Aperture Blades; kept in the file only when chosen; Path Traced only (asked for first; a browser's lock); the path tracer's camera and depth of field set from them; Fit Properties dropped", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: `
    const out = {}, N = app.ev("normRender"), THREE = app.ev("THREE");
    const d = N({}); out.plain = ["lens", "phys", "fstop", "focus", "blades"].filter(k => k in d);
    out.set = N({ lens: "panorama", phys: true, fstop: 200, focus: -5, blades: 7 }); out.set = [out.set.lens, out.set.phys, out.set.fstop, out.set.focus, out.set.blades];
    out.offRows = N({ fstop: 4, phys: false }); out.offRows = "fstop" in out.offRows;
    S.ui.unbuilt = true;
    const ch = app.ev("rwinCameraHTML");
    out.html0 = [/value="panorama"/.test(ch(d)), /Panorama[(]not built|>Panorama<[/]label><span class="u">[(]not built/.test(ch(d)), /Physical Camera [(]Render Only[)]<[/]label><span class="u">[(]not built/.test(ch(d)), /data-r="phys"/.test(ch(d)), /data-r="fstop"/.test(ch(d))];
    out.html1 = [/data-r="fstop"/.test(ch(N({ phys: true }))), /data-r="blades"/.test(ch(N({ phys: true }))), /Path Traced only/.test(ch(N({ phys: true })))];
    // asked for Path Traced first
    app.ev("saveRender")({ ...N(S.render || {}), mode: "quick" });
    app.ev("rwinSet")("lens", { value: "panorama", dataset: {} }); out.refused = [app.ev("loadRender")().lens, toasts.slice(-1)[0]];
    app.ev("saveRender")({ ...app.ev("loadRender")(), mode: "quality" });
    app.ev("rwinSet")("lens", { value: "panorama", dataset: {} }); app.ev("rwinSet")("phys", { type: "checkbox", checked: true, dataset: {} });
    out.taken = [app.ev("loadRender")().lens, app.ev("loadRender")().phys];
    // the path tracer's material and camera
    const mat = { physicalCamera: {}, defines: {}, setDefine(k, v) { this.defines[k] = v; } };
    const cam = new THREE.PerspectiveCamera(40, 1.5, 10, 80000); cam.position.set(0, 1000, 3000); cam.lookAt(0, 1000, 0); cam.updateMatrixWorld(true);
    const f = cam.getFocalLength(), mid = new THREE.Vector3(0, 1000, 0);
    out.v0 = [app.ev("ptCameraSet")(mat, cam, N({}), mid), mat.physicalCamera.bokehSize, mat.defines.CAMERA_TYPE, mat.defines.FEATURE_DOF, !!cam.isEquirectCamera];
    out.v1 = [app.ev("ptCameraSet")(mat, cam, N({ phys: true, fstop: 4, blades: 6 }), mid), mat.physicalCamera.bokehSize/1000*4/f, mat.physicalCamera.focusDistance, mat.physicalCamera.apertureBlades, mat.defines.FEATURE_DOF];
    out.v2 = [app.ev("ptCameraSet")(mat, cam, N({ phys: true, fstop: 4, focus: 1234 }), mid), mat.physicalCamera.focusDistance];
    out.v3 = [app.ev("ptCameraSet")(mat, cam, N({ lens: "panorama", phys: true }), mid), mat.defines.CAMERA_TYPE, mat.defines.FEATURE_DOF, !!cam.isEquirectCamera];
    out.prefs = app.ev("menuPreferences")().some(r => /Fit Properties/.test(r.n || ""));
    return out;` });
  assert.deepStrictEqual(o.plain, [], "a document that never chose them writes none");
  assert.deepStrictEqual(o.set, ["panorama", true, 64, 0, 7]);
  assert.strictEqual(o.offRows, false, "the rows only with Physical Camera on");
  assert.deepStrictEqual(o.html0, [true, false, false, true, false], "real rows, no greyed placeholder");
  assert.deepStrictEqual(o.html1, [true, true, true]);
  assert.ok(o.refused[0] == null &&/Path Traced only/.test(o.refused[1]), "with Quick it asks for Path Traced: " + o.refused);
  assert.deepStrictEqual(o.taken, ["panorama", true]);
  assert.deepStrictEqual(o.v0, ["/persp", 0, 0, 0, false]);
  assert.ok(o.v1[0] === "dof/persp" && Math.abs(o.v1[1] - 1) < 1e-9 && Math.abs(o.v1[2] - 3000) < 1e-6 && o.v1[3] === 6 && o.v1[4] === 1, "the aperture f / N in mm (the shader's 1e-3), focus on the garment: " + o.v1);
  assert.deepStrictEqual(o.v2, ["dof/persp", 1234]);
  assert.deepStrictEqual(o.v3, ["/pano", 2, 0, true], "a panorama: the equirectangular camera, no depth of field");
  assert.strictEqual(o.prefs, false, "Fit Properties dropped");
});

module.exports = T;
