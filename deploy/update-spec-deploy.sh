#!/bin/bash
# 规格字段名称修改部署脚本
# 用途：将数据库列名从 '规格' 修改为 '规格名称' 并重新部署后端

set -e

echo "========================================="
echo "开始部署规格字段名称修改"
echo "========================================="

# 1. 修改数据库
echo ""
echo "步骤 1: 修改数据库表列名..."
echo "请手动执行以下 SQL 命令："
echo ""
cat <<'EOF'
ALTER TABLE `sm_shangping`.`商品主档销售规格` 
CHANGE COLUMN `规格` `规格名称` VARCHAR(255);
EOF
echo ""
read -p "数据库修改完成后，按回车继续..."

# 2. 停止当前 API 容器
echo ""
echo "步骤 2: 停止当前 API 容器..."
cd /www/wwwroot/shumu
docker-compose stop api
docker rm -f shumu-api-1 || true

# 3. 重新构建 API 镜像
echo ""
echo "步骤 3: 重新构建 API 镜像..."
docker rmi shumu-api || true
export DOCKER_BUILDKIT=0
docker-compose build --no-cache api

# 4. 启动 API 容器
echo ""
echo "步骤 4: 启动 API 容器..."
docker-compose up -d api

# 5. 等待启动
echo ""
echo "步骤 5: 等待 API 启动..."
sleep 10

# 6. 检查容器状态
echo ""
echo "步骤 6: 检查容器状态..."
docker-compose ps api
docker-compose logs api --tail=30

# 7. 测试 API 健康检查
echo ""
echo "步骤 7: 测试 API 健康检查..."
curl -I http://127.0.0.1:5000/health || echo "健康检查失败，请查看日志"

echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
echo ""
echo "请测试以下功能："
echo "1. 访问 http://shuzhishanmu.com 登录系统"
echo "2. 测试商品查询功能"
echo "3. 测试标签打印功能"
echo "4. 检查商品规格字段是否正常显示"
echo ""

