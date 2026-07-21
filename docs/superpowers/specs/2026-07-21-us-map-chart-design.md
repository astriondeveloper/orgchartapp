# Design: U.S. Map chart type (LCATs, FTEs, key personnel by location)

Date: 2026-07-21
Status: Approved for planning
Related: builds on the existing manual position, resize, and glossary work in the Astrion Org Chart Builder.

## 1. Problem

Capture and proposal teams need to show, on a single graphic, where a contract's
labor will be performed: which work locations, which LCATs sit at each location,
how many FTEs, and how many of those are key personnel. Some positions are OCONUS
and cannot sit on a map of the continental U.S. A 40-plus-position contract makes
this hard to show without the graphic becoming unreadable.

The output must be **legible inside a proposal volume** and useful for **planning**.
Legibility at real density is the first success criterion.

## 2. Goals and non-goals

### Goals
- A U.S. map graphic with a star at each work location, a roster of that location's
  positions (each with a position title, an optional LCAT label, an FTE count, and a
  key-personnel count), and computed site totals.
- An OCONUS section for positions the map cannot place.
- Accurate U.S. geography (real Census boundary, correct projected star positions).
- **Painless, on-map direct editing.** Every element (stars, roster cards, LCAT rows)
  is added, moved (drag and drop), resized, and edited in place on the canvas, with no
  need to touch JSON. Positions persist so the layout stays reproducible.
- Stays legible at 40-plus LCATs across a dozen-plus sites.
- Brand-locked (Astrion palette) and export-clean (SVG / PNG / PDF / PPTX), matching
  the rest of the tool.
- Deterministic and reproducible: the same document always renders identically, and
  the document round-trips through JSON.

### Non-goals (v1)
- Runtime latitude/longitude entry (needs a projection shipped in the app; deferred).
- County or city-level detail beyond the bundled location list.
- Automatic overlap resolution beyond a deterministic initial placement; the user
  drags cards to finalize.
- Editing an org chart and a map at the same time in one screen (one active document;
  use Save/Load JSON to keep both per proposal). Multi-document tabs are a future item.
- The alternate "headcount bubble" and "map + table" treatments (Options C and B from
  the brainstorm). Option A (annotated map) is v1; the others can layer on later.

## 3. Success criteria

- A reviewer reading the exported graphic can, without zooming, tell each site, its
  LCATs, its FTE total, and its key-personnel count.
- At 12 sites / ~46 FTEs the map has no overlapping text in the default layout.
- The exported SVG/PNG/PDF/PPTX contains no editor chrome (handles, selection, leader
  drag targets).
- A user can build and rearrange a map entirely by direct manipulation on the canvas
  (add sites, drop stars, drag and resize cards, edit position/LCAT rows) without
  editing JSON.
- Loading a map JSON produces a pixel-identical render across machines and sessions.
- Existing org charts continue to load and render unchanged.

## 4. Approach (decisions taken during brainstorming)

- **Treatment: Option A, annotated map.** Star per location, roster card per site,
  compact total-chip where space is tight, OCONUS inset strip below.
- **A separate "U.S. Map" chart type**, not a layout mode of the org chart. The app
  gains a document `kind` (`org` vs `map`) and routes to the right renderer and editor.
  This keeps the org-chart model untouched and gives the map a purpose-built editor.
- **Placement: bundled location list plus drag.** Pick a city or installation from a
  bundled list and the star drops at its correct projected spot; drag to place or nudge
  anything custom. Positions save in the JSON. (Lat/long entry is a later enhancement.)

## 5. Architecture

Single-page app, same as today. The change introduces a second document type behind a
discriminated union and routes rendering and editing on `kind`.

```
Document = OrgChart | MapChart        // discriminated by `kind`; absent => 'org'
App
 ├─ kind === 'org'  -> ChartSvg (existing)      + SidePanel/org editor (existing)
 └─ kind === 'map'  -> MapSvg (new)             + MapEditor (new)
Export pipeline (export.ts / pdf.ts / pptx.ts)  -> unchanged; operates on the live <svg>
```

New units, each with one clear job:

| File | Purpose |
| --- | --- |
| `src/mapModel.ts` | Map document types + tree/edit helpers + `normalizeMap` |
| `src/usMapData.ts` | Precomputed, inlined map path + borders + viewBox (generated) |
| `src/locations.ts` | Bundled location list with precomputed map coords (generated) |
| `src/mapLayout.ts` | Pure layout: sites -> stars, cards/chips, leader lines, OCONUS strip, bounds |
| `src/MapSvg.tsx` | Pure SVG renderer for a `MapLayout` (brand-locked, export-safe) |
| `src/MapEditor.tsx` | Side-panel editor for a map document |
| `scripts/gen-usmap.mjs` | Dev-only regeneration of `usMapData.ts` + `locations.ts` |

`model.ts` gains a top-level optional `kind?: 'org'` on `OrgChart` and a
`normalizeDocument(input)` that dispatches to `normalizeChart` or `normalizeMap`.
`App.tsx` gains the kind routing, a "New U.S. Map" entry, and canvas interactions for
sites. `theme.ts` gains map tokens (map fill, border, star). `LegendItem` and
`GlossaryTerm` and their editors are reused for both document kinds.

## 6. Data model

```ts
// src/mapModel.ts
export interface MapLcat {
  id: string
  title: string          // position / role shown on the card row, e.g. "Program Manager"
  lcat?: string          // optional labor-category label shown under the title
  fte: number            // full-time equivalents, >= 0
  keyPersonnel: number   // key personnel within this position, >= 0
}

export interface MapSite {
  id: string
  name: string                     // "Huntsville, AL"
  locationId?: string              // key into locations.ts; sets `geo` when picked
  geo?: { x: number; y: number }   // star position in map space (from list or drag)
  card?: { x: number; y: number }  // roster-card top-left (manual placement)
  collapsed?: boolean              // render a total-chip instead of the full roster
  oconus?: boolean                 // route to the OCONUS strip (no map point)
  lcats: MapLcat[]
}

export interface MapChart {
  version: 1
  kind: 'map'
  meta: { title: string; showTitle: boolean; glossaryTitle?: string }
  sites: MapSite[]
  legend: LegendItem[]        // reused from model.ts
  glossary?: GlossaryTerm[]   // reused from model.ts
}
```

Rules:
- Each roster entry lists a staffed position: `title` (the role, shown bold) with an
  optional `lcat` label beneath it, plus its FTE and key-personnel counts. A team can
  show just the position, just the LCAT, or both.
- Site FTE and key-personnel **totals are computed** from `lcats`, never stored, so
  they cannot drift.
- A site renders **on the map** when it has a `geo` and is not `oconus`; otherwise it
  renders **in the OCONUS strip**. Overseas locations have no `geo`, so they land in
  the strip automatically. Alaska/Hawaii list entries carry valid projected `geo`
  (AlbersUSA insets), so they can sit on the map unless flagged OCONUS.
- Map space is the projection's fit box, `0 0 960 600`. All `geo`/`card` values live in
  that space, so they are resolution-independent and reproducible.

### Coexistence and migration
- Add optional `kind?: 'org'` to `OrgChart`. A document with `kind === 'map'` is a
  `MapChart`; anything else (including legacy files with no `kind`) is an `OrgChart`.
- `normalizeDocument(input)` dispatches by `kind`. `normalizeMap` coerces shape, drops
  malformed sites/LCATs, defaults `fte`/`keyPersonnel` to 0, clamps negatives to 0,
  drops non-finite `geo`/`card`, and backfills missing ids. It mirrors the defensive
  style of the existing `normalizeChart`.
- `App` load, import, JSON tab, and localStorage all go through `normalizeDocument`.

## 7. The map asset and generation pipeline

- Source: U.S. Census cartographic boundaries via `us-atlas` (public domain).
- Projection: `d3-geo` `geoAlbersUsa().fitSize([960, 600], nation)`, which insets
  Alaska and Hawaii. Produces the nation outline path and the interior state-border
  mesh (drawn faintly for reference).
- Simplification: reduce the nation geometry (topojson-simplify or coordinate rounding)
  to a target of roughly 15-20 KB of path data with no visible loss at display size.
  The raw 10m path is ~99 KB and is too heavy to inline as-is.
- Output: `src/usMapData.ts` exports `{ viewBox, nation, borders }` as inlined strings.
  The same script projects the source location list and writes `src/locations.ts`.
- `us-atlas`, `d3-geo`, and `topojson-*` are **devDependencies used only by the
  generation script**. The app ships zero runtime map dependencies; the map is inlined
  SVG, which keeps exports sharp and self-contained.
- The script is committed and rerun manually when the map or location list changes.
  Its output is deterministic given fixed inputs.

### Bundled location list
`src/locations.ts`: `{ id, name, geo: { x, y } }[]` for common metros and major U.S.
installations, precomputed in map space. Starter set on the order of 50-80 entries,
extensible. Overseas entries are represented as OCONUS presets (name only, no `geo`).

## 8. Layout (`mapLayout.ts`, pure)

Input: a `MapChart`. Output: a `MapLayout` describing everything the renderer draws.

- **Stars:** at each on-map site's `geo`.
- **Roster cards:** at `site.card` if set; otherwise auto-placed deterministically by
  the star's quadrant (fan toward the nearest open margin) so the default never sits on
  top of the star. A leader line connects star to card.
- **Collapsed sites:** render a single total-chip (`name . FTE [. KP]`) near the star
  instead of a card.
- **OCONUS strip:** a labeled band below the map; OCONUS/geo-less sites laid left to
  right, each with a star and a one-line roster.
- **Totals:** per-site FTE/KP (sum of LCATs) and a grand total available to the editor.
- **Legend / glossary / title:** reuse the existing layout logic (extract shared
  helpers from `layout.ts` where cheap; otherwise a thin local copy of the ~30 lines).
- **Bounds:** width/height cover the map, the OCONUS strip, any cards that extend past
  the map, the legend, and the glossary. No NaN geometry for any input.

Determinism: no `Date.now`/random; identical input yields identical output.

## 9. Rendering (`MapSvg.tsx`, pure)

- `<svg viewBox="0 0 W H">` with the nation fill (light brand wash), faint state
  borders, then stars (Supernova), leader lines, roster cards (Force header, white body
  with a row per position showing the position title, an optional LCAT line beneath it,
  the FTE count, and a gold key marker for key personnel), total-chips, the OCONUS
  strip, legend, glossary, and title.
- All colors from `theme.ts`; no off-brand values. Inline attributes only, so the
  exported SVG is self-contained (same constraint the current renderer honors).
- Editor chrome (selection outline, resize handles, leader drag targets) is tagged
  `data-ui` and stripped by `svgMarkup` on every export, exactly as today.

## 10. Editing (`MapEditor.tsx`)

Direct, painless editing is the priority: the canvas is the primary surface (add a
site, drop its star, drag and resize its card, edit rows in place), and the side panel
mirrors and complements it. Neither requires touching JSON.

Side panel for a map document:
- **Chart tab:** title, show-title, legend, and glossary editors (reused), plus a
  **Sites** section.
- **Site:** name; **location** picker (bundled list, or "custom / place by drag");
  OCONUS toggle; collapse-to-chip toggle; an **LCAT sub-editor** (rows of position
  title, optional LCAT label, FTE, key personnel; add / remove / reorder) with live
  site FTE/KP totals.
- **Add site** button; a grand-total readout (all sites) for planning.
- Selecting a star or card on the canvas selects its site row, and vice versa.

Canvas interactions reuse the existing pointer patterns from `App.tsx`:
- Drag a **star** to set `geo`; drag a **card** to set `card`; **resize** a card via the
  existing handle pattern. Movement is snapped, previewed live, and committed as one
  undo step. All positions persist in the JSON.

## 11. Persistence, export, brand

- localStorage stores the active document (org or map). Creating a new document of
  either kind confirms replacement first, matching the current template-load behavior.
  Save/Load JSON preserves both an org chart and a map per proposal.
- Export is unchanged: `export.ts`, `pdf.ts`, `pptx.ts` operate on the live `<svg>`.
- Brand: stars use Supernova; cards use Force/Sky; map fill and borders are light brand
  washes added to `theme.ts`. Fully brand-locked.

## 12. Testing

- `mapModel`: `normalizeMap` coercion (defaults, negative clamp, drop malformed
  sites/LCATs and non-finite geo/card, backfill ids); `normalizeDocument` routes by
  `kind`; legacy no-`kind` document loads as `org`.
- `mapLayout`: deterministic placement; auto card placement never lands on the star;
  site and grand FTE/KP totals; OCONUS/geo-less sites route to the strip; bounds include
  cards, strip, legend, glossary; no NaN for any input.
- `locations`: every entry has finite `geo` within the viewBox.
- `usMapData`: `nation` and `borders` are non-empty and start with `M`.
- Export: `MapSvg` output run through `svgMarkup` contains no `[data-ui]` elements.
- Browser smoke (matching the pattern already used this project): a seeded map renders
  stars, cards, chips, the OCONUS strip, and exports without chrome.

## 13. Build order (phases)

1. **Map data pipeline:** `scripts/gen-usmap.mjs` -> `src/usMapData.ts` +
   `src/locations.ts`; add devDependencies.
2. **Model:** `mapModel.ts`, `normalizeMap`, `normalizeDocument`, `kind` on `OrgChart`;
   route load/import/JSON/localStorage through `normalizeDocument`.
3. **Layout:** `mapLayout.ts` (pure) with tests.
4. **Renderer:** `MapSvg.tsx`.
5. **App routing:** kind-based render/editor switch, "New U.S. Map" entry, canvas
   select/drag/resize for sites.
6. **Editor:** `MapEditor.tsx` (sites, LCATs, placement, OCONUS, collapse; reuse
   legend/glossary/title editors).
7. **Legibility polish:** collapse-to-chip, deterministic card fan-out, leader routing.
8. **Tests + README** update.

Each phase is independently reviewable and leaves the app working.

## 14. Open questions / future

- Alaska/Hawaii default: on-map native insets (current plan) versus always in the
  OCONUS strip. Plan: on-map when the site has projected `geo` and is not flagged OCONUS.
- Later views: the "map + roster table" (B) and "headcount bubble" (C) treatments as
  toggles over the same map model.
- Later input: latitude/longitude entry, which requires shipping an AlbersUSA projector
  in the app rather than only in the generation script.
- Later: multiple documents open at once (org chart and map side by side).
