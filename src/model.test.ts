import { describe, expect, it } from 'vitest'
import {
  addChild,
  addSibling,
  allNodes,
  deleteNode,
  duplicateNode,
  emptyChart,
  findNode,
  normalizeChart,
  sanitizeColors,
  uid,
} from './model'
import type { OrgChart } from './model'
import { palette } from './theme'

describe('tree editing', () => {
  it('adds a child under a parent', () => {
    const base = emptyChart()
    const rootId = base.roots[0].id
    const { chart, newId } = addChild(base, rootId)
    const parent = findNode(chart, rootId)
    expect(parent?.children?.some((c) => c.id === newId)).toBe(true)
  })

  it('adds a sibling next to a node', () => {
    const base = emptyChart()
    const rootId = base.roots[0].id
    const withChild = addChild(base, rootId)
    const { chart, newId } = addSibling(withChild.chart, withChild.newId)
    const parent = findNode(chart, rootId)
    expect(parent?.children).toHaveLength(2)
    expect(parent?.children?.some((c) => c.id === newId)).toBe(true)
  })
})

describe('duplicateNode', () => {
  it('deep-copies the subtree with fresh ids', () => {
    let base = emptyChart()
    const rootId = base.roots[0].id
    const child = addChild(base, rootId)
    base = child.chart
    const grand = addChild(base, child.newId)
    base = grand.chart

    const { chart, newId } = duplicateNode(base, child.newId)
    expect(newId).not.toBe(child.newId)

    const ids = allNodes(chart).map(({ node }) => node.id)
    // Every id is still unique after duplication (no id collisions).
    expect(new Set(ids).size).toBe(ids.length)
    // Original + copy => the root now has two children, each with one grandchild.
    const parent = findNode(chart, rootId)
    expect(parent?.children).toHaveLength(2)
    expect(parent?.children?.every((c) => c.children?.length === 1)).toBe(true)
  })
})

describe('deleteNode', () => {
  it('removes the node and prunes comms that referenced it', () => {
    let base = emptyChart()
    const rootId = base.roots[0].id
    const a = addChild(base, rootId)
    base = a.chart
    const b = addChild(base, rootId)
    base = b.chart
    base.comms = [{ id: uid('c'), fromId: a.newId, toId: b.newId, twoWay: true }]

    const after = deleteNode(base, b.newId)
    expect(findNode(after, b.newId)).toBeNull()
    expect(after.comms).toHaveLength(0)
  })

  it('never deletes the last remaining root', () => {
    const base = emptyChart()
    const after = deleteNode(base, base.roots[0].id)
    expect(after.roots).toHaveLength(1)
  })
})

describe('sanitizeColors', () => {
  it('keeps brand colors and strips off-brand ones', () => {
    const chart: OrgChart = {
      version: 1,
      meta: { title: 'T', showTitle: true },
      roots: [
        {
          id: 'a',
          title: 'brand',
          variant: 'secondary',
          color: palette.twilight,
          children: [{ id: 'b', title: 'offbrand', variant: 'secondary', color: '#123456' }],
        },
      ],
      groups: [],
      comms: [],
      legend: [],
    }
    const clean = sanitizeColors(chart)
    expect(findNode(clean, 'a')?.color).toBe(palette.twilight)
    expect(findNode(clean, 'b')?.color).toBeUndefined()
  })

  it('matches brand colors case-insensitively', () => {
    const chart: OrgChart = {
      version: 1,
      meta: { title: 'T', showTitle: true },
      roots: [{ id: 'a', title: 'x', variant: 'primary', color: palette.force.toLowerCase() }],
      groups: [],
      comms: [],
      legend: [],
    }
    expect(sanitizeColors(chart).roots[0].color).toBe(palette.force.toLowerCase())
  })
})

describe('normalizeChart', () => {
  it('throws on non-objects and missing roots', () => {
    expect(() => normalizeChart(null)).toThrow()
    expect(() => normalizeChart({})).toThrow()
    expect(() => normalizeChart({ roots: [] })).toThrow()
  })

  it('fills defaults and strips off-brand colors', () => {
    const chart = normalizeChart({
      roots: [{ id: 'a', title: 'A', variant: 'primary', color: '#010203' }],
    })
    expect(chart.version).toBe(1)
    expect(chart.meta).toEqual({ title: 'Org Chart', showTitle: true })
    expect(chart.groups).toEqual([])
    expect(chart.comms).toEqual([])
    expect(chart.legend).toEqual([])
    expect(chart.roots[0].color).toBeUndefined()
  })

  it('preserves a provided title and showTitle=false', () => {
    const chart = normalizeChart({
      meta: { title: 'Mine', showTitle: false },
      roots: [{ id: 'a', title: 'A', variant: 'primary' }],
    })
    expect(chart.meta).toEqual({ title: 'Mine', showTitle: false })
  })
})
