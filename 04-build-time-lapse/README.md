# 04 · Build Time-Lapse

A construction sequence sheet: six drawings of one house, from the hole in the ground to handover. Scroll into drawing 01 and the real site pours in behind the ink. Then the scroll becomes the calendar, and you walk the site while the house goes up around you, week by week, through a forest of props at week 18, until handover day.

[**Live**](https://sam1983aing.github.io/flat-to-3d/04-build-time-lapse/) · [**Starter prompt**](PROMPT.md)

## How it works

- **Every part carries its week.** Each piece of the house, the land, the temporary works and the furniture stores the week it arrives and the week it leaves. One uniform decides what exists (`partWeeks` in `js/world.js`).
- **Six drawings, one model.** The six tiles are the same live model seen through a 2° lens, each at its own week, each rendered into its own rectangle of the screen (`aim()` in `js/pipe.js`).
- **Ink to site.** An edge shader draws the tiles. On the dive, the lit site is composited in wherever a pixel's week has been reached, with an amber band at the edge.
- **The dive** is a reverse dolly zoom from 2° to 50° down to eye height. After that the camera follows four spline legs while the week follows the scroll.
- **The light moves with the weeks.** Morning on the dig, low sun through the props at week 18, late afternoon at handover. The sunbeams are ray-marched against the sun's shadow map.

## Files

`index.html`, `js/programme.js` (the phases and the bars), `js/main.js` (scroll, camera, weeks, HUD), `js/world.js` (house, site, land, materials), `js/stage.js` (furniture, scaffold stair), `js/pipe.js` (the ink and the post-processing). About 180 KB in all.

`?v=12.5` jumps to a scroll position in screen heights. `?still` skips the loader.
