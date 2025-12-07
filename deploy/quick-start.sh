#!/bin/bash

# 树木标签系统 - 快速部署脚本
# 适用于宝塔面板 Docker 环境

set -e

echo "🚀 树木标签系统 - 快速部署"
echo "================================"

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未检测到 Docker，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未检测到 Docker Compose，请先安装"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，正在创建..."
    cp .env.example .env
    
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
    
    echo "✅ 已创建 .env 文件并生成 JWT 密钥"
    echo "📝 请检查 .env 文件并根据需要修改配置"
    echo ""
fi

# 显示配置信息
echo "📋 当前配置:"
echo "   - API 端口: 5000"
echo "   - Web 端口: 80"
echo "   - 数据库: SQLite (./server/prisma/dev.db)"
echo ""

# 询问是否继续
read -p "是否开始部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 部署已取消"
    exit 0
fi

echo ""
echo "🔨 步骤 1/4: 停止现有容器..."
docker-compose down 2>/dev/null || true

echo ""
echo "🏗️  步骤 2/4: 构建 Docker 镜像 (首次构建需要 5-10 分钟)..."
docker-compose build --no-cache

echo ""
echo "🚀 步骤 3/4: 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 步骤 4/4: 等待服务启动..."
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
echo "🎉 部署完成！"
echo ""
echo "📝 访问地址:"
echo "   - Web 前端: http://localhost:80 或 http://服务器IP"
echo "   - API 接口: http://localhost:5000"
echo ""
echo "📊 常用命令:"
echo "   - 查看日志: docker-compose logs -f"
echo "   - 重启服务: docker-compose restart"
echo "   - 停止服务: docker-compose down"
echo "   - 更新部署: ./deploy/update.sh"
echo ""
echo "⚠️  重要提示:"
echo "   1. 请在宝塔面板配置 Nginx 反向代理 (参考 deploy/baota-docker-deploy.md)"
echo "   2. 建议配置 SSL 证书以启用 HTTPS"
echo "   3. 请修改 .env 文件中的 JWT_SECRET 为复杂密钥"
echo ""

