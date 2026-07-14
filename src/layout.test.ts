import { describe, expect, it } from 'vitest'
import { layoutChart, textWidth, wrapText } from './layout'
import type { OrgChart } from './model'
import { templates } from './templates'

describe('text metrics', () => {
  it('measures wider strings as wider', () => {
    expect(textWidth('', 12)).toBe(0)
    expect(textWidth('WWWW', 12)).toBeGreaterThan(textWidth('iiii', 12))
  })

  it('scales with font size', () => {
    expect(textWidth('Astrion', 24)).toBeCloseTo(textWidth('Astrion', 12) * 2, 5)
  })

  it('wraps text that exceeds the max width', () => {
    const long = wrapText('one two three four five six seven eight', 12, 60)
    expect(long.length).toBeGreaterThan(1)
    expect(wrapText('short', 12, 400)).toEqual(['short'])
  })
})

describe('layoutChart', () => {
  it('places nodes and produces positive canvas bounds', () => {
    const layout = layoutChart(templates[0].build())
    expect(layout.placed.length).toBeGreaterThan(0)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('sizes the title accent bar to the title, and hides it when disabled', () => {
    const withTitle = layoutChart(templates[0].build())
    expect(withTitle.title).not.toBeNull()
    expect(withTitle.title!.w).toBeGreaterThan(0)

    const longer: OrgChart = {
      version: 1,
      meta: { title: 'A Considerably Longer Chart Title', showTitle: true },
      roots: [{ id: 'a', title: 'A', variant: 'primary' }],
      groups: [],
      comms: [],
      legend: [],
    }
    const shorter: OrgChart = { ...longer, meta: { title: 'Short', showTitle: true } }
    expect(layoutChart(longer).title!.w).toBeGreaterThan(layoutChart(shorter).title!.w)

    const hidden: OrgChart = { ...longer, meta: { title: 'X', showTitle: false } }
    expect(layoutChart(hidden).title).toBeNull()
  })
})
