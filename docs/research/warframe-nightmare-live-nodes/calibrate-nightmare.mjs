#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const defaultRegionsPath = path.resolve(
  projectDir,
  '../../../packages/wf-bot/node_modules/warframe-public-export-plus/ExportRegions.json',
)

const OFFICIAL_COUNT = 269
const ROTATION_SECONDS = 28_800
const ALLOWED_MISSION_TYPES = new Set([
  'MT_ASSASSINATION',
  'MT_ASSAULT',
  'MT_CAPTURE',
  'MT_DEFENSE',
  'MT_EXCAVATE',
  'MT_EXTERMINATION',
  'MT_HIVE',
  'MT_INTEL',
  'MT_MOBILE_DEFENSE',
  'MT_PURIFY',
  'MT_RESCUE',
  'MT_RETRIEVAL',
  'MT_SABOTAGE',
  'MT_SURVIVAL',
  'MT_TERRITORY',
  'MT_ARTIFACT',
])
const ELIGIBLE_SYSTEMS = [0, 1, 2, 3, 15, 9, 4, 12, 14, 17, 18, 16, 5, 6, 7, 8, 10, 11]
const ALBRECHT_LAB_NODES = new Set([
  'SolNode715',
  'SolNode716',
  'SolNode717',
  'SolNode718',
  'SolNode719',
  'SolNode720',
  'SolNode721',
])

class SeededRandom {
  state

  constructor(seed) {
    this.state = BigInt(seed)
  }

  int(min, max) {
    const difference = max - min
    if (difference !== 0) {
      this.state = (
        0x5851f42d4c957f2dn * this.state + 0x14057b7ef767814fn
      ) & 0xffffffffffffffffn
      min += (Number(this.state >> 32n) & 0x3fffffff) % (difference + 1)
    }
    return min
  }

  shuffle(values) {
    for (let index = values.length - 1; index >= 1; index--) {
      const swapIndex = this.int(0, index)
      ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
    }
  }
}

function parseArguments() {
  const argumentsByName = new Map()
  for (const argument of process.argv.slice(2)) {
    const [name, value = ''] = argument.replace(/^--/, '').split('=', 2)
    argumentsByName.set(name, value)
  }
  return {
    actual: (argumentsByName.get('actual') ?? '').split(',').filter(Boolean),
    regionsPath: argumentsByName.get('regions') || defaultRegionsPath,
    time: Number(argumentsByName.get('time') || Math.floor(Date.now() / 1000)),
  }
}

function isRailjack(nodeKey, region) {
  return nodeKey.startsWith('CrewBattleNode')
    || region.systemName?.endsWith('_SPACE') === true
    || region.missionType?.startsWith('MT_RAILJACK') === true
}

function isEligible(nodeKey, region) {
  return Boolean(
    region
    && region.name
    && region.levelOverride
    && region.nodeType === 0
    && ALLOWED_MISSION_TYPES.has(region.missionType)
    && !ALBRECHT_LAB_NODES.has(nodeKey)
    && !region.tileset?.includes('Archwing')
    && !region.levelOverride?.includes('/SpaceBattles/'),
  )
}

function selectNodes(regions, keys, seed, railjackToDeepSpace) {
  const grouped = []
  for (const nodeKey of keys) {
    const region = regions[nodeKey]
    if (!region) continue
    const systemIndex = railjackToDeepSpace && isRailjack(nodeKey, region)
      ? 20
      : region.systemIndex
    if (!Number.isInteger(systemIndex)) continue
    ;(grouped[systemIndex] ??= []).push(nodeKey)
  }

  const random = new SeededRandom(seed)
  for (const nodes of grouped) {
    if (nodes?.length) random.shuffle(nodes)
  }

  return ELIGIBLE_SYSTEMS.map(systemIndex =>
    grouped[systemIndex]?.find(nodeKey => isEligible(nodeKey, regions[nodeKey])) ?? '-',
  )
}

function score(actual, selected) {
  if (actual.length === 0) return ''
  const expected = new Set(actual)
  const overlap = selected.filter(nodeKey => expected.has(nodeKey)).length
  const exact = selected.filter((nodeKey, index) => nodeKey === actual[index]).length
  return ` exact=${exact}/${actual.length} overlap=${overlap}/${actual.length}`
}

const options = parseArguments()
if (!Number.isFinite(options.time)) {
  throw new Error('--time must be a Unix timestamp in seconds')
}

const regions = JSON.parse(fs.readFileSync(options.regionsPath, 'utf8'))
const allKeys = Object.keys(regions)
const officialKeys = allKeys.slice(0, OFFICIAL_COUNT)
const withoutRailjack = allKeys.filter(nodeKey => !isRailjack(nodeKey, regions[nodeKey]))
const seed = Math.floor(options.time / ROTATION_SECONDS)
const variants = [
  ['official-269', officialKeys, false],
  ['all-pe-plus-order', allKeys, false],
  ['all-railjack-deep-space', allKeys, true],
  ['without-railjack', withoutRailjack, false],
]

console.log(`time=${options.time} seed=${seed} regions=${allKeys.length}`)
for (const [name, keys, railjackToDeepSpace] of variants) {
  const selected = selectNodes(regions, keys, seed, railjackToDeepSpace)
  console.log(`${name}${score(options.actual, selected)}`)
  console.log(selected.join(','))
}
