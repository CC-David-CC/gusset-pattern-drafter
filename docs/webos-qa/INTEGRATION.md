# WebOS preparation for the pattern drafter

| Item | Baseline |
| --- | --- |
| Silo and branch | `apps/gusset-pattern-drafter` on local `webos/integration` |
| Upstream and owner fork | Both public `main` branches resolve to `00f4ed7e29ad805d3f2784c8ab3a8768f76f7adc`. Local `main` tracks `upstream/main`. [Upstream revision](https://github.com/fynndose/gusset-pattern-drafter/tree/00f4ed7e29ad805d3f2784c8ab3a8768f76f7adc) · [Owner fork](https://github.com/CC-David-CC/gusset-pattern-drafter) |
| Standalone entry | `drafter/pattern-drafter.html` loads the app's checked-in scripts, Three.js bundles, and avatar assets. The browser payload needs no compiler, Electron, npm dependency install, or application server. |
| WebOS placement | Proposed Crafts launcher under `sewing-pattern-drafter`, priority P3. Browser-only drafting, rendering and cloth simulation. My files integration is pending. |
| Release state | Source preparation. WebOS packaging, launcher registration, device qualification, and hosted release are pending. |

## Reproduce the standalone baseline

From this repository, use Node 24 and a local static server. The selected editing and format suites passed 24 checks, including version 37 native project round trips against the golden files and version 30–36 migration.

```sh
git rev-parse main
node drafter/tests/run.js editing.test.js freeze1.test.js
python3 -m http.server 8765 --bind 127.0.0.1 --directory drafter
```

Open `http://127.0.0.1:8765/pattern-drafter.html` in Chromium. Use `drafter/tests/files/v37/2d.pdraft` as the fixture. It contains Front and Back pieces. Open it through **File → Open → Project**, draw a rectangle with the Rectangle tool, and use **File → Save Project**. Confirm the saved native archive contains all three pieces, then open it in a fresh browser context and edit again. Use **File → Export → Print or PDF… → Save Print File** to inspect the tiled HTML, millimetre page dimensions and 50 mm ruler marks. The print file is HTML intended for the browser's print flow.

Chromium `158.0.8127.36` at 1300 CSS pixels opened the fixture through the ordinary file picker. A mouse drag added a four-point rectangle. Save produced a version 37 `.pdraft`, and a fresh browser context reopened the three pieces. Save Print File produced eight 210 × 297 mm tiles with the 50 mm check line. Actual paper output remains to be tested.

At 411 CSS pixels with Chromium touch emulation, the startup overlay was still present at the 36-second deadline. In a separate run a tap dismissed it and a second tap opened File. The 2D drawing canvas had zero CSS width, the inspector occupied 276 pixels, and Help was beyond the right edge. These are standalone emulation results. Physical Galaxy S10+ testing is pending.

## Integration before device qualification

- Use a distinct app name and original icon, such as Sewing Pattern Drafter. The upstream authors apply GPL-3.0-or-later to the code and reserve the upstream product name and logos. Keep the credits and third-party notices, and exclude reserved logos from the WebOS runtime. For browser distribution, provide corresponding source for the exact served revision and its build recipe. [License](../../LICENSE) · [Trademark policy](../../TRADEMARKS.md) · [Attribution](../../ATTRIBUTION.md) · [Third-party notices](../../THIRD-PARTY-NOTICES.md)
- Package the necessary client assets in the app silo. Move the inline splash script into a local script or replace that startup surface. Verify the package under the existing script policy and check the cloth and import workers plus the embedded print path separately. Preserve unrelated WebOS security policy.
- Scope local recovery, project history and the library to the appropriate WebOS account, guest session and document window. Upstream browser storage uses origin-wide IndexedDB and localStorage and upstream Save downloads a local file. Use a narrow file bridge for native `.pdraft` Open, Save, Save As, a revision conflict, and Files launch in the correct app. Verify export and cancel paths and protect unsaved edits when a window closes.
- Give the 2D canvas usable width at startup. Add a compact 2D view with reachable File commands, a collapsible inspector, and touch drawing targets. Verify that the startup overlay dismisses when the drawing view is ready. Preserve the full desktop editor. Validate true-size paper output and 3D preview on their supported device profiles.
- On the physical S10+ in Chrome, draw a four-point rectangle, save a bare name as `.pdraft` in My files, reopen in a fresh session and edit the existing piece. Check a print or SVG artifact, keyboard clearance, app bar hide/restore, and controls in portrait and landscape. Repeat File and export through menu actions in Chromium at tablet and desktop widths. Check account and guest isolation before release.
