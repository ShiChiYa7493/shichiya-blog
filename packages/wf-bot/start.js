#!/usr/bin/env node

const { mkdirSync } = require('node:fs')
const dns = require('node:dns')
const { join } = require('node:path')

mkdirSync(join(__dirname, 'data'), { recursive: true })
process.chdir(__dirname)
// 腾讯云到 api.warframe.com 的 IPv4 握手略高于 Node 22 默认的 250ms
// 双栈竞速窗口，IPv6 又不可达。当前进程固定 IPv4，NODE_OPTIONS 则把
// 同一策略传给 Koishi 启动的 worker 进程。
dns.setDefaultResultOrder('ipv4first')
const networkOptions = [
  '--dns-result-order=ipv4first',
  '--no-network-family-autoselection',
]
const nodeOptions = new Set((process.env.NODE_OPTIONS ?? '').split(/\s+/).filter(Boolean))
for (const option of networkOptions) nodeOptions.add(option)
process.env.NODE_OPTIONS = [...nodeOptions].join(' ')
process.argv.splice(1, 1, 'koishi', 'start')
require('koishi/lib/cli')
