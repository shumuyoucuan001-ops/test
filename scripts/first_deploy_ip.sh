#!/usr/bin/env bash
set -euo pipefail

IP=""
KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip)
      IP="$2"; shift 2 ;;
    --key)
      KEY="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

[[ -n "$IP" && -n "$KEY" ]] || { echo "失败：必须传入 --ip 与 --key"; exit 2; }

echo "[1/8] 检查依赖..."
command -v ssh >/dev/null 2>&1 || { echo "失败：本机缺少 ssh"; exit 1; }
SYNC_TOOL="rsync"
if ! command -v rsync >/dev/null 2>&1; then
  SYNC_TOOL="scp"
  echo "提示：未检测到 rsync，将回退使用 scp";
fi
echo "OK：依赖检查通过（同步工具：${SYNC_TOOL:-scp}）"

echo "[2/8] 连通性测试 22 端口..."
if command -v nc >/dev/null 2>&1; then
  nc -vz "$IP" 22 >/dev/null 2>&1 || { echo "失败：$IP 的 22 端口不可达"; exit 1; }
else
  echo "提示：本机无 nc，跳过端口探测"
fi
ssh -i "$KEY" -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'echo SSH_OK' | grep -q SSH_OK || { echo "失败：SSH 无法登录"; exit 1; }
echo "OK：SSH 连通"

echo "[3/8] 远程安装并启动 Docker..."
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'set -e; (curl -fsSL https://get.docker.com | sh) || true; systemctl enable --now docker || (service docker start || true); docker --version >/dev/null' || { echo "失败：Docker 安装/启动异常"; exit 1; }
echo "OK：Docker 可用"

echo "[4/8] 创建远程目录 /opt/sm-admin ..."
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'mkdir -p /opt/sm-admin' || { echo "失败：创建目录失败"; exit 1; }
echo "OK：远程目录就绪"

echo "[5/8] 同步项目到远程 /opt/sm-admin ..."
if [[ "$SYNC_TOOL" == "rsync" ]]; then
  rsync -az --delete \
    --exclude 'node_modules' --exclude '.next' --exclude '.turbo' --exclude '.git' \
    -e "ssh -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes" \
    ./ root@"$IP":/opt/sm-admin/ || RSYNC_FAIL=1 || true
  if [[ "${RSYNC_FAIL:-0}" == "1" ]]; then
    echo "警告：rsync 失败，尝试使用 scp 回退方案"
    SYNC_TOOL="scp"
  fi
fi

if [[ "$SYNC_TOOL" == "scp" ]]; then
  # 使用 tar 通过 ssh 传输，避免 scp 排除规则复杂
  tar --exclude node_modules --exclude .next --exclude .turbo --exclude .git -czf - . | \
    ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'tar -xzf - -C /opt/sm-admin' || { echo "失败：项目同步失败"; exit 1; }
fi
echo "OK：项目已同步"

echo "[6/8] 远程构建并启动容器...（时间较长请等待）"
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'set -e; cd /opt/sm-admin && docker compose build --pull && docker compose up -d && docker compose ps' || { echo "失败：容器构建/启动失败"; exit 1; }
echo "OK：容器已启动"

echo "[7/8] 最近 80 行应用日志："
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes root@"$IP" 'cd /opt/sm-admin && (docker compose logs --tail=80 app | tail -n 80) || true'

echo "[8/8] 完成：现在可通过 http://$IP 访问。请确认安全组已放行 80/22 端口。"


