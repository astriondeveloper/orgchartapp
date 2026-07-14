import type { CommLink, Direction, Group, LegendItem, OrgChart, OrgNode } from './model'
import { metrics as M } from './theme'

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

function measureNode(node: OrgNode, vertical: boolean): Measured {
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

  const children = (node.children ?? []).map((c) => measureNode(c, vertical))
  const layoutMode = node.childLayout ?? 'row'
  const levelGap = hidden ? 0 : M.levelGap
  const stackGap = hidden ? 0 : M.stackGap
  const indent = hidden ? 0 : M.stackIndent

  let subCross = crossSize
  let subMain = mainSize
  if (children.length) {
    if (layoutMode === 'stack') {
      const maxChildCross = Math.max(...children.map((c) => c.subCross))
      subCross = Math.max(crossSize, indent + maxChildCross)
      subMain = mainSize + children.reduce((s, c) => s + (stackGap || M.stackGap) + c.subMain, 0)
    } else {
      const rowCross =
        children.reduce((s, c) => s + c.subCross, 0) + M.siblingGap * (children.length - 1)
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
): { center: number } {
  const hidden = m.node.variant === 'hidden'
  const layoutMode = m.node.childLayout ?? 'row'

  let nodeCross = cross + (m.subCross - m.crossSize) / 2
  if (layoutMode === 'stack') nodeCross = cross

  if (m.children.length && layoutMode === 'row') {
    const rowCross =
      m.children.reduce((s, c) => s + c.subCross, 0) + M.siblingGap * (m.children.length - 1)
    let childCross = cross + (m.subCross - rowCross) / 2
    const childMain = main + m.mainSize + (hidden ? 0 : M.levelGap)
    const centers: number[] = []
    for (const c of m.children) {
      const r = placeNode(c, childCross, childMain, raw, conns)
      centers.push(r.center)
      childCross += c.subCross + M.siblingGap
    }
    // Center the parent box over its children's centers.
    const mid = (centers[0] + centers[centers.length - 1]) / 2
    nodeCross = Math.max(cross, Math.min(mid - m.crossSize / 2, cross + m.subCross - m.crossSize))
    if (!hidden) {
      const pc = nodeCross + m.crossSize / 2
      const busMain = main + m.mainSize + M.levelGap / 2
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
    const indent = hidden ? 0 : M.stackIndent
    const spineCross = nodeCross + indent / 2
    let cm = main + m.mainSize + M.stackGap
    let lastMidMain = cm
    for (const c of m.children) {
      placeNode(c, nodeCross + indent, cm, raw, conns)
      lastMidMain = cm + Math.min(c.mainSize || c.subMain, 40) / 2
      if (!hidden) {
        conns.push([
          [spineCross, lastMidMain],
          [nodeCross + indent, lastMidMain],
        ])
      }
      cm += c.subMain + M.stackGap
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

function boxOf(placed: PlacedNode[], id: string): Rect | null {
  const p = placed.find((n) => n.node.id === id)
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

export function layoutChart(chart: OrgChart): Layout {
  const dir: Direction = chart.meta.direction ?? 'TB'
  const vertical = dir === 'TB' || dir === 'BT'

  // 1) Lay out every root in logical (main, cross) space.
  const raw: Raw[] = []
  const rawConns: Polyline[] = []
  let crossCursor = 0
  for (const root of chart.roots) {
    const m = measureNode(root, vertical)
    placeNode(m, crossCursor, 0, raw, rawConns)
    crossCursor += m.subCross + M.rootGap
  }

  // 2) Map logical -> screen for the chosen direction. The title always sits at
  //    the top-left, so content is offset down by its height regardless of flow.
  const ox = M.canvasPad
  const oy = M.canvasPad + (chart.meta.showTitle && chart.meta.title.trim() ? 44 : 0)
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

  // Zones behind member subtrees (computed from final screen rects).
  const zones: Zone[] = []
  for (const g of chart.groups) {
    const ids = new Set<string>()
    for (const memberId of g.memberIds) {
      const node = placed.find((p) => p.node.id === memberId)?.node
      if (node) subtreeIds(node).forEach((i) => ids.add(i))
    }
    const boxes = placed.filter((p) => ids.has(p.node.id))
    if (!boxes.length) continue
    const x1 = Math.min(...boxes.map((b) => b.x)) - M.zonePad
    const y1 = Math.min(...boxes.map((b) => b.y)) - M.zonePad
    const x2 = Math.max(...boxes.map((b) => b.x + b.w)) + M.zonePad
    const y2 = Math.max(...boxes.map((b) => b.y + b.totalH)) + M.zonePad
    zones.push({ group: g, rect: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } })
  }

  // Communication-channel arrows.
  const comms: CommPath[] = []
  for (const link of chart.comms) {
    const a = boxOf(placed, link.fromId)
    const b = boxOf(placed, link.toId)
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
  const minY = ys.length ? Math.min(...ys) : oy

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
    legend = { x: maxX + M.legendGap, y: minY, w, h, items: chart.legend }
  }

  // Headlines render all-caps at size 20 bold; measure that so the accent bar
  // (and the canvas) can size to the actual title width.
  const title =
    chart.meta.showTitle && chart.meta.title.trim()
      ? {
          text: chart.meta.title,
          x: M.canvasPad,
          y: M.canvasPad + 22,
          w: textWidth(chart.meta.title.toUpperCase(), 20, true) * TITLE_BAR_SCALE,
        }
      : null

  const contentRight = legend ? legend.x + legend.w : maxX
  const titleRight = title ? title.x + title.w : 0
  const width = Math.max(contentRight, titleRight) + M.canvasPad
  const height = Math.max(maxY, legend ? legend.y + legend.h : 0) + M.canvasPad

  return { placed, connectors, zones, comms, legend, title, width, height }
}
