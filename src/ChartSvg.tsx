import { memo } from 'react'
import type { JSX, PointerEvent as ReactPointerEvent } from 'react'
import { textWidth } from './layout'
import type { Layout, PlacedNode } from './layout'
import { edgeArrow } from './model'
import type { BadgeType, LegendMarker } from './model'
import { brand, metrics as M, readableText, variantFill, zoneFill } from './theme'

/*
 * Pure SVG renderer. Everything is drawn with inline attributes (no CSS
 * classes) so the exported SVG is fully self-contained and drops cleanly
 * into PowerPoint / Word.
 */

interface Props {
  layout: Layout
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Begin a drag-to-reposition gesture on a box. */
  onNodePointerDown?: (id: string, e: ReactPointerEvent) => void
  /** Begin a drag-to-resize gesture from one of the selected box's handles. */
  onResizeStart?: (id: string, handle: ResizeHandle, e: ReactPointerEvent) => void
  /** Accessible summary of the chart, announced to screen readers. */
  ariaLabel?: string
}

/** Which handle a resize drag started from: east edge (width), south edge
 *  (height), or the south-east corner (both). */
export type ResizeHandle = 'e' | 's' | 'se'

function KeyIcon({ x, y, color }: { x: number; y: number; color: string }) {
  // Small horizontal key glyph (bow on the left, teeth on the right).
  return (
    <g transform={`translate(${x}, ${y})`} stroke={color} fill="none" strokeWidth={1.8}>
      <circle cx={3.5} cy={5} r={3} />
      <path d="M 6.5 5 H 15 M 12 5 V 8.2 M 15 5 V 8.2" strokeLinecap="round" />
    </g>
  )
}

function badgeGlyphs(p: PlacedNode): JSX.Element[] {
  const glyphs: JSX.Element[] = []
  const badges = p.node.badges ?? []
  let right = p.x + p.w - 22
  for (const b of badges as BadgeType[]) {
    if (b === 'keyGold' || b === 'keyGray') {
      glyphs.push(
        <KeyIcon
          key={`${p.node.id}-${b}`}
          x={right}
          y={p.y + 5}
          color={b === 'keyGold' ? brand.keyGold : '#D7DDE4'}
        />,
      )
      right -= 20
    } else if (b === 'cornerAccent') {
      glyphs.push(
        <path
          key={`${p.node.id}-corner`}
          d={`M ${p.x} ${p.y} h 15 L ${p.x} ${p.y + 15} Z`}
          fill={brand.marker}
        />,
      )
    }
  }
  return glyphs
}

function PhotoPlaceholder({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx={15} cy={15} r={15} fill="#E7ECF2" />
      <circle cx={15} cy={11.5} r={5} fill="#9AA8B8" />
      <path d="M 5.5 26 a 9.5 8 0 0 1 19 0 Z" fill="#9AA8B8" />
    </g>
  )
}

/** Small drag handles drawn on the selected box's east / south / south-east
 *  edges. Tagged data-ui so the export pipeline strips them from every output.
 *  They anchor to the colored header, which is what the size override drives. */
function ResizeHandles({
  p,
  onResizeStart,
}: {
  p: PlacedNode
  onResizeStart: (id: string, handle: ResizeHandle, e: ReactPointerEvent) => void
}) {
  const HS = 9
  const rx = p.x + p.w
  const by = p.y + p.headerH
  const spots: { hx: number; hy: number; cursor: string; handle: ResizeHandle }[] = [
    { hx: rx, hy: p.y + p.headerH / 2, cursor: 'ew-resize', handle: 'e' },
    { hx: p.x + p.w / 2, hy: by, cursor: 'ns-resize', handle: 's' },
    { hx: rx, hy: by, cursor: 'nwse-resize', handle: 'se' },
  ]
  return (
    <>
      {spots.map((s) => (
        <rect
          key={s.handle}
          data-ui="resize"
          x={s.hx - HS / 2}
          y={s.hy - HS / 2}
          width={HS}
          height={HS}
          rx={2}
          fill={brand.white}
          stroke={brand.marker}
          strokeWidth={1.5}
          style={{ cursor: s.cursor }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onResizeStart(p.node.id, s.handle, e)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ))}
    </>
  )
}

function NodeBox({
  p,
  selected,
  onSelect,
  onPointerDown,
  onResizeStart,
}: {
  p: PlacedNode
  selected: boolean
  onSelect?: (id: string) => void
  onPointerDown?: (id: string, e: ReactPointerEvent) => void
  onResizeStart?: (id: string, handle: ResizeHandle, e: ReactPointerEvent) => void
}) {
  // Matrixed / dotted-line roles render as a white box with a dashed gray
  // outline and dark text, instead of a filled variant color.
  const dashed = !!p.node.dashed
  const v = dashed
    ? { fill: brand.white, text: brand.heading }
    : p.node.color
      ? { fill: p.node.color, text: readableText(p.node.color) }
      : (variantFill[p.node.variant] ?? variantFill.secondary)
  const padX = M.padX
  const photo = p.node.photo
  const contentX = p.x + padX + (photo ? 38 : 0)
  const centerX = p.x + p.w / 2

  let ty = p.y + M.padY + M.titleLineH - 5
  const contentH =
    p.titleLines.length * M.titleLineH +
    p.nameLines.length * M.nameLineH +
    (p.bulletLines.length ? 6 + p.bulletLines.length * M.bulletLineH : 0)
  // Vertically center content in the header.
  ty += Math.max(0, (p.headerH - M.padY * 2 - contentH) / 2)

  const titleEls = p.titleLines.map((line, i) => (
    <text
      key={`t${i}`}
      x={p.leftAlign ? contentX : centerX}
      y={ty + i * M.titleLineH}
      fontSize={M.titleSize}
      fontWeight={700}
      fill={v.text}
      textAnchor={p.leftAlign ? 'start' : 'middle'}
      fontFamily={brand.fontFamily}
    >
      {line}
    </text>
  ))
  let cursorY = ty + p.titleLines.length * M.titleLineH

  const extras: JSX.Element[] = []
  if (p.leftAlign) {
    extras.push(
      <line
        key="underline"
        x1={contentX}
        y1={cursorY - M.titleLineH + 9}
        x2={p.x + p.w - padX}
        y2={cursorY - M.titleLineH + 9}
        stroke={v.text === brand.white ? 'rgba(255,255,255,0.45)' : 'rgba(34,34,48,0.3)'}
        strokeWidth={1}
      />,
    )
  }
  p.nameLines.forEach((line, i) => {
    extras.push(
      <text
        key={`name${i}`}
        x={p.leftAlign ? contentX + 8 + (i === 0 ? 0 : 8) : centerX}
        y={cursorY}
        fontSize={M.nameSize}
        fontStyle="italic"
        fill={v.text}
        textAnchor={p.leftAlign ? 'start' : 'middle'}
        fontFamily={brand.fontFamily}
      >
        {i === 0 ? `• ${line}` : line}
      </text>,
    )
    cursorY += M.nameLineH
  })
  if (p.bulletLines.length) {
    cursorY += 6
    p.bulletLines.forEach((b, i) => {
      extras.push(
        <text
          key={`b${i}`}
          x={contentX + (b.first ? 0 : 12)}
          y={cursorY}
          fontSize={M.bulletSize}
          fill={v.text}
          fontFamily={brand.fontFamily}
        >
          {b.first ? `• ${b.text}` : b.text}
        </text>,
      )
      cursorY += M.bulletLineH
    })
  }

  // Detail rows (white panels under the header).
  const detailEls: JSX.Element[] = []
  let dy = p.y + p.headerH
  p.detailBlocks.forEach((blk, bi) => {
    detailEls.push(
      <rect
        key={`dr${bi}`}
        x={p.x}
        y={dy}
        width={p.w}
        height={blk.h}
        fill={brand.white}
        stroke={brand.detailBorder}
        strokeWidth={1}
      />,
    )
    const label = p.node.details?.[bi]?.label ?? ''
    blk.lines.forEach((line, li) => {
      const isFirst = li === 0 && label
      const bold = isFirst ? line.slice(0, label.length) : ''
      const rest = isFirst ? line.slice(label.length) : line
      detailEls.push(
        <text
          key={`dt${bi}-${li}`}
          x={p.x + M.padX}
          y={dy + M.detailPadY + (li + 1) * M.detailLineH - 3.5}
          fontSize={M.detailSize}
          fill={brand.detailText}
          fontFamily={brand.fontFamily}
        >
          {isFirst ? (
            <>
              <tspan fontWeight={700}>{bold}</tspan>
              {rest}
            </>
          ) : (
            line
          )}
        </text>,
      )
    })
    dy += blk.h
  })

  return (
    <g
      onPointerDown={onPointerDown ? (e) => onPointerDown(p.node.id, e) : undefined}
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(p.node.id) } : undefined}
      style={onSelect ? { cursor: onPointerDown ? 'move' : 'pointer' } : undefined}
    >
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.headerH}
        rx={M.boxRadius}
        fill={v.fill}
        stroke={dashed ? brand.line : undefined}
        strokeWidth={dashed ? 1.5 : undefined}
        strokeDasharray={dashed ? '6 4' : undefined}
      />
      {p.detailBlocks.length > 0 && (
        // Square off the header's bottom corners when detail rows attach.
        <rect x={p.x} y={p.y + p.headerH - M.boxRadius} width={p.w} height={M.boxRadius} fill={v.fill} />
      )}
      {detailEls}
      {photo && <PhotoPlaceholder x={p.x + 6} y={p.y + (p.headerH - 30) / 2} />}
      {titleEls}
      {extras}
      {badgeGlyphs(p)}
      {selected && (
        <rect
          data-ui="selection"
          x={p.x - 3}
          y={p.y - 3}
          width={p.w + 6}
          height={p.totalH + 6}
          rx={M.boxRadius + 2}
          fill="none"
          stroke={brand.marker}
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      )}
      {selected && onResizeStart && <ResizeHandles p={p} onResizeStart={onResizeStart} />}
    </g>
  )
}

/* Memoized so that during a drag (or selection change) only the boxes whose
 * props actually changed re-render. previewDrag() reuses untouched PlacedNode
 * objects by reference, and the callbacks are stable, so the shallow compare
 * skips every box except the one being moved. */
const MemoNodeBox = memo(NodeBox)

function LegendMarkerGlyph({ marker, x, y }: { marker: LegendMarker; x: number; y: number }) {
  switch (marker) {
    case 'keyGold':
      return <KeyIcon x={x} y={y + 3} color={brand.keyGold} />
    case 'keyGray':
      return <KeyIcon x={x} y={y + 3} color={brand.keyGray} />
    case 'cornerAccent':
      return <path d={`M ${x} ${y} h 14 L ${x} ${y + 14} Z`} fill={brand.marker} />
    case 'boxPrimary':
    case 'boxSecondary':
    case 'boxTertiary':
    case 'boxAccent': {
      const key = marker.slice(3).toLowerCase() // 'primary' | 'secondary' | ...
      return <rect x={x} y={y} width={16} height={14} rx={2} fill={variantFill[key].fill} />
    }
    case 'green':
    case 'blue':
    case 'orange':
    case 'purple':
    case 'red':
    case 'gray':
    case 'water':
    case 'teal':
      return <rect x={x} y={y} width={16} height={14} fill={zoneFill[marker]} stroke="#BDBDBD" strokeWidth={0.5} />
    case 'dashed':
      return (
        <rect x={x} y={y} width={16} height={14} fill="none" stroke={brand.zoneDash} strokeWidth={1.5} strokeDasharray="4 3" />
      )
    case 'comm':
      return (
        <g stroke={brand.comm} strokeWidth={2}>
          <line x1={x} y1={y + 7} x2={x + 16} y2={y + 7} />
          <path d={`M ${x + 3} ${y + 3} L ${x} ${y + 7} L ${x + 3} ${y + 11}`} fill="none" />
          <path d={`M ${x + 13} ${y + 3} L ${x + 16} ${y + 7} L ${x + 13} ${y + 11}`} fill="none" />
        </g>
      )
  }
}

export function ChartSvg({ layout, selectedId, onSelect, onNodePointerDown, onResizeStart, ariaLabel }: Props) {
  const { placed, connectors, zones, comms, legend, glossary, title, width, height } = layout
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
        <marker id="commArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto-start-reverse">
          <path d="M 0 0 L 7 4 L 0 8 Z" fill={brand.comm} />
        </marker>
        <linearGradient id="skyGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={brand.skyGradient[0]} />
          <stop offset="50%" stopColor={brand.skyGradient[1]} />
          <stop offset="100%" stopColor={brand.skyGradient[2]} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={brand.canvasBg} />

      {zones.map((z) =>
        z.group.style === 'dashed' ? (
          <g key={z.group.id}>
            <rect
              x={z.rect.x}
              y={z.rect.y}
              width={z.rect.w}
              height={z.rect.h}
              fill="rgba(29,79,145,0.03)"
              stroke={brand.zoneDash}
              strokeWidth={1.6}
              strokeDasharray="7 5"
              rx={4}
            />
            {z.group.label && (
              <text
                x={z.rect.x + 10}
                y={z.rect.y + 18}
                fontSize={13}
                fontWeight={700}
                fill={brand.zoneDash}
                fontFamily={brand.fontFamily}
              >
                {z.group.label}
              </text>
            )}
          </g>
        ) : (
          <g key={z.group.id}>
            <rect
              x={z.rect.x}
              y={z.rect.y}
              width={z.rect.w}
              height={z.rect.h}
              fill={zoneFill[z.group.style]}
              rx={6}
            />
            {z.group.label && (
              <text
                x={z.rect.x + 10}
                y={z.rect.y + z.rect.h - 8}
                fontSize={12}
                fontWeight={700}
                fill={brand.heading}
                fontFamily={brand.fontFamily}
              >
                {z.group.label}
              </text>
            )}
          </g>
        ),
      )}

      <g stroke={brand.line} strokeWidth={2.4} fill="none">
        {connectors.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* Edges render under the boxes so long runs stay tidy; the arrowheads at
          box edges remain visible. Each edge carries its own style + arrows. */}
      <g stroke={brand.comm} strokeWidth={2} fill="none">
        {comms.map((c) => {
          const arrow = edgeArrow(c.link)
          return (
            <path
              key={c.link.id}
              d={c.path}
              strokeDasharray={c.link.style === 'dashed' ? '6 4' : undefined}
              markerEnd={arrow === 'end' || arrow === 'both' ? 'url(#commArrow)' : undefined}
              markerStart={arrow === 'start' || arrow === 'both' ? 'url(#commArrow)' : undefined}
            />
          )
        })}
      </g>

      {/* Edge labels: a small white plate so the text reads over any lines. */}
      {comms.map((c) => {
        if (!c.link.label) return null
        const lw = textWidth(c.link.label, 10.5)
        return (
          <g key={`${c.link.id}-label`}>
            <rect
              x={c.labelPos.x - lw / 2 - 4}
              y={c.labelPos.y - 9}
              width={lw + 8}
              height={17}
              rx={3}
              fill={brand.white}
              stroke={brand.detailBorder}
              strokeWidth={0.75}
            />
            <text
              x={c.labelPos.x}
              y={c.labelPos.y + 3.5}
              textAnchor="middle"
              fontSize={10.5}
              fill={brand.comm}
              fontFamily={brand.fontFamily}
            >
              {c.link.label}
            </text>
          </g>
        )
      })}

      {placed.map((p) => (
        <MemoNodeBox
          key={p.node.id}
          p={p}
          selected={p.node.id === selectedId}
          onSelect={onSelect}
          onPointerDown={onNodePointerDown}
          onResizeStart={onResizeStart}
        />
      ))}

      {legend && (
        <g>
          <rect
            x={legend.x}
            y={legend.y}
            width={legend.w}
            height={legend.h}
            fill={brand.white}
            stroke="#BDBDBD"
            strokeWidth={1}
            rx={4}
          />
          <text
            x={legend.x + 12}
            y={legend.y + 20}
            fontSize={12}
            fontWeight={700}
            fill={brand.heading}
            fontFamily={brand.fontFamily}
          >
            Legend
          </text>
          {legend.items.map((item, i) => {
            const iy = legend.y + 32 + i * 24
            return (
              <g key={item.id}>
                <LegendMarkerGlyph marker={item.marker} x={legend.x + 12} y={iy} />
                <text
                  x={legend.x + 36}
                  y={iy + 11}
                  fontSize={11}
                  fill={brand.detailText}
                  fontFamily={brand.fontFamily}
                >
                  {item.label}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {glossary && (
        <g>
          <rect
            x={glossary.x}
            y={glossary.y}
            width={glossary.w}
            height={glossary.h}
            fill={brand.white}
            stroke="#BDBDBD"
            strokeWidth={1}
            rx={4}
          />
          <text
            x={glossary.x + 12}
            y={glossary.y + 20}
            fontSize={12}
            fontWeight={700}
            fill={brand.heading}
            fontFamily={brand.fontFamily}
          >
            {glossary.title}
          </text>
          {glossary.lines.map((ln, i) => (
            <text
              key={i}
              x={glossary.x + 12}
              y={ln.y}
              fontSize={11}
              fill={brand.detailText}
              fontFamily={brand.fontFamily}
            >
              {ln.boldLen ? (
                <>
                  <tspan fontWeight={700}>{ln.text.slice(0, ln.boldLen)}</tspan>
                  {ln.text.slice(ln.boldLen)}
                </>
              ) : (
                ln.text
              )}
            </text>
          ))}
        </g>
      )}

      {title && (
        <g>
          {/* Headlines are all-caps per the Astrion brand standards. */}
          <text
            x={title.x}
            y={title.y}
            fontSize={20}
            fontWeight={700}
            fill={brand.heading}
            fontFamily={brand.fontFamily}
          >
            {title.text.toUpperCase()}
          </text>
          {/* Sky-gradient bar (Refraction first, per the brand standards),
              sized to match the headline width above it. */}
          <rect x={title.x} y={title.y + 8} width={title.w} height={4} fill="url(#skyGradient)" />
        </g>
      )}
    </svg>
  )
}
