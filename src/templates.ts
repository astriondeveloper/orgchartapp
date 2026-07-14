import type { OrgChart, OrgNode } from './model'
import { uid } from './model'

/*
 * Starter templates modeled on the org-chart patterns used in Astrion
 * proposals. Each returns a fresh chart with new ids so several instances
 * can coexist.
 */

function node(partial: Partial<OrgNode> & { title: string }): OrgNode {
  return { id: uid(), variant: 'secondary', childLayout: 'row', ...partial }
}

/** Template 1 — program office with stacked capability lists + corner markers. */
function programOffice(): OrgChart {
  const cap = (title: string): OrgNode =>
    node({ title, variant: 'tertiary', badges: ['cornerAccent'] })

  const divisions: OrgNode[] = [
    node({
      title: 'Advanced Manufacturing',
      childLayout: 'stack',
      children: [
        cap('Precision Cleaning'),
        cap('Electrical / Mechanical Assembly'),
        cap('Planning, Estimating & Logistics'),
        cap('Fabrication'),
      ],
    }),
    node({ title: 'Environmental Gas Laboratory' }),
    node({
      title: 'Fluid & Structural and Strength Dynamics',
      childLayout: 'stack',
      children: [cap('Fluid Dynamics'), cap('Structural & Strength Dynamics')],
    }),
    node({
      title: 'Propulsion Test',
      childLayout: 'stack',
      children: [
        cap('Mechanical'),
        cap('Trades'),
        cap('Controls / Instrumentation, Data Acquisition'),
      ],
    }),
    node({
      title: 'Pressurant Propellants & Valve Laboratory',
      childLayout: 'stack',
      children: [
        cap('Valve and Component Laboratory'),
        cap('Pressurant & Propellant Delivery Systems'),
      ],
    }),
    node({ title: 'Metrology & Calibration Laboratory' }),
  ]

  return {
    version: 1,
    meta: { title: 'Program Organization', showTitle: true },
    roots: [
      node({
        title: 'Office of Program Manager',
        variant: 'primary',
        width: 260,
        children: [
          node({
            title: 'Safety, Health, Environmental, & Quality',
            variant: 'primary',
            width: 230,
            childLayout: 'stack',
            children: [cap('NDE Laboratory')],
          }),
          ...divisions,
          node({ title: 'Program Business Office', variant: 'primary', width: 220 }),
        ],
      }),
    ],
    groups: [],
    comms: [],
    legend: [{ id: uid('l'), marker: 'cornerAccent', label: 'Similar Technical Support Areas' }],
  }
}

/** Template 2 — director level with PWS / Deliverables / Interface rows,
 *  key badges and a Mission Focus zone. */
function directorLevel(): OrgChart {
  const missionDirectors: OrgNode[] = [
    node({
      title: 'Modernization Director',
      badges: ['keyGray'],
      width: 210,
      bullets: ['Capital Improvement', 'Infrastructure Improvement', 'Surge Project Support'],
      details: [
        { label: 'PWS:', text: '3.8' },
        { label: 'Deliverables:', text: 'A047-A049, A051-A054' },
        { label: 'Interface:', text: 'Customer TSDC' },
      ],
    }),
    node({
      title: 'Test Operations Director',
      badges: ['keyGray'],
      width: 230,
      bullets: ['Turbine Engine', 'Wind Tunnel & Aerodynamics', 'Space & Missile', 'Hypersonics'],
      details: [
        { label: 'PWS:', text: '3.1-3.3, 3.19.23, 3.19.24, 3.21' },
        { label: 'Deliverables:', text: 'A003-A007, A010, A021' },
        { label: 'Interface:', text: '704th TG; 804th TG; TSD' },
      ],
    }),
    node({
      title: 'Engineering & Technical Support Director',
      badges: ['keyGray'],
      width: 240,
      bullets: ['ID&C', 'TMDE', 'Digital Modernization', 'Test Technology / Design Engineering'],
      details: [
        { label: 'PWS:', text: '3.1.9-3.1.12, 3.3.3, 3.6, 3.7, 3.10' },
        { label: 'Deliverables:', text: 'A009, A022, A027, A032-A046' },
        { label: 'Interface:', text: 'Customer TSDI' },
      ],
    }),
    node({
      title: 'Asset Management Director',
      badges: ['keyGray'],
      width: 220,
      bullets: ['Predictive Maintenance', 'Plant / Test Cell Support', 'Utilities / Base Support'],
      details: [
        { label: 'PWS:', text: '3.3.11, 3.5, 3.9, 3.11-3.13' },
        { label: 'Deliverables:', text: 'A018, A022-A031, A050' },
        { label: 'Interface:', text: 'Customer TSDC' },
      ],
    }),
  ]

  const dgm = node({
    title: 'Deputy General Manager / Program Integration Office',
    variant: 'primary',
    name: 'Deputy GM Name',
    photo: true,
    badges: ['keyGold'],
    width: 330,
    details: [
      { label: 'PWS:', text: '3.4, 3.18.1, 3.18.4, 3.18.5, 3.20' },
      { label: 'Deliverables:', text: 'A008, A019-A021, A109, A113' },
      { label: 'Interface:', text: 'Customer CV; Customer PM' },
    ],
    children: [
      node({
        title: 'Business Director',
        badges: ['keyGray'],
        width: 210,
        bullets: ['Finance; Business Systems', 'Logistics; Procurement', 'Public Affairs'],
        details: [
          { label: 'PWS:', text: '2.2, 2.3, 3.3.8, 3.15-3.17' },
          { label: 'Deliverables:', text: 'A076-A087, A115-A116' },
        ],
      }),
      ...missionDirectors,
      node({
        title: 'Talent Management Director',
        badges: ['keyGray'],
        width: 200,
        bullets: ['Hiring / Recruiting; HR', 'Labor Relations; Training'],
        details: [
          { label: 'PWS:', text: '2.4, 3.19.4' },
          { label: 'Deliverables:', text: 'A001-A002, A092' },
        ],
      }),
    ],
  })

  const chart: OrgChart = {
    version: 1,
    meta: { title: 'Program Leadership Organization', showTitle: true },
    roots: [
      node({
        title: 'General Manager',
        variant: 'primary',
        name: 'GM Name',
        photo: true,
        badges: ['keyGold'],
        width: 250,
        details: [
          { label: 'PWS:', text: '2.1' },
          { label: 'Interface:', text: 'Customer CO, COR, CC' },
        ],
        children: [
          node({
            title: 'Safety & Mission Assurance Director',
            variant: 'primary',
            badges: ['keyGold'],
            width: 250,
            bullets: ['Mission Assurance / Performance Mgmt', 'Health, Safety, Environmental', 'Quality'],
            details: [
              { label: 'PWS:', text: '3.14, 3.18.6, 3.19.1, 3.24, 3.25' },
              { label: 'Interface:', text: 'Customer SE' },
            ],
          }),
          dgm,
        ],
      }),
    ],
    groups: [
      {
        id: uid('g'),
        label: 'Mission Focus',
        style: 'green',
        memberIds: missionDirectors.map((d) => d.id),
      },
    ],
    comms: [],
    legend: [
      { id: uid('l'), marker: 'keyGold', label: 'RFP Required' },
      { id: uid('l'), marker: 'keyGray', label: 'Company Designated' },
      { id: uid('l'), marker: 'green', label: 'Mission Focus' },
    ],
  }
  return chart
}

/** Template 3 — PMO with corporate/customer columns and communication channels. */
function pmoComms(): OrgChart {
  const corp: OrgNode[] = [
    node({ title: 'Executive Management Council', variant: 'accent', width: 210 }),
    node({ title: 'Transition Team', width: 210 }),
    node({ title: 'Quality / Risk Manager', name: 'Manager Name', width: 210 }),
    node({ title: 'Human Resources', width: 210 }),
    node({ title: 'Resource Allocation Board', variant: 'accent', width: 210 }),
    node({ title: 'Corporate Support Hub', width: 210 }),
  ]
  const customer: OrgNode[] = [
    node({ title: 'Customer & PMO Leadership', variant: 'tertiary', width: 200 }),
    node({ title: 'CO / COR / PM', variant: 'tertiary', width: 200 }),
    node({ title: 'Managers', variant: 'tertiary', width: 200 }),
    node({ title: 'Task Leads', variant: 'tertiary', width: 200 }),
  ]

  const taskLeads = [
    node({ title: 'TO 1 Task Lead', variant: 'primary', width: 130 }),
    node({ title: 'TO 2 Task Lead', variant: 'accent', width: 130 }),
    node({ title: 'TO 3 Task Lead', variant: 'primary', width: 130 }),
    node({ title: 'TO n Task Lead', variant: 'accent', width: 130 }),
  ]

  const contractsDir = node({
    title: 'Contracts Director',
    name: 'Director Name',
    width: 210,
    children: [node({ title: 'Subcontracts Manager', name: 'Manager Name', width: 210 })],
  })
  const ociMgr = node({
    title: 'OCI Manager',
    name: 'Manager Name',
    width: 200,
    children: [node({ title: 'Financial Manager', name: 'Manager Name', width: 200 })],
  })
  const itomt = node({
    title: 'Integrated Task Order Management Team',
    width: 300,
    children: [
      node({
        title: 'Task Order Manager',
        name: 'Manager Name',
        width: 300,
        children: [
          node({
            title: 'Functional Task Area Leads (20)',
            width: 300,
            children: taskLeads,
          }),
        ],
      }),
    ],
  })

  const dpm = node({
    title: 'Deputy Program Manager',
    variant: 'primary',
    name: 'Deputy PM Name',
    width: 300,
    children: [ociMgr, contractsDir, itomt],
  })
  const cpm = node({
    title: 'Contract Program Manager',
    variant: 'primary',
    name: 'PM Name',
    width: 300,
    children: [dpm],
  })
  const gm = node({
    title: 'Civilian Division, EVP & GM',
    variant: 'primary',
    name: 'GM Name',
    width: 300,
    children: [cpm],
  })
  const ceo = node({
    title: 'Astrion CEO',
    variant: 'primary',
    name: 'CEO Name',
    width: 300,
    children: [gm],
  })

  const chart: OrgChart = {
    version: 1,
    meta: { title: 'PMO & Lines of Communication', showTitle: true },
    roots: [
      node({ title: 'Corporate Resources', variant: 'hidden', childLayout: 'stack', children: corp }),
      ceo,
      node({ title: 'Customer', variant: 'hidden', childLayout: 'stack', children: customer }),
    ],
    groups: [
      {
        id: uid('g'),
        label: 'PMO',
        style: 'dashed',
        memberIds: [cpm.id],
      },
    ],
    comms: [
      { id: uid('c'), fromId: corp[0].id, toId: cpm.id, twoWay: true },
      { id: uid('c'), fromId: corp[4].id, toId: itomt.id, twoWay: true },
      { id: uid('c'), fromId: cpm.id, toId: customer[1].id, twoWay: true },
      { id: uid('c'), fromId: dpm.id, toId: customer[2].id, twoWay: true },
      { id: uid('c'), fromId: itomt.id, toId: customer[3].id, twoWay: true },
    ],
    legend: [
      { id: uid('l'), marker: 'boxSecondary', label: 'Corporate Resources' },
      { id: uid('l'), marker: 'boxAccent', label: 'Subcontractor Participation' },
      { id: uid('l'), marker: 'dashed', label: 'PMO' },
      { id: uid('l'), marker: 'comm', label: 'Communication Channels' },
    ],
  }
  return chart
}

export const templates: { key: string; label: string; build: () => OrgChart }[] = [
  { key: 'program-office', label: 'Program Office (capability stacks)', build: programOffice },
  { key: 'director-level', label: 'Director Level (PWS & deliverables)', build: directorLevel },
  { key: 'pmo-comms', label: 'PMO (lines of communication)', build: pmoComms },
]
