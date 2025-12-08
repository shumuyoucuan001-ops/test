// 事件循环延迟监控模块
// 可以在任何 Node.js 应用中独立使用

let eventLoopMonitor = null;
let isMonitoring = false;

/**
 * 启动事件循环延迟监控
 * @param {Object} options 配置选项
 * @param {number} options.checkInterval 检查间隔（毫秒），默认 1000ms
 * @param {number} options.warningThreshold 警告阈值（毫秒），默认 100ms
 * @param {number} options.criticalThreshold 严重警告阈值（毫秒），默认 500ms
 */
function startEventLoopMonitoring(options = {}) {
    if (isMonitoring) {
        console.warn('[EventLoop] 监控已在运行中，跳过重复启动');
        return;
    }

    const CHECK_INTERVAL = options.checkInterval || 1000;
    const WARNING_THRESHOLD = options.warningThreshold || 100;
    const CRITICAL_THRESHOLD = options.criticalThreshold || 500;

    let lastCheck = process.hrtime.bigint();
    let warningCount = 0;
    let criticalCount = 0;

    eventLoopMonitor = setInterval(() => {
        const now = process.hrtime.bigint();
        const delayNs = now - lastCheck;
        const delayMs = Number(delayNs) / 1_000_000; // 转换为毫秒

        // 正常情况下，延迟应该在几毫秒以内
        // 如果延迟超过阈值，说明事件循环被阻塞
        if (delayMs > CRITICAL_THRESHOLD) {
            criticalCount++;
            console.error(`[EventLoop] ⚠️ 严重阻塞检测 #${criticalCount}: ${delayMs.toFixed(2)}ms (阈值: ${CRITICAL_THRESHOLD}ms)`);
            console.error(`[EventLoop] 事件循环被严重阻塞，可能影响服务响应`);

            // 添加诊断信息
            if (process.memoryUsage) {
                const mem = process.memoryUsage();
                console.error(`[EventLoop] 内存使用: RSS=${(mem.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB/${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB`);
            }

            // 输出 CPU 使用情况
            if (process.cpuUsage) {
                const cpu = process.cpuUsage();
                console.error(`[EventLoop] CPU使用: user=${(cpu.user / 1000).toFixed(2)}ms, system=${(cpu.system / 1000).toFixed(2)}ms`);
            }

            // 输出进程运行时间
            const uptime = process.uptime();
            console.error(`[EventLoop] 进程运行时间: ${Math.floor(uptime / 60)}分${Math.floor(uptime % 60)}秒`);
        } else if (delayMs > WARNING_THRESHOLD) {
            warningCount++;
            console.warn(`[EventLoop] ⚠️ 延迟警告 #${warningCount}: ${delayMs.toFixed(2)}ms (阈值: ${WARNING_THRESHOLD}ms)`);
        }

        lastCheck = now;
    }, CHECK_INTERVAL);

    isMonitoring = true;
    console.log('[EventLoop] ✅ 事件循环延迟监控已启动');
    console.log(`[EventLoop] 检查间隔: ${CHECK_INTERVAL}ms, 警告阈值: ${WARNING_THRESHOLD}ms, 严重阈值: ${CRITICAL_THRESHOLD}ms`);
}

/**
 * 停止事件循环延迟监控
 */
function stopEventLoopMonitoring() {
    if (eventLoopMonitor) {
        clearInterval(eventLoopMonitor);
        eventLoopMonitor = null;
        isMonitoring = false;
        console.log('[EventLoop] 事件循环延迟监控已停止');
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        startEventLoopMonitoring,
        stopEventLoopMonitoring,
    };
}

// 如果直接运行此文件，自动启动监控
if (require.main === module) {
    startEventLoopMonitoring();

    // 优雅关闭
    process.on('SIGTERM', () => {
        console.log('[EventLoop] 收到 SIGTERM，停止监控...');
        stopEventLoopMonitoring();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('[EventLoop] 收到 SIGINT，停止监控...');
        stopEventLoopMonitoring();
        process.exit(0);
    });
}

