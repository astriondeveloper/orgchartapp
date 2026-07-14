import type { CommLink, Direction, Group, LegendItem, OrgChart, OrgNode } from './model'
import { visit } from './model'
import { type LayoutGaps, layoutGaps, metrics as M } from './theme'

/** Resolve the active spacing (comfortable/compact) for a chart. */
function gapsOf(chart: OrgChart): LayoutGaps {
  return layoutGaps[chart.meta.density === 'compact' ? 'compact' : 'comfortable']
}

/*
 * Deterministic layout engine. Pure functions: the same OrgChart always
 * produces the same geometry, so proposal charts are perfectly repeatable.
 *
 * The tidy-tree is computed in a direction-agnostic (main, cross) space —
 * `main` is the flow/depth axis (parent -> child) and `cross` is the axis
 * siblings spread along. A final mapping turns (main, cross) into screen
 * (x, y) for the chosen flow Direction (top-down, bottom-up, left-right,
 * right-left). Boxes are never rotated; only their placement changes.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface DetailBlock {
  lines: string[]
  h: number
}

export interface PlacedNode {
  node: OrgNode
  x: number
  y: number
  w: number
  /** Height of the colored header block. */
  headerH: number
  /** Header + detail rows. */
  totalH: number
  titleLines: string[]
  /** Left-align the title (boxes with names/bullets) vs centered. */
  leftAlign: boolean
  bulletLines: { text: string; first: boolean }[]
  detailBlocks: DetailBlock[]
}

export interface Zone {
  group: Group
  rect: Rect
}

export interface CommPath {
  link: CommLink
  path: string
  /** Midpoint between the two connected boxes, for an optional edge label. */
  labelPos: { x: number; y: number }
}

export interface LegendLayout {
  x: number
  y: number
  w: number
  h: number
  items: LegendItem[]
}

export interface Layout {
  placed: PlacedNode[]
  /** Reporting-line connector paths. */
  connectors: string[]
  zones: Zone[]
  comms: CommPath[]
  legend: LegendLayout | null
  title: { text: string; x: number; y: number; w: number } | null
  width: number
  height: number
}

/* ---------------------------------------------------------- text metrics */

const NARROW = new Set([...`iIljtfr.,;:!'"()[]|/ `])
const WIDE = new Set([...'mwMW@%&'])

// Average glyph widths tuned for Verdana (the brand-standard fallback for
// Obvia), which runs wider than most UI fonts.
export function textWidth(s: string, size: number, bold = false): number {
  let w = 0
  for (const ch of s) {
    if (NARROW.has(ch)) w += 0.36
    else if (WIDE.has(ch)) w += 0.98
    else if (ch >= 'A' && ch <= 'Z') w += 0.78
    else if (ch >= '0' && ch <= '9') w += 0.64
    else w += 0.58
  }
  return w * size * (bold ? 1.09 : 1)
}

export function wrapText(text: string, size: number, maxW: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (textWidth(candidate, size, bold) <= maxW || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/* ------------------------------------------------------------- measuring */

interface Measured {
  node: OrgNode
  w: number
  headerH: number
  totalH: number
  titleLines: string[]
  leftAlign: boolean
  bulletLines: { text: string; first: boolean }[]
  detailBlocks: DetailBlock[]
  children: Measured[]
  /** Box extent along the flow axis and the sibling axis. */
  mainSize: number
  crossSize: number
  /** Full subtree extent along each axis. */
  subMain: number
  subCross: number
}

function measureNode(node: OrgNode, vertical: boolean, g: LayoutGaps): Measured {
  const hidden = node.variant === 'hidden'
  const w = hidden ? 0 : (node.width ?? M.boxWidth)
  const hasBadge = (node.badges ?? []).length > 0
  const photoPad = node.photo ? 38 : 0
  const contentW = Math.max(40, w - M.padX * 2 - photoPad - (hasBadge ? 14 : 0))

  const titleLines = hidden ? [] : wrapText(node.title, M.titleSize, contentW, true)
  const bulletLines: { text: string; first: boolean }[] = []
  for (const b of node.bullets ?? []) {
    const lines = wrapText(b, M.bulletSize, contentW - 12)
    lines.forEach((text, i) => bulletLines.push({ text, first: i === 0 }))
  }
  const leftAlign = (node.bullets ?? []).length > 0 || !!node.name

  let headerH = 0
  if (!hidden) {
    headerH =
      M.padY * 2 +
      titleLines.length * M.titleLineH +
      (node.name ? M.nameLineH : 0) +
      (bulletLines.length ? 6 + bulletLines.length * M.bulletLineH : 0)
    headerH = Math.max(headerH, node.photo ? 52 : M.minHeaderH)
  }

  const detailBlocks: DetailBlock[] = []
  for (const d of node.details ?? []) {
    const combined = d.label ? `${d.label} ${d.text}` : d.text
    const lines = wrapText(combined, M.detailSize, w - M.padX * 2)
    detailBlocks.push({ lines, h: lines.length * M.detailLineH + M.detailPadY * 2 })
  }
  const totalH = headerH + detailBlocks.reduce((s, b) => s + b.h, 0)

  // The box occupies `totalH` vertically and `w` horizontally. Which of those
  // is "along the flow" (main) vs "across siblings" (cross) depends on flow.
  const mainSize = vertical ? totalH : w
  const crossSize = vertical ? w : totalH

  const children = (node.children ?? []).map((c) => measureNode(c, vertical, g))
  const layoutMode = node.childLayout ?? 'row'
  const levelGap = hidden ? 0 : g.levelGap
  const stackGap = hidden ? 0 : g.stackGap
  const indent = hidden ? 0 : g.stackIndent

  let subCross = crossSize
  let subMain = mainSize
  if (children.length) {
    if (layoutMode === 'stack') {
      const maxChildCross = Math.max(...children.map((c) => c.subCross))
      subCross = Math.max(crossSize, indent + maxChildCross)
      subMain = mainSize + children.reduce((s, c) => s + (stackGap || g.stackGap) + c.subMain, 0)
    } else {
      const rowCross =
        children.reduce((s, c) => s + c.subCross, 0) + g.siblingGap * (children.length - 1)
      subCross = Math.max(crossSize, rowCross)
      subMain = mainSize + levelGap + Math.max(...children.map((c) => c.subMain))
    }
  }

  return {
    node,
    w,
    headerH,
    totalH,
    titleLines,
    leftAlign,
    bulletLines,
    detailBlocks,
    children,
    mainSize,
    crossSize,
    subMain,
    subCross,
  }
}

/* --------------------------------------------------------------- placing */

/** A node placed in logical (main, cross) space, mapped to screen later. */
interface Raw {
  m: Measured
  main: number
  cross: number
}

/** A connector is a polyline of [cross, main] points in logical space. */
type Polyline = [number, number][]

function placeNode(
  m: Measured,
  cross: number,
  main: number,
  raw: Raw[],
  conns: Polyline[],
  g: LayoutGaps,
): { center: number } {
  const hidden = m.node.variant === 'hidden'
  const layoutMode = m.node.childLayout ?? 'row'

  let nodeCross = cross + (m.subCross - m.crossSize) / 2
  if (layoutMode === 'stack') nodeCross = cross

  if (m.children.length && layoutMode === 'row') {
    const rowCross =
      m.children.reduce((s, c) => s + c.subCross, 0) + g.siblingGap * (m.children.length - 1)
    let childCross = cross + (m.subCross - rowCross) / 2
    const childMain = main + m.mainSize + (hidden ? 0 : g.levelGap)
    const centers: number[] = []
    for (const c of m.children) {
      const r = placeNode(c, childCross, childMain, raw, conns, g)
      centers.push(r.center)
      childCross += c.subCross + g.siblingGap
    }
    // Center the parent box over its children's centers.
    const mid = (centers[0] + centers[centers.length - 1]) / 2
    nodeCross = Math.max(cross, Math.min(mid - m.crossSize / 2, cross + m.subCross - m.crossSize))
    if (!hidden) {
      const pc = nodeCross + m.crossSize / 2
      const busMain = main + m.mainSize + g.levelGap / 2
      conns.push([
        [pc, main + m.mainSize],
        [pc, busMain],
      ])
      if (centers.length > 1 || Math.abs(centers[0] - pc) > 0.5) {
        conns.push([
          [Math.min(pc, ...centers), busMain],
          [Math.max(pc, ...centers), busMain],
        ])
      }
      for (const cc of centers) {
        conns.push([
          [cc, busMain],
          [cc, childMain],
        ])
      }
    }
  } else if (m.children.length && layoutMode === 'stack') {
    const indent = hidden ? 0 : g.stackIndent
    const spineCross = nodeCross + indent / 2
    let cm = main + m.mainSize + g.stackGap
    let lastMidMain = cm
    for (const c of m.children) {
      placeNode(c, nodeCross + indent, cm, raw, conns, g)
      lastMidMain = cm + Math.min(c.mainSize || c.subMain, 40) / 2
      if (!hidden) {
        conns.push([
          [spineCross, lastMidMain],
          [nodeCross + indent, lastMidMain],
        ])
      }
      cm += c.subMain + g.stackGap
    }
    if (!hidden) {
      conns.push([
        [spineCross, main + m.mainSize],
        [spineCross, lastMidMain],
      ])
    }
  }

  if (!hidden) raw.push({ m, main, cross: nodeCross })
  return { center: nodeCross + (m.crossSize || m.subCross) / 2 }
}

/* ---------------------------------------------------------------- extras */

function subtreeIds(node: OrgNode): string[] {
  const out: string[] = [node.id]
  for (const c of node.children ?? []) out.push(...subtreeIds(c))
  return out
}

function indexById(placed: PlacedNode[]): Map<string, PlacedNode> {
  const m = new Map<string, PlacedNode>()
  for (const p of placed) m.set(p.node.id, p)
  return m
}

function boxOf(byId: Map<string, PlacedNode>, id: string): Rect | null {
  const p = byId.get(id)
  return p ? { x: p.x, y: p.y, w: p.w, h: p.totalH } : null
}

function routeComm(a: Rect, b: Rect): string {
  const aCx = a.x + a.w / 2
  const bCx = b.x + b.w / 2
  if (b.x >= a.x + a.w + 12) {
    // B is to the right.
    const sy = a.y + a.h / 2
    const ey = b.y + b.h / 2
    const sx = a.x + a.w
    const ex = b.x
    const midX = (sx + ex) / 2
    return sy === ey
      ? `M ${sx} ${sy} H ${ex}`
      : `M ${sx} ${sy} H ${midX} V ${ey} H ${ex}`
  }
  if (a.x >= b.x + b.w + 12) {
    const sy = a.y + a.h / 2
    const ey = b.y + b.h / 2
    const sx = a.x
    const ex = b.x + b.w
    const midX = (sx + ex) / 2
    return sy === ey
      ? `M ${sx} ${sy} H ${ex}`
      : `M ${sx} ${sy} H ${midX} V ${ey} H ${ex}`
  }
  // Vertically related.
  if (b.y >= a.y + a.h) {
    const midY = (a.y + a.h + b.y) / 2
    return `M ${aCx} ${a.y + a.h} V ${midY} H ${bCx} V ${b.y}`
  }
  const midY = (b.y + b.h + a.y) / 2
  return `M ${aCx} ${a.y} V ${midY} H ${bCx} V ${b.y + b.h}`
}

const LEGEND_ITEM_H = 24
const LEGEND_PAD = 12

// textWidth() is deliberately generous so boxes never clip their text; that
// padding is invisible inside a box, but the headline accent bar sits directly
// under the rendered title, so scale the estimate to track the rendered glyph
// run. Kept close to 1 so the bar reaches the last word (Obvia, the brand
// font, renders a touch wider than the Verdana-tuned estimate) without a
// noticeable overshoot.
const TITLE_BAR_SCALE = 0.9

/** Shared tail: build zones, edges, legend, title, and bounds from already
 *  positioned boxes + connectors. Used by every layout strategy. */
function assemble(chart: OrgChart, placed: PlacedNode[], connectors: string[], gaps: LayoutGaps): Layout {
  // Index once so zone/edge lookups are O(1) instead of scanning `placed`.
  const byId = indexById(placed)

  // Zones behind member subtrees (computed from final screen rects).
  const zones: Zone[] = []
  for (const g of chart.groups) {
    const ids = new Set<string>()
    for (const memberId of g.memberIds) {
      const node = byId.get(memberId)?.node
      if (node) subtreeIds(node).forEach((i) => ids.add(i))
    }
    let x1 = Infinity
    let y1 = Infinity
    let x2 = -Infinity
    let y2 = -Infinity
    for (const id of ids) {
      const b = byId.get(id)
      if (!b) continue
      x1 = Math.min(x1, b.x)
      y1 = Math.min(y1, b.y)
      x2 = Math.max(x2, b.x + b.w)
      y2 = Math.max(y2, b.y + b.totalH)
    }
    if (x1 === Infinity) continue
    zones.push({
      group: g,
      rect: { x: x1 - gaps.zonePad, y: y1 - gaps.zonePad, w: x2 - x1 + 2 * gaps.zonePad, h: y2 - y1 + 2 * gaps.zonePad },
    })
  }

  // Edges (communication / graph connections).
  const comms: CommPath[] = []
  for (const link of chart.comms) {
    const a = boxOf(byId, link.fromId)
    const b = boxOf(byId, link.toId)
    if (a && b) {
      const labelPos = {
        x: (a.x + a.w / 2 + b.x + b.w / 2) / 2,
        y: (a.y + a.h / 2 + b.y + b.h / 2) / 2,
      }
      comms.push({ link, path: routeComm(a, b), labelPos })
    }
  }

  // Content bounds.
  const x2s = placed.map((p) => p.x + p.w).concat(zones.map((z) => z.rect.x + z.rect.w))
  const y2s = placed.map((p) => p.y + p.totalH).concat(zones.map((z) => z.rect.y + z.rect.h))
  const ys = placed.map((p) => p.y).concat(zones.map((z) => z.rect.y))
  const maxX = x2s.length ? Math.max(...x2s) : 400
  const maxY = y2s.length ? Math.max(...y2s) : 300
  const minY = ys.length ? Math.min(...ys) : gaps.canvasPad

  // Legend to the right of content.
  let legend: LegendLayout | null = null
  if (chart.legend.length) {
    const w =
      Math.max(
        textWidth('Legend', 12, true),
        ...chart.legend.map((l) => textWidth(l.label, 11)),
      ) +
      LEGEND_PAD * 2 +
      30
    const h = LEGEND_PAD * 2 + 18 + chart.legend.length * LEGEND_ITEM_H
    legend = { x: maxX + gaps.legendGap, y: minY, w, h, items: chart.legend }
  }

  // Headlines render all-caps at size 20 bold; measure that so the accent bar
  // (and the canvas) can size to the actual title width.
  const title =
    chart.meta.showTitle && chart.meta.title.trim()
      ? {
          text: chart.meta.title,
          x: gaps.canvasPad,
          y: gaps.canvasPad + 22,
          w: textWidth(chart.meta.title.toUpperCase(), 20, true) * TITLE_BAR_SCALE,
        }
      : null

  const contentRight = legend ? legend.x + legend.w : maxX
  const titleRight = title ? title.x + title.w : 0
  const width = Math.max(contentRight, titleRight) + gaps.canvasPad
  const height = Math.max(maxY, legend ? legend.y + legend.h : 0) + gaps.canvasPad

  return { placed, connectors, zones, comms, legend, title, width, height }
}

/* --------------------------------------------------- manual overrides */

/** Move any box that carries a manual `pos` to that position. Returns true if
 *  at least one box moved, so the caller knows connectors must be re-routed. */
function applyOverrides(placed: PlacedNode[]): boolean {
  let moved = false
  for (const p of placed) {
    if (p.node.pos) {
      p.x = p.node.pos.x
      p.y = p.node.pos.y
      moved = true
    }
  }
  return moved
}

/** Parent→child connectors as orthogonal elbows routed from the final box
 *  geometry. Used by the tree layout once a box is manually moved (the bus
 *  routing assumes auto positions) and by the graph layouts (layered / matrix /
 *  swimlane), whose boxes are not in tidy-tree positions. Hidden containers
 *  draw no line, so their descendants connect to the nearest visible ancestor. */
function hierarchyConnectors(chart: OrgChart, placed: PlacedNode[]): string[] {
  const byId = indexById(placed)
  const parentOf = new Map<string, OrgNode | null>()
  visit(chart.roots, (n, parent) => parentOf.set(n.id, parent))
  const out: string[] = []
  visit(chart.roots, (n) => {
    if (n.variant === 'hidden') return
    let anc = parentOf.get(n.id) ?? null
    while (anc && anc.variant === 'hidden') anc = parentOf.get(anc.id) ?? null
    if (!anc) return
    const a = boxOf(byId, anc.id)
    const b = boxOf(byId, n.id)
    if (a && b) out.push(routeComm(a, b))
  })
  return out
}

/**
 * Cheap drag preview: move one box within an already-computed layout and
 * re-derive only the dependent geometry (connectors, zones, edges, bounds),
 * reusing every untouched PlacedNode object by reference. This skips the
 * per-move re-measure / re-layout and lets memoized boxes avoid re-rendering,
 * so dragging stays smooth on large charts.
 */
export function previewDrag(chart: OrgChart, base: Layout, id: string, x: number, y: number): Layout {
  const placed = base.placed.map((p) => (p.node.id === id ? { ...p, x, y } : p))
  return assemble(chart, placed, hierarchyConnectors(chart, placed), gapsOf(chart))
}

/* ------------------------------------------------------------- radial */

/** Clearance (px) kept between adjacent radial boxes, radially and angularly. */
const RADIAL_GAP = 56

/** Number of leaves under a measured node (its angular weight). */
function leafCount(m: Measured): number {
  if (!m.children.length) return 1
  return m.children.reduce((s, c) => s + leafCount(c), 0)
}

interface RadialPlaced {
  m: Measured
  /** Center angle on its ring (radians). */
  angle: number
  cx: number
  cy: number
  depth: number
  parent: RadialPlaced | null
}

/** Assign each node a center angle: children partition the parent's arc by
 *  leaf weight, so every leaf ends up with an equal slice of the full circle.
 *  Radii (and hence cx/cy) are resolved afterward, once all angles are known. */
function placeRadial(
  m: Measured,
  a0: number,
  a1: number,
  depth: number,
  parent: RadialPlaced | null,
  out: RadialPlaced[],
): RadialPlaced {
  const self: RadialPlaced = { m, angle: (a0 + a1) / 2, cx: 0, cy: 0, depth, parent }
  out.push(self)
  const total = leafCount(m)
  let cursor = a0
  for (const c of m.children) {
    const span = ((a1 - a0) * leafCount(c)) / total
    placeRadial(c, cursor, cursor + span, depth + 1, self, out)
    cursor += span
  }
  return self
}

function layoutRadial(chart: OrgChart): Layout {
  const g = gapsOf(chart)
  const placed: PlacedNode[] = []
  const connectors: string[] = []
  const ox = g.canvasPad
  const oy = g.canvasPad + (chart.meta.showTitle && chart.meta.title.trim() ? 44 : 0)
  let clusterLeft = 0

  // A box sits at an arbitrary angle on its ring but is never rotated, so its
  // half-diagonal is a rotation-safe bound on how far it reaches in any single
  // direction — used for both radial and tangential clearance.
  const halfDiag = (m: Measured) => Math.hypot(m.w, m.totalH) / 2

  for (const root of chart.roots) {
    const m = measureNode(root, true, g)

    const nodes: RadialPlaced[] = []
    placeRadial(m, 0, Math.PI * 2, 0, null, nodes)

    // Ring radii, sized from the ACTUAL geometry so no two boxes touch:
    //   • radial:  clear the previous ring's boxes and this ring's boxes.
    //   • angular: the tightest pair of adjacent centers on the ring must span
    //              both their footprints (radius * minAngleGap >= footprint).
    let maxDepth = 0
    const extentAt: number[] = []
    for (const n of nodes) {
      maxDepth = Math.max(maxDepth, n.depth)
      extentAt[n.depth] = Math.max(extentAt[n.depth] ?? 0, halfDiag(n.m))
    }
    const minGapAt: number[] = []
    for (let d = 0; d <= maxDepth; d++) {
      const angs = nodes.filter((n) => n.depth === d).map((n) => n.angle).sort((p, q) => p - q)
      if (angs.length < 2) {
        minGapAt[d] = Math.PI * 2
        continue
      }
      let ag = Math.PI * 2 + angs[0] - angs[angs.length - 1] // wrap-around neighbor
      for (let i = 1; i < angs.length; i++) ag = Math.min(ag, angs[i] - angs[i - 1])
      minGapAt[d] = Math.max(ag, 1e-3)
    }
    const radii: number[] = [0]
    for (let d = 1; d <= maxDepth; d++) {
      const radialMin = radii[d - 1] + extentAt[d - 1] + extentAt[d] + RADIAL_GAP
      const angularMin = (2 * extentAt[d] + RADIAL_GAP) / minGapAt[d]
      radii[d] = Math.max(radialMin, angularMin)
    }
    for (const n of nodes) {
      n.cx = radii[n.depth] * Math.cos(n.angle)
      n.cy = radii[n.depth] * Math.sin(n.angle)
    }

    // Shift this cluster so its bounding box sits at (clusterLeft, 0)+.
    const xs = nodes.map((n) => n.cx - n.m.w / 2)
    const ys = nodes.map((n) => n.cy - n.m.totalH / 2)
    const xe = nodes.map((n) => n.cx + n.m.w / 2)
    const minCx = Math.min(...xs)
    const minCy = Math.min(...ys)
    const shiftX = ox + clusterLeft - minCx
    const shiftY = oy - minCy

    // Final top-left of each node: its manual override wins over the auto ring
    // position. Center points are derived from that, so spokes follow moves.
    const topLeft = new Map<RadialPlaced, { x: number; y: number }>()
    for (const n of nodes) {
      topLeft.set(
        n,
        n.m.node.pos ?? { x: n.cx - n.m.w / 2 + shiftX, y: n.cy - n.m.totalH / 2 + shiftY },
      )
    }
    for (const n of nodes) {
      const tl = topLeft.get(n)!
      if (n.m.node.variant !== 'hidden') {
        placed.push({
          node: n.m.node,
          x: tl.x,
          y: tl.y,
          w: n.m.w,
          headerH: n.m.headerH,
          totalH: n.m.totalH,
          titleLines: n.m.titleLines,
          leftAlign: n.m.leftAlign,
          bulletLines: n.m.bulletLines,
          detailBlocks: n.m.detailBlocks,
        })
      }
      // Straight spoke from parent center to this node center (hidden under the
      // opaque boxes, so only the gap between them shows).
      if (n.parent && n.parent.m.node.variant !== 'hidden' && n.m.node.variant !== 'hidden') {
        const pt = topLeft.get(n.parent)!
        const pcx = pt.x + n.parent.m.w / 2
        const pcy = pt.y + n.parent.m.totalH / 2
        connectors.push(`M ${pcx} ${pcy} L ${tl.x + n.m.w / 2} ${tl.y + n.m.totalH / 2}`)
      }
    }

    const clusterW = Math.max(...xe) - minCx
    clusterLeft += clusterW + g.rootGap
  }

  return assemble(chart, placed, connectors, g)
}

/* ------------------------------ graph layouts (layered/matrix/swimlane) */

interface VisibleModel {
  /** Visible nodes in document (DFS) order. */
  nodes: OrgNode[]
  measured: Map<string, Measured>
  idset: Set<string>
  /** Nearest visible ancestor (hidden containers are bridged). */
  visParent: (n: OrgNode) => OrgNode | null
  /** Tree depth over visible nodes (roots = 0). */
  depth: (n: OrgNode) => number
}

/** Shared prep for the graph layouts: visible nodes + measurements, a
 *  nearest-visible-ancestor lookup, and memoized tree depth. */
function collectVisible(chart: OrgChart, g: LayoutGaps): VisibleModel {
  const parentOf = new Map<string, OrgNode | null>()
  visit(chart.roots, (n, p) => parentOf.set(n.id, p))
  const visParent = (n: OrgNode): OrgNode | null => {
    let a = parentOf.get(n.id) ?? null
    while (a && a.variant === 'hidden') a = parentOf.get(a.id) ?? null
    return a
  }
  const measured = new Map<string, Measured>()
  for (const r of chart.roots) {
    const stack: Measured[] = [measureNode(r, true, g)]
    while (stack.length) {
      const x = stack.pop()!
      measured.set(x.node.id, x)
      for (let i = x.children.length - 1; i >= 0; i--) stack.push(x.children[i])
    }
  }
  const nodes: OrgNode[] = []
  visit(chart.roots, (n) => {
    if (n.variant !== 'hidden') nodes.push(n)
  })
  const idset = new Set(nodes.map((n) => n.id))
  const depthCache = new Map<string, number>()
  const depth = (n: OrgNode): number => {
    const cached = depthCache.get(n.id)
    if (cached !== undefined) return cached
    const p = visParent(n)
    const d = p && idset.has(p.id) ? depth(p) + 1 : 0
    depthCache.set(n.id, d)
    return d
  }
  return { nodes, measured, idset, visParent, depth }
}

/** Build a PlacedNode from a measurement + auto position, honoring a manual
 *  override. Shared by every graph layout. */
function placeBox(n: OrgNode, m: Measured, x: number, y: number): PlacedNode {
  const at = n.pos ?? { x, y }
  return {
    node: n,
    x: at.x,
    y: at.y,
    w: m.w,
    headerH: m.headerH,
    totalH: m.totalH,
    titleLines: m.titleLines,
    leftAlign: m.leftAlign,
    bulletLines: m.bulletLines,
    detailBlocks: m.detailBlocks,
  }
}

/** Assign each visible node to a column. Columns come from the group zones
 *  (a group owns its members' subtrees, matching the zone rectangles), with a
 *  leading "unassigned" column for anything ungrouped. With no groups defined,
 *  each root's subtree becomes a column. */
function assignColumns(chart: OrgChart, model: VisibleModel): { label: string; ids: string[] }[] {
  const { nodes, idset } = model
  const nodeById = new Map<string, OrgNode>()
  visit(chart.roots, (n) => nodeById.set(n.id, n))
  const cols: { label: string; ids: string[] }[] = []

  if (chart.groups.length) {
    const sets = chart.groups.map((g) => {
      const s = new Set<string>()
      for (const mid of g.memberIds) {
        const n = nodeById.get(mid)
        if (n) for (const i of subtreeIds(n)) if (idset.has(i)) s.add(i)
      }
      return s
    })
    const buckets = chart.groups.map(() => [] as string[])
    const ungrouped: string[] = []
    for (const n of nodes) {
      const gi = sets.findIndex((s) => s.has(n.id))
      if (gi >= 0) buckets[gi].push(n.id)
      else ungrouped.push(n.id)
    }
    if (ungrouped.length) cols.push({ label: '', ids: ungrouped })
    chart.groups.forEach((g, i) => {
      if (buckets[i].length) cols.push({ label: g.label ?? '', ids: buckets[i] })
    })
  } else {
    for (const r of chart.roots) {
      const s = new Set(subtreeIds(r))
      const ids = nodes.filter((n) => s.has(n.id)).map((n) => n.id)
      if (ids.length) cols.push({ label: r.title, ids })
    }
  }
  return cols
}

const LAYERED_SWEEPS = 6

/** Sugiyama-lite layered layout. Every node is ranked into a depth-aligned row;
 *  barycenter passes center parents over their children (and pull cross-linked
 *  nodes together), so global peers line up and dotted-line relationships read
 *  clearly. Comms are drawn as the cross-layer edges by assemble(). */
function layoutLayered(chart: OrgChart): Layout {
  const g = gapsOf(chart)
  const model = collectVisible(chart, g)
  const { nodes, measured, idset, depth, visParent } = model
  if (!nodes.length) return assemble(chart, [], [], g)

  // Undirected adjacency for barycenter: hierarchy edges + comm cross-links.
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  const link = (a: string, b: string) => {
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  for (const n of nodes) {
    const p = visParent(n)
    if (p && idset.has(p.id)) link(p.id, n.id)
  }
  for (const c of chart.comms) {
    if (idset.has(c.fromId) && idset.has(c.toId) && c.fromId !== c.toId) link(c.fromId, c.toId)
  }

  // Rows by depth, initial order = DFS order.
  const maxLayer = Math.max(...nodes.map((n) => depth(n)))
  const rows: string[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const n of nodes) rows[depth(n)].push(n.id)

  // Row Y offsets (each row is as tall as its tallest box).
  const ox = g.canvasPad
  const oy = g.canvasPad + (chart.meta.showTitle && chart.meta.title.trim() ? 44 : 0)
  const rowY: number[] = []
  let yCursor = 0
  for (let L = 0; L <= maxLayer; L++) {
    rowY[L] = yCursor
    yCursor += Math.max(0, ...rows[L].map((id) => measured.get(id)!.totalH)) + g.levelGap
  }

  // Center-x per node: pack each row, then barycenter passes align the layers.
  const cx = new Map<string, number>()
  for (const row of rows) {
    let x = 0
    for (const id of row) {
      const w = measured.get(id)!.w
      cx.set(id, x + w / 2)
      x += w + g.siblingGap
    }
  }
  const resolveRow = (row: string[]) => {
    // Left-to-right, then right-to-left, so a barycenter target keeps min gaps
    // without dragging the whole row one way.
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1]
      const b = row[i]
      const min = cx.get(a)! + measured.get(a)!.w / 2 + g.siblingGap + measured.get(b)!.w / 2
      if (cx.get(b)! < min) cx.set(b, min)
    }
    for (let i = row.length - 2; i >= 0; i--) {
      const a = row[i]
      const b = row[i + 1]
      const max = cx.get(b)! - measured.get(b)!.w / 2 - g.siblingGap - measured.get(a)!.w / 2
      if (cx.get(a)! > max) cx.set(a, max)
    }
  }
  for (let sweep = 0; sweep < LAYERED_SWEEPS; sweep++) {
    for (const row of rows) {
      for (const id of row) {
        const ns = adj.get(id)!
        if (ns.length) cx.set(id, ns.reduce((s, k) => s + cx.get(k)!, 0) / ns.length)
      }
      resolveRow(row)
    }
  }

  // Shift so the leftmost box edge sits at ox.
  let minX = Infinity
  for (const n of nodes) minX = Math.min(minX, cx.get(n.id)! - measured.get(n.id)!.w / 2)
  const shiftX = ox - minX

  const placed = nodes.map((n) =>
    placeBox(n, measured.get(n.id)!, cx.get(n.id)! - measured.get(n.id)!.w / 2 + shiftX, rowY[depth(n)] + oy),
  )
  return assemble(chart, placed, hierarchyConnectors(chart, placed), g)
}

const CELL_GAP = 16
const COLUMN_GAP = 56

/** Matrix layout: a 2D grid with rows = tree depth and columns = group (or, if
 *  no groups are defined, root subtree). Cells stack their nodes vertically, so
 *  columns stay one box wide and depth reads across the grid. */
function layoutMatrix(chart: OrgChart): Layout {
  const g = gapsOf(chart)
  const model = collectVisible(chart, g)
  const { nodes, measured, depth } = model
  if (!nodes.length) return assemble(chart, [], [], g)
  const cols = assignColumns(chart, model)
  const colOf = new Map<string, number>()
  cols.forEach((c, ci) => c.ids.forEach((id) => colOf.set(id, ci)))
  const maxRow = Math.max(...nodes.map((n) => depth(n)))

  // Bucket nodes into cells (col, row), preserving DFS order.
  const cell = (ci: number, r: number) => ci * (maxRow + 1) + r
  const cells = new Map<number, string[]>()
  for (const n of nodes) {
    const k = cell(colOf.get(n.id)!, depth(n))
    ;(cells.get(k) ?? cells.set(k, []).get(k)!).push(n.id)
  }
  const cellHeight = (ids: string[] | undefined) =>
    ids && ids.length
      ? ids.reduce((s, id) => s + measured.get(id)!.totalH, 0) + CELL_GAP * (ids.length - 1)
      : 0

  // Column widths (widest box in the column) and row heights (tallest cell).
  const colW = cols.map((c) => Math.max(0, ...c.ids.map((id) => measured.get(id)!.w)))
  const rowH: number[] = []
  for (let r = 0; r <= maxRow; r++) {
    rowH[r] = Math.max(0, ...cols.map((_, ci) => cellHeight(cells.get(cell(ci, r)))))
  }

  const ox = g.canvasPad
  const oy = g.canvasPad + (chart.meta.showTitle && chart.meta.title.trim() ? 44 : 0)
  const colX: number[] = []
  let xCursor = ox
  for (let ci = 0; ci < cols.length; ci++) {
    colX[ci] = xCursor
    xCursor += colW[ci] + COLUMN_GAP
  }
  const rowYs: number[] = []
  let yCursor = oy
  for (let r = 0; r <= maxRow; r++) {
    rowYs[r] = yCursor
    yCursor += rowH[r] + g.levelGap
  }

  const placed: PlacedNode[] = []
  for (let ci = 0; ci < cols.length; ci++) {
    for (let r = 0; r <= maxRow; r++) {
      const ids = cells.get(cell(ci, r))
      if (!ids) continue
      let y = rowYs[r]
      for (const id of ids) {
        const m = measured.get(id)!
        const x = colX[ci] + (colW[ci] - m.w) / 2
        placed.push(placeBox(m.node, m, x, y))
        y += m.totalH + CELL_GAP
      }
    }
  }
  return assemble(chart, placed, hierarchyConnectors(chart, placed), g)
}

/** Swimlane layout: one vertical lane per group (or root subtree). Each lane is
 *  an independent top-to-bottom list of its nodes (DFS order); lanes sit side by
 *  side. The group zones render behind as the labeled lane bands. */
function layoutSwimlane(chart: OrgChart): Layout {
  const g = gapsOf(chart)
  const model = collectVisible(chart, g)
  const { nodes, measured } = model
  if (!nodes.length) return assemble(chart, [], [], g)
  const cols = assignColumns(chart, model)

  const ox = g.canvasPad
  const oy = g.canvasPad + (chart.meta.showTitle && chart.meta.title.trim() ? 44 : 0)
  const laneW = cols.map((c) => Math.max(0, ...c.ids.map((id) => measured.get(id)!.w)))

  const placed: PlacedNode[] = []
  let xCursor = ox
  for (let ci = 0; ci < cols.length; ci++) {
    let y = oy
    for (const id of cols[ci].ids) {
      const m = measured.get(id)!
      const x = xCursor + (laneW[ci] - m.w) / 2
      placed.push(placeBox(m.node, m, x, y))
      y += m.totalH + CELL_GAP
    }
    xCursor += laneW[ci] + COLUMN_GAP
  }
  return assemble(chart, placed, hierarchyConnectors(chart, placed), g)
}

export function layoutChart(chart: OrgChart): Layout {
  const mode = chart.meta.layout ?? 'tree'
  if (mode === 'radial') return layoutRadial(chart)
  if (mode === 'layered') return layoutLayered(chart)
  if (mode === 'matrix') return layoutMatrix(chart)
  if (mode === 'swimlane') return layoutSwimlane(chart)

  const g = gapsOf(chart)
  const dir: Direction = chart.meta.direction ?? 'TB'
  const vertical = dir === 'TB' || dir === 'BT'

  // 1) Lay out every root in logical (main, cross) space.
  const raw: Raw[] = []
  const rawConns: Polyline[] = []
  let crossCursor = 0
  for (const root of chart.roots) {
    const m = measureNode(root, vertical, g)
    placeNode(m, crossCursor, 0, raw, rawConns, g)
    crossCursor += m.subCross + g.rootGap
  }

  // 2) Map logical -> screen for the chosen direction. The title always sits at
  //    the top-left, so content is offset down by its height regardless of flow.
  const ox = g.canvasPad
  const oy = g.canvasPad + (chart.meta.showTitle && chart.meta.title.trim() ? 44 : 0)
  const maxMain = raw.reduce((mx, r) => Math.max(mx, r.main + r.m.mainSize), 0)

  const mapX = (cross: number, main: number) =>
    dir === 'LR' ? ox + main : dir === 'RL' ? ox + (maxMain - main) : ox + cross
  const mapY = (cross: number, main: number) =>
    dir === 'TB' ? oy + main : dir === 'BT' ? oy + (maxMain - main) : oy + cross

  const placed: PlacedNode[] = raw.map((r) => {
    const { m } = r
    // Same transform as the connectors; a flipped axis (BT/RL) references the
    // box's far main edge so its top-left stays on-canvas.
    return {
      node: m.node,
      x: mapX(r.cross, r.main) - (dir === 'RL' ? m.mainSize : 0),
      y: mapY(r.cross, r.main) - (dir === 'BT' ? m.mainSize : 0),
      w: m.w,
      headerH: m.headerH,
      totalH: m.totalH,
      titleLines: m.titleLines,
      leftAlign: m.leftAlign,
      bulletLines: m.bulletLines,
      detailBlocks: m.detailBlocks,
    }
  })

  const connectors: string[] = rawConns.map((poly) =>
    poly
      .map(([c, mn], i) => `${i === 0 ? 'M' : 'L'} ${mapX(c, mn)} ${mapY(c, mn)}`)
      .join(' '),
  )

  // Manual position overrides win over the auto layout; when present, connectors
  // are re-routed to follow the moved boxes.
  const moved = applyOverrides(placed)
  return assemble(chart, placed, moved ? hierarchyConnectors(chart, placed) : connectors, g)
}
