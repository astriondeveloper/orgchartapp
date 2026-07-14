import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChartSvg } from './ChartSvg'
import { exportJson, exportPng, exportSvg } from './export'
import { layoutChart } from './layout'
import type { OrgChart } from './model'
import { SidePanel } from './SidePanel'
import { templates } from './templates'

const STORAGE_KEY = 'astrion-org-chart-v1'

function loadInitial(): OrgChart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as OrgChart
      if (parsed && Array.isArray(parsed.roots)) return parsed
    }
  } catch {
    /* fall through to template */
  }
  return templates[1].build()
}

export default function App() {
  const [chart, setChartRaw] = useState<OrgChart>(loadInitial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<OrgChart[]>([])
  const [future, setFuture] = useState<OrgChart[]>([])
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
        setChart(parsed)
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
        <SidePanel chart={chart} onChange={setChart} selectedId={selectedId} onSelect={setSelectedId} />
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
