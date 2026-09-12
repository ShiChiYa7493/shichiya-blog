const { cpSync, mkdirSync, existsSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const source = join(__dirname, '../assets')
const destination = join(__dirname, '../lib/assets')
const backgrounds = join(source, 'cosmetics/backgrounds')
const thumbs = join(source, 'cosmetics/thumbs')

if (!existsSync(source)) process.exit(0)
mkdirSync(thumbs, { recursive: true })
if (existsSync(backgrounds)) {
  for (const file of readdirSync(backgrounds).filter((name) => name.endsWith('.png'))) {
    const output = join(thumbs, file.replace(/\.png$/i, '.jpg'))
    if (existsSync(output)) continue
    if (process.platform === 'darwin') {
      spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '50', '-Z', '240', join(backgrounds, file), '--out', output], { stdio: 'ignore' })
    }
  }
}
mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })
