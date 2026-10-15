import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const sourcePath = resolve('resources/icon.png')
const iconTargets = [
  ['public/icons/icon-192.png', 192, 0.96],
  ['public/icons/icon-512.png', 512, 0.96],
  ['public/icons/icon-maskable-512.png', 512, 0.88],
  ['public/icons/apple-touch-icon.png', 180, 0.96],
  ['public/icons/favicon-64.png', 64, 0.96],
  ['public/icons/badge-96.png', 96, 0.96],
]
const background = { r: 12, g: 134, b: 98, alpha: 255 }

for (const [relativePath, size, scale] of iconTargets) {
  const path = resolve(relativePath)
  await mkdir(dirname(path), { recursive: true })
  const artwork = await sharp(sourcePath)
    .resize(Math.round(size * scale), Math.round(size * scale), { fit: 'contain' })
    .png()
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: artwork, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(path)
  console.log(`Generated ${relativePath} from resources/icon.png`)
}
