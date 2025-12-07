#!/bin/bash

# 树木标签系统 - 更新部署脚本

set -e

echo "🔄 树木标签系统 - 更新部署"
echo "================================"

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 显示当前版本信息
echo "📋 当前分支: $(git branch --show-current)"
echo "📋 当前提交: $(git log -1 --oneline)"
echo ""

# 询问是否继续
read -p "是否拉取最新代码并更新? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 更新已取消"
    exit 0
fi

echo ""
echo "📥 步骤 1/5: 拉取最新代码..."
git pull origin $(git branch --show-current)

echo ""
echo "🛑 步骤 2/5: 停止现有服务..."
docker-compose down

echo ""
echo "🗑️  步骤 3/5: 清理旧镜像..."
docker image prune -f

echo ""
echo "🏗️  步骤 4/5: 重新构建镜像..."
docker-compose build --no-cache

echo ""
echo "🚀 步骤 5/5: 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "🔍 检查 API 健康状态..."
for i in {1..10}; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo "✅ API 服务正常"
        break
    else
        if [ $i -eq 10 ]; then
            echo "⚠️  API 服务未响应，请检查日志: docker-compose logs api"
        else
            echo "   等待 API 启动... ($i/10)"
            sleep 3
        fi
    fi
done

echo ""
echo "================================"
echo "✅ 更新完成！"
echo ""
echo "📝 新版本信息:"
echo "   分支: $(git branch --show-current)"
echo "   提交: $(git log -1 --oneline)"
echo ""
echo "📊 查看日志: docker-compose logs -f"
echo ""

