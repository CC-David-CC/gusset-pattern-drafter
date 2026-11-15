// Round POST8, tenth session. FIX-6 / C: the lights: the IES light (its profile), the Dome's Environment Map, Light Angle, Lock to Camera, Finite Dome.
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

// a small Type C profile, round its axis: 1000 cd straight down, nothing at 90°
const IES = "IESNA:LM-63-2002\n[TEST] Gusset test profile\nTILT=NONE\n1 1000 1 5 1 1 2 0 0 0\n1 1 100\n0 22.5 45 67.5 90\n0\n1000 900 600 200 0\n";
// the same with a TILT table (two pairs) and a quarter of horizontal angles (0, 90): the second plane half as bright
const IES_TILT = "IESNA91\nTILT=INCLUDE\n1\n2\n0 90\n1 1\n1 -1 2 3 2 1 1 0 0 0\n1 1 50\n0 45 90\n0 90\n800 400 0\n400 200 0\n";
// a few bytes standing in for a picture (the program checks the kind; nothing here draws it)
const PNG = "data:image/png;base64,AAAA";

test("POST8 FIX-6 / C1: an .ies profile is read (TILT=NONE and INCLUDE, a quarter's planes folded round), its peak 1, outside its vertical range dark; anything else is refused", () => {
  const o = boot({ blank: true, script: `
    const P = app.ev("iesParse"), a = P(${JSON.stringify(IES)}), b = P(${JSON.stringify(IES_TILT)});
    const at = (p, v, h) => +p.data[v*360 + h].toFixed(4);
    return { a: [at(a, 0, 0), at(a, 0, 200), at(a, 45, 0), at(a, 90, 0), at(a, 120, 0), at(a, 11, 0), a.lumens], b: b && [at(b, 0, 0), at(b, 0, 90), at(b, 0, 180), at(b, 0, 270), at(b, 0, 45), at(b, 45, 0)],
      bad: [P(""), P("hello"), P("TILT=NONE\\n1 2 3"), P("TILT=NONE\\n1 1000 1 2 1 1 2 0 0 0\\n1 1 100\\n0 90\\n0\\n0 0\\n")].map(x => x === null) };` });
  assert.deepStrictEqual(o.a.slice(0, 5), [1, 1, 0.6, 0, 0], "down, any plane, 45°, 90°, past the table: " + o.a);
  assert.ok(o.a[5] > 0.9 && o.a[5] < 1, "between 0° and 22.5°: " + o.a[5]);
  assert.strictEqual(o.a[6], 1000);
  assert.ok(o.b, "TILT=INCLUDE read");
  assert.deepStrictEqual(o.b.slice(0, 4), [1, 0.5, 1, 0.5], "a quarter's planes mirrored round (0, 90, 180 = 0, 270 = 90): " + o.b);
  assert.ok(o.b[4] > 0.5 && o.b[4] < 1 && o.b[5] === 0.5, "between the planes; 45° down: " + o.b);
  assert.deepStrictEqual(o.bad, [true, true, true, true], "no TILT, too short, all dark");
});

test("POST8 FIX-6 / C2: the dome's picture turned: at Light Angle 0 its middle lies behind the avatar (From (round) 180), a turn moves it the way the lights' From (round) goes, Lock to Camera adds the camera's direction", () => {
  const o = boot({ blank: true, three: true, script: `
    const w = 8, h = 2, lin = new Float32Array(w*h*3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lin[3*(y*w + x)] = x/8;
    const F = app.ev("THREE").DataUtils.fromHalfFloat, T = app.ev("envTurned"), col = (d, x) => +F(d[4*x]).toFixed(3);
    // the column a direction (From (round), degrees) is read from in three.js's equirectangular pictures: u = 0.75 - az/360
    const seen = (deg, az) => { const d = T({ w, h, lin }, deg, 1), x = Math.round(((0.75 - az/360) % 1 + 1) % 1*w) % w; return col(d, x)*8; };
    const turn = app.ev("domeTurn"), camAz = app.ev("camAzOf");
    return { middle: seen(0, 180), turned: seen(90, 270), left: seen(0, 90), k: +F(T({ w, h, lin }, 0, 2)[4*2]).toFixed(3), alpha: F(T({ w, h, lin }, 0, 1)[3]),
      turn: [turn({ angle: 30 }, 45), turn({ angle: 30, lockCam: true }, 45), turn({}, 45)], cam: [camAz({ x: 0, z: 1000 }, { x: 0, z: 0 }), camAz({ x: 1000, z: 0 }, { x: 0, z: 0 })] };` });
  assert.strictEqual(o.middle, 4, "the picture's middle (column 4 of 8) seen behind the avatar");
  assert.strictEqual(o.turned, 4, "turned 90°: the middle moves from 180 to 270");
  assert.strictEqual(o.left, 6, "a quarter right of the middle at the avatar's left: seen from the front that is the camera's right, so the picture is not mirrored");
  assert.strictEqual(o.k, 1, "scaled: column 2 shows column 4 (0.5), × 2");
  assert.strictEqual(o.alpha, 1);
  assert.deepStrictEqual(o.turn, [30, 75, 0], "Light Angle, with Lock to Camera the camera's direction added");
  assert.deepStrictEqual(o.cam.map(Math.round), [0, 90], "front 0, the avatar's left 90");
});

test("POST8 FIX-6 / C3: an IES profile and a dome's picture are the light's: kept only when set, saved and opened the same, the picture kept with the file; one undo step each; a wrong file refused", () => {
  const o = boot({ blank: true, script: `
    const out = {};
    const plain = app.ev("lightAdd")("spot"), ies = app.ev("lightAdd")("ies"), dome = app.ev("lightAdd")("dome");
    out.plain = Object.keys(S.lights[0]).sort().join(",");
    const n0 = S.undo.length;
    out.bad = [app.ev("lightIesSet")(ies.id, "x.ies", "not a profile"), app.ev("lightEnvSet")(dome.id, "x.txt", "data:text/plain,not a picture", 4, 2)];
    out.badSteps = S.undo.length - n0;
    out.ok = [app.ev("lightIesSet")(ies.id, "down.ies", ${JSON.stringify(IES)}), app.ev("lightEnvSet")(dome.id, "sky.png", ${JSON.stringify(PNG)}, 4, 2)];
    app.ev("lightSet")(dome.id, "angle", 400); out.angleHigh = S.lights[2].angle;
    app.ev("lightSet")(dome.id, "angle", -35); app.ev("lightSet")(dome.id, "lockCam", true); app.ev("lightSet")(dome.id, "finite", true);
    out.steps = S.un.slice(-6).map(u => u.n);
    out.used = app.ev("usedImages")().map(im => im.name);
    const d1 = app.ev("canonJSON")(app.ev("docObj")());
    app.ev("loadDoc")(JSON.parse(d1)); app.ev("showDoc")();
    out.same = app.ev("canonJSON")(app.ev("docObj")()) === d1;
    out.ies = S.lights[1].ies && [S.lights[1].ies.name, S.lights[1].ies.text.length];
    out.dome = { env: !!S.lights[2].env, angle: S.lights[2].angle, lockCam: S.lights[2].lockCam, finite: S.lights[2].finite, has: app.ev("domeHasMap")(S.lights[2]) };
    // a light keeps them through a change of kind and back
    app.ev("lightSet")(S.lights[2].id, "type", "dir"); app.ev("lightSet")(S.lights[2].id, "type", "dome"); out.kept = !!(S.lights[2].env && S.lights[2].finite);
    // a switch turned off, a Light Angle back to 0: gone from the light (not merely left as they were)
    app.ev("lightSet")(S.lights[2].id, "finite", false); app.ev("lightSet")(S.lights[2].id, "lockCam", false); app.ev("lightSet")(S.lights[2].id, "angle", 0);
    out.off = ["finite", "lockCam", "angle"].filter(k => k in S.lights[2]);
    // the picture is kept for an undo step that names it, though no light does now
    const id = S.lights[2].id; app.ev("lightDelete")(id); out.usedAfterDelete = app.ev("usedImages")().length;
    return out;` });
  assert.strictEqual(o.plain, "az,color,el,id,intensity,name,on,spread,type", "a light without them writes none");
  assert.deepStrictEqual(o.bad, [false, false], "refused");
  assert.strictEqual(o.badSteps, 0, "a refused file is no step");
  assert.deepStrictEqual(o.ok, [true, true]);
  assert.strictEqual(o.angleHigh, 180, "Light Angle held within -180 to 180");
  assert.deepStrictEqual(o.steps, ["IES Profile", "Environment Map", "Edit Light", "Edit Light", "Edit Light", "Edit Light"]);
  assert.deepStrictEqual(o.used, ["sky.png"], "the picture goes into the file");
  assert.strictEqual(o.same, true, "saved, opened, saved: the same");
  assert.deepStrictEqual(o.ies, ["down.ies", 124]);
  assert.deepStrictEqual(o.dome, { env: true, angle: -35, lockCam: true, finite: true, has: true });
  assert.strictEqual(o.kept, true);
  assert.deepStrictEqual(o.off, [], "switched off: gone");
  assert.strictEqual(o.usedAfterDelete, 1, "the history still names it");
});

test("POST8 FIX-6 / C4: the Light pane: + IES, the IES File and the Dome's Environment Map rows, Light Angle / Lock to Camera / Finite Dome once a picture is chosen, no 'not built' row left; Background offers the dome's picture only while one lights", () => {
  const o = boot({ blank: true, script: `
    const out = {}, has = (h, s) => h.includes(s);
    const ies = app.ev("lightAdd")("ies"), dome = app.ev("lightAdd")("dome");
    const G3 = app.ev("G3"); G3.light = ies.id; let h = app.ev("rwinLightsHTML")();
    out.ies = [has(h, 'data-add="ies"'), has(h, "IES File"), has(h, 'data-act="lt-ies"'), has(h, "(not built yet)"), has(h, "From (round)")];
    G3.light = dome.id; h = app.ev("rwinLightsHTML")();
    out.dome0 = [has(h, "Environment Map"), has(h, 'data-act="lt-env"'), has(h, "Light Angle"), has(h, "Lock to Camera"), has(h, "Finite Dome"), has(h, "(not built yet)"), has(h, "Light Intensity")];
    const o0 = app.ev("loadRender")(); out.bg0 = app.ev("rwinImageHTML")(o0).includes('value="dome"');
    app.ev("lightEnvSet")(dome.id, "sky.png", ${JSON.stringify(PNG)}, 4, 2);
    h = app.ev("rwinLightsHTML")();
    out.dome1 = [has(h, "Light Angle"), has(h, 'data-l="lockCam"'), has(h, 'data-l="finite"'), has(h, 'data-act="lt-env-del"'), has(h, 'data-l="color"'), has(h, "(not built yet)")];
    out.bg1 = app.ev("rwinImageHTML")(app.ev("loadRender")()).includes('value="dome"');
    out.unbuilt = S.ui.unbuilt;
    return out;` });
  assert.strictEqual(o.unbuilt, true, "checked with Show Tools That Are Not Built Yet on");
  assert.deepStrictEqual(o.ies, [true, true, true, false, true]);
  assert.deepStrictEqual(o.dome0, [true, true, false, false, false, false, true], "no picture: only the row to choose one");
  assert.deepStrictEqual(o.dome1, [true, true, true, true, false, false], "with a picture: its rows, no Color");
  assert.deepStrictEqual([o.bg0, o.bg1], [false, true]);
});

test("POST8 FIX-6 / C5: what each renderer gets: the path tracer an IES light as a photometric spot with its profile (each profile once), the dome with its picture; Quick a wide spot and no sky light for a dome lit by its picture; Finite Dome's ground under the avatar", () => {
  const o = boot({ blank: true, three: true, script: `
    const out = {};
    const a = app.ev("lightAdd")("ies"), b = app.ev("lightAdd")("ies"), c = app.ev("lightAdd")("ies"), dome = app.ev("lightAdd")("dome");
    app.ev("lightIesSet")(a.id, "a.ies", ${JSON.stringify(IES)}); app.ev("lightIesSet")(b.id, "b.ies", ${JSON.stringify(IES)});
    const box = { x0: -300, x1: 300, y0: 0, y1: 1800, z0: -200, z1: 200 };
    const lit = app.ev("ptLights")(box);
    out.pt = lit.lights.map(L => [L.isSpotLight, !!L.iesTexture]);
    out.ies = lit.ies.length; out.tex = lit.ies[0] && [lit.ies[0].image.width, lit.ies[0].image.height];
    out.domeNoMap = !!lit.dome.l && !app.ev("domeHasMap")(lit.dome.l);
    app.ev("lightEnvSet")(dome.id, "sky.png", ${JSON.stringify(PNG)}, 4, 2);
    out.ptDome = app.ev("ptLights")(box).dome.l.id === dome.id;
    const q = app.ev("lightObjects")(S.lights, box);
    out.quick = q.map(L => L.isHemisphereLight ? "hemi" : L.isSpotLight ? "spot:" + (L.angle > 1.5) + ":" + !!L.iesTexture : "other");
    app.ev("lightSet")(dome.id, "on", false); out.quickOff = app.ev("lightObjects")(S.lights, box).length;
    const T = app.ev("THREE"), tex = new T.DataTexture(new Uint16Array(4*8*4), 8, 4, T.RGBAFormat, T.HalfFloatType), g = app.ev("envGround")(tex, new T.Vector3(10, 0, 20));
    const p = g.geometry.attributes.position, uv = g.geometry.attributes.uv;
    let ymax = 0, rmax = 0, vmax = 0; for (let i = 0; i < p.count; i++) { ymax = Math.max(ymax, Math.abs(p.getY(i))); rmax = Math.max(rmax, Math.hypot(p.getX(i) - 10, p.getZ(i) - 20)); vmax = Math.max(vmax, uv.getY(i)); }
    out.ground = [g.name, ymax, Math.round(rmax), vmax < 0.5, uv.getY(0)];
    return out;` });
  assert.deepStrictEqual(o.pt, [[true, true], [true, true], [true, false]], "two with a profile, one without (a plain wide spot)");
  assert.strictEqual(o.ies, 1, "the same profile once");
  assert.deepStrictEqual(o.tex, [360, 180]);
  assert.strictEqual(o.domeNoMap, true);
  assert.strictEqual(o.ptDome, true, "the dome lit by its picture");
  assert.deepStrictEqual(o.quick, ["spot:true:false", "spot:true:false", "spot:true:false"], "Quick: wide spots, no sky light for the dome lit by its picture");
  assert.strictEqual(o.quickOff, 3, "a dome switched off lights nothing");
  assert.deepStrictEqual(o.ground.slice(0, 4), ["render:dome", 0, 60000, true], "flat on the floor round the avatar, out to 60 m (within the far clipping plane), only the picture's lower half");
  assert.strictEqual(o.ground[4], 0, "straight down under the eye: the picture's bottom row");
});

test("POST8 FIX-6 / D1: an internal line's Show Schematic Line, Z-Offset and Face: in the Property Editor beside Fold, one step each, kept only when not the default, saved and opened the same", () => {
  const o = boot({ blank: true, script: `
    const out = {}, p = app.mkPiece("P", app.mkShape([{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:400}], true)); S.pieces.push(p);
    app.ev("addChild")(p, "internals", app.mkShape([{x:50,y:100},{x:250,y:100}], false)); app.ev("commit")();
    app.ev("setTool")("edit_pattern"); S.sel = [p.id]; S.selKind = "internal"; S.selInt = 0; S.selSeg = 0; S.selPt = -1; app.ev("ui")();
    const html = app.el("props").innerHTML;
    out.rows = ["Show Schematic Line", "Z-Offset (mm)", 'id="sc-f"', "(not built yet)"].map(s => html.includes(s));
    out.def = JSON.stringify(app.ev("schLineOf")(p.internals[0]));
    const set = app.ev("setSchLine"), n0 = S.undo.length;
    set(p.internals[0], "z", 80); out.zHigh = p.internals[0].schZ;
    set(p.internals[0], "z", -3.5); set(p.internals[0], "face", "back"); set(p.internals[0], "show", false);
    out.steps = S.undo.length - n0; out.keys = ["schOff", "schZ", "schFace"].map(k => p.internals[0][k]);
    const d1 = app.ev("canonJSON")(app.ev("docObj")()); app.ev("loadDoc")(JSON.parse(d1)); app.ev("showDoc")();
    out.same = app.ev("canonJSON")(app.ev("docObj")()) === d1;
    const q = S.pieces[0].internals[0]; set(q, "show", true); set(q, "z", 0); set(q, "face", "both");
    out.back = ["schOff", "schZ", "schFace"].filter(k => k in q);
    return out;` });
  assert.deepStrictEqual(o.rows, [true, true, true, false], "its rows, none greyed");
  assert.strictEqual(o.def, JSON.stringify({ show: true, z: 0, face: "both" }));
  assert.strictEqual(o.zHigh, 50, "Z-Offset held within ±50 mm");
  assert.strictEqual(o.steps, 4);
  assert.deepStrictEqual(o.keys, [true, -3.5, "back"]);
  assert.strictEqual(o.same, true);
  assert.deepStrictEqual(o.back, [], "back to the defaults: nothing kept");
});

test("POST8 FIX-6 / D2: a schematic line's points: lifted along the cloth's front by its Z-Offset (the other way on a pattern with its faces swapped), and with Face Front / Back only where that face is turned to the camera", () => {
  const o = boot({ blank: true, three: true, script: `
    const T = app.ev("THREE"), runs = app.ev("schLineRuns");
    // a flat square of cloth in the z = 0 plane, its two triangles wound so their normal is +z; a line across it
    const it = { X: new Float64Array([0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0]) }, an = (x, y) => ({ i: [0, 1, 2], w: [1 - x/100, x/100 - y/100, y/100] });
    const l = { an: [an(10, 5), an(50, 5), an(90, 5)], closed: false }, front = new T.Vector3(50, 50, 1000), back = new T.Vector3(50, 50, -1000);
    const z = (r) => r.map(run => run.map(p => +p.z.toFixed(3)));
    return { lift: z(runs(it, l, { show: true, z: 4, face: "both" }, front, 1)), flipped: z(runs(it, l, { show: true, z: 4, face: "both" }, front, -1)),
      ff: runs(it, l, { show: true, z: 0, face: "front" }, front, 1).length, fb: runs(it, l, { show: true, z: 0, face: "front" }, back, 1).length,
      bb: runs(it, l, { show: true, z: 0, face: "back" }, back, 1).length, bf: runs(it, l, { show: true, z: 0, face: "back" }, front, 1).length,
      both: runs(it, l, { show: true, z: 0, face: "both" }, back, 1).length, closed: runs(it, { ...l, closed: true }, { show: true, z: 0, face: "both" }, front, 1)[0].length };` });
  assert.deepStrictEqual(o.lift, [[4, 4, 4]], "4 mm toward the front");
  assert.deepStrictEqual(o.flipped, [[-4, -4, -4]], "Flip Normal: the front is the other side");
  assert.deepStrictEqual([o.ff, o.fb, o.bb, o.bf, o.both], [1, 0, 1, 0, 1], "Front seen from the front only, Back from the back only, Both always");
  assert.strictEqual(o.closed, 4, "a closed line ends where it began");
});

test("POST8 FIX-6 / D3: the schematic's vectors: a line mask traced into one simplified path, a ring into a closed one; a pattern's pixels into its outline with its hole (filled even-odd it is those pixels)", () => {
  const o = boot({ blank: true, script: `
    const W = 30, H = 30, m = new Uint8Array(W*H), ring = new Uint8Array(W*H);
    for (let x = 2; x < 22; x++) m[5*W + x] = 1;
    for (let k = 0; k < 10; k++) { ring[10*W + 10 + k] = ring[19*W + 10 + k] = ring[(10 + k)*W + 10] = ring[(10 + k)*W + 19] = 1; }
    const ch = app.ev("maskChains")(m, W, H).map(c => app.ev("rdp")(c, 0.35)), rc = app.ev("maskChains")(ring, W, H);
    const inside = (x, y) => x >= 5 && x < 15 && y >= 5 && y < 15 && !(x >= 8 && x < 12 && y >= 8 && y < 12);
    const loops = app.ev("maskLoops")(inside, 5, 5, 14, 14), area = (lp) => { let a = 0; for (let k = 0; k < lp.length; k++) { const p = lp[k], q = lp[(k + 1) % lp.length]; a += p[0]*q[1] - q[0]*p[1]; } return a/2; };
    const one = app.ev("maskLoops")((x, y) => x === 3 && y === 4, 3, 4, 3, 4);
    return { ch, ring: [rc.length, rc[0].length, JSON.stringify(rc[0][0]) === JSON.stringify(rc[0][rc[0].length - 1])], loops: loops.length, areas: loops.map(area).map(a => +a.toFixed(3)).sort((a, b) => a - b),
      bounds: [Math.min(...loops[0].map(p => p[0])), Math.max(...loops[0].map(p => p[0]))], one: one.length };` });
  assert.deepStrictEqual(o.ch, [[[2.5, 5.5], [21.5, 5.5]]], "a straight run of pixels: one path, two points");
  assert.deepStrictEqual(o.ring, [1, 37, true], "a ring of 36 pixels: one closed chain");
  assert.strictEqual(o.loops, 2, "the outline and its hole");
  // the inside on each loop's right, so the outline and the hole run opposite ways round: filled even-odd (or nonzero) the region is 100 pixels less
  // the hole's 16, each corner cut by an eighth of a pixel (the outline's four off the region, the hole's four into the hole): 99.5 and 15.5
  assert.deepStrictEqual(o.areas, [-15.5, 99.5], "outline and hole, opposite ways round");
  assert.deepStrictEqual(o.bounds, [5, 15], "on the pixels' own edges");
  assert.strictEqual(o.one, 1, "a single pixel: one small loop");
});

test("POST8 FIX-6 / D4: SVG offered for a single schematic picture only, kept in the render settings; the SVG text: background, each view's fill, one path per line kind at its weight in the line colour, hidden kinds left out; Crop cuts its view box; Save without a Final Render says so", () => {
  const o = boot({ blank: true, script: `
    const out = {}, F = app.ev("rwinFormats"), has = (o) => F(o).some(f => f[0] === "svg");
    out.offer = [has({ mode: "schematic", kind: "image" }), has({ mode: "schematic", kind: "turntable" }), has({ mode: "quick", kind: "image" }), has({ mode: "quality", kind: "image" })];
    out.norm = app.ev("normRender")({ fmt: "svg" }).fmt;
    const o = { ...app.ev("normRender")({}), mode: "schematic", fmt: "svg", schColor: "#112233", schSil: 3, schSeam: 2, schInt: 0, schStitch: 2, schHide: ["schStitch"], bg: "white" };
    const v = { w: 200, h: 100, vec: { pic: null, fills: [{ color: "#ffffff", loops: [[[1, 1], [9, 1], [9, 9]]] }], lines: { sil: [[[0, 0], [10, 0]]], seam: [[[1, 2], [3, 4], [5, 6]]], int: [[[0, 0], [1, 1]]], stitch: [[[2, 2], [3, 3]]] } } };
    const s = app.ev("schSvgText")(o, 400, 100, 200, [v, v]);
    out.svg = [/^<svg [^>]*width="400" height="100" viewBox="0 0 400 100"/.test(s), (s.match(/<rect /g) || []).length, (s.match(/<g transform/g) || []).length, (s.match(/class="sil"[^>]*stroke-width="3"/g) || []).length,
      (s.match(/class="seam"[^>]*stroke-width="2"/g) || []).length, s.includes('class="int"'), s.includes('class="stitch"'), s.includes('stroke="#112233"'), s.includes('fill-rule="evenodd" d="M1 1L9 1L9 9Z"'), s.includes('translate(200 0)')];
    out.see = (app.ev("schSvgText")({ ...o, bg: "transparent" }, 400, 100, 200, [v]).match(/<rect /g) || []).length;
    out.crop = app.ev("svgCrop")(s, { x: 20, y: 10, w: 100, h: 50 }).slice(0, 160);
    app.ev("saveRender")({ ...app.ev("loadRender")(), mode: "schematic", fmt: "svg", kind: "image" });
    const RWIN = app.ev("RWIN"); RWIN.result = null; RWIN.shown = true; app.ev("rwinSave")();
    return out;` });
  assert.deepStrictEqual(o.offer, [true, false, false, false]);
  assert.strictEqual(o.norm, "svg");
  assert.deepStrictEqual(o.svg, [true, 1, 2, 2, 2, false, false, true, true, true], "0 px and hidden kinds left out");
  assert.strictEqual(o.see, 0, "transparent: no background");
  assert.ok(/width="100" height="50" viewBox="20 10 100 50"/.test(o.crop), o.crop);
});

module.exports = T;
