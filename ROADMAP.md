# Roadmap — to a free-form, TRL 9 chart builder

This plan takes the Astrion Org Chart Builder from a working tidy-tree generator
to a modern, direct-manipulation canvas that can express **abstract** charts (any
shape, any direction, any connection) while staying brand-locked and export-clean.

An interactive version of this roadmap was shared for review during planning.

## Direction (approved)

- **Free-form architecture:** Hybrid — keep deterministic auto-layout as the
  default, add manual placement and free connections on top.
- **Build vs. adopt:** Keep the custom, zero-dependency engine (preserves export
  fidelity and brand enforcement).
- **Scope:** Single-user tool first (local + export). Collaboration is a later,
  optional phase.

## What "ship" means

| Tier | Bar | Phases |
| --- | --- | --- |
| **Ship now** | Dependable branded org-chart generator | Phase 0 |
| **Ship v1.0** | Modern canvas + abstract / free-form diagramming | Phases 1–2 |
| **TRL 9** | Tested, performant, accessible, proven in real proposals | + Phase 3 (+4 if a platform) |

## Phases

### Phase 0 — Harden what exists · **done**
- CI gate: lint + build + unit tests on every PR (`.github/workflows/ci.yml`).
- Vitest unit tests for the pure layers (model, layout, templates).
- Fit-to-screen and zoom-to-selection ("Fit" / "Focus").
- Keyboard: delete selected box, duplicate (Ctrl/Cmd+D).
- Empty / first-run state.
- Schema version + `normalizeChart()` validation and migration hook, applied to
  load, import, and the JSON tab.

### Phase 1 — Modern canvas & direct manipulation
- Pan / zoom canvas (space-drag, scroll, pinch) + minimap.
- Direct selection: click, shift-select, marquee multi-select.
- Drag-to-move with snapping + alignment guides (optional per-node positions,
  saved in JSON so charts stay reproducible).
- Design-system refresh: tokens, dark mode, type scale, floating contextual
  toolbar, refined inspector, ⌘K command palette, micro-interactions.
- Copy / paste / duplicate; undo/redo covering positions.

### Phase 2 — Abstract / free-form diagramming
- Model evolves tree → graph: first-class edges (source/target + ports, routing,
  arrowheads, labels, style) generalizing today's comm links; free-standing nodes.
- Layout strategies, switchable per chart or branch: manual, top-down / bottom-up,
  left-right / right-left, radial, layered DAG, grid/matrix, swimlane.
- Draw edges from node ports; edit waypoints; reroute.
- Shape library and free frames / annotations / logos — color still governed.

### Phase 3 — Production hardening (TRL 8 → 9)
- Component + Playwright e2e tests, gated in CI.
- Performance: memoized layout, canvas culling for large graphs, incremental relayout.
- Accessibility: full keyboard operation, ARIA, focus management, reduced-motion.
- Schema versioning + migrations; resilient import.
- Export upgrades: PDF / print, editable PPTX, copy-image-to-clipboard.
- Reliability: error boundaries, autosave history + recovery, toasts.

### Phase 4 — Platform (optional)
- Cloud save + shareable links, template gallery, saved brand-theme presets.
- Comments → real-time multi-user (CRDT), SSO.

## Architecture evolution (ethos preserved)

- `model.ts`: strict tree → graph (nodes + first-class edges, optional positions).
- `layout.ts`: one tidy-tree function → pluggable layout strategies + an edge
  router, still pure and deterministic.
- `ChartSvg.tsx`: static render → an interactive layer (drag, ports, marquee,
  pan/zoom) over the same brand-locked SVG primitives, so SVG/PNG export stays sharp.

Colors and typography remain governed by `theme.ts`; free-form is opt-in; saved
positions keep every chart reproducible.
