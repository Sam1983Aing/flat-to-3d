# 01 · Section Sweep

A section drawing of a house on a slope. Scroll and the lens opens into depth, a scan plane turns the ink into lit material, and the drawn sun angles become real sunbeams. Then you walk in through the cut, room by room, and come back out to the drawing.

[**Live**](https://sam1983aing.github.io/flat-to-3d/01-section-sweep/) · [**Starter prompt**](PROMPT.md)

## How it works

- **The drawing is the house.** The 3D model is cut at A-A and seen through one perspective camera with a 0.12° lens about 12 km away, so it reads as a flat 1:100 section.
- **The ink is a shader.** `draw.js` renders normals, depth and a drawing id into a float target, then one full-screen pass inks it: poché, the earth hatch, edges from the change in depth, line weight by distance behind the cut.
- **Opening the lens** is a dolly zoom (`swingState()` in `main.js`). The lens widens while the camera comes in, so the cut keeps its size and the rooms behind it open up.
- **The sweep** mixes ink and the lit render per pixel by world x. As it passes the glass, the dashed sun lines hand over to ray-marched sunbeams at the same angle (`real.js`).
- **The walk** is one Catmull-Rom spline at eye height. The camera stays level with a lens shift, like an architectural photographer, and never stops.

## Files

`index.html`, `main.js` (camera, scroll, HUD), `house.js` (the house as boxes, cut at z = 0), `draw.js` (the ink), `real.js` (light, sunbeams), `look.js` (materials painted on canvases). About 140 KB in all.

`?noao` turns ambient occlusion off. `?dpr=1` caps the resolution.
