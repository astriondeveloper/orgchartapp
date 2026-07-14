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
  /** Optional width override in px (default from theme metrics). */
  width?: number
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

export interface CommLink {
  id: string
  fromId: string
  toId: string
  twoWay?: boolean
}

export interface LegendItem {
  id: string
  marker: LegendMarker
  label: string
}

export interface OrgChart {
  version: 1
  meta: { title: string; showTitle: boolean }
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
