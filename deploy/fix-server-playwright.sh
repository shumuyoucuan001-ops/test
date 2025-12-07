#!/bin/bash
# 修复服务器端口5000后端的Playwright环境
# 服务器: 121.43.139.147
# 项目: sm-api-v2

echo "=============================================="
echo "修复 sm-api-v2 的 Playwright 渲染环境"
echo "=============================================="

# 步骤1: 查找项目路径
echo ""
echo "步骤1: 查找项目路径..."
PROJECT_PATH=$(find /www -name "sm-api-v2" -type d 2>/dev/null | grep -v node_modules | head -1)

if [ -z "$PROJECT_PATH" ]; then
  echo "❌ 未找到 sm-api-v2 项目"
  echo "请手动查找项目路径并修改此脚本"
  exit 1
fi

echo "✓ 找到项目: $PROJECT_PATH"
cd "$PROJECT_PATH" || exit 1

# 步骤2: 查找server目录
echo ""
echo "步骤2: 查找server目录..."
if [ -d "$PROJECT_PATH/server" ]; then
  SERVER_PATH="$PROJECT_PATH/server"
  echo "✓ 找到server目录: $SERVER_PATH"
else
  SERVER_PATH="$PROJECT_PATH"
  echo "⚠ 未找到server子目录，使用项目根目录"
fi

cd "$SERVER_PATH" || exit 1

# 步骤3: 检查package.json
echo ""
echo "步骤3: 检查package.json..."
if [ ! -f "package.json" ]; then
  echo "❌ 未找到package.json"
  exit 1
fi

echo "✓ package.json 存在"

# 步骤4: 安装Playwright
echo ""
echo "步骤4: 安装Playwright..."
echo "这可能需要几分钟..."

# 查找npm路径
NPM_PATH=$(which npm)
if [ -z "$NPM_PATH" ]; then
  # 尝试常见路径
  if [ -f "/www/server/nodejs/v20.11.1/bin/npm" ]; then
    NPM_PATH="/www/server/nodejs/v20.11.1/bin/npm"
  elif [ -f "/www/server/nvm/versions/node/v20.11.1/bin/npm" ]; then
    NPM_PATH="/www/server/nvm/versions/node/v20.11.1/bin/npm"
  else
    echo "❌ 未找到npm"
    exit 1
  fi
fi

echo "使用npm: $NPM_PATH"

# 检查playwright是否已安装
if grep -q '"playwright"' package.json; then
  echo "✓ package.json中已有playwright依赖"
else
  echo "正在添加playwright依赖..."
  $NPM_PATH install --save playwright
fi

# 安装Chromium浏览器
echo ""
echo "步骤5: 安装Chromium浏览器..."
NPXPATH=$(dirname "$NPM_PATH")/npx
$NPX_PATH playwright install chromium 2>&1 | tail -10

# 步骤6: 安装系统依赖
echo ""
echo "步骤6: 安装系统依赖..."
echo "需要root权限，如提示输入密码请输入..."

# 安装基础库
yum install -y \
  atk \
  at-spi2-atk \
  cups-libs \
  gtk3 \
  libXcomposite \
  libXcursor \
  libXdamage \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  cairo \
  alsa-lib \
  liberation-fonts \
  2>&1 | grep -E "(Installing|Complete|Already)"

echo "✓ 基础依赖安装完成"

# 步骤7: 安装中文字体
echo ""
echo "步骤7: 安装中文字体..."
yum install -y wqy-microhei-fonts wqy-zenhei-fonts 2>&1 | grep -E "(Installing|Complete|Already)"

# 刷新字体缓存
echo "刷新字体缓存..."
fc-cache -fv 2>&1 | tail -5

# 验证字体安装
echo ""
echo "验证中文字体..."
fc-list :lang=zh | grep -i "wqy\|simhei\|simsun" | head -3

# 步骤8: 重新编译项目
echo ""
echo "步骤8: 重新编译项目..."
$NPM_PATH run build 2>&1 | tail -10

# 步骤9: 重启服务
echo ""
echo "步骤9: 重启服务..."

# 查找pm2
PM2_PATH=$(which pm2)
if [ -z "$PM2_PATH" ]; then
  if [ -f "/www/server/nodejs/v20.11.1/bin/pm2" ]; then
    PM2_PATH="/www/server/nodejs/v20.11.1/bin/pm2"
  elif [ -f "/www/server/nvm/versions/node/v20.11.1/bin/pm2" ]; then
    PM2_PATH="/www/server/nvm/versions/node/v20.11.1/bin/pm2"
  fi
fi

if [ -n "$PM2_PATH" ]; then
  echo "使用pm2: $PM2_PATH"
  $PM2_PATH restart sm-api-v2
  sleep 3
  $PM2_PATH status sm-api-v2
else
  echo "⚠ 未找到pm2，请手动重启服务"
fi

# 步骤10: 测试渲染
echo ""
echo "步骤10: 测试渲染..."
sleep 2

TEST_RESULT=$(curl -s -X POST "http://127.0.0.1:5000/templates/1/render" \
  -H "Content-Type: application/json" \
  -d '{"spec":"测试","qrDataUrl":"123","barcodeTail":"456","renderAsBitmap":true,"copies":1}' \
  | head -c 400)

if echo "$TEST_RESULT" | grep -q "FFFFFFFF"; then
  echo "✓ 渲染测试成功！返回了实际的位图数据（FFFFFF...）"
elif echo "$TEST_RESULT" | grep -q "AAAAAAAA"; then
  echo "❌ 渲染失败：返回全白位图（AAAAAA...）"
  echo "请检查日志: pm2 logs sm-api-v2 --lines 50"
else
  echo "⚠ 测试结果："
  echo "$TEST_RESULT"
fi

echo ""
echo "=============================================="
echo "修复完成！"
echo "=============================================="
echo ""
echo "如有问题，请查看日志："
echo "  pm2 logs sm-api-v2 --lines 100"
echo ""
echo "检查Chromium依赖："
echo "  ldd $SERVER_PATH/node_modules/playwright/.local-browsers/chromium-*/chrome-linux/chrome | grep 'not found'"
echo ""

