import { useEffect, useRef } from 'react'
import { LOCATIONS } from './locations'
import {
  addLcat,
  addSite,
  applyLocation,
  deleteLcat,
  deleteSite,
  findSite,
  mapFteTotal,
  mapKpTotal,
  moveLcat,
  setSiteCard,
  setSiteCardWidth,
  siteFte,
  siteKp,
  updateLcat,
  updateSite,
  type MapChart,
} from './mapModel'

interface Props {
  chart: MapChart
  onChange: (next: MapChart) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  width: number
}

const CONUS = LOCATIONS.filter((l) => l.geo)
const OCONUS = LOCATIONS.filter((l) => l.oconus)

function SiteList({ chart, selectedId, onSelect }: Omit<Props, 'onChange' | 'width'>) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectedId) listRef.current?.querySelector('.tree-row.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])
  return (
    <div className="tree" role="list" aria-label="Sites" ref={listRef}>
      {chart.sites.map((s) => (
        <button
          key={s.id}
          role="listitem"
          className={`tree-row${s.id === selectedId ? ' selected' : ''}`}
          onClick={() => onSelect(s.id)}
        >
          <span className={`dot ${s.oconus || !s.geo ? 'dot-accent' : 'dot-primary'}`} />
          <span className="tree-title">{s.name || '(unnamed site)'}</span>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {siteFte(s)} FTE{siteKp(s) ? ` · ${siteKp(s)} KP` : ''}
          </span>
        </button>
      ))}
    </div>
  )
}

function SiteEditor({ chart, onChange, selectedId, onSelect }: Omit<Props, 'width'>) {
  const site = selectedId ? findSite(chart, selectedId) : null
  if (!site) return <p className="hint">Select a site, or add one, to edit its positions and location.</p>

  const patch = (p: Parameters<typeof updateSite>[2]) => onChange(updateSite(chart, site.id, p))

  return (
    <div className="editor">
      <div className="btn-row">
        <button className="danger" onClick={() => { onChange(deleteSite(chart, site.id)); onSelect(null) }}>
          Delete site
        </button>
      </div>

      <label>Location name
        <input value={site.name} placeholder="Huntsville, AL" onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <label>Place from list
        <select
          value={site.locationId ?? ''}
          onChange={(e) => {
            const loc = LOCATIONS.find((l) => l.id === e.target.value)
            if (loc) onChange(applyLocation(chart, site.id, loc))
            else patch({ locationId: undefined })
          }}
        >
          <option value="">Custom (drag the star on the map)</option>
          <optgroup label="CONUS / AK / HI">
            {CONUS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </optgroup>
          <optgroup label="OCONUS">
            {OCONUS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </optgroup>
        </select>
      </label>

      <div className="two-col">
        <label className="check">
          <input
            type="checkbox"
            checked={!!site.oconus}
            onChange={(e) => patch({ oconus: e.target.checked || undefined })}
          />
          OCONUS (list below map)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={!!site.collapsed}
            onChange={(e) => patch({ collapsed: e.target.checked || undefined })}
          />
          Collapse to a total chip
        </label>
      </div>
      {!site.geo && !site.oconus && (
        <p className="hint">No position yet. Pick a location above, or drag a star onto the map.</p>
      )}
      {(site.card || site.cardWidth) && (
        <div className="btn-row">
          <button
            className="sm"
            onClick={() => onChange(setSiteCardWidth(setSiteCard(chart, site.id, null), site.id, null))}
          >
            ⤺ Reset card position &amp; size
          </button>
          <span className="hint">Drag the card to move it; drag its edge handle to resize.</span>
        </div>
      )}

      <fieldset>
        <legend>Positions (LCATs) — {siteFte(site)} FTE · {siteKp(site)} key personnel</legend>
        {site.lcats.map((l, i) => (
          <div key={l.id} className="card">
            <div className="detail-row">
              <input
                className="detail-text"
                value={l.title}
                placeholder="Position (e.g. Program Manager)"
                onChange={(e) => onChange(updateLcat(chart, site.id, l.id, { title: e.target.value }))}
              />
              <button className="sm" disabled={i === 0} onClick={() => onChange(moveLcat(chart, site.id, l.id, -1))} aria-label="Move up">↑</button>
              <button className="sm" disabled={i === site.lcats.length - 1} onClick={() => onChange(moveLcat(chart, site.id, l.id, 1))} aria-label="Move down">↓</button>
              <button className="danger sm" onClick={() => onChange(deleteLcat(chart, site.id, l.id))} aria-label="Delete position">×</button>
            </div>
            <input
              value={l.lcat ?? ''}
              placeholder="LCAT label (optional, e.g. Sr. Systems Analyst III)"
              onChange={(e) => onChange(updateLcat(chart, site.id, l.id, { lcat: e.target.value || undefined }))}
            />
            <div className="two-col">
              <label>FTEs
                <input
                  type="number"
                  min={0}
                  value={l.fte}
                  onChange={(e) => onChange(updateLcat(chart, site.id, l.id, { fte: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
              <label>Key personnel
                <input
                  type="number"
                  min={0}
                  value={l.keyPersonnel}
                  onChange={(e) => onChange(updateLcat(chart, site.id, l.id, { keyPersonnel: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
            </div>
          </div>
        ))}
        <button onClick={() => { const r = addLcat(chart, site.id); onChange(r.chart) }}>+ Position</button>
      </fieldset>
    </div>
  )
}

export function MapEditor({ chart, onChange, selectedId, onSelect, width }: Props) {
  const fontSize = Math.min(18, Math.max(13, 14 + (width - 340) * 0.009))
  return (
    <aside className="side-panel" style={{ width, minWidth: width, maxWidth: width, fontSize: `${fontSize}px` }}>
      <div className="editor">
        <label>Map title
          <input
            value={chart.meta.title}
            onChange={(e) => onChange({ ...chart, meta: { ...chart.meta, title: e.target.value } })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={chart.meta.showTitle}
            onChange={(e) => onChange({ ...chart, meta: { ...chart.meta, showTitle: e.target.checked } })}
          />
          Show title on the map
        </label>
        <p className="hint">
          {chart.sites.length} sites · {mapFteTotal(chart)} FTE · {mapKpTotal(chart)} key personnel
        </p>
        <div className="btn-row">
          <button onClick={() => { const r = addSite(chart); onChange(r.chart); onSelect(r.newId) }}>+ Add site</button>
        </div>
      </div>
      <SiteList chart={chart} selectedId={selectedId} onSelect={onSelect} />
      <SiteEditor chart={chart} onChange={onChange} selectedId={selectedId} onSelect={onSelect} />
    </aside>
  )
}
