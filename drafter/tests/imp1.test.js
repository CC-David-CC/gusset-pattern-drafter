// Round IMP-1 (roadmap 1.S15a, 1.S28, 1.3c): more of a project file comes in. Batch A: a fabric's front, back and side colours (the
// colorway in use), its weight and its thickness. The files here are made by zprj-make.js from the layout in docs/zprj-format.md: no file
// of another program is used.
"use strict";
const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");
const ZPRJ = require("../zprj-import.js");
const MK = require("./zprj-make");

const T = [];
const test = (name, fn) => T.push({ name, fn });
function boot(opt) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: 240000, maxBuffer: 1 << 27 });
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const ring = (n) => Array.from({ length: n }, (_, k) => ({ start: k, end: (k + 1) % n }));
const square = { points: [[-100, -100], [100, -100], [100, 100], [-100, 100]], lines: ring(4) };

test("IMP-1 / A 1: the reader takes a fabric's colours by face (front, back, side) as #rrggbb, its weight (density × 10⁶, g/m²) and thickness (mm); a fabric without them has none, and nothing is counted as a default; a colour out of range is left out", async () => {
  const r = await ZPRJ.importZprj(MK.zprj([], { pac: MK.pac([square], null, { fabrics: [
    { name: "Navy twill", type: "Woven", color: [0.1922, 0.2, 0.5], back: [1, 1, 1], side: [0, 0, 0], density: 0.00023, thickness: 0.41 },
    { name: "Plain" },
    { name: "Odd", color: [2, 0, 0], density: 5, thickness: -1 }] }) }));
  assert.deepStrictEqual(r.fabrics[0], { name: "Navy twill", type: "Woven", content: "", color: "#313380", back: "#ffffff", side: "#000000", weight: 230, thickness: 0.41 });
  assert.deepStrictEqual(r.fabrics[1], { name: "Plain", type: "Woven", content: "" });
  assert.deepStrictEqual(r.fabrics[2], { name: "Odd", type: "Woven", content: "" }, "out of range: left out");
  assert.ok(!Object.keys(r.defaults).some(k => /Colorway|Physical|BaseColor|Density|Thickness/.test(k)), JSON.stringify(r.defaults));
});

test("IMP-1 / A 2: imported, the fabric of the library has the file's colours, weight and thickness (its preset by type as before); a fabric without them keeps the defaults as before; one already in the library by name is used as it is", () => {
  const o = boot({ script: `
    const rep = { fabrics: [] }, res = { fabrics: [{ name: "Navy twill", type: "Woven", content: "", color: "#313380", back: "#ffffff", side: "#000000", weight: 230, thickness: 0.41 }, { name: "Plain", type: "Knit", content: "" }] };
    const pieces = [{ _zf: 0 }, { _zf: 1 }];
    app.ev("zprjFabrics")(res, pieces, rep);
    const f = (id) => S.lib.fabric.find(x => x.id === id), a = f(pieces[0].fabric), b = f(pieces[1].fabric);
    return { a: [a.name, a.physical, a.color, a.back, a.faces, a.weight, a.thickness], b: [b.name, b.physical, b.color, b.weight, b.thickness, b.faces === undefined], rep: rep.fabrics };` });
  assert.deepStrictEqual(o.a, ["Navy twill", "Medium woven", "#313380", "#ffffff", { side: { color: "#000000" } }, 230, 0.41]);
  assert.deepStrictEqual(o.b, ["Plain", "Single jersey", "#ffffff", 150, 0.5, true], "the library's defaults, as an import gave them before");
  assert.deepStrictEqual(o.rep, ["Navy twill", "Plain"]);
});

module.exports = T;
