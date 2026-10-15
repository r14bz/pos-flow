import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const iconPaths = [
  ['resources/icon.png', 0.80],
  ['public/icons/icon-192.png', 0.96],
  ['public/icons/icon-512.png', 0.96],
  ['public/icons/icon-maskable-512.png', 0.88],
  ['public/icons/apple-touch-icon.png', 0.96],
  ['public/icons/favicon-64.png', 0.96],
]
const background = { r: 12, g: 134, b: 98, alpha: 1 }

for (const [relativePath, scale] of iconPaths) {
  const path = resolve(relativePath)
  if (!existsSync(path)) continue
  const source = sharp(path)
  const { width, height } = await source.metadata()
  if (!width || !height) continue
  const resizedWidth = Math.max(1, Math.round(width * scale))
  const resizedHeight = Math.max(1, Math.round(height * scale))
  const artwork = await source.resize(resizedWidth, resizedHeight, { fit: 'fill' }).png().toBuffer()
  await sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: artwork, gravity: 'centre' }])
    .png()
    .toFile(path + '.refined.png')
  const { rename, unlink } = await import('node:fs/promises')
  await rename(path + '.refined.png', path)
  console.log(`Refined ${relativePath}: ${Math.round(scale * 100)}% artwork size`)
}
