import type { CommLink, Group, LegendItem, OrgChart, OrgNode } from './model'
import { metrics as M } from './theme'

/*
 * Deterministic layout engine. Pure functions: the same OrgChart always
 * produces the same geometry, so proposal charts are perfectly repeatable.
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
  title: { text: string; x: number; y: number } | null
  width: number
  height: number
}

/* ---------------------------------------------------------- text metrics */

const NARROW = new Set([...`iIljtfr.,;:!'"()[]|/ `])
const WIDE = new Set([...'mwMW@%&'])

export function textWidth(s: string, size: number, bold = false): number {
  let w = 0
  for (const ch of s) {
    if (NARROW.has(ch)) w += 0.32
    else if (WIDE.has(ch)) w += 0.88
    else if (ch >= 'A' && ch <= 'Z') w += 0.72
    else if (ch >= '0' && ch <= '9') w += 0.58
    else w += 0.53
  }
  return w * size * (bold ? 1.07 : 1)
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
  /** Full subtree extent. */
  subW: number
  subH: number
}

function measureNode(node: OrgNode): Measured {
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

  const children = (node.children ?? []).map(measureNode)
  const layoutMode = node.childLayout ?? 'row'
  const levelGap = hidden ? 0 : M.levelGap
  const stackGap = hidden ? 0 : M.stackGap
  const indent = hidden ? 0 : M.stackIndent

  let subW = w
  let subH = totalH
  if (children.length) {
    if (layoutMode === 'stack') {
      const maxChildW = Math.max(...children.map((c) => c.subW))
      subW = Math.max(w, indent + maxChildW)
      subH = totalH + children.reduce((s, c) => s + (stackGap || M.stackGap) + c.subH, 0)
      if (hidden) subH -= 0 // hidden stacks still use stackGap between items
    } else {
      const rowW =
        children.reduce((s, c) => s + c.subW, 0) + M.siblingGap * (children.length - 1)
      subW = Math.max(w, rowW)
      subH = totalH + levelGap + Math.max(...children.map((c) => c.subH))
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
    subW,
    subH,
  }
}

/* --------------------------------------------------------------- placing */

function placeNode(
  m: Measured,
  left: number,
  y: number,
  placed: PlacedNode[],
  connectors: string[],
): { cx: number } {
  const hidden = m.node.variant === 'hidden'
  const layoutMode = m.node.childLayout ?? 'row'

  let nodeX = left + (m.subW - m.w) / 2
  if (layoutMode === 'stack') nodeX = left

  if (m.children.length && layoutMode === 'row') {
    const rowW =
      m.children.reduce((s, c) => s + c.subW, 0) + M.siblingGap * (m.children.length - 1)
    let childLeft = left + (m.subW - rowW) / 2
    const childY = y + m.totalH + (hidden ? 0 : M.levelGap)
    const centers: number[] = []
    for (const c of m.children) {
      const r = placeNode(c, childLeft, childY, placed, connectors)
      centers.push(r.cx)
      childLeft += c.subW + M.siblingGap
    }
    // Center the parent box over its children's centers.
    const mid = (centers[0] + centers[centers.length - 1]) / 2
    nodeX = Math.max(left, Math.min(mid - m.w / 2, left + m.subW - m.w))
    if (!hidden) {
      const pcx = nodeX + m.w / 2
      const busY = y + m.totalH + M.levelGap / 2
      connectors.push(`M ${pcx} ${y + m.totalH} V ${busY}`)
      if (centers.length > 1 || Math.abs(centers[0] - pcx) > 0.5) {
        const minX = Math.min(pcx, ...centers)
        const maxX = Math.max(pcx, ...centers)
        connectors.push(`M ${minX} ${busY} H ${maxX}`)
      }
      for (const cx of centers) connectors.push(`M ${cx} ${busY} V ${childY}`)
    }
  } else if (m.children.length && layoutMode === 'stack') {
    const indent = hidden ? 0 : M.stackIndent
    const spineX = nodeX + indent / 2
    let cy = y + m.totalH + M.stackGap
    let lastMidY = cy
    for (const c of m.children) {
      placeNode(c, nodeX + indent, cy, placed, connectors)
      lastMidY = cy + Math.min(c.headerH || c.totalH, 40) / 2
      if (!hidden) connectors.push(`M ${spineX} ${lastMidY} H ${nodeX + indent}`)
      cy += c.subH + M.stackGap
    }
    if (!hidden) connectors.push(`M ${spineX} ${y + m.totalH} V ${lastMidY}`)
  }

  if (!hidden) {
    placed.push({
      node: m.node,
      x: nodeX,
      y,
      w: m.w,
      headerH: m.headerH,
      totalH: m.totalH,
      titleLines: m.titleLines,
      leftAlign: m.leftAlign,
      bulletLines: m.bulletLines,
      detailBlocks: m.detailBlocks,
    })
  }
  return { cx: nodeX + (m.w || m.subW) / 2 }
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

export function layoutChart(chart: OrgChart): Layout {
  const placed: PlacedNode[] = []
  const connectors: string[] = []

  let left = M.canvasPad
  let topY = M.canvasPad
  if (chart.meta.showTitle && chart.meta.title.trim()) topY += 44

  for (const root of chart.roots) {
    const m = measureNode(root)
    placeNode(m, left, topY, placed, connectors)
    left += m.subW + M.rootGap
  }

  // Zones behind member subtrees.
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
    if (a && b) comms.push({ link, path: routeComm(a, b) })
  }

  // Content bounds.
  const xs = placed.map((p) => p.x).concat(zones.map((z) => z.rect.x))
  const ys = placed.map((p) => p.y).concat(zones.map((z) => z.rect.y))
  const x2s = placed.map((p) => p.x + p.w).concat(zones.map((z) => z.rect.x + z.rect.w))
  const y2s = placed
    .map((p) => p.y + p.totalH)
    .concat(zones.map((z) => z.rect.y + z.rect.h))
  const maxX = x2s.length ? Math.max(...x2s) : 400
  const maxY = y2s.length ? Math.max(...y2s) : 300
  const minY = ys.length ? Math.min(...ys) : M.canvasPad
  void xs

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

  const title =
    chart.meta.showTitle && chart.meta.title.trim()
      ? { text: chart.meta.title, x: M.canvasPad, y: M.canvasPad + 22 }
      : null

  const width = (legend ? legend.x + legend.w : maxX) + M.canvasPad
  const height = Math.max(maxY, legend ? legend.y + legend.h : 0) + M.canvasPad

  return { placed, connectors, zones, comms, legend, title, width, height }
}
