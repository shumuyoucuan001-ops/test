# Docker 部署指南

使用 Docker Compose 部署完整的后端和前端服务。

---

## 🎯 **为什么使用 Docker？**

- ✅ **环境一致性**：开发、测试、生产环境完全一致
- ✅ **Playwright 支持**：使用官方镜像，包含 Chromium 和所有依赖
- ✅ **简单部署**：一条命令启动所有服务
- ✅ **易于回滚**：出问题可以快速回到之前的版本

---

## 📋 **前置要求**

1. 服务器上已安装 Docker 和 Docker Compose
2. 代码已上传到 GitHub
3. 服务器可以访问 GitHub

---

## 🚀 **宝塔面板部署步骤**

### **步骤1：安装 Docker**

在宝塔终端执行：

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker
systemctl start docker
systemctl enable docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

---

### **步骤2：准备项目代码**

```bash
# 创建项目目录
mkdir -p /www/docker/shumu
cd /www/docker/shumu

# 克隆代码
git clone -b develop https://github.com/xuxiang6/shumu.git .

# 或者如果已存在，拉取最新代码
git pull origin develop
```

---

### **步骤3：准备环境配置**

创建 `.env` 文件：

```bash
cat > .env << 'ENV_EOF'
# 数据库配置
DATABASE_URL="mysql://root:your_password@host.docker.internal:3306/sm_xitongkaifa"

# 端口配置
PORT=5000

# Node 环境
NODE_ENV=production
ENV_EOF
```

**注意：** 
- 将 `your_password` 替换为实际的 MySQL 密码
- `host.docker.internal` 用于从容器访问宿主机的 MySQL

---

### **步骤4：编译后端代码**

```bash
cd /www/docker/shumu/server

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 验证编译结果
ls -lh dist/
```

---

### **步骤5：构建并启动 Docker 容器**

```bash
cd /www/docker/shumu

# 构建镜像（首次或代码更新后执行）
docker-compose build --no-cache

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f api
```

---

### **步骤6：验证部署**

```bash
# 测试健康检查
curl http://127.0.0.1:5000/health

# 测试模板渲染
curl -X POST "http://127.0.0.1:5000/templates/1/render" \
  -H "Content-Type: application/json" \
  -d '{"spec":"测试规格","qrDataUrl":"TEST123","barcodeTail":"456","renderAsBitmap":true,"copies":1}' \
  | head -c 600
```

---

## 🔧 **常用 Docker 命令**

### **查看服务状态**
```bash
docker-compose ps
```

### **查看日志**
```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f api

# 查看最近100行
docker-compose logs --tail=100 api
```

### **重启服务**
```bash
# 重启所有服务
docker-compose restart

# 只重启后端
docker-compose restart api
```

### **停止服务**
```bash
docker-compose stop
```

### **完全删除并重新部署**
```bash
# 停止并删除容器
docker-compose down

# 删除镜像（可选）
docker-compose down --rmi all

# 重新构建和启动
docker-compose build --no-cache
docker-compose up -d
```

---

## 📦 **更新部署**

当代码有更新时：

```bash
cd /www/docker/shumu

# 1. 拉取最新代码
git pull origin develop

# 2. 重新编译后端
cd server
npm install
npm run build
cd ..

# 3. 重新构建镜像
docker-compose build api

# 4. 重启服务
docker-compose up -d --force-recreate api

# 5. 查看日志确认启动成功
docker-compose logs -f api
```

---

## 🐛 **故障排查**

### **容器无法启动**
```bash
# 查看详细日志
docker-compose logs api

# 进入容器查看
docker-compose exec api sh
```

### **Playwright 渲染失败**
```bash
# 进入容器测试 Chromium
docker-compose exec api sh -c "npx playwright install --dry-run chromium"

# 查看字体
docker-compose exec api sh -c "fc-list :lang=zh"
```

### **端口冲突**
```bash
# 查看端口占用
netstat -tlnp | grep 5000

# 修改 docker-compose.yml 中的端口映射
# ports:
#   - "5001:5000"  # 将宿主机端口改为 5001
```

---

## 🔐 **安全建议**

1. **使用环境变量**：敏感信息不要硬编码在代码中
2. **限制容器权限**：不要使用 `privileged: true`
3. **定期更新镜像**：保持基础镜像最新
4. **配置防火墙**：只开放必要的端口

---

## 📊 **监控和维护**

### **查看资源使用**
```bash
docker stats
```

### **清理无用资源**
```bash
# 清理未使用的镜像
docker image prune -a

# 清理所有未使用资源
docker system prune -a --volumes
```

---

## 🆘 **常见问题**

### **Q: Playwright 渲染还是返回全白图像？**

A: 进入容器测试：
```bash
docker-compose exec api node -e "
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless: true});
  console.log('✅ Chromium 启动成功');
  await browser.close();
})();
"
```

### **Q: 容器内如何访问宿主机的 MySQL？**

A: 在 `.env` 中使用 `host.docker.internal`:
```
DATABASE_URL="mysql://root:password@host.docker.internal:3306/database"
```

在 Linux 上可能需要在 `docker-compose.yml` 中添加：
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## 📚 **参考资料**

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Playwright Docker 镜像](https://playwright.dev/docs/docker)

