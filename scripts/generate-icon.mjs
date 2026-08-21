import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const SIZE = 256
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = join(root, 'build')

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function mix(from, to, amount) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount)
  ]
}

function createPng() {
  const center = (SIZE - 1) / 2
  const background = [2, 6, 23]
  const teal = [45, 212, 191]
  const rows = []

  for (let y = 0; y < SIZE; y += 1) {
    const row = Buffer.alloc(1 + SIZE * 4)
    for (let x = 0; x < SIZE; x += 1) {
      const dx = x - center
      const dy = y - center
      const distance = Math.sqrt(dx * dx + dy * dy)
      let color = background

      for (const ring of [108, 78, 50]) {
        const delta = Math.abs(distance - ring)
        if (delta < 5) {
          const glow = 1 - delta / 5
          color = mix(color, teal, glow * (ring === 50 ? 1 : 0.55))
        }
      }

      if (distance < 18) {
        color = mix(color, teal, 1 - distance / 22)
      }

      const offset = 1 + x * 4
      row[offset] = color[0]
      row[offset + 1] = color[1]
      row[offset + 2] = color[2]
      row[offset + 3] = 255
    }
    rows.push(row)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(buildDir, { recursive: true })
const pngPath = join(buildDir, 'icon.png')
writeFileSync(pngPath, createPng())
writeFileSync(join(buildDir, 'icon.ico'), await pngToIco(pngPath))
console.log('Wrote build/icon.png and build/icon.ico')
