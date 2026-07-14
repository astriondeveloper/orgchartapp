import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  BadgeType,
  CommLink,
  Density,
  Direction,
  EdgeArrow,
  EdgeStyle,
  LayoutMode,
  LegendMarker,
  OrgChart,
  OrgNode,
  Variant,
} from './model'
import {
  addChild,
  addRoot,
  addSibling,
  allNodes,
  clone,
  deleteNode,
  edgeArrow,
  findNode,
  moveNode,
  normalizeChart,
  setNodePos,
  uid,
  updateNode,
} from './model'
import { palette } from './theme'
import type { ZoneStyle } from './theme'

interface Props {
  chart: OrgChart
  onChange: (next: OrgChart) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const VARIANTS: { value: Variant; label: string }[] = [
  { value: 'primary', label: 'Primary (Astrion Force purple)' },
  { value: 'secondary', label: 'Secondary (Astrion Sky blue)' },
  { value: 'tertiary', label: 'Tertiary (Daylight light blue)' },
  { value: 'accent', label: 'Accent (Supernova orange)' },
  { value: 'hidden', label: 'Invisible container' },
]

const BADGES: { value: BadgeType; label: string }[] = [
  { value: 'keyGold', label: 'Gold key (RFP Required)' },
  { value: 'keyGray', label: 'Gray key (Company Designated)' },
  { value: 'cornerAccent', label: 'Corner marker (Twilight)' },
]

const MARKERS: { value: LegendMarker; label: string }[] = [
  { value: 'keyGold', label: 'Gold key' },
  { value: 'keyGray', label: 'Gray key' },
  { value: 'cornerAccent', label: 'Corner marker' },
  { value: 'boxPrimary', label: 'Force (purple) box' },
  { value: 'boxSecondary', label: 'Sky (blue) box' },
  { value: 'boxTertiary', label: 'Daylight (light blue) box' },
  { value: 'boxAccent', label: 'Supernova (orange) box' },
  { value: 'green', label: 'Green zone' },
  { value: 'blue', label: 'Blue zone' },
  { value: 'orange', label: 'Orange zone' },
  { value: 'dashed', label: 'Dashed container' },
  { value: 'comm', label: 'Comm arrow' },
]

const LAYOUT_MODES: { value: LayoutMode; label: string }[] = [
  { value: 'tree', label: 'Tree (hierarchy)' },
  { value: 'radial', label: 'Radial (rings)' },
  { value: 'layered', label: 'Layered (ranked rows)' },
  { value: 'matrix', label: 'Matrix (grid by group)' },
  { value: 'swimlane', label: 'Swimlane (lanes by group)' },
]

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact (fits a page)' },
]

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'TB', label: 'Top-down ↓' },
  { value: 'BT', label: 'Bottom-up ↑' },
  { value: 'LR', label: 'Left-right →' },
  { value: 'RL', label: 'Right-left ←' },
]

const EDGE_STYLES: { value: EdgeStyle; label: string }[] = [
  { value: 'solid', label: 'Solid line' },
  { value: 'dashed', label: 'Dashed line' },
]

const EDGE_ARROWS: { value: EdgeArrow; label: string }[] = [
  { value: 'both', label: 'Arrows: both ⇄' },
  { value: 'end', label: 'Arrow: to → ' },
  { value: 'start', label: 'Arrow: from ←' },
  { value: 'none', label: 'Arrows: none' },
]

const ZONE_STYLES: { value: ZoneStyle; label: string }[] = [
  { value: 'green', label: 'Tint — green' },
  { value: 'blue', label: 'Tint — blue' },
  { value: 'orange', label: 'Tint — orange' },
  { value: 'dashed', label: 'Dashed container' },
]

/**
 * Every Astrion brand color, derived straight from the palette so the picker is
 * always the complete brand set and never drifts. Off-brand colors are not
 * offered — the per-box color override is restricted to these values.
 */
const COLOR_SWATCHES: { label: string; color: string }[] = Object.entries(palette).map(
  ([key, color]) => ({ label: key.charAt(0).toUpperCase() + key.slice(1), color }),
)

function NodeTree({ chart, selectedId, onSelect }: Omit<Props, 'onChange'>) {
  const rows = allNodes(chart)
  const treeRef = useRef<HTMLDivElement>(null)
  const selIdx = rows.findIndex((r) => r.node.id === selectedId)
  // Roving tabindex: exactly one row is tabbable, and arrow keys move focus.
  const [focusIdx, setFocusIdx] = useState(0)
  // Clamp so a row stays tabbable even after the tree shrinks (e.g. a delete).
  const activeIdx = Math.min(focusIdx, rows.length - 1)

  // Track the current selection as the roving-focus row.
  useEffect(() => {
    if (selIdx >= 0) setFocusIdx(selIdx)
  }, [selIdx])

  // When the selection changes (e.g. a box was clicked in the chart), reveal
  // its row in the tree so the left side always tracks the current node.
  useEffect(() => {
    if (!selectedId) return
    const el = treeRef.current?.querySelector('.tree-row.selected')
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const focusRow = (i: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, i))
    setFocusIdx(clamped)
    treeRef.current?.querySelectorAll<HTMLButtonElement>('.tree-row')[clamped]?.focus()
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') focusRow(focusIdx + 1)
    else if (e.key === 'ArrowUp') focusRow(focusIdx - 1)
    else if (e.key === 'Home') focusRow(0)
    else if (e.key === 'End') focusRow(rows.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div className="tree" role="tree" aria-label="Chart boxes" ref={treeRef} onKeyDown={onKeyDown}>
      {rows.map(({ node, depth }, i) => (
        <button
          key={node.id}
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={node.id === selectedId}
          className={`tree-row${node.id === selectedId ? ' selected' : ''}`}
          tabIndex={i === activeIdx ? 0 : -1}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => { setFocusIdx(i); onSelect(node.id) }}
        >
          <span
            className={`dot dot-${node.variant}`}
            style={node.color ? { background: node.color, border: 'none' } : undefined}
          />
          <span className="tree-title">{node.title || '(untitled)'}</span>
        </button>
      ))}
    </div>
  )
}

function NodeEditor({ chart, onChange, selectedId, onSelect }: Props) {
  const node = selectedId ? findNode(chart, selectedId) : null
  if (!node) return <p className="hint">Select a box in the chart or tree to edit it.</p>

  const patch = (p: Partial<OrgNode>) => onChange(updateNode(chart, node.id, p))
  const toggleBadge = (b: BadgeType) => {
    const badges = node.badges ?? []
    patch({ badges: badges.includes(b) ? badges.filter((x) => x !== b) : [...badges, b] })
  }

  return (
    <div className="editor">
      <div className="btn-row">
        <button onClick={() => { const r = addChild(chart, node.id); onChange(r.chart); onSelect(r.newId) }}>+ Child</button>
        <button onClick={() => { const r = addSibling(chart, node.id); onChange(r.chart); onSelect(r.newId) }}>+ Sibling</button>
        <button onClick={() => onChange(moveNode(chart, node.id, -1))}>↑</button>
        <button onClick={() => onChange(moveNode(chart, node.id, 1))}>↓</button>
        <button className="danger" onClick={() => { onChange(deleteNode(chart, node.id)); onSelect(null) }}>Delete</button>
      </div>

      <label>Title
        <input value={node.title} onChange={(e) => patch({ title: e.target.value })} />
      </label>
      <label>Person name (italic)
        <input value={node.name ?? ''} onChange={(e) => patch({ name: e.target.value || undefined })} />
      </label>
      <div className="two-col">
        <label>Style
          <select value={node.variant} onChange={(e) => patch({ variant: e.target.value as Variant })}>
            {VARIANTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>
        <label>Children layout
          <select value={node.childLayout ?? 'row'} onChange={(e) => patch({ childLayout: e.target.value as 'row' | 'stack' })}>
            <option value="row">Side by side</option>
            <option value="stack">Stacked list</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Box color (Astrion brand)</legend>
        <div className="swatches">
          {COLOR_SWATCHES.map(({ label, color }) => (
            <button
              key={color}
              type="button"
              title={`${label} ${color}`}
              className={`swatch-btn${node.color === color ? ' active' : ''}`}
              style={{ background: color }}
              onClick={() => patch({ color })}
            />
          ))}
        </div>
        <button className="sm" disabled={!node.color} onClick={() => patch({ color: undefined })}>
          Use style color
        </button>
        <p className="hint">
          Brand colors only. Overrides the Style color for this box; the text color adjusts
          automatically for contrast. Clear it to fall back to the Style color.
        </p>
      </fieldset>

      <div className="two-col">
        <label>Width (px, blank = auto)
          <input
            type="number"
            value={node.width ?? ''}
            placeholder="190"
            onChange={(e) => patch({ width: e.target.value ? Math.max(80, Number(e.target.value)) : undefined })}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={!!node.photo} onChange={(e) => patch({ photo: e.target.checked || undefined })} />
          Photo placeholder
        </label>
      </div>

      {node.pos && (
        <div className="btn-row">
          <button className="sm" onClick={() => onChange(setNodePos(chart, node.id, null))}>
            ⤺ Reset to auto position
          </button>
          <span className="hint">Manually placed. Drag boxes on the canvas to reposition.</span>
        </div>
      )}

      <fieldset>
        <legend>Badges</legend>
        {BADGES.map((b) => (
          <label key={b.value} className="check">
            <input
              type="checkbox"
              checked={(node.badges ?? []).includes(b.value)}
              onChange={() => toggleBadge(b.value)}
            />
            {b.label}
          </label>
        ))}
      </fieldset>

      <label>Bullets (one per line)
        <textarea
          rows={4}
          value={(node.bullets ?? []).join('\n')}
          onChange={(e) =>
            patch({ bullets: e.target.value ? e.target.value.split('\n').filter((s) => s.trim()) : undefined })
          }
        />
      </label>

      <fieldset>
        <legend>Detail rows (PWS / Deliverables / Interface)</legend>
        {(node.details ?? []).map((d, i) => (
          <div key={i} className="detail-row">
            <input
              className="detail-label"
              value={d.label}
              placeholder="PWS:"
              onChange={(e) => {
                const details = clone(node.details ?? [])
                details[i] = { ...details[i], label: e.target.value }
                patch({ details })
              }}
            />
            <input
              className="detail-text"
              value={d.text}
              placeholder="3.1 – 3.3"
              onChange={(e) => {
                const details = clone(node.details ?? [])
                details[i] = { ...details[i], text: e.target.value }
                patch({ details })
              }}
            />
            <button
              className="danger sm"
              onClick={() => patch({ details: (node.details ?? []).filter((_, j) => j !== i) })}
            >×</button>
          </div>
        ))}
        <button onClick={() => patch({ details: [...(node.details ?? []), { label: 'PWS:', text: '' }] })}>
          + Detail row
        </button>
      </fieldset>
    </div>
  )
}

function ChartEditor({ chart, onChange, onSelect }: Props) {
  const nodes = allNodes(chart)
  const options = nodes
    .filter(({ node }) => node.variant !== 'hidden')
    .map(({ node }) => ({ id: node.id, label: node.title || '(untitled)' }))

  return (
    <div className="editor">
      <label>Chart title
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
        Show title on chart
      </label>
      <label>Layout
        <select
          value={chart.meta.layout ?? 'tree'}
          onChange={(e) => onChange({ ...chart, meta: { ...chart.meta, layout: e.target.value as LayoutMode } })}
        >
          {LAYOUT_MODES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>
      <label>Flow direction
        <select
          value={chart.meta.direction ?? 'TB'}
          disabled={(chart.meta.layout ?? 'tree') !== 'tree'}
          onChange={(e) => onChange({ ...chart, meta: { ...chart.meta, direction: e.target.value as Direction } })}
        >
          {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <label>Density
        <select
          value={chart.meta.density ?? 'comfortable'}
          onChange={(e) => onChange({ ...chart, meta: { ...chart.meta, density: e.target.value as Density } })}
        >
          {DENSITIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <button onClick={() => { const r = addRoot(chart); onChange(r.chart); onSelect(r.newId) }}>
        + Add independent tree / column
      </button>

      <fieldset>
        <legend>Group zones</legend>
        {chart.groups.map((g, gi) => (
          <div key={g.id} className="card">
            <div className="detail-row">
              <input
                value={g.label ?? ''}
                placeholder="Zone label"
                onChange={(e) => {
                  const groups = clone(chart.groups)
                  groups[gi] = { ...groups[gi], label: e.target.value }
                  onChange({ ...chart, groups })
                }}
              />
              <select
                value={g.style}
                aria-label="Zone style"
                onChange={(e) => {
                  const groups = clone(chart.groups)
                  groups[gi] = { ...groups[gi], style: e.target.value as ZoneStyle }
                  onChange({ ...chart, groups })
                }}
              >
                {ZONE_STYLES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
              </select>
              <button
                className="danger sm"
                onClick={() => onChange({ ...chart, groups: chart.groups.filter((x) => x.id !== g.id) })}
              >×</button>
            </div>
            <div className="member-list">
              {options.map((o) => (
                <label key={o.id} className="check">
                  <input
                    type="checkbox"
                    checked={g.memberIds.includes(o.id)}
                    onChange={(e) => {
                      const groups = clone(chart.groups)
                      const set = new Set(groups[gi].memberIds)
                      if (e.target.checked) set.add(o.id)
                      else set.delete(o.id)
                      groups[gi] = { ...groups[gi], memberIds: [...set] }
                      onChange({ ...chart, groups })
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() =>
            onChange({
              ...chart,
              groups: [...chart.groups, { id: uid('g'), label: 'Mission Focus', style: 'green', memberIds: [] }],
            })
          }
        >+ Group zone</button>
      </fieldset>

      <fieldset>
        <legend>Edges (connections)</legend>
        {chart.comms.map((c, ci) => {
          const patchEdge = (p: Partial<CommLink>) => {
            const comms = clone(chart.comms)
            comms[ci] = { ...comms[ci], ...p }
            onChange({ ...chart, comms })
          }
          return (
            <div key={c.id} className="card">
              <div className="detail-row">
                <select value={c.fromId} aria-label="Edge from" onChange={(e) => patchEdge({ fromId: e.target.value })}>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <span className="arrow">→</span>
                <select value={c.toId} aria-label="Edge to" onChange={(e) => patchEdge({ toId: e.target.value })}>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button
                  className="danger sm"
                  onClick={() => onChange({ ...chart, comms: chart.comms.filter((x) => x.id !== c.id) })}
                >×</button>
              </div>
              <div className="two-col">
                <select value={c.style ?? 'solid'} aria-label="Edge line style" onChange={(e) => patchEdge({ style: e.target.value as EdgeStyle })}>
                  {EDGE_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={edgeArrow(c)} aria-label="Edge arrows" onChange={(e) => patchEdge({ arrow: e.target.value as EdgeArrow })}>
                  {EDGE_ARROWS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <input
                value={c.label ?? ''}
                placeholder="Edge label (optional)"
                onChange={(e) => patchEdge({ label: e.target.value || undefined })}
              />
            </div>
          )
        })}
        <button
          disabled={options.length < 2}
          onClick={() =>
            onChange({
              ...chart,
              comms: [
                ...chart.comms,
                { id: uid('c'), fromId: options[0].id, toId: options[1].id, arrow: 'both', style: 'solid' },
              ],
            })
          }
        >+ Edge</button>
      </fieldset>

      <fieldset>
        <legend>Legend</legend>
        {chart.legend.map((l, li) => (
          <div key={l.id} className="detail-row">
            <select
              value={l.marker}
              aria-label="Legend marker"
              onChange={(e) => {
                const legend = clone(chart.legend)
                legend[li] = { ...legend[li], marker: e.target.value as LegendMarker }
                onChange({ ...chart, legend })
              }}
            >
              {MARKERS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input
              value={l.label}
              placeholder="Legend label"
              onChange={(e) => {
                const legend = clone(chart.legend)
                legend[li] = { ...legend[li], label: e.target.value }
                onChange({ ...chart, legend })
              }}
            />
            <button
              className="danger sm"
              onClick={() => onChange({ ...chart, legend: chart.legend.filter((x) => x.id !== l.id) })}
            >×</button>
          </div>
        ))}
        <button
          onClick={() =>
            onChange({ ...chart, legend: [...chart.legend, { id: uid('l'), marker: 'keyGold', label: 'RFP Required' }] })
          }
        >+ Legend item</button>
      </fieldset>

      <fieldset>
        <legend>Astrion brand palette (locked)</legend>
        <div className="swatches">
          {COLOR_SWATCHES.map(({ label, color }) => (
            <div key={label} className="swatch">
              <span style={{ background: color }} />
              <small>{label}<br />{color}</small>
            </div>
          ))}
        </div>
        <p className="hint">
          Colors per the Astrion Brand Standards (Dec 2023 V.1). Edit <code>src/theme.ts</code> to
          update tokens globally.
        </p>
      </fieldset>
    </div>
  )
}

function JsonEditor({ chart, onChange }: Pick<Props, 'chart' | 'onChange'>) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(JSON.stringify(chart, null, 2))
    setError(null)
  }, [chart])

  return (
    <div className="editor">
      <p className="hint">
        The full chart definition. Save this JSON with your proposal to reproduce the chart exactly.
      </p>
      <textarea className="json" rows={24} value={text} aria-label="Chart JSON" onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {error && <p className="error">{error}</p>}
      <div className="btn-row">
        <button
          onClick={() => {
            try {
              // Validates, fills defaults, and enforces brand-only colors.
              onChange(normalizeChart(JSON.parse(text)))
              setError(null)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Invalid JSON')
            }
          }}
        >Apply JSON</button>
        <button onClick={() => navigator.clipboard.writeText(text)}>Copy</button>
      </div>
    </div>
  )
}

export function SidePanel({ width, ...props }: Props & { width: number }) {
  const [tab, setTab] = useState<'build' | 'chart' | 'json'>('build')

  // Selecting a box anywhere (including clicking it in the chart) jumps the
  // panel to the Boxes tab so its editor and tree row are shown immediately.
  useEffect(() => {
    if (props.selectedId) setTab('build')
  }, [props.selectedId])

  // Scale the panel's text with its width so a wider panel reads larger. Every
  // inner font size is defined in em, so they all track this single base.
  const fontSize = Math.min(18, Math.max(13, 14 + (width - 340) * 0.009))
  return (
    <aside
      className="side-panel"
      style={{ width, minWidth: width, maxWidth: width, fontSize: `${fontSize}px` }}
    >
      <div className="tabs" role="group" aria-label="Editor sections">
        <button aria-pressed={tab === 'build'} className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>Boxes</button>
        <button aria-pressed={tab === 'chart'} className={tab === 'chart' ? 'active' : ''} onClick={() => setTab('chart')}>Chart</button>
        <button aria-pressed={tab === 'json'} className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>JSON</button>
      </div>
      {tab === 'build' && (
        <>
          <NodeTree chart={props.chart} selectedId={props.selectedId} onSelect={props.onSelect} />
          <NodeEditor {...props} />
        </>
      )}
      {tab === 'chart' && <ChartEditor {...props} />}
      {tab === 'json' && <JsonEditor chart={props.chart} onChange={props.onChange} />}
    </aside>
  )
}
