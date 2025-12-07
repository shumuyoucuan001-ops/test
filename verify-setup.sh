#!/bin/bash

# 🔍 数据库配置验证脚本
# 在另一台设备上运行此脚本验证配置是否成功

echo "🔍 开始验证数据库配置..."
echo "================================"

# 检查当前目录
echo "📍 当前位置: $(pwd)"
echo ""

# 检查必要文件
echo "📋 检查配置文件..."
files_to_check=(
    "DATABASE_SETUP.md"
    "GITHUB_DESKTOP_SYNC.md" 
    "SYNC_GUIDE.md"
    ".cursor-context.md"
    "server/.env.example"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file - 存在"
    else
        echo "❌ $file - 缺失"
    fi
done

echo ""

# 检查server目录
echo "🔧 检查server配置..."
cd server

if [ -f ".env" ]; then
    echo "✅ .env - 已配置"
else
    echo "⚠️  .env - 未配置，正在创建..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env - 已从模板创建"
    else
        echo "❌ .env.example - 模板文件不存在"
        exit 1
    fi
fi

# 检查依赖
echo ""
echo "📦 检查依赖..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules - 已安装"
else
    echo "⚠️  node_modules - 未安装，正在安装..."
    npm install
fi

# 检查Prisma客户端
echo ""
echo "🗄️  检查Prisma客户端..."
if [ -d "node_modules/.prisma" ]; then
    echo "✅ Prisma客户端 - 已生成"
else
    echo "⚠️  Prisma客户端 - 未生成，正在生成..."
    npx prisma generate
fi

# 测试数据库连接
echo ""
echo "🔌 测试数据库连接..."
echo "启动服务器进行连接测试..."
echo "如果看到 'Application is running on: http://[::1]:4000' 说明配置成功！"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "================================"

# 启动服务器
npm start
