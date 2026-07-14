import { download, safeName, svgToPngBlob } from './export'

/*
 * Zero-dependency PowerPoint (.pptx) export. A .pptx is a ZIP of OOXML parts;
 * we render the chart to a high-resolution PNG, drop it onto a single 16:9
 * slide, and assemble the minimal-but-complete package by hand. Validated with
 * LibreOffice (soffice --convert-to pdf) so it opens cleanly in PowerPoint.
 */

/* --------------------------------------------------------------- ZIP (store) */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Build a ZIP archive with the STORE method (no compression). Enough for
 *  OOXML, and keeps the writer tiny and dependency-free. */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
  // Fixed DOS timestamp (2020-01-01 00:00) so exports are reproducible.
  const dosTime = 0
  const dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1

  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const nameBytes = enc.encode(e.name)
    const crc = crc32(e.data)
    const size = e.data.length
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20), ...u16(0), ...u16(0),
      ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
    ])
    parts.push(local, nameBytes, e.data)
    central.push(
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02,
        ...u16(20), ...u16(20), ...u16(0), ...u16(0),
        ...u16(dosTime), ...u16(dosDate),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(offset),
      ]),
      nameBytes,
    )
    offset += local.length + nameBytes.length + size
  }
  const centralStart = offset
  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ])

  const all = [...parts, ...central, eocd]
  const total = all.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const a of all) {
    out.set(a, p)
    p += a.length
  }
  return out
}

/* -------------------------------------------------------------- OOXML parts */

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const CONTENT_TYPES = `${decl}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`

const ROOT_RELS = `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`

function presentation(slideW: number, slideH: number): string {
  return `${decl}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="${slideW}" cy="${slideH}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
}

const PRESENTATION_RELS = `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/></Relationships>`

const THEME = `${decl}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Astrion"><a:themeElements><a:clrScheme name="Astrion"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="222230"/></a:dk2><a:lt2><a:srgbClr val="F1E9DB"/></a:lt2><a:accent1><a:srgbClr val="442C81"/></a:accent1><a:accent2><a:srgbClr val="29AAE1"/></a:accent2><a:accent3><a:srgbClr val="1ED872"/></a:accent3><a:accent4><a:srgbClr val="4DD3F7"/></a:accent4><a:accent5><a:srgbClr val="9382F9"/></a:accent5><a:accent6><a:srgbClr val="FFAF2E"/></a:accent6><a:hlink><a:srgbClr val="307EEF"/></a:hlink><a:folHlink><a:srgbClr val="FC5442"/></a:folHlink></a:clrScheme><a:fontScheme name="Astrion"><a:majorFont><a:latin typeface="Verdana"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Verdana"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Astrion"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`

const EMPTY_TREE = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>`

const SLIDE_MASTER = `${decl}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`

const SLIDE_MASTER_RELS = `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/></Relationships>`

const SLIDE_LAYOUT = `${decl}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`

const SLIDE_LAYOUT_RELS = `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`

const SLIDE_RELS = `${decl}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}/image" Target="../media/image1.png"/></Relationships>`

function slide(x: number, y: number, cx: number, cy: number): string {
  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Org Chart"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  const tree = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${pic}</p:spTree>`
  return `${decl}<p:sld ${NS}><p:cSld>${tree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

/* ------------------------------------------------------------------ export */

const EMU_PER_IN = 914400
const SLIDE_W = Math.round(13.333 * EMU_PER_IN) // 16:9 widescreen
const SLIDE_H = Math.round(7.5 * EMU_PER_IN)
const MARGIN = Math.round(0.3 * EMU_PER_IN)

/** Export the chart as a one-slide 16:9 .pptx with the chart fit and centered. */
export async function exportPptx(svgEl: SVGSVGElement, title: string): Promise<void> {
  const { blob, width, height } = await svgToPngBlob(svgEl, 2)
  const png = new Uint8Array(await blob.arrayBuffer())

  // Fit the chart into the slide's content area, preserving aspect ratio.
  const availW = SLIDE_W - 2 * MARGIN
  const availH = SLIDE_H - 2 * MARGIN
  const ar = width / height
  let cx = availW
  let cy = Math.round(availW / ar)
  if (cy > availH) {
    cy = availH
    cx = Math.round(availH * ar)
  }
  const x = Math.round((SLIDE_W - cx) / 2)
  const y = Math.round((SLIDE_H - cy) / 2)

  const enc = new TextEncoder()
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
    { name: 'ppt/presentation.xml', data: enc.encode(presentation(SLIDE_W, SLIDE_H)) },
    { name: 'ppt/_rels/presentation.xml.rels', data: enc.encode(PRESENTATION_RELS) },
    { name: 'ppt/theme/theme1.xml', data: enc.encode(THEME) },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: enc.encode(SLIDE_MASTER) },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: enc.encode(SLIDE_MASTER_RELS) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: enc.encode(SLIDE_LAYOUT) },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: enc.encode(SLIDE_LAYOUT_RELS) },
    { name: 'ppt/slides/slide1.xml', data: enc.encode(slide(x, y, cx, cy)) },
    { name: 'ppt/slides/_rels/slide1.xml.rels', data: enc.encode(SLIDE_RELS) },
    { name: 'ppt/media/image1.png', data: png },
  ]
  const zip = buildZip(entries)
  // Copy into a fresh ArrayBuffer-backed view so the Blob type is unambiguous.
  download(new Blob([zip.slice()], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), `${safeName(title)}.pptx`)
}
