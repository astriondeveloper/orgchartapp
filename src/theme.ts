/**
 * Astrion brand tokens — the single source of truth for every color, font and
 * metric used by the chart renderer. Swap the hex values below for the exact
 * codes in the Astrion brand guide and every chart updates automatically.
 *
 * NOTE: astrion.us was not reachable from the build environment, so the
 * palette ships as a close professional approximation of the Astrion identity
 * (deep space navy, signature orange accent, supporting blues).
 */

export const brand = {
  /** Deep space navy — primary brand color (top-level boxes, headings). */
  navy: '#0C2340',
  /** Astrion blue — secondary boxes. */
  blue: '#1D4F91',
  /** Supporting light blue — tertiary boxes. */
  lightBlue: '#4A90D2',
  /** Astrion signature orange — accent boxes, corner markers, highlights. */
  orange: '#F05323',
  /** Gold key badge (e.g. "RFP Required"). */
  gold: '#E8A33D',
  /** Gray key badge (e.g. "Company Designated"). */
  gray: '#93A0B0',

  /** Connector / reporting lines. */
  line: '#B7C1CE',
  /** Communication-channel arrows. */
  comm: '#1D4F91',
  /** Detail row border. */
  detailBorder: '#AFBACA',
  /** Detail row text. */
  detailText: '#15243B',

  /** Group-zone tints. */
  zoneGreen: '#DFEAD4',
  zoneBlue: '#DCE7F5',
  zoneOrange: '#FCE3D7',
  /** Dashed container border. */
  zoneDash: '#1D4F91',

  white: '#FFFFFF',
  canvasBg: '#FFFFFF',

  fontFamily: `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`,
} as const

/** Fill + text color for each semantic box variant (keeps charts on-brand). */
export const variantFill: Record<string, { fill: string; text: string }> = {
  primary: { fill: brand.navy, text: brand.white },
  secondary: { fill: brand.blue, text: brand.white },
  tertiary: { fill: brand.lightBlue, text: brand.white },
  accent: { fill: brand.orange, text: brand.white },
}

/** Layout metrics — tuned once so every chart uses identical geometry. */
export const metrics = {
  boxWidth: 190, // default node width
  boxRadius: 6,
  padX: 10,
  padY: 9,
  minHeaderH: 42,

  titleSize: 13.5,
  titleLineH: 18,
  nameSize: 11.5,
  nameLineH: 16,
  bulletSize: 11.5,
  bulletLineH: 15.5,
  detailSize: 11,
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

export type ZoneStyle = 'green' | 'blue' | 'orange' | 'dashed'

export const zoneFill: Record<Exclude<ZoneStyle, 'dashed'>, string> = {
  green: brand.zoneGreen,
  blue: brand.zoneBlue,
  orange: brand.zoneOrange,
}
