import { palette } from './theme'
import type { ZoneStyle } from './theme'

/** Semantic box style. 'hidden' is an invisible container used to build
 *  free-standing columns (no box is drawn; children are laid out from it). */
export type Variant = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'hidden'

export type BadgeType = 'keyGold' | 'keyGray' | 'cornerAccent'

export type LegendMarker =
  | 'keyGold'
  | 'keyGray'
  | 'cornerAccent'
  | 'boxPrimary'
  | 'boxSecondary'
  | 'boxTertiary'
  | 'boxAccent'
  | 'green'
  | 'blue'
  | 'orange'
  | 'dashed'
  | 'comm'

export interface DetailRow {
  /** Bold prefix, e.g. "PWS:", "Deliverables:", "Interface:". */
  label: string
  text: string
}

export interface OrgNode {
  id: string
  title: string
  /** Person name shown in italics under the title. */
  name?: string
  /** Draw a photo placeholder silhouette. */
  photo?: boolean
  bullets?: string[]
  /** White detail rows attached under the box (PWS / Deliverables / ...). */
  details?: DetailRow[]
  badges?: BadgeType[]
  variant: Variant
  /** Optional fill override (hex). Wins over the variant color; text color is
   *  picked automatically for contrast. Clear it to fall back to the variant. */
  color?: string
  /** Optional width override in px (default from theme metrics). */
  width?: number
  /** Manual position override (top-left, in the layout's screen coordinates).
   *  Set by dragging the box on the canvas; clearing it restores auto-layout. */
  pos?: { x: number; y: number }
  /** How this node's children are arranged. */
  childLayout?: 'row' | 'stack'
  children?: OrgNode[]
}

export interface Group {
  id: string
  label?: string
  style: ZoneStyle
  memberIds: string[]
}

export type EdgeStyle = 'solid' | 'dashed'
/** Which ends carry an arrowhead. */
export type EdgeArrow = 'none' | 'start' | 'end' | 'both'

export interface CommLink {
  id: string
  fromId: string
  toId: string
  /** @deprecated superseded by `arrow`; still read from older files. */
  twoWay?: boolean
  style?: EdgeStyle
  arrow?: EdgeArrow
  label?: string
}

/** Resolve an edge's arrowheads, honoring the legacy `twoWay` flag. */
export function edgeArrow(e: CommLink): EdgeArrow {
  if (e.arrow === 'none' || e.arrow === 'start' || e.arrow === 'end' || e.arrow === 'both') {
    return e.arrow
  }
  return e.twoWay === false ? 'end' : 'both'
}

/** Normalize an edge to the current shape: migrate `twoWay` to `arrow`,
 *  validate `style`, and keep a non-empty label. */
function normalizeEdge(e: CommLink): CommLink {
  const out: CommLink = {
    id: e.id,
    fromId: e.fromId,
    toId: e.toId,
    arrow: edgeArrow(e),
    style: e.style === 'dashed' ? 'dashed' : 'solid',
  }
  if (typeof e.label === 'string' && e.label.trim()) out.label = e.label
  return out
}

export interface LegendItem {
  id: string
  marker: LegendMarker
  label: string
}

/** Flow direction of the auto-layout: top-down, bottom-up, left-right, right-left. */
export type Direction = 'TB' | 'BT' | 'LR' | 'RL'

/** Auto-layout strategy:
 *  - 'tree'     tidy-tree hierarchy (honors a Direction)
 *  - 'radial'   root at the center, descendants on concentric rings
 *  - 'layered'  depth-aligned rows (Sugiyama-lite), cross-links pulled together
 *  - 'matrix'   2D grid: rows = depth, columns = group (or root)
 *  - 'swimlane' independent vertical lanes, one per group (or root) */
export type LayoutMode = 'tree' | 'radial' | 'layered' | 'matrix' | 'swimlane'

/** Spacing density. 'compact' tightens the gaps so the chart takes up less
 *  room on a page (box interiors are unchanged). */
export type Density = 'comfortable' | 'compact'

export interface OrgChart {
  version: 1
  meta: { title: string; showTitle: boolean; direction?: Direction; layout?: LayoutMode; density?: Density }
  /** Independent trees/columns laid out left to right. */
  roots: OrgNode[]
  groups: Group[]
  comms: CommLink[]
  legend: LegendItem[]
}

let counter = 0
export function uid(prefix = 'n'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

export function emptyChart(): OrgChart {
  return {
    version: 1,
    meta: { title: 'New Org Chart', showTitle: true },
    roots: [
      {
        id: uid(),
        title: 'Program Manager',
        variant: 'primary',
        childLayout: 'row',
        children: [],
      },
    ],
    groups: [],
    comms: [],
    legend: [],
  }
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

/** Depth-first visit over every node in the chart. */
export function visit(
  roots: OrgNode[],
  fn: (node: OrgNode, parent: OrgNode | null, depth: number) => void,
): void {
  const walk = (n: OrgNode, parent: OrgNode | null, depth: number) => {
    fn(n, parent, depth)
    for (const c of n.children ?? []) walk(c, n, depth + 1)
  }
  for (const r of roots) walk(r, null, 0)
}

export function allNodes(chart: OrgChart): { node: OrgNode; depth: number }[] {
  const out: { node: OrgNode; depth: number }[] = []
  visit(chart.roots, (node, _p, depth) => out.push({ node, depth }))
  return out
}

/** The complete set of on-brand fill values (uppercased for comparison). */
const BRAND_COLORS = new Set<string>(Object.values(palette).map((c) => c.toUpperCase()))

/**
 * Drop any box `color` override that is not an Astrion brand color, so a chart
 * can never render off-brand — even when hand-edited via the JSON tab or loaded
 * from an imported/older file. Mutates the passed chart (callers pass a freshly
 * parsed object) and returns it.
 */
export function sanitizeColors(chart: OrgChart): OrgChart {
  visit(chart.roots, (n) => {
    if (n.color && !BRAND_COLORS.has(n.color.toUpperCase())) delete n.color
  })
  return chart
}

/**
 * Drop any malformed manual position (missing or non-finite coordinates) from
 * an untrusted chart, so the layout engine never receives NaN geometry from a
 * hand-edited JSON tab or an imported file. Mutates and returns the chart.
 */
export function sanitizePositions(chart: OrgChart): OrgChart {
  visit(chart.roots, (n) => {
    const p = n.pos
    if (p && !(Number.isFinite(p.x) && Number.isFinite(p.y))) delete n.pos
  })
  return chart
}

export function findNode(chart: OrgChart, id: string): OrgNode | null {
  let found: OrgNode | null = null
  visit(chart.roots, (n) => {
    if (n.id === id) found = n
  })
  return found
}

/** Returns the array containing the node and its index (roots array for top level). */
export function findContainer(
  chart: OrgChart,
  id: string,
): { list: OrgNode[]; index: number; parent: OrgNode | null } | null {
  const idx = chart.roots.findIndex((r) => r.id === id)
  if (idx >= 0) return { list: chart.roots, index: idx, parent: null }
  let result: { list: OrgNode[]; index: number; parent: OrgNode | null } | null = null
  visit(chart.roots, (n) => {
    const children = n.children ?? []
    const i = children.findIndex((c) => c.id === id)
    if (i >= 0 && !result) result = { list: children, index: i, parent: n }
  })
  return result
}

/** All mutation helpers clone the chart so React state stays immutable. */
export function updateNode(chart: OrgChart, id: string, patch: Partial<OrgNode>): OrgChart {
  const next = clone(chart)
  const n = findNode(next, id)
  if (n) Object.assign(n, patch)
  return next
}

export function addChild(chart: OrgChart, parentId: string): { chart: OrgChart; newId: string } {
  const next = clone(chart)
  const parent = findNode(next, parentId)
  const newId = uid()
  if (parent) {
    parent.children = parent.children ?? []
    parent.children.push({ id: newId, title: 'New Box', variant: 'secondary', childLayout: 'row' })
  }
  return { chart: next, newId }
}

export function addSibling(chart: OrgChart, id: string): { chart: OrgChart; newId: string } {
  const next = clone(chart)
  const loc = findContainer(next, id)
  const newId = uid()
  if (loc) {
    const ref = loc.list[loc.index]
    loc.list.splice(loc.index + 1, 0, {
      id: newId,
      title: 'New Box',
      variant: ref.variant === 'hidden' ? 'secondary' : ref.variant,
      childLayout: 'row',
    })
  }
  return { chart: next, newId }
}

export function addRoot(chart: OrgChart): { chart: OrgChart; newId: string } {
  const next = clone(chart)
  const newId = uid()
  next.roots.push({ id: newId, title: 'New Tree', variant: 'primary', childLayout: 'row' })
  return { chart: next, newId }
}

export function deleteNode(chart: OrgChart, id: string): OrgChart {
  const next = clone(chart)
  const loc = findContainer(next, id)
  if (loc && !(loc.parent === null && next.roots.length === 1)) {
    loc.list.splice(loc.index, 1)
  }
  // Clean up references in groups/comms.
  const gone = new Set<string>()
  const known = new Set<string>()
  visit(next.roots, (n) => known.add(n.id))
  visit(chart.roots, (n) => {
    if (!known.has(n.id)) gone.add(n.id)
  })
  next.groups = next.groups.map((g) => ({
    ...g,
    memberIds: g.memberIds.filter((m) => !gone.has(m)),
  }))
  next.comms = next.comms.filter((c) => !gone.has(c.fromId) && !gone.has(c.toId))
  return next
}

/** Set or clear a node's manual position override (top-left in layout coords). */
export function setNodePos(
  chart: OrgChart,
  id: string,
  pos: { x: number; y: number } | null,
): OrgChart {
  const next = clone(chart)
  const n = findNode(next, id)
  if (n) {
    if (pos) n.pos = { x: pos.x, y: pos.y }
    else delete n.pos
  }
  return next
}

export function moveNode(chart: OrgChart, id: string, dir: -1 | 1): OrgChart {
  const next = clone(chart)
  const loc = findContainer(next, id)
  if (!loc) return chart
  const j = loc.index + dir
  if (j < 0 || j >= loc.list.length) return chart
  const [n] = loc.list.splice(loc.index, 1)
  loc.list.splice(j, 0, n)
  return next
}

/** Deep-copy a subtree, assigning fresh ids to every node. */
function copyWithNewIds(node: OrgNode): OrgNode {
  return {
    ...clone(node),
    id: uid(),
    children: (node.children ?? []).map(copyWithNewIds),
  }
}

/** Duplicate a node (and its whole subtree) as the next sibling. */
export function duplicateNode(chart: OrgChart, id: string): { chart: OrgChart; newId: string } {
  const next = clone(chart)
  const loc = findContainer(next, id)
  if (!loc) return { chart, newId: id }
  const copy = copyWithNewIds(loc.list[loc.index])
  loc.list.splice(loc.index + 1, 0, copy)
  return { chart: next, newId: copy.id }
}

/** Current chart schema version. Bump when the shape changes and add a branch
 *  in {@link normalizeChart} to migrate older documents forward. */
export const CHART_VERSION = 1

/**
 * Validate and normalize an untrusted chart (from localStorage, an imported
 * file, or the JSON tab): fill defaults, coerce the shape, migrate old versions
 * forward, and strip off-brand colors. Throws a clear message on invalid input.
 */
export function normalizeChart(input: unknown): OrgChart {
  if (!input || typeof input !== 'object') throw new Error('Not a chart object.')
  const c = input as Partial<OrgChart> & { meta?: Partial<OrgChart['meta']> }
  if (!Array.isArray(c.roots) || c.roots.length === 0) {
    throw new Error('Missing a non-empty "roots" array.')
  }
  const dir = c.meta?.direction
  const dirOk = dir === 'TB' || dir === 'BT' || dir === 'LR' || dir === 'RL'
  const layout = c.meta?.layout
  const LAYOUTS = ['tree', 'radial', 'layered', 'matrix', 'swimlane']
  const layoutOk = typeof layout === 'string' && LAYOUTS.includes(layout)
  const density = c.meta?.density
  const densityOk = density === 'comfortable' || density === 'compact'
  const chart: OrgChart = {
    version: CHART_VERSION,
    meta: {
      title: typeof c.meta?.title === 'string' ? c.meta.title : 'Org Chart',
      showTitle: c.meta?.showTitle !== false,
      ...(dirOk ? { direction: dir } : {}),
      ...(layoutOk ? { layout } : {}),
      ...(densityOk ? { density } : {}),
    },
    roots: c.roots as OrgNode[],
    groups: Array.isArray(c.groups) ? c.groups : [],
    comms: Array.isArray(c.comms) ? c.comms.map(normalizeEdge) : [],
    legend: Array.isArray(c.legend) ? c.legend : [],
  }
  return sanitizePositions(sanitizeColors(chart))
}
