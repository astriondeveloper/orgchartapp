import { textWidth, wrapText } from './layout'
import { isStripSite, MAP_MIN_CARD_WIDTH, siteFte, siteKp, type MapChart, type MapSite, type XY } from './mapModel'
import { US_MAP } from './usMapData'

/*
 * Deterministic layout for the U.S. Map chart type. Pure functions: the same
 * MapChart always produces the same geometry, so a laid-out map is reproducible.
 *
 * Content is laid out in the map's own coordinate space (the AlbersUSA fit box,
 * US_MAP.width x US_MAP.height). The renderer draws it inside a group translated
 * by (ox, oy); the title sits above and the canvas grows to fit cards, chips, and
 * the OCONUS strip. Cards may sit left of the map (negative x); `ox` absorbs that
 * so nothing clips.
 */

const PAD = 24
const TITLE_H = 44
const CARD_W = 204
const HEAD_H = 40
const ROW_H = 17
const SUB_H = 14
const STAR_GAP = 16
const STRIP_GAP = 40
const STRIP_ENTRY_W = 250

export interface CardRow {
  title: string
  lcat?: string
  fte: number
  kp: number
}

export interface PlacedCard {
  site: MapSite
  star: XY
  x: number
  y: number
  w: number
  headerH: number
  totalH: number
  fteTotal: number
  kpTotal: number
  rows: CardRow[]
}

export interface PlacedChip {
  site: MapSite
  star: XY
  x: number
  y: number
  w: number
  h: number
  text: string
}

export interface StripEntry {
  site: MapSite
  x: number
  y: number
  fteTotal: number
  kpTotal: number
  roster: string
}

export interface MapLayout {
  mapPath: string
  bordersPath: string
  mapW: number
  mapH: number
  /** Translate applied to the whole map-content group by the renderer. */
  ox: number
  oy: number
  stars: { site: MapSite; x: number; y: number }[]
  cards: PlacedCard[]
  chips: PlacedChip[]
  leaders: { x1: number; y1: number; x2: number; y2: number }[]
  strip: { y: number; label: XY; entries: StripEntry[] } | null
  title: { text: string; x: number; y: number; w: number } | null
  width: number
  height: number
}

const TITLE_BAR_SCALE = 0.9

function totalLabel(fte: number, kp: number): string {
  return `${fte} FTE${kp ? ` · ${kp} KP` : ''}`
}

/** Card height from its rows (each row is a title line plus an optional LCAT line). */
function measureCard(site: MapSite): { headerH: number; totalH: number; rows: CardRow[] } {
  const rows: CardRow[] = site.lcats.map((l) => ({
    title: l.title,
    ...(l.lcat ? { lcat: l.lcat } : {}),
    fte: l.fte,
    kp: l.keyPersonnel,
  }))
  const bodyH = rows.reduce((h, r) => h + ROW_H + (r.lcat ? SUB_H : 0), 0)
  return { headerH: HEAD_H, totalH: HEAD_H + bodyH + 8, rows }
}

/** Deterministic default card position: to the roomier side of the star, aligned
 *  near it vertically. The user drags to finalize; this only avoids the star. */
function autoCardPos(star: XY, w: number, headerH: number, mapH: number): XY {
  const rightRoom = US_MAP.width - star.x
  const x = rightRoom >= star.x ? star.x + STAR_GAP : star.x - w - STAR_GAP
  const y = Math.max(0, Math.min(star.y - headerH / 2, mapH - headerH))
  return { x, y }
}

export function layoutMap(chart: MapChart): MapLayout {
  const mapW = US_MAP.width
  const mapH = US_MAP.height

  const onMap = chart.sites.filter((s) => !isStripSite(s))
  const stripSites = chart.sites.filter((s) => isStripSite(s))

  const stars: MapLayout['stars'] = []
  const cards: PlacedCard[] = []
  const chips: PlacedChip[] = []
  const leaders: MapLayout['leaders'] = []

  for (const site of onMap) {
    const star = site.geo!
    stars.push({ site, x: star.x, y: star.y })
    const fteTotal = siteFte(site)
    const kpTotal = siteKp(site)

    if (site.collapsed || site.lcats.length === 0) {
      const text = `${site.name.split(',')[0]} · ${totalLabel(fteTotal, kpTotal)}`
      const w = textWidth(text, 11) + 18
      const h = 21
      const rightRoom = mapW - star.x
      const x = rightRoom >= star.x ? star.x + STAR_GAP : star.x - w - STAR_GAP
      chips.push({ site, star, x, y: star.y - h / 2, w, h, text })
      continue
    }

    const { headerH, totalH, rows } = measureCard(site)
    const w = Math.max(MAP_MIN_CARD_WIDTH, site.cardWidth ?? CARD_W)
    const pos = site.card ?? autoCardPos(star, w, headerH, mapH)
    cards.push({ site, star, x: pos.x, y: pos.y, w, headerH, totalH, fteTotal, kpTotal, rows })
    // Leader from the star to the near vertical edge of the card header.
    const toRight = pos.x >= star.x
    leaders.push({
      x1: star.x,
      y1: star.y,
      x2: toRight ? pos.x : pos.x + w,
      y2: pos.y + headerH / 2,
    })
  }

  // OCONUS strip below the map.
  let strip: MapLayout['strip'] = null
  if (stripSites.length) {
    const y = mapH + STRIP_GAP
    const entries: StripEntry[] = stripSites.map((site, i) => ({
      site,
      x: i * STRIP_ENTRY_W,
      y: y + 30,
      fteTotal: siteFte(site),
      kpTotal: siteKp(site),
      roster: site.lcats.map((l) => `${l.title} (${l.fte})`).join(', '),
    }))
    strip = { y, label: { x: 0, y: y - 8 }, entries }
  }

  // Content bounds in map space (cards can extend left/right/below the map).
  const lefts = [0, ...cards.map((c) => c.x), ...chips.map((c) => c.x)]
  const rights = [
    mapW,
    ...cards.map((c) => c.x + c.w),
    ...chips.map((c) => c.x + c.w),
    ...(strip ? [Math.max(mapW, strip.entries.length * STRIP_ENTRY_W)] : []),
  ]
  const bottoms = [
    mapH,
    ...cards.map((c) => c.y + c.totalH),
    ...chips.map((c) => c.y + c.h),
    ...(strip ? [strip.y + 64] : []),
  ]
  const minX = Math.min(...lefts)
  const maxX = Math.max(...rights)
  const maxY = Math.max(...bottoms)

  const titleShown = chart.meta.showTitle && chart.meta.title.trim().length > 0
  const title = titleShown
    ? {
        text: chart.meta.title,
        x: PAD,
        y: PAD + 22,
        w: textWidth(chart.meta.title.toUpperCase(), 20, true) * TITLE_BAR_SCALE,
      }
    : null

  const ox = PAD - minX
  const oy = PAD + (titleShown ? TITLE_H : 0)
  const width = ox + maxX + PAD
  const height = oy + maxY + PAD

  return {
    mapPath: US_MAP.nation,
    bordersPath: US_MAP.borders,
    mapW,
    mapH,
    ox,
    oy,
    stars,
    cards,
    chips,
    leaders,
    strip,
    title,
    width,
    height,
  }
}

/** Re-export so tests and the renderer share the same wrapping used elsewhere. */
export { wrapText }
