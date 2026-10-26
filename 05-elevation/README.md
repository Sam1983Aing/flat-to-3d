# 05 · Sunlit Elevation

The front elevation of a townhouse, drawn in ink with 45° hatching in every shadow. Scroll and the facade gains depth, then a sweep turns the paper into brick and not one shadow moves, because the hatching was the real shadow all along. The sun moves, the door opens, and you walk through the house to the courtyard.

[**Live**](https://sam1983aing.github.io/flat-to-3d/05-elevation/a-one-door/) · [**Starter prompt**](PROMPT.md)

Three takes on one engine:

- [`a-one-door/`](a-one-door/): one townhouse, walk in through the front door (the main demo)
- [`b-the-row/`](b-the-row/): a street of six townhouses with plot numbers, reserve plot 04
- [`c-the-face/`](c-the-face/): a 1:20 brick detail, the sun rakes across the relief

## How it works

- **The elevation is the house.** The 3D model is seen straight on through a 2° lens, so it reads as an orthographic drawing.
- **The hatching is computed.** The sun starts at the drafting convention, light from the upper left at 45°. Every pixel the shadow map puts in shade gets 45° hatching, so the drawn shadows and the real ones are the same shapes.
- **One material for every surface.** `mat()` in `engine/elevation.js` patches the standard material: paper and hatching on one side of the sweep, brick, stone, zinc and glass on the other.
- **Camera keys are frames** (target, frame height, lens). The distance follows, and the lens blends in log space, so it opens from 2° to 55° without a jump.
- The outlines draft themselves on load, bottom first, each line growing along its length.

## Files

`engine/elevation.js` and `engine/page.css` are shared. Each take is an `index.html` and a `page.js` with its camera keys and captions. About 100 KB for the main demo.

`?skip` skips the intro. `?at=300` jumps to a scroll position.
