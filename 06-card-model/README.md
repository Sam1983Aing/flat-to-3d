# 06 · Card Model

A white card model of a house on an architect's desk at night. Scroll down to the little scale figure and the card turns into the real house, lit by the desk lamp as its sun. Walk inside, up to the study, where the same model sits on the desk. Then back out, and the lamp clicks off.

[**Live**](https://sam1983aing.github.io/flat-to-3d/06-card-model/) · [**Starter prompt**](PROMPT.md)

## How it works

- **One parts list, two worlds.** `js/house.js` is the house at 1 unit = 1 m. The desk, the lamp and the studio are built 100 times bigger around it, so the card model and the real house are the same boxes at the same coordinates.
- **The dive spends scroll by scale.** Each step costs its length divided by the height above the garden, so every halving of the height takes the same scroll (`measurePath` in `js/page.js`).
- **The turn is a sphere.** Every material is patched in `js/sweep.js`: card is drawn outside a sphere centred on the lamp's bulb, the real house inside it, with an amber line where the sphere cuts a surface. The sphere grows while you stand where the figure stood.
- **Two lightings in one scene.** The light loop is patched so the card is lit by the lamp and the house by a low sun from the lamp's direction.
- **No image files.** Card, greyboard, concrete, oak, grass and the pinned drawings are all painted on canvases in code.

## Files

`index.html`, `css/page.css`, `js/page.js` (camera, scroll, post-processing, HUD), `js/desk.js` (the desk and the card model), `js/real.js` (the real house and land), `js/sweep.js` (the switch), `js/house.js` (the parts list). About 175 KB in all.

`?noao` turns ambient occlusion off. `?dpr=1` sets the render scale.
