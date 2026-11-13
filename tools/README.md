# CAD tooling (parked)

The enclosure CAD is being redone. When it lands:

1. Regenerate `ggpcb3/planter/renders/assembly_viewer.html` (`python build_viewer.py` in `planter/source`).
2. `python3 tools/export_model.py` writes `assets/model-data.js` (every part in its assembled position).
3. `assets/planter3d.js` builds a Three.js scene from it (product materials, procedural plant, x-ray/explode via `apply()`).
4. `tools/render.html` renders stills. Serve the site with a server that accepts `POST /save/<name>`, open `tools/render.html?save`, and PNGs land in `images/renders/`.

Then replace the `.cad-slot` blueprint in `index.html` (`data-cad-slot="inside"`) with the renders or a live 3D view.
