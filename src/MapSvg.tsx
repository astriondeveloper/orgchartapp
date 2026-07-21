import { memo } from 'react'
import type { JSX, PointerEvent as ReactPointerEvent } from 'react'
import type { MapLayout, PlacedCard, PlacedChip, StripEntry } from './mapLayout'
import { brand, palette } from './theme'

/*
 * Pure SVG renderer for a MapLayout. Everything is drawn with inline attributes
 * so the exported SVG is self-contained (drops cleanly into PowerPoint / Word),
 * matching the org-chart renderer. Editor chrome (selection, handles) is tagged
 * data-ui so the export pipeline strips it.
 */

interface Props {
  layout: MapLayout
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Begin dragging a site's star. */
  onStarPointerDown?: (id: string, e: ReactPointerEvent) => void
  /** Begin dragging a site's roster card. */
  onCardPointerDown?: (id: string, e: ReactPointerEvent) => void
  /** Begin resizing a site's roster card from its edge handle. */
  onCardResizeStart?: (id: string, e: ReactPointerEvent) => void
  ariaLabel?: string
}

function starPathD(cx: number, cy: number, r: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.42
    d += `${i === 0 ? 'M' : 'L'} ${(cx + rr * Math.cos(ang)).toFixed(1)} ${(cy - rr * Math.sin(ang)).toFixed(1)} `
  }
  return `${d}Z`
}

function Star({ x, y, r = 9 }: { x: number; y: number; r?: number }) {
  return <path d={starPathD(x, y, r)} fill={palette.supernova} stroke={brand.heading} strokeWidth={0.9} strokeLinejoin="round" />
}

function totalText(fte: number, kp: number): string {
  return `${fte} FTE${kp ? ` · ${kp} key personnel` : ''}`
}

function Card({
  c,
  selected,
  onSelect,
  onPointerDown,
  onResizeStart,
}: {
  c: PlacedCard
  selected: boolean
  onSelect?: (id: string) => void
  onPointerDown?: (id: string, e: ReactPointerEvent) => void
  onResizeStart?: (id: string, e: ReactPointerEvent) => void
}) {
  const padX = 12
  const headerH = c.headerH
  const els: JSX.Element[] = []
  let y = c.y + headerH + 14
  c.rows.forEach((r, i) => {
    els.push(
      <text key={`t${i}`} x={c.x + padX} y={y} fontSize={11.5} fill={brand.detailText} fontFamily={brand.fontFamily}>
        {r.title}
      </text>,
    )
    const right =
      r.kp > 0 ? (
        <text key={`n${i}`} x={c.x + c.w - padX} y={y} textAnchor="end" fontSize={11.5} fontFamily={brand.fontFamily}>
          <tspan fontWeight={700} fill={brand.detailText}>{r.fte}</tspan>
          <tspan fontWeight={700} fill={palette.supernova}>{`  ★${r.kp}`}</tspan>
        </text>
      ) : (
        <text key={`n${i}`} x={c.x + c.w - padX} y={y} textAnchor="end" fontSize={11.5} fontWeight={700} fill={brand.detailText} fontFamily={brand.fontFamily}>
          {r.fte}
        </text>
      )
    els.push(right)
    y += 17
    if (r.lcat) {
      els.push(
        <text key={`l${i}`} x={c.x + padX + 2} y={y - 2} fontSize={10} fontStyle="italic" fill="#8B87A0" fontFamily={brand.fontFamily}>
          {r.lcat}
        </text>,
      )
      y += 14
    }
  })

  return (
    <g
      onPointerDown={onPointerDown ? (e) => onPointerDown(c.site.id, e) : undefined}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(c.site.id) } : undefined}
      style={onSelect ? { cursor: onPointerDown ? 'move' : 'pointer' } : undefined}
    >
      <rect x={c.x} y={c.y} width={c.w} height={c.totalH} rx={8} fill="#FBFAFE" stroke={brand.detailBorder} strokeWidth={1} />
      <rect x={c.x} y={c.y} width={c.w} height={headerH} rx={8} fill={palette.force} />
      <rect x={c.x} y={c.y + headerH - 8} width={c.w} height={8} fill={palette.force} />
      <text x={c.x + padX} y={c.y + 17} fontSize={12.5} fontWeight={700} fill={brand.white} fontFamily={brand.fontFamily}>
        {c.site.name}
      </text>
      <text x={c.x + padX} y={c.y + 33} fontSize={11} fontWeight={700} fill={palette.supernova} fontFamily={brand.fontFamily}>
        {totalText(c.fteTotal, c.kpTotal)}
      </text>
      {els}
      {selected && (
        <>
          <rect data-ui="selection" x={c.x - 3} y={c.y - 3} width={c.w + 6} height={c.totalH + 6} rx={10} fill="none" stroke={brand.marker} strokeWidth={2} strokeDasharray="5 3" />
          {onResizeStart && (
            <rect
              data-ui="resize"
              x={c.x + c.w - 4.5}
              y={c.y + c.headerH / 2 - 4.5}
              width={9}
              height={9}
              rx={2}
              fill={brand.white}
              stroke={brand.marker}
              strokeWidth={1.5}
              style={{ cursor: 'ew-resize' }}
              onPointerDown={(e) => { e.stopPropagation(); onResizeStart(c.site.id, e) }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </>
      )}
    </g>
  )
}
const MemoCard = memo(Card)

function Chip({ c, onSelect }: { c: PlacedChip; onSelect?: (id: string) => void }) {
  return (
    <g
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(c.site.id) } : undefined}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.h / 2} fill="#FBFAFE" stroke={brand.detailBorder} strokeWidth={1} />
      <text x={c.x + c.w / 2} y={c.y + 14} textAnchor="middle" fontSize={11} fontWeight={600} fill={brand.heading} fontFamily={brand.fontFamily}>
        {c.text}
      </text>
    </g>
  )
}

function StripRow({ e }: { e: StripEntry }) {
  return (
    <g>
      <Star x={e.x + 9} y={e.y + 4} />
      <text x={e.x + 24} y={e.y} fontSize={12.5} fontWeight={700} fill={brand.heading} fontFamily={brand.fontFamily}>
        {e.site.name}
      </text>
      <text x={e.x + 24} y={e.y + 16} fontSize={10.5} fill={palette.supernova} fontFamily={brand.fontFamily}>
        {totalText(e.fteTotal, e.kpTotal)}
      </text>
      {e.roster && (
        <text x={e.x + 24} y={e.y + 31} fontSize={10.5} fill={brand.detailText} fontFamily={brand.fontFamily}>
          {e.roster}
        </text>
      )}
    </g>
  )
}

export function MapSvg({ layout, selectedId, onSelect, onStarPointerDown, onCardPointerDown, onCardResizeStart, ariaLabel }: Props) {
  const { ox, oy, width, height, title } = layout
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fontFamily={brand.fontFamily}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="mapSkyGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={brand.skyGradient[0]} />
          <stop offset="50%" stopColor={brand.skyGradient[1]} />
          <stop offset="100%" stopColor={brand.skyGradient[2]} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={brand.canvasBg} />

      {title && (
        <g>
          <text x={title.x} y={title.y} fontSize={20} fontWeight={700} fill={brand.heading} fontFamily={brand.fontFamily}>
            {title.text.toUpperCase()}
          </text>
          <rect x={title.x} y={title.y + 8} width={title.w} height={4} fill="url(#mapSkyGradient)" />
        </g>
      )}

      <g transform={`translate(${ox}, ${oy})`}>
        <path d={layout.mapPath} fill={brand.mapFill} stroke={brand.mapStroke} strokeWidth={1.4} strokeLinejoin="round" />
        <path d={layout.bordersPath} fill="none" stroke={brand.mapBorder} strokeWidth={0.7} />

        <g stroke={brand.line} strokeWidth={1} fill="none">
          {layout.leaders.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
        </g>

        {layout.chips.map((c) => (
          <Chip key={c.site.id} c={c} onSelect={onSelect} />
        ))}

        {layout.cards.map((c) => (
          <MemoCard
            key={c.site.id}
            c={c}
            selected={c.site.id === selectedId}
            onSelect={onSelect}
            onPointerDown={onCardPointerDown}
            onResizeStart={onCardResizeStart}
          />
        ))}

        {/* Stars render above cards/leaders so the location marker stays visible. */}
        {layout.stars.map((s) => (
          <g
            key={s.site.id}
            onPointerDown={onStarPointerDown ? (e) => onStarPointerDown(s.site.id, e) : undefined}
            onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(s.site.id) } : undefined}
            style={onSelect ? { cursor: onStarPointerDown ? 'move' : 'pointer' } : undefined}
          >
            <Star x={s.x} y={s.y} />
            {s.site.id === selectedId && (
              <circle data-ui="selection" cx={s.x} cy={s.y} r={14} fill="none" stroke={brand.marker} strokeWidth={2} strokeDasharray="4 3" />
            )}
          </g>
        ))}

        {layout.strip && (
          <g>
            <line x1={0} y1={layout.strip.y} x2={layout.mapW} y2={layout.strip.y} stroke={brand.detailBorder} strokeWidth={1} strokeDasharray="5 5" />
            <text x={layout.strip.label.x} y={layout.strip.label.y} fontSize={13} fontWeight={700} letterSpacing="0.08em" fill={palette.force} fontFamily={brand.fontFamily}>
              OCONUS
            </text>
            {layout.strip.entries.map((e) => (
              <StripRow key={e.site.id} e={e} />
            ))}
          </g>
        )}
      </g>
    </svg>
  )
}
