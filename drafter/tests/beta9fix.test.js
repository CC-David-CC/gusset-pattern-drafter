// BETA9-FIX: the start without WebGL. The v1.0.0-beta.9 release run's Mac (no WebGL at all) waited 30 s at every start: the page's
// "fully ready" (startReady()) asked for the 3D window drawn once, which never comes where three.js cannot make a renderer. Now a 3D window
// that cannot draw (view3d.failed()) counts as settled, and it says why it is empty. The real app: desktop/smoke.js with PDRAFT_NO_WEBGL=1.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-b9fix-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 300000, maxBuffer: 1 << 28 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
const ROOT = path.join(__dirname, "..", "..");
const APP = fs.readFileSync(path.join(__dirname, "..", "pattern-drafter.js"), "utf8");

// the fake page's timers run by hand (as r32 / 1): how many rounds of 16 ms until startReady() is done
const READY = `
  const G = app.ev("globalThis"), timeouts = [];
  G.setTimeout = (f) => { timeouts.push(f); return timeouts.length; }; G.requestAnimationFrame = undefined;
  let done = 0, rounds = 0;
  app.ev("recoverPending = null"); app.ev("startReady")(() => { done++; });
  while (!done && rounds < 50) { rounds++; for (const f of timeouts.splice(0)) f(); }`;

test("beta9-fix / 1: no WebGL: the 3D window could not start (view3d.failed()), it says so and keeps saying so, and the page is fully ready at once, not after START_WAIT", () => {
  const o = boot({ three: true, noGL: true, desktop: true, script: `
    app.ev('S.ui.layout = "both"'); app.ev("applyUI()");
    const out = { layout: app.ev("S.ui.layout"), ready: app.view3d.ready(), failed: app.view3d.failed(), note: app.el("note3d").textContent };
    app.ev("note3d()"); out.noteAfter = app.el("note3d").textContent;
    ${READY}
    out.done = done; out.rounds = rounds;
    // the 2D window still draws and edits
    app.ev("starterDoc(true)"); out.pieces = app.ev("S.pieces.length"); app.ev("draw()");
    return out;` }).result;
  assert.strictEqual(o.layout, "both");
  assert.deepStrictEqual([o.ready, o.failed], [false, true], "no renderer, and the 3D window knows it cannot draw");
  assert.ok(/could not start: no WebGL here/.test(o.note) && /2D window works/.test(o.note), o.note);
  assert.strictEqual(o.noteAfter, o.note, "note3d() keeps the line (it would have written the avatar and the view help over it)");
  assert.strictEqual(o.done, 1, "fully ready");
  assert.ok(o.rounds <= 3, "at once (" + o.rounds + " rounds), not after START_WAIT");
  assert.ok(o.pieces > 0, "the 2D window works");
});

test("beta9-fix / 2: with WebGL nothing changes: failed() is false, and the start still waits for the 3D window drawn once", () => {
  const o = boot({ three: true, desktop: true, script: `
    return app.wait(() => app.view3d.ready(), "the 3D window").then(() => {
      const R = app.view3d.renderer(); R.info = R.info || { render: { frame: 0 } }; R.info.render.frame = 0;
      const out = { failed: app.view3d.failed() };
      ${READY}
      out.notYet = done; R.info.render.frame = 1; for (let k = 0; k < 5; k++) for (const f of timeouts.splice(0)) f(); out.done = done;
      return out;
    });` }).result;
  assert.deepStrictEqual(o, { failed: false, notYet: 0, done: 1 });
});

test("beta9-fix / 3: the desktop smoke switches WebGL really off with PDRAFT_NO_WEBGL=1 and checks the no-WebGL start; its window check is per system (a Mac: see-through, out of the Dock)", () => {
  const SMOKE = fs.readFileSync(path.join(ROOT, "desktop", "smoke.js"), "utf8"), MAIN = fs.readFileSync(path.join(ROOT, "desktop", "main.js"), "utf8");
  assert.ok(/if \(NOGL\) \{ app\.disableHardwareAcceleration\(\); app\.commandLine\.appendSwitch\("disable-software-rasterizer"\); \}/.test(SMOKE));
  assert.ok(/\(beta9-fix\) no WebGL: usable within seconds of loading/.test(SMOKE) && /\(beta9-fix\) with WebGL: usable once the 3D window was drawn/.test(SMOKE), "checked either way, never a silent pass");
  assert.ok(/MAC \? w\.getOpacity\(\) > 0 : screen\.getAllDisplays\(\)/.test(SMOKE), "unseen means see-through on a Mac, off the displays elsewhere");
  assert.ok(/TEST_WIN === "hidden" && process\.platform === "darwin"\) \{[^}]*w\.setOpacity\(0\);\s*w\.setIgnoreMouseEvents\(true\);/.test(MAIN), "a Mac's hidden test window");
  assert.ok(/app\.dock\.hide\(\)/.test(MAIN) && /"CalculateNativeWinOcclusion,MacWebContentsOcclusion"/.test(MAIN));
  // only for a check's run: TEST_WIN is null for the app a person starts (testwindows / 2 runs that switch)
  assert.ok(/const TEST_WIN = \(\(\) => \{/.test(MAIN));
  assert.ok(/const settled3 = \(\) => drawn3\(\) \|\| \(typeof view3d !== "undefined" && !!view3d\.failed && view3d\.failed\(\)\);/.test(APP));
});

module.exports = T;
