// Round PLOT-1 (roadmap 1.H22): Print Layout's Nesting ▸ Number of Garment (Current with its Total, or Select Grading with a number per
// size) and the bar's Remove Add'l Nesting Patterns, which takes the garments after the first away.
"use strict";
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

test("PLOT-1 / 1: Number of Garment Current: Total 3 lays every pattern its quantity times for each garment (keys running on, the second of a pair mirrored within each garment, not across), nested; one step; Remove Add'l Nesting Patterns takes them back to one (one step); with one garment it says so and makes no step; the layout's garments are kept only when not one, and through a file", () => {
  const o = boot({ script: `
    const out = {};
    S.pieces = [];
    const A = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)), B = app.mkPiece("Sleeve", app.mkShape([{x:300,y:0},{x:420,y:0},{x:420,y:150},{x:300,y:150}], true));
    B.quantity = 2; S.pieces.push(A, B); app.commit();
    const copies = () => app.ev("layoutCopies")();
    out.one = [copies().map(c => c.key), app.ev("garmentTotal")(), "garments" in app.ev("layoutOf")()];
    // Total 3 through the Property Editor's own path: one step
    const L = app.ev("layoutOf")(), u0 = S.undo.length;
    app.ev("push")(); L.garments = { n: 3 }; S.layout = app.ev("normLayout")(L); app.commit();
    const c3 = copies();
    out.three = [S.undo.length - u0, c3.length, c3.filter(c => c.src.id === B.id).map(c => [c.k, c.j, c.pair]), app.ev("garmentTotal")()];
    app.ev("layoutSync")(); out.places = c3.every(c => !!app.ev("layoutOf")().place[c.key]);
    // nested: every copy placed, none overlapping
    app.ev("layoutCmd")("nest"); app.ev("nestStop")(true);
    out.nested = [Object.keys(app.ev("layoutOf")().place).length, app.ev("layOverlaps")(app.ev("layoutPieces")()).n];
    out.names = app.ev("layoutPieces")().map(x => x.piece.name).slice(0, 4);
    // the file keeps it; 1 is not written
    out.norm = [app.ev("normLayout")({ garments: { n: 1 } }).garments, app.ev("normLayout")({ garments: { n: 99 } }).garments, app.ev("normLayout")({ garments: { n: "x" } }).garments];
    const d = JSON.parse(app.ev("docJSON")()); out.file = d.layout.garments;
    // Remove Add'l Nesting Patterns: one garment again, one step; the places of the copies gone
    const u1 = S.undo.length; app.ev("layoutCmd")("unnestAdd");
    out.removed = [S.undo.length - u1, app.ev("garmentTotal")(), Object.keys(app.ev("layoutOf")().place).length, "garments" in app.ev("layoutOf")()];
    const u2 = S.undo.length; app.ev("layoutCmd")("unnestAdd"); out.nothing = [S.undo.length - u2, /nothing to remove/.test(toasts[toasts.length - 1])];
    app.undo(); out.undone = app.ev("garmentTotal")();
    // the bar's button is built (shown with the not-built switch off)
    out.bar = app.ev("LAY_TOOLS").find(t => t[0] === "unnestAdd")[3];
    return out;` });
  assert.deepStrictEqual(o.one[0], [o.one[0][0], o.one[0][1], o.one[0][2]]);
  assert.strictEqual(o.one[0].length, 3);
  assert.deepStrictEqual(o.one.slice(1), [1, false], "one garment: nothing written");
  assert.strictEqual(o.three[0], 1);
  assert.strictEqual(o.three[1], 9, "(1 + 2) x 3");
  assert.deepStrictEqual(o.three[2], [[0, 0, false], [1, 1, true], [2, 0, false], [3, 1, true], [4, 0, false], [5, 1, true]], "a left and a right within each garment");
  assert.strictEqual(o.three[3], 3);
  assert.strictEqual(o.places, true);
  assert.deepStrictEqual(o.nested, [9, 0]);
  assert.deepStrictEqual(o.norm, [null, { n: 50 }, null], "(undefined comes back from the page as null)");
  assert.deepStrictEqual(o.file, { n: 3 });
  assert.deepStrictEqual(o.removed, [1, 1, 3, false]);
  assert.deepStrictEqual(o.nothing, [0, true]);
  assert.strictEqual(o.undone, 3);
  assert.strictEqual(o.bar, true);
});

test("PLOT-1 / 2: Number of Garment Select Grading: a number per size of the size group; each garment drawn at its size and named with it; a size with 0 has none; no size group: Current only; the Property Editor's rows", () => {
  const o = boot({ oldSizeRun: true, script: `
    const out = {};
    S.pieces = [];
    const A = app.mkPiece("Front", app.mkShape([{x:0,y:0},{x:200,y:0},{x:200,y:300},{x:0,y:300}], true)); S.pieces.push(A); app.commit();
    const grp = S.grading.groups[0], base = grp.sizes.find(z => z.id === grp.base), big = grp.sizes[grp.sizes.length - 1];
    // grade the pattern: its right side 20 mm wider at the largest size
    for (const i of [0, 3]) app.ev("setPtDelta")(S.grading, A, A, i, big.id, 0, 0);
    for (const i of [1, 2]) app.ev("setPtDelta")(S.grading, A, A, i, big.id, 20, 0);
    app.commit();
    const L = app.ev("layoutOf")(); app.ev("push")(); L.garments = { sizes: { [base.id]: 2, [big.id]: 1 } }; S.layout = app.ev("normLayout")(L); app.commit();
    const cs = app.ev("layoutCopies")();
    out.sizes = cs.map(c => [c.size, Math.round(Math.max(...c.p.pts.map(q => q.x)) - Math.min(...c.p.pts.map(q => q.x)))]);
    out.names = app.ev("layoutPieces")().map(x => x.piece.name);
    out.total = app.ev("garmentTotal")();
    // the Property Editor's rows: Select Grading chosen, a number per size
    const pr = { innerHTML: "", querySelectorAll: () => [] }; app.ev("layoutProps")(pr);
    out.rows = [/id="ly-gmode"/.test(pr.innerHTML), /<option value="sizes" selected>Select Grading/.test(pr.innerHTML), (pr.innerHTML.match(/data-gsize=/g) || []).length === grp.sizes.length, /Average Per Garment/.test(pr.innerHTML)];
    // a size with 0 and junk keys are not kept
    out.norm = app.ev("normLayout")({ garments: { sizes: { [base.id]: 0, "a b": 2 } } }).garments;
    // with no size group the list has Current only
    delete A.grade; S.grading = app.ev("defaultGrading")(); S.layout = app.ev("normLayout")({}); app.commit();
    const pr2 = { innerHTML: "", querySelectorAll: () => [] }; app.ev("layoutProps")(pr2);
    out.noGroup = [/<option value="sizes"/.test(pr2.innerHTML), /id="ly-gtotal"/.test(pr2.innerHTML)];
    return out;` });
  assert.strictEqual(o.total, 3);
  assert.deepStrictEqual(o.sizes.map(s => s[1]), [200, 200, 220], "two of the base size, one of the largest, 20 mm wider");
  assert.strictEqual(o.sizes[2][0] !== o.sizes[0][0], true);
  assert.ok(o.names[0].startsWith("Front " + o.sizes[0][0]) && /[(]3[)]$/.test(o.names[2]), JSON.stringify(o.names));
  assert.deepStrictEqual(o.rows, [true, true, true, true]);
  assert.strictEqual(o.norm, undefined);
  assert.deepStrictEqual(o.noGroup, [false, true]);
});

module.exports = T;
