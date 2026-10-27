# Starter prompt · Open Section

The prompt I would start with to rebuild this demo. It won't give you my page. It gets you a first version of the idea, and then the real work starts.

Swap the parts in `[brackets]` for your own subject.

```text
I want to build a scroll-driven landing page for [an architecture studio, a house on a
slope, your subject].

The idea: the page opens on a flat section at 1:100. Walls and slabs cut in solid black,
hatched earth, grid bubbles, level marks, room names, small figures and trees. Nothing
looks 3D. On load, amber pen lines sweep from left to right and the section plots itself.

The scroll, in order:
1. The lens opens. The rooms behind the cut fall back into depth while the cut keeps
   exactly its size on screen. The flat section becomes a sectional perspective.
2. An amber scan line crosses the house and turns the ink into material, sunlight and
   shadow.
3. The camera visits the house floor by floor at eye height, always facing the cut:
   [the stair, the kitchen, the bedroom, the living room, the pool], with a card for each.
4. It pulls back to the flat section, now in colour.
5. A closing section on paper: the studio, the facts of the house, [three other houses]
   drawn as small sections, and [Start a project].

What I care about:
- The section is not a picture. It is the real 3D model cut by one clipping plane, with a
  black lid on every solid the plane passes through, seen straight on through a 1.6
  degree lens about 1 km away.
- Opening the lens moves the camera in so the frame on the cut never changes size:
  distance = frame height / tan(lens / 2). The camera never orbits.
- Give the depth something to show: [three levels down a hill, one stair, a courtyard
  behind the cut], real furniture.
- The look: a CAD screen. Paper #f2efe7, ink #1d1c19, one amber accent #e85d04, Chakra
  Petch for headlines, IBM Plex Mono for labels. Corner registration marks, a title
  block, a bar scale, a live readout of the lens angle, and a small 3D key that shows
  where the camera is.
- three.js 0.160 from a CDN, plain files, no build step. No image files, every texture is
  drawn in code.

Before you write any code, propose the house in section with sizes I can picture and the
camera stops in order, and wait for my answer. Then build in checkpoints. First checkpoint
only: the loader, the section plotting itself, the lens opening and the colour scan.
Record it and show me before you go further.
```

The last paragraph matters as much as the idea. Without it you get a finished page you did not choose.
