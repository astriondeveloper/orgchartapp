import { describe, expect, it } from 'vitest'
import { allNodes } from './model'
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

  it('exposes the default template key', async () => {
    const { DEFAULT_TEMPLATE_KEY } = await import('./templates')
    expect(templates.some((t) => t.key === DEFAULT_TEMPLATE_KEY)).toBe(true)
  })
})
