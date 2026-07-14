import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChartSvg } from './ChartSvg'
import { exportJson, exportPng, exportSvg } from './export'
import { layoutChart } from './layout'
import { sanitizeColors, type OrgChart } from './model'
import { SidePanel } from './SidePanel'
import { DEFAULT_TEMPLATE_KEY, templates } from './templates'

const STORAGE_KEY = 'astrion-org-chart-v1'
const SIDEBAR_KEY = 'astrion-sidebar-width-v1'
const SIDEBAR_MIN = 280
const SIDEBAR_DEFAULT = 340

/** Largest the panel may grow to: never past ~760px, and always leaving room
 *  for the canvas next to it. */
function sidebarMax(): number {
  return Math.max(SIDEBAR_MIN, Math.min(760, window.innerWidth - 320))
}

function loadInitial(): OrgChart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as OrgChart
      if (parsed && Array.isArray(parsed.roots)) return sanitizeColors(parsed)
    }
  } catch {
    /* fall through to template */
  }
  return (templates.find((t) => t.key === DEFAULT_TEMPLATE_KEY) ?? templates[0]).build()
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
  const svgHostRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const layout = useMemo(() => layoutChart(chart), [chart])

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
        const parsed = JSON.parse(String(reader.result)) as OrgChart
        if (!parsed.roots || !Array.isArray(parsed.roots)) throw new Error('bad file')
        setChart(sanitizeColors(parsed))
        setSelectedId(null)
      } catch {
        window.alert('That file is not a valid org-chart JSON definition.')
      }
    }
    reader.readAsText(file)
  }

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
        <div className="canvas" onClick={() => setSelectedId(null)}>
          <div
            ref={svgHostRef}
            className="svg-host"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            <ChartSvg layout={layout} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </div>
    </div>
  )
}
