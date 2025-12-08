#!/usr/bin/env node
// Next.js 启动包装脚本 - 添加事件循环延迟监控
// 此脚本在启动 Next.js server.js 之前先启动监控

// ============================================
// 加载并启动事件循环监控
// ============================================
let eventLoopMonitor = null;

try {
  // 尝试加载独立的监控模块
  eventLoopMonitor = require('./event-loop-monitor.js');
  eventLoopMonitor.startEventLoopMonitoring();
  console.log('[Startup] ✅ 事件循环监控已启动');
} catch (e) {
  // 如果监控模块不存在，使用内联监控
  console.warn('[Startup] 未找到 event-loop-monitor.js，使用内联监控');
  
  const CHECK_INTERVAL = 1000;
  const WARNING_THRESHOLD = 100;
  const CRITICAL_THRESHOLD = 500;
  let lastCheck = process.hrtime.bigint();
  let warningCount = 0;
  let criticalCount = 0;
  
  const monitor = setInterval(() => {
    const now = process.hrtime.bigint();
    const delayMs = Number(now - lastCheck) / 1_000_000;
    
    if (delayMs > CRITICAL_THRESHOLD) {
      criticalCount++;
      const mem = process.memoryUsage();
      console.error(`[EventLoop] ⚠️ 严重阻塞 #${criticalCount}: ${delayMs.toFixed(2)}ms | 内存: RSS=${(mem.rss / 1024 / 1024).toFixed(2)}MB`);
    } else if (delayMs > WARNING_THRESHOLD) {
      warningCount++;
      console.warn(`[EventLoop] ⚠️ 延迟警告 #${warningCount}: ${delayMs.toFixed(2)}ms`);
    }
    lastCheck = now;
  }, CHECK_INTERVAL);
  
  eventLoopMonitor = {
    stopEventLoopMonitoring: () => {
      clearInterval(monitor);
      console.log('[EventLoop] 监控已停止');
    }
  };
  
  console.log('[Startup] ✅ 事件循环监控已启动（内联模式）');
}

// 优雅关闭处理
function cleanup() {
  console.log('[Startup] 正在关闭...');
  if (eventLoopMonitor && eventLoopMonitor.stopEventLoopMonitoring) {
    eventLoopMonitor.stopEventLoopMonitoring();
  }
}

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

// ============================================
// 加载并执行 Next.js server.js
// ============================================
console.log('[Startup] 正在加载 Next.js server...');

// 尝试加载 server.js（standalone 模式生成的文件）
// 如果不存在，尝试 server-original.js（Docker 构建后的备份）
let serverFile = null;
try {
  require.resolve('./server.js');
  serverFile = './server.js';
} catch (e) {
  try {
    require.resolve('./server-original.js');
    serverFile = './server-original.js';
  } catch (e2) {
    console.error('[Startup] ❌ 未找到 server.js 或 server-original.js');
    console.error('[Startup] 请确保已运行 npm run build 生成 standalone 文件');
    process.exit(1);
  }
}

console.log(`[Startup] 加载服务器文件: ${serverFile}`);
require(serverFile);

