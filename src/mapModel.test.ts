import { describe, expect, it } from 'vitest'
import {
  addLcat,
  addSite,
  applyLocation,
  deleteLcat,
  deleteSite,
  emptyMap,
  findSite,
  isStripSite,
  MAP_MIN_CARD_WIDTH,
  mapFteTotal,
  mapKpTotal,
  moveLcat,
  normalizeMap,
  setSiteCard,
  setSiteCardWidth,
  setSiteGeo,
  siteFte,
  siteKp,
  updateLcat,
  type MapChart,
} from './mapModel'
import { LOCATIONS } from './locations'

const base = (): MapChart => ({
  version: 1,
  kind: 'map',
  meta: { title: 'M', showTitle: true },
  sites: [
    {
      id: 's1',
      name: 'Huntsville, AL',
      geo: { x: 690, y: 373 },
      lcats: [
        { id: 'p1', title: 'Systems Engineer', fte: 5, keyPersonnel: 1 },
        { id: 'p2', title: 'Test Engineer', fte: 3, keyPersonnel: 0 },
      ],
    },
  ],
  legend: [],
  glossary: [],
})

describe('emptyMap', () => {
  it('produces a valid starter map', () => {
    const m = emptyMap()
    expect(m.kind).toBe('map')
    expect(m.sites).toHaveLength(1)
    expect(m.sites[0].lcats.length).toBeGreaterThan(0)
    expect(m.sites[0].geo).toBeTruthy()
  })
})

describe('totals', () => {
  it('sums FTE and key personnel per site and across the map', () => {
    const m = base()
    expect(siteFte(m.sites[0])).toBe(8)
    expect(siteKp(m.sites[0])).toBe(1)
    expect(mapFteTotal(m)).toBe(8)
    expect(mapKpTotal(m)).toBe(1)
  })
})

describe('site + lcat editing', () => {
  it('adds and deletes sites without mutating the source', () => {
    const m = base()
    const { chart, newId } = addSite(m)
    expect(chart.sites).toHaveLength(2)
    expect(findSite(chart, newId)).toBeTruthy()
    expect(m.sites).toHaveLength(1) // source untouched
    expect(deleteSite(chart, newId).sites).toHaveLength(1)
  })

  it('adds, updates, reorders, and deletes positions', () => {
    let m = base()
    const added = addLcat(m, 's1')
    m = added.chart
    expect(m.sites[0].lcats).toHaveLength(3)
    m = updateLcat(m, 's1', added.newId, { title: 'Cyber Analyst', fte: 2, keyPersonnel: 1, lcat: 'ISSO II' })
    const l = m.sites[0].lcats.find((x) => x.id === added.newId)!
    expect(l).toMatchObject({ title: 'Cyber Analyst', fte: 2, keyPersonnel: 1, lcat: 'ISSO II' })
    // move the new (3rd) row up one
    m = moveLcat(m, 's1', added.newId, -1)
    expect(m.sites[0].lcats[1].id).toBe(added.newId)
    m = deleteLcat(m, 's1', added.newId)
    expect(m.sites[0].lcats).toHaveLength(2)
  })

  it('sets and clears geo and card', () => {
    let m = base()
    m = setSiteCard(m, 's1', { x: 100, y: 200 })
    expect(findSite(m, 's1')?.card).toEqual({ x: 100, y: 200 })
    m = setSiteCard(m, 's1', null)
    expect(findSite(m, 's1')?.card).toBeUndefined()
    m = setSiteGeo(m, 's1', null)
    expect(findSite(m, 's1')?.geo).toBeUndefined()
    expect(isStripSite(findSite(m, 's1')!)).toBe(true) // no geo => strip
  })

  it('sets, clamps, and clears card width', () => {
    let m = base()
    m = setSiteCardWidth(m, 's1', 20) // below the minimum -> clamped
    expect(findSite(m, 's1')?.cardWidth).toBe(MAP_MIN_CARD_WIDTH)
    m = setSiteCardWidth(m, 's1', 260)
    expect(findSite(m, 's1')?.cardWidth).toBe(260)
    m = setSiteCardWidth(m, 's1', null)
    expect(findSite(m, 's1')?.cardWidth).toBeUndefined()
  })
})

describe('applyLocation', () => {
  it('places a CONUS preset on the map and an overseas preset in the strip', () => {
    const conus = LOCATIONS.find((l) => l.geo)!
    const overseas = LOCATIONS.find((l) => l.oconus)!
    let m = base()
    m = applyLocation(m, 's1', overseas)
    expect(findSite(m, 's1')?.oconus).toBe(true)
    expect(findSite(m, 's1')?.geo).toBeUndefined()
    m = applyLocation(m, 's1', conus)
    expect(findSite(m, 's1')?.geo).toEqual(conus.geo)
    expect(findSite(m, 's1')?.oconus).toBeUndefined()
    expect(findSite(m, 's1')?.name).toBe(conus.name)
  })
})

describe('normalizeMap', () => {
  it('coerces shape, drops garbage, clamps counts, strips bad geometry', () => {
    const m = normalizeMap({
      kind: 'map',
      sites: [
        {
          name: 'A', // no id -> backfilled
          geo: { x: 10, y: 20 },
          card: { x: Number.NaN, y: 5 }, // dropped
          lcats: [
            { title: 'SE', fte: -3, keyPersonnel: 2.6 }, // clamp fte->0, kp->3, id backfilled
            { title: '   ', fte: 0, keyPersonnel: 0 }, // empty -> dropped
            'nope', // not an object -> dropped
          ],
        },
        'garbage', // not an object -> dropped
      ],
    })
    expect(m.sites).toHaveLength(1)
    const s = m.sites[0]
    expect(s.id).toBeTruthy()
    expect(s.geo).toEqual({ x: 10, y: 20 })
    expect(s.card).toBeUndefined()
    expect(s.lcats).toHaveLength(1)
    expect(s.lcats[0]).toMatchObject({ title: 'SE', fte: 0, keyPersonnel: 3 })
    expect(s.lcats[0].id).toBeTruthy()
  })

  it('fills defaults and throws on non-objects', () => {
    const m = normalizeMap({ kind: 'map' })
    expect(m).toMatchObject({ version: 1, kind: 'map', sites: [], legend: [], glossary: [] })
    expect(m.meta).toEqual({ title: 'U.S. Map', showTitle: true })
    expect(() => normalizeMap(null)).toThrow()
  })
})
