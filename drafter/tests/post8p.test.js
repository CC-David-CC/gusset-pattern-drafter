// Round POST8, sixteenth session. FIX-8 / C (roadmap 3.A14): Register Pose, File ▸ Save As ▸ Pose, our pose file read by Load Pose File.
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

test("FIX-8 / C1: Register Pose keeps the avatar as it stands (every bone's turn) in this computer's pose list; chosen again later it stands him the same; its file (our JSON) is read back as it was written; anything else is refused", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {};
    app.ev("setLayout")("both");
    app.ev("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true);
    return app.wait(() => S.av, "Marty").then(() => {
      const arms = () => Math.round(app.ev("armsOut")(S.av));
      app.ev("setPosePreset")("t"); out.t = arms();
      app.ev("registerPose")("My T");
      const p = S.poses.find(x => x.name === "My T"); out.kept = [!!p, Object.keys(p.q).length >= 50, !!app.ev("localStorage").getItem("pdraft:poses")];
      app.ev("setPosePreset")("file"); out.loaded = arms();
      app.ev("setAvatar")({ base: "My T", pose: {} }); out.again = arms();
      const txt = app.ev("poseFileText")("My T", p.q), back = app.ev("poseFileRead")(txt);
      out.file = [JSON.parse(txt).gusset, back.name, Object.keys(back.q).length === Object.keys(p.q).length];
      out.bad = [app.ev("poseFileRead")("{}"), app.ev("poseFileRead")("x"), app.ev("poseFileRead")(JSON.stringify({ gusset: "pose", q: {} }))];
      out.rows = app.ev("avatarMenu")().filter(r => /Register Pose|Load Pose File/.test(r.n || "")).map(r => r.n);
      const sa = app.MENUS.file().find(x => x && x.n === "Save As").menu().find(x => x && /^Pose/.test(x.n || "")); out.save = [sa.n, !!sa.off];
      return out;
    });` });
  assert.ok(o.t >= 70 && o.loaded < 70, JSON.stringify(o));
  assert.deepStrictEqual(o.kept, [true, true, true]);
  assert.ok(Math.abs(o.again - o.t) <= 2, "the registered pose stands him as he stood: " + JSON.stringify(o));
  assert.deepStrictEqual(o.file, ["pose", "My T", true]);
  assert.deepStrictEqual(o.bad, ["That is not a pose file", "That is not a pose file", "There are no bones in that pose file"]);
  assert.deepStrictEqual(o.rows, ["Load Pose File… (.fbx, .glb, .json)", "Register Pose…"]);
  assert.deepStrictEqual(o.save, ["Pose…", false]);
});

module.exports = T;
