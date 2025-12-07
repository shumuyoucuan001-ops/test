#!/bin/bash
# 新服务器快速部署脚本
# 服务器 IP: 47.106.87.166
# 
# 使用方法：
# 1. SSH 登录服务器：ssh root@47.106.87.166
# 2. 复制本脚本内容到服务器
# 3. 执行：bash deploy.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🚀 开始部署树木标签系统到新服务器"
echo "服务器 IP: 47.106.87.166"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步骤 1: 检查 Docker
echo -e "${YELLOW}步骤 1/9: 检查 Docker 环境${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先在宝塔面板安装 Docker 管理器${NC}"
    exit 1
fi
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装，请先在宝塔面板安装 Docker 管理器${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker 环境正常${NC}"
docker --version
docker-compose --version
echo ""

# 步骤 2: 检查 Git
echo -e "${YELLOW}步骤 2/9: 检查 Git${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  Git 未安装，正在安装...${NC}"
    yum install -y git || apt-get install -y git
fi
echo -e "${GREEN}✅ Git 已安装${NC}"
git --version
echo ""

# 步骤 3: 创建项目目录
echo -e "${YELLOW}步骤 3/9: 创建项目目录${NC}"
cd /www/wwwroot
if [ -d "shumu" ]; then
    echo -e "${YELLOW}⚠️  项目目录已存在，是否删除并重新部署？(y/n)${NC}"
    read -p "请输入: " confirm
    if [ "$confirm" = "y" ]; then
        echo "正在删除旧目录..."
        rm -rf shumu
    else
        echo "取消部署"
        exit 0
    fi
fi
echo ""

# 步骤 4: 克隆项目代码
echo -e "${YELLOW}步骤 4/9: 克隆项目代码（使用 main 分支）${NC}"
git clone -b main https://github.com/xuxiang6/shumu.git
cd shumu
echo -e "${GREEN}✅ 代码克隆成功${NC}"
echo ""

# 步骤 5: 配置环境变量
echo -e "${YELLOW}步骤 5/9: 配置环境变量${NC}"
echo -e "${RED}⚠️  重要：请手动配置 .env 文件${NC}"
echo ""
echo "请执行以下步骤："
echo "1. 生成 JWT 密钥："
echo "   openssl rand -base64 32"
echo ""
echo "2. 创建 .env 文件："
cat > .env << 'ENVEOF'
# 数据库配置（请填写你的 RDS 信息）
DATABASE_URL="mysql://用户名:密码@guishumu999666.rwlb.rds.aliyuncs.com:3306/sm_shangping"

# JWT 安全密钥（请替换为上面生成的随机字符串）
JWT_SECRET="请替换为随机生成的密钥"

# 应用配置
NODE_ENV=production
PORT=5000

# Web 前端配置
NEXT_PUBLIC_API_BASE=/api
ENVEOF

echo -e "${GREEN}✅ .env 文件已创建${NC}"
echo ""
echo -e "${RED}📝 请现在编辑 .env 文件，填写数据库信息和 JWT 密钥${NC}"
echo "   vim .env"
echo "   或使用宝塔文件管理器编辑"
echo ""
read -p "编辑完成后按回车继续..." pause
echo ""

# 步骤 6: 构建 Docker 镜像
echo -e "${YELLOW}步骤 6/9: 构建 Docker 镜像（需要 5-10 分钟）${NC}"
echo "正在构建，请耐心等待..."
docker-compose build
echo -e "${GREEN}✅ Docker 镜像构建完成${NC}"
echo ""

# 步骤 7: 启动服务
echo -e "${YELLOW}步骤 7/9: 启动 Docker 容器${NC}"
docker-compose up -d
echo -e "${GREEN}✅ 容器启动成功${NC}"
echo ""

# 等待服务启动
echo "等待服务启动（10 秒）..."
sleep 10

# 步骤 8: 验证服务
echo -e "${YELLOW}步骤 8/9: 验证服务状态${NC}"
echo ""
echo "容器状态："
docker-compose ps
echo ""

echo "测试 API 健康检查："
if curl -s http://127.0.0.1:5000/health | grep -q "ok"; then
    echo -e "${GREEN}✅ API 服务正常${NC}"
else
    echo -e "${RED}❌ API 服务异常，请检查日志${NC}"
fi
echo ""

echo "测试 Web 前端："
if curl -s -I http://127.0.0.1:3000 | grep -q "HTTP"; then
    echo -e "${GREEN}✅ Web 前端正常${NC}"
else
    echo -e "${RED}❌ Web 前端异常，请检查日志${NC}"
fi
echo ""

# 步骤 9: 显示后续配置说明
echo -e "${YELLOW}步骤 9/9: 后续配置${NC}"
echo ""
echo "=========================================="
echo "🎉 Docker 容器部署完成！"
echo "=========================================="
echo ""
echo "📝 下一步配置（在宝塔面板操作）："
echo ""
echo "1️⃣  配置 Nginx 反向代理（如果使用域名）："
echo "   - 网站 → 添加站点 → 输入域名"
echo "   - 网站设置 → 配置文件 → 添加反向代理规则"
echo "   - 参考文件：deploy/new-server-47.106.87.166/3-nginx-config.conf"
echo ""
echo "2️⃣  配置防火墙："
echo "   - 安全 → 放行端口 80 和 443"
echo "   - 如果直接用 IP 访问，放行 3000 和 5000"
echo ""
echo "3️⃣  配置 SSL 证书（可选但推荐）："
echo "   - 网站设置 → SSL → Let's Encrypt"
echo ""
echo "=========================================="
echo "📍 访问地址："
echo "=========================================="
echo ""
if [ -f "/www/server/panel/vhost/nginx/*.conf" ]; then
    echo "如果已配置域名：http://你的域名.com"
else
    echo "临时访问地址："
    echo "  - Web 前端: http://47.106.87.166:3000"
    echo "  - API: http://47.106.87.166:5000"
    echo ""
    echo "⚠️  需要在宝塔安全面板放行 3000 和 5000 端口"
fi
echo ""
echo "=========================================="
echo "🔍 查看日志："
echo "=========================================="
echo "cd /www/wwwroot/shumu"
echo "docker-compose logs -f           # 查看所有日志"
echo "docker-compose logs -f api       # 只看 API 日志"
echo "docker-compose logs -f web       # 只看 Web 日志"
echo ""
echo "=========================================="
echo "🔄 重启服务："
echo "=========================================="
echo "cd /www/wwwroot/shumu"
echo "docker-compose restart           # 重启所有服务"
echo "docker-compose restart api       # 只重启 API"
echo "docker-compose restart web       # 只重启 Web"
echo ""
echo "=========================================="
echo "📚 完整文档："
echo "=========================================="
echo "deploy/NEW_SERVER_DOCKER_DEPLOY.md"
echo ""

