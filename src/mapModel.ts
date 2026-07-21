import { clone, normalizeGlossaryTerm, uid } from './model'
import type { GlossaryTerm, LegendItem } from './model'
import { LOCATIONS, type MapLocation } from './locations'

/*
 * Data model for the U.S. Map chart type. A map holds a list of work locations
 * (sites); each site carries a star position, an optional roster-card position,
 * and a list of staffed positions (LCATs) with FTE and key-personnel counts.
 * Site totals are always computed, never stored, so they cannot drift.
 *
 * All mutation helpers clone the chart so React state stays immutable, mirroring
 * the org-chart model in model.ts.
 */

/** One staffed position at a site: a role/LCAT with headcount. */
export interface MapLcat {
  id: string
  /** Position or role shown on the card row, e.g. "Program Manager". */
  title: string
  /** Optional labor-category label shown under the title. */
  lcat?: string
  /** Full-time equivalents (>= 0). */
  fte: number
  /** Key personnel within this position (>= 0). */
  keyPersonnel: number
}

export interface XY {
  x: number
  y: number
}

/** A work location plotted on the map (or listed in the OCONUS strip). */
export interface MapSite {
  id: string
  name: string
  /** Id of the picked preset in locations.ts (sets geo when chosen). */
  locationId?: string
  /** Star position in map space (see usMapData viewBox). Absent => OCONUS strip. */
  geo?: XY
  /** Roster-card top-left in map space (manual placement). */
  card?: XY
  /** Roster-card width in px (drag the card's edge handle). */
  cardWidth?: number
  /** Render a one-line total-chip instead of the full roster. */
  collapsed?: boolean
  /** Force this site into the OCONUS strip (no map point). */
  oconus?: boolean
  lcats: MapLcat[]
}

export interface MapChart {
  version: 1
  kind: 'map'
  meta: { title: string; showTitle: boolean; glossaryTitle?: string }
  sites: MapSite[]
  legend: LegendItem[]
  glossary?: GlossaryTerm[]
}

/** Smallest a roster card may be resized to. */
export const MAP_MIN_CARD_WIDTH = 150

function locationById(id: string): MapLocation | undefined {
  return LOCATIONS.find((l) => l.id === id)
}

export function emptyMap(): MapChart {
  const dc = locationById('washington-dc')
  return {
    version: 1,
    kind: 'map',
    meta: { title: 'Program Locations', showTitle: true },
    sites: [
      {
        id: uid('s'),
        name: dc?.name ?? 'Washington, DC',
        ...(dc?.id ? { locationId: dc.id } : {}),
        ...(dc?.geo ? { geo: { ...dc.geo } } : {}),
        lcats: [
          { id: uid('p'), title: 'Program Manager', fte: 1, keyPersonnel: 1 },
          { id: uid('p'), title: 'Systems Engineer', fte: 3, keyPersonnel: 0 },
        ],
      },
    ],
    legend: [],
    glossary: [],
  }
}

/* ------------------------------------------------------------------ totals */

export function siteFte(site: MapSite): number {
  return site.lcats.reduce((sum, l) => sum + l.fte, 0)
}
export function siteKp(site: MapSite): number {
  return site.lcats.reduce((sum, l) => sum + l.keyPersonnel, 0)
}
export function mapFteTotal(chart: MapChart): number {
  return chart.sites.reduce((sum, s) => sum + siteFte(s), 0)
}
export function mapKpTotal(chart: MapChart): number {
  return chart.sites.reduce((sum, s) => sum + siteKp(s), 0)
}
/** A site sits in the OCONUS strip when flagged or lacking a map position. */
export function isStripSite(site: MapSite): boolean {
  return !!site.oconus || !site.geo
}

/* -------------------------------------------------------------- mutations */

export function findSite(chart: MapChart, id: string): MapSite | null {
  return chart.sites.find((s) => s.id === id) ?? null
}

export function addSite(chart: MapChart): { chart: MapChart; newId: string } {
  const next = clone(chart)
  const newId = uid('s')
  next.sites.push({ id: newId, name: 'New location', lcats: [] })
  return { chart: next, newId }
}

export function updateSite(chart: MapChart, id: string, patch: Partial<MapSite>): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === id)
  if (s) Object.assign(s, patch)
  return next
}

export function deleteSite(chart: MapChart, id: string): MapChart {
  const next = clone(chart)
  next.sites = next.sites.filter((s) => s.id !== id)
  return next
}

/** Apply a picked preset: set name, remember the id, and place (or send OCONUS). */
export function applyLocation(chart: MapChart, siteId: string, loc: MapLocation): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === siteId)
  if (s) {
    s.name = loc.name
    s.locationId = loc.id
    if (loc.geo) {
      s.geo = { ...loc.geo }
      delete s.oconus
    } else {
      delete s.geo
      s.oconus = true
    }
  }
  return next
}

export function setSiteGeo(chart: MapChart, id: string, geo: XY | null): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === id)
  if (s) {
    if (geo) s.geo = { x: geo.x, y: geo.y }
    else delete s.geo
  }
  return next
}

export function setSiteCard(chart: MapChart, id: string, card: XY | null): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === id)
  if (s) {
    if (card) s.card = { x: card.x, y: card.y }
    else delete s.card
  }
  return next
}

export function setSiteCardWidth(chart: MapChart, id: string, width: number | null): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === id)
  if (s) {
    if (width == null) delete s.cardWidth
    else s.cardWidth = Math.max(MAP_MIN_CARD_WIDTH, Math.round(width))
  }
  return next
}

export function addLcat(chart: MapChart, siteId: string): { chart: MapChart; newId: string } {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === siteId)
  const newId = uid('p')
  if (s) s.lcats.push({ id: newId, title: 'New position', fte: 1, keyPersonnel: 0 })
  return { chart: next, newId }
}

export function updateLcat(
  chart: MapChart,
  siteId: string,
  lcatId: string,
  patch: Partial<MapLcat>,
): MapChart {
  const next = clone(chart)
  const l = next.sites.find((x) => x.id === siteId)?.lcats.find((y) => y.id === lcatId)
  if (l) Object.assign(l, patch)
  return next
}

export function deleteLcat(chart: MapChart, siteId: string, lcatId: string): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === siteId)
  if (s) s.lcats = s.lcats.filter((l) => l.id !== lcatId)
  return next
}

export function moveLcat(chart: MapChart, siteId: string, lcatId: string, dir: -1 | 1): MapChart {
  const next = clone(chart)
  const s = next.sites.find((x) => x.id === siteId)
  if (!s) return chart
  const i = s.lcats.findIndex((l) => l.id === lcatId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= s.lcats.length) return chart
  const [l] = s.lcats.splice(i, 1)
  s.lcats.splice(j, 0, l)
  return next
}

/* -------------------------------------------------------------- normalize */

const isFiniteXY = (v: unknown): v is XY =>
  !!v && typeof v === 'object' && Number.isFinite((v as XY).x) && Number.isFinite((v as XY).y)

/** Coerce a headcount to a non-negative integer. */
const count = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0

function normalizeLcat(input: unknown): MapLcat | null {
  if (!input || typeof input !== 'object') return null
  const l = input as Partial<MapLcat>
  const title = typeof l.title === 'string' ? l.title : ''
  const lcat = typeof l.lcat === 'string' && l.lcat.trim() ? l.lcat : undefined
  const fte = count(l.fte)
  const keyPersonnel = count(l.keyPersonnel)
  if (!title.trim() && !lcat && fte === 0 && keyPersonnel === 0) return null
  const out: MapLcat = { id: typeof l.id === 'string' && l.id ? l.id : uid('p'), title, fte, keyPersonnel }
  if (lcat) out.lcat = lcat
  return out
}

function normalizeSite(input: unknown): MapSite | null {
  if (!input || typeof input !== 'object') return null
  const s = input as Partial<MapSite>
  const site: MapSite = {
    id: typeof s.id === 'string' && s.id ? s.id : uid('s'),
    name: typeof s.name === 'string' ? s.name : '',
    lcats: Array.isArray(s.lcats)
      ? s.lcats.map(normalizeLcat).filter((l): l is MapLcat => l !== null)
      : [],
  }
  if (typeof s.locationId === 'string' && s.locationId) site.locationId = s.locationId
  if (isFiniteXY(s.geo)) site.geo = { x: s.geo.x, y: s.geo.y }
  if (isFiniteXY(s.card)) site.card = { x: s.card.x, y: s.card.y }
  if (typeof s.cardWidth === 'number' && Number.isFinite(s.cardWidth) && s.cardWidth > 0) {
    site.cardWidth = Math.max(MAP_MIN_CARD_WIDTH, Math.round(s.cardWidth))
  }
  if (s.oconus === true) site.oconus = true
  if (s.collapsed === true) site.collapsed = true
  return site
}

/**
 * Validate and normalize an untrusted map document (localStorage, imported file,
 * or the JSON tab): fill defaults, coerce shape, drop malformed sites/positions,
 * clamp negative counts, and strip non-finite geometry. Throws on non-objects.
 */
export function normalizeMap(input: unknown): MapChart {
  if (!input || typeof input !== 'object') throw new Error('Not a chart object.')
  const c = input as Partial<MapChart> & { meta?: Partial<MapChart['meta']> }
  const glossaryTitle = c.meta?.glossaryTitle
  return {
    version: 1,
    kind: 'map',
    meta: {
      title: typeof c.meta?.title === 'string' ? c.meta.title : 'U.S. Map',
      showTitle: c.meta?.showTitle !== false,
      ...(typeof glossaryTitle === 'string' ? { glossaryTitle } : {}),
    },
    sites: Array.isArray(c.sites)
      ? c.sites.map(normalizeSite).filter((s): s is MapSite => s !== null)
      : [],
    legend: Array.isArray(c.legend) ? (c.legend as LegendItem[]) : [],
    glossary: Array.isArray(c.glossary)
      ? c.glossary.map(normalizeGlossaryTerm).filter((t): t is GlossaryTerm => t !== null)
      : [],
  }
}
