import { describe, expect, it } from 'vitest'
import {
  addChild,
  addSibling,
  allNodes,
  deleteNode,
  duplicateNode,
  edgeArrow,
  emptyChart,
  findNode,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
  normalizeChart,
  sanitizeColors,
  setNodePos,
  setNodeSize,
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

describe('setNodePos', () => {
  it('sets and clears a manual position without touching other nodes', () => {
    const base = emptyChart()
    const id = base.roots[0].id
    const moved = setNodePos(base, id, { x: 120, y: 40 })
    expect(findNode(moved, id)?.pos).toEqual({ x: 120, y: 40 })
    const cleared = setNodePos(moved, id, null)
    expect(findNode(cleared, id)?.pos).toBeUndefined()
    // Original chart is never mutated.
    expect(findNode(base, id)?.pos).toBeUndefined()
  })
})

describe('setNodeSize', () => {
  it('sets width and height independently and clamps to the minimums', () => {
    const base = emptyChart()
    const id = base.roots[0].id
    const wide = setNodeSize(base, id, { width: 300 })
    expect(findNode(wide, id)?.width).toBe(300)
    // Height was not passed, so it stays untouched (undefined).
    expect(findNode(wide, id)?.height).toBeUndefined()

    const tall = setNodeSize(wide, id, { height: 120 })
    expect(findNode(tall, id)?.width).toBe(300)
    expect(findNode(tall, id)?.height).toBe(120)

    // Below-minimum values are clamped, not rejected.
    const tiny = setNodeSize(base, id, { width: 5, height: 1 })
    expect(findNode(tiny, id)?.width).toBe(MIN_BOX_WIDTH)
    expect(findNode(tiny, id)?.height).toBe(MIN_BOX_HEIGHT)
  })

  it('clears a dimension with null and leaves an omitted one alone', () => {
    const base = setNodeSize(emptyChart(), emptyChart().roots[0].id, {})
    const id = base.roots[0].id
    const sized = setNodeSize(base, id, { width: 240, height: 90 })
    const clearedW = setNodeSize(sized, id, { width: null })
    expect(findNode(clearedW, id)?.width).toBeUndefined()
    expect(findNode(clearedW, id)?.height).toBe(90)
    // The source chart is never mutated.
    expect(findNode(sized, id)?.width).toBe(240)
  })
})

describe('normalizeChart', () => {
  it('drops malformed size overrides', () => {
    const chart = normalizeChart({
      roots: [
        { id: 'a', title: 'A', variant: 'primary', width: 200, height: 80 },
        { id: 'b', title: 'B', variant: 'primary', width: Number.NaN, height: -5 },
        { id: 'c', title: 'C', variant: 'primary', width: 0 },
      ],
    })
    expect(findNode(chart, 'a')?.width).toBe(200)
    expect(findNode(chart, 'a')?.height).toBe(80)
    expect(findNode(chart, 'b')?.width).toBeUndefined()
    expect(findNode(chart, 'b')?.height).toBeUndefined()
    expect(findNode(chart, 'c')?.width).toBeUndefined()
  })

  it('drops a manual position with non-finite coordinates', () => {
    const chart = normalizeChart({
      roots: [
        { id: 'a', title: 'A', variant: 'primary', pos: { x: 10, y: 20 } },
        { id: 'b', title: 'B', variant: 'primary', pos: { x: Number.NaN, y: 5 } },
        { id: 'c', title: 'C', variant: 'primary', pos: { x: 5 } },
      ],
    })
    expect(findNode(chart, 'a')?.pos).toEqual({ x: 10, y: 20 })
    expect(findNode(chart, 'b')?.pos).toBeUndefined()
    expect(findNode(chart, 'c')?.pos).toBeUndefined()
  })

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

describe('glossary', () => {
  it('defaults glossary to an empty array when absent', () => {
    const chart = normalizeChart({ roots: [{ id: 'a', title: 'A', variant: 'primary' }] })
    expect(chart.glossary).toEqual([])
  })

  it('keeps valid terms, drops empty/garbage, and assigns a missing id', () => {
    const chart = normalizeChart({
      roots: [{ id: 'a', title: 'A', variant: 'primary' }],
      glossary: [
        { id: 't1', term: 'LCAT', definition: 'Labor Category' },
        { term: 'PM', definition: 'Program Manager' }, // missing id
        { term: '   ', definition: '  ' }, // blank -> dropped
        'nope', // not an object -> dropped
      ],
    })
    expect(chart.glossary).toHaveLength(2)
    expect(chart.glossary?.[0]).toEqual({ id: 't1', term: 'LCAT', definition: 'Labor Category' })
    expect(chart.glossary?.[1].term).toBe('PM')
    expect(chart.glossary?.[1].id).toBeTruthy()
  })

  it('preserves a custom glossary heading', () => {
    const chart = normalizeChart({
      meta: { title: 'T', showTitle: true, glossaryTitle: 'Acronyms' },
      roots: [{ id: 'a', title: 'A', variant: 'primary' }],
    })
    expect(chart.meta.glossaryTitle).toBe('Acronyms')
  })
})

describe('edges', () => {
  it('edgeArrow migrates twoWay and honors an explicit arrow', () => {
    expect(edgeArrow({ id: 'e', fromId: 'a', toId: 'b' })).toBe('both')
    expect(edgeArrow({ id: 'e', fromId: 'a', toId: 'b', twoWay: false })).toBe('end')
    expect(edgeArrow({ id: 'e', fromId: 'a', toId: 'b', twoWay: true })).toBe('both')
    expect(edgeArrow({ id: 'e', fromId: 'a', toId: 'b', arrow: 'start' })).toBe('start')
  })

  it('normalizeChart migrates legacy edges and validates fields', () => {
    const chart = normalizeChart({
      roots: [
        { id: 'a', title: 'A', variant: 'primary' },
        { id: 'b', title: 'B', variant: 'primary' },
      ],
      comms: [
        { id: 'e1', fromId: 'a', toId: 'b', twoWay: false },
        { id: 'e2', fromId: 'a', toId: 'b', style: 'weird', arrow: 'nope', label: '   ' },
        { id: 'e3', fromId: 'a', toId: 'b', style: 'dashed', arrow: 'start', label: 'reports' },
      ],
    })
    expect(chart.comms[0]).toMatchObject({ arrow: 'end', style: 'solid' })
    expect(chart.comms[0].label).toBeUndefined()
    // Invalid style/arrow fall back to defaults; blank label is dropped.
    expect(chart.comms[1]).toMatchObject({ arrow: 'both', style: 'solid' })
    expect(chart.comms[1].label).toBeUndefined()
    expect(chart.comms[2]).toMatchObject({ arrow: 'start', style: 'dashed', label: 'reports' })
  })
})
