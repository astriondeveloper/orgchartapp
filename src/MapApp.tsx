import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MapSvg } from './MapSvg'
import { MapEditor } from './MapEditor'
import { AppFooter } from './AppFooter'
import { layoutMap } from './mapLayout'
import {
  addSite,
  emptyMap,
  MAP_MIN_CARD_WIDTH,
  normalizeMap,
  setSiteCard,
  setSiteCardWidth,
  setSiteGeo,
  type MapChart,
} from './mapModel'
import { normalizeDocument } from './document'
import { copyPngToClipboard, download, exportPng, exportSvg, safeName } from './export'
import { exportPdf } from './pdf'
import { exportPptx } from './pptx'

const MAP_STORAGE_KEY = 'astrion-map-v1'
const THEME_KEY = 'astrion-theme'
const SIDEBAR_W = 360
const SNAP = 4

type Theme = 'light' | 'dark'
function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function loadInitial(): MapChart {
  try {
    const raw = localStorage.getItem(MAP_STORAGE_KEY)
    if (raw) return normalizeMap(JSON.parse(raw))
  } catch {
    /* fall through */
  }
  return emptyMap()
}

interface Props {
  onSwitchToOrg: () => void
  /** Hand a loaded org document up to the router (it switches to org mode). */
  onLoadForeign: (doc: ReturnType<typeof normalizeDocument>) => void
}

type Drag = { id: string; kind: 'star' | 'card' | 'resize'; x: number; y: number }

export function MapApp({ onSwitchToOrg, onLoadForeign }: Props) {
  const [doc, setDocRaw] = useState<MapChart>(loadInitial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<MapChart[]>([])
  const [future, setFuture] = useState<MapChart[]>([])
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle')

  const svgHostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const setDoc = useCallback(
    (next: MapChart) => {
      setHistory((h) => [...h.slice(-99), doc])
      setFuture([])
      setDocRaw(next)
    },
    [doc],
  )
  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      setFuture((f) => [doc, ...f])
      setDocRaw(h[h.length - 1])
      return h.slice(0, -1)
    })
  }, [doc])
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      setHistory((h) => [...h, doc])
      setDocRaw(f[0])
      return f.slice(1)
    })
  }, [doc])

  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(doc)), 300)
    return () => clearTimeout(id)
  }, [doc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const layout = useMemo(() => layoutMap(doc), [doc])
  const view = useMemo(() => {
    if (!drag) return layout
    const moved =
      drag.kind === 'star'
        ? setSiteGeo(doc, drag.id, { x: drag.x, y: drag.y })
        : drag.kind === 'card'
          ? setSiteCard(doc, drag.id, { x: drag.x, y: drag.y })
          : setSiteCardWidth(doc, drag.id, drag.x)
    return layoutMap(moved)
  }, [doc, layout, drag])

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  const getSvg = () => svgHostRef.current?.querySelector('svg') as SVGSVGElement | null

  const fit = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const pad = 56
    const z = Math.min((el.clientWidth - pad) / layout.width, (el.clientHeight - pad) / layout.height)
    setZoom(+Math.max(0.2, Math.min(2, z)).toFixed(2))
    requestAnimationFrame(() => el.scrollTo({ left: 0, top: 0 }))
  }, [layout.width, layout.height])

  // Drag a star or a card. Movement is tracked on the window and committed once
  // on release, so the whole drag is a single undo step. Deltas are divided by
  // zoom to convert screen px into map-space units (the group is translated, not
  // scaled, so map units equal viewBox units).
  const startDrag = useCallback(
    (id: string, kind: 'star' | 'card') => (e: ReactPointerEvent<Element>) => {
      movedRef.current = false
      if (e.button !== 0 || draggingRef.current) return
      const placed =
        kind === 'star'
          ? layout.stars.find((s) => s.site.id === id)
          : layout.cards.find((c) => c.site.id === id)
      if (!placed) return
      e.stopPropagation()
      setSelectedId(id)
      draggingRef.current = true
      const startX = e.clientX
      const startY = e.clientY
      const baseX = placed.x
      const baseY = placed.y
      const baseDoc = doc
      let moved = false
      let curX = baseX
      let curY = baseY
      let raf = 0
      const flush = () => {
        raf = 0
        setDrag({ id, kind, x: curX, y: curY })
      }
      const onMove = (ev: PointerEvent) => {
        const dxPx = ev.clientX - startX
        const dyPx = ev.clientY - startY
        if (!moved && Math.abs(dxPx) + Math.abs(dyPx) < 4) return
        if (!moved) {
          moved = true
          document.body.style.userSelect = 'none'
          document.body.style.cursor = 'move'
        }
        const z = zoomRef.current
        const step = ev.altKey ? 1 : SNAP
        const min = kind === 'star' ? 0 : -400
        curX = Math.max(min, Math.round((baseX + dxPx / z) / step) * step)
        curY = Math.max(0, Math.round((baseY + dyPx / z) / step) * step)
        if (!raf) raf = requestAnimationFrame(flush)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        if (raf) cancelAnimationFrame(raf)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        draggingRef.current = false
        if (moved) {
          movedRef.current = true
          const committed =
            kind === 'star'
              ? setSiteGeo(baseDoc, id, { x: curX, y: curY })
              : setSiteCard(baseDoc, id, { x: curX, y: curY })
          setDoc(committed)
        }
        setDrag(null)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [layout.stars, layout.cards, doc, setDoc],
  )

  const onStarPointerDown = useCallback((id: string, e: ReactPointerEvent) => startDrag(id, 'star')(e), [startDrag])
  const onCardPointerDown = useCallback((id: string, e: ReactPointerEvent) => startDrag(id, 'card')(e), [startDrag])

  // Resize a card by dragging its edge handle (sets the site's card width).
  const onCardResizeStart = useCallback(
    (id: string, e: ReactPointerEvent) => {
      movedRef.current = false
      if (e.button !== 0 || draggingRef.current) return
      const placed = layout.cards.find((c) => c.site.id === id)
      if (!placed) return
      e.stopPropagation()
      setSelectedId(id)
      draggingRef.current = true
      const startX = e.clientX
      const baseW = placed.w
      const baseDoc = doc
      let moved = false
      let curW = baseW
      let raf = 0
      const flush = () => {
        raf = 0
        setDrag({ id, kind: 'resize', x: curW, y: 0 })
      }
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        if (!moved && Math.abs(dx) < 4) return
        if (!moved) {
          moved = true
          document.body.style.userSelect = 'none'
          document.body.style.cursor = 'ew-resize'
        }
        const z = zoomRef.current
        const step = ev.altKey ? 1 : SNAP
        curW = Math.max(MAP_MIN_CARD_WIDTH, Math.round((baseW + dx / z) / step) * step)
        if (!raf) raf = requestAnimationFrame(flush)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        if (raf) cancelAnimationFrame(raf)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        draggingRef.current = false
        if (moved) {
          movedRef.current = true
          setDoc(setSiteCardWidth(baseDoc, id, curW))
        }
        setDrag(null)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [layout.cards, doc, setDoc],
  )

  const selectSite = useCallback((id: string) => {
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    setSelectedId(id)
  }, [])

  const newMap = () => {
    if (window.confirm('Start a new, empty U.S. Map? This replaces the current map.')) {
      setDoc(emptyMap())
      setSelectedId(null)
    }
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = normalizeDocument(JSON.parse(String(reader.result)))
        if (parsed.kind === 'map') {
          setDoc(parsed)
          setSelectedId(null)
        } else {
          onLoadForeign(parsed) // an org chart -> router switches modes
        }
      } catch (e) {
        window.alert(`Could not load that file: ${e instanceof Error ? e.message : 'invalid JSON'}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark">
            <svg width="20" height="15" viewBox="0 0 20 15" aria-hidden="true">
              <polygon points="0,0 13,0 0,11" fill="#29AAE1" />
              <polygon points="20,0 20,15 2,15" fill="#442C81" />
            </svg>
          </span>
          <strong>ASTRION</strong>&nbsp;U.S. Map
        </div>

        <button onClick={newMap}>New U.S. Map</button>
        <button onClick={onSwitchToOrg} title="Switch to the org-chart builder">Org chart…</button>

        <div className="spacer" />

        <button onClick={undo} disabled={!history.length} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">↪ Redo</button>

        <span className="divider" />

        <button onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.15).toFixed(2)))}>−</button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}>+</button>
        <button onClick={() => setZoom(1)}>100%</button>
        <button onClick={fit} title="Fit map to screen">Fit</button>

        <span className="divider" />

        <button
          className="copy-btn"
          title="Copy the map as an image"
          onClick={() => {
            const svg = getSvg()
            if (!svg) return
            copyPngToClipboard(svg)
              .then(() => setCopyState('done'))
              .catch(() => setCopyState('error'))
              .finally(() => window.setTimeout(() => setCopyState('idle'), 2000))
          }}
        >
          {copyState === 'done' ? '✓ Copied' : copyState === 'error' ? 'Copy failed' : 'Copy image'}
        </button>
        <button onClick={() => { const svg = getSvg(); if (svg) exportSvg(svg, doc.meta.title) }}>Export SVG</button>
        <button onClick={() => { const svg = getSvg(); if (svg) void exportPng(svg, doc.meta.title, 2) }}>PNG 2×</button>
        <button onClick={() => { const svg = getSvg(); if (svg) void exportPptx(svg, doc.meta.title) }}>PPTX</button>
        <button onClick={() => { const svg = getSvg(); if (svg) void exportPdf(svg, doc.meta.title) }}>PDF</button>

        <span className="divider" />

        <button onClick={() => download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${safeName(doc.meta.title)}.json`)}>
          Save JSON
        </button>
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
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <div className="main">
        <MapEditor chart={doc} onChange={setDoc} selectedId={selectedId} onSelect={setSelectedId} width={SIDEBAR_W} />
        <div className="canvas-wrap">
          <div
            className="canvas"
            ref={canvasRef}
            tabIndex={0}
            aria-label="U.S. map canvas. Click a star or card to select; drag to reposition."
            onClick={() => {
              if (movedRef.current) {
                movedRef.current = false
                return
              }
              setSelectedId(null)
            }}
          >
            {doc.sites.length === 0 ? (
              <div className="empty-state" onClick={(e) => e.stopPropagation()}>
                <h2>No sites yet</h2>
                <p>Add a work location from the panel, then place it on the map and list its positions.</p>
                <button onClick={() => { const r = addSite(doc); setDoc(r.chart); setSelectedId(r.newId) }}>
                  + Add a site
                </button>
              </div>
            ) : (
              <div
                ref={svgHostRef}
                className="svg-host"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                <MapSvg
                  layout={view}
                  selectedId={selectedId}
                  onSelect={selectSite}
                  onStarPointerDown={onStarPointerDown}
                  onCardPointerDown={onCardPointerDown}
                  onCardResizeStart={onCardResizeStart}
                  ariaLabel={`${doc.meta.title || 'U.S.'} map, ${doc.sites.length} sites`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  )
}
