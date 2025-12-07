#!/bin/bash

echo "🚀 启动术木优选标签打印管理系统开发环境..."

# 检查依赖是否已安装
check_dependencies() {
    echo "📦 检查项目依赖..."
    
    if [ ! -d "server/node_modules" ]; then
        echo "📡 安装后端依赖..."
        cd server && npm install && cd ..
    fi
    
    if [ ! -d "web/node_modules" ]; then
        echo "🌐 安装前端依赖..."
        cd web && npm install && cd ..
    fi
    
    if [ ! -d "SmLabelAppExpo/node_modules" ]; then
        echo "📱 安装移动端依赖..."
        cd SmLabelAppExpo && npm install && cd ..
    fi
}

# 启动后端服务
start_backend() {
    echo "📡 启动后端API服务 (端口4000)..."
    cd server
    npm start &
    BACKEND_PID=$!
    echo "后端PID: $BACKEND_PID"
    cd ..
}

# 启动前端服务
start_frontend() {
    echo "🌐 启动前端Web服务 (端口3000)..."
    sleep 3  # 等待后端启动
    cd web
    npm run dev &
    FRONTEND_PID=$!
    echo "前端PID: $FRONTEND_PID"
    cd ..
}

# 启动移动端服务 (可选)
start_mobile() {
    if [ "$1" = "--mobile" ]; then
        echo "📱 启动Expo移动端服务..."
        sleep 5  # 等待其他服务启动
        cd SmLabelAppExpo
        npx expo start &
        MOBILE_PID=$!
        echo "移动端PID: $MOBILE_PID"
        cd ..
    fi
}

# 清理函数
cleanup() {
    echo "🛑 正在关闭开发服务器..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    if [ ! -z "$MOBILE_PID" ]; then
        kill $MOBILE_PID 2>/dev/null
    fi
    echo "✅ 所有服务已关闭"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 主执行流程
main() {
    check_dependencies
    start_backend
    start_frontend
    start_mobile $1
    
    echo ""
    echo "🎉 开发环境启动完成！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Web前端:  http://localhost:3000"
    echo "📡 后端API:  http://localhost:4000"
    if [ "$1" = "--mobile" ]; then
        echo "📱 移动端:   扫描二维码或查看Expo界面"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 使用说明:"
    echo "   - 按 Ctrl+C 停止所有服务"
    echo "   - 添加 --mobile 参数启动移动端"
    echo "   - 日志会在各自终端中显示"
    echo ""
    
    # 保持脚本运行
    wait
}

# 执行主函数
main $1
