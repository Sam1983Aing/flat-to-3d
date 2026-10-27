# 07 · Schedule Build

A construction programme in a dock along the bottom of the screen, and the site above it. Scroll the wheel and the today line moves: a fence goes up, the pit is dug, a crane lowers each frame, wall and roof panel as its bar fills. At handover the front door opens and you walk in. Scroll back and the house comes apart.

[**Live**](https://sam1983aing.github.io/flat-to-3d/07-gantt-build/?dir=a) · [**Starter prompt**](PROMPT.md)

The page opens at week 7, mid-build. `?dir=a&wk=0&open` starts on the full programme sheet at week 0 instead. Drag the chart to scrub, or press ▶ BUILD.

Three takes on the same code: `?dir=a` the programme (the main demo), `?dir=b` the foundation plan printed at 1:1 on the ground, `?dir=c` the builder's own time-lapse camera.

## How it works

- **One table runs everything.** `PHASES` in `house.js` (name, start week, end week) draws the Gantt bars and decides when each part of the house exists. The scroll is a date, and the chart and the model read the same number.
- **Every part knows its phase.** `add(obj, phase, order, how)` places it inside its phase bar, and it arrives by crane, rises, grows or appears. `update(week)` is a pure function of the week, which is why scrolling back works.
- **Live is orange.** The live phase fills orange on the chart, and the piece in flight gets orange edges.
- **Materials in code.** Concrete, glulam, OSB, charred larch, zinc and oak are canvas textures with world-scale UVs. Dates count working days.
- **The walk inside** is a Catmull-Rom spline through five stops.

## Files

`index.html`, `sketch.css`, `view.js` (camera, input, HUD, the Gantt), `house.js` (phases, materials, every part). About 135 KB in all.

Best on a laptop. This one has no phone layout yet.
