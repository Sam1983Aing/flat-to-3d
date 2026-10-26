# Flat to 3D

Seven ways to turn a flat architectural drawing into a 3D experience you scroll through. Each one starts from a drawing architects already use, a section, a study model, a sequence sheet, an elevation, an exploded axo or a construction programme, and turns it into the real building as you scroll.

[**See all seven live**](https://sam1983aing.github.io/flat-to-3d/) · best on a laptop

Every demo comes with its full code and a starter prompt to build your own version.

## The seven

| | Technique | What happens | Code | Prompt |
|---|---|---|---|---|
| 01 | **Section Sweep** | A section drawing opens into depth, a scan turns the ink into material and the drawn sun angles into real sunbeams. Then you walk in through the cut. | [01-section-sweep](01-section-sweep/) | [prompt](01-section-sweep/PROMPT.md) |
| 02 | **Card Model to Real House** | A white card model on a desk at night. Dive down to the scale figure and the card turns into the real house, with the desk lamp as its sun. | [02-study-model](02-study-model/) | [prompt](02-study-model/PROMPT.md) |
| 03 | **Sequence Sheet Time-Lapse** | Six drawings of one house, stage by stage. Dive into the first one and walk the site while it goes up, week by week, until handover. | [03-sequence-sheet](03-sequence-sheet/) | [prompt](03-sequence-sheet/PROMPT.md) |
| 04 | **Sectional Perspective** | A flat section plots itself. The lens opens while the cut keeps its size, and the camera visits each floor from the cut. | [04-sectional-perspective](04-sectional-perspective/) | [prompt](04-sectional-perspective/PROMPT.md) |
| 05 | **Sunlit Elevation** | A front elevation whose hatching is the real shadow. A sweep turns it into brick, the sun moves, the door opens and you walk in. | [05-elevation](05-elevation/) | [prompt](05-elevation/PROMPT.md) |
| 06 | **Exploded Axo Assembly** | An exploded axo lands layer by layer in building order. Then the lens widens to eye level and you walk inside. | [06-exploded-axo](06-exploded-axo/) | [prompt](06-exploded-axo/PROMPT.md) |
| 07 | **The Gantt Builds the House** | Scroll the construction programme and the house builds itself bar by bar, crane and all. Then the front door opens. | [07-gantt-build](07-gantt-build/) | [prompt](07-gantt-build/PROMPT.md) |

Each folder has a short README on how its technique works.

## Where it started

These came after my floor plan demo, a flat plan that builds itself into a house as you scroll. It went further than anything I had shared before, mostly with people in architecture and interior design, so I kept going with the drawings they use every day.

- The floor plan, live: https://sam1983aing.github.io/casa-serra/
- Its starter prompt: https://github.com/Sam1983Aing/casa-serra/blob/main/starter-prompt.md
- How I made it, in an 8-minute video: https://youtu.be/rKv4PrtBkb8

## How they're built

- three.js from a CDN, with plain HTML, CSS and JavaScript. No build step and nothing to install.
- No image files and no 3D models. Every wall, material and piece of furniture is made in code, so each demo is between about 100 and 190 KB.
- In five of the seven, the flat drawing is the real 3D model seen through a very long lens, which makes it look flat. Opening the lens is what turns it into 3D.
- Built with Claude Code and Opus 5.5, then polished in Google Antigravity with Gemini 4 Argon.

## Run it on your computer

The pages use JavaScript modules, so they need a local server. A double click on `index.html` won't work.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Notes

- Best on a laptop with a recent browser. Most demos have a phone layout. 07 doesn't yet.
- The studios, houses, addresses and contact details are made up. This is a set of design studies, with no link to any real practice.
- The code is MIT licensed, see [LICENSE](LICENSE). three.js is MIT. The fonts, Chakra Petch and IBM Plex Mono, load from Google Fonts under the SIL Open Font License.

Made by Samnang Aing. I share builds like this as I go on [X](https://x.com/SammmAing) and [Threads](https://www.threads.com/@prompting_lab).
