#!/usr/bin/env node

const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

mkdirSync(join(__dirname, 'data'), { recursive: true })
process.chdir(__dirname)
process.argv.splice(1, 1, 'koishi', 'start')
require('koishi/lib/cli')
