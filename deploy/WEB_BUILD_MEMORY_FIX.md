# Next.js 构建内存不足问题解决方案

## 问题描述

在服务器上运行 `npm run build` 时出现错误：
```
Next.js build worker exited with code: null and signal: SIGKILL
```

这个错误通常表示构建进程被系统杀死（OOM Killer），原因是内存不足。

---

## 解决方案

### 方案 1：增加 Node.js 内存限制（已配置）

**推荐方案**，已在 `package.json` 中配置：

```json
"build": "NODE_OPTIONS='--max-old-space-size=1024' next build"
```

这将 Node.js 的内存限制设置为 1GB，适合 1.8GB 内存的服务器。

**根据服务器内存大小调整：**

- **1.8GB 服务器（当前配置）**：使用 1GB
  ```json
  "build": "NODE_OPTIONS='--max-old-space-size=1024' next build"
  ```

- **2-3GB 服务器**：使用 1.5GB
  ```json
  "build": "NODE_OPTIONS='--max-old-space-size=1536' next build"
  ```

- **4GB 服务器**：使用 2GB
  ```json
  "build": "NODE_OPTIONS='--max-old-space-size=2048' next build"
  ```

- **8GB+ 服务器**：使用 4GB 或更多
  ```json
  "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  ```

---

### 方案 2：临时设置环境变量（不修改代码）

在服务器上执行构建时，直接设置环境变量：

**对于 1.8GB 内存的服务器（推荐）：**
```bash
cd /www/wwwroot/shumu/web
NODE_OPTIONS='--max-old-space-size=1024' npm run build
```

或者：

```bash
cd /www/wwwroot/shumu/web
export NODE_OPTIONS='--max-old-space-size=1024'
npm run build
```

**注意**：如果服务器内存更大，可以相应增加：
- 2-3GB 服务器：`--max-old-space-size=1536`
- 4GB 服务器：`--max-old-space-size=2048`
- 8GB+ 服务器：`--max-old-space-size=4096`

---

### 方案 3：增加服务器 Swap 空间（强烈推荐）

**对于 1.8GB 内存的服务器，强烈建议增加 swap 空间！**

当前 swap 只有 1GB（已用749MB），建议增加到 2-4GB：

```bash
# 1. 检查当前 swap 使用情况（你已执行过）
free -h

# 2. 创建 2GB swap 文件（推荐，适合1.8GB内存的服务器）
sudo fallocate -l 2G /swapfile
# 或者使用 dd（如果 fallocate 不可用）
# sudo dd if=/dev/zero of=/swapfile bs=1024 count=2097152

# 3. 设置正确的权限
sudo chmod 600 /swapfile

# 4. 格式化为 swap
sudo mkswap /swapfile

# 5. 启用 swap
sudo swapon /swapfile

# 6. 永久启用（系统重启后仍然有效）
# 先检查 /etc/fstab 中是否已有 swapfile 配置
grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 7. 验证 swap 已启用
free -h
```

**如果磁盘空间充足，可以创建更大的 swap（4GB）：**
```bash
sudo fallocate -l 4G /swapfile
# 或
# sudo dd if=/dev/zero of=/swapfile bs=1024 count=4194304
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**注意**：
- Swap 会使用磁盘空间，虽然可以缓解内存压力，但会降低构建速度
- 对于 1.8GB 内存的服务器，增加 swap 是必要的
- 构建完成后，swap 使用会自动降低

---

### 方案 4：优化 Next.js 配置（降低内存使用）

如果内存确实不足，可以在 `next.config.ts` 中添加配置来优化构建：

```typescript
const nextConfig: NextConfig = {
  // ... 现有配置 ...
  
  // 降低并发构建数量，减少内存使用
  experimental: {
    workerThreads: false,
    cpus: 1, // 只使用 1 个 CPU 核心
  },
};
```

**注意**：这会降低构建速度，但可以减少内存使用。

---

### 方案 5：在本地构建后上传（临时方案）

如果服务器内存确实不足，可以在本地构建后上传构建产物：

```bash
# 1. 在本地（开发机器）构建
cd web
npm install
npm run build

# 2. 上传 .next 目录到服务器
# 使用 scp 或 rsync
scp -r .next user@server:/www/wwwroot/shumu/web/

# 3. 在服务器上启动服务
cd /www/wwwroot/shumu/web
npm run start
```

**注意**：这要求本地和服务器环境相同（Node.js 版本、操作系统架构等）。

---

## 推荐操作步骤

### 对于 1.8GB 内存的服务器（当前配置）

1. ✅ **已自动配置**：`package.json` 中的 build 脚本已设置内存限制为 1GB
2. **强烈建议先增加 swap 空间**（见方案 3），因为 1.8GB 内存较小
3. 执行构建：
   ```bash
   cd /www/wwwroot/shumu/web
   npm run build
   ```

### 对于服务器内存 >= 4GB

1. 可以将内存限制调整为 2GB 或更高：
   ```json
   "build": "NODE_OPTIONS='--max-old-space-size=2048' next build"
   ```
2. 执行构建：
   ```bash
   cd /www/wwwroot/shumu/web
   npm run build
   ```

---

## 检查服务器内存

在服务器上执行以下命令检查可用内存：

```bash
# 查看内存使用情况
free -h

# 查看系统资源限制
ulimit -a

# 查看进程内存使用情况（如果构建失败，可以看到哪个进程使用了最多内存）
ps aux --sort=-%mem | head -10
```

---

## 验证构建成功

构建成功后，应该能看到：

```bash
cd /www/wwwroot/shumu/web
ls -lh .next
```

应该能看到 `.next` 目录已生成，并且包含构建产物。

---

## 其他提示

1. **关闭其他占用内存的服务**：构建前关闭不必要的服务，释放内存
2. **使用生产依赖安装**：`npm install --production=false` 确保所有依赖都安装
3. **清理缓存**：如果之前构建失败，清理缓存后重试：
   ```bash
   rm -rf .next
   rm -rf node_modules/.cache
   npm run build
   ```

---

## 常见错误

### 错误：`NODE_OPTIONS: command not found`

**原因**：在 shell 脚本中直接使用 `NODE_OPTIONS` 可能不兼容。

**解决**：使用 `export` 命令：
```bash
export NODE_OPTIONS='--max-old-space-size=4096'
npm run build
```

### 错误：构建仍然失败，内存不足

**解决**：
1. 检查服务器实际可用内存：`free -h`
2. 降低内存限制值
3. 增加 swap 空间
4. 考虑升级服务器配置

