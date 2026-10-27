# Starter prompt · Section Sweep

The prompt I would start with to rebuild this demo. It won't give you my page. It gets you a first version of the idea, and then the real work starts.

Swap the parts in `[brackets]` for your own subject.

```text
I want to build a scroll-driven landing page for [an architecture studio, your subject].

The idea: the page opens on a flat section drawing of [a house on a slope], cut at A-A.
Black poché where the cut passes through walls and slabs, hatched earth, grid bubbles,
level marks, dimensions and room names. Three dashed amber lines show the sun angles on
[21 December, 21 March and 21 June]. Nothing looks 3D.

The scroll, in order:
1. The loader is a small key plan with the cut line A-A drawing across it. Then the
   section draws itself: earth and poché first, then the lines behind the cut from front
   to back, then the notes.
2. The lens opens. The camera comes in while the field of view widens, so the cut keeps
   its size on screen and the rooms behind it open into a section perspective. Then the
   view turns to three quarters.
3. The sweep. A vertical scan plane crosses the house from [the garden to the hill]. On
   one side the house is still ink, on the other it is lit material. When the plane
   passes the glass, the dashed sun lines fade and real sunbeams come in at the
   [December] angle.
4. The walk. In through the cut at eye height, through [the living room, the study, the
   mezzanine, the snug, the bedroom, the lower garden], slowing at each room with a label.
5. Back out through the cut. The scan runs back, the lens closes, and the flat sheet
   returns with [Start a project].

What I care about:
- The drawing is not a picture. It is the 3D model cut at A-A, seen through one
  perspective camera with a 0.12 degree lens about 12 km away, so it reads as flat. A
  full-screen shader inks it from a normal and depth pass, and mixes in the lit render
  by the position of the scan.
- The camera never cuts. Opening the lens is one continuous dolly zoom.
- The look: a CAD screen. Paper #f2efe7, ink #1d1c19, one amber accent #e85d04, Chakra
  Petch for headlines, IBM Plex Mono for labels. Corner registration marks, a lens
  readout in mm, a title block, and a small live section that shows where the camera is.
- three.js 0.160 from a CDN, plain files, no build step. No image files, every texture
  is drawn in code.

Before you write any code, propose the house with sizes I can picture and the camera path
stop by stop, and wait for my answer. Then build in checkpoints. First checkpoint only:
the loader, the section drawing itself, and the lens opening. Record it and show me before
you go further.
```

The last paragraph matters as much as the idea. Without it you get a finished page you did not choose.
