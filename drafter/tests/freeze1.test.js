// FREEZE-1 (run 15, part 2 / B; the freeze plan): the file format is frozen at version 37, "the 1.0 format".
//   1. The golden files in files/v37/ (one per feature area, written once by scripts/make-golden.js) are the ones FROZEN.json names,
//      byte for byte, and the app writes the version they were frozen at.
//   2. Every golden file opens with no error and saves to the very same parts, byte for byte (open identically forever): a rename, a
//      removal, a change of meaning or of a default of a field in the format fails here. Only additive optional fields, written only when
//      set, pass.
//   3. Every file of versions 30 to 36 opens and saves as 37: its document is the old one but for `v` (and, from version 30, the parts 31
//      added: the defaults it was written with and its render settings), and that 37 opens and saves again to the same bytes.
// Release check rule 17 runs this file (run.js freeze1).
"use strict";
const FV = require("./harness").FILE_VERSION;
const assert = require("assert");
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { spawnSync } = require("child_process");
const T = [];
const test = (name, fn) => T.push({ name, fn });
const DIR = path.join(__dirname, "files", "v37"), FROZEN = JSON.parse(fs.readFileSync(path.join(DIR, "FROZEN.json"), "utf8"));

function boot(opt) {
  const f = path.join(require("os").tmpdir(), "pdraft-freeze1-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".json");
  fs.writeFileSync(f, JSON.stringify(opt || {}));
  let r;
  try { r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), "@" + f], { encoding: "utf8", timeout: 600000, maxBuffer: 1 << 29 }); } finally { fs.unlinkSync(f); }
  if (r.status !== 0) throw new Error("boot process failed: " + (r.error || r.stderr));
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o;
}
// in the page: a file opened, saved, its parts as text (JSON) or as a hash (binary)
const TOOLS = `
  const E = (n) => app.ev(n);
  const save = () => new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); app.setDownload(null); });
  const parts = (b) => { let q = null; E("zipUnpack")(b, (e, p) => { q = p; }); return q; };
  const hash = (u) => { let h = 2166136261; for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return u.length + ":" + h.toString(16); };
  const view = (b) => { const p = parts(b), o = {}; for (const [k, v] of p) o[k] = /[.]json$/.test(k) ? new TextDecoder().decode(v) : hash(v); return o; };
  const marty = async () => { if (S.av) return; E("setLayout")("both"); E("avatarLoaded")(app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty"); };
`;

test("freeze1 / 1: the file format is frozen at version 37: the app writes 37, and the golden files are the ones FROZEN.json names, byte for byte (written once, never again)", () => {
  assert.strictEqual(FROZEN.version, 37, "the frozen version");
  assert.strictEqual(FV, FROZEN.version, "the app's FILE_VERSION is the frozen version (an incompatible change needs the maintainer's decision)");
  const here = fs.readdirSync(DIR).filter(n => n.endsWith(".pdraft")).sort();
  assert.deepStrictEqual(here, Object.keys(FROZEN.files).sort(), "every golden file is listed, and only those");
  assert.ok(here.length >= 7, "one per feature area");
  for (const n of here) assert.strictEqual(crypto.createHash("sha256").update(fs.readFileSync(path.join(DIR, n))).digest("hex"), FROZEN.files[n], n + " was written again");
});

test("freeze1 / 2: every golden file opens with no error and saves to the very same parts, byte for byte; opened again from what it saved, the same again", () => {
  // (each in a page of its own, as a fresh start opens it: a page that opened another document first keeps that one's id counters if
  // they are higher, which changes nextId / nextSegId / nextShapeId but nothing of the patterns)
  for (const n of Object.keys(FROZEN.files).sort()) {
  const files = [[n, Array.from(fs.readFileSync(path.join(DIR, n)))]];
  const o = boot({ blank: true, three: true, script: TOOLS + `
    return (async () => {
      const out = [];
      for (const [n, b] of ${JSON.stringify(files)}) {
        if (n === "avatar.pdraft") await marty();
        const u = new Uint8Array(b), want = view(u);
        E("openFile")(n, u, null, true);
        const s1 = await save(), got = view(s1);
        E("openFile")(n, s1, null, true);
        const got2 = view(await save());
        const diff = (a, x) => [...new Set([...Object.keys(a), ...Object.keys(x)])].filter(k => a[k] !== x[k]);
        out.push({ n, v: JSON.parse(want["document.json"]).v, diff: diff(want, got), again: diff(got, got2), first: diff(want, got).map(k => [k, String(want[k]).slice(0, 0), firstDiff(want[k], got[k])]) });
      }
      return out;
      function firstDiff(a, b) { a = String(a); b = String(b); let i = 0; while (i < a.length && a[i] === b[i]) i++; return [a.slice(Math.max(0, i - 80), i + 80), b.slice(Math.max(0, i - 80), i + 80)]; }
    })();` });
  assert.deepStrictEqual(o.warnings, [], "no warning in the console");
  for (const r of o.result) {
    assert.strictEqual(r.v, 37, r.n);
    assert.deepStrictEqual(r.diff, [], r.n + " saved other bytes than the golden file: " + JSON.stringify(r.first));
    assert.deepStrictEqual(r.again, [], r.n + " saved again: other bytes");
  }
  }
});

// the old test files of versions 30 to 36
const OLD = fs.readdirSync(path.join(__dirname, "files")).filter(d => /^v(3[0-6])$/.test(d)).sort().flatMap(d => fs.readdirSync(path.join(__dirname, "files", d)).filter(n => n.endsWith(".pdraft")).map(n => d + "/" + n));
// (`display` is left out of the comparison: it is written from the page's own view settings, put back on opening only with Open Files
// with Their Display Settings, so it is this page's, not the file's)

test("freeze1 / 3: every file of versions 30 to 36 opens and saves as 37: the document is the old one but for its version (version 30's gains the defaults and render settings 31 added); the 37 written opens and saves again to the same bytes", () => {
  const vs = [...new Set(OLD.map(n => +n.slice(1, 3)))];
  assert.deepStrictEqual(vs, [30, 31, 32, 33, 34, 35, 36], "a test file of every version from 30 to 36");
  for (const name of OLD) {      // (a page each, as in freeze1 / 2)
  const files = [[name, Array.from(fs.readFileSync(path.join(__dirname, "files", name)))]];
  const o = boot({ blank: true, three: true, script: TOOLS + `
    return (async () => {
      const out = [];
      for (const [n, b] of ${JSON.stringify(files)}) {
        if (/avatar/.test(n)) await marty();
        const u = new Uint8Array(b), old = JSON.parse(view(u)["document.json"]);
        const t0 = toasts.length;
        E("openFile")(n, u, null, true);
        const opened = toasts.slice(t0).some(t => /^Opened /.test(t)) && S.pieces.length === old.pieces.length;
        const s1 = await save(), v1 = view(s1), doc = JSON.parse(v1["document.json"]);
        E("openFile")(n, s1, null, true);
        const v2 = view(await save());
        // every value the old file holds is in the 37, the same (a default of the old file's that differs from this build's is written
        // as a value of its own, so the 37 may hold more: defaultsFill())
        const lost = [], walk = (a, b, at) => {
          if (a && typeof a === "object") { if (!b || typeof b !== "object") return lost.push(at); for (const k of Object.keys(a)) walk(a[k], b[k], at ? at + "." + k : k); return; }
          if (JSON.stringify(a) !== JSON.stringify(b)) lost.push(at + " " + JSON.stringify(a) + " → " + JSON.stringify(b));
        };
        // (a seam whose id is not a number is dropped by every build since loadSeams() was written: the v33 test file's own fixture wrote
        // one, id "s1"; no build ever made such a seam)
        if (Array.isArray(old.seams)) old.seams = old.seams.filter(s => Number.isInteger(s.id));
        for (const k of Object.keys(old)) if (k !== "v" && k !== "display") walk(old[k], doc[k], k);
        out.push({ n, opened, said: toasts.slice(t0, t0 + 1), from: old.v, to: doc.v, lost: lost.slice(0, 12), again: Object.keys(v1).filter(k => v1[k] !== v2[k]) });
      }
      return out;
    })();` });
  for (const r of o.result) {
    assert.ok(r.opened, r.n + " did not open: " + r.said);
    assert.strictEqual(r.to, 37, r.n);
    assert.deepStrictEqual(r.lost, [], r.n + " (version " + r.from + "): saved as 37, a value of the old file was lost or changed: " + r.lost.join(" | "));
    assert.deepStrictEqual(r.again, [], r.n + ": the 37 it wrote saved again to other bytes");
  }
  }
});

module.exports = T;
