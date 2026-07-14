import { describe, expect, it } from 'vitest'
import { buildZip, crc32 } from './pptx'

const bytes = (s: string) => new TextEncoder().encode(s)
const u32le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)

describe('crc32', () => {
  it('matches the standard check value for "123456789"', () => {
    expect(crc32(bytes('123456789')) >>> 0).toBe(0xcbf43926)
  })

  it('is 0 for empty input', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('buildZip', () => {
  it('produces a store-method archive with a valid EOCD and local headers', () => {
    const entries = [
      { name: 'a.txt', data: bytes('hello') },
      { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3, 4]) },
    ]
    const zip = buildZip(entries)
    // Local file header signature at the start.
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
    // End-of-central-directory signature present, with the right entry count.
    const eocd = zip.length - 22
    expect([zip[eocd], zip[eocd + 1], zip[eocd + 2], zip[eocd + 3]]).toEqual([0x50, 0x4b, 0x05, 0x06])
    expect(zip[eocd + 10] | (zip[eocd + 11] << 8)).toBe(2)
    // First local header carries the stored CRC and both sizes = 5 ("hello").
    expect(u32le(zip, 14) >>> 0).toBe(crc32(bytes('hello')))
    expect(u32le(zip, 18)).toBe(5)
    expect(u32le(zip, 22)).toBe(5)
    // The filename and payload follow the 30-byte local header.
    expect(new TextDecoder().decode(zip.slice(30, 35))).toBe('a.txt')
    expect(new TextDecoder().decode(zip.slice(35, 40))).toBe('hello')
  })
})
