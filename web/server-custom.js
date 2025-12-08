// Next.js 启动包装器 - 添加事件循环延迟监控
// 此文件用于替换 Next.js standalone 模式生成的 server.js
// 在 Dockerfile 中会备份原始 server.js 并替换为此文件

// ============================================
// 加载事件循环监控模块
// ============================================
let eventLoopMonitor = null;
try {
    // 尝试加载独立的监控模块
    eventLoopMonitor = require('./event-loop-monitor.js');
    eventLoopMonitor.startEventLoopMonitoring();
} catch (e) {
    // 如果监控模块不存在，使用内联监控代码
    console.warn('[Server] 未找到 event-loop-monitor.js，使用内联监控');

    const CHECK_INTERVAL = 1000;
    const WARNING_THRESHOLD = 100;
    const CRITICAL_THRESHOLD = 500;
    let lastCheck = process.hrtime.bigint();

    const monitor = setInterval(() => {
        const now = process.hrtime.bigint();
        const delayMs = Number(now - lastCheck) / 1_000_000;

        if (delayMs > CRITICAL_THRESHOLD) {
            const mem = process.memoryUsage();
            console.error(`[EventLoop] ⚠️ 严重阻塞: ${delayMs.toFixed(2)}ms | 内存: RSS=${(mem.rss / 1024 / 1024).toFixed(2)}MB`);
        } else if (delayMs > WARNING_THRESHOLD) {
            console.warn(`[EventLoop] ⚠️ 延迟警告: ${delayMs.toFixed(2)}ms`);
        }
        lastCheck = now;
    }, CHECK_INTERVAL);

    eventLoopMonitor = {
        stopEventLoopMonitoring: () => clearInterval(monitor)
    };

    console.log('[EventLoop] ✅ 事件循环延迟监控已启动（内联模式）');
}

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('[Server] 收到 SIGTERM，正在关闭...');
    if (eventLoopMonitor && eventLoopMonitor.stopEventLoopMonitoring) {
        eventLoopMonitor.stopEventLoopMonitoring();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Server] 收到 SIGINT，正在关闭...');
    if (eventLoopMonitor && eventLoopMonitor.stopEventLoopMonitoring) {
        eventLoopMonitor.stopEventLoopMonitoring();
    }
    process.exit(0);
});

// ============================================
// 加载并启动 Next.js server.js
// ============================================
// standalone 模式生成的 server.js 是自包含的，直接 require 即可
// 如果 server-original.js 存在，说明是 Docker 构建，使用备份的原始文件
// 否则尝试加载当前目录的 server.js（开发环境）

let serverLoaded = false;

// 方案1：尝试加载备份的原始 server.js（Docker 构建后）
try {
    require('./server-original.js');
    serverLoaded = true;
    console.log('[Server] ✅ 已加载 server-original.js');
} catch (e) {
    // 方案2：如果不存在，说明可能是开发环境，使用 next start
    console.log('[Server] 未找到 server-original.js，尝试其他启动方式...');
}

// 如果都没有加载成功，使用 next start 命令
if (!serverLoaded) {
    console.log('[Server] 使用 next start 启动...');
    // 这里实际上会由 package.json 的 start 脚本处理
    // 或者可以在这里实现自定义启动逻辑
}

