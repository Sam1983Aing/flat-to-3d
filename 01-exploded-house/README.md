# 01 · Exploded House

An exploded axonometric of a timber house, plotted in ink. Scroll and the six layers land one by one in building order. Then the lens widens until the drawing becomes a room, the glass door slides open, and you walk inside and up to the loft.

[**Live**](https://sam1983aing.github.io/flat-to-3d/01-exploded-house/?dir=a) · [**Starter prompt**](PROMPT.md)

Three takes on the same code:

- `?dir=a` The Board: the timber house (the main demo)
- `?dir=b` The Unfolded Room: a kitchen's elevations fold up into a room you walk into
- `?dir=c` Floor by Floor: a five-storey timber block stacks around its core

## How it works

- **An axo is a long lens.** The drawing is the real 3D house seen through a 1.5° lens from about 1.26 km. Widening the lens while holding the frame (a dolly zoom) makes the lines meet, and the axo becomes eye-level perspective.
- **Layers move by level.** Slab, walls, rafters and roof lift by their level. Glazing and cladding slide out along their own wall. When a layer lands, everything above it drops with it.
- **The plotter loader** is a reveal front in every material (`patchLine`, `patchFill` in `core.js`): nothing beyond the front draws, and lines near it are in the amber pen colour.
- **It stays a drawing.** Crease edges are screen-space lines in three weights, and the fills are pale with procedural grain and baked light. No lights, no shadows.
- **The walk** moves in straight lines between eye positions, with a caption at each stop and a small plan in the corner.

## Files

`index.html`, `sketch.css`, `main.js` (loader, scroll, radar), `core.js` (renderer, plotter, materials, camera), `dir-a.js`, `dir-b.js`, `dir-c.js` (one file per take). About 95 KB for the main demo.

`?p=0.6` freezes the scroll at 60%.
