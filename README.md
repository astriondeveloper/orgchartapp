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
     bullets where applicable. Because the tool is brand-locked, the source white boxes
     are mapped onto Astrion variants (leader → Force, leads → Sky, portfolios →
     Daylight). Names and titles are starting points — edit them per proposal.
2. **Click any box** (in the chart or the tree) to edit its title, person name,
   style, bullets, detail rows, badges, photo placeholder, and width.
   Add children/siblings, reorder, or delete from the same panel.
   Drag the divider between the side panel and the canvas to **resize the panel**
   (double-click it to reset); the width is remembered between sessions.
3. **Chart tab** — chart title, group zones (tinted or dashed, pick member boxes),
   communication lines between any two boxes, legend items, and extra
   independent trees/columns.
4. **Export** — `Export SVG` (drops straight into PowerPoint/Word and stays
   razor-sharp), `PNG 2×` / `PNG 4×` for high-DPI raster placement, and
   `Save JSON` to store the chart definition alongside the proposal so it can be
   reloaded and regenerated identically later.

### Repeatability workflow

Save the chart's JSON (`Save JSON`) into the proposal's working folder. Anyone can
later `Load JSON` and get a pixel-identical chart, tweak names or PWS numbers, and
re-export. Nothing is hand-positioned, so charts never drift off-style between
volumes or authors.

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
      "badges": ["keyGold"],           // keyGold | keyGray | cornerAccent
      "details": [                      // white rows attached under the box
        { "label": "PWS:", "text": "2.1" },
        { "label": "Interface:", "text": "Customer CO, COR, CC" }
      ],
      "childLayout": "row",            // row (side by side) | stack (capability list)
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
  ]
}
```

Tips:

- `variant: "hidden"` makes an invisible container — use it with
  `childLayout: "stack"` to build free-standing columns (corporate resources,
  customer stakeholders) like the PMO template.
- Widths default to the theme metric; set `width` per node when a box needs to
  carry more text.

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

## Deployment

`.github/workflows/deploy.yml` builds and publishes the app to GitHub Pages on
every push to `main` (enable Pages → "GitHub Actions" in the repo settings).
The Vite `base` is relative, so the build also runs from any static host or
straight off the filesystem.
