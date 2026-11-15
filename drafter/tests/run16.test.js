// Run 16: batch 0, the maintainer's answer to run 15's Q2 (Add ▸ Avatar replaces the avatar as one undo step, asked first when the
// avatar there has edits); later batches add theirs below.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const T = [];
const test = (name, fn) => T.push({ name, fn });

function boot(opt, ms) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "boot-child.js"), JSON.stringify(opt || {})], { encoding: "utf8", timeout: ms || 240000, maxBuffer: 1 << 28 });
  if (r.error && r.error.code === "ETIMEDOUT") throw new Error("app hung (killed)");
  if (r.status !== 0) throw new Error("boot process failed: " + r.stderr);
  const o = JSON.parse(r.stdout);
  assert.deepStrictEqual(o.errors, [], JSON.stringify(o.errors));
  return o.result;
}
const PRE = path.join(__dirname, "..", "assets", "avatar", "presets"), hasBoth = fs.existsSync(path.join(PRE, "marty.glb")) && fs.existsSync(path.join(PRE, "jessica.glb"));

test("run16 / 0: Add ▸ Avatar… takes the avatar's place as ONE undo step \"Add Avatar\": the old avatar's edits go with it, Undo brings it back with them, Redo the new one; asked first only when the avatar there has edits; nothing of it in the file's history" + (hasBoth ? "" : " (the presets are not here: skipped)"), () => {
  if (!hasBoth) return;
  const o = boot({ blank: true, three: true, script: `
    return (async () => {
      const out = {}, R = (n, ...a) => app.ev(n)(...a);
      app.ev("setLayout")("both");
      R("avatarLoaded", app.read("../assets/avatar/presets/marty.glb"), "marty.glb", null, true); await app.wait(() => S.av, "Marty");
      out.plain = R("avHasEdits");
      app.push("Color"); S.avedit = R("normAvEdit", { color: "#ff0000" }); app.commit();
      out.edited = R("avHasEdits");
      // with edits, Add ▸ Avatar… asks first; Cancel changes nothing
      R("avatarAddFile");
      const m = app.ev("modalNow");
      out.ask = m ? [m.title, m.buttons.map(b => b.n)] : null;
      R("modalPick", "no");
      out.after = [!app.ev("modalNow"), S.av.name, S.un.length];
      // the replacement itself (what the file picker hands over)
      const steps = S.un.length;
      R("avatarReplace", app.read("../assets/avatar/presets/jessica.glb"), "jessica.glb", null);
      await app.wait(() => S.av && S.av.preset === "jessica" && S.un.length === steps + 1, "Jessica");
      out.now = [S.av.preset, S.un[S.un.length - 1].n, JSON.stringify(S.avedit)];
      app.undo(); await app.wait(() => S.av && S.av.preset === "marty", "Marty back");
      out.undone = [S.av.preset, S.avedit.color || null, S.un.length === steps];
      app.redo(); await app.wait(() => S.av && S.av.preset === "jessica", "Jessica again");
      out.redone = [S.av.preset, S.avedit.color || null];
      app.undo(); await app.wait(() => S.av && S.av.preset === "marty", "Marty again");
      // the file: its history names no avatar step's session data
      const file = await new Promise((res) => { app.setDownload((n, b) => res(b)); app.saveDoc(false); });
      const hist = JSON.stringify(app.fileDoc(file).history || "");
      out.hist = [hist.length > 2, /av3/.test(hist)];
      return out;
    })();` }, 300000);
  assert.strictEqual(o.plain, false);
  assert.strictEqual(o.edited, true);
  assert.deepStrictEqual(o.ask, ["Replace Marty?", ["Choose Avatar…", "Cancel"]]);
  assert.strictEqual(o.after[0], true);
  assert.strictEqual(o.after[1], "Marty");
  assert.deepStrictEqual(o.now, ["jessica", "Add Avatar", JSON.stringify({ joints: {} })]);
  assert.deepStrictEqual(o.undone, ["marty", "#ff0000", true]);
  assert.deepStrictEqual(o.redone, ["jessica", null]);
  assert.deepStrictEqual(o.hist, [true, false]);
});

/* ---------- Batch 1: a file from a newer version (the maintainer's answer to run 15's Q1) ---------- */
const GOLD = path.join(__dirname, "files", "v37");
const NEWER_PAGE = `
  const E = (n) => app.ev(n);
  const save = (as) => new Promise((res) => { app.setDownload((n, b) => res(b)); E("saveDoc")(!!as); });
  const grab = (fn) => { let got = null; app.setDownload((n, b) => { got = b; }); fn(); app.setDownload(null); return got; };
  const parts = (b) => { let q = null; E("zipUnpack")(b, (e, p) => { q = p; }); return q; };
  const docOf = (b) => JSON.parse(new TextDecoder().decode(parts(b).get("document.json")));
  const pack = (files) => { let z = null; E("zipPack")(files, (b) => { z = b; }); return z; };
  // a golden file as a later 1.x might write it: fields this version does not know, a whole item, a part of its own
  const newer = (u) => {
    const p = parts(u), d = JSON.parse(new TextDecoder().decode(p.get("document.json")));
    d.futureRoot = { a: 1, b: [2, 3] };
    d.pieces[0].futurePiece = "kept";
    d.pieces[0].segs[0].futureSeg = { deep: true };
    d.pieces[0].pts[0].futurePt = 7;
    d.lib.fabric[0].futureFab = "weave";                       // (objects the reader builds afresh: lost unless written back)
    d.layout.futureLay = 2;
    d.notch.futureNotch = true;
    d.seams[0].futureSeam = [1];
    d.seams.push({ id: 999, a: [{ piece: -5, shape: 0, sids: [1], t0: 0, t1: 1 }], b: [{ piece: -6, shape: 0, sids: [1], t0: 0, t1: 1 }], futureKind: "x" });      // (a whole item this build leaves out: written back at the list's end)
    const files = [...p].map(([name, data]) => ({ name, data: name === "document.json" ? new TextEncoder().encode(JSON.stringify(d)) : data, raw: true }));
    files.push({ name: "future/extra.bin", data: new Uint8Array([9, 8, 7, 6]), raw: true });
    return pack(files);
  };
`;
test("run16 / 1: a file of the frozen version holding fields this version does not know: a box says so on opening, plain Save asks once before writing over it, Save As does not; every unknown field and part is written back unchanged, also after an edit; a golden file as it is and an older file open with no box", () => {
  const oldName = fs.readdirSync(path.join(__dirname, "files", "v36")).filter(n => n.endsWith(".pdraft"))[0];
  assert.ok(fs.existsSync(path.join(GOLD, "2d.pdraft")) && oldName);
  const o = boot({ blank: true, script: NEWER_PAGE + `
    const out = {}, g = new Uint8Array(app.read("files/v37/2d.pdraft")), oldF = new Uint8Array(app.read(${JSON.stringify("files/v36/" + oldName)}));
    // the golden file as it is, and a file of version 36: no box
    E("openFile")("2d.pdraft", g, null, true);
    out.gold = [!!E("modalNow"), E("NEWER")];
    E("openFile")("old.pdraft", oldF, null, true);
    out.old = [!!E("modalNow"), E("NEWER")];
    // the newer file
    const nf = newer(g), copy = Array.from(nf);
    E("openFile")("later.pdraft", nf, null, true);
    const m = E("modalNow");
    out.box = m ? [m.title, E("NEWER_TEXT")] : null;
    out.paths = E("NEWER") && E("NEWER").paths;
    E("modalPick")("ok");
    // plain Save asks first: nothing written until the answer
    const none = grab(() => E("saveDoc")(false));
    const q = E("modalNow");
    out.ask = [none === null, q ? q.title : null, q ? q.buttons.map(b => b.n) : null];
    const s1 = grab(() => E("modalPick")("save"));
    const d1 = docOf(s1), p1 = parts(s1);
    const fields = (d) => [d.futureRoot, d.pieces[0].futurePiece, d.pieces[0].segs[0].futureSeg, d.pieces[0].pts[0].futurePt, d.lib.fabric[0].futureFab, d.layout.futureLay, d.notch.futureNotch, d.seams[0].futureSeam, (d.seams.find(m => m.id === 999) || {}).futureKind];
    out.kept = [...fields(d1), p1.has("future/extra.bin") ? Array.from(p1.get("future/extra.bin")) : null];
    // asked once: the next plain Save writes at once, the same bytes
    const s2 = grab(() => E("saveDoc")(false));
    out.again = [!!E("modalNow"), !!s2 && s2.length === s1.length && s2.every((v, k) => v === s1[k])];
    // opened afresh, Save As does not ask and keeps the fields; the original's bytes are untouched
    E("openFile")("later.pdraft", newer(g), null, true); E("modalPick")("ok");
    const s3 = grab(() => E("saveDoc")(true));
    out.saveAs = [!!s3, !E("modalNow"), docOf(s3).futureRoot, Array.from(nf).every((v, k) => v === copy[k])];
    // an edit: the pattern moved, a point added to another list; the fields stay with their pattern, segment and point
    app.push("Move"); for (const p of S.pieces[0].pts) p.x += 10; app.commit();
    const d4 = docOf(grab(() => E("saveDoc")(false)));
    out.edited = fields(d4);
    // a new document forgets it
    E("newDoc")(true);
    out.fresh = E("NEWER");
    return out;` });
  assert.deepStrictEqual(o.gold, [false, null], "a golden file opens with no box");
  assert.deepStrictEqual(o.old, [false, null], "a file of version 36 opens with no box");
  assert.ok(o.box, "a box on opening");
  assert.strictEqual(o.box[0], "Saved by a newer version");
  assert.ok(o.box[1].includes("This file was saved by a newer version of Gusset. Some settings will be lost if you save it here — use Save As to keep the original."), o.box[1]);
  // (what the reader keeps on its own objects, the patterns, their lines and points, is not lost and not listed; what it builds afresh is)
  for (const re of [/^futureRoot$/, /^lib[.]fabric\[[^\]]+\][.]futureFab$/, /^seams\[[+] #999\]$/, /^future\/extra[.]bin$/])
    assert.ok(o.paths.some(p => re.test(p)), re + " in " + JSON.stringify(o.paths));
  assert.ok(!o.paths.some(p => /futurePiece|futureSeg|futurePt/.test(p)), "kept as read, not listed: " + JSON.stringify(o.paths));
  assert.deepStrictEqual(o.ask, [true, "Save over a file from a newer version?", ["Save As…", "Save Anyway", "Cancel"]]);
  const F = [{ a: 1, b: [2, 3] }, "kept", { deep: true }, 7, "weave", 2, true, [1], "x"];
  assert.deepStrictEqual(o.kept, [...F, [9, 8, 7, 6]], "saved: " + JSON.stringify(o.kept));
  assert.deepStrictEqual(o.again, [false, true], "again: " + JSON.stringify(o.again));
  assert.deepStrictEqual(o.saveAs, [true, true, { a: 1, b: [2, 3] }, true], "Save As: " + JSON.stringify(o.saveAs));
  assert.deepStrictEqual(o.edited, F, "edited: " + JSON.stringify(o.edited));
  assert.strictEqual(o.fresh, null);
});

module.exports = T;
