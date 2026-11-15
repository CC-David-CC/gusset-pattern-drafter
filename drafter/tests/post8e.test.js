// Round POST8, fifth session. Batch 0e: after Lay Flat, a hint to use a T-pose (with a button that sets it, one undo step).
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 180000, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}

test("POST8 batch 0e / T1: after Lay Flat on Marty in his A-pose the held hint \"Sleeves lie flatter if the avatar is in a T-pose: Avatar ▸ T-Pose …\" comes with a Set T-Pose button; pressed, the arms go out (one undo step \"T-Pose\", in the document's avatar edits; Ctrl+Z puts the A-pose back); in a T-pose no hint; with no avatar no hint", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {}, EX = app.ev("PATTERN_EXAMPLES"), ex = EX.find(e => /T-shirt/.test(e.name));
    app.ev("setLayout")("both");
    // with no avatar: Lay Flat says nothing of a pose
    app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
    app.ev("avatarNone")();
    const n0 = toasts.length; app.ev("layFlat")(); out.noAv = toasts.slice(n0).some(t => /T-pose/.test(t));
    app.undo();
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      app.ev("garmentSync")(); S.undo.length = 0; S.un.length = 0;
      const held = () => { app.ev("holdCheck")(); return !!app.ev("holdNow")(); };
      out.armsA = app.ev("armsOut")(S.av);
      out.menu = app.ev("avatarMenu")().some(r => r.n === "T-Pose");
      app.ev("layFlat")();
      out.hint = toasts.slice(-1)[0]; out.held = held();
      const act = app.ev("TOAST_ACT"); out.btn = act && act.label;
      out.steps0 = S.un.map(u => u.n);
      // (POST8 batch 0f: changed on purpose: the button now sets the T-pose, re-drapes and lays flat in one step, post8f.test.js; the T-pose alone is
      // tPoseStep(), Avatar ▸ T-Pose's step, and says nothing)
      out.set = app.ev("tPoseStep")();
      out.armsT = app.ev("armsOut")(S.av);
      out.next = toasts.slice(-1)[0]; out.heldAfter = held();
      out.steps1 = S.un.map(u => u.n);
      out.inDoc = Object.keys(S.avedit.joints || {}).length > 0;
      // in the T-pose: Lay Flat again gives no hint
      app.undo(); app.redo(); app.ev("foldgBack")();
      const n1 = toasts.length; app.ev("layFlat")(); out.tHint = toasts.slice(n1).some(t => /T-pose/.test(t));
      // undo back past T-Pose: the A-pose again
      while (S.un.length && S.un[S.un.length - 1].n !== "T-Pose") app.undo();
      app.undo(); out.armsBack = app.ev("armsOut")(S.av); out.jointsBack = Object.keys(S.avedit.joints || {}).length;
      return out;
    });` });
  assert.strictEqual(o.noAv, false, "no avatar: no hint");
  assert.ok(o.armsA < 70, "Marty stands in an A-pose: " + o.armsA);
  assert.strictEqual(o.menu, true, "the menu row the hint names is there");
  assert.strictEqual(o.hint, "Sleeves lie flatter if the avatar is in a T-pose: Avatar ▸ T-Pose, then Re-drape before Lay Flat.");
  assert.strictEqual(o.held, true, "held as Roll Up's hint is");
  assert.strictEqual(o.btn, "T-Pose, Re-drape, Lay Flat");      // (POST8 batch 0f: changed on purpose, the button's new label)
  assert.deepStrictEqual(o.steps0, ["Lay Flat"]);
  assert.strictEqual(o.set, true);
  assert.ok(Math.abs(o.armsT - 90) < 3, "the arms out level: " + o.armsT);
  assert.strictEqual(o.heldAfter, false, "the hint gone with its step");      // (POST8 batch 0f: the "T-Pose set" message is the hint path's only, no longer asserted here)
  assert.deepStrictEqual(o.steps1, ["Lay Flat", "T-Pose"], "one undo step");
  assert.strictEqual(o.inDoc, true, "kept in the document's avatar edits");
  assert.strictEqual(o.tHint, false, "in a T-pose: no hint");
  assert.ok(Math.abs(o.armsBack - o.armsA) < 0.5 && o.jointsBack === 0, "Ctrl+Z: the A-pose back: " + o.armsBack);
});

test("POST8 FIX-6 / A1: the Render panes' rows: Color Mapping ▸ HSV Exponential (V mapped by 1 − e^−V, hue and saturation kept), Linear Workflow (on by default), Crop (Final Render Only); each kept in the file only when not its default; Quality: Material, Mesh Optimization and Image Filter dropped", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: `
    const out = {}, N = app.ev("normRender");
    const d = N({}); out.plain = ["crop", "linear"].filter(k => k in d); out.tone0 = d.tone;
    const s = N({ crop: true, linear: false, tone: "hsv" }); out.set = [s.crop, s.linear, s.tone];
    out.odd = N({ crop: "yes", linear: 0, tone: "x" }); out.odd = [("crop" in out.odd), ("linear" in out.odd), out.odd.tone];
    const H = app.ev("ptToneHsv"); out.hsv = [H([0.2, 0.1, 0.05]), H([0, 0, 0]), H([50, 25, 12.5]), H([0.33, 0.33, 0.33])];
    out.glsl = /#ifdef PT_HSV/.test(app.ev("ptToneGLSL")()) && /exp[(] - v [)]/.test(app.ev("ptToneGLSL")());
    out.tones = app.ev("PT_TONES").map(t => t[1]);
    S.ui.unbuilt = true;
    const q = N({ mode: "quality" }), mh = app.ev("rwinModeHTML")(q), rh = app.ev("rwinRenderHTML")(q), ih = app.ev("rwinImageHTML")(q);
    out.mode = [/HSV Exponential/.test(mh), /data-r="linear" checked/.test(mh), /data-r="linear"(?! checked)/.test(app.ev("rwinModeHTML")(N({ mode: "quality", linear: false })))];
    out.dropped = ["Quality: Material", "Mesh Optimization", "Image Filter", "HSV Exponential Color Mapping", "Linear Workflow</label><span"].map(n => rh.includes(n));
    out.puck = rh.includes("Seam Puckering Intensity");
    out.crop = [/data-r="crop"/.test(ih), /Crop [(]Final Render Only[)]<\\/label><span class="u">[(]not built/.test(ih)];
    // the file: kept only when set
    app.ev("saveRender")({ ...N(S.render || {}), crop: true, tone: "hsv" }); out.doc = app.ev("docObj")().render; out.doc = [out.doc.crop, out.doc.tone, "linear" in out.doc];
    return out;` });
  assert.deepStrictEqual(o.plain, [], "a document that never set them writes neither");
  assert.strictEqual(o.tone0, "reinhard");
  assert.deepStrictEqual(o.set, [true, false, "hsv"]);
  assert.deepStrictEqual(o.odd, [false, false, "reinhard"]);
  const [a, z, big, grey] = o.hsv;
  assert.ok(Math.abs(a[1]/a[0] - 0.5) < 1e-9 && Math.abs(a[2]/a[0] - 0.25) < 1e-9, "hue and saturation kept: " + a);
  assert.deepStrictEqual(z, [0, 0, 0]);
  assert.ok(big[0] > 0.999 && big[0] <= 1 && Math.abs(big[1]/big[0] - 0.5) < 1e-6, "a bright pixel rolls off toward 1, its colour kept: " + big);
  assert.ok(Math.abs(grey[0] - 0.327) < 0.01, "the 3D window's gray stays about where it is (as Reinhard's gain keeps it): " + grey);
  assert.strictEqual(o.glsl, true);
  assert.deepStrictEqual(o.tones, ["Reinhard", "HSV Exponential", "ACES Filmic"]);
  assert.deepStrictEqual(o.mode, [true, true, true], "Color Mapping lists it; Linear Workflow a real check box, on by default");
  assert.deepStrictEqual(o.dropped, [false, false, false, false, false], "dropped or built: no greyed row left for them");
  assert.strictEqual(o.puck, true, "Seam Puckering Intensity still a greyed row with the switch on (UV-1)");
  assert.deepStrictEqual(o.crop, [true, false]);
  assert.deepStrictEqual(o.doc, [true, "hsv", false]);
});

test("POST8 FIX-6 / A2: Crop (Final Render Only) cuts a finished picture down to the garment and avatar as its camera sees them, with a margin; not with Crop off, not a series' picture, not when the box fills the picture", () => {
  const o = boot({ blank: true, three: true, desktop: true, script: `
    const out = {}, EX = app.ev("PATTERN_EXAMPLES"), ex = EX.find(e => /T-shirt/.test(e.name)), N = app.ev("normRender"), RWIN = app.ev("RWIN"), v3 = app.view3d;
    app.ev("setLayout")("both");
    app.ev("loadDoc")(JSON.parse(JSON.stringify(ex.doc))); app.ev("showDoc")(); app.ev("garmentSync")();
    Object.assign(v3.cam, { az: 0, el: 0.1, dist: 6000, tx: 0, ty: 1100, tz: 0 });
    const mk = () => { const c = app.ev("document").createElement("canvas"); c.width = 1920; c.height = 1080; return c; };
    const r = app.ev("renderCropRect")(N({ crop: true }), 1920, 1080, null); out.rect = r;
    // the garment's middle lies inside it
    const b = app.ev("garmentBox3")(), cam = v3.camFor(1920, 1080, null, null), THREE = app.ev("THREE"), m = new THREE.Vector3((b.x0 + b.x1)/2, (b.y0 + b.y1)/2, (b.z0 + b.z1)/2).project(cam);
    out.mid = [(m.x + 1)/2*1920, (1 - m.y)/2*1080];
    app.ev("rwinResult")(mk(), 1920, 1080, N({ crop: true }), null); out.res = [RWIN.result.w, RWIN.result.h, !!RWIN.result.crop];
    app.ev("rwinResult")(mk(), 1920, 1080, N({}), null); out.off = [RWIN.result.w, RWIN.result.h, !!RWIN.result.crop];
    RWIN.seq = { files: [] }; app.ev("rwinResult")(mk(), 1920, 1080, N({ crop: true }), null); out.seq = [RWIN.result.w, !!RWIN.result.crop]; RWIN.seq = null;
    // close in: the garment fills the picture, nothing to cut
    Object.assign(v3.cam, { dist: 400 }); out.close = app.ev("renderCropRect")(N({ crop: true }), 1920, 1080, null);
    return out;` });
  const r = o.rect;
  assert.ok(r && r.w < 1920 && r.h <= 1080 && r.w > 50 && r.h > 50, "cut down: " + JSON.stringify(r));
  assert.ok(o.mid[0] > r.x && o.mid[0] < r.x + r.w && o.mid[1] > r.y && o.mid[1] < r.y + r.h, "the garment's middle inside it");
  assert.deepStrictEqual(o.res, [r.w, r.h, true], "the result is the cut picture");
  assert.deepStrictEqual(o.off, [1920, 1080, false]);
  assert.deepStrictEqual(o.seq, [1920, false], "a series' pictures keep one size");
  assert.strictEqual(o.close, null);
});

module.exports = T;
