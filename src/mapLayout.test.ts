import { describe, expect, it } from 'vitest'
import { layoutMap } from './mapLayout'
import { MAP_MIN_CARD_WIDTH, type MapChart } from './mapModel'

const chart = (): MapChart => ({
  version: 1,
  kind: 'map',
  meta: { title: 'Program Locations', showTitle: true },
  sites: [
    {
      id: 'hsv',
      name: 'Huntsville, AL',
      geo: { x: 690, y: 373 },
      lcats: [
        { id: 'a', title: 'Systems Engineer', lcat: 'Sr. Systems Analyst', fte: 5, keyPersonnel: 1 },
        { id: 'b', title: 'Test Engineer', fte: 3, keyPersonnel: 0 },
      ],
    },
    { id: 'den', name: 'Denver, CO', geo: { x: 379, y: 266 }, collapsed: true, lcats: [{ id: 'c', title: 'Data Scientist', fte: 2, keyPersonnel: 0 }] },
    { id: 'ram', name: 'Ramstein, Germany', oconus: true, lcats: [{ id: 'd', title: 'Logistics Specialist', fte: 2, keyPersonnel: 0 }] },
  ],
  legend: [],
  glossary: [],
})

describe('layoutMap', () => {
  it('places on-map sites as stars, expands rosters, collapses, and strips OCONUS', () => {
    const l = layoutMap(chart())
    expect(l.stars.map((s) => s.site.id).sort()).toEqual(['den', 'hsv'])
    // Huntsville is an expanded card with a leader line.
    expect(l.cards).toHaveLength(1)
    expect(l.cards[0].site.id).toBe('hsv')
    expect(l.cards[0].fteTotal).toBe(8)
    expect(l.cards[0].kpTotal).toBe(1)
    expect(l.cards[0].rows[0].lcat).toBe('Sr. Systems Analyst')
    expect(l.leaders).toHaveLength(1)
    // Denver is collapsed to a chip.
    expect(l.chips).toHaveLength(1)
    expect(l.chips[0].site.id).toBe('den')
    // Ramstein is OCONUS -> strip.
    expect(l.strip).not.toBeNull()
    expect(l.strip!.entries.map((e) => e.site.id)).toEqual(['ram'])
  })

  it('produces positive bounds that cover the content and offsets for the title', () => {
    const l = layoutMap(chart())
    expect(l.width).toBeGreaterThan(l.mapW)
    expect(l.height).toBeGreaterThan(l.mapH)
    expect(l.ox).toBeGreaterThanOrEqual(0)
    expect(l.oy).toBeGreaterThan(0) // pushed down by the title
    expect(l.title).not.toBeNull()
  })

  it('sends a site with no geo to the strip even without the OCONUS flag', () => {
    const c = chart()
    delete c.sites[0].geo // Huntsville loses its position
    const l = layoutMap(c)
    expect(l.strip!.entries.some((e) => e.site.id === 'hsv')).toBe(true)
    expect(l.stars.some((s) => s.site.id === 'hsv')).toBe(false)
  })

  it('honors a card width override, clamped to the minimum', () => {
    const wide = chart()
    wide.sites[0].cardWidth = 260
    expect(layoutMap(wide).cards[0].w).toBe(260)
    const tiny = chart()
    tiny.sites[0].cardWidth = 10
    expect(layoutMap(tiny).cards[0].w).toBe(MAP_MIN_CARD_WIDTH)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(layoutMap(chart()))).toBe(JSON.stringify(layoutMap(chart())))
  })
})
