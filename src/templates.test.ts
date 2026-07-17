import { describe, expect, it } from 'vitest'
import { allNodes, normalizeChart } from './model'
import { layoutChart } from './layout'
import { templates } from './templates'

describe('templates', () => {
  it.each(templates.map((t) => [t.key, t] as const))('%s builds a valid chart', (_key, t) => {
    const chart = t.build()
    const nodes = allNodes(chart).map(({ node }) => node)
    const ids = nodes.map((n) => n.id)

    // Non-empty and every id is unique.
    expect(chart.roots.length).toBeGreaterThan(0)
    expect(nodes.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)

    // Every comm and group references a node that actually exists.
    const idSet = new Set(ids)
    for (const c of chart.comms) {
      expect(idSet.has(c.fromId)).toBe(true)
      expect(idSet.has(c.toId)).toBe(true)
    }
    for (const g of chart.groups) {
      for (const m of g.memberIds) expect(idSet.has(m)).toBe(true)
    }

    // Legend entries are well-formed.
    for (const l of chart.legend) {
      expect(l.marker).toBeTruthy()
      expect(typeof l.label).toBe('string')
    }
  })

  it.each(templates.map((t) => [t.key, t] as const))(
    '%s normalizes and lays out with finite geometry',
    (_key, t) => {
      // Round-trip through normalizeChart the way load / import / the JSON tab
      // does, then run the real layout engine and check the geometry is sane.
      const chart = normalizeChart(JSON.parse(JSON.stringify(t.build())))
      const layout = layoutChart(chart)

      expect(Number.isFinite(layout.width) && layout.width > 0).toBe(true)
      expect(Number.isFinite(layout.height) && layout.height > 0).toBe(true)
      // Every drawn node is placed; 'hidden' containers draw no box and so are
      // intentionally absent from the placed list.
      const drawn = allNodes(chart).filter(({ node }) => node.variant !== 'hidden').length
      expect(layout.placed.length).toBe(drawn)
      for (const p of layout.placed) {
        for (const v of [p.x, p.y, p.w, p.headerH, p.totalH]) {
          expect(Number.isFinite(v)).toBe(true)
        }
        expect(p.w).toBeGreaterThan(0)
        expect(p.totalH).toBeGreaterThan(0)
      }
      for (const z of layout.zones) {
        for (const v of [z.rect.x, z.rect.y, z.rect.w, z.rect.h]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
    },
  )

  it('exposes the default template key', async () => {
    const { DEFAULT_TEMPLATE_KEY } = await import('./templates')
    expect(templates.some((t) => t.key === DEFAULT_TEMPLATE_KEY)).toBe(true)
  })
})
