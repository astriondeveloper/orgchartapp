# Astrion Org Chart Builder — Plan

## Purpose

A repeatable, browser-based application that produces **Astrion-branded organization
charts for proposals**. Every chart is rendered from a structured JSON definition
through a deterministic layout engine, so the same input always produces the same
professional output — while remaining fully adaptable per customer (roles, PWS
references, deliverables, interfaces, lines of communication, mission-focus
groupings, legends).

## Design goals

1. **Repeatable** — no hand-drawn boxes or dragging. The chart is data; the app
   lays it out identically every time.
2. **On-brand, always** — all colors and typography come from a single
   `src/theme.ts` token file. The editor exposes only semantic variants
   (primary / secondary / tertiary / panel), never arbitrary colors, so a chart
   cannot go off-brand.
3. **Proposal-ready output** — exports crisp SVG (drops straight into
   PowerPoint/Word) and high-DPI PNG (2× / 4×).
4. **Adaptable** — supports the constructs seen in Astrion proposal org charts:
   - Boxes with title, person name, photo placeholder, and bullet capability lists
   - Detail rows attached to boxes (PWS: / Deliverables: / Interface:)
   - Badges: key icons (e.g., "RFP Required", "Company Designated") and corner
     accent triangles (e.g., "Similar Technical Support Areas")
   - Tinted background **group zones** (e.g., green "Mission Focus") and
     dashed containers (e.g., "PMO")
   - Auto **reporting lines** (elbow connectors) plus manually added two-way
     **communication channel** arrows between any two boxes
   - A configurable **legend**

## Architecture

- **Stack:** Vite + React + TypeScript. No chart libraries — a custom
  deterministic SVG layout engine (~pure functions), so output is stable and
  the app has minimal dependencies.
- **Data model** (`src/model.ts`): an `OrgChart` document — nodes (tree),
  groups, extra connections, legend, canvas settings. Saved/loaded as JSON;
  autosaved to localStorage.
- **Layout engine** (`src/layout.ts`): top-down tidy-tree layout. Children can
  be laid out in a `row` (siblings side by side) or a `stack` (vertical
  sub-capability list, indented under the parent). Computes box sizes from
  content, elbow connector paths, group-zone bounds, and total canvas size.
- **Renderer** (`src/ChartSvg.tsx`): pure SVG from layout output + theme tokens.
- **Editor** (`src/App.tsx` + panels): structured side panel to add/edit/
  reorder/delete nodes, badges, detail rows, comms lines, groups, legend;
  plus a raw JSON tab and import/export.
- **Export** (`src/export.ts`): serialize SVG → `.svg` download; rasterize via
  canvas → `.png` at 2×/4×.
- **Templates** (`src/templates.ts`): starter charts modeled on real Astrion
  proposal patterns (program office with capability stacks; director-level
  chart with PWS/Deliverables/Interface rows, badges and mission-focus zone;
  PMO chart with external stakeholder column and communication channels).

## Branding note

`astrion.us` is not reachable from this build environment, so `src/theme.ts`
ships with a close professional approximation of the Astrion palette (deep
space navy, signature orange accent, supporting blues, neutral grays). All
values are defined once in that file with comments — paste the exact hex codes
from the Astrion brand guide there and every chart, badge, zone and legend
updates automatically.

## Milestones

1. Scaffold Vite + React + TS project, theme tokens, plan committed.
2. Data model + layout engine + SVG renderer (nodes, variants, details,
   badges, zones, connectors, legend).
3. Editor UI, templates, JSON import/export, autosave, SVG/PNG export, zoom.
4. Verify end-to-end, README, GitHub Pages workflow, push.
