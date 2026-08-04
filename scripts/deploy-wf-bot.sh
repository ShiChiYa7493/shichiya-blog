#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$REPO_ROOT/packages/wf-bot/external/warframe"
REMOTE_HOST="${WF_REMOTE_HOST:-tencent}"
REMOTE_PRIMARY="${WF_REMOTE_PRIMARY:-/root/shichiya-bot-release/packages/wf-bot/external/warframe}"
REMOTE_MIRROR="${WF_REMOTE_MIRROR:-/root/shichiya-blog/packages/wf-bot/external/warframe}"
REMOTE_BOT_ROOT="${WF_REMOTE_BOT_ROOT:-/root/shichiya-bot-release/packages/wf-bot}"
REMOTE_MIRROR_BOT_ROOT="${WF_REMOTE_MIRROR_BOT_ROOT:-/root/shichiya-blog/packages/wf-bot}"
NOTICE_USER_ID="${WF_NOTICE_USER_ID:-1071342037}"
NOTICE_GROUP_IDS="${WF_NOTICE_GROUP_IDS:-915943692}"
NOTICE=''
DRY_RUN=false
SSH_CONTROL_DIR=''
SSH_CONTROL_PATH="${WF_SSH_CONTROL_PATH:-}"
SSH_CONTROL_OWNED=false

usage() {
  cat <<'EOF'
用法：
  npm run deploy:bot -- --notice "本次更新内容"
  scripts/deploy-wf-bot.sh --notice "本次更新内容" [--dry-run]

参数：
  --notice TEXT  发布成功后向私聊和白名单群发送的更新公告（必填）
  --dry-run      仅检查参数并展示发布目标，不构建、不写远端、不发消息

环境变量：
  WF_SSH_CONTROL_PATH  复用调用方已经建立的 SSH ControlMaster
EOF
}

while (($#)); do
  case "$1" in
    --notice)
      [[ $# -ge 2 ]] || { echo '错误：--notice 缺少内容' >&2; exit 2; }
      NOTICE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ -n "${NOTICE//[[:space:]]/}" ]] || {
  echo '错误：必须用 --notice 提供本次更新内容' >&2
  exit 2
}
# CI、npm 与程序化调用常把多行参数写成字面量 `\n`；公告统一恢复为真实换行。
NOTICE="${NOTICE//\\n/$'\n'}"
[[ -f "$PACKAGE_DIR/package.json" ]] || {
  echo "错误：找不到 Warframe 插件目录：$PACKAGE_DIR" >&2
  exit 2
}

echo "发布源：$PACKAGE_DIR"
echo "线上目录：$REMOTE_PRIMARY"
echo "镜像目录：$REMOTE_MIRROR"
echo "机器人启动文件：$REMOTE_BOT_ROOT/start.js"
echo "公告接收人：QQ $NOTICE_USER_ID"
echo "公告群：$NOTICE_GROUP_IDS"

if $DRY_RUN; then
  echo 'dry-run 完成：未构建、未连接服务器、未发送公告。'
  exit 0
fi

cleanup_ssh() {
  if $SSH_CONTROL_OWNED && [[ -n "$SSH_CONTROL_PATH" ]]; then
    ssh -o ControlPath="$SSH_CONTROL_PATH" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
  fi
  if $SSH_CONTROL_OWNED && [[ -n "$SSH_CONTROL_DIR" && -d "$SSH_CONTROL_DIR" ]]; then
    rmdir "$SSH_CONTROL_DIR" >/dev/null 2>&1 || true
  fi
}
trap cleanup_ssh EXIT

if [[ -n "$SSH_CONTROL_PATH" ]]; then
  [[ "$SSH_CONTROL_PATH" != *[[:space:]]* ]] || {
    echo '错误：WF_SSH_CONTROL_PATH 不能包含空白字符' >&2
    exit 2
  }
  ssh -o ControlPath="$SSH_CONTROL_PATH" -O check "$REMOTE_HOST" >/dev/null 2>&1 || {
    echo "错误：WF_SSH_CONTROL_PATH 指向的 SSH ControlMaster 不可用：$SSH_CONTROL_PATH" >&2
    exit 1
  }
  echo "复用已有 SSH ControlMaster：$SSH_CONTROL_PATH"
else
  SSH_CONTROL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wf-bot-deploy.XXXXXX")"
  SSH_CONTROL_PATH="$SSH_CONTROL_DIR/control"
  SSH_CONTROL_OWNED=true
  echo '建立发布期间唯一 SSH 连接'
  ssh -MNf -o ControlMaster=yes -o ControlPersist=no -o ControlPath="$SSH_CONTROL_PATH" "$REMOTE_HOST"
fi
SSH_OPTIONS=(-o ControlMaster=no -o ControlPath="$SSH_CONTROL_PATH")
SSH_RSH="ssh -o ControlMaster=no -o ControlPath=$SSH_CONTROL_PATH"

NODE_MAJOR=''
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(`.`)[0]')"
fi
if [[ "$NODE_MAJOR" != '22' ]]; then
  NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  [[ -s "$NVM_SCRIPT" ]] || {
    echo '错误：发布要求 Node 22，且未找到 nvm。' >&2
    exit 1
  }
  # shellcheck disable=SC1090
  source "$NVM_SCRIPT"
  nvm use 22 >/dev/null
fi

echo '1/6 运行全量测试'
(cd "$PACKAGE_DIR" && yarn test)

echo '2/6 构建 Warframe 插件'
(cd "$PACKAGE_DIR" && yarn build)
LOCAL_SHA="$(shasum -a 256 "$PACKAGE_DIR/lib/index.js" | awk '{print $1}')"
LOCAL_START_SHA="$(shasum -a 256 "$REPO_ROOT/packages/wf-bot/start.js" | awk '{print $1}')"
FONT_RELATIVE_PATHS=(
  'assets/fonts/georgia/Georgia.TTF'
  'assets/fonts/georgia/Georgiab.TTF'
  'assets/fonts/georgia/Georgiai.TTF'
  'assets/fonts/georgia/Georgiaz.TTF'
)

echo '3/6 同步两个线上目录'
for remote_dir in "$REMOTE_PRIMARY" "$REMOTE_MIRROR"; do
  rsync -az --checksum \
    -e "$SSH_RSH" \
    --rsync-path='sudo rsync' \
    "$PACKAGE_DIR/lib/" "$REMOTE_HOST:$remote_dir/lib/"
done
for remote_bot_root in "$REMOTE_BOT_ROOT" "$REMOTE_MIRROR_BOT_ROOT"; do
  rsync -az --checksum \
    -e "$SSH_RSH" \
    --rsync-path='sudo rsync' \
    "$REPO_ROOT/packages/wf-bot/start.js" "$REMOTE_HOST:$remote_bot_root/start.js"
done

echo '4/6 校验线上 bundle'
for remote_dir in "$REMOTE_PRIMARY" "$REMOTE_MIRROR"; do
  remote_sha="$(ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" \
    "sudo shasum -a 256 '$remote_dir/lib/index.js' | awk '{print \$1}'")"
  if [[ "$remote_sha" != "$LOCAL_SHA" ]]; then
    echo "错误：$remote_dir 校验失败，本地 $LOCAL_SHA，远端 $remote_sha" >&2
    exit 1
  fi
done
for font_relative_path in "${FONT_RELATIVE_PATHS[@]}"; do
  local_font_sha="$(shasum -a 256 "$PACKAGE_DIR/lib/$font_relative_path" | awk '{print $1}')"
  for remote_dir in "$REMOTE_PRIMARY" "$REMOTE_MIRROR"; do
    remote_font_sha="$(ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" \
      "sudo shasum -a 256 '$remote_dir/lib/$font_relative_path' | awk '{print \$1}'")"
    if [[ "$remote_font_sha" != "$local_font_sha" ]]; then
      echo "错误：$remote_dir/lib/$font_relative_path 校验失败" >&2
      exit 1
    fi
  done
done
for remote_bot_root in "$REMOTE_BOT_ROOT" "$REMOTE_MIRROR_BOT_ROOT"; do
  remote_start_sha="$(ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" \
    "sudo shasum -a 256 '$remote_bot_root/start.js' | awk '{print \$1}'")"
  if [[ "$remote_start_sha" != "$LOCAL_START_SHA" ]]; then
    echo "错误：$remote_bot_root/start.js 校验失败，本地 $LOCAL_START_SHA，远端 $remote_start_sha" >&2
    exit 1
  fi
done
echo "bundle SHA256：$LOCAL_SHA"
echo "start.js SHA256：$LOCAL_START_SHA"
echo 'Georgia 字体 SHA256：两套线上目录均校验通过'

echo '5/6 重启并等待机器人就绪'
read -r ERROR_LINES OUT_LINES < <(
  ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" \
    "printf '%s %s\\n' \"\$(sudo sh -c 'wc -l < /root/.pm2/logs/blog-bot-error.log')\" \"\$(sudo sh -c 'wc -l < /root/.pm2/logs/blog-bot-out.log')\""
)
restart_result="$(ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" "
  set -e
  before=\$(sudo pm2 pid blog-bot)
  sudo pm2 restart blog-bot >/dev/null
  ready=''
  for _ in \$(seq 1 30); do
    if sudo pm2 show blog-bot | grep -q 'status .*online' \
      && sudo tail -n +$((OUT_LINES + 1)) /root/.pm2/logs/blog-bot-out.log | grep -q 'server listening at' \
      && sudo tail -n +$((OUT_LINES + 1)) /root/.pm2/logs/blog-bot-out.log | grep -q 'Warframe 插件已加载，命令注册完成'; then
      ready=yes
      break
    fi
    sleep 1
  done
  [ \"\$ready\" = yes ] || { echo '机器人 30 秒内未完成服务监听和 Warframe 命令注册' >&2; exit 1; }
  after=\$(sudo pm2 pid blog-bot)
  [ -n \"\$after\" ] && [ \"\$after\" != 0 ] || { echo '机器人 PID 无效' >&2; exit 1; }
  printf 'pid %s -> %s, status=online' \"\$before\" \"\$after\"
")"
echo "$restart_result"

new_errors="$(ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" \
  "sudo tail -n +$((ERROR_LINES + 1)) /root/.pm2/logs/blog-bot-error.log")"
if [[ -n "${new_errors//[[:space:]]/}" ]]; then
  echo '错误：本次启动产生了错误日志：' >&2
  echo "$new_errors" >&2
  exit 1
fi

echo '6/6 自动发送更新公告'
PUBLISHED_AT="$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
NOTICE_TEXT="【机器人更新公告】
${NOTICE}

发布时间：${PUBLISHED_AT}
版本：${LOCAL_SHA:0:12}"
NOTICE_B64="$(printf '%s' "$NOTICE_TEXT" | base64 | tr -d '\n')"
ssh "${SSH_OPTIONS[@]}" "$REMOTE_HOST" \
  "sudo env DEPLOY_NOTICE_B64='$NOTICE_B64' ONEBOT_USER_ID='$NOTICE_USER_ID' ONEBOT_GROUP_IDS='$NOTICE_GROUP_IDS' ONEBOT_ENV_FILE='$REMOTE_BOT_ROOT/.env' ONEBOT_WS_MODULE='$REMOTE_BOT_ROOT/node_modules/ws' /opt/node22/bin/node -" \
  < "$SCRIPT_DIR/send-onebot-private-message.cjs"

echo '发布完成：线上校验、进程就绪检查、私聊及群公告回执均已通过。'
