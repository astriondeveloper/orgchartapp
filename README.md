# Astrion Org Chart Builder

A repeatable, browser-based app that produces **Astrion-branded organization charts
for proposals**. Charts are defined as structured JSON and rendered through a
deterministic layout engine — the same input always produces the same professional
output — while staying fully adaptable per customer: roles, PWS references,
deliverables, interfaces, lines of communication, mission-focus groupings, badges,
and legends.

![Built with Vite + React + TypeScript](https://img.shields.io/badge/stack-Vite%20%2B%20React%20%2B%20TS-1D4F91)

## Quick start

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # production build in dist/
```

The app runs entirely in the browser — no backend, no data leaves your machine.
Your working chart autosaves to localStorage.

## Using the app

1. **Start from a template** (toolbar → "New from template…"):
   - **Simple Hierarchy** — a clean, generic top-down org chart. A neutral
     starting point when no proposal-specific pattern is needed yet.
   - **Functional Divisions** — an executive over departments, each carrying a
     stacked list of sub-functions.
   - **Program Office** — divisions with stacked capability lists and orange corner markers.
   - **Director Level** — leadership boxes with PWS / Deliverables / Interface rows,
     key badges, and a green "Mission Focus" zone.
   - **Joint Venture** — a customer / government column, a board → GM → managers →
     technical-manager branch chain, a JV PMO service stack, and lines of communication.
   - **Mentor-Protégé JV** — a multi-site mentor-protégé venture: a government-operational
     column, a program-leadership chain, delivery-staff functional leads, and corporate resources.
   - **PMO** — corporate and customer columns with two-way communication-channel arrows
     and a dashed PMO container.
   - **Astrion mission-pillar structures** — a set of Astrion organizational charts:
     Executive Leadership Team; Mission Solutions (the mission-pillar overview, with a
     tinted "Mission Areas" zone and a "Campaign & Functional Support" zone); and one
     chart per mission pillar — Space Warfighting, Exploration & Lunar Presence,
     Life Cycle Management & Cyber, Integrated Air & Missile Defense, Layered Defense /
     Autonomous Warfare / Integrated Fires, and Critical Infrastructure Protection —
     plus the SPG organization. Each pillar chart follows a leader → Solutions Lead /
     Campaign Lead → portfolio-row pattern, with contract-vehicle references listed as
     bullets and matrixed roles (Campaign Lead / BDE / support) shown as dashed boxes.
     Because the tool is brand-locked, the source white boxes
     are mapped onto Astrion variants (leader → Force, leads → Sky, portfolios →
     Daylight). Names and titles are starting points — edit them per proposal.
2. **Click any box** (in the chart or the tree) to edit its title, person name,
   style, bullets, detail rows, badges, photo placeholder, and size.
   Add children/siblings, reorder, or delete from the same panel.
   **Resize a box** by dragging the handles on its right edge (width), bottom
   edge (height), or corner (both) — hold Alt for pixel-fine steps, or type
   exact px in the inspector and hit "Reset size to auto" to clear it. Shrinking
   width re-wraps the text; height only grows a box past the room its own text
   needs, so a name can never be clipped. **Move a box** by dragging its body
   (arrow keys nudge the selected box; Shift for fine steps). Both size and
   position are saved in the chart JSON, so a laid-out chart reopens identically.
   Drag the divider between the side panel and the canvas to **resize the panel**
   (double-click it to reset); the width is remembered between sessions.
3. **Chart tab** — chart title, group zones (eight brand tints — green, blue,
   orange, purple, red, gray, water, teal — or a dashed container, pick member
   boxes; the zone label sits clear of the boxes it wraps),
   communication lines between any two boxes, legend items, a **glossary / terms**
   panel (define the acronyms and LCATs used on the chart; rename the heading to
   "Acronyms", "Key Terms", etc.), and extra independent trees/columns.
4. **Export** — `Export SVG` (drops straight into PowerPoint/Word and stays
   razor-sharp), `PNG 2×` / `PNG 4×` for high-DPI raster placement, and
   `Save JSON` to store the chart definition alongside the proposal so it can be
   reloaded and regenerated identically later.

### Repeatability workflow

Save the chart's JSON (`Save JSON`) into the proposal's working folder. Anyone can
later `Load JSON` and get a pixel-identical chart, tweak names or PWS numbers, and
re-export. Nothing is hand-positioned, so charts never drift off-style between
volumes or authors.

## U.S. Map chart type

Alongside org charts, the tool can build a **U.S. map of where a contract's labor
sits** — useful when a 40-plus-position program spreads across many locations.
Choose **"🗺 U.S. Map (LCATs by location)…"** from the "New from template…" menu to
switch into it (your org chart is kept in its own slot; switch back anytime with
"Org chart…").

- **Sites** — each work location is a star on an accurate U.S. map (real Census
  boundary, Alaska/Hawaii inset). Place a site by picking a city or installation
  from the built-in list, or drag its star anywhere.
- **Positions / LCATs** — each site carries a roster of positions, each with a
  title, an optional LCAT label, an **FTE count**, and a **key-personnel count**.
  Site and grand totals are computed automatically.
- **Legible at scale** — a busy site can **collapse to a one-line total chip**;
  roster cards can be **dragged** into open space (a leader line follows) and
  **resized** by their edge handle.
- **OCONUS** — mark a site OCONUS (or pick an overseas location) and it lists in a
  labeled strip below the map, mirroring how Alaska/Hawaii are inset on a U.S. map.
- **Same exports** — SVG / PNG / PPTX / PDF and JSON save/load all work, and the
  map is brand-locked (Supernova stars, Force cards).

The map geometry and the location list are generated once by
`scripts/gen-usmap.mjs` (from `us-atlas` + `d3-geo`, dev-only) and inlined into
`src/usMapData.ts` and `src/locations.ts`, so the app keeps no runtime map
dependency and every export stays sharp. Rerun the script after editing
`scripts/locations.source.json` to add locations.

## Branding

Every color, font, and layout metric lives in **`src/theme.ts`**, with values
taken from the official **Astrion Brand Standards (December 2023, V.1)**:

- **Primary:** Astrion Force `#442C81`, Astrion Sky `#29AAE1`
- **Secondary:** Refraction `#1ED872`, Daylight `#4DD3F7`, Zenith `#9382F9`,
  Midnight `#222230`, Platinum `#DDDDDD`, Silver `#BDBDBD`
- **Tertiary (highlights only):** Supernova `#FFAF2E`, Twilight `#FC5442`,
  Water `#307EEF`, Alabaster `#F1E9DB`
- **Sky gradient** (always starting with Refraction green): used for the
  title bar accent, per the graphic-elements guidance
- **Typography:** Obvia is Astrion's primary typeface; the app falls back to
  Verdana per the brand standards, since Obvia is a licensed font. Chart
  headlines render in all-caps per the type hierarchy.

The editor only exposes semantic styles (Primary Force / Secondary Sky /
Tertiary Daylight / Accent Supernova), so charts cannot go off-brand. Box
variants map to: Force + white text, Sky + white text, Daylight + Midnight
text, and Supernova + Midnight text; corner markers use Twilight; key badges
use Supernova (gold) and Silver (gray).

## Chart model (JSON)

```jsonc
{
  "version": 1,
  "meta": { "title": "Program Leadership Organization", "showTitle": true },
  "roots": [
    {
      "id": "gm",
      "title": "General Manager",
      "name": "Jane Smith",            // italic person name
      "photo": true,                    // photo placeholder
      "variant": "primary",            // primary | secondary | tertiary | accent | hidden
      "dashed": false,                  // true = matrixed role (white box, dashed gray outline)
      "badges": ["keyGold"],           // keyGold | keyGray | cornerAccent
      "details": [                      // white rows attached under the box
        { "label": "PWS:", "text": "2.1" },
        { "label": "Interface:", "text": "Customer CO, COR, CC" }
      ],
      "childLayout": "row",            // row (side by side) | stack (capability list)
      "width": 190,                     // optional px width override (drag the edge handle)
      "height": 60,                     // optional px height override (drag the bottom handle)
      "children": []
    }
  ],
  "groups": [                           // tinted zones / dashed containers
    { "id": "g1", "label": "Mission Focus", "style": "green", "memberIds": ["gm"] }
  ],
  "comms": [                            // communication-channel arrows
    { "id": "c1", "fromId": "gm", "toId": "other", "twoWay": true }
  ],
  "legend": [
    { "id": "l1", "marker": "keyGold", "label": "RFP Required" }
  ],
  "glossary": [                         // term / definition panel (acronym key)
    { "id": "t1", "term": "LCAT", "definition": "Labor Category" }
  ]
}
```

Tips:

- `variant: "hidden"` makes an invisible container — use it with
  `childLayout: "stack"` to build free-standing columns (corporate resources,
  customer stakeholders) like the PMO template.
- `dashed: true` renders a box as a matrixed / dotted-line role: a white box
  with a dashed gray outline instead of a filled variant color (used for the
  Campaign Lead / BDE / support roles in the Astrion mission-pillar charts).
- Widths default to the theme metric; set `width` per node (or drag the box's
  edge handle) when a box needs to carry more or less text. `height` is optional
  and only grows a box past the space its content needs — useful to line up box
  heights across a row. Both default to auto when omitted.
- The `glossary` array renders a term/definition panel in the chart's right rail
  (below the legend when both are present). Set `meta.glossaryTitle` to rename its
  heading (e.g. "Acronyms"); it defaults to "Glossary". Empty entries are dropped.

## Project layout

| File | Purpose |
| --- | --- |
| `src/theme.ts` | Astrion brand tokens + layout metrics (single source of truth) |
| `src/model.ts` | Chart JSON types and tree-editing helpers |
| `src/layout.ts` | Deterministic layout engine (tidy tree, stacks, zones, connectors) |
| `src/ChartSvg.tsx` | Pure SVG renderer (self-contained output, export-safe) |
| `src/templates.ts` | Starter charts modeled on Astrion proposal patterns |
| `src/SidePanel.tsx` | Structured editor (boxes, zones, comms, legend, JSON) |
| `src/export.ts` | SVG / high-DPI PNG / JSON export |
| `src/Root.tsx` | Routes between the org chart and the U.S. map document kinds |
| `src/mapModel.ts` | U.S. map document types + editing helpers + normalizer |
| `src/mapLayout.ts` | Deterministic map layout (stars, cards, chips, OCONUS strip) |
| `src/MapSvg.tsx` | Pure SVG renderer for the map (export-safe) |
| `src/MapApp.tsx` / `src/MapEditor.tsx` | Map workspace and its side-panel editor |
| `src/usMapData.ts` / `src/locations.ts` | Generated map geometry + location list |
| `scripts/gen-usmap.mjs` | Dev-only regenerator for the two generated files |

## Deployment

`.github/workflows/deploy.yml` builds and publishes the app to GitHub Pages on
every push to `main` (enable Pages → "GitHub Actions" in the repo settings).
The Vite `base` is relative, so the build also runs from any static host or
straight off the filesystem.
