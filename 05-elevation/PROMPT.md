# Starter prompt · Sunlit Elevation

The prompt I would start with to rebuild this demo. It won't give you my page. It gets you a first version of the idea, and then the real work starts.

Swap the parts in `[brackets]` for your own subject.

```text
I want to build a scroll-driven landing page for [a townhouse for sale, your subject].

The idea: the page opens on a front elevation, the building drawn straight on. Ink on
cream paper, level marks, a title block, a person for scale, and 45 degree hatching in
every shadow. After the loader, the drawing drafts itself from the ground up, then the
hatching pours in along the light.

The scroll, in order:
1. Relief. The lens opens a little and the camera turns, so the porch falls back and the
   balcony comes forward.
2. The sun. A thin amber line sweeps across the facade at 45 degrees and turns paper into
   brick, stone, zinc and glass. Not one shadow moves.
3. Then the sun moves to [late afternoon] and the shadows slide across the brick.
4. The camera climbs the steps, the front door swings open, and it walks through [the
   hall, the parlour, the kitchen and dining room] at eye height to [the courtyard].
5. A last card with the facts and [Book a viewing].

What I care about:
- The elevation is the real 3D model seen straight on through a 2 degree lens. Each
  camera key is a frame (target, frame height, lens) and the distance follows, so the
  lens can open to 55 degrees without a jump.
- The hatching is computed, not drawn. The sun starts at the drafting convention, light
  from the upper left at 45 degrees, (-1, 1, 1) normalised. Every pixel the shadow map
  puts in shade gets hatched, so the drawn shadows and the real shadows are the same
  shapes.
- One material per surface, paper or real, chosen per pixel by the sweep.
- The look: a CAD sheet. Paper #f2efe7, ink #1d1c19, one amber accent #e85d04, Chakra
  Petch for headlines, IBM Plex Mono for labels, a sheet frame with corner marks, a live
  sun and lens readout, and a small plan that shows where the camera is.
- three.js 0.160 and Lenis from a CDN, plain files, no build step. No image files, every
  texture is drawn in code.

Before you write any code, propose the facade and the plan with sizes I can picture and
the camera path stop by stop, and wait for my answer. Then build in checkpoints. First
checkpoint only: the drawing drafting itself, the relief and the sweep. Record it and show
me before you go further.
```

The last paragraph matters as much as the idea. Without it you get a finished page you did not choose.
