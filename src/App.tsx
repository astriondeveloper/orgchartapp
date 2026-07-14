import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChartSvg } from './ChartSvg'
import { exportJson, exportPng, exportSvg } from './export'
import { layoutChart } from './layout'
import { deleteNode, duplicateNode, normalizeChart, type OrgChart } from './model'
import { Minimap, type Viewport } from './Minimap'
import { type Anchor, NodeToolbar } from './NodeToolbar'
import { SidePanel } from './SidePanel'
import { DEFAULT_TEMPLATE_KEY, templates } from './templates'

const STORAGE_KEY = 'astrion-org-chart-v1'
const SIDEBAR_KEY = 'astrion-sidebar-width-v1'
const SIDEBAR_MIN = 280
const SIDEBAR_DEFAULT = 340
const THEME_KEY = 'astrion-theme'
/** Matches the .canvas padding (var(--space-7)); the svg-host sits at this
 *  offset inside the scroll content, so screen<->svg math needs it. */
const CANVAS_PAD = 24
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3

type Theme = 'light' | 'dark'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** The theme stamped on <html> by the no-FOUC bootstrap in index.html. */
function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** Largest the panel may grow to: never past ~760px, and always leaving room
 *  for the canvas next to it. */
function sidebarMax(): number {
  return Math.max(SIDEBAR_MIN, Math.min(760, window.innerWidth - 320))
}

function defaultChart(): OrgChart {
  return (templates.find((t) => t.key === DEFAULT_TEMPLATE_KEY) ?? templates[0]).build()
}

function loadInitial(): OrgChart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeChart(JSON.parse(raw))
  } catch {
    /* fall through to template */
  }
  return defaultChart()
}

function loadSidebarWidth(): number {
  const raw = Number(localStorage.getItem(SIDEBAR_KEY))
  return raw >= SIDEBAR_MIN && raw <= 900 ? raw : SIDEBAR_DEFAULT
}

export default function App() {
  const [chart, setChartRaw] = useState<OrgChart>(loadInitial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<OrgChart[]>([])
  const [future, setFuture] = useState<OrgChart[]>([])
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadSidebarWidth)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const svgHostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const tbWidthRef = useRef(216)
  const rafRef = useRef(0)
  const pendingZoomRef = useRef<{ svgX: number; svgY: number; offX: number; offY: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null)
  const skipClickRef = useRef(false)
  const lastSelRef = useRef<string | null>(null)

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  const setChart = useCallback(
    (next: OrgChart) => {
      setHistory((h) => [...h.slice(-99), chart])
      setFuture([])
      setChartRaw(next)
    },
    [chart],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      const prev = h[h.length - 1]
      setFuture((f) => [chart, ...f])
      setChartRaw(prev)
      return h.slice(0, -1)
    })
  }, [chart])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const next = f[0]
      setHistory((h) => [...h, chart])
      setChartRaw(next)
      return f.slice(1)
    })
  }, [chart])

  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(chart)), 300)
    return () => clearTimeout(id)
  }, [chart])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  // Drag the divider to resize the side panel. Listeners live on the window so
  // the drag keeps tracking even when the pointer leaves the thin handle.
  const startResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = sidebarWidth
      const max = sidebarMax()
      const onMove = (ev: PointerEvent) => {
        const next = Math.round(Math.min(max, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX)))
        setSidebarWidth(next)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        if (!selectedId) return
        e.preventDefault()
        const r = duplicateNode(chart, selectedId)
        setChart(r.chart)
        setSelectedId(r.newId)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedId) return
        e.preventDefault()
        setChart(deleteNode(chart, selectedId))
        setSelectedId(null)
        canvasRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, selectedId, chart, setChart])

  const layout = useMemo(() => layoutChart(chart), [chart])

  // Zoom the whole chart to fit the visible canvas, then scroll to the origin.
  const fitToScreen = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const pad = 56
    const z = Math.min((el.clientWidth - pad) / layout.width, (el.clientHeight - pad) / layout.height)
    const clamped = +Math.max(0.25, Math.min(2, z)).toFixed(2)
    setZoom(clamped)
    requestAnimationFrame(() => el.scrollTo({ left: 0, top: 0 }))
  }, [layout.width, layout.height])

  // Zoom to a readable level and center the selected box in the canvas.
  const fitToSelection = useCallback(() => {
    const el = canvasRef.current
    if (!el || !selectedId) return
    const p = layout.placed.find((n) => n.node.id === selectedId)
    if (!p) return
    const z = +Math.max(0.5, Math.min(2, Math.min((el.clientWidth * 0.55) / p.w, (el.clientHeight * 0.55) / p.totalH))).toFixed(2)
    setZoom(z)
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      const cx = 24 + (p.x + p.w / 2) * z
      const cy = 24 + (p.y + p.totalH / 2) * z
      el.scrollTo({
        left: cx - el.clientWidth / 2,
        top: cy - el.clientHeight / 2,
        behavior: smooth ? 'smooth' : 'auto',
      })
    })
  }, [selectedId, layout.placed])

  // Position the floating contextual toolbar over the selected box. The
  // .svg-host bounding rect already bakes in the zoom transform and scroll
  // (transform-origin is top-left), so one measure maps SVG coords to screen.
  const recomputeAnchor = useCallback(() => {
    const host = svgHostRef.current
    const canvas = canvasRef.current
    const wrap = canvasWrapRef.current
    if (!host || !canvas || !wrap || !selectedId) {
      setAnchor(null)
      return
    }
    const p = layout.placed.find((n) => n.node.id === selectedId)
    if (!p) {
      setAnchor(null)
      return
    }
    const hostRect = host.getBoundingClientRect()
    // .svg-host is scaled by `zoom` from its top-left origin, so hostRect's
    // top-left is SVG coord (0,0) and `zoom` maps SVG units to screen px.
    const z = zoom
    const nodeL = hostRect.left + p.x * z
    const nodeT = hostRect.top + p.y * z
    const nodeW = p.w * z
    const nodeH = p.totalH * z
    const nodeCX = nodeL + nodeW / 2
    const view = canvas.getBoundingClientRect()
    // Hide when the box is scrolled outside the canvas viewport.
    if (nodeL > view.right || nodeL + nodeW < view.left || nodeT > view.bottom || nodeT + nodeH < view.top) {
      setAnchor(null)
      return
    }
    const GAP = 10
    const TB_H = 40
    const M = 8
    const tbW = tbWidthRef.current
    const placement: Anchor['placement'] = nodeT - GAP - TB_H >= view.top + 4 ? 'above' : 'below'
    const rawTop = placement === 'above' ? nodeT - GAP - TB_H : nodeT + nodeH + GAP
    const wrapRect = wrap.getBoundingClientRect()
    const centerVp = clamp(nodeCX, view.left + M + tbW / 2, view.right - M - tbW / 2)
    const left = centerVp - wrapRect.left
    const top = clamp(rawTop, view.top + M, view.bottom - M - TB_H) - wrapRect.top
    const caretShift = clamp(nodeCX - wrapRect.left - left, -(tbW / 2 - 12), tbW / 2 - 12)
    setAnchor({ left, top, placement, caretShift })
  }, [selectedId, layout, zoom])

  // The visible region of the chart, in SVG coordinates — drives the minimap.
  const updateViewport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setViewport({
      x: (canvas.scrollLeft - CANVAS_PAD) / zoom,
      y: (canvas.scrollTop - CANVAS_PAD) / zoom,
      w: canvas.clientWidth / zoom,
      h: canvas.clientHeight / zoom,
    })
  }, [zoom])

  // Ctrl/Cmd + wheel (and trackpad pinch) zooms toward the cursor. The point
  // under the pointer is stashed and re-pinned after the zoom re-renders.
  const applyWheelZoom = useCallback(
    (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const canvas = canvasRef.current
      if (!canvas) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const offX = e.clientX - rect.left
      const offY = e.clientY - rect.top
      const svgX = (canvas.scrollLeft + offX - CANVAS_PAD) / zoom
      const svgY = (canvas.scrollTop + offY - CANVAS_PAD) / zoom
      const z2 = +clamp(zoom * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX).toFixed(3)
      if (z2 === zoom) return
      pendingZoomRef.current = { svgX, svgY, offX, offY }
      setZoom(z2)
    },
    [zoom],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handler = (e: WheelEvent) => applyWheelZoom(e)
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => canvas.removeEventListener('wheel', handler)
  }, [applyWheelZoom])

  // Re-pin the cursor's SVG point after a wheel zoom. Runs before the anchor
  // effect below so the toolbar reads the corrected scroll offset.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const pend = pendingZoomRef.current
    if (!canvas || !pend) return
    pendingZoomRef.current = null
    canvas.scrollLeft = CANVAS_PAD + pend.svgX * zoom - pend.offX
    canvas.scrollTop = CANVAS_PAD + pend.svgY * zoom - pend.offY
  }, [zoom])

  useLayoutEffect(() => {
    recomputeAnchor()
    updateViewport()
  }, [recomputeAnchor, updateViewport])

  const scheduleReposition = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      recomputeAnchor()
      updateViewport()
    })
  }, [recomputeAnchor, updateViewport])

  useEffect(() => {
    window.addEventListener('resize', scheduleReposition)
    const ro = new ResizeObserver(scheduleReposition)
    const el = canvasRef.current
    if (el) ro.observe(el)
    return () => {
      window.removeEventListener('resize', scheduleReposition)
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [scheduleReposition])

  // Refine the toolbar width from its rendered size, then re-anchor once.
  useEffect(() => {
    const el = canvasWrapRef.current?.querySelector<HTMLElement>('.node-toolbar')
    if (!el) return
    const w = el.offsetWidth
    if (w && Math.abs(w - tbWidthRef.current) > 1) {
      tbWidthRef.current = w
      scheduleReposition()
    }
  }, [anchor, scheduleReposition])

  // Keep the selected box on screen (e.g. a freshly added child): if it sits
  // outside the canvas viewport, gently scroll it in. This also keeps the
  // floating toolbar mounted so its focus handling can run.
  useEffect(() => {
    const host = svgHostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas || !selectedId) {
      lastSelRef.current = selectedId
      return
    }
    // Only recenter when the selection actually changes, not on every zoom
    // (which would fight cursor-centered wheel zoom).
    if (selectedId === lastSelRef.current) return
    lastSelRef.current = selectedId
    const p = layout.placed.find((n) => n.node.id === selectedId)
    if (!p) return
    const hostRect = host.getBoundingClientRect()
    const nodeL = hostRect.left + p.x * zoom
    const nodeT = hostRect.top + p.y * zoom
    const nodeR = nodeL + p.w * zoom
    const nodeB = nodeT + p.totalH * zoom
    const view = canvas.getBoundingClientRect()
    const pad = 52
    let dx = 0
    let dy = 0
    if (nodeL < view.left + pad) dx = nodeL - (view.left + pad)
    else if (nodeR > view.right - pad) dx = nodeR - (view.right - pad)
    if (nodeT < view.top + pad) dy = nodeT - (view.top + pad)
    else if (nodeB > view.bottom - pad) dy = nodeB - (view.bottom - pad)
    if (dx || dy) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      canvas.scrollBy({ left: dx, top: dy, behavior: smooth ? 'smooth' : 'auto' })
    }
  }, [selectedId, layout, zoom])

  const getSvg = () => svgHostRef.current?.querySelector('svg') as SVGSVGElement | null

  const loadTemplate = (key: string) => {
    const t = templates.find((x) => x.key === key)
    if (t && window.confirm(`Replace the current chart with the "${t.label}" template?`)) {
      setChart(t.build())
      setSelectedId(null)
    }
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setChart(normalizeChart(JSON.parse(String(reader.result))))
        setSelectedId(null)
      } catch (e) {
        window.alert(`Could not load that file: ${e instanceof Error ? e.message : 'invalid JSON'}`)
      }
    }
    reader.readAsText(file)
  }

  // Hold Space to pan (grab cursor); ignore while typing in a field.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      e.preventDefault()
      setSpaceHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Drag to pan with Space+left or the middle mouse button.
  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const isPan = e.button === 1 || (e.button === 0 && spaceHeld)
    const canvas = canvasRef.current
    if (!isPan || !canvas) return
    e.preventDefault()
    panRef.current = { x: e.clientX, y: e.clientY, sl: canvas.scrollLeft, st: canvas.scrollTop, moved: false }
    setPanning(true)
    canvas.setPointerCapture(e.pointerId)
  }
  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    const canvas = canvasRef.current
    if (!pan || !canvas) return
    const dx = e.clientX - pan.x
    const dy = e.clientY - pan.y
    if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true
    canvas.scrollLeft = pan.sl - dx
    canvas.scrollTop = pan.st - dy
  }
  const onCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return
    if (panRef.current.moved) skipClickRef.current = true
    panRef.current = null
    setPanning(false)
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  // Scroll the canvas so an SVG point (from a minimap click) is centered.
  const navigateTo = useCallback(
    (svgX: number, svgY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.scrollLeft = CANVAS_PAD + svgX * zoom - canvas.clientWidth / 2
      canvas.scrollTop = CANVAS_PAD + svgY * zoom - canvas.clientHeight / 2
    },
    [zoom],
  )

  const canvasCursor = panning ? 'grabbing' : spaceHeld ? 'grab' : ''

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark">
            {/* Simplified two-triangle mark in Astrion Sky + Force. */}
            <svg width="20" height="15" viewBox="0 0 20 15" aria-hidden="true">
              <polygon points="0,0 13,0 0,11" fill="#29AAE1" />
              <polygon points="20,0 20,15 2,15" fill="#442C81" />
            </svg>
          </span>
          <strong>ASTRION</strong>&nbsp;Org Chart Builder
        </div>

        <select
          className="template-select"
          value=""
          onChange={(e) => e.target.value && loadTemplate(e.target.value)}
        >
          <option value="">New from template…</option>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        <div className="spacer" />

        <button onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">↪ Redo</button>

        <span className="divider" />

        <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)))}>−</button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}>+</button>
        <button onClick={() => setZoom(1)}>100%</button>
        <button onClick={fitToScreen} title="Fit chart to screen">Fit</button>
        <button onClick={fitToSelection} disabled={!selectedId} title="Zoom to the selected box">Focus</button>

        <span className="divider" />

        <button onClick={() => { const svg = getSvg(); if (svg) exportSvg(svg, chart.meta.title) }}>
          Export SVG
        </button>
        <button onClick={() => { const svg = getSvg(); if (svg) void exportPng(svg, chart.meta.title, 2) }}>
          PNG 2×
        </button>
        <button onClick={() => { const svg = getSvg(); if (svg) void exportPng(svg, chart.meta.title, 4) }}>
          PNG 4×
        </button>

        <span className="divider" />

        <button onClick={() => exportJson(chart)}>Save JSON</button>
        <button onClick={() => fileRef.current?.click()}>Load JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importJson(f)
            e.target.value = ''
          }}
        />

        <span className="divider" />

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>
      </header>

      <div className="main">
        <SidePanel
          width={sidebarWidth}
          chart={chart}
          onChange={setChart}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div
          className="resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize side panel"
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize}
          onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT)}
        />
        <div className="canvas-wrap" ref={canvasWrapRef}>
          <div
            className={`canvas${canvasCursor ? ` ${canvasCursor}` : ''}`}
            ref={canvasRef}
            tabIndex={-1}
            onScroll={scheduleReposition}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onClick={() => {
              if (skipClickRef.current) {
                skipClickRef.current = false
                return
              }
              setSelectedId(null)
            }}
          >
            {layout.placed.length === 0 ? (
              <div className="empty-state" onClick={(e) => e.stopPropagation()}>
                <h2>Nothing to show yet</h2>
                <p>This chart has no visible boxes. Start from a template, or add a box from the Boxes panel.</p>
                <button
                  onClick={() => {
                    setChart(defaultChart())
                    setSelectedId(null)
                  }}
                >
                  Start from a template
                </button>
              </div>
            ) : (
              <div
                ref={svgHostRef}
                className="svg-host"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                <ChartSvg layout={layout} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
            )}
          </div>
          {selectedId && anchor && (
            <NodeToolbar
              anchor={anchor}
              chart={chart}
              nodeId={selectedId}
              onChange={setChart}
              onSelect={setSelectedId}
              returnFocus={() => canvasRef.current?.focus()}
            />
          )}
          {layout.placed.length > 0 && viewport && (
            <Minimap layout={layout} viewport={viewport} onNavigate={navigateTo} />
          )}
        </div>
      </div>
    </div>
  )
}
