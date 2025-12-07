#!/bin/bash
# ========================================
# 宝塔面板完整部署脚本
# 用途：部署后端(sm-api-v2)和Web前端
# ========================================

set -e  # 遇到错误立即退出

echo "========================================"
echo "  🚀 开始完整部署"
echo "========================================"
echo ""

# ========================================
# 第一部分：部署后端 (sm-api-v2)
# ========================================

echo "========================================="
echo "  📦 第一部分：部署后端服务"
echo "========================================="
echo ""

cd /www/wwwroot/sm-api-v2

echo "✅ 步骤1: 拉取最新代码"
git fetch origin develop
git reset --hard origin/develop
echo ""

echo "✅ 步骤2: 安装/更新依赖"
/www/server/nodejs/v20.19.5/bin/npm install --legacy-peer-deps
echo ""

echo "✅ 步骤3: 确保 Playwright 已安装"
/www/server/nodejs/v20.19.5/bin/npm list playwright 2>&1 | grep -q "playwright@" && echo "Playwright 已安装" || /www/server/nodejs/v20.19.5/bin/npm install playwright --save
echo ""

echo "✅ 步骤4: 确保 Playwright Chromium 已安装"
if [ ! -d "/root/.cache/ms-playwright/chromium-"* ]; then
  echo "正在安装 Chromium..."
  /www/server/nodejs/v20.19.5/bin/npx playwright install chromium
else
  echo "Chromium 已安装"
fi
echo ""

echo "✅ 步骤5: 检查系统依赖"
echo "检查关键库文件..."
missing_deps=0
for lib in libatk-1.0.so.0 libatk-bridge-2.0.so.0 libcups.so.2 libgtk-3.so.0; do
  if ! ldconfig -p | grep -q "$lib"; then
    echo "❌ 缺少: $lib"
    missing_deps=1
  else
    echo "✅ 已安装: $lib"
  fi
done

if [ $missing_deps -eq 1 ]; then
  echo ""
  echo "⚠️  检测到缺少系统依赖，尝试安装..."
  yum install -y atk at-spi2-atk cups-libs gtk3 libXcomposite libXcursor libXdamage libXi libXrandr libXScrnSaver libXtst pango cairo alsa-lib liberation-fonts 2>&1 | tail -n 10
fi
echo ""

echo "✅ 步骤6: 检查中文字体"
if fc-list :lang=zh | grep -q "WenQuanYi\|Noto\|Source Han"; then
  echo "中文字体已安装"
else
  echo "正在安装中文字体..."
  yum install -y wqy-microhei-fonts 2>&1 | tail -n 5
  fc-cache -fv 2>&1 | tail -n 3
fi
echo ""

echo "✅ 步骤7: 编译项目"
/www/server/nodejs/v20.19.5/bin/npm run build 2>&1 | tail -n 20
echo ""

echo "✅ 步骤8: 验证编译结果"
if [ -f "dist/template/template.service.js" ]; then
  echo "✅ 编译成功：dist/template/template.service.js"
  if grep -q "renderHtmlToBitmap" dist/template/template.service.js; then
    echo "✅ Playwright 渲染方法已包含"
  else
    echo "⚠️  警告：未找到 renderHtmlToBitmap 方法"
  fi
else
  echo "❌ 编译失败：找不到编译输出文件"
  exit 1
fi
echo ""

echo "✅ 步骤9: 重启后端服务"
pm2 restart sm-api-v2
sleep 3
echo ""

echo "✅ 步骤10: 检查服务状态"
pm2 list | grep sm-api-v2
echo ""

echo "✅ 步骤11: 测试后端API"
echo "测试健康检查..."
curl -s http://127.0.0.1:5000/health | head -c 200
echo ""
echo ""

echo "========================================="
echo "  ✅ 后端部署完成！"
echo "========================================="
echo ""
sleep 2

# ========================================
# 第二部分：部署 Web 前端
# ========================================

echo "========================================="
echo "  🌐 第二部分：部署Web前端"
echo "========================================="
echo ""

# 检查 web 目录是否存在
if [ ! -d "/www/wwwroot/sm-web" ]; then
  echo "📂 创建 Web 项目目录..."
  mkdir -p /www/wwwroot/sm-web
  cd /www/wwwroot/sm-web
  
  echo "✅ 步骤1: 克隆代码仓库"
  git clone -b develop https://github.com/xuxiang6/shumu.git .
  
  echo "✅ 步骤2: 进入 web 子目录"
  # 实际项目在 web/ 子目录
else
  echo "📂 Web 项目目录已存在"
  cd /www/wwwroot/sm-web
  
  echo "✅ 步骤1: 拉取最新代码"
  git fetch origin develop
  git reset --hard origin/develop
fi

echo ""

# 进入实际的 web 项目目录
if [ -d "web" ]; then
  cd web
else
  echo "❌ 错误：找不到 web 子目录"
  exit 1
fi

echo "✅ 步骤2: 安装/更新 Web 前端依赖"
/www/server/nodejs/v20.19.5/bin/npm install 2>&1 | tail -n 20
echo ""

echo "✅ 步骤3: 构建 Web 前端生产版本"
/www/server/nodejs/v20.19.5/bin/npm run build 2>&1 | tail -n 30
echo ""

echo "✅ 步骤4: 检查构建结果"
if [ -d ".next" ]; then
  echo "✅ 构建成功：.next 目录已生成"
else
  echo "❌ 构建失败：找不到 .next 目录"
  exit 1
fi
echo ""

echo "✅ 步骤5: 启动/重启 Web 前端服务"
# 检查是否已经在 pm2 中
if pm2 list | grep -q "sm-web"; then
  echo "重启现有服务..."
  pm2 restart sm-web
else
  echo "首次启动服务..."
  pm2 start npm --name "sm-web" -- start
  pm2 save
fi
sleep 3
echo ""

echo "✅ 步骤6: 检查 Web 服务状态"
pm2 list | grep sm-web
echo ""

echo "✅ 步骤7: 测试 Web 前端"
echo "测试首页访问..."
curl -s -I http://127.0.0.1:3000 | head -n 5
echo ""

echo "========================================="
echo "  ✅ Web前端部署完成！"
echo "========================================="
echo ""

# ========================================
# 完成总结
# ========================================

echo "========================================"
echo "  🎉 完整部署成功！"
echo "========================================"
echo ""
echo "📋 服务状态："
echo ""
pm2 list
echo ""
echo "🔗 访问地址："
echo "  - 后端API:  http://api.shuzhishanmu.com:5000"
echo "  - Web前端:  http://你的域名:3000"
echo ""
echo "📝 后续步骤："
echo "  1. 在宝塔面板配置 Web 反向代理（端口 3000）"
echo "  2. 配置域名和 SSL 证书"
echo "  3. 测试 APP 打印功能"
echo ""
echo "========================================"

