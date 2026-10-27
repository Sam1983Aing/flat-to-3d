# Starter prompt · Exploded House

The prompt I would start with to rebuild this demo. It won't give you my page. It gets you a first version of the idea, and then the real work starts.

Swap the parts in `[brackets]` for your own subject.

```text
I want to build a scroll-driven landing page for [a timber house builder, a prefab
company, your subject].

The idea: the page opens on an exploded axonometric, the drawing you see on competition
boards. A [timber house with a pitched roof] hangs apart in six layers over its own ground
floor plan: [slab, walls, glazing, cladding, rafters, roof]. Ink on pale paper, numbered
labels in a column on the right, and dotted lines from each layer to where it lands.

The scroll, in order:
1. The loader is a plotter. A pen front sweeps up the model from the ground to the roof,
   lines first in amber, then ink, then the fills. The headline slides up.
2. The layers land one by one, in building order. Everything above a layer drops with it.
   The landing layer turns amber and its label lights up.
3. The camera comes down to [the porch]. The lens widens until the drawing becomes a room
   at eye height, and the glass door slides open.
4. The walk: [the dining table, the stove, up the ladder to the loft], with a caption at
   each stop, ending on a view back across the house.

What I care about:
- The axo is not a picture. It is the real 3D model seen through a 1.5 degree lens from
  about a kilometre away. Widening the lens as the camera comes in (a dolly zoom) turns
  it into eye-level perspective.
- Slab, walls and roof float upward. Glazing and cladding slide out sideways from their
  own wall.
- It stays a drawing inside: crease edges as screen-space lines in three weights, pale
  fills with grain drawn in code.
- Inside, the camera stays level, and a small plan in the corner shows where you stand.
- The look: a CAD screen. Paper #f2efe7, ink #1d1c19, one amber accent #e85d04, Chakra
  Petch for headlines, IBM Plex Mono for labels, a thin frame with corner marks.
- three.js 0.169 from a CDN, plain files, no build step. One scroll value from 0 to 1
  drives everything. No image files.

Before you write any code, propose the house with sizes I can picture and the camera path
stop by stop, and wait for my answer. Then build in checkpoints. First checkpoint only:
the plotter loader, the layers landing, and the dolly zoom to [the porch]. Record it and
show me before you go further.
```

The last paragraph matters as much as the idea. Without it you get a finished page you did not choose.
