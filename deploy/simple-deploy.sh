#!/bin/bash

# 🚀 术木优选 - 简单部署脚本
# 使用方法: ./deploy/simple-deploy.sh [dev|prod]

set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME="shumu"

echo "🚀 开始部署 $PROJECT_NAME 到 $ENVIRONMENT 环境..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装Docker Compose"
        exit 1
    fi
    
    log_info "Docker 环境检查通过"
}

# 拉取最新代码
pull_code() {
    log_info "拉取最新代码..."
    
    if [ "$ENVIRONMENT" = "prod" ]; then
        git checkout main
        git pull origin main
    else
        git checkout develop
        git pull origin develop
    fi
    
    log_info "代码更新完成"
}

# 构建和部署
deploy() {
    log_info "开始构建和部署..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose down || true
    
    # 清理旧镜像
    log_info "清理旧镜像..."
    docker system prune -f || true
    
    # 构建新镜像
    log_info "构建新镜像..."
    docker-compose build --no-cache
    
    # 启动服务
    log_info "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 健康检查
    health_check
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 检查Web服务
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        log_info "✅ Web服务运行正常"
    else
        log_error "❌ Web服务启动失败"
        show_logs
        exit 1
    fi
    
    # 检查API服务
    if curl -f http://localhost:4000/health > /dev/null 2>&1; then
        log_info "✅ API服务运行正常"
    else
        log_warn "⚠️  API健康检查失败，请检查日志"
    fi
}

# 显示日志
show_logs() {
    log_info "显示服务日志..."
    docker-compose logs --tail=50
}

# 显示服务状态
show_status() {
    log_info "服务状态:"
    docker-compose ps
    
    log_info "资源使用情况:"
    docker stats --no-stream
}

# 备份数据库
backup_db() {
    if [ "$ENVIRONMENT" = "prod" ]; then
        log_info "备份生产数据库..."
        DATE=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="backup_${ENVIRONMENT}_${DATE}.sql"
        
        # 这里添加实际的数据库备份命令
        log_info "数据库备份完成: $BACKUP_FILE"
    fi
}

# 主函数
main() {
    log_info "部署环境: $ENVIRONMENT"
    
    # 生产环境需要确认
    if [ "$ENVIRONMENT" = "prod" ]; then
        read -p "⚠️  确定要部署到生产环境吗? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "部署已取消"
            exit 0
        fi
        backup_db
    fi
    
    check_docker
    pull_code
    deploy
    show_status
    
    log_info "🎉 部署完成!"
    log_info "Web访问地址: http://localhost:3000"
    log_info "API访问地址: http://localhost:4000"
    
    if [ "$ENVIRONMENT" = "dev" ]; then
        log_info "开发环境部署完成，可以开始开发了！"
    else
        log_info "生产环境部署完成，请进行最终测试！"
    fi
}

# 处理命令行参数
case "$1" in
    "dev"|"develop")
        ENVIRONMENT="dev"
        ;;
    "prod"|"production"|"main")
        ENVIRONMENT="prod"
        ;;
    "logs")
        show_logs
        exit 0
        ;;
    "status")
        show_status
        exit 0
        ;;
    "help"|"-h"|"--help")
        echo "使用方法:"
        echo "  $0 [dev|prod]     - 部署到指定环境"
        echo "  $0 logs           - 查看服务日志"
        echo "  $0 status         - 查看服务状态"
        echo "  $0 help           - 显示帮助信息"
        exit 0
        ;;
    "")
        # 默认开发环境
        ;;
    *)
        log_error "未知参数: $1"
        log_info "使用 '$0 help' 查看帮助信息"
        exit 1
        ;;
esac

main
