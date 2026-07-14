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

/** Template 4 — a clean, generic top-down hierarchy. A good neutral starting
 *  point when a proposal-specific pattern isn't needed yet. */
function simpleHierarchy(): OrgChart {
  const team = (title: string): OrgNode => node({ title, variant: 'tertiary', width: 155 })
  return {
    version: 1,
    meta: { title: 'Organization Chart', showTitle: true },
    roots: [
      node({
        title: 'Chief Executive Officer',
        variant: 'primary',
        name: 'Name',
        width: 210,
        children: [
          node({
            title: 'Chief Operating Officer',
            name: 'Name',
            width: 185,
            children: [team('Operations'), team('Logistics')],
          }),
          node({
            title: 'Chief Financial Officer',
            name: 'Name',
            width: 185,
            children: [team('Accounting'), team('Finance')],
          }),
          node({
            title: 'Chief Technology Officer',
            name: 'Name',
            width: 185,
            children: [team('Engineering'), team('IT & Security')],
          }),
        ],
      }),
    ],
    groups: [],
    comms: [],
    legend: [],
  }
}

/** Template 5 — functional organization: an executive over departments, each
 *  carrying a stacked list of sub-functions. */
function functionalDivisions(): OrgChart {
  const sub = (title: string): OrgNode => node({ title, variant: 'tertiary', width: 178 })
  const dept = (title: string, subs: string[]): OrgNode =>
    node({ title, variant: 'secondary', width: 188, childLayout: 'stack', children: subs.map(sub) })

  return {
    version: 1,
    meta: { title: 'Functional Organization', showTitle: true },
    roots: [
      node({
        title: 'Executive Director',
        variant: 'primary',
        width: 220,
        children: [
          dept('Operations', ['Field Operations', 'Scheduling', 'Quality Control']),
          dept('Engineering', ['Design', 'Test & Evaluation', 'Systems']),
          dept('Business & Finance', ['Accounting', 'Contracts', 'Procurement']),
          dept('People & Culture', ['Recruiting', 'HR', 'Training']),
          dept('Information Technology', ['Infrastructure', 'Cybersecurity', 'Support']),
        ],
      }),
    ],
    groups: [],
    comms: [],
    legend: [],
  }
}

/** Template 6 — joint-venture management: a customer / government column on the
 *  left, a board → GM → managers → technical-manager branch chain in the center,
 *  a JV PMO service stack on the right, and lines of communication between them. */
function jointVenture(): OrgChart {
  // Left: customer / government stakeholders plus the labs they oversee.
  const customer: OrgNode[] = [
    node({ title: 'Customer CO, COR, Alt. COR', variant: 'primary', width: 210 }),
    node({ title: 'Customer Engineering Director', variant: 'primary', width: 210 }),
    node({ title: 'Customer Business Manager', variant: 'primary', width: 210 }),
    node({ title: 'Customer Branch Managers', variant: 'primary', width: 210 }),
    node({ title: 'Laboratory / Facility A', variant: 'secondary', width: 210 }),
    node({ title: 'Laboratory / Facility B', variant: 'secondary', width: 210 }),
    node({ title: 'Laboratory / Facility C', variant: 'secondary', width: 210 }),
  ]

  // Center: JV management chain.
  const businessMgr = node({ title: 'Business Manager', name: 'Name', width: 190 })
  const qcMgr = node({ title: 'QC / SHE Manager', name: 'Name', width: 190 })
  const tm1 = node({
    title: 'TM (Branch)',
    variant: 'tertiary',
    width: 150,
    childLayout: 'stack',
    children: [
      node({ title: 'Prime', variant: 'secondary', width: 120 }),
      node({ title: 'Sub A', variant: 'secondary', width: 120 }),
    ],
  })
  const tm2 = node({
    title: 'TM (Branch)',
    variant: 'tertiary',
    width: 150,
    childLayout: 'stack',
    children: [
      node({ title: 'Sub B', variant: 'secondary', width: 120 }),
      node({ title: 'Sub C', variant: 'secondary', width: 120 }),
    ],
  })
  const tm3 = node({
    title: 'TM (Branch)',
    variant: 'tertiary',
    width: 150,
    childLayout: 'stack',
    children: [node({ title: 'Sub D', variant: 'secondary', width: 120 })],
  })
  const tmLead = node({
    title: 'Technical Managers (TMs)',
    variant: 'secondary',
    width: 200,
    children: [tm1, tm2, tm3],
  })
  const gm = node({
    title: 'JV General Manager',
    variant: 'primary',
    name: 'Name',
    width: 210,
    children: [businessMgr, tmLead, qcMgr],
  })
  const board = node({
    title: 'JV Board',
    variant: 'primary',
    name: 'Board Chair',
    width: 210,
    children: [gm],
  })

  // Right: JV PMO service stack + subcontractor PMOs.
  const pmo = node({
    title: 'JV PMO',
    variant: 'primary',
    width: 220,
    bullets: [
      'PMO Lead',
      'Finance / Accounting',
      'Human Resources',
      'Program Control',
      'Security (FSO)',
      'Contracts',
      'Subcontractor Mgmt',
      'Quality / SHE',
      'IT Systems',
    ],
  })
  const subPmo = node({
    title: 'Subcontractor PMOs',
    variant: 'secondary',
    width: 220,
    bullets: ['Subcontractor A', 'Subcontractor B', 'Subcontractor C', 'Subcontractor D'],
  })

  return {
    version: 1,
    meta: { title: 'Joint Venture Management Organization', showTitle: true },
    roots: [
      node({ title: 'Customer', variant: 'hidden', childLayout: 'stack', children: customer }),
      board,
      node({ title: 'PMO', variant: 'hidden', childLayout: 'stack', children: [pmo, subPmo] }),
    ],
    groups: [
      { id: uid('g'), label: 'Technical Managers (TMs)', style: 'blue', memberIds: [tmLead.id] },
    ],
    comms: [
      { id: uid('c'), fromId: customer[0].id, toId: board.id, twoWay: true },
      { id: uid('c'), fromId: customer[1].id, toId: gm.id, twoWay: true },
      { id: uid('c'), fromId: customer[2].id, toId: businessMgr.id, twoWay: true },
      { id: uid('c'), fromId: gm.id, toId: pmo.id, twoWay: true },
      { id: uid('c'), fromId: businessMgr.id, toId: pmo.id, twoWay: true },
    ],
    legend: [
      { id: uid('l'), marker: 'boxPrimary', label: 'External / customer & JV leadership' },
      { id: uid('l'), marker: 'boxSecondary', label: 'Internal / JV & subcontractors' },
      { id: uid('l'), marker: 'blue', label: 'Government management & communication' },
      { id: uid('l'), marker: 'comm', label: 'Lines of communication' },
    ],
  }
}

/** Template 7 — mentor-protégé joint venture across multiple sites: a
 *  government-operational column, a gold program-leadership chain, delivery-staff
 *  functional leads, and a corporate-resources column. */
function mentorProtege(): OrgChart {
  // Left: government operational chain.
  const government: OrgNode[] = [
    node({ title: 'Government PM | KO | COR', variant: 'tertiary', width: 210 }),
    node({ title: 'Operational Unit — HQ', variant: 'tertiary', width: 210 }),
    node({ title: 'Operational Unit — Det. 1', variant: 'tertiary', width: 210 }),
    node({ title: 'Operational Unit — Det. 2', variant: 'tertiary', width: 210 }),
  ]

  // Center: program leadership team (gold) with delivery-staff functional leads.
  const funcHq = node({ title: 'Functional Leads — JV / Subcontractor Staff', variant: 'secondary', width: 210 })
  const funcDet1 = node({ title: 'Functional Leads — JV / Subcontractor Staff', variant: 'secondary', width: 210 })
  const funcDet2 = node({ title: 'Functional Leads — JV / Subcontractor Staff', variant: 'secondary', width: 210 })

  const seniorPm1 = node({
    title: 'Senior Program Manager / Site Supervisor',
    name: 'Det. 1',
    variant: 'accent',
    width: 210,
    children: [funcDet1],
  })
  const seniorPm2 = node({
    title: 'Senior Program Manager / Site Supervisor',
    name: 'Det. 2',
    variant: 'accent',
    width: 210,
    children: [funcDet2],
  })
  const pm = node({
    title: 'SME Program Manager / Site Supervisor',
    name: 'HQ',
    variant: 'accent',
    width: 220,
    children: [funcHq, seniorPm1, seniorPm2],
  })
  const mpjv = node({
    title: 'Mentor-Protégé Joint Venture',
    name: 'Mentor CEO | Protégé CEO',
    variant: 'accent',
    width: 240,
    children: [pm],
  })

  // Right: executive council + corporate resources.
  const council = node({
    title: 'Executive Management Council',
    variant: 'primary',
    width: 220,
    bullets: ['Mentor', 'Protégé'],
  })
  const corp = node({
    title: 'Corporate Resources',
    variant: 'primary',
    width: 220,
    bullets: ['Human Resources', 'Recruiting', 'Finance', 'Procurement', 'Quality', 'Security'],
  })

  return {
    version: 1,
    meta: { title: 'Mentor-Protégé Joint Venture Organization', showTitle: true },
    roots: [
      node({ title: 'Government', variant: 'hidden', childLayout: 'stack', children: government }),
      mpjv,
      node({ title: 'Corporate', variant: 'hidden', childLayout: 'stack', children: [council, corp] }),
    ],
    groups: [],
    comms: [
      { id: uid('c'), fromId: government[0].id, toId: mpjv.id, twoWay: true },
      { id: uid('c'), fromId: government[1].id, toId: pm.id, twoWay: true },
      { id: uid('c'), fromId: government[2].id, toId: seniorPm1.id, twoWay: true },
      { id: uid('c'), fromId: government[3].id, toId: seniorPm2.id, twoWay: true },
      { id: uid('c'), fromId: council.id, toId: mpjv.id, twoWay: true },
    ],
    legend: [
      { id: uid('l'), marker: 'boxAccent', label: 'Program Leadership Team' },
      { id: uid('l'), marker: 'boxSecondary', label: 'JV / Subcontractor Delivery Staff' },
      { id: uid('l'), marker: 'boxTertiary', label: 'Government (Operational)' },
      { id: uid('l'), marker: 'boxPrimary', label: 'JV / Corporate Resources' },
      { id: uid('l'), marker: 'comm', label: 'Communication' },
    ],
  }
}

export const templates: { key: string; label: string; build: () => OrgChart }[] = [
  { key: 'simple-hierarchy', label: 'Simple Hierarchy (clean top-down)', build: simpleHierarchy },
  { key: 'functional-divisions', label: 'Functional Divisions (department stacks)', build: functionalDivisions },
  { key: 'program-office', label: 'Program Office (capability stacks)', build: programOffice },
  { key: 'director-level', label: 'Director Level (PWS & deliverables)', build: directorLevel },
  { key: 'joint-venture', label: 'Joint Venture (board, PMO & TMs)', build: jointVenture },
  { key: 'mentor-protege', label: 'Mentor-Protégé JV (multi-site)', build: mentorProtege },
  { key: 'pmo-comms', label: 'PMO (lines of communication)', build: pmoComms },
]

/** The chart shown on first load (before any localStorage autosave exists). */
export const DEFAULT_TEMPLATE_KEY = 'director-level'
