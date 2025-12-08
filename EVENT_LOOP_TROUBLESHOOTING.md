# 事件循环延迟问题排查指南

## 问题说明

当看到以下警告时，表示 Node.js 事件循环被阻塞：
```
[EventLoop] ⚠️ 延迟警告 #X: 1000.44ms (阈值: 100ms)
```

**正常情况**：事件循环延迟应该在几毫秒以内（< 10ms）
**警告阈值**：100ms
**严重阈值**：500ms

## 常见原因

### 1. 内存压力导致的垃圾回收（GC）阻塞
- **症状**：延迟突然增加，堆内存使用率 > 80%
- **解决**：
  - 检查是否有内存泄漏
  - 减少大对象创建
  - 增加 Node.js 堆内存限制：`NODE_OPTIONS=--max-old-space-size=4096`

### 2. 同步阻塞操作
- **症状**：延迟与特定操作相关
- **常见操作**：
  - 大量同步文件 I/O
  - 同步数据库查询
  - 大量 JSON 解析
  - 正则表达式匹配大量文本
- **解决**：将同步操作改为异步

### 3. CPU 密集型任务
- **症状**：延迟与计算任务相关
- **常见操作**：
  - 大量数据处理
  - 图像处理
  - 加密/解密操作
- **解决**：
  - 使用 Worker Threads 处理 CPU 密集型任务
  - 分批处理数据
  - 使用流式处理

### 4. 大量日志输出
- **症状**：延迟与日志频率相关
- **解决**：
  - 减少不必要的 console.log
  - 使用日志级别控制
  - 生产环境禁用详细日志

### 5. 网络请求阻塞
- **症状**：延迟与 API 请求相关
- **解决**：
  - 确保所有网络请求都是异步的
  - 添加请求超时
  - 使用连接池

## 排查步骤

### 步骤 1：查看详细诊断信息

监控代码会在延迟超过 500ms 时自动输出诊断信息：
- 内存使用情况
- CPU 使用情况
- 活跃句柄和请求数量

### 步骤 2：检查内存使用

```bash
# 查看进程内存使用
ps aux | grep node

# 或使用 Node.js 内置监控
node --inspect your-app.js
# 然后在 Chrome DevTools 中查看内存分析
```

### 步骤 3：使用 Node.js 性能分析工具

```bash
# 使用 clinic.js 分析性能
npm install -g clinic
clinic doctor -- node your-app.js

# 或使用 0x 生成火焰图
npm install -g 0x
0x your-app.js
```

### 步骤 4：检查代码中的同步操作

搜索代码中的同步操作：
- `fs.readFileSync`
- `fs.writeFileSync`
- `JSON.parse` (处理大对象)
- `JSON.stringify` (处理大对象)
- 大量 `console.log`

## 优化建议

### 1. 减少日志输出
已优化：生产环境自动减少 API 代理日志输出

### 2. 异步化所有 I/O 操作
确保所有文件、数据库、网络操作都是异步的

### 3. 使用流式处理
对于大量数据，使用流式处理而不是一次性加载

### 4. 分批处理
将大任务拆分成小批次，使用 `setImmediate` 或 `process.nextTick` 让事件循环有机会处理其他任务

### 5. 增加资源限制
```bash
# Docker 环境
docker run --memory="2g" --cpus="2" your-image

# 或设置环境变量
NODE_OPTIONS=--max-old-space-size=4096
```

## 监控配置

可以在启动时自定义监控参数：

```javascript
const { startEventLoopMonitoring } = require('./event-loop-monitor');

startEventLoopMonitoring({
  checkInterval: 1000,      // 检查间隔（毫秒）
  warningThreshold: 100,    // 警告阈值（毫秒）
  criticalThreshold: 500,   // 严重警告阈值（毫秒）
});
```

## 临时解决方案

如果问题持续存在，可以：

1. **增加警告阈值**（不推荐，只是隐藏问题）：
   ```javascript
   startEventLoopMonitoring({
     warningThreshold: 200,  // 提高到 200ms
   });
   ```

2. **增加 Node.js 堆内存**：
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

3. **减少并发请求**：
   - 限制同时处理的请求数量
   - 使用队列处理请求

## 长期解决方案

1. **代码审查**：检查是否有同步阻塞操作
2. **性能测试**：使用压力测试工具找出瓶颈
3. **监控告警**：设置监控告警，及时发现问题
4. **定期优化**：定期审查和优化代码性能

