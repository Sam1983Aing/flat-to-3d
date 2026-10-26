# Starter prompt · Sequence Sheet Time-Lapse

The prompt I would start with to rebuild this demo. It won't give you my page. It gets you a first version of the idea, and then the real work starts.

Swap the parts in `[brackets]` for your own subject.

```text
I want to build a scroll-driven landing page for [a design and build company, your
subject], around one [concrete house on a slope].

The idea: the page opens on a construction sequence sheet. Six small axonometric line
drawings of the same house, one per stage: [dig and footings, lower level, ground slab,
walls, roof, glazing and fit out], each with its weeks. Next to the headline sits the
programme, one bar per phase.

The scroll, in order:
1. The loader is the programme drawing its bars. Then all six drawings draw at once on one
   clock, fresh lines in amber that cool to black.
2. The paper zooms into drawing 01 until it fills the screen. Behind the ink, the real
   site pours in, in build order, with an amber edge.
3. The lens opens from 2 to 50 degrees while the frame holds, and lands at eye height at
   the edge of the excavation.
4. Now the scroll is the calendar. The house goes up week by week while the camera walks
   [down to the garden, up a scaffold stair, onto the terrace]. The backfill rises from
   the bottom of the hole.
5. At [week 18] the camera walks through a forest of steel props under the fresh roof,
   with the sun cutting between them.
6. The finishes and the furniture arrive around the camera: [the mezzanine, the kitchen,
   the living room], up to handover.
7. On handover day the camera backs out into drawing 06, the house turns back into its
   drawing in reverse order, and the sheet returns with every bar full and [Book a site
   visit].

What I care about:
- The drawings are the 3D model itself, drawn live by an edge shader through a 2 degree
  lens, each tile at its own week. Every part of the house carries the week it is built,
  so one number decides what exists.
- One list of phases drives the programme, the drawings and the site.
- The look: a CAD screen. Paper #f2efe7, ink #1d1c19, one amber accent #e85d04, Chakra
  Petch for headlines, IBM Plex Mono for labels, corner registration marks, a week chip,
  and the programme docked bottom left with a "now" line.
- three.js 0.160 from a CDN, plain files, no build step. No image files, every texture is
  drawn in code.

Before you write any code, propose the house with sizes I can picture, the week of each
phase and the camera path stop by stop, and wait for my answer. Then build in checkpoints.
First checkpoint only: the loader, the sheet drawing itself, and the dive into drawing 01
down to eye height. Record it and show me before you go further.
```

The last paragraph matters as much as the idea. Without it you get a finished page you did not choose.
