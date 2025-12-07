#!/usr/bin/env bash
set -euo pipefail

IP=""
KEY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip) IP="$2"; shift 2 ;;
    --key) KEY="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

[[ -n "$IP" && -n "$KEY" ]] || { echo "失败：必须传入 --ip 与 --key"; exit 2; }

echo "[1/3] 同步项目到远程 /opt/sm-admin ..."
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete \
    --exclude 'node_modules' --exclude '.next' --exclude '.turbo' --exclude '.git' \
    -e "ssh -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes" \
    ./ root@"$IP":/opt/sm-admin/ || RSYNC_FAIL=1 || true
fi
if [[ "${RSYNC_FAIL:-0}" == "1" || ! $(command -v rsync >/dev/null 2>&1; echo $?) -eq 0 ]]; then
  echo "提示：rsync 不可用或失败，使用 scp 回退"
  tar --exclude node_modules --exclude .next --exclude .turbo --exclude .git -czf - . | \
    ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'tar -xzf - -C /opt/sm-admin'
fi
echo "OK：同步完成"

echo "[2/3] 远程构建并重启 app ..."
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'set -e; cd /opt/sm-admin && docker compose build app && docker compose up -d app && docker compose ps' || { echo "失败：构建/启动失败"; exit 1; }
echo "OK：app 已更新"

echo "[3/3] 最近 80 行应用日志："
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'cd /opt/sm-admin && (docker compose logs --tail=80 app | tail -n 80) || true'


