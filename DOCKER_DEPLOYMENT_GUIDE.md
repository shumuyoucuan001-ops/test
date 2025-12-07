# SHUMU-MAIN 项目 Docker 部署指南

## 📋 项目架构说明

**本项目是前后端分离架构：**

- **前端**：Next.js 15 (React 18) - 位于 `web/` 目录
  - 运行端口：3000
  - 通过 `/api/*` 路径反代到后端服务
  - 使用 standalone 模式构建，独立运行

- **后端**：NestJS 11 - 位于 `server/` 目录
  - 运行端口：5000 (Docker) / 5002 (本地开发)
  - 提供 RESTful API 接口
  - 使用 Prisma ORM 连接 MySQL 数据库
  - 集成 Playwright 用于标签模板渲染

---

## 🚀 快速部署步骤

### 前置要求

1. **服务器环境**
   - Linux 服务器（推荐 Ubuntu 20.04+ 或 CentOS 7+）
   - 已安装 Docker 和 Docker Compose
   - 已安装 Git
   - MySQL 数据库（可在宿主机或独立容器）

2. **网络要求**
   - 服务器可以访问 GitHub（用于拉取代码）
   - 开放端口：3000（前端）、5000（后端）

---

## 📦 步骤1：安装 Docker 和 Docker Compose

### Ubuntu/Debian

```bash
# 更新系统
sudo apt-get update

# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### CentOS/RHEL

```bash
# 安装 Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

---

## 📥 步骤2：准备项目代码

```bash
# 创建项目目录
sudo mkdir -p /opt/shumu
cd /opt/shumu

# 克隆代码（替换为您的仓库地址）
git clone https://github.com/your-username/shumu-main.git .

# 或者如果已有代码，拉取最新
git pull origin main
```

---

## ⚙️ 步骤3：配置环境变量

在项目根目录创建 `.env` 文件：

```bash
cd /opt/shumu
cat > .env << 'EOF'
# ============================================
# 数据库配置
# ============================================
# 如果 MySQL 在宿主机，使用 host.docker.internal
# 如果 MySQL 在独立容器，使用容器名称或IP
DATABASE_URL="mysql://用户名:密码@host.docker.internal:3306/sm_xitongkaifa"

# ============================================
# 后端服务配置
# ============================================
PORT=5000
NODE_ENV=production

# ============================================
# 钉钉登录配置（可选）
# ============================================
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_CORP_ID=your_corp_id
DINGTALK_REDIRECT_URI=http://your-domain.com/login

# ============================================
# 其他配置
# ============================================
DB_HOST=host.docker.internal
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_PORT=3306
EOF
```

**重要提示：**
- 将 `your_db_user`、`your_db_password` 替换为实际的数据库用户名和密码
- 如果 MySQL 在宿主机，使用 `host.docker.internal`
- 如果 MySQL 在独立容器，使用容器名称或内网IP

---

## 🔨 步骤4：编译后端代码

```bash
cd /opt/shumu/server

# 安装依赖
npm install

# 编译 TypeScript 代码
npm run build

# 验证编译结果
ls -lh dist/
# 应该看到 main.js 等编译后的文件
```

---

## 🐳 步骤5：配置 Docker Compose

检查 `docker-compose.yml` 文件，确保配置正确：

```yaml
version: "3.9"
services:
  api:
    build:
      context: ./server
      dockerfile: ../Dockerfile.api
    env_file: ../.env
    ports:
      - "5000:5000"
    restart: always
    environment:
      - PORT=5000
      - NODE_ENV=production
    volumes:
      - ./server/prisma:/app/server/prisma
    extra_hosts:
      - "host.docker.internal:host-gateway"  # Linux 需要添加这行
    healthcheck:
      test: [ "CMD", "wget", "-qO-", "http://127.0.0.1:5000/health" ]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 40s
    networks:
      - shumu-network

  web:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_BASE=/api
      - NODE_ENV=production
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "3000:3000"
    restart: always
    networks:
      - shumu-network

networks:
  shumu-network:
    driver: bridge
```

**如果 MySQL 在宿主机，需要在 `api` 服务中添加：**
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## 🏗️ 步骤6：构建和启动服务

```bash
cd /opt/shumu

# 构建 Docker 镜像（首次部署或代码更新后）
docker-compose build --no-cache

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志（实时）
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f api

# 只查看前端日志
docker-compose logs -f web
```

---

## ✅ 步骤7：验证部署

### 检查服务状态

```bash
# 查看容器状态
docker-compose ps

# 应该看到两个服务都在运行：
# - api (后端)
# - web (前端)
```

### 测试后端健康检查

```bash
curl http://localhost:5000/health

# 应该返回：{"status":"ok"}
```

### 测试前端访问

```bash
curl http://localhost:3000

# 应该返回 HTML 内容
```

### 浏览器访问

1. 打开浏览器访问：`http://服务器IP:3000`
2. 应该能看到登录页面
3. 尝试登录测试功能

---

## 🔄 更新部署

当代码有更新时：

```bash
cd /opt/shumu

# 1. 拉取最新代码
git pull origin main

# 2. 重新编译后端
cd server
npm install
npm run build
cd ..

# 3. 重新构建镜像（只构建更新的服务）
docker-compose build api web

# 或者强制重新构建
docker-compose build --no-cache api web

# 4. 重启服务
docker-compose up -d --force-recreate

# 5. 查看日志确认启动成功
docker-compose logs -f api
```

---

## 🛠️ 常用管理命令

### 查看服务状态

```bash
docker-compose ps
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看最近100行日志
docker-compose logs --tail=100

# 只查看后端日志
docker-compose logs -f api

# 只查看前端日志
docker-compose logs -f web
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 只重启后端
docker-compose restart api

# 只重启前端
docker-compose restart web
```

### 停止服务

```bash
# 停止所有服务
docker-compose stop

# 停止并删除容器
docker-compose down
```

### 进入容器调试

```bash
# 进入后端容器
docker-compose exec api sh

# 进入前端容器
docker-compose exec web sh
```

---

## 🔧 配置 Nginx 反向代理（可选）

如果需要使用域名访问，配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API（可选，如果不想通过前端反代）
    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🐛 故障排查

### 问题1：容器无法启动

```bash
# 查看详细错误日志
docker-compose logs api
docker-compose logs web

# 检查容器状态
docker-compose ps

# 进入容器查看
docker-compose exec api sh
```

### 问题2：无法连接数据库

```bash
# 检查数据库连接配置
cat .env | grep DATABASE_URL

# 测试数据库连接（在宿主机）
mysql -h host.docker.internal -u 用户名 -p

# 在容器内测试
docker-compose exec api sh -c "node -e \"const mysql = require('mysql2'); const conn = mysql.createConnection({host:'host.docker.internal',user:'root',password:'密码'}); conn.connect(); console.log('连接成功');\""
```

### 问题3：前端无法访问后端

```bash
# 检查后端是否正常运行
curl http://localhost:5000/health

# 检查网络连接
docker-compose exec web ping api

# 查看前端配置
docker-compose exec web env | grep API
```

### 问题4：Playwright 渲染失败

```bash
# 进入后端容器测试 Chromium
docker-compose exec api sh -c "npx playwright install --dry-run chromium"

# 测试 Chromium 启动
docker-compose exec api node -e "
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless: true});
  console.log('✅ Chromium 启动成功');
  await browser.close();
})();
"
```

### 问题5：端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep 3000
netstat -tlnp | grep 5000

# 修改 docker-compose.yml 中的端口映射
# ports:
#   - "3001:3000"  # 将宿主机端口改为 3001
```

---

## 📊 监控和维护

### 查看资源使用

```bash
# 查看容器资源使用情况
docker stats

# 查看磁盘使用
docker system df
```

### 清理无用资源

```bash
# 清理未使用的镜像
docker image prune -a

# 清理所有未使用资源（谨慎使用）
docker system prune -a --volumes
```

### 备份数据

```bash
# 备份数据库（如果 MySQL 在宿主机）
mysqldump -u root -p sm_xitongkaifa > backup_$(date +%Y%m%d).sql

# 备份环境配置
cp .env .env.backup
```

---

## 🔐 安全建议

1. **使用环境变量**：敏感信息不要硬编码
2. **限制容器权限**：不要使用 `privileged: true`
3. **配置防火墙**：只开放必要的端口
4. **定期更新镜像**：保持基础镜像最新
5. **使用 HTTPS**：生产环境配置 SSL 证书
6. **数据库安全**：使用强密码，限制访问IP

---

## 📝 部署检查清单

- [ ] Docker 和 Docker Compose 已安装
- [ ] 项目代码已克隆到服务器
- [ ] `.env` 文件已配置（数据库连接、端口等）
- [ ] 后端代码已编译（`npm run build`）
- [ ] Docker 镜像已构建成功
- [ ] 容器已启动并运行
- [ ] 后端健康检查通过（`/health`）
- [ ] 前端可以正常访问
- [ ] 数据库连接正常
- [ ] 登录功能测试通过
- [ ] Nginx 反向代理已配置（如需要）

---

## 🆘 获取帮助

如果遇到问题：

1. 查看日志：`docker-compose logs -f`
2. 检查配置文件：`.env`、`docker-compose.yml`
3. 查看容器状态：`docker-compose ps`
4. 进入容器调试：`docker-compose exec api sh`

---

## 📚 相关文件说明

- `Dockerfile` - 前端构建配置
- `Dockerfile.api` - 后端构建配置（包含 Playwright）
- `docker-compose.yml` - Docker Compose 编排配置
- `.env` - 环境变量配置（需要创建）
- `server/src/main.ts` - 后端入口文件
- `web/next.config.ts` - Next.js 配置

---

## 🎯 快速参考

```bash
# 完整部署流程
cd /opt/shumu
git pull origin main
cd server && npm install && npm run build && cd ..
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f

# 更新部署
cd /opt/shumu
git pull origin main
cd server && npm run build && cd ..
docker-compose build api web
docker-compose up -d --force-recreate

# 查看状态
docker-compose ps
docker-compose logs -f api
```

---

**部署完成后，访问 `http://服务器IP:3000` 即可使用系统！**

