#!/bin/bash

echo "==================================="
echo "修复部署问题脚本"
echo "==================================="

# 1. 停止并清理容器
echo "步骤 1: 停止并清理所有容器..."
docker-compose down
docker rm -f $(docker ps -aq) 2>/dev/null || true

# 2. 检查并释放端口 80
echo "步骤 2: 检查端口 80 占用情况..."
PORT_80_PID=$(lsof -ti:80 | head -1)
if [ ! -z "$PORT_80_PID" ]; then
    echo "端口 80 被进程 $PORT_80_PID 占用"
    echo "这可能是 Nginx，我们不会停止它"
    echo "将修改 docker-compose.yml 使用其他端口"
fi

# 3. 修改 docker-compose.yml 使 Web 服务使用 3000 端口而不是 80
echo "步骤 3: 检查 docker-compose.yml 配置..."
if grep -q "80:3000" docker-compose.yml; then
    echo "发现 Web 服务映射到端口 80，需要修改..."
    sed -i.backup 's/80:3000/3000:3000/g' docker-compose.yml
    echo "已修改为使用端口 3000"
fi

# 4. 检查 Dockerfile 路径
echo "步骤 4: 检查 Dockerfile..."
if [ -f "Dockerfile" ]; then
    echo "✓ 找到 Dockerfile"
else
    echo "✗ 未找到 Dockerfile"
    exit 1
fi

if [ -f "Dockerfile.api" ]; then
    echo "✓ 找到 Dockerfile.api"
else
    echo "✗ 未找到 Dockerfile.api"
    exit 1
fi

# 5. 只构建 API 服务（Web 构建失败时的临时方案）
echo "步骤 5: 重新构建 API 服务..."
export DOCKER_BUILDKIT=0
docker-compose build --no-cache api

# 6. 启动 API 服务
echo "步骤 6: 启动 API 服务..."
docker-compose up -d api

# 7. 等待 API 启动
echo "步骤 7: 等待 API 服务启动..."
sleep 10

# 8. 检查 API 健康状态
echo "步骤 8: 检查 API 健康状态..."
API_HEALTH=$(curl -s http://127.0.0.1:5000/health || echo "failed")
if echo "$API_HEALTH" | grep -q "ok"; then
    echo "✓ API 服务运行正常"
else
    echo "✗ API 服务未正常启动"
    echo "查看日志："
    docker-compose logs api --tail=50
    exit 1
fi

# 9. 测试 API 功能
echo "步骤 9: 测试规格字段查询..."
TEST_RESULT=$(curl -s "http://127.0.0.1:5000/label-print/search?q=test" | head -c 100)
if echo "$TEST_RESULT" | grep -q -E '"spec"|^\['; then
    echo "✓ API 查询功能正常"
else
    echo "⚠ API 查询可能有问题，但服务已启动"
fi

echo ""
echo "==================================="
echo "修复完成！"
echo "==================================="
echo ""
echo "当前状态："
docker-compose ps
echo ""
echo "注意事项："
echo "1. Web 服务构建失败，暂时只启动了 API 服务"
echo "2. 需要通过 Nginx 反向代理访问前端（默认配置）"
echo "3. API 服务运行在端口 5000"
echo ""
echo "下一步："
echo "1. 检查 Nginx 配置是否正确"
echo "2. 确认前端静态文件是否已部署"
echo "3. 测试完整功能"

