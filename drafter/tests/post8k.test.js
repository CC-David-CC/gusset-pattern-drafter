// Round POST8, eleventh session. Batch 0k: high dynamic range environment maps (.hdr, .exr) for the dome; the lights, each kind, give the path
// tracer and Quick a light they can use (the real pictures: scripts/light-check.js, on the graphics card); Quick with a dome lit by its picture alone.
"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const { hdrBytes, exrBytes } = require("./hdr-make");

const T = [];
const test = (name, fn) => T.push({ name, fn });

// (the options through a file: the wide picture's text is longer than a Windows command line takes)
function boot(opt) {
  const fs = require("fs"), os = require("os"), f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "post8k-")), "opt.json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  fs.unlinkSync(f); fs.rmdirSync(path.dirname(f));
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr + (r.error ? r.error.message : ""));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}

// a sky written for the test, rows from the top: the top row a red "sun" far brighter than a picture's 1, the bottom row dim blue, between them grey
const f = (x, y) => (y === 0 ? [5000, 0, 0] : y === 3 ? [0, 0, 0.25] : [0.5, 1, 2]);
const HDR = hdrBytes(8, 4, f).toString("base64"), EXR = exrBytes(8, 4, f).toString("base64");
// 4096 across: box-averaged down to 2048; a "sun" 3 columns wide at 4000, one value over the half floats' end, one negative, one not a number
const WIDE = exrBytes(4096, 4, (x, y) => (y === 1 && x >= 1000 && x < 1003 ? [4000, 4000, 4000] : y === 2 && x === 10 ? [1e6, -5, NaN] : [0, 0, 0])).toString("base64");
const IES = "IESNA:LM-63-2002\n[TEST] Gusset test profile\nTILT=NONE\n1 1000 1 5 1 1 2 0 0 0\n1 1 100\n0 22.5 45 67.5 90\n0\n1000 900 600 200 0\n";

test("POST8 0k / 1: a .hdr and an .exr are read by three.js's own loaders: their light as it was (5000, not a picture's 1), rows from the bottom as every environment map here, 2 : 1, the half floats' end kept, a sun's light kept when the picture is made smaller; anything else is no picture", () => {
  const o = boot({ blank: true, three: true, script: `
    const D = app.ev("hdrDecode"), B = (s) => app.ev("bytesOfURL")("data:;base64," + s), px = (p, x, y) => Array.from(p.lin.slice(3*(y*p.w + x), 3*(y*p.w + x) + 3)).map(v => +v.toFixed(2));
    const h = D(B(${JSON.stringify(HDR)}), "hdr"), e = D(B(${JSON.stringify(EXR)}), "exr"), w = D(B(${JSON.stringify(WIDE)}), "exr");
    let row1 = 0; for (let x = 0; x < w.w; x++) row1 += w.lin[3*(w.w*(w.h - 1 - Math.floor(1*w.h/4)) + x)];
    let peak = 0, bad = 0; for (const v of w.lin) { if (!Number.isFinite(v) || v < 0) bad++; peak = Math.max(peak, v); }
    return { h: [h.w, h.h, h.sw, h.sh, px(h, 0, h.h - 1), px(h, 3, 0)], e: [e.w, e.h, px(e, 0, e.h - 1), px(e, 3, 0), px(e, 2, 1)], w: [w.w, w.h, w.sw, +row1.toFixed(0), peak, bad],
      none: [D(new Uint8Array([1, 2, 3]), "hdr"), D(new Uint8Array(40), "exr")], kinds: [app.ev("envFileKind")("Sky.HDR"), app.ev("envFileKind")("a.exr"), app.ev("envFileKind")("a.png")] };` });
  assert.strictEqual(o.h[0], 8); assert.strictEqual(o.h[1], 4, "2 : 1");
  assert.deepStrictEqual(o.h.slice(2, 4), [8, 4], "its own size kept");
  assert.ok(o.h[4][0] > 4900 && o.h[4][1] === 0, "the file's top row is the picture's top (the last row from the bottom), its sun at 5000: " + o.h[4]);
  assert.ok(Math.abs(o.h[5][2] - 0.25) < 0.01, "the bottom row: " + o.h[5]);
  assert.deepStrictEqual(o.e.slice(0, 2), [8, 4]);
  assert.deepStrictEqual([o.e[2], o.e[3], o.e[4]], [[5000, 0, 0], [0, 0, 0.25], [0.5, 1, 2]], "the .exr the same way up, its values exact");
  assert.deepStrictEqual(o.w.slice(0, 3), [2048, 1024, 4096], "made smaller to 2048 × 1024");
  assert.ok(Math.abs(o.w[3] - 3*4000/2) < 1, "the sun's light kept across the row (box-averaged, not sampled away): " + o.w[3]);
  assert.strictEqual(o.w[4], 65000, "a value over the half floats' end held at 65000");
  assert.strictEqual(o.w[5], 0, "no negative value, no value that is not a number");
  assert.deepStrictEqual(o.none, [null, null]);
  assert.deepStrictEqual(o.kinds, ["hdr", "exr", null]);
});

test("POST8 0k / 2: a .hdr or .exr as the dome's map: one step, kept as the file's bytes (images/<id>.hdr / .exr), saved and opened the same, its pixels decoded once; the pane names it (no picture of 40 MB in the page); a file that is not one is refused and no step", () => {
  const o = boot({ blank: true, three: true, script: `return (async () => {
    const out = {}, dome = app.ev("lightAdd")("dome"), n0 = S.undo.length;
    const save = () => new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
    out.bad = app.ev("lightEnvHdr")(dome.id, "bad.hdr", "data:;base64,AAAAAAAA", "hdr"); out.badSteps = S.undo.length - n0;
    out.ok = [app.ev("lightEnvHdr")(dome.id, "sky.hdr", "data:application/octet-stream;base64,${HDR}", "hdr")];
    const im = S.images.find(x => x.id === S.lights[0].env.img);
    out.im = [im.name, im.data.slice(0, 22), im.w, im.h, app.ev("envKind")(im)];
    out.steps = S.un.slice(-1).map(u => u.n);
    out.px = !!app.ev("envPixels")(im.id) && app.ev("envPending")() === false;
    out.tex = (() => { const t = app.ev("envTexture")(S.lights[0], 0, 1, "test"); return t && [t.image.width, t.image.height, t.type === app.ev("THREE").HalfFloatType]; })();
    app.ev("G3").light = dome.id; const html = app.ev("rwinLightsHTML")();
    out.pane = [html.includes("HDR · sky.hdr"), html.includes(im.data.slice(30, 60)), html.includes("Light Angle")];
    const file = await save(), parts = app.fileParts(file);
    out.parts = parts.map(p => p[0]).filter(n => /^images[/]/.test(n));
    const d1 = app.ev("canonJSON")(app.ev("docObj")());
    const n1 = toasts.length; app.ev("openFile")("again.pdraft", file, null, true); await app.wait(() => toasts.slice(n1).some(t => /^Opened again/.test(t)), "the file to open");
    out.same = app.ev("canonJSON")(app.ev("docObj")()) === d1;
    app.ev("ENV_PX").clear();      // (as on a fresh start: the file's bytes decoded, not the pixels kept from before)
    out.pend = app.ev("envPending")(); app.ev("envPixels")(S.lights[0].env.img);
    out.again = app.ev("envPending")() === false && !!app.ev("envPixels")(S.lights[0].env.img);
    out.exr = app.ev("lightEnvHdr")(S.lights[0].id, "sky.exr", "data:;base64,${EXR}", "exr") && S.images.find(x => x.id === S.lights[0].env.img).data.slice(0, 22);
    return out; })();` });
  assert.strictEqual(o.bad, false); assert.strictEqual(o.badSteps, 0, "refused: no step");
  assert.deepStrictEqual(o.ok, [true]);
  assert.deepStrictEqual(o.im, ["sky.hdr", "data:image/hdr;base64,", 8, 4, "hdr"]);
  assert.deepStrictEqual(o.steps, ["Environment Map"]);
  assert.strictEqual(o.px, true, "decoded at once when chosen");
  assert.deepStrictEqual(o.tex, [8, 4, true]);
  assert.deepStrictEqual(o.pane, [true, false, true], "named, not drawn; its rows");
  assert.deepStrictEqual(o.parts.map(n => n.replace(/[0-9]+/, "N")), ["images/N.hdr"]);
  assert.strictEqual(o.same, true, "saved and opened: the same document");
  assert.strictEqual(o.pend, true, "not decoded until asked (a picture loading)");
  assert.strictEqual(o.again, true, "decoded once asked (the reader is here at once in the tests)");
  assert.strictEqual(o.exr, "data:image/exr;base64,");
});

test("POST8 0k / 3: in a browser a .hdr / .exr over 64 MB is the desktop app's only (the lock and its box), and the pane says so; the desktop app has no limit", () => {
  const b = boot({ blank: true, script: `
    const out = { big: app.ev("envTooBig")(80e6), small: app.ev("envTooBig")(30e6) };
    out.box = (app.el("modal") && app.el("modal").textContent || "").includes("Only in the desktop app");
    const dome = app.ev("lightAdd")("dome"); app.ev("G3").light = dome.id; out.lock = app.ev("rwinLightsHTML")().includes("over 64 MB: only in the desktop app");
    return out;` });
  assert.deepStrictEqual([b.big, b.small, b.lock], [true, false, true]);
  const d = boot({ blank: true, desktop: true, script: `
    const dome = app.ev("lightAdd")("dome"); app.ev("G3").light = dome.id;
    return { big: app.ev("envTooBig")(500e6), lock: app.ev("rwinLightsHTML")().includes("only in the desktop app") };` });
  assert.deepStrictEqual([d.big, d.lock], [false, false]);
});

test("POST8 0k / 4: every kind of light gives the path tracer a light with every number it reads finite (a Spot's radius was undefined, NaN in the shader, until FIX-6 / C), and Quick a light or the dome's environment; a dome lit by its picture alone hides the 3D window's own lights in a Quick render", () => {
  const o = boot({ blank: true, three: true, script: `return (async () => {
    const out = { pt: {}, quick: {} }, box = { x0: -300, x1: 300, y0: 0, y1: 1800, z0: -200, z1: 200 };
    const nums = (L) => ["intensity", "radius", "angle", "penumbra", "decay", "distance", "width", "height"].filter(k => k in L).map(k => [k, L[k]]);
    for (const t of ["point", "spot", "dir", "rect", "ies", "dome"]) {
      for (const l of [...S.lights]) app.ev("lightDelete")(l.id);
      const l = app.ev("lightAdd")(t); if (t === "ies") app.ev("lightIesSet")(l.id, "a.ies", ${JSON.stringify(IES)});
      const lit = app.ev("ptLights")(box);
      out.pt[t] = { n: lit.lights.length, finite: lit.lights.every(L => nums(L).every(([, v]) => Number.isFinite(v))), pos: lit.lights.every(L => [L.position.x, L.position.y, L.position.z].every(Number.isFinite)), ies: lit.lights.some(L => !!L.iesTexture), dome: lit.dome.k };
      out.quick[t] = app.ev("lightObjects")(S.lights, box).map(L => L.type);
    }
    for (const l of [...S.lights]) app.ev("lightDelete")(l.id);
    const dome = app.ev("lightAdd")("dome"); app.ev("lightEnvHdr")(dome.id, "sky.hdr", "data:;base64,${HDR}", "hdr");
    // (the test's renderer draws nothing and has none of what PMREM asks of a real one: a stand-in that makes the environment)
    app.ev("THREE").PMREMGenerator = class { fromEquirectangular() { return { texture: { isTexture: true }, dispose() {} }; } dispose() {} };
    const R = app.ev("__renders"); R.length = 0;
    const o = { ...app.ev("loadRender")(), mode: "quick", size: "custom", w: 64, h: 48 };
    app.ev("renderShot")(o, { w: 64, h: 48 });
    out.shot = R.length ? R[R.length - 1].lights : null;
    return out; })();` });
  for (const t of ["point", "spot", "dir", "rect", "ies"]) {
    assert.strictEqual(o.pt[t].n, 1, t + ": one light for the path tracer");
    assert.strictEqual(o.pt[t].finite, true, t + ": every number it reads finite");
    assert.strictEqual(o.pt[t].pos, true, t + ": placed");
    assert.strictEqual(o.quick[t].length, 1, t + ": one light in Quick");
  }
  assert.strictEqual(o.pt.ies.ies, true, "the IES light with its profile");
  assert.ok(o.pt.dome.n === 0 && o.pt.dome.dome > 0, "the dome as the path tracer's environment: " + JSON.stringify(o.pt.dome));
  assert.deepStrictEqual(o.quick.dome, ["HemisphereLight"]);
  assert.ok(Array.isArray(o.shot), "a Quick picture was made");
  assert.deepStrictEqual(o.shot, [], "no light of the window's own beside the dome's picture: " + JSON.stringify(o.shot));
});

test("POST8 2.F1: File Path: in the desktop app a row naming the folder the shell keeps (Ask each time until one is chosen); Save writes a render there without asking, Ask Each Time goes back to the dialog; a browser has no row (its downloads), and no greyed one", () => {
  const b = boot({ blank: true, script: `
    const o = app.ev("loadRender")(); return { row: app.ev("rwinImageHTML")(o).includes("File Path"), unbuilt: S.ui.unbuilt };` });
  assert.deepStrictEqual(b, { row: false, unbuilt: true }, "a browser: no row, not even greyed with Show Tools That Are Not Built Yet on");
  const o = boot({ blank: true, desktop: true, script: `return (async () => {
    const out = {}, saved = [], asked = [], tick = () => new Promise(r => setTimeout(r, 5));
    let dir = null; const window = app.ev("window");
    window.desktop.renderFolder = { get: async () => dir, choose: async () => (dir = { name: "Renders" }), clear: async () => (dir = null), save: async (n, d) => { saved.push([n, d.length > 10]); return dir ? { path: "x/" + n, name: n } : null; } };
    window.desktop.exportFile = async (n) => { asked.push(n); return { path: "y/" + n, name: n }; };
    const RWIN = app.ev("RWIN"), html = () => app.ev("rwinImageHTML")(app.ev("loadRender")());
    html(); await tick();
    out.first = [html().includes("File Path"), html().includes("Ask each time"), html().includes('data-act="rw-dir-clear"')];
    app.ev("rwinDirAct")("rw-dir"); await tick();
    out.chosen = [RWIN.dir && RWIN.dir.name, html().includes("Renders"), html().includes('data-act="rw-dir-clear"')];
    app.ev("rwinDl")("skirt.png", new Uint8Array(40), "", null); await tick();
    app.ev("rwinDirAct")("rw-dir-clear"); await tick();
    app.ev("rwinDl")("skirt.png", new Uint8Array(40), "", null); await tick();
    out.saved = saved; out.asked = asked; out.after = html().includes("Ask each time");
    return out; })();` });
  assert.deepStrictEqual(o.first, [true, true, false]);
  assert.deepStrictEqual(o.chosen, ["Renders", true, true]);
  assert.deepStrictEqual(o.saved, [["skirt.png", true]], "written into the folder, not asked");
  assert.deepStrictEqual(o.asked, ["skirt.png"], "after Ask Each Time: asked where");
  assert.strictEqual(o.after, true);
});

module.exports = T;
