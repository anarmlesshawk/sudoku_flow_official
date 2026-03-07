// scripts/generate-icons.js
// ─────────────────────────────────────────────────────────────────────
// Run with: node scripts/generate-icons.js
//
// Generates all required PWA icon sizes into public/icons/.
// Uses the 'canvas' npm package. Install it first:
//   npm install canvas
//
// Sizes generated:
//   16×16    favicon
//   32×32    favicon
//   180×180  Apple touch icon (iOS home screen)
//   192×192  Android home screen
//   512×512  Android splash / store listing
//   512×512  maskable (Android adaptive icon with safe zone)
// ─────────────────────────────────────────────────────────────────────

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '../public/icons')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

function drawIcon(size, maskable = false) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // ── Background ───────────────────────────────────────────────────
  // For maskable icons, Android crops to a circle/squircle.
  // The "safe zone" is the inner 80% — keep important content there.
  const pad = maskable ? size * 0.12 : 0

  // Rounded rectangle background
  const radius = size * 0.22
  ctx.beginPath()
  ctx.moveTo(radius, 0)
  ctx.lineTo(size - radius, 0)
  ctx.quadraticCurveTo(size, 0, size, radius)
  ctx.lineTo(size, size - radius)
  ctx.quadraticCurveTo(size, size, size - radius, size)
  ctx.lineTo(radius, size)
  ctx.quadraticCurveTo(0, size, 0, size - radius)
  ctx.lineTo(0, radius)
  ctx.quadraticCurveTo(0, 0, radius, 0)
  ctx.closePath()

  // Deep navy gradient — matches Midnight theme
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#0f0f1a')
  grad.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = grad
  ctx.fill()

  // ── Grid lines ───────────────────────────────────────────────────
  // Draw a subtle 3×3 sudoku grid in the centre
  const gridSize = (size - pad * 2) * 0.72
  const gridX = (size - gridSize) / 2
  const gridY = (size - gridSize) / 2 + size * 0.02
  const cell = gridSize / 3

  ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)'  // faint indigo
  ctx.lineWidth = size * 0.012

  // Thin inner lines
  for (let i = 1; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(gridX + cell * i, gridY)
    ctx.lineTo(gridX + cell * i, gridY + gridSize)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(gridX, gridY + cell * i)
    ctx.lineTo(gridX + gridSize, gridY + cell * i)
    ctx.stroke()
  }

  // Outer border — brighter
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.7)'
  ctx.lineWidth = size * 0.022
  ctx.strokeRect(gridX, gridY, gridSize, gridSize)

  // ── "F" letterform in centre cell ───────────────────────────────
  // The centre square of the grid shows a glowing "F" for Flow
  const cx = gridX + cell  // centre cell x
  const cy = gridY + cell  // centre cell y

  // Glow effect
  ctx.shadowColor = '#818cf8'
  ctx.shadowBlur = size * 0.08

  ctx.fillStyle = '#c7d2fe'
  ctx.font = `bold ${cell * 0.78}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('F', cx + cell / 2, cy + cell / 2)

  ctx.shadowBlur = 0

  // ── Accent dots in corners ───────────────────────────────────────
  // Small glowing dots in 3 corners for visual flair
  const dotR = size * 0.028
  const dotPad = size * 0.12 + pad
  const dots = [
    [dotPad, dotPad],
    [size - dotPad, dotPad],
    [dotPad, size - dotPad],
  ]
  dots.forEach(([x, y]) => {
    ctx.beginPath()
    ctx.arc(x, y, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#6366f1'
    ctx.shadowColor = '#6366f1'
    ctx.shadowBlur = dotR * 3
    ctx.fill()
    ctx.shadowBlur = 0
  })

  return canvas
}

// ── Generate all sizes ────────────────────────────────────────────
const sizes = [
  { name: 'icon-16.png',          size: 16,  maskable: false },
  { name: 'icon-32.png',          size: 32,  maskable: false },
  { name: 'icon-180.png',         size: 180, maskable: false },
  { name: 'icon-192.png',         size: 192, maskable: false },
  { name: 'icon-512.png',         size: 512, maskable: false },
  { name: 'icon-512-maskable.png',size: 512, maskable: true  },
]

sizes.forEach(({ name, size, maskable }) => {
  const canvas = drawIcon(size, maskable)
  const buf = canvas.toBuffer('image/png')
  const filePath = path.join(OUT, name)
  fs.writeFileSync(filePath, buf)
  console.log(`✓ Generated ${name} (${size}×${size}${maskable ? ' maskable' : ''})`)
})

console.log('\nAll icons generated in public/icons/')
console.log('Review them visually before publishing.')
