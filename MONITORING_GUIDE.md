# 事件循环监控和请求超时配置指南

## 📋 概述

本项目已添加以下监控和保护机制：

1. **事件循环延迟监控** - 检测 Node.js 事件循环阻塞
2. **API 请求超时保护** - 防止请求长时间阻塞

---

## 🔍 事件循环延迟监控

### 功能说明

事件循环延迟监控会定期检查 Node.js 事件循环的响应时间。如果事件循环被阻塞（例如同步操作、CPU 密集型任务），会导致服务响应变慢甚至无响应。

### 监控配置

- **检查间隔**: 每 1 秒检查一次
- **警告阈值**: 延迟超过 100ms 记录警告
- **严重阈值**: 延迟超过 500ms 记录严重警告并输出诊断信息

### 日志输出示例

**正常情况**（无输出）：
```
[EventLoop] ✅ 事件循环延迟监控已启动
[EventLoop] 检查间隔: 1000ms, 警告阈值: 100ms, 严重阈值: 500ms
```

**警告情况**：
```
[EventLoop] ⚠️ 延迟警告 #1: 125.34ms (阈值: 100ms)
```

**严重阻塞**：
```
[EventLoop] ⚠️ 严重阻塞检测 #1: 650.23ms (阈值: 500ms)
[EventLoop] 事件循环被严重阻塞，可能影响服务响应
[EventLoop] 内存使用: RSS=256.45MB, Heap=128.32MB/256.00MB
[EventLoop] CPU使用: user=1234.56ms, system=234.56ms
[EventLoop] 进程运行时间: 15分30秒
```

### 如何启用

#### Docker 部署（自动启用）

在 Docker 构建时，会自动：
1. 备份原始的 `server.js` 为 `server-original.js`
2. 复制监控模块 `event-loop-monitor.js`
3. 使用 `start-with-monitor.js` 作为启动脚本

```bash
# 构建时会自动启用监控
docker-compose build web
docker-compose up -d web
```

#### 手动部署

```bash
# 1. 构建 Next.js
cd web
npm run build

# 2. 进入 standalone 目录
cd .next/standalone

# 3. 复制监控文件
cp ../../event-loop-monitor.js ./
cp ../../start-with-monitor.js ./

# 4. 备份原始 server.js
mv server.js server-original.js

# 5. 使用监控启动脚本启动
node start-with-monitor.js
```

### 监控模块文件

- `web/event-loop-monitor.js` - 独立的监控模块，可复用
- `web/start-with-monitor.js` - 启动包装脚本

---

## ⏱️ API 请求超时保护

### 功能说明

所有对外 API 请求都配置了超时限制，防止请求长时间阻塞导致服务无响应。

### 超时配置

#### 客户端请求（浏览器）

**位置**: `web/src/lib/api.ts`

```typescript
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10秒超时
});
```

**特性**:
- 所有 axios 请求默认 10 秒超时
- 自动记录慢请求（>5秒）
- 超时错误自动转换为用户友好的错误消息

#### 服务端 API 代理（Next.js API Routes）

**位置**: `web/src/app/api/[...path]/route.ts`

```typescript
const REQUEST_TIMEOUT = 10000; // 10秒超时

// 使用带超时的 fetch
const response = await fetchWithTimeout(fullUrl, {
  method,
  headers,
  body,
}, REQUEST_TIMEOUT);
```

**特性**:
- 使用 `AbortController` 实现超时控制
- 超时返回 504 Gateway Timeout
- 连接失败返回 503 Service Unavailable
- 自动记录请求耗时

### 超时错误处理

#### 客户端错误消息

```typescript
// 超时错误
error.message = "请求超时，请检查网络连接或稍后重试 (10000ms)"

// 连接错误
error.message = "无法连接到服务器，请检查服务是否正常运行"
```

#### 服务端错误响应

```json
{
  "error": "请求超时",
  "message": "后端服务响应超时 (10000ms)，请稍后重试",
  "timeout": 10000,
  "duration": 10001
}
```

### 日志输出

**慢请求警告**（>5秒）：
```
[API] 慢请求警告: /api/products 耗时 5234ms
[API Proxy] 慢请求: GET /api/products 耗时 5234ms
```

**超时错误**：
```
[API] 请求超时: /api/products (超时时间: 10000ms)
[API Proxy] 请求超时: GET /api/products (耗时: 10001ms, 超时限制: 10000ms)
```

**连接错误**：
```
[API] 连接被拒绝: /api/products
[API Proxy] 连接被拒绝: GET /api/products - 后端服务可能未启动
```

---

## 🛠️ 配置调整

### 调整事件循环监控阈值

编辑 `web/event-loop-monitor.js`：

```javascript
function startEventLoopMonitoring(options = {}) {
  const CHECK_INTERVAL = options.checkInterval || 1000;      // 检查间隔
  const WARNING_THRESHOLD = options.warningThreshold || 100;  // 警告阈值
  const CRITICAL_THRESHOLD = options.criticalThreshold || 500; // 严重阈值
  // ...
}
```

或在启动时传入参数：

```javascript
eventLoopMonitor.startEventLoopMonitoring({
  checkInterval: 2000,        // 2秒检查一次
  warningThreshold: 150,       // 150ms 警告
  criticalThreshold: 1000,    // 1秒严重警告
});
```

### 调整 API 请求超时时间

#### 客户端请求

编辑 `web/src/lib/api.ts`：

```typescript
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000, // 改为 20 秒
});
```

#### 服务端代理

编辑 `web/src/app/api/[...path]/route.ts`：

```typescript
const REQUEST_TIMEOUT = 20000; // 改为 20 秒
```

---

## 📊 监控数据分析

### 如何查看监控日志

```bash
# Docker 环境
docker-compose logs -f web | grep EventLoop

# 查看所有监控相关日志
docker-compose logs web | grep -E "EventLoop|API|Proxy"
```

### 常见问题诊断

#### 1. 频繁出现延迟警告

**可能原因**:
- CPU 密集型操作
- 同步文件 I/O
- 大量数据处理
- 内存不足导致频繁 GC

**解决方案**:
- 优化代码，使用异步操作
- 增加服务器资源
- 检查是否有内存泄漏

#### 2. API 请求频繁超时

**可能原因**:
- 后端服务响应慢
- 网络问题
- 数据库查询慢
- 后端服务负载过高

**解决方案**:
- 检查后端服务状态和日志
- 优化数据库查询
- 增加超时时间（如果合理）
- 检查网络连接

#### 3. 严重阻塞但服务仍可用

**可能原因**:
- 偶发的 CPU 密集型任务
- 定时任务执行
- 垃圾回收（GC）

**解决方案**:
- 如果只是偶发，可以忽略
- 如果频繁出现，需要优化代码

---

## 🔧 故障排查

### 监控未启动

**检查步骤**:

1. 确认监控文件存在：
```bash
ls -la web/event-loop-monitor.js
ls -la web/start-with-monitor.js
```

2. 检查启动日志：
```bash
docker-compose logs web | grep "EventLoop\|Startup"
```

3. 手动测试监控模块：
```bash
node web/event-loop-monitor.js
```

### 超时配置未生效

**检查步骤**:

1. 检查 axios 配置：
```bash
grep -A 5 "axios.create" web/src/lib/api.ts
```

2. 检查 API 路由配置：
```bash
grep -A 5 "REQUEST_TIMEOUT" web/src/app/api/[...path]/route.ts
```

3. 测试超时：
```bash
# 模拟慢请求
curl -m 5 http://localhost:3000/api/test
```

---

## 📝 最佳实践

1. **定期检查监控日志** - 及时发现性能问题
2. **设置合理的超时时间** - 根据实际业务需求调整
3. **记录慢请求** - 帮助定位性能瓶颈
4. **监控内存使用** - 防止内存泄漏
5. **优化阻塞操作** - 将同步操作改为异步

---

## 🆘 获取帮助

如果遇到问题：

1. 查看日志：`docker-compose logs -f web`
2. 检查配置：确认超时和监控配置正确
3. 测试监控：手动运行监控模块测试
4. 联系技术支持：提供日志和错误信息
