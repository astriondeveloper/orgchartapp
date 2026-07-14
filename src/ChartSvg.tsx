import type { JSX } from 'react'
import type { Layout, PlacedNode } from './layout'
import type { BadgeType, LegendMarker } from './model'
import { brand, metrics as M, variantFill, zoneFill } from './theme'

/*
 * Pure SVG renderer. Everything is drawn with inline attributes (no CSS
 * classes) so the exported SVG is fully self-contained and drops cleanly
 * into PowerPoint / Word.
 */

interface Props {
  layout: Layout
  selectedId?: string | null
  onSelect?: (id: string) => void
}

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
          color={b === 'keyGold' ? brand.gold : '#C9D2DD'}
        />,
      )
      right -= 20
    } else if (b === 'cornerAccent') {
      glyphs.push(
        <path
          key={`${p.node.id}-corner`}
          d={`M ${p.x} ${p.y} h 15 L ${p.x} ${p.y + 15} Z`}
          fill={brand.orange}
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

function NodeBox({ p, selected, onSelect }: { p: PlacedNode; selected: boolean; onSelect?: (id: string) => void }) {
  const v = variantFill[p.node.variant] ?? variantFill.secondary
  const padX = M.padX
  const photo = p.node.photo
  const contentX = p.x + padX + (photo ? 38 : 0)
  const centerX = p.x + p.w / 2

  let ty = p.y + M.padY + M.titleLineH - 5
  const contentH =
    p.titleLines.length * M.titleLineH +
    (p.node.name ? M.nameLineH : 0) +
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
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />,
    )
  }
  if (p.node.name) {
    extras.push(
      <text
        key="name"
        x={p.leftAlign ? contentX + 8 : centerX}
        y={cursorY}
        fontSize={M.nameSize}
        fontStyle="italic"
        fill={v.text}
        textAnchor={p.leftAlign ? 'start' : 'middle'}
        fontFamily={brand.fontFamily}
      >
        {`• ${p.node.name}`}
      </text>,
    )
    cursorY += M.nameLineH
  }
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
      onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(p.node.id) } : undefined}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.headerH}
        rx={M.boxRadius}
        fill={v.fill}
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
          stroke={brand.orange}
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      )}
    </g>
  )
}

function LegendMarkerGlyph({ marker, x, y }: { marker: LegendMarker; x: number; y: number }) {
  switch (marker) {
    case 'keyGold':
      return <KeyIcon x={x} y={y + 3} color={brand.gold} />
    case 'keyGray':
      return <KeyIcon x={x} y={y + 3} color={brand.gray} />
    case 'cornerAccent':
      return <path d={`M ${x} ${y} h 14 L ${x} ${y + 14} Z`} fill={brand.orange} />
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
      return <rect x={x} y={y} width={16} height={14} fill={zoneFill[marker]} stroke="#C6CFDA" strokeWidth={0.5} />
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

export function ChartSvg({ layout, selectedId, onSelect }: Props) {
  const { placed, connectors, zones, comms, legend, title, width, height } = layout
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fontFamily={brand.fontFamily}
    >
      <defs>
        <marker id="commArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto-start-reverse">
          <path d="M 0 0 L 7 4 L 0 8 Z" fill={brand.comm} />
        </marker>
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
                fill={brand.navy}
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

      {/* Communication arrows render under the boxes so long runs stay tidy;
          the arrowheads at box edges remain visible. */}
      <g stroke={brand.comm} strokeWidth={2} fill="none">
        {comms.map((c) => (
          <path
            key={c.link.id}
            d={c.path}
            markerEnd="url(#commArrow)"
            markerStart={c.link.twoWay === false ? undefined : 'url(#commArrow)'}
          />
        ))}
      </g>

      {placed.map((p) => (
        <NodeBox key={p.node.id} p={p} selected={p.node.id === selectedId} onSelect={onSelect} />
      ))}

      {legend && (
        <g>
          <rect
            x={legend.x}
            y={legend.y}
            width={legend.w}
            height={legend.h}
            fill={brand.white}
            stroke="#C6CFDA"
            strokeWidth={1}
            rx={4}
          />
          <text
            x={legend.x + 12}
            y={legend.y + 20}
            fontSize={12}
            fontWeight={700}
            fill={brand.navy}
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

      {title && (
        <text
          x={title.x}
          y={title.y}
          fontSize={20}
          fontWeight={700}
          fill={brand.navy}
          fontFamily={brand.fontFamily}
        >
          {title.text}
        </text>
      )}
    </svg>
  )
}
