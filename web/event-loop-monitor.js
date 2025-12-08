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
    let consecutiveWarnings = 0; // 连续警告计数

    eventLoopMonitor = setInterval(() => {
        const now = process.hrtime.bigint();
        const delayNs = now - lastCheck;
        const delayMs = Number(delayNs) / 1_000_000; // 转换为毫秒

        // 正常情况下，延迟应该在几毫秒以内
        // 如果延迟超过阈值，说明事件循环被阻塞
        if (delayMs > CRITICAL_THRESHOLD) {
            criticalCount++;
            consecutiveWarnings++;
            console.error(`[EventLoop] ⚠️ 严重阻塞检测 #${criticalCount}: ${delayMs.toFixed(2)}ms (阈值: ${CRITICAL_THRESHOLD}ms)`);
            console.error(`[EventLoop] 事件循环被严重阻塞，可能影响服务响应`);

            // 添加诊断信息
            if (process.memoryUsage) {
                const mem = process.memoryUsage();
                const heapUsedPercent = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1);
                console.error(`[EventLoop] 内存: RSS=${(mem.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB/${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB (${heapUsedPercent}%)`);

                // 如果堆内存使用率超过 80%，可能是内存压力导致的 GC 阻塞
                if (parseFloat(heapUsedPercent) > 80) {
                    console.error(`[EventLoop] ⚠️ 堆内存使用率 ${heapUsedPercent}%，频繁的垃圾回收可能导致阻塞`);
                }
            }

            // 输出 CPU 使用情况
            if (process.cpuUsage) {
                const cpu = process.cpuUsage();
                console.error(`[EventLoop] CPU: user=${(cpu.user / 1000).toFixed(2)}ms, system=${(cpu.system / 1000).toFixed(2)}ms`);
            }

            // 输出进程运行时间
            const uptime = process.uptime();
            console.error(`[EventLoop] 运行时间: ${Math.floor(uptime / 60)}分${Math.floor(uptime % 60)}秒`);

            // 输出事件循环统计
            if (process._getActiveHandles) {
                try {
                    const handles = process._getActiveHandles();
                    const requests = process._getActiveRequests();
                    console.error(`[EventLoop] 活跃句柄: ${handles.length}, 活跃请求: ${requests.length}`);
                } catch (e) {
                    // 忽略错误
                }
            }
        } else if (delayMs > WARNING_THRESHOLD) {
            warningCount++;
            consecutiveWarnings++;

            // 只在延迟超过 200ms 或连续警告时输出详细信息
            if (delayMs > 200 || consecutiveWarnings % 5 === 0) {
                console.warn(`[EventLoop] ⚠️ 延迟警告 #${warningCount}: ${delayMs.toFixed(2)}ms (阈值: ${WARNING_THRESHOLD}ms)`);

                // 如果延迟超过 500ms，添加诊断信息
                if (delayMs > 500) {
                    if (process.memoryUsage) {
                        const mem = process.memoryUsage();
                        const heapUsedPercent = ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1);
                        console.warn(`[EventLoop] 内存: RSS=${(mem.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB/${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB (${heapUsedPercent}%)`);
                    }

                    // 输出事件循环统计（如果可用）
                    if (process._getActiveHandles) {
                        try {
                            const handles = process._getActiveHandles();
                            const requests = process._getActiveRequests();
                            console.warn(`[EventLoop] 活跃句柄: ${handles.length}, 活跃请求: ${requests.length}`);
                        } catch (e) {
                            // 忽略错误
                        }
                    }
                }
            }
        } else {
            // 延迟恢复正常，重置连续警告计数
            if (consecutiveWarnings > 0) {
                console.log(`[EventLoop] ✅ 延迟已恢复正常 (之前连续 ${consecutiveWarnings} 次警告)`);
                consecutiveWarnings = 0;
            }
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

