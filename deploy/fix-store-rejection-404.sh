#!/bin/bash
# 修复"驳回差异单"404错误的自动修复脚本

set -e

echo "========================================"
echo "🔧 修复'驳回差异单'404错误"
echo "========================================"
echo ""

# 配置
PROJECT_DIR="/www/wwwroot/sm-api-v2"
NPM_PATH="/www/server/nodejs/v20.19.5/bin/npm"

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 错误：项目目录不存在: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "📂 当前目录: $(pwd)"
echo ""

# 步骤1: 检查源代码
echo "步骤1/5: 检查源代码..."
if [ ! -d "src/store-rejection" ]; then
    echo "❌ 错误：源代码目录不存在: src/store-rejection"
    echo "   请确保代码已从 Git 拉取"
    exit 1
fi
echo "✅ 源代码目录存在"

# 步骤2: 检查 dist 目录
echo ""
echo "步骤2/5: 检查构建输出..."
if [ ! -f "dist/store-rejection/store-rejection.controller.js" ]; then
    echo "⚠️  警告：构建文件不存在，需要重新构建"
    NEED_BUILD=true
else
    echo "✅ 构建文件已存在"
    NEED_BUILD=false
fi

# 步骤3: 检查依赖
echo ""
echo "步骤3/5: 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  警告：node_modules 不存在，需要安装依赖"
    echo "   正在安装依赖..."
    $NPM_PATH install --legacy-peer-deps
else
    echo "✅ node_modules 存在"
fi

# 步骤4: 重新构建
if [ "$NEED_BUILD" = true ] || [ "$1" = "--force" ]; then
    echo ""
    echo "步骤4/5: 重新构建项目..."
    $NPM_PATH run build 2>&1 | tail -20
    
    # 验证构建结果
    if [ ! -f "dist/store-rejection/store-rejection.controller.js" ]; then
        echo ""
        echo "❌ 构建失败：缺少 store-rejection.controller.js"
        echo "   请检查构建日志中的错误信息"
        exit 1
    fi
    
    echo "✅ 构建成功"
    
    # 列出构建的文件
    echo ""
    echo "📄 构建的文件："
    ls -lh dist/store-rejection/*.js 2>/dev/null || echo "   (未找到文件)"
else
    echo ""
    echo "步骤4/5: 跳过构建（文件已存在）"
    echo "   如需强制重新构建，请使用: $0 --force"
fi

# 步骤5: 验证模块注册
echo ""
echo "步骤5/5: 验证模块注册..."
if grep -q "StoreRejectionModule" dist/app.module.js 2>/dev/null; then
    echo "✅ StoreRejectionModule 已注册"
else
    echo "⚠️  警告：StoreRejectionModule 可能未正确注册"
    echo "   请检查 dist/app.module.js"
fi

# 完成
echo ""
echo "========================================"
echo "✅ 修复完成！"
echo "========================================"
echo ""
echo "📋 下一步："
echo "   1. 重启后端服务（PM2 或宝塔面板）"
echo "   2. 测试接口: curl http://localhost:5002/store-rejection"
echo ""
echo "💡 提示："
echo "   - 如果使用 PM2: pm2 restart sm-api-v2"
echo "   - 如果使用宝塔: 在 Node 项目中点击'重启'"
echo ""


