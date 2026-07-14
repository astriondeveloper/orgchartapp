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
