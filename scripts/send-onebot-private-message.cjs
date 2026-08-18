'use strict'

const fs = require('node:fs')

function readEnvValue(file, key) {
  const source = fs.readFileSync(file, 'utf8')
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match || match[1] !== key) continue

    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '')
    }
    return value
  }
  return undefined
}

function required(name, value) {
  if (!value) throw new Error(`缺少 ${name}`)
  return value
}

async function sendNotice() {
  const envFile = process.env.ONEBOT_ENV_FILE
    || '/root/shichiya-bot-release/packages/wf-bot/.env'
  const wsModule = process.env.ONEBOT_WS_MODULE
    || '/root/shichiya-bot-release/packages/wf-bot/node_modules/ws'
  const wsUrl = process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:3011'
  const userId = 1071342037
  const encodedMessage = required('DEPLOY_NOTICE_B64', process.env.DEPLOY_NOTICE_B64)
  const message = Buffer.from(encodedMessage, 'base64').toString('utf8')
  const token = required('ONEBOT_TOKEN', readEnvValue(envFile, 'ONEBOT_TOKEN'))
  const WebSocket = require(wsModule)
  const targets = [{
    action: 'send_private_msg',
    params: { user_id: userId, message },
    label: `QQ ${userId}`,
  }].map((target, index) => ({
    ...target,
    echo: `deploy-notice-${Date.now()}-${process.pid}-${index}`,
  }))

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('ONEBOT_USER_ID 不是有效 QQ 号')
  }
  if (!message.trim()) throw new Error('更新公告不能为空')

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket.close()
      error ? reject(error) : resolve()
    }
    const timeout = setTimeout(
      () => finish(new Error('等待 OneBot 发送回执超时')),
      Number(process.env.ONEBOT_TIMEOUT_MS || '15000'),
    )

    socket.on('open', () => {
      for (const target of targets) {
        socket.send(JSON.stringify(target))
      }
    })
    socket.on('message', (data) => {
      let response
      try {
        response = JSON.parse(data.toString())
      } catch {
        return
      }
      // NapCat 连接后会先发 lifecycle/meta 事件；只能认本次动作的 echo。
      const target = targets.find(item => item.echo === response.echo)
      if (!target) return
      if (response.status === 'ok' && Number(response.retcode) === 0) {
        const messageId = response.data?.message_id ?? 'unknown'
        process.stdout.write(`更新公告发送成功：${target.label}，message_id=${messageId}\n`)
        targets.splice(targets.indexOf(target), 1)
        if (targets.length === 0) finish()
        return
      }
      finish(new Error(
        `OneBot 发送失败：retcode=${response.retcode ?? 'unknown'}，`
        + `message=${response.message || response.wording || 'unknown'}`,
      ))
    })
    socket.on('error', error => finish(new Error(`OneBot WebSocket 错误：${error.message}`)))
    socket.on('close', () => {
      if (!settled) finish(new Error('收到发送回执前 OneBot WebSocket 已关闭'))
    })
  })
}

sendNotice().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
