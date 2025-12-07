#!/bin/bash
# ===============================================
# 新服务器一键部署脚本
# 服务器 IP: 47.106.87.166
# 数据库: 阿里云 RDS (已配置)
# ===============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
========================================
    树木标签系统 - 自动部署脚本
========================================
服务器: 47.106.87.166
数据库: 阿里云 RDS (已配置)
部署方式: Docker + 宝塔面板
========================================
EOF
echo -e "${NC}"

# ===============================================
# 步骤 1: 环境检查
# ===============================================
echo -e "${YELLOW}[1/8] 检查部署环境...${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装！${NC}"
    echo "请在宝塔面板安装 Docker 管理器"
    exit 1
fi
echo -e "${GREEN}✓ Docker: $(docker --version | cut -d' ' -f3)${NC}"

# 检查 docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装！${NC}"
    echo "请在宝塔面板安装 Docker 管理器"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose: $(docker-compose --version | cut -d' ' -f4)${NC}"

# 检查 Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  Git 未安装，正在安装...${NC}"
    if command -v yum &> /dev/null; then
        yum install -y git
    elif command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y git
    fi
fi
echo -e "${GREEN}✓ Git: $(git --version | cut -d' ' -f3)${NC}"

echo ""

# ===============================================
# 步骤 2: 清理旧部署（如果存在）
# ===============================================
echo -e "${YELLOW}[2/8] 检查是否存在旧部署...${NC}"

if [ -d "/www/wwwroot/shumu" ]; then
    echo -e "${RED}⚠️  发现旧部署目录${NC}"
    read -p "是否删除并重新部署？(y/n): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        cd /www/wwwroot/shumu
        if [ -f "docker-compose.yml" ]; then
            echo "停止旧容器..."
            docker-compose down || true
        fi
        cd /www/wwwroot
        rm -rf shumu
        echo -e "${GREEN}✓ 旧部署已清理${NC}"
    else
        echo -e "${YELLOW}取消部署${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}✓ 无旧部署${NC}"
fi

echo ""

# ===============================================
# 步骤 3: 克隆项目代码
# ===============================================
echo -e "${YELLOW}[3/8] 克隆项目代码（使用 main 分支）...${NC}"

cd /www/wwwroot
git clone -b main https://github.com/xuxiang6/shumu.git
cd shumu

echo -e "${GREEN}✓ 代码克隆成功${NC}"
echo -e "  分支: $(git branch --show-current)"
echo -e "  最新提交: $(git log -1 --oneline)"
echo ""

# ===============================================
# 步骤 4: 生成 JWT 密钥
# ===============================================
echo -e "${YELLOW}[4/8] 生成 JWT 安全密钥...${NC}"

JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✓ JWT 密钥已生成${NC}"
echo ""

# ===============================================
# 步骤 5: 创建环境变量文件
# ===============================================
echo -e "${YELLOW}[5/8] 创建环境变量配置文件...${NC}"

cat > .env << EOF
# ===============================================
# 生产环境配置
# 服务器: 47.106.87.166
# 自动生成时间: $(date '+%Y-%m-%d %H:%M:%S')
# ===============================================

# 数据库配置（阿里云 RDS）
DATABASE_URL="mysql://xitongquanju:b4FFS6kVGKV4jV@guishumu999666.rwlb.rds.aliyuncs.com:3306/sm_shangping"

# JWT 安全密钥（自动生成）
JWT_SECRET="$JWT_SECRET"

# 应用配置
NODE_ENV=production
PORT=5000

# Web 前端配置
NEXT_PUBLIC_API_BASE=/api

# 日志级别
LOG_LEVEL=info
EOF

echo -e "${GREEN}✓ .env 配置文件已创建${NC}"
echo ""

# ===============================================
# 步骤 6: 构建 Docker 镜像
# ===============================================
echo -e "${YELLOW}[6/8] 构建 Docker 镜像...${NC}"
echo -e "${BLUE}⏳ 首次构建需要 5-10 分钟，请耐心等待...${NC}"
echo ""

docker-compose build

echo -e "${GREEN}✓ Docker 镜像构建完成${NC}"
echo ""

# ===============================================
# 步骤 7: 启动服务
# ===============================================
echo -e "${YELLOW}[7/8] 启动 Docker 容器...${NC}"

docker-compose up -d

echo -e "${GREEN}✓ 容器启动成功${NC}"
echo ""

# 等待服务启动
echo "等待服务启动（15 秒）..."
sleep 15

# ===============================================
# 步骤 8: 验证部署
# ===============================================
echo -e "${YELLOW}[8/8] 验证部署状态...${NC}"
echo ""

# 检查容器状态
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "容器状态："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose ps
echo ""

# 测试 API
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 API 健康检查："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
API_RESPONSE=$(curl -s http://127.0.0.1:5000/health || echo "failed")
if echo "$API_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ API 服务正常${NC}"
    echo "  响应: $API_RESPONSE"
else
    echo -e "${RED}❌ API 服务异常${NC}"
    echo "  响应: $API_RESPONSE"
fi
echo ""

# 测试 Web
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "测试 Web 前端："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
WEB_RESPONSE=$(curl -s -I http://127.0.0.1:3000 | head -n 1)
if echo "$WEB_RESPONSE" | grep -q "HTTP"; then
    echo -e "${GREEN}✓ Web 前端正常${NC}"
    echo "  响应: $WEB_RESPONSE"
else
    echo -e "${RED}❌ Web 前端异常${NC}"
fi
echo ""

# ===============================================
# 部署完成
# ===============================================
echo -e "${GREEN}"
cat << "EOF"
========================================
    ✅ 部署完成！
========================================
EOF
echo -e "${NC}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📍 访问地址${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "临时访问（需要在宝塔放行端口）："
echo -e "  Web 前端: ${GREEN}http://47.106.87.166:3000${NC}"
echo -e "  API: ${GREEN}http://47.106.87.166:5000${NC}"
echo ""
echo -e "如果配置了域名，访问："
echo -e "  Web 前端: ${GREEN}http://你的域名.com${NC}"
echo -e "  API: ${GREEN}http://你的域名.com/api${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 后续配置（在宝塔面板）${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1️⃣  配置 Nginx 反向代理（如果使用域名）"
echo "   参考文件: /www/wwwroot/shumu/deploy/new-server-47.106.87.166/3-nginx-config.conf"
echo ""
echo "2️⃣  配置防火墙"
echo "   宝塔 → 安全 → 放行端口: 80, 443"
echo "   如果临时用 IP 访问，放行: 3000, 5000"
echo ""
echo "3️⃣  配置 SSL 证书（可选）"
echo "   网站设置 → SSL → Let's Encrypt"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📚 常用命令${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "查看日志:"
echo "  cd /www/wwwroot/shumu"
echo "  docker-compose logs -f"
echo ""
echo "重启服务:"
echo "  cd /www/wwwroot/shumu"
echo "  docker-compose restart"
echo ""
echo "停止服务:"
echo "  cd /www/wwwroot/shumu"
echo "  docker-compose down"
echo ""
echo "更新代码:"
echo "  cd /www/wwwroot/shumu"
echo "  git pull origin main"
echo "  docker-compose down"
echo "  docker-compose build --no-cache"
echo "  docker-compose up -d"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📝 配置信息已保存${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "环境变量: /www/wwwroot/shumu/.env"
echo "项目目录: /www/wwwroot/shumu"
echo "完整文档: /www/wwwroot/shumu/deploy/new-server-47.106.87.166/README.md"
echo ""

echo -e "${GREEN}🎉 祝使用愉快！${NC}"
echo ""

