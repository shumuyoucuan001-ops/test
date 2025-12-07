# 🚀 宝塔面板 Docker 部署指南

## 📋 准备工作

### 1. 服务器要求
- **操作系统**: 已安装宝塔面板的 Linux 系统
- **内存**: 最少 2GB，推荐 4GB+
- **存储**: 最少 10GB 可用空间
- **端口**: 开放 80 (HTTP) 和 443 (HTTPS)

### 2. 宝塔面板准备
- 登录宝塔面板
- 安装 **Docker 管理器** 插件（软件商店 → Docker 管理器）
- 安装 **Nginx** (用于反向代理)
- 安装 **SSL 证书管理器** (如果需要 HTTPS)

---

## 🔧 部署步骤

### 步骤 1: SSH 登录服务器并克隆项目

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 进入网站目录（推荐使用宝塔的默认目录）
cd /www/wwwroot

# 克隆项目
git clone https://github.com/xuxiang6/shumu.git
cd shumu

# 查看当前分支
git branch
```

---

### 步骤 2: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量（使用宝塔文件管理器或 vim）
vim .env
```

**`.env` 文件内容：**
```env
# 数据库配置 (使用 SQLite，无需额外配置)
DATABASE_URL="file:./prisma/dev.db"

# JWT密钥（请务必修改为复杂的随机字符串！）
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# 应用配置
NODE_ENV=production
PORT=5000

# Web 前端配置
NEXT_PUBLIC_API_BASE=/api
```

---

### 步骤 3: 构建并启动 Docker 容器

```bash
# 确保在项目根目录
cd /www/wwwroot/shumu

# 构建 Docker 镜像（首次部署需要 5-10 分钟）
docker-compose build

# 启动服务
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志（确保没有错误）
docker-compose logs -f
```

**预期输出：**
```
NAME                COMMAND                  SERVICE   STATUS    PORTS
shumu-api-1         "docker-entrypoint.s…"   api       running   0.0.0.0:5000->5000/tcp
shumu-web-1         "docker-entrypoint.s…"   web       running   0.0.0.0:80->3000/tcp
```

---

### 步骤 4: 宝塔面板配置反向代理（推荐方式）

#### 方式 A: 使用 Nginx 反向代理（推荐）

1. **在宝塔面板创建网站**
   - 网站管理 → 添加站点
   - 域名：`your-domain.com` 或 `服务器IP`
   - 根目录：`/www/wwwroot/shumu`（随便选，不会用到）
   - PHP版本：纯静态

2. **配置反向代理**
   
   进入 **网站设置 → 反向代理 → 添加反向代理**：
   
   **代理名称**: shumu-web  
   **目标 URL**: `http://127.0.0.1:80`  
   **启用代理**: 是

3. **配置 API 代理**
   
   在 **网站设置 → 配置文件** 中，在 `server` 块内添加：

```nginx
# API 反向代理配置
location /api {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Web 前端代理
location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

4. **保存并重启 Nginx**

#### 方式 B: 直接使用 Docker 端口（简单但不推荐）

如果不想配置 Nginx，可以直接访问：
- Web 前端: `http://服务器IP:80`
- API: `http://服务器IP:5000`

**注意**: 需要在宝塔 **安全** 面板放行 80 和 5000 端口。

---

### 步骤 5: 配置 SSL 证书（可选但推荐）

1. **在宝塔面板申请 SSL 证书**
   - 网站设置 → SSL → Let's Encrypt
   - 勾选域名 → 申请

2. **强制 HTTPS**
   - SSL 设置中开启 "强制HTTPS"

---

## ✅ 验证部署

### 1. 检查 Docker 容器状态
```bash
docker-compose ps
```

### 2. 检查 API 健康状态
```bash
curl http://localhost:5000/health
```
**预期输出**: `{"status":"ok"}`

### 3. 访问 Web 前端
- 浏览器打开: `http://your-domain.com` 或 `http://服务器IP`
- 应该看到登录页面

### 4. 测试登录
- 使用默认账号登录（如果有）
- 测试各功能模块

---

## 🔄 更新部署

### 方法 1: 使用脚本自动更新

创建更新脚本：
```bash
cat > /www/wwwroot/shumu/update.sh << 'EOF'
#!/bin/bash
echo "🚀 开始更新部署..."

cd /www/wwwroot/shumu

# 拉取最新代码
git pull origin develop

# 重新构建镜像
docker-compose build --no-cache

# 重启服务
docker-compose down
docker-compose up -d

# 检查服务状态
docker-compose ps

echo "✅ 更新完成！"
EOF

chmod +x /www/wwwroot/shumu/update.sh
```

执行更新：
```bash
cd /www/wwwroot/shumu
./update.sh
```

### 方法 2: 手动更新
```bash
cd /www/wwwroot/shumu
git pull origin develop
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 监控和维护

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看 API 日志
docker-compose logs -f api

# 只查看 Web 日志
docker-compose logs -f web
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 只重启 API
docker-compose restart api

# 只重启 Web
docker-compose restart web
```

### 停止服务
```bash
docker-compose down
```

### 查看资源使用
```bash
docker stats
```

---

## 🔒 安全建议

### 1. 修改 JWT 密钥
```bash
# 生成随机密钥
openssl rand -base64 32
```
将生成的密钥更新到 `.env` 文件中的 `JWT_SECRET`

### 2. 配置防火墙
- 在宝塔 **安全** 面板，关闭 5000 端口对外访问
- 只开放 80 和 443 端口
- 启用 Nginx 防火墙

### 3. 定期更新
```bash
# 定期拉取最新代码并更新
cd /www/wwwroot/shumu
./update.sh
```

---

## 🐛 常见问题

### 1. 容器启动失败
```bash
# 查看详细日志
docker-compose logs

# 检查端口占用
netstat -tuln | grep -E '80|5000'
```

### 2. Web 前端无法访问
- 检查 Nginx 配置是否正确
- 检查防火墙是否开放 80/443 端口
- 查看 Docker 容器是否正常运行：`docker-compose ps`

### 3. API 请求 404
- 检查 Nginx 反向代理配置中的 `/api` 路径
- 确认 API 容器运行正常：`docker-compose logs api`
- 测试 API 健康检查：`curl http://localhost:5000/health`

### 4. 数据库错误
```bash
# 进入 API 容器
docker-compose exec api bash

# 运行数据库迁移
npx prisma generate
npx prisma db push

# 退出容器
exit
```

### 5. 镜像构建慢
- 国内服务器建议配置 Docker 镜像加速
- 在宝塔 Docker 管理器中配置镜像加速地址

---

## 📞 技术支持

如果遇到问题：
1. 查看 Docker 日志：`docker-compose logs -f`
2. 检查宝塔面板的 Nginx 错误日志
3. 查看项目 GitHub Issues

---

## 🎉 部署完成检查清单

- [ ] Docker 容器正常运行（`docker-compose ps`）
- [ ] API 健康检查正常（`curl http://localhost:5000/health`）
- [ ] Web 前端可以访问
- [ ] Nginx 反向代理配置正确
- [ ] SSL 证书已配置（如果使用域名）
- [ ] 防火墙规则已设置
- [ ] JWT 密钥已修改
- [ ] 可以正常登录和使用系统

**恭喜！你的树木标签系统已成功部署！** 🎊

