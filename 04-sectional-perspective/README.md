# 04 · Open Section

A flat 1:100 section of a house on three levels plots itself. Scroll and the lens opens while the cut keeps its exact size, so the rooms behind it fall back into a sectional perspective. A scan turns the ink into material and sunlight, then the camera visits the house floor by floor, always facing the cut, and ends on the section in colour.

[**Live**](https://sam1983aing.github.io/flat-to-3d/04-sectional-perspective/) · [**Starter prompt**](PROMPT.md)

Two takes on the same code: `?dir=a` opens the lens and tours room by room (the default), `?dir=c` dives to the kitchen and goes down the stair.

## How it works

- **One clipping plane.** The house is cut by a vertical plane through the stair, and every solid it passes through gets a black lid. Seen straight on through a 1.6° lens about 1 km away, that is the section.
- **The cut keeps its size.** The camera distance is `frame height / tan(lens / 2)`, so the lens can open from 1.6° to 64° while the frame on the cut never changes. The camera never turns.
- **Ink and colour in one shader.** Every vertex carries a paper shade and a material colour. `withColour()` in `engine.js` lights the material colour with procedural textures and mixes it in behind the scan line.
- **The notes** (grid bubbles, levels, room names, the pen lines) are drawn on a 2D canvas over the scene.
- A small 3D key in the corner renders the same house from above and shows what the camera is looking at.

## Files

`index.html`, `page.js` (the plan of the scroll, camera states), `engine.js` (ink, lids, colour, lights), `house.js` (the house as section profiles), `entourage.js` (figures and trees). About 130 KB in all.

`&skip` skips the loader. `&closing` jumps to the closing section.
