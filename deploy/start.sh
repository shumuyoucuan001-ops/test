#!/usr/bin/env sh
set -e
APP_DIR="${APP_DIR:-/app/web}"
PORT="${PORT:-3000}"
echo "Starting app in $APP_DIR on 0.0.0.0:${PORT}"
cd "$APP_DIR"

# 如果没有构建产物就现构建一次，确保生产可启动
if [ ! -d ".next" ]; then
  echo "No .next found, building..."
  # 若依赖已在镜像里，这里 npm ci 会很快；失败也忽略
  npm ci --omit=dev || true
  npx --yes next build
fi

exec npx --yes next start -H 0.0.0.0 -p "${PORT}"
#!/usr/bin/env sh
set -e
PORT="${PORT:-3000}"
echo "Starting app on 0.0.0.0:${PORT}"

# 优先进入 web 目录（Next.js）
if [ -f /app/web/package.json ]; then
  cd /app/web
  npx --yes next --version >/dev/null 2>&1 && exec npx --yes next start -H 0.0.0.0 -p "${PORT}"
  [ -f server.js ] && exec node server.js
  [ -f build/server.js ] && exec node build/server.js
  exec npm run start --if-present
fi

# 回退到 /app 根目录（若是其它Node入口）
cd /app
npx --yes next --version >/dev/null 2>&1 && exec npx --yes next start -H 0.0.0.0 -p "${PORT}"
[ -f server.js ] && exec node server.js
[ -f build/server.js ] && exec node build/server.js
exec npm run start --if-present


