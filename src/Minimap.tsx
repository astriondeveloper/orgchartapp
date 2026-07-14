import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Layout } from './layout'

/** Visible region of the chart, in SVG coordinates. */
export interface Viewport {
  x: number
  y: number
  w: number
  h: number
}

const MAX_W = 190
const MAX_H = 140

interface Props {
  layout: Layout
  viewport: Viewport
  onNavigate: (svgX: number, svgY: number) => void
}

/**
 * Lightweight overview of the whole chart with a draggable viewport rectangle.
 * It draws one muted rect per placed node (no full re-render of the chart) and
 * is pure chrome — never part of the exported SVG.
 */
export function Minimap({ layout, viewport, onNavigate }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  const scale = Math.min(MAX_W / layout.width, MAX_H / layout.height, 1)
  const w = layout.width * scale
  const h = layout.height * scale

  const navigate = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    onNavigate((e.clientX - r.left) / scale, (e.clientY - r.top) / scale)
  }

  return (
    <div className="minimap" aria-hidden="true">
      <svg
        ref={svgRef}
        width={w}
        height={h}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          navigate(e)
        }}
        onPointerMove={(e) => {
          if (dragging.current) navigate(e)
        }}
        onPointerUp={(e) => {
          dragging.current = false
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        {layout.placed.map((p) => (
          <rect
            key={p.node.id}
            className="mm-node"
            x={p.x * scale}
            y={p.y * scale}
            width={p.w * scale}
            height={p.totalH * scale}
            rx={1}
          />
        ))}
        <rect
          className="mm-view"
          x={viewport.x * scale}
          y={viewport.y * scale}
          width={viewport.w * scale}
          height={viewport.h * scale}
        />
      </svg>
    </div>
  )
}
