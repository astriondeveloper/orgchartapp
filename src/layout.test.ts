import { describe, expect, it } from 'vitest'
import { layoutChart, textWidth, wrapText } from './layout'
import type { OrgChart } from './model'
import { templates } from './templates'

describe('text metrics', () => {
  it('measures wider strings as wider', () => {
    expect(textWidth('', 12)).toBe(0)
    expect(textWidth('WWWW', 12)).toBeGreaterThan(textWidth('iiii', 12))
  })

  it('scales with font size', () => {
    expect(textWidth('Astrion', 24)).toBeCloseTo(textWidth('Astrion', 12) * 2, 5)
  })

  it('wraps text that exceeds the max width', () => {
    const long = wrapText('one two three four five six seven eight', 12, 60)
    expect(long.length).toBeGreaterThan(1)
    expect(wrapText('short', 12, 400)).toEqual(['short'])
  })
})

describe('layoutChart', () => {
  it('places nodes and produces positive canvas bounds', () => {
    const layout = layoutChart(templates[0].build())
    expect(layout.placed.length).toBeGreaterThan(0)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('sizes the title accent bar to the title, and hides it when disabled', () => {
    const withTitle = layoutChart(templates[0].build())
    expect(withTitle.title).not.toBeNull()
    expect(withTitle.title!.w).toBeGreaterThan(0)

    const longer: OrgChart = {
      version: 1,
      meta: { title: 'A Considerably Longer Chart Title', showTitle: true },
      roots: [{ id: 'a', title: 'A', variant: 'primary' }],
      groups: [],
      comms: [],
      legend: [],
    }
    const shorter: OrgChart = { ...longer, meta: { title: 'Short', showTitle: true } }
    expect(layoutChart(longer).title!.w).toBeGreaterThan(layoutChart(shorter).title!.w)

    const hidden: OrgChart = { ...longer, meta: { title: 'X', showTitle: false } }
    expect(layoutChart(hidden).title).toBeNull()
  })
})

describe('layout direction', () => {
  const base = (dir?: 'TB' | 'BT' | 'LR' | 'RL'): OrgChart => ({
    version: 1,
    meta: { title: 'Dir', showTitle: true, ...(dir ? { direction: dir } : {}) },
    roots: [
      {
        id: 'root',
        title: 'Root',
        variant: 'primary',
        childLayout: 'row',
        children: [
          { id: 'a', title: 'Alpha', variant: 'secondary' },
          { id: 'b', title: 'Bravo', variant: 'secondary' },
          { id: 'c', title: 'Charlie', variant: 'secondary' },
        ],
      },
    ],
    groups: [],
    comms: [],
    legend: [],
  })
  const byId = (chart: OrgChart, id: string) => {
    const p = layoutChart(chart).placed.find((n) => n.node.id === id)
    if (!p) throw new Error(`missing ${id}`)
    return p
  }
  const overlaps = (chart: OrgChart) => {
    const ps = layoutChart(chart).placed
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]
        const b = ps[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.totalH && b.y < a.y + a.totalH) {
          return `${a.node.id}/${b.node.id}`
        }
      }
    }
    return null
  }

  it('defaults to TB and matches an explicit TB layout', () => {
    const d = layoutChart(base()).placed
    const t = layoutChart(base('TB')).placed
    expect(d.map((p) => [p.node.id, p.x, p.y])).toEqual(t.map((p) => [p.node.id, p.x, p.y]))
  })

  it('never overlaps boxes in any direction', () => {
    for (const dir of ['TB', 'BT', 'LR', 'RL'] as const) {
      expect(overlaps(base(dir))).toBeNull()
    }
  })

  it('flows the parent above children in TB and below in BT', () => {
    expect(byId(base('TB'), 'root').y).toBeLessThan(byId(base('TB'), 'a').y)
    expect(byId(base('BT'), 'root').y).toBeGreaterThan(byId(base('BT'), 'a').y)
  })

  it('flows the parent left of children in LR and right in RL', () => {
    expect(byId(base('LR'), 'root').x).toBeLessThan(byId(base('LR'), 'a').x)
    expect(byId(base('RL'), 'root').x).toBeGreaterThan(byId(base('RL'), 'a').x)
  })

  it('transposes the spread between TB and LR', () => {
    const tb = layoutChart(base('TB'))
    const lr = layoutChart(base('LR'))
    // Siblings spread horizontally in TB (wider) and vertically in LR (taller).
    expect(tb.width).toBeGreaterThan(lr.width)
    expect(lr.height).toBeGreaterThan(tb.height)
  })
})

describe('edges', () => {
  it('resolves each edge to a path with a finite label position', () => {
    const chart: OrgChart = {
      version: 1,
      meta: { title: 'T', showTitle: true },
      roots: [{ id: 'a', title: 'A', variant: 'primary', children: [{ id: 'b', title: 'B', variant: 'secondary' }] }],
      groups: [],
      comms: [{ id: 'e', fromId: 'a', toId: 'b', arrow: 'both', style: 'solid' }],
      legend: [],
    }
    const l = layoutChart(chart)
    expect(l.comms).toHaveLength(1)
    expect(l.comms[0].path.startsWith('M')).toBe(true)
    expect(Number.isFinite(l.comms[0].labelPos.x)).toBe(true)
    expect(Number.isFinite(l.comms[0].labelPos.y)).toBe(true)
  })

  it('drops edges whose endpoints do not exist', () => {
    const chart: OrgChart = {
      version: 1,
      meta: { title: 'T', showTitle: true },
      roots: [{ id: 'a', title: 'A', variant: 'primary' }],
      groups: [],
      comms: [{ id: 'e', fromId: 'a', toId: 'ghost', arrow: 'end', style: 'solid' }],
      legend: [],
    }
    expect(layoutChart(chart).comms).toHaveLength(0)
  })
})

describe('density', () => {
  const build = (density?: 'comfortable' | 'compact'): OrgChart => ({
    version: 1,
    meta: { title: 'D', showTitle: true, ...(density ? { density } : {}) },
    roots: [
      {
        id: 'root',
        title: 'Root',
        variant: 'primary',
        children: [
          { id: 'a', title: 'Alpha', variant: 'secondary', children: [{ id: 'a1', title: 'A1', variant: 'tertiary' }] },
          { id: 'b', title: 'Bravo', variant: 'secondary', children: [{ id: 'b1', title: 'B1', variant: 'tertiary' }] },
        ],
      },
    ],
    groups: [],
    comms: [],
    legend: [],
  })

  it('compact takes up less space than comfortable', () => {
    const comfy = layoutChart(build('comfortable'))
    const compact = layoutChart(build('compact'))
    expect(compact.width).toBeLessThan(comfy.width)
    expect(compact.height).toBeLessThan(comfy.height)
    // Box sizes are unchanged — only the gaps shrink.
    const boxW = (l: typeof comfy, id: string) => l.placed.find((p) => p.node.id === id)!.w
    expect(boxW(compact, 'a')).toBe(boxW(comfy, 'a'))
  })

  it('defaults to comfortable', () => {
    expect(layoutChart(build()).width).toBe(layoutChart(build('comfortable')).width)
  })
})

describe('glossary panel', () => {
  const withGlossary = (glossary: OrgChart['glossary'], glossaryTitle?: string): OrgChart => ({
    version: 1,
    meta: { title: 'G', showTitle: true, ...(glossaryTitle ? { glossaryTitle } : {}) },
    roots: [{ id: 'a', title: 'A', variant: 'primary' }],
    groups: [],
    comms: [],
    legend: [],
    glossary,
  })

  it('is null with no terms and lays out a panel with terms', () => {
    const none = layoutChart(withGlossary([]))
    expect(none.glossary).toBeNull()

    const l = layoutChart(
      withGlossary([
        { id: 't1', term: 'LCAT', definition: 'Labor Category' },
        { id: 't2', term: 'PM', definition: 'Program Manager over the whole program office and its staff' },
      ]),
    )
    expect(l.glossary).not.toBeNull()
    expect(l.glossary!.w).toBeGreaterThan(0)
    expect(l.glossary!.h).toBeGreaterThan(0)
    // First entry starts bold (the term); the long definition wraps past 2 lines.
    expect(l.glossary!.lines.length).toBeGreaterThan(2)
    expect(l.glossary!.lines[0].boldLen).toBeGreaterThan(0)
    // The canvas widens to include the panel.
    expect(l.width).toBeGreaterThan(none.width)
  })

  it('defaults the heading to "Glossary" and honors a custom one', () => {
    expect(layoutChart(withGlossary([{ id: 't1', term: 'X', definition: 'Y' }])).glossary!.title).toBe('Glossary')
    expect(
      layoutChart(withGlossary([{ id: 't1', term: 'X', definition: 'Y' }], 'Acronyms')).glossary!.title,
    ).toBe('Acronyms')
  })
})

describe('size overrides', () => {
  const build = (over: { width?: number; height?: number }): OrgChart => ({
    version: 1,
    meta: { title: 'S', showTitle: true },
    roots: [{ id: 'a', title: 'Alpha', variant: 'primary', ...over }],
    groups: [],
    comms: [],
    legend: [],
  })
  const box = (chart: OrgChart) => layoutChart(chart).placed.find((p) => p.node.id === 'a')!

  it('applies a width override to the placed box', () => {
    expect(box(build({ width: 320 })).w).toBe(320)
    expect(box(build({})).w).toBeLessThan(320)
  })

  it('grows a box to an explicit height override', () => {
    const natural = box(build({})).headerH
    const tall = box(build({ height: natural + 100 }))
    expect(tall.headerH).toBe(natural + 100)
    expect(tall.totalH).toBeGreaterThan(natural)
  })

  it('never shrinks a box below the height its text needs', () => {
    const natural = box(build({})).headerH
    // A height override smaller than the natural content height is ignored, so
    // a proposal box can never clip a name.
    expect(box(build({ height: 1 })).headerH).toBe(natural)
  })
})

describe('manual position overrides', () => {
  const chartWith = (pos?: { x: number; y: number }): OrgChart => ({
    version: 1,
    meta: { title: 'P', showTitle: true },
    roots: [
      {
        id: 'root',
        title: 'Root',
        variant: 'primary',
        children: [
          { id: 'a', title: 'Alpha', variant: 'secondary', ...(pos ? { pos } : {}) },
          { id: 'b', title: 'Bravo', variant: 'secondary' },
        ],
      },
    ],
    groups: [],
    comms: [],
    legend: [],
  })

  it('places an overridden box at its manual position', () => {
    const l = layoutChart(chartWith({ x: 600, y: 500 }))
    const a = l.placed.find((p) => p.node.id === 'a')!
    expect(a.x).toBe(600)
    expect(a.y).toBe(500)
    // The un-moved sibling keeps its auto position.
    const auto = layoutChart(chartWith()).placed.find((p) => p.node.id === 'b')!
    const b = l.placed.find((p) => p.node.id === 'b')!
    expect(b.x).toBe(auto.x)
    expect(b.y).toBe(auto.y)
  })

  it('re-routes connectors to follow a moved box and grows the canvas', () => {
    const base = layoutChart(chartWith())
    const moved = layoutChart(chartWith({ x: 900, y: 700 }))
    // Every connector is still a valid path.
    expect(moved.connectors.every((d) => d.startsWith('M'))).toBe(true)
    expect(moved.connectors.length).toBeGreaterThan(0)
    // The canvas expands to include the box dragged down-right.
    expect(moved.width).toBeGreaterThan(base.width)
    expect(moved.height).toBeGreaterThan(base.height)
  })

  it('honors an override in radial mode and keeps the spokes valid', () => {
    const radialMoved: OrgChart = {
      version: 1,
      meta: { title: 'P', showTitle: true, layout: 'radial' },
      roots: [
        {
          id: 'root',
          title: 'Root',
          variant: 'primary',
          children: [
            { id: 'a', title: 'Alpha', variant: 'secondary', pos: { x: 800, y: 600 } },
            { id: 'b', title: 'Bravo', variant: 'secondary' },
          ],
        },
      ],
      groups: [],
      comms: [],
      legend: [],
    }
    const l = layoutChart(radialMoved)
    const a = l.placed.find((p) => p.node.id === 'a')!
    expect(a.x).toBe(800)
    expect(a.y).toBe(600)
    expect(l.connectors.every((d) => d.startsWith('M'))).toBe(true)
    expect(l.width).toBeGreaterThan(800)
  })
})

describe('layered layout', () => {
  const layered = (comms: OrgChart['comms'] = []): OrgChart => ({
    version: 1,
    meta: { title: 'L', showTitle: true, layout: 'layered' },
    roots: [
      {
        id: 'root',
        title: 'Root',
        variant: 'primary',
        children: [
          { id: 'a', title: 'A', variant: 'secondary', children: [{ id: 'a1', title: 'A1', variant: 'tertiary' }] },
          { id: 'b', title: 'B', variant: 'secondary', children: [{ id: 'b1', title: 'B1', variant: 'tertiary' }] },
        ],
      },
    ],
    groups: [],
    comms,
    legend: [],
  })

  it('ranks nodes into depth-aligned rows', () => {
    const l = layoutChart(layered())
    const y = (id: string) => l.placed.find((p) => p.node.id === id)!.y
    // Same depth => same row (identical y); deeper => strictly lower.
    expect(y('a')).toBe(y('b'))
    expect(y('a1')).toBe(y('b1'))
    expect(y('root')).toBeLessThan(y('a'))
    expect(y('a')).toBeLessThan(y('a1'))
    expect(l.placed).toHaveLength(5)
    expect(l.connectors.length).toBeGreaterThan(0)
    expect(l.width).toBeGreaterThan(0)
    expect(l.height).toBeGreaterThan(0)
  })

  it('centers a parent over its children', () => {
    const l = layoutChart(layered())
    const mid = (id: string) => {
      const p = l.placed.find((n) => n.node.id === id)!
      return p.x + p.w / 2
    }
    // Root sits between its two subtrees; A above A1, B above B1.
    expect(mid('root')).toBeGreaterThan(mid('a') - 1)
    expect(mid('root')).toBeLessThan(mid('b') + 1)
    expect(Math.abs(mid('a') - mid('a1'))).toBeLessThan(2)
  })

  it('stays finite with a cross-link comm', () => {
    const l = layoutChart(layered([{ id: 'e', fromId: 'a1', toId: 'b1', arrow: 'end', style: 'solid' }]))
    expect(l.placed.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(l.comms).toHaveLength(1)
  })
})

describe('matrix and swimlane layouts', () => {
  const grouped = (layout: 'matrix' | 'swimlane'): OrgChart => ({
    version: 1,
    meta: { title: 'G', showTitle: true, layout },
    roots: [
      {
        id: 'ceo',
        title: 'CEO',
        variant: 'primary',
        children: [
          { id: 'eng', title: 'Eng', variant: 'secondary', children: [{ id: 'eng1', title: 'Eng1', variant: 'tertiary' }] },
          { id: 'sales', title: 'Sales', variant: 'secondary', children: [{ id: 'sales1', title: 'Sales1', variant: 'tertiary' }] },
        ],
      },
    ],
    groups: [
      { id: 'g1', label: 'Engineering', style: 'blue', memberIds: ['eng'] },
      { id: 'g2', label: 'Sales', style: 'green', memberIds: ['sales'] },
    ],
    comms: [],
    legend: [],
  })

  it('matrix separates groups into columns and depth into rows', () => {
    const l = layoutChart(grouped('matrix'))
    const p = (id: string) => l.placed.find((n) => n.node.id === id)!
    expect(l.placed).toHaveLength(5)
    // Eng subtree is left of the Sales subtree (distinct columns).
    expect(p('eng').x).toBeLessThan(p('sales').x)
    expect(p('eng1').x).toBeLessThan(p('sales1').x)
    // Depth increases downward: a child sits below its parent's row.
    expect(p('eng').y).toBeLessThan(p('eng1').y)
    expect(l.connectors.length).toBeGreaterThan(0)
  })

  it('swimlane stacks each group into its own lane', () => {
    const l = layoutChart(grouped('swimlane'))
    const p = (id: string) => l.placed.find((n) => n.node.id === id)!
    // Eng lane sits entirely left of the Sales lane.
    expect(Math.max(p('eng').x + p('eng').w, p('eng1').x + p('eng1').w)).toBeLessThanOrEqual(
      Math.min(p('sales').x, p('sales1').x),
    )
    // Within a lane, nodes stack vertically (no horizontal offset by depth).
    expect(p('eng').x).toBe(p('eng1').x)
    expect(p('eng').y).toBeLessThan(p('eng1').y)
    expect(l.placed.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
  })

  it('falls back to per-root columns when no groups are defined', () => {
    const chart = grouped('matrix')
    chart.groups = []
    const l = layoutChart(chart)
    expect(l.placed).toHaveLength(5)
    expect(l.placed.every((n) => Number.isFinite(n.x))).toBe(true)
  })
})

describe('radial layout', () => {
  const radial = (): OrgChart => ({
    version: 1,
    meta: { title: 'R', showTitle: true, layout: 'radial' },
    roots: [
      {
        id: 'root',
        title: 'Root',
        variant: 'primary',
        children: [
          { id: 'a', title: 'A', variant: 'secondary' },
          { id: 'b', title: 'B', variant: 'secondary' },
          { id: 'c', title: 'C', variant: 'secondary' },
          { id: 'd', title: 'D', variant: 'secondary' },
        ],
      },
    ],
    groups: [],
    comms: [],
    legend: [],
  })

  it('places every node with finite bounds', () => {
    const l = layoutChart(radial())
    expect(l.placed).toHaveLength(5)
    expect(l.placed.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(l.width).toBeGreaterThan(0)
    expect(l.height).toBeGreaterThan(0)
    expect(l.connectors).toHaveLength(4)
  })

  it('surrounds the root: children sit on more than one side of it', () => {
    const l = layoutChart(radial())
    const root = l.placed.find((p) => p.node.id === 'root')!
    const rcx = root.x + root.w / 2
    const rcy = root.y + root.totalH / 2
    const kids = l.placed.filter((p) => p.node.id !== 'root').map((p) => ({
      dx: p.x + p.w / 2 - rcx,
      dy: p.y + p.totalH / 2 - rcy,
    }))
    // Radial spreads children around the center, not all on one side.
    expect(kids.some((k) => k.dx > 0)).toBe(true)
    expect(kids.some((k) => k.dx < 0)).toBe(true)
  })

  it('keeps all boxes within the canvas padding', () => {
    const l = layoutChart(radial())
    expect(Math.min(...l.placed.map((p) => p.x))).toBeGreaterThanOrEqual(0)
    expect(Math.min(...l.placed.map((p) => p.y))).toBeGreaterThanOrEqual(0)
  })
})
