/**
 * Astrion brand tokens — the single source of truth for every color, font and
 * metric used by the chart renderer.
 *
 * Values are taken from the official Astrion Brand Standards (December 2023,
 * V.1): primary Astrion Force / Astrion Sky, the secondary and tertiary
 * palettes, and the Sky gradient (which must always start with Refraction
 * green at the left/top). Tertiary colors are used only as highlights, per
 * the guide.
 */

/** Official Astrion color palette (hex values from the brand standards). */
export const palette = {
  force: '#442C81', // Astrion Force — Pantone 2105 C (primary)
  sky: '#29AAE1', // Astrion Sky — Pantone 2995 C (primary)
  refraction: '#1ED872', // Pantone 6340 C (secondary)
  daylight: '#4DD3F7', // Pantone 2985 C (secondary)
  zenith: '#9382F9', // Pantone 266 C (secondary)
  midnight: '#222230', // Pantone 5395 C (secondary)
  platinum: '#DDDDDD', // Pantone Cool Gray 1 (secondary)
  silver: '#BDBDBD', // Pantone Cool Gray 3 (secondary)
  alabaster: '#F1E9DB', // Pantone 7527 C (tertiary)
  supernova: '#FFAF2E', // Pantone 143 C (tertiary — highlight only)
  twilight: '#FC5442', // Pantone 1787 C (tertiary — highlight only)
  water: '#307EEF', // Pantone 2728 C (tertiary — highlight only)
} as const

export const brand = {
  /** Headings / dark text. */
  heading: palette.midnight,

  /** Badge colors. */
  keyGold: palette.supernova,
  keyGray: palette.silver,
  /** Corner accent triangles. */
  marker: palette.twilight,

  /** Connector / reporting lines. */
  line: palette.silver,
  /** Communication-channel arrows. */
  comm: palette.force,
  /** Detail row border. */
  detailBorder: palette.silver,
  /** Detail row text. */
  detailText: palette.midnight,

  /** Group-zone tints (light washes of Refraction / Daylight / Supernova). */
  zoneGreen: '#E2F9EC',
  zoneBlue: '#E8F9FE',
  zoneOrange: '#FFF3DE',
  /** Dashed container border. */
  zoneDash: palette.force,

  white: '#FFFFFF',
  canvasBg: '#FFFFFF',

  /**
   * The Sky gradient (Refraction → Daylight → Zenith). Per the brand guide it
   * is always applied starting with green at the left/top.
   */
  skyGradient: [palette.refraction, palette.daylight, palette.zenith] as const,

  /**
   * Obvia is Astrion's primary typeface. It is a licensed font, so per the
   * brand standards the app falls back to Verdana wherever Obvia is not
   * installed.
   */
  fontFamily: `Obvia, Verdana, Geneva, Arial, sans-serif`,
} as const

/** Fill + text color for each semantic box variant (keeps charts on-brand). */
export const variantFill: Record<string, { fill: string; text: string }> = {
  primary: { fill: palette.force, text: brand.white },
  secondary: { fill: palette.sky, text: brand.white },
  tertiary: { fill: palette.daylight, text: palette.midnight },
  accent: { fill: palette.supernova, text: palette.midnight },
}

/**
 * Pick a readable text color (white or Midnight) for an arbitrary fill, using
 * WCAG relative luminance. The 0.5 threshold reproduces the variant choices
 * above (Force/Sky → white, Daylight/Supernova → Midnight).
 */
export function readableText(hex: string): string {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c
  if (full.length < 6) return brand.white
  const chan = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const lum = 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4)
  return lum > 0.5 ? palette.midnight : brand.white
}

/** Layout metrics — tuned once so every chart uses identical geometry. */
export const metrics = {
  boxWidth: 190, // default node width
  boxRadius: 6,
  padX: 10,
  padY: 9,
  minHeaderH: 42,

  titleSize: 13,
  titleLineH: 18,
  nameSize: 11,
  nameLineH: 16,
  bulletSize: 11,
  bulletLineH: 15.5,
  detailSize: 10.5,
  detailLineH: 14.5,
  detailPadY: 5,

  siblingGap: 26, // horizontal gap between sibling subtrees
  levelGap: 44, // vertical gap between levels
  stackGap: 10, // vertical gap in stacked capability lists
  stackIndent: 20, // horizontal indent of stacked children
  rootGap: 90, // gap between independent roots (columns/trees)

  zonePad: 16,
  canvasPad: 28,
  legendGap: 30,
} as const

/** Spacing that changes with the density setting. "comfortable" mirrors the
 *  metrics above; "compact" tightens every gap (and the canvas margin) so a
 *  chart takes up less room on a document page. Box interiors and font sizes
 *  are unchanged either way, so boxes stay legible and on-brand. */
export interface LayoutGaps {
  siblingGap: number
  levelGap: number
  stackGap: number
  stackIndent: number
  rootGap: number
  zonePad: number
  legendGap: number
  canvasPad: number
}

export const layoutGaps: Record<'comfortable' | 'compact', LayoutGaps> = {
  comfortable: {
    siblingGap: metrics.siblingGap,
    levelGap: metrics.levelGap,
    stackGap: metrics.stackGap,
    stackIndent: metrics.stackIndent,
    rootGap: metrics.rootGap,
    zonePad: metrics.zonePad,
    legendGap: metrics.legendGap,
    canvasPad: metrics.canvasPad,
  },
  compact: {
    siblingGap: 14,
    levelGap: 24,
    stackGap: 6,
    stackIndent: 14,
    rootGap: 46,
    zonePad: 10,
    legendGap: 22,
    canvasPad: 14,
  },
}

export type ZoneStyle = 'green' | 'blue' | 'orange' | 'dashed'

export const zoneFill: Record<Exclude<ZoneStyle, 'dashed'>, string> = {
  green: brand.zoneGreen,
  blue: brand.zoneBlue,
  orange: brand.zoneOrange,
}
